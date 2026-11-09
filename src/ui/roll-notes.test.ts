import { describe, expect, it } from "vitest";
import type { CapturedEvent } from "../domain/capture";
import { applyPreview, drawNote, eraseNote, moveNote, notesFromEvents, quantisePreview, resizeNote, setVelocity, snapDelta, workingPlayback, type RollNote } from "./roll-notes";
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

  it("rounds a snap tie away from zero and keeps the note offset in the delta", () => {
    const step = 1000n;
    expect(snapDelta(500n, step)).toBe(1000n);
    expect(snapDelta(-500n, step)).toBe(-1000n);
    expect(snapDelta(499n, step)).toBe(0n);
    const grid: KnownGrid = { bpm: 120, beatsPerBar: 4, phase: 0n };
    const notes = notesFromEvents(source);
    const before = notes.map((note) => note.start);
    const preview = quantisePreview(notes, ["e-on"], grid);
    expect(notes.map((note) => note.start)).toEqual(before);
    expect(source.find((item) => item.id === "e-on")?.scheduleElapsed).toBe(20_000n);
    expect(preview[0].start).toBe(10_000n);
    expect(preview[0].end - preview[0].start).toBe(420_000n - 20_000n);
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

  it("uses an explicitly chosen fraction for quantise without mutating notes or source", () => {
    const sourceBefore = structuredClone(source);
    const notes = notesFromEvents(source);
    const notesBefore = structuredClone(notes);
    const grid: KnownGrid = { bpm: 120, beatsPerBar: 4, phase: 100_000n };
    // Controls alone only choose a lattice; even computing previews does not apply it.
    for (const division of [
      { kind: "bar" as const, bars: 1 },
      { kind: "note" as const, numerator: 1, denominator: 8, triplet: true },
      { kind: "note" as const, numerator: 3, denominator: 8 },
    ]) {
      const preview = quantisePreview(notes, ["e-on"], grid, division);
      expect(preview).toHaveLength(1);
      expect(preview[0].start).toBe(60_000n); // halfway from 20 ms to phase 100 ms
      expect(preview[0].end - preview[0].start).toBe(400_000n);
      expect(notes).toEqual(notesBefore);
      expect(source).toEqual(sourceBefore);
    }
    expect(quantisePreview(notes, [], grid, { kind: "off" })).toEqual([]);
  });

  it("clips a held note for playback and leaves the working length", () => {
    const note: RollNote = { id: "held", channel: 0, pitch: 60, start: 100_000n, end: 900_000n, velocity: 70, sourceOnId: "held", sourceOffId: "held-off" };
    const played = workingPlayback(source, [note], { start: 0n, end: 500_000n });
    expect(played.find((item) => item.kind === "note-off" && item.note === 60)?.scheduleElapsed).toBe(500_000n);
    expect(note.end).toBe(900_000n);
  });

  it("keeps edited pedal-held notes across a cut using edited pitch/velocity without resurrecting deletions", () => {
    const input = [event("on", "note-on", 60, 90, 0n), event("down", "cc", 0, 0, 10_000n, 64, 127), event("off", "note-off", 60, 0, 50_000n), event("up", "cc", 0, 0, 300_000n, 64, 0)];
    const before = structuredClone(input);
    const edited = notesFromEvents(input).map(note => ({ ...note, pitch: 62, velocity: 48 }));
    const notesBefore = structuredClone(edited);
    const played = workingPlayback(input, edited, { start: 100_000n, end: 400_000n });
    expect(played.filter(item => item.kind === "note-on" || item.kind === "note-off").map(item => [item.kind, item.note, item.velocity, item.scheduleElapsed])).toEqual([["note-on", 62, 48, 100_000n], ["note-off", 62, 0, 100_000n]]);
    expect(played.find(item => item.id === "up")).toBe(input[3]);
    expect(workingPlayback(input, [], { start: 100_000n, end: 400_000n }).some(item => item.kind === "note-on")).toBe(false);
    expect(input).toEqual(before); expect(edited).toEqual(notesBefore);
  });

  it("does not sustain another channel or revive a note after a pedal lift and new press", () => {
    const input = [event("on", "note-on", 60, 90, 0n), { ...event("other", "note-on", 64, 90, 0n), channel: 1 }, event("down", "cc", 0, 0, 10_000n, 64, 127), event("off", "note-off", 60, 0, 20_000n), { ...event("other-off", "note-off", 64, 0, 20_000n), channel: 1 }, event("up", "cc", 0, 0, 70_000n, 64, 0), event("down-again", "cc", 0, 0, 80_000n, 64, 127)];
    const notes = notesFromEvents(input);
    const held = workingPlayback(input, notes, { start: 30_000n, end: 60_000n });
    expect(held.filter(item => item.kind === "note-on").map(item => item.channel)).toEqual([0]);
    expect(workingPlayback(input, notes, { start: 100_000n, end: 200_000n })).toEqual([]);
  });

  it("keeps expression bytes on the playback copy and excludes a note at the loop end", () => {
    const expression = [
      event("expression", "cc", 0, 0, 30_000n, 11, 90),
      { ...event("bend", "pitch", 0, 0, 35_000n), raw: [0xe0, 0, 70] },
      { ...event("pressure", "other", 60, 0, 40_000n), raw: [0xa0, 60, 85] },
    ];
    const input = [...source, ...expression];
    const before = structuredClone(input);
    const edge: RollNote = { id: "at-end", pitch: 80, channel: 0, start: 500_000n, end: 600_000n, velocity: 80, sourceOnId: null, sourceOffId: null };
    const played = workingPlayback(input, [...notesFromEvents(input), edge], { start: 0n, end: 500_000n });
    expect(played.filter((item) => expression.some((original) => original.id === item.id))).toEqual(expression);
    expect(played.some((item) => item.kind === "note-on" && item.note === 80)).toBe(false);
    expect(input).toEqual(before);
  });
});
