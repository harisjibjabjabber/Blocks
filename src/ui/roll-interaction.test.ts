import { describe, expect, it } from "vitest";
import { isBlackKey, keyShape, nextDrawId, RollTransaction } from "./roll-interaction";
import { pitchLabel, pitchToY } from "./roll-time";
import type { RollNote } from "./roll-notes";

const original: RollNote = { id: "raw-1", channel: 0, pitch: 60, start: 30_000n, end: 520_000n, velocity: 96, sourceOnId: "on-1", sourceOffId: "off-1" };

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
