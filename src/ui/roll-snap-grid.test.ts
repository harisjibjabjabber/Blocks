import { describe, expect, it } from "vitest";
import { visibleSnapGrid } from "./roll-snap-grid";
import { snapTime } from "./snap";
import type { KnownGrid } from "./roll-time";

const grid: KnownGrid = { bpm: 120, beatsPerBar: 4, phase: 0n };
describe("visible snap divisions", () => {
  it("shows exact triplets without cumulative rounding drift", () => {
    const division = { kind: "note", numerator: 1, denominator: 8, triplet: true } as const;
    const points = visibleSnapGrid({ start: 0n, end: 1_000_000n }, grid, division, 900);
    expect(points).toEqual([0n, 166_667n, 333_333n, 500_000n, 666_667n, 833_333n, 1_000_000n]);
    for (const point of points) expect(snapTime(point, grid, division)).toBe(point);
  });
  it("uses meter-aware bars and custom whole-note fractions", () => {
    const three: KnownGrid = { ...grid, beatsPerBar: 3, phase: 100_000n };
    expect(visibleSnapGrid({ start: 0n, end: 4_000_000n }, three, { kind: "bar", bars: 2 }, 800)).toEqual([100_000n, 3_100_000n]);
    expect(visibleSnapGrid({ start: 0n, end: 2_000_000n }, grid, { kind: "note", numerator: 3, denominator: 8 }, 800)).toEqual([0n, 750_000n, 1_500_000n]);
  });
  it("includes the visible rounded lattice point at a panned boundary", () => {
    const division = { kind: "note", numerator: 1, denominator: 8, triplet: true } as const;
    expect(visibleSnapGrid({ start: 333_333n, end: 500_000n }, grid, division, 500)).toEqual([333_333n, 500_000n]);
    expect(visibleSnapGrid({ start: 0n, end: 500_000n }, { ...grid, phase: 500_000n }, division, 500)).toEqual([0n, 166_667n, 333_333n, 500_000n]);
  });
  it("suppresses crowded lines without changing snap and returns them after zoom", () => {
    const division = { kind: "note", numerator: 1, denominator: 64 } as const;
    expect(visibleSnapGrid({ start: 0n, end: 4_000_000n }, grid, division, 390)).toEqual([]);
    expect(snapTime(40_000n, grid, division)).toBe(31_250n);
    expect(visibleSnapGrid({ start: 0n, end: 250_000n }, grid, division, 390)).toHaveLength(9);
  });
  it("draws no lattice for free time, off or invalid viewport", () => {
    const division = { kind: "note", numerator: 1, denominator: 16 } as const;
    expect(visibleSnapGrid({ start: 0n, end: 1_000_000n }, null, division, 500)).toEqual([]);
    expect(visibleSnapGrid({ start: 0n, end: 1_000_000n }, grid, { kind: "off" }, 500)).toEqual([]);
    expect(visibleSnapGrid({ start: 0n, end: 0n }, grid, division, 500)).toEqual([]);
  });
});
