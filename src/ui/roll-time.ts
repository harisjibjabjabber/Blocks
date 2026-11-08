/**
 * One time coordinate for the roll.
 * The scheduler reads `scheduleElapsed` as microseconds (`planFromElapsed` divides by 1_000_000).
 * The ruler, notes, handles, scroll, and zoom all use that same bigint. Nothing here edits events.
 */

export interface TimeWindow {
  start: bigint;
  end: bigint;
}

export interface KnownGrid {
  bpm: number;
  beatsPerBar: number;
  /** Bar 1, in scheduler ticks. An accepted BPM without this is not a grid. */
  phase: bigint;
}

export interface RulerMark {
  time: bigint;
  kind: "second" | "bar" | "beat";
  label: string;
}

export function timeToX(time: bigint, window: TimeWindow, width: number): number {
  const span = window.end - window.start;
  if (span <= 0n || !(width > 0)) {
    return 0;
  }
  return (Number(time - window.start) / Number(span)) * width;
}

export function xToTime(x: number, window: TimeWindow, width: number): bigint {
  const span = window.end - window.start;
  if (span <= 0n || !(width > 0)) {
    return window.start;
  }
  const ratio = Math.min(1, Math.max(0, x / width));
  return window.start + BigInt(Math.round(ratio * Number(span)));
}

/** Pixels between a scheduler timestamp and the time recovered from its own x. */
export function alignmentPx(time: bigint, window: TimeWindow, width: number): number {
  const x = timeToX(time, window, width);
  return Math.abs(timeToX(xToTime(x, window, width), window, width) - x);
}

export function beatTicks(bpm: number, ticksPerSecond = 1_000_000): bigint {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    return 0n;
  }
  return BigInt(Math.round((60 / bpm) * ticksPerSecond));
}

/** Seconds until tempo, meter, and phase are all set. A BPM alone does not draw bars. */
export function rulerMarks(window: TimeWindow, grid: KnownGrid | null, ticksPerSecond = 1_000_000): RulerMark[] {
  const span = window.end - window.start;
  if (span <= 0n) {
    return [];
  }
  if (grid === null || !(grid.bpm > 0) || !(grid.beatsPerBar >= 2) || grid.phase === undefined) {
    return secondMarks(window, ticksPerSecond);
  }
  const beat = beatTicks(grid.bpm, ticksPerSecond);
  if (beat <= 0n) {
    return secondMarks(window, ticksPerSecond);
  }
  const marks: RulerMark[] = [];
  let index = 0n;
  if (window.start > grid.phase) {
    index = (window.start - grid.phase) / beat;
    if (grid.phase + index * beat < window.start) {
      index += 1n;
    }
  } else if (window.start < grid.phase) {
    const delta = grid.phase - window.start;
    index = -(delta / beat + (delta % beat === 0n ? 0n : 1n));
  }
  for (let guard = 0; guard < 4000; guard += 1) {
    const time = grid.phase + index * beat;
    if (time > window.end) {
      break;
    }
    if (time >= window.start) {
      const bar = index % BigInt(grid.beatsPerBar) === 0n;
      const barNumber = index / BigInt(grid.beatsPerBar) + 1n;
      marks.push({
        time,
        kind: bar ? "bar" : "beat",
        label: bar ? String(barNumber) : "",
      });
    }
    index += 1n;
  }
  return marks;
}

function secondMarks(window: TimeWindow, ticksPerSecond: number): RulerMark[] {
  const step = BigInt(Math.round(ticksPerSecond));
  if (step <= 0n) {
    return [];
  }
  const spanSec = Number(window.end - window.start) / ticksPerSecond;
  const every = spanSec > 20 ? 5n : 1n;
  const marks: RulerMark[] = [];
  let time = window.start >= 0n ? window.start - (window.start % step) : window.start;
  if (time < window.start) {
    time += step;
  }
  for (let guard = 0; guard < 400 && time <= window.end; guard += 1) {
    const index = time / step;
    marks.push({
      time,
      kind: "second",
      label: index % every === 0n ? index.toString() + "s" : "",
    });
    time += step;
  }
  return marks;
}

export function framePhrase(historyStart: bigint, loopStart: bigint, loopEnd: bigint): TimeWindow {
  const span = loopEnd > loopStart ? loopEnd - loopStart : 1n;
  const context = span / 10n;
  let start = loopStart - context;
  if (start < historyStart) {
    start = historyStart;
  }
  const end = loopEnd > start ? loopEnd : start + 1n;
  return { start, end };
}

export function zoomWindow(window: TimeWindow, factor: number, anchor: bigint, minSpan: bigint, maxSpan: bigint): TimeWindow {
  const span = window.end - window.start;
  if (span <= 0n || !(factor > 0)) {
    return window;
  }
  let next = BigInt(Math.round(Number(span) * factor));
  if (next < minSpan) {
    next = minSpan;
  }
  if (next > maxSpan) {
    next = maxSpan;
  }
  const offset = anchor - window.start;
  const ratio = Number(offset) / Number(span);
  let start = anchor - BigInt(Math.round(ratio * Number(next)));
  if (start < 0n) {
    start = 0n;
  }
  return { start, end: start + next };
}

export function panWindow(window: TimeWindow, delta: bigint, floor: bigint): TimeWindow {
  const span = window.end > window.start ? window.end - window.start : 1n;
  let start = window.start + delta;
  if (start < floor) {
    start = floor;
  }
  return { start, end: start + span };
}

export function pitchToY(pitch: number, topPitch: number, rowHeight: number): number {
  return (topPitch - pitch) * rowHeight;
}

export function yToPitch(y: number, topPitch: number, rowHeight: number): number {
  if (!(rowHeight > 0)) {
    return topPitch;
  }
  return topPitch - Math.floor(y / rowHeight);
}

export function noteBox(start: bigint, end: bigint, pitch: number, window: TimeWindow, width: number, topPitch: number, rowHeight: number): { x: number; width: number; y: number; height: number } {
  const x = timeToX(start, window, width);
  const right = timeToX(end > start ? end : start, window, width);
  return { x, width: Math.max(0, right - x), y: pitchToY(pitch, topPitch, rowHeight), height: Math.max(4, rowHeight - 2) };
}

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function pitchLabel(pitch: number): string {
  const name = NAMES[((pitch % 12) + 12) % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return name + octave;
}
