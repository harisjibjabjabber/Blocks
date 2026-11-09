import { describe, expect, it } from "vitest";
import type { KnownGrid } from "./roll-time";
import { barsDuration, fixedBarsForRange, rangeForBars, tempoForBars, type FixedBars } from "./loop-assist";

const grid = (bpm = 120, beatsPerBar = 4, phase = 0n): KnownGrid => ({ bpm, beatsPerBar, phase });

describe("explicit fixed-bar loop assistance", () => {
  it.each([
    [120, 4, 8_000_000n],
    [60, 4, 16_000_000n],
    [120, 8, 16_000_000n],
  ] as const)("matches %s BPM, %s bars and its inverse tempo", (bpm, bars, ticks) => {
    expect(barsDuration(grid(bpm), bars)).toBe(ticks);
    expect(tempoForBars({ start: 93_137n, end: 93_137n + ticks }, bars)).toBe(bpm);
    expect(fixedBarsForRange({ start: 93_137n, end: 93_137n + ticks }, grid(bpm))).toBe(bars);
  });

  it("rounds the entire rational interval once and supports fractional BPM and meter", () => {
    expect(barsDuration(grid(140), 4)).toBe(6_857_143n);
    expect(barsDuration(grid(99.5), 4)).toBe(9_648_241n);
    expect(barsDuration(grid(120, 3), 4)).toBe(6_000_000n);
    expect(barsDuration(grid(128, 3), 8)).toBe(11_250_000n);
    expect(tempoForBars({ start: 1n, end: 6_000_001n }, 4, 3)).toBe(120);
    expect(tempoForBars({ start: 0n, end: 7_000_000n }, 4)).toBeCloseTo(137.14285714285714, 12);
    // Exact half-tick rounds up; multiplying rounded individual beats is incorrect.
    expect(barsDuration(grid(2048), 4)).toBe(468_750n);
    expect(barsDuration(grid(4096), 4)).toBe(234_375n);
    expect(barsDuration(grid(8192), 4)).toBe(117_188n);
    expect(barsDuration(grid(1e9), 4)).toBe(1n);
  });

  it("does not clamp inferred tempos to a UI range or silently choose a nearby bar count", () => {
    expect(tempoForBars({ start: 0n, end: 120_000_000n }, 4)).toBe(8);
    expect(tempoForBars({ start: 0n, end: 1_000_000n }, 4)).toBe(960);
    expect(fixedBarsForRange({ start: 0n, end: 12_000_000n }, grid())).toBeNull();
  });

  it("anchors a fresh range to the requested start without mutating grid or bounds", () => {
    const source = Object.freeze(grid(120, 4, 2_000_000n));
    const bounds = Object.freeze({ start: 91_337n, end: 8_091_337n });
    expect(rangeForBars(bounds.start, source, 4)).toEqual(bounds);
    expect(rangeForBars(-91_337n, source, 4)).toEqual({ start: -91_337n, end: 7_908_663n });
    expect(tempoForBars(bounds, 4)).toBe(120);
    expect(fixedBarsForRange(bounds, source)).toBe(4);
    expect(source).toEqual(grid(120, 4, 2_000_000n));
    expect(bounds).toEqual({ start: 91_337n, end: 8_091_337n });
  });

  it("recognises fixed bars only within one microsecond", () => {
    for (const bars of [4, 8] as const) {
      const ticks = barsDuration(grid(99.5), bars)!;
      for (const offset of [-1n, 0n, 1n]) expect(fixedBarsForRange({ start: 100n, end: 100n + ticks + offset }, grid(99.5))).toBe(bars);
      for (const offset of [-2n, 2n]) expect(fixedBarsForRange({ start: 100n, end: 100n + ticks + offset }, grid(99.5))).toBeNull();
    }
  });

  it("returns unavailable for invalid tempo, meter, bar count or nonpositive duration", () => {
    for (const bpm of [0, -120, NaN, Infinity]) expect(barsDuration(grid(bpm), 4)).toBeNull();
    for (const beats of [0, -1, 3.5, NaN]) {
      expect(barsDuration(grid(120, beats), 4)).toBeNull();
      expect(tempoForBars({ start: 0n, end: 1n }, 4, beats)).toBeNull();
    }
    expect(barsDuration(null, 4)).toBeNull();
    expect(rangeForBars(0n, null, 4)).toBeNull();
    expect(barsDuration(grid(), 3 as FixedBars)).toBeNull();
    for (const bounds of [{ start: 1n, end: 1n }, { start: 2n, end: 1n }]) {
      expect(tempoForBars(bounds, 4)).toBeNull();
      expect(fixedBarsForRange(bounds, grid())).toBeNull();
    }
  });
});
