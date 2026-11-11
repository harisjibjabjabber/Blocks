import type { RangeBounds } from "./range";
import type { KnownGrid } from "./roll-time";

export type FixedBars = 4 | 8;

const isBars = (bars: number): bars is FixedBars => bars === 4 || bars === 8;
const isMeter = (beats: number) => Number.isSafeInteger(beats) && beats > 0;
function duration(bounds: RangeBounds): bigint | null {
  return typeof bounds?.start === "bigint" && typeof bounds?.end === "bigint" && bounds.end > bounds.start
    ? bounds.end - bounds.start : null;
}

/** Round the whole interval once, rather than accumulating rounded beats. */
export function barsDuration(grid: KnownGrid | null, bars: FixedBars): bigint | null {
  if (!grid || !isBars(bars) || !isMeter(grid.beatsPerBar) || !Number.isFinite(grid.bpm) || grid.bpm <= 0) return null;
  // Treat the specified decimal BPM exactly, including scientific notation.
  const [mantissa, exponent = "0"] = grid.bpm.toString().toLowerCase().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const scale = fraction.length - Number(exponent);
  let numerator = 60_000_000n * BigInt(grid.beatsPerBar) * BigInt(bars);
  let denominator = BigInt(whole + fraction);
  if (scale >= 0) numerator *= 10n ** BigInt(scale);
  else denominator *= 10n ** BigInt(-scale);
  const ticks = (2n * numerator + denominator) / (2n * denominator);
  return ticks > 0n ? ticks : null;
}

/** Infer a display tempo from an explicit duration; never clamp or retime notes. */
export function tempoForBars(bounds: RangeBounds, bars: FixedBars, beatsPerBar = 4): number | null {
  const ticks = duration(bounds);
  if (ticks === null || !isBars(bars) || !isMeter(beatsPerBar)) return null;
  const bpm = Number(60_000_000n * BigInt(beatsPerBar) * BigInt(bars)) / Number(ticks);
  return Number.isFinite(bpm) && bpm > 0 ? bpm : null;
}

/** Preserve the chosen start exactly, even when it differs from the grid phase. */
export function rangeForBars(start: bigint, grid: KnownGrid | null, bars: FixedBars): RangeBounds | null {
  const ticks = barsDuration(grid, bars);
  return typeof start === "bigint" && ticks !== null ? { start, end: start + ticks } : null;
}

/** Only identify an exact four/eight-bar interval, allowing one scheduler tick. */
export function fixedBarsForRange(bounds: RangeBounds, grid: KnownGrid | null): FixedBars | null {
  const ticks = duration(bounds);
  if (ticks === null) return null;
  for (const bars of [4, 8] as const) {
    const expected = barsDuration(grid, bars);
    if (expected !== null && ticks >= expected - 1n && ticks <= expected + 1n) return bars;
  }
  return null;
}
