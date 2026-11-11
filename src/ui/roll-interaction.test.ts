import { describe, expect, it } from "vitest";
import { boundedSnap, chordSelection, doubleTapDeletes, isBlackKey, keyShape, moveSelection, nearestBoundary, nextDrawId, notesInMarquee, rangeFromDrag, resizeSelection, scaleSelectionVelocity, snapRangeStart, RollTapTracker, RollTransaction, type RollTap } from "./roll-interaction";
import { snapIndexAt, snapPointAt } from "./snap";
import { pitchLabel, pitchToY } from "./roll-time";
import type { RollNote } from "./roll-notes";

const original: RollNote = { id: "raw-1", channel: 0, pitch: 60, start: 30_000n, end: 520_000n, velocity: 96, sourceOnId: "on-1", sourceOffId: "off-1" };

describe("group editing", () => {
  const second = { ...original, id: "raw-2", pitch: 65, start: 50_000n, end: 150_000n, velocity: 48 };
  const outside = { ...original, id: "raw-3", pitch: 72, start: 900_000n, end: 1_000_000n };
  const notes = [original, second, outside];
  const ids = [original.id, second.id];
  it("moves as one group preserving relative timing, pitch and note lengths at boundaries", () => {
    const moved = moveSelection(notes, ids, second.id, 0n, 127);
    expect(moved[0]).toMatchObject({ start: 0n, end: 490_000n, pitch: 122 });
    expect(moved[1]).toMatchObject({ start: 20_000n, end: 120_000n, pitch: 127 });
    expect(moved[2]).toBe(outside);
    expect(second.start).toBe(50_000n); expect(original.pitch).toBe(60);
  });
  it("resizes by a common end delta without collapsing the shortest note", () => {
    const resized = resizeSelection(notes, ids, original.id, 1n);
    expect(resized[0].end).toBe(420_001n);
    expect(resized[1].end).toBe(50_001n);
    expect(resized[2]).toBe(outside);
  });
  it("scales group dynamics proportionally and bounds the result", () => {
    expect(scaleSelectionVelocity(notes, ids, original.id, 48).map(n => n.velocity)).toEqual([48, 24, 96]);
    expect(scaleSelectionVelocity(notes, ids, second.id, 127).map(n => n.velocity)).toEqual([127, 127, 96]);
  });
  it("selects a nearby chord with the touched note as anchor", () => {
    expect(chordSelection(notes, original.id, 62_500n)).toEqual([second.id, original.id]);
    expect(chordSelection(notes, original.id, 10_000n)).toEqual([original.id]);
  });
  it("uses the shared time and pitch transform for marquee intersection", () => {
    expect(notesInMarquee(notes, { x: 0, y: 90, width: 550, height: 180 }, { start: 0n, end: 1_000_000n }, 1000, 72, 20)).toEqual(ids);
    expect(notesInMarquee(notes, { x: 600, y: 90, width: 100, height: 180 }, { start: 0n, end: 1_000_000n }, 1000, 72, 20)).toEqual([]);
  });
});

describe("snapped boundary constraints", () => {
  const grid = { bpm: 140, beatsPerBar: 4, phase: 100_000n };
  const division = { kind: "note", numerator: 1, denominator: 8, triplet: true } as const;
  it("chooses a valid lattice point instead of clamping to an off-grid minimum", () => {
    const result = boundedSnap(-1n, 110_000n, null, grid, division)!;
    expect(result).toBe(242_857n);
    expect(snapPointAt(snapIndexAt(result, grid, division)!, grid, division)).toBe(result);
  });
  it("keeps a loop boundary inside its interval and declines an interval with no grid point", () => {
    expect(boundedSnap(999_999n, 0n, 250_000n, grid, division)).toBe(242_857n);
    expect(boundedSnap(150_000n, 110_000n, 200_000n, grid, division)).toBeNull();
  });
  it("free-time clamps only to bounds, without adding quantisation", () => {
    expect(boundedSnap(111_111n, 0n, 200_000n, null, division)).toBe(111_111n);
    expect(boundedSnap(-1n, 0n, null, grid, { kind: "off" })).toBe(0n);
  });
});

describe("ruler range gestures", () => {
  const grid = { bpm: 120, beatsPerBar: 4, phase: 100_000n };
  const division = { kind: "note", numerator: 1, denominator: 4 } as const;
  it("resolves overlapping48px endpoint targets by nearest endpoint", () => {
    expect(nearestBoundary(105, 100, 120)).toBe("start");
    expect(nearestBoundary(115, 100, 120)).toBe("end");
    expect(nearestBoundary(110, 100, 120)).toBe("start");
    expect(nearestBoundary(150, 100, 120)).toBeNull();
  });
  it("creates the same snapped range in either drag direction", () => {
    expect(rangeFromDrag(130_000n, 1_080_000n, 0n, 2_000_000n, grid, division)).toEqual({ start: 100_000n, end: 1_100_000n });
    expect(rangeFromDrag(1_080_000n, 130_000n, 0n, 2_000_000n, grid, division)).toEqual({ start: 100_000n, end: 1_100_000n });
  });
  it("rejects zero ranges and preserves a snapped end while recovering the tape floor", () => {
    expect(rangeFromDrag(120_000n, 200_000n, 0n, 2_000_000n, grid, division)).toBeNull();
    expect(rangeFromDrag(0n, 2_000_000n, 110_000n, 1_700_000n, grid, division)).toEqual({ start: 110_000n, end: 1_600_000n });
    expect(rangeFromDrag(2_000_000n, 0n, 110_000n, 1_700_000n, grid, division)).toEqual({ start: 110_000n, end: 1_600_000n });
    expect(rangeFromDrag(110_000n, 110_000n, 110_000n, 1_700_000n, grid, division)).toBeNull();
    expect(rangeFromDrag(0n, 100_000n, 110_000n, 1_700_000n, grid, division)).toBeNull();
  });
  it("Alt and free-time retain the exact drag positions within history and visible end", () => {
    const expected = { start: 123_456n, end: 987_654n };
    expect(rangeFromDrag(expected.start, expected.end, 0n, 2_000_000n, grid, division, true)).toEqual(expected);
    expect(rangeFromDrag(expected.start, expected.end, 0n, 2_000_000n, null, division)).toEqual(expected);
  });
});

describe("recovering a phrase prefix with snapping enabled", () => {
  const grid = { bpm: 120, beatsPerBar: 4, phase: 1_000_000n };
  const bars = { kind: "bar", bars: 1 } as const;
  const earliestNote = 30_000n;
  it("lets a start grip reach the first note despite a later inferred downbeat", () => {
    expect(snapRangeStart(earliestNote, earliestNote, 3_000_000n, grid, bars)).toBe(earliestNote);
    expect(snapRangeStart(-1_000_000n, earliestNote, 3_000_000n, grid, bars)).toBe(earliestNote);
    // A normal end marker or note edit still uses the first valid lattice point.
    expect(boundedSnap(earliestNote, earliestNote, 3_000_000n, grid, bars)).toBe(grid.phase);
  });
  it("recovers the floor on an ArrowLeft step and rejoins the grid on ArrowRight", () => {
    const previous = snapPointAt(snapIndexAt(grid.phase, grid, bars)! - 1n, grid, bars)!;
    const recovered = snapRangeStart(previous, earliestNote, 3_000_000n, grid, bars)!;
    expect(recovered).toBe(earliestNote);
    const next = snapPointAt(snapIndexAt(recovered, grid, bars)! + 1n, grid, bars)!;
    expect(snapRangeStart(next, earliestNote, 3_000_000n, grid, bars)).toBe(grid.phase);
  });
  it("does not create off-grid starts elsewhere or permit an invalid interval", () => {
    expect(snapRangeStart(200_000n, earliestNote, 3_000_000n, grid, bars)).toBe(grid.phase);
    expect(snapRangeStart(0n, earliestNote, earliestNote - 1n, grid, bars)).toBeNull();
  });
});

describe("smart pointer double taps", () => {
  const tap: RollTap = { time: 100, x: 120, y: 48, pitch: 60, targetId: null, pointerType: "mouse" };
  it("requires a completed first tap and consumes a pair once", () => {
    const tracker = new RollTapTracker();
    expect(tracker.consume(tap)).toBe(false);
    tracker.record(tap);
    expect(tracker.consume({ ...tap, time: 300 })).toBe(true);
    expect(tracker.consume({ ...tap, time: 400 })).toBe(false);
  });
  it("does not combine taps on different notes, pitch rows, or pointer types", () => {
    for (const change of [{ targetId: "another" }, { pitch: 61 }, { pointerType: "touch" }, { x: 130 }, { time: 451 }, { time: 99 }]) {
      const tracker = new RollTapTracker(); tracker.record(tap);
      expect(tracker.consume({ ...tap, time: 200, ...change })).toBe(false);
    }
  });
  it("allows normal touch placement jitter without making touch deletion destructive", () => {
    const tracker = new RollTapTracker(); tracker.record({ ...tap, pointerType: "touch" });
    expect(tracker.consume({ ...tap, pointerType: "touch", time: 300, x: 132, y: 51 })).toBe(true);
    expect(doubleTapDeletes("touch")).toBe(false);
    expect(doubleTapDeletes("mouse")).toBe(true);
    expect(doubleTapDeletes("pen")).toBe(true);
  });
  it("cancellation and navigation invalidate the first tap", () => {
    const tracker = new RollTapTracker(); tracker.record(tap); tracker.clear();
    expect(tracker.consume({ ...tap, time: 200 })).toBe(false);
  });
  it("a completed delete remains a single undoable transaction with raw source untouched", () => {
    const tx = new RollTransaction([original]);
    tx.preview(tx.baseline.filter(note => note.id !== original.id));
    expect(tx.commit()).toEqual([]); expect(tx.commit()).toBeNull();
    expect(original.sourceOnId).toBe("on-1"); expect(original.start).toBe(30_000n);
  });
});

describe("roll gesture transaction", () => {
  it("cancels second-touch, pointer cancellation and escape previews without a history patch", () => {
    for (const preview of [[{ ...original, pitch: 64 }], [], [{ ...original, velocity: 32 }]]) {
      const tx = new RollTransaction([original]); tx.preview(preview); tx.cancel();
      expect(tx.commit()).toBeNull();
      tx.preview([{ ...original, start: 9n }]); expect(tx.commit()).toBeNull();
      expect(original).toMatchObject({ pitch: 60, start: 30_000n, velocity: 96 });
    }
  });
  it("an erase stroke previews several hits but returns exactly one final change", () => {
    const second = { ...original, id: "raw-2", pitch: 67 };
    const tx = new RollTransaction([original, second]);
    tx.preview([second]); tx.preview([]);
    expect(tx.baseline).toEqual([original, second]); expect(tx.commit()).toEqual([]); expect(tx.commit()).toBeNull();
  });
  it("tap and return-to-origin gestures do not consume undo history", () => {
    const tap = new RollTransaction([original]); expect(tap.commit()).toBeNull();
    const move = new RollTransaction([original]); move.preview([{ ...original, pitch: 62 }]); move.preview([{ ...original }]);
    expect(move.commit()).toBeNull();
  });
  it("drawn notes at the same time and after remount cannot collide with existing IDs", () => {
    const notes = [{ ...original, id: "draw-1" }, { ...original, id: "draw-2" }];
    const first = nextDrawId(notes); const second = nextDrawId(notes);
    expect(first).not.toBe(second); expect(notes.map(n => n.id)).not.toContain(first);
  });
});

describe("keyboard uses the note pitch transform", () => {
  it("marks MIDI60 as middle C and paints five black keys per octave", () => {
    expect(pitchLabel(60)).toBe("C4");
    expect(Array.from({ length: 12 }, (_, i) => 60 + i).filter(isBlackKey)).toEqual([61, 63, 66, 68, 70]);
  });
  it("aligns black keys and full row targets at all three row scales", () => {
    for (const row of [16, 24, 32]) for (let pitch = 48; pitch < 84; pitch++) {
      const shape = keyShape(pitch, 84, row);
      const noteRow = pitchToY(pitch, 84, row);
      if (shape.black) { expect(shape.top).toBe(noteRow); expect(shape.height).toBe(row); }
      else { expect(shape.top).toBeLessThanOrEqual(noteRow); expect(shape.top + shape.height).toBeGreaterThanOrEqual(noteRow + row); }
    }
  });
});


it("keeps narrow edge grips separate and inside the plot", async () => {
  const { rangeGripPositions } = await import("./roll-interaction");
  for (const [start, end] of [[0, 8], [280, 290], [100, 105]]) {
    const grips = rangeGripPositions(start, end, 300);
    expect(grips.start).toBeGreaterThanOrEqual(0);
    expect(grips.end - grips.start).toBeGreaterThanOrEqual(48);
    expect(grips.end + 48).toBeLessThanOrEqual(300);
  }
});
