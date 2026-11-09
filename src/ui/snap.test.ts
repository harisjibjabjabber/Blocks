import { describe, expect, it } from "vitest";
import type { KnownGrid } from "./roll-time";
import { DEFAULT_SNAP, SNAP_PRESETS, snapIndexAt, snapMoveStart, snapPointAt, snapStep, snapTime, type SnapDivision } from "./snap";

const quarter: SnapDivision = { kind: "note", numerator: 1, denominator: 4 };
const eighthTriplet: SnapDivision = { kind: "note", numerator: 1, denominator: 8, triplet: true };
const bar: SnapDivision = { kind: "bar", bars: 1 };
const grid = (bpm = 120, phase = 0n, beatsPerBar = 4): KnownGrid => ({ bpm, phase, beatsPerBar });

describe("musical snap divisions", () => {
  it.each([
    [90, 666_667n, 2_666_667n],
    [120, 500_000n, 2_000_000n],
    [140, 428_571n, 1_714_286n],
  ])("uses the tempo and meter at %s BPM", (bpm, beat, measure) => {
    expect(snapStep(grid(bpm), quarter)).toBe(beat);
    expect(snapPointAt(1n, grid(bpm), bar)).toBe(measure);
    expect(snapTime(measure + 7_000n, grid(bpm), bar)).toBe(measure);
  });

  it("offers straight and triplet presets without treating a bar as a whole note", () => {
    expect(SNAP_PRESETS.map(preset => preset.id)).toEqual(["off", "bar", "1/2", "1/4", "1/8", "1/16", "1/32", "1/64", "1/2t", "1/4t", "1/8t", "1/16t", "1/32t", "1/64t"]);
    expect(snapStep(grid(), DEFAULT_SNAP)).toBe(125_000n);
    expect(snapStep(grid(120, 0n, 3), bar)).toBe(1_500_000n);
    expect(snapStep(grid(120, 0n, 3), { kind: "bar", bars: 2 })).toBe(3_000_000n);
  });

  it("anchors notes, bars and negative pickups to the declared phase", () => {
    const phased = grid(120, 100_000n);
    expect(snapTime(2_085_000n, phased, bar)).toBe(2_100_000n);
    expect(snapTime(-385_000n, phased, quarter)).toBe(-400_000n);
    expect(snapTime(-150_000n, phased, quarter)).toBe(-400_000n); // negative half-step
    expect(snapTime(350_000n, phased, quarter)).toBe(600_000n); // positive half-step
    expect(snapIndexAt(99_999n, phased, quarter)).toBe(-1n);
  });

  it("lands grid moves exactly on a bar while optional offset mode keeps expression", () => {
    const phased = grid(120, 100_000n);
    expect(snapMoveStart(125_000n, 1_970_000n, phased, bar, "grid")).toBe(2_100_000n);
    expect(snapMoveStart(125_000n, 1_970_000n, phased, bar, "offset")).toBe(2_125_000n);
    expect(snapMoveStart(125_000n, 1_970_000n, phased, bar)).toBe(2_100_000n);
  });

  it("rounds each triplet from the phase, without accumulated microsecond drift", () => {
    expect([0n, 1n, 2n, 3n].map(index => snapPointAt(index, grid(), eighthTriplet))).toEqual([0n, 166_667n, 333_333n, 500_000n]);
    expect(snapPointAt(6000n, grid(), eighthTriplet)).toBe(1_000_000_000n);
    expect(snapTime(1_000_000_120n, grid(), eighthTriplet)).toBe(1_000_000_000n);
    expect(snapPointAt(7000n, grid(140), eighthTriplet)).toBe(1_000_000_000n);
    expect(snapPointAt(4500n, grid(90), eighthTriplet)).toBe(1_000_000_000n);
    for (const bpm of [90, 120, 140]) {
      const phased = grid(bpm, 91_337n);
      for (const index of [-10n, -2n, -1n, 0n, 1n, 2n, 10n, 7000n]) {
        const point = snapPointAt(index, phased, eighthTriplet)!;
        expect(snapTime(point, phased, eighthTriplet)).toBe(point);
        expect(snapIndexAt(point, phased, eighthTriplet)).toBe(index);
        expect(snapIndexAt(point - 1n, phased, eighthTriplet)).toBe(index - 1n);
      }
    }
  });

  it("supports arbitrary positive note fractions and decimal tempos", () => {
    expect(snapStep(grid(), { kind: "note", numerator: 3, denominator: 8 })).toBe(750_000n);
    expect(snapPointAt(6n, grid(), { kind: "note", numerator: 1, denominator: 12 })).toBe(1_000_000n);
    expect(snapPointAt(199n, grid(99.5), quarter)).toBe(120_000_000n);
    expect(snapTime(3_010_000n, grid(), { kind: "note", numerator: 3, denominator: 8 })).toBe(3_000_000n);
  });

  it("leaves free time and Off unmodified and rejects invalid fractions safely", () => {
    const off: SnapDivision = { kind: "off" };
    expect(snapStep(grid(), off)).toBeNull();
    expect(snapTime(-12_345n, grid(), off)).toBe(-12_345n);
    expect(snapMoveStart(100n, 37n, grid(), off)).toBe(137n);
    expect(snapTime(123_456n, null, quarter)).toBe(123_456n);
    for (const division of [
      { kind: "note", numerator: 1, denominator: 0 },
      { kind: "note", numerator: -1, denominator: 4 },
      { kind: "note", numerator: 1.5, denominator: 4 },
      { kind: "bar", bars: Infinity },
    ] as SnapDivision[]) {
      expect(snapStep(grid(), division)).toBeNull();
      expect(snapTime(123n, grid(), division)).toBe(123n);
    }
    expect(snapStep(grid(NaN), quarter)).toBeNull();
  });
});
