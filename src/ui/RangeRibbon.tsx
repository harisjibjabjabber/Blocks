import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { CapturedEvent } from "../domain/capture";
import { moveBound, timeAt, type RangeBounds } from "./range";
import {
  contextTicks,
  earlierWindow,
  focusWindow,
  gripInRuler,
  handleAt,
  nudgeWindow,
  placedNotes,
  RULER_BAND,
  rulerCaption,
  rulerMarks,
  sameWindow,
  type RibbonGrid,
  type RibbonWindow,
} from "./ribbon-view";
import type { Palette } from "./theme";

const NOTE_HEIGHT = 104;

export function RangeRibbon({
  events,
  bounds,
  ceiling,
  palette,
  hitPx,
  grid,
  ticksPerSecond,
  onCommit,
}: {
  events: readonly CapturedEvent[];
  bounds: RangeBounds;
  ceiling: bigint;
  palette: Palette;
  hitPx: number;
  grid: RibbonGrid;
  ticksPerSecond: number;
  /** Called when the finger lifts on a changed range. Dragging does not call this. */
  onCommit: (next: RangeBounds) => void;
}) {
  const notes = events.filter((event) => event.kind === "note-on" && event.velocity > 0);
  const plot = useRef<HTMLElement | null>(null);
  const drag = useRef<"start" | "end" | null>(null);
  const committed = useRef(bounds);
  const lastReveal = useRef(0);
  const [plotWidth, setPlotWidth] = useState(320);
  const [preview, setPreview] = useState(bounds);
  const [view, setView] = useState<RibbonWindow | null>(null);
  const [dragging, setDragging] = useState(false);
  const previewRef = useRef(bounds);
  const viewRef = useRef<RibbonWindow>({ start: bounds.start, end: bounds.end });
  previewRef.current = preview;

  useEffect(() => {
    if (!drag.current) {
      setPreview(bounds);
      setView(null);
    }
  }, [bounds.start, bounds.end, ceiling]);

  if (notes.length === 0 || events.length === 0) {
    return <Text style={{ color: palette.muted, marginTop: 8 }}>Nothing played yet</Text>;
  }

  const historyStart = events.reduce((min, event) => (event.scheduleElapsed < min ? event.scheduleElapsed : min), events[0].scheduleElapsed);
  const limit = ceiling > historyStart ? ceiling : historyStart;
  const phrase = bounds.end > bounds.start ? bounds.end - bounds.start : 1n;
  const context = contextTicks(phrase, ticksPerSecond);
  const focused = focusWindow(historyStart, limit, bounds, context);
  const shown = view ?? focused;
  viewRef.current = shown;
  const span = shown.end > shown.start ? shown.end - shown.start : 1n;
  const marks = placedNotes(notes, shown, NOTE_HEIGHT);
  const ruler = rulerMarks(shown, grid, ticksPerSecond);
  const caption = rulerCaption(grid);
  const lastNote = notes.reduce((max, event) => (event.scheduleElapsed > max ? event.scheduleElapsed : max), notes[0].scheduleElapsed);
  const pastLastNote = preview.end > lastNote;

  const xFor = (time: bigint) => {
    const raw = Number(((time - shown.start) * 1000n) / span) / 10;
    if (!Number.isFinite(raw)) {
      return 0;
    }
    return Math.min(100, Math.max(0, raw));
  };
  const pxFor = (time: bigint) => (xFor(time) / 100) * plotWidth;
  const startPx = pxFor(preview.start);
  const endPx = pxFor(preview.end);
  const splayed = Math.abs(endPx - startPx) < 24;
  const plotHeight = RULER_BAND + NOTE_HEIGHT;

  function move(clientX: number) {
    const node = plot.current;
    const which = drag.current;
    if (!node || !which) {
      return;
    }
    const rect = node.getBoundingClientRect();
    let current = viewRef.current;
    const x = clientX - rect.left;
    const now = performance.now();
    if (which === "start" && x < 24 && now - lastReveal.current > 90) {
      const over = x < 0 ? Math.min(6, Math.ceil(-x / 32)) : 1;
      lastReveal.current = now;
      current = nudgeWindow(current, "start", context * BigInt(over), historyStart, limit);
      viewRef.current = current;
      setView(current);
    }
    const time = timeAt(Math.min(rect.width, Math.max(0, x)), rect.width, current.start, current.end - current.start);
    const next = moveBound(previewRef.current, which, time, historyStart, limit);
    previewRef.current = next;
    setPreview(next);
  }

  function begin(which: "start" | "end", event: { preventDefault?: () => void }) {
    event.preventDefault?.();
    drag.current = which;
    committed.current = { start: bounds.start, end: bounds.end };
    setDragging(true);
    const onMove = (pointer: PointerEvent) => move(pointer.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      drag.current = null;
      setDragging(false);
      const next = previewRef.current;
      const prior = committed.current;
      if (next.start !== prior.start || next.end !== prior.end) {
        onCommit(next);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function showEarlier() {
    const next = earlierWindow(viewRef.current, historyStart);
    viewRef.current = next;
    setView(next);
  }

  return (
    <View accessibilityLabel="Take ribbon" style={{ marginTop: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        {shown.start > historyStart ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Earlier" onPress={showEarlier} style={{ minHeight: hitPx, minWidth: hitPx, justifyContent: "center", paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.line }}>
            <Text style={{ color: palette.ink, fontSize: 14, fontWeight: "600" }}>Earlier</Text>
          </Pressable>
        ) : null}
        <Text accessibilityLabel={caption} style={{ color: palette.ink, fontSize: 13, fontWeight: "600", fontStyle: grid.kind === "beats" ? "italic" : "normal" }}>
          {caption}
        </Text>
        {sameWindow(shown, focused) ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel="Refocus" onPress={() => setView(null)} style={{ minHeight: hitPx, minWidth: hitPx, justifyContent: "center", paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.line }}>
            <Text style={{ color: palette.ink, fontSize: 14, fontWeight: "600" }}>Refocus</Text>
          </Pressable>
        )}
      </View>
      <View
        ref={(node) => {
          plot.current = node as unknown as HTMLElement | null;
        }}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          if (next > 0 && Math.abs(next - plotWidth) > 1) {
            setPlotWidth(next);
          }
        }}
        onPointerDown={(event: { nativeEvent?: { clientX?: number }; clientX?: number; preventDefault?: () => void }) => {
          const clientX = event.nativeEvent?.clientX ?? event.clientX;
          if (clientX === undefined || !plot.current) {
            return;
          }
          const rect = plot.current.getBoundingClientRect();
          const which = handleAt(clientX - rect.left, pxFor(previewRef.current.start), pxFor(previewRef.current.end), hitPx);
          if (!which) {
            return;
          }
          begin(which, event);
        }}
        style={{ position: "relative", height: plotHeight, backgroundColor: palette.plot, borderRadius: 12, borderWidth: 1, borderColor: palette.line, overflow: "hidden" }}
      >
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: RULER_BAND, height: 1, backgroundColor: palette.line }} />
        {ruler.map((mark) => (
          <RulerTick key={mark.kind + "-" + mark.time.toString()} x={xFor(mark.time)} tentative={mark.tentative} color={palette.muted} label={mark.label} />
        ))}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: `${xFor(preview.start)}%`,
            width: `${Math.max(0, xFor(preview.end) - xFor(preview.start))}%`,
            top: RULER_BAND,
            bottom: 0,
            backgroundColor: palette.ink,
            opacity: 0.06,
          }}
        />
        {marks.map((mark) => {
          const source = notes.find((event) => event.id === mark.id);
          const on = source ? source.scheduleElapsed >= preview.start && source.scheduleElapsed <= preview.end : true;
          return (
            <View
              key={mark.id}
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 7,
                height: 14,
                borderRadius: 2,
                backgroundColor: on ? palette.note : palette.noteDim,
                left: `${Math.min(98, Math.max(0, mark.xPercent))}%`,
                top: RULER_BAND + mark.y,
              }}
            />
          );
        })}
        <Boundary x={xFor(preview.start)} color={palette.ink} label="Start" />
        <Boundary x={xFor(preview.end)} color={palette.ink} label="End" />
        <Triangle edge="start" color={palette.ink} mark={gripInRuler(startPx, plotWidth, "start", splayed)} />
        <Triangle edge="end" color={palette.ink} mark={gripInRuler(endPx, plotWidth, "end", splayed)} />
      </View>
      {pastLastNote ? <Text style={{ color: palette.muted, fontSize: 13, marginTop: 6 }}>End is past the last note.</Text> : null}
      {dragging ? <Text style={{ color: palette.ink, fontSize: 13, marginTop: 4 }}>Release plays from the new start. This drag keeps the previous range.</Text> : null}
    </View>
  );
}

function RulerTick({ x, tentative, color, label }: { x: number; tentative: boolean; color: string; label: string }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: `${x}%`, top: 0, height: RULER_BAND, width: 1 }}>
      {tentative
        ? [0, 7, 14, 21].map((top) => <View key={top} style={{ position: "absolute", top, height: 3, width: 1, backgroundColor: color }} />)
        : <View style={{ position: "absolute", top: 0, height: RULER_BAND, width: 1, backgroundColor: color }} />}
      {label ? <Text style={{ position: "absolute", top: 2, left: 3, color, fontSize: 10, width: 28 }}>{label}</Text> : null}
    </View>
  );
}

function Boundary({ x, color, label }: { x: number; color: string; label: string }) {
  return <View accessibilityLabel={label} pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, width: 2, marginLeft: -1, left: `${x}%`, backgroundColor: color }} />;
}

function Triangle({ edge, color, mark }: { edge: "start" | "end"; color: string; mark: { left: number; top: number; size: number } }) {
  const pointRight = edge === "start";
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: mark.left,
        top: mark.top,
        width: 0,
        height: 0,
        borderTopWidth: 5,
        borderBottomWidth: 5,
        ...(pointRight
          ? { borderLeftWidth: 8, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: color }
          : { borderRightWidth: 8, borderTopColor: "transparent", borderBottomColor: "transparent", borderRightColor: color }),
      }}
    />
  );
}
