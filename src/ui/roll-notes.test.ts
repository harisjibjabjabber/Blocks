import { describe, expect, it } from "vitest";
import type { CapturedEvent } from "../domain/capture";
import { applyPreview, drawNote, eraseNote, moveNote, notesFromEvents, quantisePreview, resizeNote, setVelocity, workingPlayback, type RollNote } from "./roll-notes";
import type { KnownGrid } from "./roll-time";

function event(id: string, kind: CapturedEvent["kind"], note: number, velocity: number, at: bigint, controller = 0, value = 0): CapturedEvent {
  return {
    id,
    domain: "web-performance-us",
    sequence: 1n,
    portId: "t",
    sessionId: "t",
    channel: 0,
    kind,
    note,
    velocity,
    controller,
    value,
    sourceTimestamp: at,
    receiptTimestamp: at,
    missingSourceTimestamp: false,
    raw: null,
    origin: "raw-midi",
    elapsedSource: at,
    elapsedReceipt: at,
    scheduleElapsed: at,
  };
}

describe("working notes", () => {
  const source = [
    event("c-on", "note-on", 60, 90, 0n),
    event("e-on", "note-on", 64, 80, 20_000n),
    event("g-on", "note-on", 67, 70, 45_000n),
    event("pedal", "cc", 0, 0, 10_000n, 64, 127),
    event("c-off", "note-off", 60, 0, 400_000n),
    event("e-off", "note-off", 64, 0, 420_000n),
    event("g-off", "note-off", 67, 0, 460_000n),
  ];

  it("keeps rolled-chord lengths and does not edit the source", () => {
    const before = source.map((item) => item.scheduleElapsed);
    const notes = notesFromEvents(source);
    expect(notes.map((note) => [note.pitch, note.start, note.end])).toEqual([
      [60, 0n, 400_000n],
      [64, 20_000n, 420_000n],
      [67, 45_000n, 460_000n],
    ]);
    expect(source.map((item) => item.scheduleElapsed)).toEqual(before);
    expect(source.find((item) => item.id === "pedal")?.value).toBe(127);
  });

  it("edits a copy and still plays the original pedal", () => {
    const notes = notesFromEvents(source);
    const moved = moveNote(notes, "c-on", 50_000n, 62);
    const resized = resizeNote(moved, "c-on", "end", 300_000n);
    const drawn = drawNote(resized, { id: "new", channel: 0, pitch: 72, start: 100_000n, end: 200_000n, velocity: 100, sourceOnId: null, sourceOffId: null });
    const quieter = setVelocity(eraseNote(drawn, "e-on"), "g-on", 40);
    expect(source.find((item) => item.id === "c-on")?.scheduleElapsed).toBe(0n);
    const played = workingPlayback(source, quieter, { start: 0n, end: 500_000n });
    const pedal = played.find((item) => item.kind === "cc" && item.controller === 64);
    expect(pedal?.scheduleElapsed).toBe(10_000n);
    expect(pedal?.value).toBe(127);
    const ons = played.filter((item) => item.kind === "note-on");
    const offs = played.filter((item) => item.kind === "note-off");
    expect(ons).toHaveLength(offs.length);
    expect(ons.map((item) => item.note).sort()).toEqual([62, 67, 72]);
    expect(played.find((item) => item.note === 62 && item.kind === "note-off")?.scheduleElapsed).toBe(300_000n);
  });

  it("previews quantise without writing it, then applies only the copy", () => {
    const notes = notesFromEvents(source);
    const grid: KnownGrid = { bpm: 120, beatsPerBar: 4, phase: 0n };
    const preview = quantisePreview(notes, ["e-on"], grid);
    expect(notes.find((note) => note.id === "e-on")?.start).toBe(20_000n);
    expect(preview[0].start).not.toBe(20_000n);
    const applied = applyPreview(notes, preview);
    expect(applied.find((note) => note.id === "e-on")?.start).toBe(preview[0].start);
    expect(source.find((item) => item.id === "e-on")?.scheduleElapsed).toBe(20_000n);
    expect(quantisePreview(notes, ["e-on"], null)).toEqual([]);
  });

  it("clips a held note for playback and leaves the working length", () => {
    const note: RollNote = { id: "held", channel: 0, pitch: 60, start: 100_000n, end: 900_000n, velocity: 70, sourceOnId: "held", sourceOffId: "held-off" };
    const played = workingPlayback(source, [note], { start: 0n, end: 500_000n });
    expect(played.find((item) => item.kind === "note-off" && item.note === 60)?.scheduleElapsed).toBe(500_000n);
    expect(note.end).toBe(900_000n);
  });
});
