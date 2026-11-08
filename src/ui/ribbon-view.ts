/** What the take ribbon draws. It does not move notes, controllers, or the loop. */

import type { RangeBounds } from "./range";

export interface RibbonWindow {
  start: bigint;
  end: bigint;
}

/** Beats when only a BPM is known. Solid bars only when a bar phase is known. */
export type RibbonGrid =
  | { kind: "free" }
  | { kind: "beats"; bpm: number; phase: bigint; proposed: boolean }
  | { kind: "bars"; bpm: number; phase: bigint };

export interface RulerMark {
  time: bigint;
  kind: "bar" | "beat" | "second";
  label: string;
  /** Dashed. A BPM without a known bar phase stays tentative, including an accepted BPM. */
  tentative: boolean;
}

export const RULER_BAND = 28;

export interface HitBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function beatTicks(bpm: number, ticksPerSecond: number): bigint {
  if (!Number.isFinite(bpm) || bpm <= 0 || ticksPerSecond <= 0) {
    return 0n;
  }
  return BigInt(Math.round((60 / bpm) * ticksPerSecond));
}

/** A little time before the phrase. About a tenth of the phrase, not the whole history. */
export function contextTicks(phraseTicks: bigint, ticksPerSecond: number): bigint {
  const tenth = phraseTicks > 0n ? phraseTicks / 10n : 0n;
  const floor = BigInt(Math.round(ticksPerSecond * 0.25));
  return tenth > floor ? tenth : floor;
}

/**
 * The phrase, the silent tail out to the loop end, and a little context before the start.
 * Earlier history stays available to a drag. It is not scaled into this window.
 */
export function focusWindow(historyStart: bigint, ceiling: bigint, bounds: RangeBounds, context: bigint): RibbonWindow {
  let end = ceiling > bounds.end ? ceiling : bounds.end;
  let start = bounds.start - (context > 0n ? context : 0n);
  if (start < historyStart) {
    start = historyStart;
  }
  if (start > bounds.start) {
    start = bounds.start;
  }
  if (end < bounds.end) {
    end = bounds.end;
  }
  if (end <= start) {
    end = start + 1n;
  }
  return { start, end };
}

/** Slide the window toward older history, or out to the loop end. Does not pass either limit. */
export function nudgeWindow(window: RibbonWindow, edge: "start" | "end", step: bigint, historyStart: bigint, ceiling: bigint): RibbonWindow {
  const amount = step > 0n ? step : 0n;
  if (edge === "start") {
    const start = window.start - amount < historyStart ? historyStart : window.start - amount;
    return { start, end: window.end };
  }
  const limit = ceiling > window.end ? ceiling : window.end;
  const end = window.end + amount > limit ? limit : window.end + amount;
  return { start: window.start, end };
}

/**
 * Pan one view earlier. The loop bounds are not an argument and are not changed.
 * One step does not fit the whole history into the ribbon.
 */
export function earlierWindow(window: RibbonWindow, historyStart: bigint): RibbonWindow {
  const span = window.end > window.start ? window.end - window.start : 1n;
  const start = window.start - span < historyStart ? historyStart : window.start - span;
  return { start, end: start + span };
}

export function sameWindow(a: RibbonWindow, b: RibbonWindow): boolean {
  return a.start === b.start && a.end === b.end;
}

export function ribbonGrid(input: {
  tempoBpm: number | null;
  proposedTempoBpm: number | null;
  gridLocked: boolean;
  beatPhase: bigint;
  /** Null unless a bar downbeat was actually measured. An accepted BPM is not one. */
  barPhase: bigint | null;
}): RibbonGrid {
  const bpm = input.gridLocked && input.tempoBpm !== null && Number.isFinite(input.tempoBpm) ? input.tempoBpm : input.proposedTempoBpm;
  if (bpm === null || !Number.isFinite(bpm)) {
    return { kind: "free" };
  }
  if (input.barPhase !== null) {
    return { kind: "bars", bpm, phase: input.barPhase };
  }
  return { kind: "beats", bpm, phase: input.beatPhase, proposed: !(input.gridLocked && input.tempoBpm !== null) };
}

export function rulerCaption(grid: RibbonGrid): string {
  if (grid.kind === "free") {
    return "Seconds";
  }
  if (grid.kind === "bars") {
    return "Tempo " + grid.bpm;
  }
  return grid.proposed ? "Tempo " + grid.bpm + " · proposed" : "Tempo " + grid.bpm + " · beats only";
}

export function rulerMarks(window: RibbonWindow, grid: RibbonGrid, ticksPerSecond: number): RulerMark[] {
  const span = window.end - window.start;
  if (span <= 0n || ticksPerSecond <= 0) {
    return [];
  }
  if (grid.kind === "free") {
    const step = BigInt(Math.round(ticksPerSecond));
    if (step <= 0n) {
      return [];
    }
    const seconds = Number(span) / ticksPerSecond;
    const every = seconds > 16 ? 5n : 1n;
    const marks: RulerMark[] = [];
    let time = window.start % step === 0n ? window.start : window.start - (window.start % step) + step;
    if (window.start < 0n) {
      time = window.start;
    }
    for (let guard = 0; guard < 400 && time <= window.end; guard += 1) {
      const index = time / step;
      marks.push({
        time,
        kind: "second",
        label: index % every === 0n ? String(index) : "",
        tentative: false,
      });
      time += step;
    }
    return marks;
  }
  const beat = beatTicks(grid.bpm, ticksPerSecond);
  if (beat <= 0n) {
    return [];
  }
  let index = 0n;
  if (window.start > grid.phase) {
    const delta = window.start - grid.phase;
    index = delta / beat;
    if (grid.phase + index * beat < window.start) {
      index += 1n;
    }
  } else if (window.start < grid.phase) {
    const delta = grid.phase - window.start;
    const back = delta / beat + (delta % beat === 0n ? 0n : 1n);
    index = -back;
  }
  const marks: RulerMark[] = [];
  for (let guard = 0; guard < 2000; guard += 1) {
    const time = grid.phase + index * beat;
    if (time > window.end) {
      break;
    }
    if (time >= window.start) {
      const bar = grid.kind === "bars" && index % 4n === 0n;
      const barNumber = index / 4n;
      marks.push({
        time,
        kind: bar ? "bar" : "beat",
        label: bar && index >= 0n ? String(barNumber + 1n) : "",
        tentative: grid.kind !== "bars",
      });
    }
    index += 1n;
  }
  return marks;
}

export interface PlacedNote {
  id: string;
  xPercent: number;
  y: number;
}

/** Notes inside the window only. Times on the source events are not copied out as edits. */
export function placedNotes(
  notes: readonly { id: string; scheduleElapsed: bigint; note: number }[],
  window: RibbonWindow,
  plotHeight: number,
): PlacedNote[] {
  const visible = notes.filter((event) => event.scheduleElapsed >= window.start && event.scheduleElapsed <= window.end);
  if (visible.length === 0) {
    return [];
  }
  const span = window.end > window.start ? window.end - window.start : 1n;
  const lowest = visible.reduce((min, event) => Math.min(min, event.note), visible[0].note);
  const highest = visible.reduce((max, event) => Math.max(max, event.note), visible[0].note);
  const pitch = Math.max(1, highest - lowest);
  const usable = Math.max(16, plotHeight - 16);
  return visible.map((event) => ({
    id: event.id,
    xPercent: Number(((event.scheduleElapsed - window.start) * 100n) / span),
    y: 8 + ((highest - event.note) / pitch) * (usable - 16),
  }));
}

export function notesInRecentWindow<T extends { scheduleElapsed: bigint }>(notes: readonly T[], windowTicks: bigint): T[] {
  if (notes.length === 0 || windowTicks <= 0n) {
    return notes.slice();
  }
  const newest = notes.reduce((max, event) => (event.scheduleElapsed > max ? event.scheduleElapsed : max), notes[0].scheduleElapsed);
  const start = newest > windowTicks ? newest - windowTicks : 0n;
  return notes.filter((event) => event.scheduleElapsed >= start);
}

/**
 * Invisible press target. The drawn grip is smaller.
 * Against an edge the target stays inside the plot.
 * A narrow range stacks the two targets so both stay pressable.
 */
export function gripHitBox(boundPx: number, plotWidth: number, plotHeight: number, hit: number, edge: "start" | "end", stacked: boolean): HitBox {
  const width = Math.min(Math.max(hit, 44), Math.max(plotWidth, 1));
  const height = Math.min(Math.max(hit, 44), Math.max(plotHeight, 1));
  let left = boundPx - width / 2;
  if (left < 0) {
    left = 0;
  }
  if (left + width > plotWidth) {
    left = Math.max(0, plotWidth - width);
  }
  let top = stacked ? (edge === "start" ? 0 : plotHeight - height) : Math.max(0, (plotHeight - height) / 2);
  if (top < 0) {
    top = 0;
  }
  if (top + height > plotHeight) {
    top = Math.max(0, plotHeight - height);
  }
  return { left, top, width, height };
}

export interface GripMark {
  left: number;
  top: number;
  size: number;
}

/** The drawn triangle. It stays inside the ruler band and points into the range. */
/** Nearest boundary wins when the invisible zones overlap. A miss returns null. */
export function handleAt(x: number, startPx: number, endPx: number, hit: number): "start" | "end" | null {
  const reach = Math.max(hit, 44) / 2;
  const startDist = Math.abs(x - startPx);
  const endDist = Math.abs(x - endPx);
  const startHit = startDist <= reach;
  const endHit = endDist <= reach;
  if (!startHit && !endHit) {
    return null;
  }
  if (startHit && endHit) {
    return startDist <= endDist ? "start" : "end";
  }
  return startHit ? "start" : "end";
}

export function gripInRuler(boundPx: number, plotWidth: number, edge: "start" | "end", splayed: boolean): GripMark {
  const size = 12;
  let left = edge === "start" ? boundPx + 1 : boundPx - size - 1;
  if (splayed) {
    left = edge === "start" ? boundPx - size - 1 : boundPx + 1;
  }
  if (left < 0) {
    left = 0;
  }
  if (left + size > plotWidth) {
    left = Math.max(0, plotWidth - size);
  }
  const top = splayed && edge === "end" ? 14 : 2;
  return { left, top, size };
}
