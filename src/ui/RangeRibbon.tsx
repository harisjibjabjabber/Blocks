import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { CapturedEvent } from "../domain/capture";
import { moveBound, timeAt, type RangeBounds } from "./range";
import { ribbonMarks } from "./ribbon-scale";
import type { Palette } from "./theme";

export function RangeRibbon({
  events,
  bounds,
  ceiling,
  palette,
  handlePx,
  onCommit,
}: {
  events: readonly CapturedEvent[];
  bounds: RangeBounds;
  ceiling: bigint;
  palette: Palette;
  handlePx: number;
  onCommit: (next: RangeBounds) => void;
}) {
  const notes = events.filter((event) => event.kind === "note-on" && event.velocity > 0);
  const plot = useRef<HTMLElement | null>(null);
  const drag = useRef<"start" | "end" | null>(null);
  const [preview, setPreview] = useState(bounds);
  const previewRef = useRef(bounds);
  previewRef.current = preview;
  useEffect(() => {
    if (!drag.current) {
      setPreview(bounds);
    }
  }, [bounds.start, bounds.end]);
  if (notes.length === 0) {
    return <Text style={{ color: palette.muted, marginTop: 8 }}>Nothing played yet</Text>;
  }
  const origin = notes.reduce((min, event) => (event.scheduleElapsed < min ? event.scheduleElapsed : min), notes[0].scheduleElapsed);
  const last = notes.reduce((max, event) => (event.scheduleElapsed > max ? event.scheduleElapsed : max), notes[0].scheduleElapsed);
  const scaleEnd = ceiling > last ? ceiling : last;
  const span = scaleEnd > origin ? scaleEnd - origin : 1n;
  const marks = ribbonMarks(notes, scaleEnd);
  const xFor = (time: bigint) => Number(((time - origin) * 100n) / span);

  function move(clientX: number) {
    const node = plot.current;
    const which = drag.current;
    if (!node || !which) {
      return;
    }
    const rect = node.getBoundingClientRect();
    const time = timeAt(clientX - rect.left, rect.width, origin, span);
    const next = moveBound(previewRef.current, which, time, origin, ceiling > origin ? ceiling : scaleEnd);
    previewRef.current = next;
    setPreview(next);
  }

  function begin(which: "start" | "end", event: { nativeEvent?: { clientX?: number }; preventDefault?: () => void }) {
    event.preventDefault?.();
    drag.current = which;
    const onMove = (pointer: PointerEvent) => move(pointer.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      drag.current = null;
      onCommit(previewRef.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <View
      ref={(node) => {
        plot.current = node as unknown as HTMLElement | null;
      }}
      accessibilityLabel="Take ribbon"
      style={{ position: "relative", height: 168, marginTop: 8, backgroundColor: palette.plot, borderRadius: 12, borderWidth: 1, borderColor: palette.line, overflow: "hidden" }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: `${xFor(preview.start)}%`,
          width: `${Math.max(0, xFor(preview.end) - xFor(preview.start))}%`,
          top: 0,
          bottom: 48,
          backgroundColor: palette.handle,
          opacity: 0.12,
        }}
      />
      {marks.map((mark) => {
        const inside = notes.find((event) => event.id === mark.id);
        const on = inside ? inside.scheduleElapsed >= preview.start && inside.scheduleElapsed <= preview.end : true;
        return (
          <View
            key={mark.id}
            pointerEvents="none"
            style={{ position: "absolute", width: 8, height: 16, borderRadius: 2, backgroundColor: on ? palette.note : palette.noteDim, left: `${Math.min(96, Math.max(0, mark.xPercent))}%`, top: mark.y + 8 }}
          />
        );
      })}
      <Handle label="Start" color={palette.handle} ink={palette.accentInk} px={handlePx} x={xFor(preview.start)} onDown={(event) => begin("start", event)} />
      <Handle label="End" color={palette.handle} ink={palette.accentInk} px={handlePx} x={xFor(preview.end)} onDown={(event) => begin("end", event)} />
    </View>
  );
}

function Handle({
  label,
  color,
  ink,
  px,
  x,
  onDown,
}: {
  label: string;
  color: string;
  ink: string;
  px: number;
  x: number;
  onDown: (event: { preventDefault?: () => void }) => void;
}) {
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={label}
      onPointerDown={onDown as unknown as () => void}
      style={{
        position: "absolute",
        bottom: 4,
        width: px,
        height: px,
        marginLeft: -(px / 2),
        left: `${Math.min(92, Math.max(8, x))}%`,
        borderRadius: 12,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: ink, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
