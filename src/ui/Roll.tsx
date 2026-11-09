import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { beatTicks, framePhrase, musicalPosition, noteBox, panWindow, pitchLabel, pitchToY, rulerMarks, timeToX, xToTime, zoomWindow, type KnownGrid, type TimeWindow } from "./roll-time";
import type { TransportSnapshot } from "../audio/web/transport";
import { type RollNote } from "./roll-notes";
import { DEFAULT_SNAP, snapStep, snapTime, snapMoveStart, snapIndexAt, snapPointAt, type SnapDivision } from "./snap";
import { visibleSnapGrid } from "./roll-snap-grid";
import { boundedSnap, chordSelection, doubleTapDeletes, isBlackKey, keyShape, moveSelection, nearestBoundary, nextDrawId, notesInMarquee, rangeFromDrag, resizeSelection, scaleSelectionVelocity, snapRangeStart, RollTapTracker, RollTransaction, type RollTap, type SelectionBox } from "./roll-interaction";
import type { Palette } from "./theme";

export type RollTool = "select" | "draw" | "erase" | "velocity" | "pan";
const WebView = View as React.ComponentType<React.ComponentProps<typeof View> & { dataSet?: Record<string, string> }>;
export const ROLL_RULER_HEIGHT = 48;
const RULER = ROLL_RULER_HEIGHT;
const RANGE_STRIP = 48;
const VELOCITY_HEIGHT = 90;
const VELOCITY_HEADER = 24;
export type RollViewAction = { id: number; kind: "zoom-in" | "zoom-out" | "refocus" | "fit-pitches" | "earlier" | "later" | "higher" | "lower" | "taller" | "shorter" };
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
  snapDivision?: SnapDivision; snapMode?: "grid" | "offset";
  showChrome?: boolean; gridHeight?: number; showVelocityLane?: boolean; viewAction?: RollViewAction;
  selectedIds?: readonly string[]; onSelectMany?: (ids: string[]) => void;
  backgroundLayers?: readonly { id: string; label: string; notes: readonly RollNote[] }[];
};
type Drag = {
  kind: "bound" | "range" | "pan" | "draw" | "erase" | "velocity" | "move" | "resize" | "marquee";
  pointer: number; x: number; y: number; clientY: number; view: TimeWindow;
  row: number; top: number; width: number; bounds: Range | null; originalView?: TimeWindow; grabOffset?: bigint; edgeSince?: number; edgeDirection?: number;
  note?: RollNote; edge?: "start" | "end"; erased: Set<string>; selection: string[]; groupIds?: string[]; additive?: boolean; moved?: boolean; velocityScale?: number; deleteOnTap?: boolean;
};
type Pinch = { distance: number; x: number; y: number; view: TimeWindow; top: number; row: number; width: number };

export function Roll({ notes, timeWindow, bounds, ceiling, historyStart, grid, palette, mode, tool, selectedId, ghosts, hitPx, onWindow, onBoundsCommit, onSelect, onCommitNotes, onEdit, onClose, onTool, showPan = true, readTransport, onAudition, onStopAudition, readSoundingPitches, snapDivision = DEFAULT_SNAP, snapMode = "grid", showChrome = true, gridHeight, showVelocityLane = mode === "room", viewAction, selectedIds, onSelectMany, backgroundLayers = [] }: RollProps) {
  const viewport = useWindowDimensions();
  const host = useRef<HTMLElement | null>(null);
  const keyboard = useRef<HTMLElement | null>(null);
  const velocityHost = useRef<HTMLElement | null>(null);
  const startHandle = useRef<HTMLElement | null>(null);
  const endHandle = useRef<HTMLElement | null>(null);
  const [plotWidth, setPlotWidth] = useState(640);
  const [topPitch, setTopPitch] = useState(() => topOf(notes));
  const [compactTop, setCompactTop] = useState<number | null>(null);
  const [roomRow, setRoomRow] = useState(24);
  const [compactRow, setCompactRow] = useState<number | null>(null);
  const [viewTools, setViewTools] = useState(false);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [sounding, setSounding] = useState<readonly number[]>([]);
  const [preview, setPreview] = useState<RollNote[] | null>(null);
  const [previewBounds, setPreviewBounds] = useState<Range | null>(null);
  const [gestureText, setGestureText] = useState("");
  const [marquee, setMarquee] = useState<SelectionBox | null>(null);
  const [snapTarget, setSnapTarget] = useState<bigint | null>(null);
  const [focusedBoundary, setFocusedBoundary] = useState<"start" | "end" | null>(null);
  const drag = useRef<Drag | null>(null);
  const transaction = useRef<RollTransaction | null>(null);
  const liveBounds = useRef<Range | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<Pinch | null>(null);
  const auditions = useRef(new Map<number, number>());
  const taps = useRef(new RollTapTracker());
  const pendingTap = useRef<{ pointer: number; tap: RollTap; double: boolean; moved: boolean } | null>(null);
  const edgeFrame = useRef<number | null>(null);
  const shownNotes = preview ?? notes;
  const shownBounds = previewBounds ?? bounds;
  const view = timeWindow ?? (bounds ? framePhrase(historyStart, bounds.start, bounds.end) : frameOf(notes, historyStart));
  const noteHeight = Math.max(mode === "compact" ? 56 : 48, (gridHeight ?? (mode === "room" ? Math.max(240, Math.min(432, viewport.height - (viewport.width < 720 ? 520 : 360))) : 112)) - (bounds ? RANGE_STRIP : 0));
  const rowHeight = mode === "room" ? roomRow : compactRow ?? fitRow(notes, noteHeight);
  const pitchTop = mode === "compact" ? compactTop ?? topOf(notes) : topPitch;
  const labelWidth = mode === "compact" ? 20 : plotWidth < 500 ? 34 : 44;
  const pitches = visiblePitches(pitchTop, noteHeight, rowHeight);
  const canAudition = mode === "room" && rowHeight >= 24 && !!onAudition;
  const selected = shownNotes.find(note => note.id === selectedId);
  const selectionIds = (selectedIds ?? (selectedId ? [selectedId] : [])).filter(id => notes.some(note => note.id === id));
  const selectionSet = new Set(selectionIds);
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
    if (edgeFrame.current !== null) cancelAnimationFrame(edgeFrame.current);
    edgeFrame.current = null;
    transaction.current?.cancel(); transaction.current = null;
    liveBounds.current = null; drag.current = null;
    setPreview(null); setPreviewBounds(null); setGestureText(""); setMarquee(null); setSnapTarget(null);
  }
  function selectMany(ids: string[]) { if (onSelectMany) onSelectMany(ids); else onSelect(ids[ids.length - 1] ?? null); }
  function cancelEdit() {
    taps.current.clear(); pendingTap.current = null;
    const previous = drag.current;
    if (previous?.kind === "bound" && previous.originalView && previous.view !== previous.originalView) onWindow(previous.originalView);
    clearPreview();
    if (previous) selectMany(previous.selection);
  }
  function stopAuditions() {
    if (auditions.current.size) {
      for (const pitch of auditions.current.values()) onAudition?.(pitch, false);
      auditions.current.clear();
    }
    onStopAudition?.();
  }
  function cancelAll() { cancelEdit(); pointers.current.clear(); pinch.current = null; stopAuditions(); }
  const handlers = useRef({ begin: (_event: PointerEvent, _source?: "grid" | "velocity" | "bound-start" | "bound-end") => {}, move: (_event: PointerEvent) => {}, end: (_event: PointerEvent) => {}, audition: (_event: PointerEvent) => {}, cancel: () => {}, key: (_event: KeyboardEvent) => {}, wheel: (_event: WheelEvent, _axis: "time" | "pitch") => {} });

  function capturePointer(event: PointerEvent, element: HTMLElement | null) {
    try { element?.setPointerCapture(event.pointerId); } catch { /* Window listeners still release the gesture. */ }
  }
  function begin(event: PointerEvent, source: "grid" | "velocity" | "bound-start" | "bound-end" = "grid") {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    event.preventDefault();
    if (pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    capturePointer(event, source === "velocity" ? velocityHost.current : source === "bound-start" ? startHandle.current : source === "bound-end" ? endHandle.current : host.current);
    if (pointers.current.size >= 2) {
      const restoredView = drag.current?.kind === "bound" ? drag.current.originalView ?? view : view;
      cancelEdit();
      stopAuditions();
      const [a, b] = [...pointers.current.values()];
      const middle = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x: middle.x, y: middle.y, view: restoredView, top: pitchTop, row: rowHeight, width: plotWidth };
      return;
    }
    const { x, y } = local(event.clientX, event.clientY);
    const base: Omit<Drag, "kind"> = { pointer: event.pointerId, x, y, clientY: event.clientY, view, row: rowHeight, top: pitchTop, width: plotWidth, bounds, erased: new Set(), selection: [...selectionIds] };
    if ((source === "bound-start" || source === "bound-end") && bounds) {
      taps.current.clear(); pendingTap.current = null;
      const edge = nearestBoundary(x, timeToX(bounds.start, view, plotWidth), timeToX(bounds.end, view, plotWidth), Infinity)!;
      drag.current = { ...base, kind: "bound", edge, originalView: view, grabOffset: bounds[edge] - xToTime(x, view, plotWidth) };
      setFocusedBoundary(edge);
      setGestureText(`${edge === "start" ? "Start" : "End"} ${grid ? musicalPosition(bounds[edge], grid) : `${seconds(bounds[edge])}s`}`);
      return;
    }
    if (source === "velocity") {
      taps.current.clear(); pendingTap.current = null;
      if (ghosts.length || mode !== "room") return;
      const candidates = notes.filter(note => Math.abs(x - timeToX(note.start, view, plotWidth)) <= 10);
      const hit = candidates.find(note => note.id === selectedId) ?? candidates.sort((a, b) => Math.abs(x - timeToX(a.start, view, plotWidth)) - Math.abs(x - timeToX(b.start, view, plotWidth)))[0];
      if (!hit) return;
      const groupIds = selectionSet.has(hit.id) ? [...selectionIds.filter(id => id !== hit.id), hit.id] : [hit.id];
      selectMany(groupIds);
      transaction.current = new RollTransaction(notes);
      drag.current = { ...base, kind: "velocity", note: hit, groupIds, velocityScale: 127 / (VELOCITY_HEIGHT - VELOCITY_HEADER - 8) };
      return;
    }
    if (mode === "compact" || (y >= -RULER && y < 0)) {
      taps.current.clear(); pendingTap.current = null;
      if (!drag.current && mode === "room") drag.current = { ...base, kind: "range" };
      if (!drag.current && mode === "compact" && y >= -RULER && y < noteHeight) drag.current = { ...base, kind: "pan" };
      return;
    }
    if (y < 0 || y >= noteHeight || ghosts.length > 0) return;
    const hit = noteAt(notes, x, y, view, plotWidth, pitchTop, rowHeight);
    const tap: RollTap = { time: event.timeStamp, x, y, pitch: clampPitch(pitchTop - Math.floor(y / rowHeight)), targetId: hit?.id ?? null, pointerType: event.pointerType || "mouse" };
    const isDouble = taps.current.consume(tap);
    pendingTap.current = { pointer: event.pointerId, tap, double: isDouble, moved: false };
    transaction.current = new RollTransaction(notes);
    if (tool === "erase") {
      const current: Drag = { ...base, kind: "erase" };
      drag.current = current;
      if (hit) { current.erased.add(hit.id); previewNotes(notes.filter(note => !current.erased.has(note.id))); }
      return;
    }
    if (!hit && (tool === "draw" || (tool === "select" && isDouble))) {
      const rawStart = xToTime(x, view, plotWidth);
      const start = !event.altKey ? boundedSnap(rawStart, 0n, null, grid, snapDivision) ?? rawStart : rawStart;
      const step = !event.altKey ? snapStep(grid, snapDivision) : null;
      const index = step !== null ? snapIndexAt(start, grid, snapDivision) : null;
      const nextPoint = index !== null ? snapPointAt(index + 1n, grid, snapDivision) : null;
      const length = nextPoint !== null && nextPoint > start ? nextPoint - start : step ?? 150_000n;
      const note: RollNote = { id: nextDrawId(notes), channel: 0, pitch: clampPitch(pitchTop - Math.floor(y / rowHeight)), start, end: start + length, velocity: 96, sourceOnId: null, sourceOffId: null };
      drag.current = { ...base, kind: "draw", note };
      previewNotes([...notes, note]);
      setGestureText(describe(note, grid));
      setSnapTarget(step !== null ? start : null);
      return;
    }
    if (!hit) {
      if (!event.shiftKey) selectMany([]);
      transaction.current = null;
      if (tool === "select") drag.current = { ...base, kind: "marquee", additive: event.shiftKey };
      return;
    }
    let groupIds = selectionSet.has(hit.id) ? [...selectionIds.filter(id => id !== hit.id), hit.id] : [hit.id];
    if (event.shiftKey) groupIds = selectionSet.has(hit.id) ? selectionIds.filter(id => id !== hit.id) : [...selectionIds, hit.id];
    if (isDouble && tap.pointerType === "touch") groupIds = chordSelection(notes, hit.id, snapStep(grid, { kind: "note", numerator: 1, denominator: 32 }) ?? 62_500n);
    selectMany(groupIds);
    if (!groupIds.includes(hit.id)) { transaction.current = null; return; }
    if (tool === "velocity") { drag.current = { ...base, kind: "velocity", note: hit, groupIds }; return; }
    const box = noteBox(hit.start, hit.end, hit.pitch, view, plotWidth, pitchTop, rowHeight);
    const atEnd = x >= box.x + Math.max(8, box.width) - Math.min(12, Math.max(8, box.width) / 3);
    drag.current = { ...base, kind: atEnd ? "resize" : "move", note: hit, groupIds, deleteOnTap: isDouble && !event.shiftKey && doubleTapDeletes(tap.pointerType) };
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
      const nextTop = clampPitch(p.top + Math.round((middle.y - p.y) / p.row));
      if (mode === "room") setTopPitch(nextTop); else setCompactTop(nextTop);
      return;
    }
    const { x, y } = local(event.clientX, event.clientY);
    const tap = pendingTap.current;
    if (tap?.pointer === event.pointerId && (Math.abs(x - tap.tap.x) >= 3 || Math.abs(y - tap.tap.y) >= 3)) tap.moved = true;
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (current.kind === "pan") {
      if (!current.moved && Math.abs(x - current.x) < 3) return;
      current.moved = true;
      const delta = BigInt(Math.round((current.x - x) / current.width * Number(current.view.end - current.view.start)));
      onWindow(panWindow(current.view, delta, historyStart));
      return;
    }
    if (current.kind === "marquee") {
      if (!current.moved && Math.abs(x - current.x) < 3 && Math.abs(y - current.y) < 3) return;
      current.moved = true;
      const box = { x: Math.min(current.x, x), y: Math.min(current.y, y), width: Math.abs(x - current.x), height: Math.abs(y - current.y) };
      setMarquee(box);
      const found = notesInMarquee(notes, box, current.view, current.width, current.top, current.row);
      selectMany(current.additive ? [...new Set([...current.selection, ...found])] : found);
      return;
    }
    if (current.kind === "range") {
      if (!current.moved && Math.abs(x - current.x) < 3) return;
      current.moved = true;
      const next = rangeFromDrag(xToTime(current.x, current.view, current.width), xToTime(x, current.view, current.width), historyStart, current.view.end, grid, snapDivision, event.altKey);
      liveBounds.current = next; setPreviewBounds(next);
      setSnapTarget(next && !event.altKey && snapStep(grid, snapDivision) !== null ? (x >= current.x ? next.end : next.start) : null);
      setGestureText(next ? `Start ${grid ? musicalPosition(next.start, grid) : `${seconds(next.start)}s`} · End ${grid ? musicalPosition(next.end, grid) : `${seconds(next.end)}s`}` : "");
      return;
    }
    if (current.kind === "bound" && current.bounds) {
      if (Math.abs(x - current.x) < 3 && !liveBounds.current) return;
      if (edgeFrame.current !== null) cancelAnimationFrame(edgeFrame.current);
      edgeFrame.current = null;
      const direction = x <= 12 ? -1 : x >= current.width - 12 ? 1 : 0;
      if (direction !== current.edgeDirection) { current.edgeDirection = direction; current.edgeSince = performance.now(); }
      if (direction && (direction > 0 || current.view.start > historyStart)) {
        if (performance.now() - (current.edgeSince ?? 0) >= 300) {
          const shift = BigInt(Math.max(1, Math.round(Number(current.view.end - current.view.start) * .008))) * BigInt(direction);
          current.view = panWindow(current.view, shift, historyStart);
          onWindow(current.view);
        }
        edgeFrame.current = requestAnimationFrame(() => { edgeFrame.current = null; handlers.current.move(event); });
      }
      const atTapeStart = current.edge === "start" && x <= 12 && current.view.start <= historyStart;
      const rawTime = atTapeStart ? historyStart : xToTime(x, current.view, current.width) + (current.grabOffset ?? 0n);
      const start = current.bounds.start;
      const end = current.bounds.end;
      const minimum = current.edge === "start" ? historyStart : start + 1n;
      const maximum = current.edge === "start" ? end - 1n : current.view.end;
      const snapBoundary = current.edge === "start" ? snapRangeStart : boundedSnap;
      const time = event.altKey ? maxBig(minimum, minBig(rawTime, maximum)) : snapBoundary(rawTime, minimum, maximum, grid, snapDivision);
      if (time === null) return;
      const next = current.edge === "start"
        ? { start: maxBig(historyStart, minBig(time, end - 1n)), end }
        : { start, end: minBig(current.view.end, maxBig(time, start + 1n)) };
      if (next.end <= next.start) return;
      liveBounds.current = next; setPreviewBounds(next);
      setSnapTarget(!event.altKey && snapStep(grid, snapDivision) !== null ? time : null);
      const marker = current.edge === "start" ? next.start : next.end;
      setGestureText(`${current.edge === "start" ? "Start" : "End"} ${grid ? musicalPosition(marker, grid) : `${seconds(marker)}s`}`);
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
    current.deleteOnTap = false;
    const rawTime = xToTime(x, current.view, current.width);
    const snapping = !event.altKey && snapStep(grid, snapDivision) !== null;
    const time = !event.altKey ? boundedSnap(rawTime, 0n, null, grid, snapDivision) ?? rawTime : rawTime;
    if (current.kind === "draw") {
      const drawn = time < note.start
        ? { ...note, start: time, end: note.start }
        : { ...note, end: time > note.start ? time : note.end };
      previewNotes([...baseline, drawn]); setGestureText(describe(drawn, grid)); setSnapTarget(snapping ? time : null); return;
    }
    if (current.kind === "resize") {
      const delta = rawTime - xToTime(current.x, current.view, current.width);
      const rawEnd = note.end + delta;
      const group = baseline.filter(n => (current.groupIds ?? [note.id]).includes(n.id));
      const shortest = group.reduce((min, n) => minBig(min, n.end - n.start), note.end - note.start);
      const minimumEnd = note.end + 1n - shortest;
      const end = !event.altKey ? boundedSnap(rawEnd, minimumEnd, null, grid, snapDivision) ?? rawEnd : rawEnd;
      const next = resizeSelection(baseline, current.groupIds ?? [note.id], note.id, end);
      const resized = next.find(n => n.id === note.id)!;
      previewNotes(next); setGestureText(describe(resized, grid)); setSnapTarget(snapping ? resized.end : null); return;
    }
    if (current.kind === "velocity") {
      const velocity = Math.max(1, Math.min(127, Math.round(note.velocity + (current.clientY - event.clientY) * (current.velocityScale ?? 1))));
      previewNotes(scaleSelectionVelocity(baseline, current.groupIds ?? [note.id], note.id, velocity));
      setGestureText(`${pitchLabel(note.pitch)} · velocity ${velocity}`); return;
    }
    const deltaTime = rawTime - xToTime(current.x, current.view, current.width);
    let start = maxBig(0n, event.altKey ? note.start + deltaTime : snapMoveStart(note.start, deltaTime, grid, snapDivision, snapMode));
    if (snapping && snapMode === "grid") {
      const earliest = baseline.filter(n => (current.groupIds ?? [note.id]).includes(n.id)).reduce((min, n) => minBig(min, n.start), note.start);
      start = boundedSnap(start, note.start - earliest, null, grid, snapDivision) ?? start;
    }
    const next = moveSelection(baseline, current.groupIds ?? [note.id], note.id, start, note.pitch - Math.round((y - current.y) / current.row));
    const moved = next.find(n => n.id === note.id)!;
    previewNotes(next); setGestureText(describe(moved, grid)); setSnapTarget(snapping && snapMode === "grid" ? moved.start : null);
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
    const tap = pendingTap.current;
    pendingTap.current = null;
    const released = local(event.clientX, event.clientY);
    const endedAtOrigin = tap && Math.abs(released.x - tap.tap.x) < 3 && Math.abs(released.y - tap.tap.y) < 3;
    if (tap?.pointer === event.pointerId && endedAtOrigin && !tap.double && !tap.moved && event.timeStamp - tap.tap.time <= 350 && (!current || !current.moved) && (tool === "select" || tool === "draw")) {
      taps.current.record({ ...tap.tap, time: event.timeStamp });
    } else {
      taps.current.clear();
    }
    if (!current || current.pointer !== event.pointerId) return;
    if (current.deleteOnTap && !endedAtOrigin) current.deleteOnTap = false;
    if (current.deleteOnTap && !current.moved && current.note) transaction.current?.preview(transaction.current.baseline.filter(note => note.id !== current.note!.id));
    const range = liveBounds.current;
    const next = transaction.current?.commit() ?? null;
    clearPreview();
    if ((current.kind === "bound" || current.kind === "range") && range && (!current.bounds || range.start !== current.bounds.start || range.end !== current.bounds.end)) onBoundsCommit(range);
    if (next) {
      onCommitNotes(next);
      if (current.kind === "draw") selectMany([current.note!.id]);
      if (current.kind === "erase") selectMany(selectionIds.filter(id => !current.erased.has(id)));
      if (current.deleteOnTap) selectMany(selectionIds.filter(id => id !== current.note?.id));
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
    const boundaryHandle = target?.closest("[data-boundary-handle]")?.getAttribute("data-boundary-handle");
    if (bounds && boundaryHandle && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault(); cancelAll();
      const edge = boundaryHandle === "start" ? "start" : "end";
      const position = bounds[edge];
      const direction = event.key === "ArrowRight" ? 1n : -1n;
      const index = !event.altKey ? snapIndexAt(position, grid, snapDivision) : null;
      const floor = index !== null ? snapPointAt(index, grid, snapDivision)! : null;
      const desired = index !== null ? snapPointAt(index + (direction > 0n ? 1n : floor! < position ? 0n : -1n), grid, snapDivision)! : position + direction * 50_000n;
      const minimum = edge === "start" ? historyStart : bounds.start + 1n;
      const maximum = edge === "start" ? bounds.end - 1n : view.end;
      const snapBoundary = edge === "start" ? snapRangeStart : boundedSnap;
      const next = event.altKey ? maxBig(minimum, minBig(desired, maximum)) : snapBoundary(desired, minimum, maximum, grid, snapDivision);
      if (next !== null && next !== position) onBoundsCommit({ ...bounds, [edge]: next });
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") cancelAll();
    if (event.ctrlKey || event.metaKey || event.altKey || mode !== "room") return;
    if (event.key === "Delete" || event.key === "Backspace") {
      if (!selectionIds.length || ghosts.length || event.repeat) return;
      event.preventDefault();
      cancelAll();
      const nextNotes = notes.filter(note => !selectionSet.has(note.id));
      if (nextNotes.length !== notes.length) { onCommitNotes(nextNotes); selectMany([]); }
      return;
    }
    if (event.key.toLowerCase() === "b" && !event.repeat) {
      event.preventDefault(); cancelAll(); onTool?.(tool === "draw" ? "select" : "draw"); return;
    }
    const next = ({ d: "draw", s: "select", e: "erase" } as const)[event.key.toLowerCase() as "d" | "s" | "e"];
    if (next) { event.preventDefault(); cancelAll(); onTool?.(next); }
  }
  function wheel(event: WheelEvent, axis: "time" | "pitch") {
    const point = local(event.clientX, event.clientY);
    if (axis === "time" && (point.y >= 0 || point.y < -RULER)) return;
    event.preventDefault(); cancelAll();
    const delta = Math.max(-300, Math.min(300, event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 200 : 1)));
    if (axis === "time") onWindow(zoomWindow(view, Math.exp(delta / 400), xToTime(point.x, view, plotWidth), 50_000n, 120_000_000n));
    else {
      const next = Math.max(2, Math.min(48, rowHeight * Math.exp(-delta / 400)));
      if (mode === "room") setRoomRow(next); else setCompactRow(next);
    }
  }
  handlers.current = { begin, move, end, audition, cancel: cancelAll, key, wheel };
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const element = host.current; const keys = keyboard.current; const lane = velocityHost.current; const startTab = startHandle.current; const endTab = endHandle.current;
    const down = (event: PointerEvent) => handlers.current.begin(event);
    const keyDown = (event: PointerEvent) => handlers.current.audition(event);
    const velocityDown = (event: PointerEvent) => handlers.current.begin(event, "velocity");
    const startDown = (event: PointerEvent) => handlers.current.begin(event, "bound-start");
    const endDown = (event: PointerEvent) => handlers.current.begin(event, "bound-end");
    const timeWheel = (event: WheelEvent) => handlers.current.wheel(event, "time");
    const pitchWheel = (event: WheelEvent) => handlers.current.wheel(event, "pitch");
    const moveEvent = (event: PointerEvent) => handlers.current.move(event);
    const up = (event: PointerEvent) => handlers.current.end(event);
    const cancel = () => handlers.current.cancel();
    const lost = (event: PointerEvent) => { if (pointers.current.has(event.pointerId) || auditions.current.has(event.pointerId)) cancel(); };
    const keyEvent = (event: KeyboardEvent) => handlers.current.key(event);
    const outsideDown = (event: PointerEvent) => {
      if (pointers.current.size && !element?.contains(event.target as Node) && !lane?.contains(event.target as Node) && !startTab?.contains(event.target as Node) && !endTab?.contains(event.target as Node)) cancel();
    };
    const visibility = () => { if (document.hidden) cancel(); };
    element?.addEventListener("pointerdown", down); keys?.addEventListener("pointerdown", keyDown);
    lane?.addEventListener("pointerdown", velocityDown); lane?.addEventListener("lostpointercapture", lost);
    startTab?.addEventListener("pointerdown", startDown); endTab?.addEventListener("pointerdown", endDown);
    startTab?.addEventListener("lostpointercapture", lost); endTab?.addEventListener("lostpointercapture", lost);
    element?.addEventListener("wheel", timeWheel, { passive: false }); keys?.addEventListener("wheel", pitchWheel, { passive: false });
    element?.addEventListener("lostpointercapture", lost); keys?.addEventListener("lostpointercapture", lost);
    window.addEventListener("pointermove", moveEvent, { passive: false }); window.addEventListener("pointerup", up);
    window.addEventListener("pointerdown", outsideDown, true);
    window.addEventListener("pointercancel", cancel); window.addEventListener("blur", cancel); window.addEventListener("keydown", keyEvent);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancel(); element?.removeEventListener("pointerdown", down); keys?.removeEventListener("pointerdown", keyDown);
      lane?.removeEventListener("pointerdown", velocityDown); lane?.removeEventListener("lostpointercapture", lost);
      startTab?.removeEventListener("pointerdown", startDown); endTab?.removeEventListener("pointerdown", endDown);
      startTab?.removeEventListener("lostpointercapture", lost); endTab?.removeEventListener("lostpointercapture", lost);
      element?.removeEventListener("wheel", timeWheel); keys?.removeEventListener("wheel", pitchWheel);
      element?.removeEventListener("lostpointercapture", lost); keys?.removeEventListener("lostpointercapture", lost);
      window.removeEventListener("pointermove", moveEvent); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("pointerdown", outsideDown, true);
      window.removeEventListener("blur", cancel); window.removeEventListener("keydown", keyEvent); document.removeEventListener("visibilitychange", visibility);
    };
  }, [showVelocityLane, mode, !!bounds]);
  useEffect(() => { handlers.current.cancel(); }, [mode, tool]);
  const snapIdentity = JSON.stringify(snapDivision);
  useEffect(() => { if (drag.current) handlers.current.cancel(); }, [snapIdentity, snapMode, grid?.bpm, grid?.beatsPerBar, grid?.phase]);
  useEffect(() => { setTopPitch(topOf(notes)); setCompactTop(null); setCompactRow(null); if (mode === "room") setRoomRow(fitRoomRow(notes, noteHeight)); }, [mode, viewport.width, viewport.height, noteHeight]);
  useEffect(() => { if (drag.current) handlers.current.cancel(); }, [notes]);
  useEffect(() => { if (!canAudition) stopAuditions(); }, [canAudition]);

  function refocus() { cancelAll(); setTopPitch(topOf(notes)); setCompactTop(null); setCompactRow(null); if (mode === "room") setRoomRow(fitRoomRow(notes, noteHeight)); onWindow(bounds ? framePhrase(historyStart, bounds.start, bounds.end) : frameOf(notes, historyStart)); }
  function zoom(factor: number) { cancelAll(); onWindow(zoomWindow(view, factor, view.start + (view.end - view.start) / 2n, 50_000n, 120_000_000n)); }
  function editSelected(change: (note: RollNote) => RollNote) {
    if (!selected || ghosts.length > 0) return;
    cancelAll();
    const tx = new RollTransaction(notes); tx.preview(notes.map(note => note.id === selected.id ? change(note) : note));
    const next = tx.commit(); if (next) onCommitNotes(next);
  }
  const lastViewAction = useRef<number | null>(null);
  useEffect(() => {
    if (!viewAction || lastViewAction.current === viewAction.id) return;
    lastViewAction.current = viewAction.id;
    cancelAll();
    switch (viewAction.kind) {
      case "zoom-in": zoom(0.5); break;
      case "zoom-out": zoom(2); break;
      case "refocus": refocus(); break;
      case "fit-pitches": setTopPitch(topOf(notes)); setCompactTop(null); setCompactRow(null); if (mode === "room") setRoomRow(fitRoomRow(notes, noteHeight)); break;
      case "earlier": onWindow(panWindow(view, -(view.end - view.start) / 2n, historyStart)); break;
      case "later": onWindow(panWindow(view, (view.end - view.start) / 2n, historyStart)); break;
      case "higher": if (mode === "compact") setCompactTop(Math.min(127, pitchTop + 12)); else setTopPitch(pitch => Math.min(127, pitch + 12)); break;
      case "lower": if (mode === "compact") setCompactTop(Math.max(12, pitchTop - 12)); else setTopPitch(pitch => Math.max(12, pitch - 12)); break;
      case "taller": if (mode === "room") setRoomRow(row => Math.min(48, row + 8)); else setCompactRow(row => Math.min(48, (row ?? fitRow(notes, noteHeight)) + 8)); break;
      case "shorter": if (mode === "room") setRoomRow(row => Math.max(2, row - 8)); else setCompactRow(row => Math.max(2, (row ?? fitRow(notes, noteHeight)) - 8)); break;
    }
  }, [viewAction?.id]);
  const beat = grid ? beatTicks(grid.bpm) : 0n;
  const beatWidth = view.end > view.start ? Number(beat) / Number(view.end - view.start) * plotWidth : 0;
  const marks = rulerMarks(view, grid).map(mark => {
    if (mark.kind === "bar") return { ...mark, time: snapTime(mark.time, grid, { kind: "bar", bars: 1 }), label: mark.label ? `Bar ${mark.label}` : "" };
    if (mark.kind === "beat") return { ...mark, time: snapTime(mark.time, grid, { kind: "note", numerator: 1, denominator: 4 }), label: "" };
    return mark;
  });
  const snapLines = visibleSnapGrid(view, grid, snapDivision, plotWidth);
  const prefixWidth = grid && view.start < grid.phase ? Math.min(plotWidth, timeToX(grid.phase, view, plotWidth)) : 0;
  const dark = palette.bg === "#0A0C0F";
  const playedX = playhead === null ? null : timeToX(BigInt(Math.round(playhead * 1_000_000)), view, plotWidth);
  const averageVelocity = shownNotes.length ? Math.round(shownNotes.reduce((sum, note) => sum + note.velocity, 0) / shownNotes.length) : 0;
  const selectedNotes = shownNotes.filter(note => selectionSet.has(note.id));
  const selectedVelocity = selectedNotes.length ? Math.round(selectedNotes.reduce((sum, note) => sum + note.velocity, 0) / selectedNotes.length) : 0;
  const backgroundCues = backgroundLayers.map(layer => {
    const visibleTime = layer.notes.filter(note => note.end >= view.start && note.start <= view.end);
    return { id: layer.id, label: layer.label, above: visibleTime.filter(note => pitchToY(note.pitch, pitchTop, rowHeight) + rowHeight <= 0).length, below: visibleTime.filter(note => pitchToY(note.pitch, pitchTop, rowHeight) >= noteHeight).length };
  });
  return (
    <WebView accessibilityLabel={mode === "room" ? "Piano roll" : "Take ribbon"} style={{ marginTop: showChrome ? 8 : 0 }}>
      {showChrome ? <>
      <WebView style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Text style={{ color: palette.muted, fontSize: 12, width: mode === "room" ? "100%" : undefined }}>{grid ? `${grid.bpm} BPM · ${grid.beatsPerBar}/4${grid.provisional ? " · proposed" : ""}` : "Seconds"}</Text>
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
      </> : null}
      <WebView style={{ flexDirection: "row" }}>
        <WebView ref={node => { keyboard.current = node as unknown as HTMLElement; }} dataSet={{ keyboard: mode, rowHeight: String(rowHeight), audition: canAudition ? "enabled" : "display-only" }} accessibilityLabel={canAudition ? "Piano keys, hold to audition" : "Piano keys, display only"} style={{ width: labelWidth, height: noteHeight, marginTop: RULER + 1, position: "relative", overflow: "hidden", touchAction: "none", backgroundColor: "#E7E1D6" } as never}>
          {[...pitches].sort((a, b) => Number(isBlackKey(a)) - Number(isBlackKey(b))).map(pitch => {
            const shape = keyShape(pitch, pitchTop, rowHeight);
            return <WebView key={pitch} pointerEvents="none" dataSet={{ pianoKey: String(pitch) }} style={{ position: "absolute", top: shape.top, height: shape.height, left: 0, width: shape.black ? "63%" : "100%", backgroundColor: shape.black ? "#252931" : "#E7E1D6", borderBottomWidth: 1, borderBottomColor: shape.black ? "#0A0C0F" : "#8C8C8C", borderRightWidth: 1, borderRightColor: "#737373", borderBottomRightRadius: shape.black ? 2 : 0 }} />;
          })}
          {pitches.map(pitch => <WebView key={`target-${pitch}`} pointerEvents="none" dataSet={{ pitchRow: String(pitch) }} style={{ position: "absolute", top: pitchToY(pitch, pitchTop, rowHeight), height: rowHeight, left: 0, right: 0, justifyContent: "center", alignItems: "flex-end", borderRightWidth: sounding.includes(pitch) ? 4 : 0, borderRightColor: palette.accent }}>
            {pitch % 12 === 0 ? <Text style={{ fontSize: mode === "compact" ? 7 : 9, fontFamily: "Geist Mono", color: "#17150F", marginRight: 2, fontWeight: pitch === 60 ? "900" : "600" }}>{pitchLabel(pitch)}{pitch === 60 ? "·" : ""}</Text> : null}
            {sounding.includes(pitch) ? <Text style={{ position: "absolute", left: 1, color: isBlackKey(pitch) ? "#FFFFFF" : "#17150F", fontSize: Math.min(12, rowHeight - 2) }}>●</Text> : null}
          </WebView>)}
        </WebView>
        <WebView ref={node => { host.current = node as unknown as HTMLElement; }} dataSet={{ roll: "true", rulerHeight: String(RULER), gridHeight: String(noteHeight), gridBpm: String(grid?.bpm ?? ""), activeRange: drag.current?.kind === "bound" ? drag.current.edge ?? "" : "", viewStart: view.start.toString(), viewEnd: view.end.toString() }} onLayout={event => { const next = host.current?.clientWidth || event.nativeEvent.layout.width; if (next > 0 && Math.abs(next - plotWidth) > 1) setPlotWidth(next); }} style={{ position: "relative", flex: 1, height: RULER + noteHeight + (bounds ? RANGE_STRIP : 0) + 2, backgroundColor: palette.plot, borderRadius: showChrome ? 8 : 0, borderWidth: 1, borderColor: palette.line, overflow: "hidden", touchAction: "none", userSelect: "none" } as never}>
          {pitches.map(pitch => <WebView key={`row-${pitch}`} pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: RULER + pitchToY(pitch, pitchTop, rowHeight), height: rowHeight, backgroundColor: isBlackKey(pitch) ? (dark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.03)") : "transparent", borderBottomWidth: 1, borderBottomColor: dark ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.04)" }} />)}
          {snapLines.map(time => <WebView key={`snap-${time}`} pointerEvents="none" dataSet={{ snapGrid: time.toString() }} style={{ position: "absolute", left: timeToX(time, view, plotWidth), top: RULER, bottom: 0, width: 1, backgroundColor: palette.muted, opacity: 0.30 }} />)}
          {marks.map(mark => <React.Fragment key={mark.kind + mark.time.toString()}>
            {mark.kind !== "beat" ? <WebView pointerEvents="none" dataSet={{ gridKind: mark.kind }} style={{ position: "absolute", left: timeToX(mark.time, view, plotWidth), top: RULER, bottom: 0, width: mark.kind === "bar" ? 2 : 1, backgroundColor: mark.kind === "bar" ? palette.ink : palette.muted, opacity: mark.tentative ? 0.4 : mark.kind === "bar" ? 0.85 : 0.55 }} /> : null}
            {mark.label ? <WebView pointerEvents="none" dataSet={{ rulerLabel: mark.label }} style={{ position: "absolute", left: timeToX(mark.time, view, plotWidth) + 3, top: 5 }}><Text style={{ color: mark.kind === "bar" ? palette.ink : palette.muted, fontSize: 10, fontFamily: "Geist Mono" }}>{mark.label}</Text></WebView> : null}
            {grid && mark.kind !== "second" && beat > 0n && beatWidth >= 24 && snapStep(grid, snapDivision) !== null && snapTime(mark.time, grid, snapDivision) === mark.time ? <WebView pointerEvents="none" dataSet={{ rulerBeat: String(((snapIndexAt(mark.time, grid, { kind: "note", numerator: 1, denominator: 4 }) ?? 0n) % BigInt(grid.beatsPerBar) + BigInt(grid.beatsPerBar)) % BigInt(grid.beatsPerBar) + 1n) }} style={{ position: "absolute", left: timeToX(mark.time, view, plotWidth) + (shownBounds?.start === mark.time ? 16 : 3), top: 26 }}><Text style={{ color: palette.muted, fontSize: 10, fontFamily: "Geist Mono" }}>{String(((snapIndexAt(mark.time, grid, { kind: "note", numerator: 1, denominator: 4 }) ?? 0n) % BigInt(grid.beatsPerBar) + BigInt(grid.beatsPerBar)) % BigInt(grid.beatsPerBar) + 1n)}</Text></WebView> : null}
          </React.Fragment>)}
          {prefixWidth >= 64 ? <WebView pointerEvents="none" dataSet={{ rulerPrefix: "true" }} style={{ position: "absolute", left: 3, top: 5, width: prefixWidth - 6 }}><Text numberOfLines={1} style={{ color: palette.muted, fontSize: 9, fontFamily: "Geist Mono" }}>Before loop</Text></WebView> : null}
          {shownBounds ? <WebView pointerEvents="none" style={{ position: "absolute", left: timeToX(shownBounds.start, view, plotWidth), width: Math.max(0, timeToX(shownBounds.end, view, plotWidth) - timeToX(shownBounds.start, view, plotWidth)), top: RULER, bottom: 0, backgroundColor: palette.ink, opacity: 0.04 }} /> : null}
          {backgroundLayers.flatMap(layer => layer.notes.map(note => {
            const box = noteBox(note.start, note.end, note.pitch, view, plotWidth, pitchTop, rowHeight);
            return <WebView key={`background-${layer.id}-${note.id}`} pointerEvents="none" dataSet={{ backgroundLayer: layer.id, backgroundNote: note.id }} accessibilityLabel={`${layer.label} background note`} style={{ position: "absolute", left: box.x, top: RULER + box.y + 2, width: Math.max(2, box.width), height: Math.max(2, box.height - 2), borderRadius: 2, borderWidth: 1, borderColor: palette.muted, backgroundColor: palette.muted, opacity: 0.25 }} />;
          }))}
          {shownNotes.map(note => {
            const target = ghosts.find(ghost => ghost.id === note.id);
            const start = target?.start ?? note.start, end = target?.end ?? note.end;
            const box = noteBox(start, end, note.pitch, view, plotWidth, pitchTop, rowHeight);
            const activeStart = shownBounds ? maxBig(start, shownBounds.start) : start;
            const activeEnd = shownBounds ? minBig(end, shownBounds.end) : end;
            const rangeState = activeEnd <= activeStart ? "outside" : activeStart === start && activeEnd === end ? "inside" : "partial";
            const chosen = selectionSet.has(note.id);
            return <WebView key={note.id} pointerEvents="none" dataSet={{ note: note.id, selected: String(chosen), rangeState, start: start.toString(), end: end.toString(), velocity: String(note.velocity), pitch: String(note.pitch) }} style={{ position: "absolute", left: box.x, top: RULER + box.y + 1, width: Math.max(8, box.width), height: box.height, borderRadius: 3, backgroundColor: rangeState === "inside" ? palette.note : palette.noteDim, borderWidth: rangeState === "outside" ? 1 : 0, borderColor: palette.muted, overflow: "visible", opacity: 1 }}>
              {rangeState === "partial" ? <WebView style={{ position: "absolute", left: timeToX(activeStart, view, plotWidth) - box.x, width: Math.max(1, timeToX(activeEnd, view, plotWidth) - timeToX(activeStart, view, plotWidth)), top: 0, bottom: 0, backgroundColor: palette.note }} /> : null}
              {chosen && mode === "room" ? <><WebView style={{ position: "absolute", left: -3, right: -3, top: -3, bottom: -3, borderWidth: 1.5, borderColor: palette.ink, borderRadius: 4 }} />{box.width >= 30 ? <Text numberOfLines={1} style={{ fontSize: 10, color: palette.plot, fontFamily: "Geist Mono", paddingLeft: 2 }}>{pitchLabel(note.pitch)}</Text> : null}<WebView style={{ position: "absolute", right: -3, top: Math.max(0, (box.height - 12) / 2), width: 6, height: Math.min(12, box.height), borderRadius: 2, borderWidth: 1, borderColor: palette.plot, backgroundColor: palette.ink }} /></> : null}
            </WebView>;
          })}
          {ghosts.map(ghost => {
            const note = shownNotes.find(n => n.id === ghost.id); if (!note) return null;
            const box = noteBox(note.start, note.end, note.pitch, view, plotWidth, pitchTop, rowHeight);
            return <WebView key={`ghost-${ghost.id}`} pointerEvents="none" dataSet={{ ghost: ghost.id }} style={{ position: "absolute", left: box.x, top: RULER + box.y + 1, width: Math.max(2, box.width), height: box.height, borderRadius: 3, borderWidth: 2, borderStyle: "dashed", borderColor: palette.accent }} />;
          })}
          {shownBounds ? <>
            <WebView pointerEvents="none" dataSet={{ rangeStrip: "true" }} style={{ position: "absolute", top: RULER + noteHeight, height: RANGE_STRIP, left: 0, right: 0, backgroundColor: palette.card, borderTopWidth: 1, borderTopColor: palette.line }} />
            <Boundary x={timeToX(shownBounds.start, view, plotWidth)} palette={palette} active={focusedBoundary === "start" || drag.current?.kind === "range" || (drag.current?.kind === "bound" && drag.current.edge === "start")} edge="start" time={shownBounds.start} />
            <Boundary x={timeToX(shownBounds.end, view, plotWidth)} palette={palette} active={focusedBoundary === "end" || drag.current?.kind === "range" || (drag.current?.kind === "bound" && drag.current.edge === "end")} edge="end" time={shownBounds.end} />
            {(["start", "end"] as const).map(edge => <Pressable key={edge} ref={node => { if (edge === "start") startHandle.current = node as unknown as HTMLElement; else endHandle.current = node as unknown as HTMLElement; }} accessibilityRole="button" accessibilityLabel={`Drag ${edge} marker; left and right arrows adjust`} dataSet={{ boundaryHandle: edge }} onFocus={() => setFocusedBoundary(edge)} onBlur={() => setFocusedBoundary(null)} style={{ display: shownBounds[edge] < view.start || shownBounds[edge] > view.end ? "none" : "flex", position: "absolute", left: Math.max(0, Math.min(plotWidth - 48, timeToX(shownBounds[edge], view, plotWidth) - 24)), top: RULER + noteHeight, width: 48, height: RANGE_STRIP, touchAction: "none", cursor: "ew-resize", backgroundColor: "transparent", outlineStyle: "none" } as never} />)}
          </> : null}
          {marquee ? <WebView pointerEvents="none" dataSet={{ marquee: "true" }} style={{ position: "absolute", left: marquee.x, top: RULER + marquee.y, width: marquee.width, height: marquee.height, borderWidth: 1, borderStyle: "dashed", borderColor: palette.ink, backgroundColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)" }} /> : null}
          {snapTarget !== null ? <WebView pointerEvents="none" dataSet={{ snapTarget: snapTarget.toString() }} style={{ position: "absolute", left: timeToX(snapTarget, view, plotWidth), top: 0, bottom: 0, width: 2, backgroundColor: palette.accent }} /> : null}
          {(["above", "below"] as const).map(direction => {
            const cues = backgroundCues.filter(cue => cue[direction] > 0);
            return cues.length ? <WebView key={direction} pointerEvents="none" dataSet={{ backgroundCue: direction }} style={{ position: "absolute", right: 6, ...(direction === "above" ? { top: RULER + 4 } : { bottom: 4 }), backgroundColor: palette.plot, borderWidth: 1, borderColor: palette.line, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 }}><Text style={{ fontFamily: "Geist Mono", fontSize: 9, color: palette.muted }}>{cues.map(cue => `${direction === "above" ? "↑" : "↓"} ${cue.label} · ${cue[direction]} note${cue[direction] === 1 ? "" : "s"} ${direction}`).join("  ·  ")}</Text></WebView> : null;
          })}
          {playedX !== null ? <WebView pointerEvents="none" dataSet={{ playhead: String(playhead) }} style={{ position: "absolute", left: playedX, top: 0, bottom: 0, width: 2, backgroundColor: palette.accent }}><WebView style={{ position: "absolute", left: -4, top: 0, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: palette.accent }} /></WebView> : null}
          {gestureText ? <WebView pointerEvents="none" style={{ position: "absolute", top: RULER + 6, left: 8, right: 8, alignItems: "center" }}><Text style={{ color: palette.ink, backgroundColor: palette.card, padding: 6, borderRadius: 6, fontSize: 12 }}>{gestureText}</Text></WebView> : null}
        </WebView>
      </WebView>
      {showVelocityLane ? <WebView style={{ marginTop: 6, flexDirection: "row", height: VELOCITY_HEIGHT }}>
        <WebView style={{ width: labelWidth }} />
        <WebView ref={node => { velocityHost.current = node as unknown as HTMLElement; }} accessibilityLabel="Velocity lane" dataSet={{ velocityLane: "true" }} style={{ position: "relative", flex: 1, backgroundColor: palette.plot, borderWidth: 1, borderColor: palette.line, overflow: "hidden", touchAction: "none", userSelect: "none" } as never}>
          <WebView pointerEvents="none" style={{ position: "absolute", left: 8, right: 8, top: 5, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: "Inter Tight", fontSize: 11, color: palette.muted }}>Velocity</Text>
            <Text style={{ fontFamily: "Geist Mono", fontSize: 10, color: palette.muted }}>{selectedNotes.length ? `${selectedNotes.length} selected · ${selectedNotes.length > 1 ? "Avg " : ""}${selectedVelocity}` : `Avg ${averageVelocity}`}</Text>
          </WebView>
          {marks.filter(mark => mark.kind !== "beat").map(mark => <WebView key={`velocity-grid-${mark.time}`} pointerEvents="none" style={{ position: "absolute", left: timeToX(mark.time, view, plotWidth), top: VELOCITY_HEADER, bottom: 0, width: 1, backgroundColor: palette.line, opacity: mark.kind === "bar" ? 0.8 : 0.4 }} />)}
          {shownNotes.map(note => {
            const target = ghosts.find(ghost => ghost.id === note.id);
            const height = Math.max(2, (VELOCITY_HEIGHT - VELOCITY_HEADER - 8) * note.velocity / 127);
            const chosen = selectionSet.has(note.id);
            return <WebView key={`velocity-${note.id}`} pointerEvents="none" dataSet={{ velocityNote: note.id, velocity: String(note.velocity) }} style={{ position: "absolute", left: timeToX(target?.start ?? note.start, view, plotWidth), bottom: 4, width: 5, height, borderRadius: 1, backgroundColor: palette.note, opacity: chosen ? 1 : 0.6 }}>
              {chosen ? <WebView style={{ position: "absolute", left: -2, right: -2, top: -2, bottom: -2, borderWidth: 1, borderColor: palette.ink }} /> : null}
            </WebView>;
          })}
          {playedX !== null ? <WebView pointerEvents="none" style={{ position: "absolute", left: playedX, top: VELOCITY_HEADER, bottom: 0, width: 2, backgroundColor: palette.accent }} /> : null}
        </WebView>
      </WebView> : null}
      {showChrome && mode === "room" ? <Text style={{ color: palette.muted, fontSize: 11, marginTop: 5 }}>{canAudition ? "Hold a piano key to audition · C4 is middle C" : "Keyboard display only · taller rows enable audition when sound is available"}</Text> : null}
      {showChrome && mode === "room" && selected ? <WebView style={{ marginTop: 8, gap: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
        <Text style={{ color: palette.ink, fontSize: 12 }}>{pitchLabel(selected.pitch)} · {seconds(selected.start)}s · velocity {selected.velocity}</Text>
        <Tool label="Velocity" onPress={() => { cancelAll(); onTool?.(tool === "velocity" ? "select" : "velocity"); }} palette={palette} hit={hitPx} on={tool === "velocity"} />
        <Tool disabled={ghosts.length > 0} label="Softer" onPress={() => editSelected(note => ({ ...note, velocity: Math.max(1, note.velocity - 8) }))} palette={palette} hit={hitPx} />
        <Tool disabled={ghosts.length > 0} label="Louder" onPress={() => editSelected(note => ({ ...note, velocity: Math.min(127, note.velocity + 8) }))} palette={palette} hit={hitPx} />
        <Tool disabled={ghosts.length > 0} label="Shorter" onPress={() => editSelected(note => ({ ...note, end: maxBig(note.start + 1n, note.end - (snapStep(grid, snapDivision) ?? 50_000n)) }))} palette={palette} hit={hitPx} />
        <Tool disabled={ghosts.length > 0} label="Longer" onPress={() => editSelected(note => ({ ...note, end: note.end + (snapStep(grid, snapDivision) ?? 50_000n) }))} palette={palette} hit={hitPx} />
      </WebView> : null}
      {showChrome && shownBounds && shownNotes.length > 0 && shownBounds.end > lastEnd(shownNotes) ? <Text style={{ color: palette.muted, marginTop: 6, fontSize: 12 }}>The loop keeps the space after the last note.</Text> : null}
    </WebView>
  );
}
function minBig(a: bigint, b: bigint) { return a < b ? a : b; }
function maxBig(a: bigint, b: bigint) { return a > b ? a : b; }
function clampPitch(pitch: number) { return Math.max(0, Math.min(127, pitch)); }
function seconds(time: bigint) { return (Number(time) / 1_000_000).toFixed(2); }
function describe(note: RollNote, grid: KnownGrid | null) { return grid ? `${pitchLabel(note.pitch)} · ${musicalPosition(note.start, grid)} → ${musicalPosition(note.end, grid)}` : `${pitchLabel(note.pitch)} · ${seconds(note.start)}s · length ${seconds(note.end - note.start)}s`; }
function lastEnd(notes: readonly RollNote[]) { return notes.reduce((max, note) => maxBig(max, note.end), 0n); }
function topOf(notes: readonly RollNote[]) { return notes.length ? Math.min(127, Math.max(...notes.map(note => note.pitch)) + 2) : 72; }
function fitRoomRow(notes: readonly RollNote[], height: number) { const span = notes.length ? Math.max(...notes.map(note => note.pitch)) - Math.min(...notes.map(note => note.pitch)) + 5 : 16; const fit = height / span; return fit >= 24 ? 24 : fit >= 16 ? 16 : Math.max(2, Math.floor(fit)); }
function fitRow(notes: readonly RollNote[], height = 112) { const span = notes.length ? Math.max(...notes.map(note => note.pitch)) - Math.min(...notes.map(note => note.pitch)) + 5 : 12; return Math.max(2, Math.min(height / 8, height / span)); }
function frameOf(notes: readonly RollNote[], floor: bigint): TimeWindow { if (!notes.length) return { start: floor, end: floor + 4_000_000n }; const start = notes.reduce((min, note) => minBig(min, note.start), notes[0].start); return framePhrase(floor, start, maxBig(start + 1n, lastEnd(notes))); }
function visiblePitches(top: number, height: number, row: number) { return Array.from({ length: Math.ceil(height / row) + 1 }, (_, i) => top - i).filter(pitch => pitch >= 0 && pitch <= 127); }
function noteAt(notes: readonly RollNote[], x: number, y: number, view: TimeWindow, width: number, top: number, row: number): RollNote | null {
  for (let i = notes.length - 1; i >= 0; i--) { const note = notes[i]; const box = noteBox(note.start, note.end, note.pitch, view, width, top, row); if (x >= box.x && x <= box.x + Math.max(8, box.width) && y >= box.y && y < box.y + row) return note; }
  return null;
}
function Boundary({ x, palette, active, edge, time }: { x: number; palette: Palette; active: boolean; edge: "start" | "end"; time: bigint }) {
  const color = active ? palette.accent : palette.muted;
  return <WebView pointerEvents="none" dataSet={{ boundary: edge, boundaryTime: time.toString(), [edge === "start" ? "boundStart" : "boundEnd"]: time.toString() }} style={{ position: "absolute", left: x, top: RULER, bottom: 0, width: 1, backgroundColor: color }}><WebView style={{ position: "absolute", left: edge === "start" ? 0 : -13, bottom: 10, width: 14, height: 16, backgroundColor: palette.card, borderBottomWidth: 2, ...(edge === "start" ? { borderLeftWidth: 2, borderTopRightRadius: 5 } : { borderRightWidth: 2, borderTopLeftRadius: 5 }), borderColor: color, alignItems: "center", justifyContent: "center" }}><WebView style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} /></WebView></WebView>;
}
function Tool({ label, onPress, palette, hit, on, radio, disabled }: { label: string; onPress: () => void; palette: Palette; hit: number; on?: boolean; radio?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole={radio ? "radio" : "button"} accessibilityLabel={label} accessibilityState={radio ? { checked: !!on, disabled } : { selected: !!on, disabled }} disabled={disabled} onPress={onPress} style={{ opacity: disabled ? 0.45 : 1, minHeight: Math.max(44, hit), minWidth: Math.max(44, hit), paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: on ? palette.accent : palette.line, backgroundColor: on ? palette.accent : palette.card, justifyContent: "center" }}><Text style={{ color: on ? palette.accentInk : palette.ink, fontWeight: "600", fontSize: 12 }}>{on && radio ? "✓ " : ""}{label}</Text></Pressable>;
}
