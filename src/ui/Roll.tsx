import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  framePhrase,
  noteBox,
  panWindow,
  pitchLabel,
  pitchToY,
  rulerMarks,
  timeToX,
  xToTime,
  yToPitch,
  zoomWindow,
  type KnownGrid,
  type RulerMark,
  type TimeWindow,
} from "./roll-time";
import { resizeNote, type RollNote } from "./roll-notes";
import type { Palette } from "./theme";

export type RollTool = "select" | "draw" | "erase" | "velocity" | "pan";

const RULER = 28;

export function Roll({
  notes,
  window,
  bounds,
  ceiling,
  historyStart,
  grid,
  palette,
  mode,
  tool,
  selectedId,
  ghosts,
  hitPx,
  onWindow,
  onBoundsCommit,
  onSelect,
  onCommitNotes,
  onEdit,
  onClose,
  onTool,
  showPan = true,
}: {
  notes: readonly RollNote[];
  window: TimeWindow | null;
  bounds: { start: bigint; end: bigint } | null;
  ceiling: bigint;
  historyStart: bigint;
  grid: KnownGrid | null;
  palette: Palette;
  mode: "compact" | "room";
  tool: RollTool;
  selectedId: string | null;
  ghosts: readonly { id: string; start: bigint; end: bigint }[];
  hitPx: number;
  onWindow: (next: TimeWindow) => void;
  onBoundsCommit: (next: { start: bigint; end: bigint }) => void;
  onSelect: (id: string | null) => void;
  onCommitNotes: (next: RollNote[]) => void;
  onEdit?: () => void;
  onClose?: () => void;
  onTool?: (tool: RollTool) => void;
  showPan?: boolean;
}) {
  const host = useRef<HTMLElement | null>(null);
  const [plotWidth, setPlotWidth] = useState(640);
  const [topPitch, setTopPitch] = useState(() => topOf(notes));
  const [liveNotes, setLiveNotes] = useState<RollNote[] | null>(null);
  const [liveBounds, setLiveBounds] = useState<{ start: bigint; end: bigint } | null>(null);
  const [draft, setDraft] = useState<RollNote | null>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const liveNotesRef = useRef<RollNote[] | null>(null);
  const liveBoundsRef = useRef<{ start: bigint; end: bigint } | null>(null);
  const draftRef = useRef<RollNote | null>(null);
  const shownNotes = liveNotes ?? notes;
  const shownBounds = liveBounds ?? bounds;
  const view = window ?? (bounds ? framePhrase(historyStart, bounds.start, bounds.end) : frameOf(notes, historyStart));
  const rowHeight = mode === "room" ? 18 : fitRow(shownNotes);
  const noteHeight = mode === "room" ? 320 : 112;
  const labelWidth = mode === "room" ? 48 : 36;
  const pitches = visiblePitches(topPitch, noteHeight, rowHeight);

  function width() {
    return plotWidth;
  }

  function localX(clientX: number) {
    const rect = host.current?.getBoundingClientRect();
    return rect ? clientX - rect.left : 0;
  }

  function localY(clientY: number) {
    const rect = host.current?.getBoundingClientRect();
    return rect ? clientY - rect.top - RULER : 0;
  }

  function begin(event: PointerEventLike) {
    const pointerId = event.nativeEvent?.pointerId ?? event.pointerId ?? 1;
    const clientX = event.nativeEvent?.clientX ?? event.clientX ?? 0;
    const clientY = event.nativeEvent?.clientY ?? event.clientY ?? 0;
    pointers.current.set(pointerId, { x: clientX, y: clientY });
    const onMove = (pointer: PointerEvent) => move(pointer);
    const onUp = (pointer: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      end(pointer);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      pinch.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      drag.current = null;
      return;
    }
    const x = localX(clientX);
    const y = localY(clientY);
    if (shownBounds && y < RULER + 8) {
      const startX = timeToX(shownBounds.start, view, width());
      const endX = timeToX(shownBounds.end, view, width());
      if (Math.abs(x - startX) <= hitPx / 2 && Math.abs(x - startX) <= Math.abs(x - endX)) {
        drag.current = { kind: "bound", edge: "start", originX: x };
        return;
      }
      if (Math.abs(x - endX) <= hitPx / 2) {
        drag.current = { kind: "bound", edge: "end", originX: x };
        return;
      }
    }
    const hit = noteAt(shownNotes, x, y, view, width(), topPitch, rowHeight);
    if (mode === "compact") {
      return;
    }
    if (tool === "pan") {
      drag.current = { kind: "pan", originX: x, originWindow: view };
      return;
    }
    if (tool === "erase" && hit) {
      onCommitNotes(shownNotes.filter((note) => note.id !== hit.id));
      onSelect(null);
      return;
    }
    if (tool === "draw" && !hit) {
      const pitch = yToPitch(Math.max(0, y), topPitch, rowHeight);
      const start = xToTime(x, view, width());
      const created: RollNote = { id: "draw-" + start.toString(), channel: 0, pitch, start, end: start + 1n, velocity: 96, sourceOnId: null, sourceOffId: null };
      setDraft(created);
      drag.current = { kind: "draw", originX: x, note: created };
      return;
    }
    if (hit && tool === "velocity") {
      onSelect(hit.id);
      drag.current = { kind: "velocity", originY: clientY, note: hit };
      return;
    }
    if (hit) {
      onSelect(hit.id);
      const box = noteBox(hit.start, hit.end, hit.pitch, view, width(), topPitch, rowHeight);
      const edge = x - box.x < 10 ? "start" : box.x + box.width - x < 10 ? "end" : "body";
      drag.current = { kind: edge === "body" ? "move" : "resize", edge: edge === "body" ? "end" : edge, originX: x, originY: y, note: hit };
      return;
    }
    onSelect(null);
  }

  function move(event: PointerEvent) {
    const point = pointers.current.get(event.pointerId);
    if (point) {
      point.x = event.clientX;
      point.y = event.clientY;
    }
    if (pointers.current.size === 2 && pinch.current) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinch.current > 0 && Math.abs(dist - pinch.current) > 12) {
        const factor = dist > pinch.current ? 0.9 : 1.1;
        onWindow(zoomWindow(view, factor, xToTime(width() / 2, view, width()), 50_000n, 120_000_000n));
        pinch.current = dist;
      }
      return;
    }
    const current = drag.current;
    if (!current || !host.current) {
      return;
    }
    const x = localX(event.clientX);
    const y = localY(event.clientY);
    if (current.kind === "bound" && shownBounds) {
      const time = xToTime(x, view, width());
      const next = current.edge === "start"
        ? { start: time < shownBounds.end ? time : shownBounds.end - 1n, end: shownBounds.end }
        : { start: shownBounds.start, end: time > shownBounds.start ? time : shownBounds.start + 1n };
      if (next.end > ceiling) {
        next.end = ceiling;
      }
      if (next.start < historyStart) {
        next.start = historyStart;
      }
      liveBoundsRef.current = next;
      setLiveBounds(next);
      return;
    }
    if (current.kind === "pan" && current.originWindow) {
      const origin = xToTime(current.originX, current.originWindow, width());
      const now = xToTime(x, current.originWindow, width());
      onWindow(panWindow(current.originWindow, origin - now, historyStart));
      return;
    }
    if (current.kind === "draw" && current.note) {
      const time = xToTime(x, view, width());
      const end = time > current.note.start ? time : current.note.start + 1n;
      const drawn = { ...current.note, end };
      draftRef.current = drawn;
      setDraft(drawn);
      return;
    }
    if (!current.note) {
      return;
    }
    if (current.kind === "velocity") {
      const velocity = current.note.velocity + (current.originY - event.clientY);
      const next = shownNotes.map((note) => (note.id === current.note?.id ? { ...note, velocity: Math.max(1, Math.min(127, Math.round(velocity))) } : note));
      liveNotesRef.current = next;
      setLiveNotes(next);
      return;
    }
    if (current.kind === "resize" && current.edge) {
      const time = xToTime(x, view, width());
      const next = resizeNote(shownNotes, current.note.id, current.edge, time);
      liveNotesRef.current = next;
      setLiveNotes(next);
      return;
    }
    if (current.kind === "move") {
      const origin = xToTime(current.originX, view, width());
      const now = xToTime(x, view, width());
      const pitch = yToPitch(Math.max(0, y), topPitch, rowHeight);
      const length = current.note.end - current.note.start;
      const start = current.note.start + (now - origin);
      const next = shownNotes.map((note) => (note.id === current.note?.id ? { ...note, pitch, start, end: start + length } : note));
      liveNotesRef.current = next;
      setLiveNotes(next);
    }
  }

  function end(event: PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      pinch.current = null;
    }
    const current = drag.current;
    drag.current = null;
    if (current?.kind === "bound" && liveBoundsRef.current) {
      const prior = bounds;
      const next = liveBoundsRef.current;
      liveBoundsRef.current = null;
      setLiveBounds(null);
      if (prior && (next.start !== prior.start || next.end !== prior.end)) {
        onBoundsCommit(next);
      }
      return;
    }
    if (current?.kind === "draw" && draftRef.current) {
      const drawn = draftRef.current;
      const next = shownNotes.concat(drawn.end > drawn.start ? drawn : { ...drawn, end: drawn.start + 1n });
      draftRef.current = null;
      setDraft(null);
      onCommitNotes(next);
      onSelect(drawn.id);
      return;
    }
    if (liveNotesRef.current) {
      const next = liveNotesRef.current;
      liveNotesRef.current = null;
      setLiveNotes(null);
      onCommitNotes(next);
    }
  }

  const marks = rulerMarks(view, grid);
  const drawing = draft ? shownNotes.concat(draft) : shownNotes;

  return (
    <View accessibilityLabel={mode === "room" ? "Piano roll" : "Take ribbon"} style={{ marginTop: 8 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Text style={{ color: palette.ink, fontWeight: "700", fontSize: 14 }}>{grid ? "Tempo " + grid.bpm + " · " + grid.beatsPerBar + "/4" : "Seconds"}</Text>
        {mode === "compact" && onEdit ? <Tool label="Edit" onPress={onEdit} palette={palette} hit={hitPx} on /> : null}
        {mode === "room" && onClose ? <Tool label="Play view" onPress={onClose} palette={palette} hit={hitPx} /> : null}
        {mode === "room" && onTool ? (
          <>
            {(["select", "draw", "erase", "velocity", "pan"] as const).map((name) => (
              <Tool key={name} label={name === "select" ? "Select" : name === "draw" ? "Draw" : name === "erase" ? "Erase" : name === "velocity" ? "Velocity" : "Pan"} onPress={() => onTool(name)} palette={palette} hit={hitPx} on={tool === name} />
            ))}
            <Tool label="Zoom in" onPress={() => onWindow(zoomWindow(view, 0.5, view.start + (view.end - view.start) / 2n, 50_000n, 120_000_000n))} palette={palette} hit={hitPx} />
            <Tool label="Zoom out" onPress={() => onWindow(zoomWindow(view, 2, view.start + (view.end - view.start) / 2n, 50_000n, 120_000_000n))} palette={palette} hit={hitPx} />
            <Tool label="Higher" onPress={() => setTopPitch((pitch) => Math.min(120, pitch + 4))} palette={palette} hit={hitPx} />
            <Tool label="Lower" onPress={() => setTopPitch((pitch) => Math.max(24, pitch - 4))} palette={palette} hit={hitPx} />
          </>
        ) : null}
        {showPan ? <Tool label="Earlier" onPress={() => onWindow(panWindow(view, -(view.end - view.start), historyStart))} palette={palette} hit={hitPx} /> : null}
        {showPan ? <Tool label="Refocus" onPress={() => onWindow(bounds ? framePhrase(historyStart, bounds.start, bounds.end) : frameOf(notes, historyStart))} palette={palette} hit={hitPx} /> : null}
      </View>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: labelWidth, height: noteHeight, marginTop: RULER, position: "relative" }}>
          {pitches.filter((pitch) => pitch % (mode === "compact" ? 12 : 1) === 0 || mode === "room").map((pitch) => (
            <Text key={pitch} style={{ position: "absolute", top: pitchToY(pitch, topPitch, rowHeight), color: palette.muted, fontSize: 10, height: rowHeight }}>
              {pitchLabel(pitch)}
            </Text>
          ))}
        </View>
        <View
          ref={(node) => {
            host.current = node as unknown as HTMLElement | null;
          }}
          onLayout={(event) => {
            const next = event.nativeEvent.layout.width;
            if (next > 0 && Math.abs(next - plotWidth) > 1) {
              setPlotWidth(next);
            }
          }}
          onPointerDown={begin as unknown as () => void}
          style={{ position: "relative", flex: 1, height: RULER + noteHeight, backgroundColor: palette.plot, borderRadius: 12, borderWidth: 1, borderColor: palette.line, overflow: "hidden" }}
        >
          {marks.map((mark) => (
            <Tick key={mark.kind + mark.time.toString()} mark={mark} x={timeToX(mark.time, view, width())} color={palette.muted} strong={mark.kind !== "beat"} />
          ))}
          {shownBounds ? (
            <View pointerEvents="none" style={{ position: "absolute", left: timeToX(shownBounds.start, view, width()), width: Math.max(0, timeToX(shownBounds.end, view, width()) - timeToX(shownBounds.start, view, width())), top: RULER, bottom: 0, backgroundColor: palette.ink, opacity: 0.05 }} />
          ) : null}
          {drawing.map((note) => {
            const box = noteBox(note.start, note.end, note.pitch, view, width(), topPitch, rowHeight);
            const ghost = ghosts.find((item) => item.id === note.id);
            return (
              <View key={note.id} pointerEvents="none">
                <View style={{ position: "absolute", left: box.x, top: RULER + box.y + 1, width: Math.max(2, box.width), height: box.height, borderRadius: 3, backgroundColor: note.id === selectedId ? palette.accent : palette.note, opacity: note.velocity / 127 }} />
                {ghost ? <View style={{ position: "absolute", left: timeToX(ghost.start, view, width()), top: RULER + box.y + 1, width: Math.max(2, timeToX(ghost.end, view, width()) - timeToX(ghost.start, view, width())), height: box.height, borderRadius: 3, borderWidth: 1, borderColor: palette.accent }} /> : null}
              </View>
            );
          })}
          {shownBounds ? (
            <>
              <Grip x={timeToX(shownBounds.start, view, width())} color={palette.ink} />
              <Grip x={timeToX(shownBounds.end < ceiling ? shownBounds.end : ceiling, view, width())} color={palette.ink} />
            </>
          ) : null}
        </View>
      </View>
      {shownBounds && drawing.length > 0 && shownBounds.end > lastEnd(drawing) ? <Text style={{ color: palette.muted, marginTop: 6, fontSize: 13 }}>End is past the last note.</Text> : null}
    </View>
  );
}

function lastEnd(notes: readonly RollNote[]): bigint {
  return notes.reduce((max, note) => (note.end > max ? note.end : max), 0n);
}

function topOf(notes: readonly RollNote[]): number {
  if (notes.length === 0) {
    return 84;
  }
  return notes.reduce((max, note) => Math.max(max, note.pitch), notes[0].pitch) + 2;
}

function fitRow(notes: readonly RollNote[]): number {
  if (notes.length === 0) {
    return 14;
  }
  const low = notes.reduce((min, note) => Math.min(min, note.pitch), notes[0].pitch);
  const high = notes.reduce((max, note) => Math.max(max, note.pitch), notes[0].pitch);
  const rows = Math.max(1, high - low + 1);
  return Math.max(8, Math.min(16, 112 / rows));
}

function frameOf(notes: readonly RollNote[], floor: bigint): TimeWindow {
  if (notes.length === 0) {
    return { start: floor, end: floor + 4_000_000n };
  }
  const start = notes.reduce((min, note) => (note.start < min ? note.start : min), notes[0].start);
  const end = notes.reduce((max, note) => (note.end > max ? note.end : max), notes[0].end);
  return framePhrase(floor, start, end > start ? end : start + 1n);
}

function visiblePitches(top: number, height: number, row: number): number[] {
  const count = Math.max(1, Math.ceil(height / row) + 1);
  const pitches: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const pitch = top - i;
    if (pitch >= 0 && pitch <= 127) {
      pitches.push(pitch);
    }
  }
  return pitches;
}

function noteAt(notes: readonly RollNote[], x: number, y: number, view: TimeWindow, width: number, top: number, row: number): RollNote | null {
  for (let i = notes.length - 1; i >= 0; i -= 1) {
    const note = notes[i];
    const box = noteBox(note.start, note.end, note.pitch, view, width, top, row);
    const left = box.x;
    const right = box.x + Math.max(8, box.width);
    if (x >= left && x <= right && y >= box.y && y <= box.y + box.height) {
      return note;
    }
  }
  return null;
}

function Tick({ mark, x, color, strong }: { mark: RulerMark; x: number; color: string; strong: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x, top: strong ? 0 : 10, height: strong ? RULER : 12, width: 1, backgroundColor: color }}>
      {mark.label ? <Text style={{ position: "absolute", left: 3, top: 1, color, fontSize: 10, width: 36 }}>{mark.label}</Text> : null}
    </View>
  );
}

function Grip({ x, color }: { x: number; color: string }) {
  return <View pointerEvents="none" style={{ position: "absolute", left: x - 1, top: 0, bottom: 0, width: 2, backgroundColor: color }} />;
}

function Tool({ label, onPress, palette, hit, on }: { label: string; onPress: () => void; palette: Palette; hit: number; on?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ minHeight: hit, minWidth: hit, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: on ? palette.accent : palette.line, backgroundColor: on ? palette.accent : palette.card, justifyContent: "center" }}>
      <Text style={{ color: on ? palette.accentInk : palette.ink, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

type PointerEventLike = {
  nativeEvent?: { clientX?: number; clientY?: number; pointerId?: number };
  clientX?: number;
  clientY?: number;
  pointerId?: number;
};

type Drag = {
  kind: "bound" | "pan" | "draw" | "velocity" | "move" | "resize";
  edge?: "start" | "end";
  originX: number;
  originY: number;
  originWindow?: TimeWindow;
  note?: RollNote;
};
