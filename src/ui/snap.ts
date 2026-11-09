import type { KnownGrid } from "./roll-time";

/** Note fractions are fractions of a whole note; a triplet occupies 2/3 of it. */
export type SnapDivision =
  | { kind: "off" }
  | { kind: "bar"; bars: number }
  | { kind: "note"; numerator: number; denominator: number; triplet?: boolean };
export type SnapMode = "grid" | "offset";
export const DEFAULT_SNAP: SnapDivision = { kind: "note", numerator: 1, denominator: 16 };
export const SNAP_PRESETS: readonly { id: string; label: string; division: SnapDivision }[] = [
  { id: "off", label: "Off", division: { kind: "off" } },
  { id: "bar", label: "Bar", division: { kind: "bar", bars: 1 } },
  ...[2, 4, 8, 16, 32, 64].map(denominator => ({
    id: `1/${denominator}`, label: `1/${denominator}`,
    division: { kind: "note" as const, numerator: 1, denominator },
  })),
  ...[2, 4, 8, 16, 32, 64].map(denominator => ({
    id: `1/${denominator}t`, label: `1/${denominator} T`,
    division: { kind: "note" as const, numerator: 1, denominator, triplet: true },
  })),
];

type Ratio = { numerator: bigint; denominator: bigint };
const validInteger = (n: number) => Number.isSafeInteger(n) && n > 0;

/** Preserve a finite JavaScript decimal BPM as a rational, including exponent notation. */
function decimalRatio(value: number): Ratio | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const [mantissa, exponent = "0"] = value.toString().toLowerCase().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const digits = BigInt(whole + fraction);
  const scale = fraction.length - Number(exponent);
  return scale >= 0
    ? { numerator: digits, denominator: 10n ** BigInt(scale) }
    : { numerator: digits * 10n ** BigInt(-scale), denominator: 1n };
}

function interval(grid: KnownGrid | null, division: SnapDivision): Ratio | null {
  if (!grid || division.kind === "off") return null;
  const bpm = decimalRatio(grid.bpm);
  if (!bpm) return null;
  let numerator = 60_000_000n * bpm.denominator;
  let denominator = bpm.numerator;
  if (division.kind === "bar") {
    if (!validInteger(division.bars) || !validInteger(grid.beatsPerBar)) return null;
    numerator *= BigInt(grid.beatsPerBar) * BigInt(division.bars);
  } else {
    if (!validInteger(division.numerator) || !validInteger(division.denominator)) return null;
    numerator *= 4n * BigInt(division.numerator);
    denominator *= BigInt(division.denominator);
    if (division.triplet) { numerator *= 2n; denominator *= 3n; }
  }
  // A sub-microsecond lattice cannot be represented by this scheduler's ticks.
  return numerator < denominator ? null : { numerator, denominator };
}

/** Nearest integer, with exact half-way ties away from zero. */
function roundRatio(numerator: bigint, denominator: bigint): bigint {
  const sign = numerator < 0n ? -1n : 1n;
  const magnitude = numerator < 0n ? -numerator : numerator;
  return sign * ((2n * magnitude + denominator) / (2n * denominator));
}

/** Approximate one-step duration. Do not accumulate this to generate grid points. */
export function snapStep(grid: KnownGrid | null, division: SnapDivision): bigint | null {
  const step = interval(grid, division);
  return step ? roundRatio(step.numerator, step.denominator) : null;
}

/** Each point rounds the entire exact offset, so triplets never accumulate drift. */
export function snapPointAt(index: bigint, grid: KnownGrid | null, division: SnapDivision): bigint | null {
  const step = interval(grid, division);
  return step && grid ? grid.phase + roundRatio(index * step.numerator, step.denominator) : null;
}

/** Floor index of the rounded scheduler lattice, including pickups before bar one. */
export function snapIndexAt(time: bigint, grid: KnownGrid | null, division: SnapDivision): bigint | null {
  const step = interval(grid, division);
  if (!step || !grid) return null;
  const numerator = (time - grid.phase) * step.denominator;
  const quotient = numerator / step.numerator;
  const index = numerator < 0n && numerator % step.numerator !== 0n ? quotient - 1n : quotient;
  // A point rounded down (e.g. 333333.333 -> 333333) already exists at that tick.
  const next = grid.phase + roundRatio((index + 1n) * step.numerator, step.denominator);
  return next <= time ? index + 1n : index;
}

export function snapTime(time: bigint, grid: KnownGrid | null, division: SnapDivision): bigint {
  const step = interval(grid, division);
  if (!step || !grid) return time;
  const index = roundRatio((time - grid.phase) * step.denominator, step.numerator);
  return grid.phase + roundRatio(index * step.numerator, step.denominator);
}

export function snapMoveStart(originalStart: bigint, rawDelta: bigint, grid: KnownGrid | null, division: SnapDivision, mode: SnapMode = "grid"): bigint {
  if (mode === "offset" && grid) {
    return originalStart + snapTime(rawDelta, { ...grid, phase: 0n }, division);
  }
  return snapTime(originalStart + rawDelta, grid, division);
}
