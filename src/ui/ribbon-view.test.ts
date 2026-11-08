import { describe, expect, it } from "vitest";
import { focusWindow, gripHitBox, notesInRecentWindow, nudgeWindow, placedNotes, ribbonGrid, rulerCaption, rulerMarks } from "./ribbon-view";

const TICKS = 1_000_000;

describe("ribbon viewport", () => {
  const historyStart = 0n;
  const ceiling = 90_000_000n;
  const bounds = { start: 82_000_000n, end: 88_000_000n };

  it("frames the phrase and the loop end instead of the whole history", () => {
    const window = focusWindow(historyStart, ceiling, bounds, 2_000_000n);
    expect(window.start).toBe(80_000_000n);
    expect(window.end).toBe(90_000_000n);
    expect(window.end - window.start).toBeLessThan(ceiling);
  });

  it("keeps the silent tail inside the loop end", () => {
    const lastNote = 4_800_000n;
    const loopEnd = 6_400_000n;
    const window = focusWindow(0n, loopEnd, { start: 0n, end: loopEnd }, 0n);
    expect(window.end).toBe(loopEnd);
    const placed = placedNotes([{ id: "last", scheduleElapsed: lastNote, note: 60 }], window, 112);
    expect(placed[0].xPercent).toBeLessThan(80);
    expect(placed[0].xPercent).toBeGreaterThan(70);
  });

  it("can still be pulled back to notes the first crop left outside", () => {
    let window = focusWindow(historyStart, ceiling, bounds, 2_000_000n);
    for (let step = 0; step < 50 && window.start > historyStart; step += 1) {
      window = nudgeWindow(window, "start", 2_000_000n, historyStart, ceiling);
    }
    expect(window.start).toBe(historyStart);
    expect(window.end).toBe(ceiling);
    const notes = [
      { id: "early", scheduleElapsed: 1_000_000n, note: 48 },
      { id: "phrase", scheduleElapsed: 84_000_000n, note: 64 },
    ];
    const before = notes.map((note) => note.scheduleElapsed);
    const placed = placedNotes(notes, window, 112);
    expect(placed.map((mark) => mark.id)).toEqual(["early", "phrase"]);
    expect(notes.map((note) => note.scheduleElapsed)).toEqual(before);
  });

  it("does not scale ninety seconds of history into the live ribbon", () => {
    const notes = [
      { id: "old", scheduleElapsed: 0n },
      { id: "mid", scheduleElapsed: 40_000_000n },
      { id: "now", scheduleElapsed: 90_000_000n },
    ];
    const recent = notesInRecentWindow(notes, 12_000_000n);
    expect(recent.map((note) => note.id)).toEqual(["now"]);
  });
});

describe("ribbon ruler", () => {
  const phase = 1_000_000n;
  const window = { start: phase, end: phase + 4_000_000n };

  it("draws the same bars for a proposed tempo and marks them tentative", () => {
    const grid = ribbonGrid({ tempoBpm: null, proposedTempoBpm: 60, gridLocked: false, phase });
    expect(rulerCaption(grid)).toBe("Tempo 60 · proposed");
    const marks = rulerMarks(window, grid, TICKS);
    expect(marks.filter((mark) => mark.kind === "bar").map((mark) => mark.label)).toEqual(["1", "2"]);
    expect(marks.filter((mark) => mark.kind === "beat")).toHaveLength(3);
    expect(marks.every((mark) => mark.tentative)).toBe(true);
    expect(marks.map((mark) => mark.time)).toEqual([1_000_000n, 2_000_000n, 3_000_000n, 4_000_000n, 5_000_000n]);
  });

  it("draws that grid from the same phase once the tempo is accepted", () => {
    const grid = ribbonGrid({ tempoBpm: 60, proposedTempoBpm: 60, gridLocked: true, phase });
    expect(rulerCaption(grid)).toBe("Tempo 60");
    const marks = rulerMarks(window, grid, TICKS);
    expect(marks.map((mark) => mark.time)).toEqual([1_000_000n, 2_000_000n, 3_000_000n, 4_000_000n, 5_000_000n]);
    expect(marks.every((mark) => mark.tentative)).toBe(false);
  });

  it("marks seconds in free time and does not invent a bar", () => {
    const grid = ribbonGrid({ tempoBpm: null, proposedTempoBpm: null, gridLocked: false, phase: 0n });
    expect(rulerCaption(grid)).toBe("Seconds");
    const marks = rulerMarks({ start: 0n, end: 3_000_000n }, grid, TICKS);
    expect(marks.every((mark) => mark.kind === "second")).toBe(true);
    expect(marks.map((mark) => mark.label)).toEqual(["0", "1", "2", "3"]);
  });

  it("leaves an off-grid note where it was played", () => {
    const note = { id: "late", scheduleElapsed: 1_370_000n, note: 67 };
    const placed = placedNotes([note], { start: 1_000_000n, end: 2_000_000n }, 112);
    expect(note.scheduleElapsed).toBe(1_370_000n);
    expect(placed[0].xPercent).toBeGreaterThan(30);
    expect(placed[0].xPercent).toBeLessThan(45);
  });
});

describe("ribbon grips", () => {
  it("keeps a 44px target inside the plot at either edge", () => {
    const start = gripHitBox(0, 280, 120, 44, "start", false);
    const end = gripHitBox(280, 280, 120, 44, "end", false);
    expect(start.width).toBeGreaterThanOrEqual(44);
    expect(end.width).toBeGreaterThanOrEqual(44);
    expect(start.left).toBe(0);
    expect(end.left + end.width).toBe(280);
    expect(start.left + start.width).toBeLessThanOrEqual(280);
    expect(end.left).toBeGreaterThanOrEqual(0);
  });

  it("stacks the targets when the range is only a few pixels wide", () => {
    const start = gripHitBox(140, 280, 120, 44, "start", true);
    const end = gripHitBox(144, 280, 120, 44, "end", true);
    const overlaps = start.left < end.left + end.width && end.left < start.left + start.width && start.top < end.top + end.height && end.top < start.top + start.height;
    expect(overlaps).toBe(false);
    expect(start.height).toBeGreaterThanOrEqual(44);
    expect(end.height).toBeGreaterThanOrEqual(44);
  });
});
