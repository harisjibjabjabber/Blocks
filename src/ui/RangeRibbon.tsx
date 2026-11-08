import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { CapturedEvent } from "../domain/capture";
import { moveBound, timeAt, type RangeBounds } from "./range";
import {
  contextTicks,
  focusWindow,
  gripHitBox,
  nudgeWindow,
  placedNotes,
  rulerCaption,
  rulerMarks,
  type RibbonGrid,
  type RibbonWindow,
} from "./ribbon-view";
import type { Palette } from "./theme";

const PLOT_HEIGHT = 120;
const NOTE_TOP = 18;

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
  onCommit: (next: RangeBounds) => void;
}) {
  const notes = events.filter((event) => event.kind === "note-on" && event.velocity > 0);
  const plot = useRef<HTMLElement | null>(null);
  const drag = useRef<"start" | "end" | null>(null);
  const lastReveal = useRef(0);
  const [plotWidth, setPlotWidth] = useState(320);
  const [preview, setPreview] = useState(bounds);
  const [view, setView] = useState<RibbonWindow | null>(null);
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
  const context = contextTicks(phrase, grid, ticksPerSecond);
  const focused = focusWindow(historyStart, limit, bounds, context);
  const shown = view ?? focused;
  viewRef.current = shown;
  const span = shown.end > shown.start ? shown.end - shown.start : 1n;
  const marks = placedNotes(notes, shown, PLOT_HEIGHT - NOTE_TOP);
  const ruler = rulerMarks(shown, grid, ticksPerSecond);
  const caption = rulerCaption(grid);

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
  const stacked = Math.abs(endPx - startPx) < hitPx * 1.25;

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
    if (which === "start" && x < 16 && now - lastReveal.current > 90) {
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
    const onMove = (pointer: PointerEvent) => move(pointer.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      drag.current = null;
      setView(null);
      onCommit(previewRef.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <View accessibilityLabel="Take ribbon" style={{ marginTop: 8 }}>
      <Text accessibilityLabel={caption} style={{ color: grid.kind === "bars" && grid.tentative ? palette.muted : palette.ink, fontSize: 13, fontWeight: "600", marginBottom: 4 }}>
        {caption}
      </Text>
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
        style={{ position: "relative", height: PLOT_HEIGHT, backgroundColor: palette.plot, borderRadius: 12, borderWidth: 1, borderColor: palette.line, overflow: "hidden" }}
      >
        {ruler.map((mark) => {
          const x = xFor(mark.time);
          const strong = mark.kind === "bar" || mark.kind === "second";
          return (
            <View key={mark.kind + "-" + mark.time.toString()} pointerEvents="none" style={{ position: "absolute", left: `${x}%`, top: 0, bottom: 0, width: strong ? 2 : 1, backgroundColor: palette.muted, opacity: mark.tentative ? (strong ? 0.85 : 0.45) : strong ? 1 : 0.6 }} />
          );
        })}
        {ruler.map((mark) =>
          mark.label ? (
            <Text key={"label-" + mark.time.toString()} pointerEvents="none" style={{ position: "absolute", left: `${Math.min(96, xFor(mark.time))}%`, top: 2, color: palette.muted, fontSize: 10, marginLeft: 4 }}>
              {mark.label}
            </Text>
          ) : null,
        )}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: `${xFor(preview.start)}%`,
            width: `${Math.max(0, xFor(preview.end) - xFor(preview.start))}%`,
            top: 0,
            bottom: 0,
            backgroundColor: palette.handle,
            opacity: 0.08,
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
                top: NOTE_TOP + mark.y,
              }}
            />
          );
        })}
        <Boundary x={xFor(preview.start)} color={palette.handle} />
        <Boundary x={xFor(preview.end)} color={palette.handle} />
        <Grip label="Start" edge="start" color={palette.handle} box={gripHitBox(startPx, plotWidth, PLOT_HEIGHT, hitPx, "start", stacked)} onDown={(event) => begin("start", event)} />
        <Grip label="End" edge="end" color={palette.handle} box={gripHitBox(endPx, plotWidth, PLOT_HEIGHT, hitPx, "end", stacked)} onDown={(event) => begin("end", event)} />
      </View>
    </View>
  );
}

function Boundary({ x, color }: { x: number; color: string }) {
  return <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, width: 2, marginLeft: -1, left: `${x}%`, backgroundColor: color }} />;
}

function Grip({
  label,
  edge,
  color,
  box,
  onDown,
}: {
  label: string;
  edge: "start" | "end";
  color: string;
  box: { left: number; top: number; width: number; height: number };
  onDown: (event: { preventDefault?: () => void }) => void;
}) {
  const pointRight = edge === "start";
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={label}
      onPointerDown={onDown as unknown as () => void}
      style={{ position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" }}
    >
      <View
        pointerEvents="none"
        style={
          pointRight
            ? { width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 9, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: color }
            : { width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderRightWidth: 9, borderTopColor: "transparent", borderBottomColor: "transparent", borderRightColor: color }
        }
      />
    </View>
  );
}
