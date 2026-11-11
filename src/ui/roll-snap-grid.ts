import type { KnownGrid, TimeWindow } from "./roll-time";
import { snapIndexAt, snapPointAt, snapStep, type SnapDivision } from "./snap";

/** The visible snap lattice is exactly the editing lattice. Fine lines disappear
 * when crowded; zooming never changes the selected division or note positions. */
export function visibleSnapGrid(view: TimeWindow, grid: KnownGrid | null, division: SnapDivision, width: number): bigint[] {
  const span = view.end - view.start;
  const step = snapStep(grid, division);
  if (span <= 0n || !(width > 0) || step === null || step <= 0n) return [];
  if (Number(step) / Number(span) * width < 10) return [];
  let index = snapIndexAt(view.start, grid, division);
  if (index === null) return [];
  const points: bigint[] = [];
  for (let guard = 0; guard < 256; guard++, index++) {
    const time = snapPointAt(index, grid, division);
    if (time === null || time > view.end) break;
    if (time >= view.start && points[points.length - 1] !== time) points.push(time);
  }
  return points;
}

/** Reveal the selected lattice at usable spacing without changing musical bounds. */
export function snapDetailSpan(view: TimeWindow, grid: KnownGrid | null, division: SnapDivision, width: number): bigint | null {
  const step = snapStep(grid, division);
  if (step === null || step <= 0n || width <= 0) return null;
  const span = view.end - view.start;
  const readable = BigInt(Math.max(50_000, Math.floor(Number(step) * width / 18)));
  return span > readable ? readable : span < step * 2n ? step * 2n : null;
}
