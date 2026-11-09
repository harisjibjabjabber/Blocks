import type { RollNote } from "./roll-notes";
import { noteBox, type KnownGrid, type TimeWindow } from "./roll-time";
import { snapIndexAt, snapPointAt, snapStep, snapTime, type SnapDivision } from "./snap";

export function nearestBoundary(x: number, startX: number, endX: number, hitWidth = 48): "start" | "end" | null {
  const start = Math.abs(x - startX), end = Math.abs(x - endX);
  return Math.min(start, end) <= hitWidth / 2 ? start <= end ? "start" : "end" : null;
}

export function rangeFromDrag(anchor: bigint, current: bigint, floor: bigint, ceiling: bigint, grid: KnownGrid | null, division: SnapDivision, bypass = false): { start: bigint; end: bigint } | null {
  const clamp = (time: bigint) => time < floor ? floor : time > ceiling ? ceiling : time;
  if (clamp(anchor) === clamp(current)) return null;
  const first = anchor < current ? anchor : current;
  const last = anchor < current ? current : anchor;
  const start = bypass ? clamp(first) : snapRangeStart(first, floor, ceiling, grid, division);
  const end = bypass ? clamp(last) : boundedSnap(last, floor, ceiling, grid, division);
  return start !== null && end !== null && start < end ? { start, end } : null;
}

/** The retained tape's first tick remains reachable even when it precedes the
 * first permitted grid point. This exception is only for recovering a range
 * start at the tape edge; note edits and end markers keep ordinary snapping. */
export function snapRangeStart(time: bigint, minimum: bigint, maximum: bigint | null, grid: KnownGrid | null, division: SnapDivision): bigint | null {
  if (maximum !== null && maximum < minimum) return null;
  return time <= minimum ? minimum : boundedSnap(time, minimum, maximum, grid, division);
}

/** Clamp to an available grid point, never to an off-grid boundary tick. */
export function boundedSnap(time: bigint, minimum: bigint, maximum: bigint | null, grid: KnownGrid | null, division: SnapDivision): bigint | null {
  if (maximum !== null && maximum < minimum) return null;
  if (snapStep(grid, division) === null) return maximum !== null && time > maximum ? maximum : time < minimum ? minimum : time;
  let point = snapTime(time, grid, division);
  if (point < minimum) {
    const index = snapIndexAt(minimum, grid, division)!;
    const floor = snapPointAt(index, grid, division)!;
    point = floor < minimum ? snapPointAt(index + 1n, grid, division)! : floor;
  }
  if (maximum !== null && point > maximum) point = snapPointAt(snapIndexAt(maximum, grid, division)!, grid, division)!;
  return point >= minimum && (maximum === null || point <= maximum) ? point : null;
}

export type SelectionBox = { x: number; y: number; width: number; height: number };
export function notesInMarquee(notes: readonly RollNote[], selection: SelectionBox, view: TimeWindow, width: number, top: number, row: number): string[] {
  return notes.filter(note => {
    const box = noteBox(note.start, note.end, note.pitch, view, width, top, row);
    return box.x <= selection.x + selection.width && box.x + Math.max(8, box.width) >= selection.x &&
      box.y <= selection.y + selection.height && box.y + box.height >= selection.y;
  }).map(note => note.id);
}

export interface RollTap {
  time: number; x: number; y: number; pitch: number;
  targetId: string | null; pointerType: string;
}

/** Recognise two completed taps on the same musical target. A consumed pair
 * cannot become a third-click action; cancellation/navigation clears history. */
export class RollTapTracker {
  private previous: RollTap | null = null;
  consume(tap: RollTap): boolean {
    const previous = this.previous;
    this.previous = null;
    if (!previous || previous.pointerType !== tap.pointerType || previous.targetId !== tap.targetId || previous.pitch !== tap.pitch) return false;
    const delay = tap.time - previous.time;
    const tolerance = tap.pointerType === "touch" ? 18 : 6;
    return delay >= 0 && delay <= 350 && Math.hypot(tap.x - previous.x, tap.y - previous.y) <= tolerance;
  }
  record(tap: RollTap) { this.previous = tap; }
  clear() { this.previous = null; }
}

export function doubleTapDeletes(pointerType: string): boolean {
  // Touch retains a non-destructive selection gesture; Erase remains explicit.
  return pointerType !== "touch";
}

export function chordSelection(notes: readonly RollNote[], anchorId: string, tolerance: bigint): string[] {
  const anchor = notes.find(note => note.id === anchorId);
  if (!anchor) return [];
  return notes.filter(note => {
    const distance = note.start - anchor.start;
    return (distance < 0n ? -distance : distance) <= tolerance;
  }).map(note => note.id).filter(id => id !== anchorId).concat(anchorId);
}

export function moveSelection(notes: readonly RollNote[], ids: readonly string[], anchorId: string, start: bigint, pitch: number): RollNote[] {
  const selected = new Set(ids);
  const group = notes.filter(note => selected.has(note.id));
  const anchor = group.find(note => note.id === anchorId);
  if (!anchor || !group.length) return [...notes];
  let delta = start - anchor.start;
  const earliest = group.reduce((min, note) => note.start < min ? note.start : min, group[0].start);
  if (earliest + delta < 0n) delta = -earliest;
  const lowest = Math.min(...group.map(note => note.pitch));
  const highest = Math.max(...group.map(note => note.pitch));
  const semitones = Math.max(-lowest, Math.min(127 - highest, pitch - anchor.pitch));
  return notes.map(note => selected.has(note.id) ? { ...note, start: note.start + delta, end: note.end + delta, pitch: note.pitch + semitones } : note);
}

export function resizeSelection(notes: readonly RollNote[], ids: readonly string[], anchorId: string, end: bigint): RollNote[] {
  const selected = new Set(ids);
  const group = notes.filter(note => selected.has(note.id));
  const anchor = group.find(note => note.id === anchorId);
  if (!anchor || !group.length) return [...notes];
  const shortest = group.reduce((min, note) => note.end - note.start < min ? note.end - note.start : min, group[0].end - group[0].start);
  const requested = end - anchor.end;
  const delta = requested < 1n - shortest ? 1n - shortest : requested;
  return notes.map(note => selected.has(note.id) ? { ...note, end: note.end + delta } : note);
}

export function scaleSelectionVelocity(notes: readonly RollNote[], ids: readonly string[], anchorId: string, velocity: number): RollNote[] {
  const selected = new Set(ids);
  const anchor = notes.find(note => note.id === anchorId && selected.has(note.id));
  if (!anchor) return [...notes];
  const factor = Math.max(1, Math.min(127, velocity)) / Math.max(1, anchor.velocity);
  return notes.map(note => selected.has(note.id) ? { ...note, velocity: Math.max(1, Math.min(127, Math.round(note.velocity * factor))) } : note);
}

export function isBlackKey(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
}

/** White keys fill half of each neighbouring accidental row; black keys overlay them.
 * The hit target remains the entire semitone row, independent of painted geometry. */
export function keyShape(pitch: number, top: number, row: number) {
  const black = isBlackKey(pitch);
  const above = !black && pitch < 127 && isBlackKey(pitch + 1) ? row / 2 : 0;
  const below = !black && pitch > 0 && isBlackKey(pitch - 1) ? row / 2 : 0;
  return { top: (top - pitch) * row - above, height: row + above + below, black };
}

export function sameNotes(a: readonly RollNote[], b: readonly RollNote[]): boolean {
  return a.length === b.length && a.every((n, i) => {
    const m = b[i];
    return n.id === m.id && n.pitch === m.pitch && n.start === m.start && n.end === m.end &&
      n.velocity === m.velocity && n.channel === m.channel && n.sourceOnId === m.sourceOnId && n.sourceOffId === m.sourceOffId;
  });
}

let drawnSequence = 0;
export function nextDrawId(notes: readonly RollNote[]): string {
  let id: string;
  do { id = `draw-${++drawnSequence}`; } while (notes.some(note => note.id === id));
  return id;
}

/** One gesture, one optional commit. Preview never edits its immutable baseline. */
export class RollTransaction {
  readonly baseline: readonly RollNote[];
  private next: RollNote[] | null = null;
  private active = true;
  constructor(notes: readonly RollNote[]) { this.baseline = notes.map(note => ({ ...note })); }
  preview(notes: RollNote[]) { if (this.active) this.next = notes; }
  cancel() { this.active = false; this.next = null; }
  commit(): RollNote[] | null {
    if (!this.active) return null;
    this.active = false;
    return this.next && !sameNotes(this.baseline, this.next) ? this.next : null;
  }
}
