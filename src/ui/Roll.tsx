import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { framePhrase, noteBox, panWindow, pitchLabel, pitchToY, rulerMarks, timeToX, xToTime, zoomWindow, type KnownGrid, type TimeWindow } from "./roll-time";
import type { TransportSnapshot } from "../audio/web/transport";
import { gridStep, nearestStep, resizeNote, snapDelta, type RollNote } from "./roll-notes";
import { isBlackKey, keyShape, nextDrawId, RollTransaction } from "./roll-interaction";
import type { Palette } from "./theme";

export type RollTool = "select" | "draw" | "erase" | "velocity" | "pan";
const WebView = View as React.ComponentType<React.ComponentProps<typeof View> & { dataSet?: Record<string, string> }>;
const RULER = 28;
type Range = { start: bigint; end: bigint };
type RollProps = {
  notes: readonly RollNote[]; timeWindow: TimeWindow | null; bounds: Range | null;
  ceiling: bigint; historyStart: bigint; grid: KnownGrid | null; palette: Palette;
  mode: "compact" | "room"; tool: RollTool; selectedId: string | null;
  ghosts: readonly { id: string; start: bigint; end: bigint }[]; hitPx: number;
  onWindow: (next: TimeWindow) => void; onBoundsCommit: (next: Range) => void;
  onSelect: (id: string | null) => void; onCommitNotes: (next: RollNote[]) => void;
  onEdit?: () => void; onClose?: () => void; onTool?: (tool: RollTool) => void;
  showPan?: boolean; readTransport?: () => TransportSnapshot;
  onAudition?: (pitch: number, down: boolean) => void; onStopAudition?: () => void;
  readSoundingPitches?: () => readonly number[] | null;
};
type Drag = {
  kind: "bound" | "draw" | "erase" | "velocity" | "move" | "resize";
  pointer: number; x: number; y: number; clientY: number; view: TimeWindow;
  row: number; top: number; width: number; bounds: Range | null;
  note?: RollNote; edge?: "start" | "end"; erased: Set<string>; selection: string | null; moved?: boolean;
};
type Pinch = { distance: number; x: number; y: number; view: TimeWindow; top: number; row: number; width: number };

export function Roll({ notes, timeWindow, bounds, ceiling, historyStart, grid, palette, mode, tool, selectedId, ghosts, hitPx, onWindow, onBoundsCommit, onSelect, onCommitNotes, onEdit, onClose, onTool, showPan = true, readTransport, onAudition, onStopAudition, readSoundingPitches }: RollProps) {
  const viewport = useWindowDimensions();
  const host = useRef<HTMLElement | null>(null);
  const keyboard = useRef<HTMLElement | null>(null);
  const [plotWidth, setPlotWidth] = useState(640);
  const [topPitch, setTopPitch] = useState(() => topOf(notes));
  const [roomRow, setRoomRow] = useState(24);
  const [viewTools, setViewTools] = useState(false);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [sounding, setSounding] = useState<readonly number[]>([]);
  const [preview, setPreview] = useState<RollNote[] | null>(null);
  const [previewBounds, setPreviewBounds] = useState<Range | null>(null);
  const [gestureText, setGestureText] = useState("");
  const drag = useRef<Drag | null>(null);
  const transaction = useRef<RollTransaction | null>(null);
  const liveBounds = useRef<Range | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<Pinch | null>(null);
  const auditions = useRef(new Map<number, number>());
  const shownNotes = preview ?? notes;
  const shownBounds = previewBounds ?? bounds;
  const view = timeWindow ?? (bounds ? framePhrase(historyStart, bounds.start, bounds.end) : frameOf(notes, historyStart));
  const rowHeight = mode === "room" ? roomRow : fitRow(notes);
  const pitchTop = mode === "compact" ? topOf(notes) : topPitch;
  const noteHeight = mode === "room" ? Math.max(240, Math.min(432, viewport.height - (viewport.width < 720 ? 520 : 360))) : 112;
  const labelWidth = mode === "compact" ? 20 : plotWidth < 500 ? 32 : 44;
  const pitches = visiblePitches(pitchTop, noteHeight, rowHeight);
  const canAudition = mode === "room" && rowHeight >= 24 && !!onAudition;
  const selected = shownNotes.find(note => note.id === selectedId);
  const activeTool = tool === "velocity" || tool === "pan" ? "select" : tool;
  const engineReaders = useRef({ readTransport, readSoundingPitches });
  engineReaders.current = { readTransport, readSoundingPitches };

  useEffect(() => {
    let frame = 0;
    let lastPosition: number | null = null;
    let lastPitches = "";
    const tick = () => {
      const snap = engineReaders.current.readTransport?.();
      const position = snap?.availability === "available" && snap.state === "playing" && snap.positionSeconds !== null && Number.isFinite(snap.positionSeconds) ? snap.positionSeconds : null;
      if (position !== lastPosition) { lastPosition = position; setPlayhead(position); }
      const pitchesNow = engineReaders.current.readSoundingPitches?.() ?? [];
      const key = pitchesNow.join(",");
      if (key !== lastPitches) { lastPitches = key; setSounding([...pitchesNow]); }
      frame = requestAnimationFrame(tick);
    };
    setPlayhead(null); setSounding([]);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  function local(clientX: number, clientY: number) {
    const rect = host.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0) - (host.current?.clientLeft ?? 0), y: clientY - (rect?.top ?? 0) - (host.current?.clientTop ?? 0) - RULER };
  }
  function clearPreview() {
    transaction.current?.cancel(); transaction.current = null;
    liveBounds.current = null; drag.current = null;
    setPreview(null); setPreviewBounds(null); setGestureText("");
  }
  function cancelEdit() {
    const previous = drag.current;
    clearPreview();
    if (previous) onSelect(previous.selection);
  }
  function stopAuditions() {
    if (auditions.current.size) {
      for (const pitch of auditions.current.values()) onAudition?.(pitch, false);
      auditions.current.clear();
    }
    onStopAudition?.();
  }
  function cancelAll() { cancelEdit(); pointers.current.clear(); pinch.current = null; stopAuditions(); }
  const handlers = useRef({ begin: (_event: PointerEvent) => {}, move: (_event: PointerEvent) => {}, end: (_event: PointerEvent) => {}, audition: (_event: PointerEvent) => {}, cancel: () => {}, key: (_event: KeyboardEvent) => {} });

  function capturePointer(event: PointerEvent, element: HTMLElement | null) {
    try { element?.setPointerCapture(event.pointerId); } catch { /* Window listeners still release the gesture. */ }
  }
  function begin(event: PointerEvent) {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    event.preventDefault();
    if (pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    capturePointer(event, host.current);
    if (pointers.current.size >= 2) {
      cancelEdit();
      stopAuditions();
      const [a, b] = [...pointers.current.values()];
      const middle = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x: middle.x, y: middle.y, view, top: pitchTop, row: rowHeight, width: plotWidth };
      return;
    }
    const { x, y } = local(event.clientX, event.clientY);
    const base: Omit<Drag, "kind"> = { pointer: event.pointerId, x, y, clientY: event.clientY, view, row: rowHeight, top: pitchTop, width: plotWidth, bounds, erased: new Set(), selection: selectedId };
    if (mode === "compact") {
      if (bounds && y >= -RULER && y < 20) {
        const startDistance = Math.abs(x - timeToX(bounds.start, view, plotWidth));
        const endDistance = Math.abs(x - timeToX(bounds.end, view, plotWidth));
        if (Math.min(startDistance, endDistance) <= Math.max(48, hitPx) / 2) drag.current = { ...base, kind: "bound", edge: startDistance <= endDistance ? "start" : "end" };
      }
      return;
    }
    if (y < 0 || y >= noteHeight || ghosts.length > 0) return;
    const hit = noteAt(notes, x, y, view, plotWidth, pitchTop, rowHeight);
    transaction.current = new RollTransaction(notes);
    if (tool === "erase") {
      const current: Drag = { ...base, kind: "erase" };
      drag.current = current;
      if (hit) { current.erased.add(hit.id); previewNotes(notes.filter(note => !current.erased.has(note.id))); }
      return;
    }
    if (tool === "draw") {
      if (hit) { onSelect(hit.id); transaction.current = null; return; }
      const rawStart = xToTime(x, view, plotWidth);
      const start = grid && !event.altKey ? nearestStep(rawStart, grid) : rawStart;
      const length = grid && !event.altKey ? gridStep(grid) : 150_000n;
      const note: RollNote = { id: nextDrawId(notes), channel: 0, pitch: clampPitch(pitchTop - Math.floor(y / rowHeight)), start, end: start + length, velocity: 96, sourceOnId: null, sourceOffId: null };
      drag.current = { ...base, kind: "draw", note };
      previewNotes([...notes, note]);
      setGestureText(describe(note));
      return;
    }
    if (!hit) { onSelect(null); transaction.current = null; return; }
    onSelect(hit.id);
    if (tool === "velocity") { drag.current = { ...base, kind: "velocity", note: hit }; return; }
    const box = noteBox(hit.start, hit.end, hit.pitch, view, plotWidth, pitchTop, rowHeight);
    const atEnd = x >= box.x + Math.max(8, box.width) - Math.min(12, Math.max(8, box.width) / 3);
    drag.current = { ...base, kind: atEnd ? "resize" : "move", note: hit };
  }
  function previewNotes(next: RollNote[]) { transaction.current?.preview(next); setPreview(next); }
  function move(event: PointerEvent) {
    const point = pointers.current.get(event.pointerId);
    if (!point) return;
    event.preventDefault();
    point.x = event.clientX; point.y = event.clientY;
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const p = pinch.current;
      const middle = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const anchor = xToTime(p.x, p.view, p.width);
      const zoomed = zoomWindow(p.view, p.distance / distance, anchor, 50_000n, 120_000_000n);
      const delta = BigInt(Math.round((p.x - middle.x) / p.width * Number(zoomed.end - zoomed.start)));
      onWindow(panWindow(zoomed, delta, historyStart));
      if (mode === "room") setTopPitch(clampPitch(p.top + Math.round((middle.y - p.y) / p.row)));
      return;
    }
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const { x, y } = local(event.clientX, event.clientY);
    if (current.kind === "bound" && current.bounds) {
      if (Math.abs(x - current.x) < 3 && !liveBounds.current) return;
      const time = xToTime(x, current.view, current.width);
      const start = current.bounds.start;
      const end = current.bounds.end;
      const next = current.edge === "start"
        ? { start: maxBig(historyStart, minBig(time, end - 1n)), end }
        : { start, end: minBig(ceiling, maxBig(time, start + 1n)) };
      if (next.end <= next.start) return;
      liveBounds.current = next; setPreviewBounds(next);
      setGestureText(`${current.edge === "start" ? "Start" : "End"} ${seconds(current.edge === "start" ? next.start : next.end)}s`);
      return;
    }
    const baseline = transaction.current?.baseline;
    if (!baseline) return;
    if (current.kind === "erase") {
      const hit = noteAt(baseline, x, y, current.view, current.width, current.top, current.row);
      if (hit) current.erased.add(hit.id);
      previewNotes(baseline.filter(note => !current.erased.has(note.id)));
      setGestureText(`Erase ${current.erased.size} note${current.erased.size === 1 ? "" : "s"} on release`);
      return;
    }
    const note = current.note;
    if (!note) return;
    if (!current.moved && Math.abs(x - current.x) < 3 && Math.abs(y - current.y) < 3) return;
    current.moved = true;
    const rawTime = xToTime(x, current.view, current.width);
    const time = grid && !event.altKey ? nearestStep(rawTime, grid) : rawTime;
    if (current.kind === "draw") {
      const drawn = { ...note, start: minBig(note.start, time), end: maxBig(note.start + 1n, time) };
      previewNotes([...baseline, drawn]); setGestureText(describe(drawn)); return;
    }
    if (current.kind === "resize") {
      const delta = rawTime - xToTime(current.x, current.view, current.width);
      const end = note.end + (grid && !event.altKey ? snapDelta(delta, gridStep(grid)) : delta);
      const next = resizeNote(baseline, note.id, "end", end);
      previewNotes(next); setGestureText(describe(next.find(n => n.id === note.id)!)); return;
    }
    if (current.kind === "velocity") {
      const velocity = Math.max(1, Math.min(127, Math.round(note.velocity + current.clientY - event.clientY)));
      previewNotes(baseline.map(n => n.id === note.id ? { ...n, velocity } : n));
      setGestureText(`${pitchLabel(note.pitch)} · velocity ${velocity}`); return;
    }
    const deltaTime = rawTime - xToTime(current.x, current.view, current.width);
    const delta = grid && !event.altKey ? snapDelta(deltaTime, gridStep(grid)) : deltaTime;
    const start = maxBig(0n, note.start + delta);
    const moved = { ...note, pitch: clampPitch(note.pitch - Math.round((y - current.y) / current.row)), start, end: start + note.end - note.start };
    previewNotes(baseline.map(n => n.id === note.id ? moved : n)); setGestureText(describe(moved));
  }
  function end(event: PointerEvent) {
    const auditionPitch = auditions.current.get(event.pointerId);
    if (auditionPitch !== undefined) {
      auditions.current.delete(event.pointerId);
      if (![...auditions.current.values()].includes(auditionPitch)) onAudition?.(auditionPitch, false);
    }
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (pinch.current) { if (pointers.current.size === 0) pinch.current = null; return; }
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const range = liveBounds.current;
    const next = transaction.current?.commit() ?? null;
    clearPreview();
    if (current.kind === "bound" && range && current.bounds && (range.start !== current.bounds.start || range.end !== current.bounds.end)) onBoundsCommit(range);
    if (next) {
      onCommitNotes(next);
      if (current.kind === "draw") onSelect(current.note!.id);
      if (current.kind === "erase" && selectedId && current.erased.has(selectedId)) onSelect(null);
    }
  }
  function audition(event: PointerEvent) {
    if (!canAudition || (event.button !== 0 && event.pointerType !== "touch")) return;
    event.preventDefault();
    cancelEdit();
    const rect = keyboard.current?.getBoundingClientRect();
    if (!rect) return;
    const pitch = pitchTop - Math.floor((event.clientY - rect.top) / rowHeight);
    if (pitch < 0 || pitch > 127 || auditions.current.has(event.pointerId)) return;
    capturePointer(event, keyboard.current);
    const alreadyHeld = [...auditions.current.values()].includes(pitch);
    auditions.current.set(event.pointerId, pitch);
    if (!alreadyHeld) onAudition?.(pitch, true);
  }
  function key(event: KeyboardEvent) {
    if (event.key === "Escape") { cancelAll(); return; }
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") cancelAll();
    if (event.ctrlKey || event.metaKey || mode !== "room") return;
    const next = ({ d: "draw", s: "select", e: "erase" } as const)[event.key.toLowerCase() as "d" | "s" | "e"];
    if (next) { cancelAll(); onTool?.(next); }
  }
  handlers.current = { begin, move, end, audition, cancel: cancelAll, key };
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const element = host.current; const keys = keyboard.current;
    const down = (event: PointerEvent) => handlers.current.begin(event);
    const keyDown = (event: PointerEvent) => handlers.current.audition(event);
    const moveEvent = (event: PointerEvent) => handlers.current.move(event);
    const up = (event: PointerEvent) => handlers.current.end(event);
    const cancel = () => handlers.current.cancel();
    const lost = (event: PointerEvent) => { if (pointers.current.has(event.pointerId) || auditions.current.has(event.pointerId)) cancel(); };
    const keyEvent = (event: KeyboardEvent) => handlers.current.key(event);
    const outsideDown = (event: PointerEvent) => {
      if (pointers.current.size && !element?.contains(event.target as Node)) cancel();
    };
    const visibility = () => { if (document.hidden) cancel(); };
    element?.addEventListener("pointerdown", down); keys?.addEventListener("pointerdown", keyDown);
    element?.addEventListener("lostpointercapture", lost); keys?.addEventListener("lostpointercapture", lost);
    window.addEventListener("pointermove", moveEvent, { passive: false }); window.addEventListener("pointerup", up);
    window.addEventListener("pointerdown", outsideDown, true);
    window.addEventListener("pointercancel", cancel); window.addEventListener("blur", cancel); window.addEventListener("keydown", keyEvent);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancel(); element?.removeEventListener("pointerdown", down); keys?.removeEventListener("pointerdown", keyDown);
      element?.removeEventListener("lostpointercapture", lost); keys?.removeEventListener("lostpointercapture", lost);
      window.removeEventListener("pointermove", moveEvent); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("pointerdown", outsideDown, true);
      window.removeEventListener("blur", cancel); window.removeEventListener("keydown", keyEvent); document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => { handlers.current.cancel(); }, [mode, tool]);
  useEffect(() => { setTopPitch(topOf(notes)); if (mode === "room") setRoomRow(fitRoomRow(notes, noteHeight)); }, [mode, viewport.width, viewport.height]);
  useEffect(() => { if (drag.current) handlers.current.cancel(); }, [notes]);
  useEffect(() => { if (!canAudition) stopAuditions(); }, [canAudition]);

  function refocus() { cancelAll(); setTopPitch(topOf(notes)); if (mode === "room") setRoomRow(fitRoomRow(notes, noteHeight)); onWindow(bounds ? framePhrase(historyStart, bounds.start, bounds.end) : frameOf(notes, historyStart)); }
  function zoom(factor: number) { cancelAll(); onWindow(zoomWindow(view, factor, view.start + (view.end - view.start) / 2n, 50_000n, 120_000_000n)); }
  function editSelected(change: (note: RollNote) => RollNote) {
    if (!selected || ghosts.length > 0) return;
    cancelAll();
    const tx = new RollTransaction(notes); tx.preview(notes.map(note => note.id === selected.id ? change(note) : note));
    const next = tx.commit(); if (next) onCommitNotes(next);
  }
  const marks = rulerMarks(view, grid);
  return (
    <WebView accessibilityLabel={mode === "room" ? "Piano roll" : "Take ribbon"} style={{ marginTop: 8 }}>
      <WebView style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Text style={{ color: palette.muted, fontSize: 12, width: mode === "room" ? "100%" : undefined }}>{grid ? `${grid.bpm} BPM · ${grid.beatsPerBar}/4${grid.provisional ? " · proposed" : ""}` : "Seconds"}{mode === "room" ? " · Loop locked" : ""}</Text>
        {mode === "compact" && onEdit ? <Tool label="Edit" onPress={onEdit} palette={palette} hit={hitPx} /> : null}
        {mode === "room" && onClose ? <Tool label="Play view" onPress={onClose} palette={palette} hit={hitPx} /> : null}
        {mode === "room" && onTool ? <WebView accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 4 }}>
          {(["draw", "select", "erase"] as const).map(name => <Tool key={name} label={name[0].toUpperCase() + name.slice(1)} onPress={() => { cancelAll(); onTool(name); }} palette={palette} hit={hitPx} on={activeTool === name} radio />)}
        </WebView> : null}
        <Tool label="View" onPress={() => setViewTools(value => !value)} palette={palette} hit={hitPx} on={viewTools} />
      </WebView>
      {viewTools ? <WebView style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <Tool label="Zoom in" onPress={() => zoom(0.5)} palette={palette} hit={hitPx} />
        <Tool label="Zoom out" onPress={() => zoom(2)} palette={palette} hit={hitPx} />
        {showPan || mode === "room" ? <><Tool label="Earlier" onPress={() => { cancelAll(); onWindow(panWindow(view, -(view.end - view.start) / 2n, historyStart)); }} palette={palette} hit={hitPx} /><Tool label="Later" onPress={() => { cancelAll(); onWindow(panWindow(view, (view.end - view.start) / 2n, historyStart)); }} palette={palette} hit={hitPx} /></> : null}
        <Tool label="Refocus" onPress={refocus} palette={palette} hit={hitPx} />
        {mode === "room" ? <>
          <Tool label="Taller rows" onPress={() => { cancelAll(); setRoomRow(row => Math.min(40, row + 8)); }} palette={palette} hit={hitPx} />
          <Tool label="Smaller rows" onPress={() => { cancelAll(); setRoomRow(row => Math.max(16, row - 8)); }} palette={palette} hit={hitPx} />
          <Tool label="Higher pitches" onPress={() => { cancelAll(); setTopPitch(pitch => Math.min(127, pitch + 12)); }} palette={palette} hit={hitPx} />
          <Tool label="Lower pitches" onPress={() => { cancelAll(); setTopPitch(pitch => Math.max(12, pitch - 12)); }} palette={palette} hit={hitPx} />
        </> : null}
      </WebView> : null}
      {mode === "room" ? <Text style={{ color: palette.muted, fontSize: 12, marginBottom: 6 }}>{ghosts.length ? "Quantise preview · dashed notes keep original timing · Apply or Cancel to edit" : tool === "velocity" ? "Velocity · drag a selected note up or down" : activeTool === "draw" ? "Draw · drag to add a note; tap a note to select" : activeTool === "erase" ? "Erase · stroke notes, release to apply" : "Select · drag a note to move; drag its right edge to resize"}{" · Two fingers pan/zoom"}</Text> : null}
      <WebView style={{ flexDirection: "row" }}>
        <WebView ref={node => { keyboard.current = node as unknown as HTMLElement; }} dataSet={{ keyboard: mode, rowHeight: String(rowHeight), audition: canAudition ? "enabled" : "display-only" }} accessibilityLabel={canAudition ? "Piano keys, hold to audition" : "Piano keys, display only"} style={{ width: labelWidth, height: noteHeight, marginTop: RULER + 1, position: "relative", overflow: "hidden", touchAction: "none", backgroundColor: "#E7E1D6" } as never}>
          {[...pitches].sort((a, b) => Number(isBlackKey(a)) - Number(isBlackKey(b))).map(pitch => {
            const shape = keyShape(pitch, pitchTop, rowHeight);
            return <WebView key={pitch} pointerEvents="none" dataSet={{ pianoKey: String(pitch) }} style={{ position: "absolute", top: shape.top, height: shape.height, left: 0, width: shape.black ? "63%" : "100%", backgroundColor: shape.black ? "#252931" : "#E7E1D6", borderBottomWidth: 1, borderBottomColor: shape.black ? "#0A0C0F" : "#8C8C8C", borderRightWidth: 1, borderRightColor: "#737373", borderBottomRightRadius: shape.black ? 2 : 0 }} />;
          })}
          {pitches.map(pitch => <WebView key={`target-${pitch}`} pointerEvents="none" dataSet={{ pitchRow: String(pitch) }} style={{ position: "absolute", top: pitchToY(pitch, pitchTop, rowHeight), height: rowHeight, left: 0, right: 0, justifyContent: "center", alignItems: "flex-end", borderRightWidth: sounding.includes(pitch) ? 4 : 0, borderRightColor: palette.accent }}>
            {pitch % 12 === 0 ? <Text style={{ fontSize: mode === "compact" ? 7 : 9, color: "#17150F", marginRight: 2, fontWeight: pitch === 60 ? "900" : "600" }}>{pitchLabel(pitch)}{pitch === 60 ? "·" : ""}</Text> : null}
            {sounding.includes(pitch) ? <Text style={{ position: "absolute", left: 1, color: isBlackKey(pitch) ? "#FFFFFF" : "#17150F", fontSize: Math.min(12, rowHeight - 2) }}>●</Text> : null}
          </WebView>)}
        </WebView>
        <WebView ref={node => { host.current = node as unknown as HTMLElement; }} dataSet={{ roll: "true" }} onLayout={event => { const next = host.current?.clientWidth || event.nativeEvent.layout.width; if (next > 0 && Math.abs(next - plotWidth) > 1) setPlotWidth(next); }} style={{ position: "relative", flex: 1, height: RULER + noteHeight + 2, backgroundColor: palette.plot, borderRadius: 8, borderWidth: 1, borderColor: palette.line, overflow: "hidden", touchAction: "none", userSelect: "none" } as never}>
          {pitches.map(pitch => <WebView key={`row-${pitch}`} pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: RULER + pitchToY(pitch, pitchTop, rowHeight), height: rowHeight, backgroundColor: isBlackKey(pitch) ? palette.line : "transparent", opacity: 0.4, borderBottomWidth: 1, borderBottomColor: palette.line }} />)}
          {marks.map(mark => <React.Fragment key={mark.kind + mark.time.toString()}>
            <WebView pointerEvents="none" style={{ position: "absolute", left: timeToX(mark.time, view, plotWidth), top: RULER, bottom: 0, width: mark.kind === "bar" ? 2 : 1, backgroundColor: mark.kind === "bar" ? palette.muted : palette.line, opacity: mark.tentative ? 0.4 : 0.65 }} />
            {mark.label ? <Text pointerEvents="none" style={{ position: "absolute", left: timeToX(mark.time, view, plotWidth) + 3, top: 5, color: palette.muted, fontSize: 10 }}>{mark.label}</Text> : null}
          </React.Fragment>)}
          {shownBounds ? <WebView pointerEvents="none" style={{ position: "absolute", left: timeToX(shownBounds.start, view, plotWidth), width: Math.max(0, timeToX(shownBounds.end, view, plotWidth) - timeToX(shownBounds.start, view, plotWidth)), top: RULER, bottom: 0, backgroundColor: palette.ink, opacity: 0.04 }} /> : null}
          {shownNotes.map(note => {
            const target = ghosts.find(ghost => ghost.id === note.id);
            const box = noteBox(target?.start ?? note.start, target?.end ?? note.end, note.pitch, view, plotWidth, pitchTop, rowHeight);
            const chosen = note.id === selectedId;
            return <WebView key={note.id} pointerEvents="none" dataSet={{ note: note.id, start: (target?.start ?? note.start).toString(), end: (target?.end ?? note.end).toString(), velocity: String(note.velocity), pitch: String(note.pitch) }} style={{ position: "absolute", left: box.x, top: RULER + box.y + 1, width: Math.max(8, box.width), height: box.height, borderRadius: 3, backgroundColor: chosen ? palette.accent : palette.note, borderWidth: chosen ? 2 : 0, borderColor: palette.ink, overflow: "hidden", opacity: 0.65 + note.velocity / 127 * 0.35 }}>
              {chosen && mode === "room" ? <>{box.width >= 30 ? <Text numberOfLines={1} style={{ fontSize: 10, color: palette.accentInk, paddingLeft: 2 }}>{pitchLabel(note.pitch)}</Text> : null}<WebView style={{ position: "absolute", right: 2, top: 3, bottom: 3, width: 2, backgroundColor: palette.accentInk }} /></> : null}
            </WebView>;
          })}
          {ghosts.map(ghost => {
            const note = shownNotes.find(n => n.id === ghost.id); if (!note) return null;
            const box = noteBox(note.start, note.end, note.pitch, view, plotWidth, pitchTop, rowHeight);
            return <WebView key={`ghost-${ghost.id}`} pointerEvents="none" dataSet={{ ghost: ghost.id }} style={{ position: "absolute", left: box.x, top: RULER + box.y + 1, width: Math.max(2, box.width), height: box.height, borderRadius: 3, borderWidth: 2, borderStyle: "dashed", borderColor: palette.accent }} />;
          })}
          {shownBounds ? <>
            <Boundary x={timeToX(shownBounds.start, view, plotWidth)} palette={palette} handle={mode === "compact"} />
            <Boundary x={timeToX(shownBounds.end, view, plotWidth)} palette={palette} handle={mode === "compact"} />
          </> : null}
          {playhead !== null ? <WebView pointerEvents="none" dataSet={{ playhead: String(playhead) }} style={{ position: "absolute", left: timeToX(BigInt(Math.round(playhead * 1_000_000)), view, plotWidth), top: 0, bottom: 0, width: 2, backgroundColor: palette.accent }} /> : null}
          {gestureText ? <WebView pointerEvents="none" style={{ position: "absolute", top: RULER + 6, left: 8, right: 8, alignItems: "center" }}><Text style={{ color: palette.ink, backgroundColor: palette.card, padding: 6, borderRadius: 6, fontSize: 12 }}>{gestureText}</Text></WebView> : null}
        </WebView>
      </WebView>
      {mode === "room" ? <Text style={{ color: palette.muted, fontSize: 11, marginTop: 5 }}>{canAudition ? "Hold a piano key to audition · C4 is middle C" : "Keyboard display only · taller rows enable audition when sound is available"}</Text> : null}
      {mode === "room" && selected ? <WebView style={{ marginTop: 8, gap: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
        <Text style={{ color: palette.ink, fontSize: 12 }}>{pitchLabel(selected.pitch)} · {seconds(selected.start)}s · velocity {selected.velocity}</Text>
        <Tool label="Velocity" onPress={() => { cancelAll(); onTool?.(tool === "velocity" ? "select" : "velocity"); }} palette={palette} hit={hitPx} on={tool === "velocity"} />
        <Tool disabled={ghosts.length > 0} label="Softer" onPress={() => editSelected(note => ({ ...note, velocity: Math.max(1, note.velocity - 8) }))} palette={palette} hit={hitPx} />
        <Tool disabled={ghosts.length > 0} label="Louder" onPress={() => editSelected(note => ({ ...note, velocity: Math.min(127, note.velocity + 8) }))} palette={palette} hit={hitPx} />
        <Tool disabled={ghosts.length > 0} label="Shorter" onPress={() => editSelected(note => ({ ...note, end: maxBig(note.start + 1n, note.end - (grid ? gridStep(grid) : 50_000n)) }))} palette={palette} hit={hitPx} />
        <Tool disabled={ghosts.length > 0} label="Longer" onPress={() => editSelected(note => ({ ...note, end: note.end + (grid ? gridStep(grid) : 50_000n) }))} palette={palette} hit={hitPx} />
      </WebView> : null}
      {shownBounds && shownNotes.length > 0 && shownBounds.end > lastEnd(shownNotes) ? <Text style={{ color: palette.muted, marginTop: 6, fontSize: 12 }}>The loop keeps the space after the last note.</Text> : null}
    </WebView>
  );
}
function minBig(a: bigint, b: bigint) { return a < b ? a : b; }
function maxBig(a: bigint, b: bigint) { return a > b ? a : b; }
function clampPitch(pitch: number) { return Math.max(0, Math.min(127, pitch)); }
function seconds(time: bigint) { return (Number(time) / 1_000_000).toFixed(2); }
function describe(note: RollNote) { return `${pitchLabel(note.pitch)} · ${seconds(note.start)}s · length ${seconds(note.end - note.start)}s`; }
function lastEnd(notes: readonly RollNote[]) { return notes.reduce((max, note) => maxBig(max, note.end), 0n); }
function topOf(notes: readonly RollNote[]) { return notes.length ? Math.min(127, Math.max(...notes.map(note => note.pitch)) + 2) : 72; }
function fitRoomRow(notes: readonly RollNote[], height: number) { const span = notes.length ? Math.max(...notes.map(note => note.pitch)) - Math.min(...notes.map(note => note.pitch)) + 5 : 16; const fit = height / span; return fit >= 24 ? 24 : fit >= 16 ? 16 : Math.max(2, Math.floor(fit)); }
function fitRow(notes: readonly RollNote[]) { const span = notes.length ? Math.max(...notes.map(note => note.pitch)) - Math.min(...notes.map(note => note.pitch)) + 5 : 12; return Math.max(2, Math.min(14, 112 / span)); }
function frameOf(notes: readonly RollNote[], floor: bigint): TimeWindow { if (!notes.length) return { start: floor, end: floor + 4_000_000n }; const start = notes.reduce((min, note) => minBig(min, note.start), notes[0].start); return framePhrase(floor, start, maxBig(start + 1n, lastEnd(notes))); }
function visiblePitches(top: number, height: number, row: number) { return Array.from({ length: Math.ceil(height / row) + 1 }, (_, i) => top - i).filter(pitch => pitch >= 0 && pitch <= 127); }
function noteAt(notes: readonly RollNote[], x: number, y: number, view: TimeWindow, width: number, top: number, row: number): RollNote | null {
  for (let i = notes.length - 1; i >= 0; i--) { const note = notes[i]; const box = noteBox(note.start, note.end, note.pitch, view, width, top, row); if (x >= box.x && x <= box.x + Math.max(8, box.width) && y >= box.y && y < box.y + row) return note; }
  return null;
}
function Boundary({ x, palette, handle }: { x: number; palette: Palette; handle: boolean }) { return <WebView pointerEvents="none" style={{ position: "absolute", left: x - 1, top: 0, bottom: 0, width: 2, backgroundColor: palette.muted }}>{handle ? <WebView style={{ position: "absolute", left: -5, top: 6, width: 12, height: 16, borderRadius: 3, borderWidth: 1, borderColor: palette.ink, backgroundColor: palette.card }} /> : null}</WebView>; }
function Tool({ label, onPress, palette, hit, on, radio, disabled }: { label: string; onPress: () => void; palette: Palette; hit: number; on?: boolean; radio?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole={radio ? "radio" : "button"} accessibilityLabel={label} accessibilityState={radio ? { checked: !!on, disabled } : { selected: !!on, disabled }} disabled={disabled} onPress={onPress} style={{ opacity: disabled ? 0.45 : 1, minHeight: Math.max(44, hit), minWidth: Math.max(44, hit), paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: on ? palette.accent : palette.line, backgroundColor: on ? palette.accent : palette.card, justifyContent: "center" }}><Text style={{ color: on ? palette.accentInk : palette.ink, fontWeight: "600", fontSize: 12 }}>{on && radio ? "✓ " : ""}{label}</Text></Pressable>;
}
