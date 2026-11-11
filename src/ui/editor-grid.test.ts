import { describe, expect, it } from "vitest";
import { editorFrame, musicalPosition, rulerMarks } from "./roll-time";
import { quantisePreview, type RollNote } from "./roll-notes";

const grid = { bpm: 120, beatsPerBar: 4, phase: 1_000_000n };
describe("musical editor view and explicit quantise", () => {
  it("shows complete bars for a short free performance without changing its bounds", () => {
    const bounds = { start: 1_000_000n, end: 1_300_000n };
    const view = editorFrame(900_000n, bounds.start, bounds.end, grid, 2);
    expect(view.end).toBe(5_000_000n);
    expect(view.start).toBeLessThan(bounds.start);
    expect(rulerMarks(view, grid).filter(mark => mark.kind === "bar").map(mark => mark.label)).toEqual(["1", "2", "3"]);
    expect(bounds.end).toBe(1_300_000n);
  });
  it("names the pickup and bar/beat positions consistently", () => {
    expect(musicalPosition(750_000n, grid)).toBe("0.4");
    expect(musicalPosition(1_000_000n, grid)).toBe("1.1");
    expect(musicalPosition(1_500_000n, grid)).toBe("1.2");
    expect(musicalPosition(3_000_000n, grid)).toBe("2.1");
  });
  it("quantise strength zero preserves timing; full strength reaches grid only for selected notes", () => {
    const notes: RollNote[] = [0,1].map(i => ({ id: String(i), pitch: 60+i*4, velocity: 80, channel: 0, start: 1_510_000n+BigInt(i)*20_000n, end: 1_710_000n+BigInt(i)*20_000n, sourceOnId: String(i), sourceOffId: null }));
    const original = structuredClone(notes);
    const division = { kind: "note" as const, numerator: 1, denominator: 4 };
    expect(quantisePreview(notes, ["0"], grid, division, 0)[0].start).toBe(notes[0].start);
    const full = quantisePreview(notes, ["0"], grid, division, 100);
    expect(full).toHaveLength(1);
    expect(full[0].start).toBe(1_500_000n);
    expect(full[0].end-full[0].start).toBe(200_000n);
    expect(notes).toEqual(original);
  });
  it("swing delays the off-beat grid point while retaining note duration", () => {
    const note: RollNote = { id: "n", pitch: 60, velocity: 90, channel: 0, start: 1_250_000n, end: 1_350_000n, sourceOnId: "raw", sourceOffId: null };
    const target = quantisePreview([note], [], grid, { kind: "note", numerator: 1, denominator: 8 }, 100, 50)[0];
    expect(target.start).toBe(1_375_000n);
    expect(target.end-target.start).toBe(100_000n);
    expect(note.start).toBe(1_250_000n);
  });
});
