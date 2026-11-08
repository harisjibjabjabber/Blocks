import { describe, expect, it } from "vitest";
import type { CapturedEvent } from "./capture";
import { eventsInSelection, recentPhraseCut, type RecentPhraseOptions } from "./recent-phrase";

/**
 * Synthetic only. These are not Haris's take. His MIDI and timing were not available.
 */

function ev(partial: {
  id: string;
  atMs: number;
  kind?: CapturedEvent["kind"];
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
}): CapturedEvent {
  const at = BigInt(Math.round(partial.atMs * 1000));
  return {
    id: partial.id,
    domain: "web-performance-us",
    sequence: BigInt(partial.id.replace(/\D/g, "") || "1"),
    portId: "synthetic",
    sessionId: "synthetic",
    channel: 0,
    kind: partial.kind ?? "note-on",
    note: partial.note ?? 60,
    velocity: partial.velocity ?? 90,
    controller: partial.controller ?? 0,
    value: partial.value ?? 0,
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

function chord(idBase: number, atMs: number, root: number, releaseMs: number): CapturedEvent[] {
  const notes = [root, root + 4, root + 7];
  const ons = notes.map((note, index) =>
    ev({ id: "c" + idBase + "n" + index, atMs: atMs + index * 12, note }),
  );
  const offs = notes.map((note, index) =>
    ev({ id: "c" + idBase + "f" + index, atMs: atMs + releaseMs, kind: "note-off", note, velocity: 0 }),
  );
  return [...ons, ...offs];
}

const opts: RecentPhraseOptions = {
  ticksPerSecond: 1_000_000,
  gridPeriodTicks: null,
  gridOriginTicks: null,
  historyMayBeTruncated: false,
};

function onsets(events: CapturedEvent[], selection: { start: bigint; end: bigint }): string[] {
  return eventsInSelection(events, selection)
    .filter((event) => event.kind === "note-on" && event.velocity > 0)
    .map((event) => event.id);
}

describe("synthetic four-chord selection, not a recorded take", () => {
  it("keeps a four-chord progression whose rests are articulation, not four phrases", () => {
    const events = [60, 65, 67, 72].flatMap((root, index) => chord(index + 1, index * 1800, root, 500));
    const before = events.map((event) => event.scheduleElapsed);
    const cut = recentPhraseCut(events, opts);
    const selected = onsets(events, cut.selection);
    expect(selected).toEqual(["c1n0", "c1n1", "c1n2", "c2n0", "c2n1", "c2n2", "c3n0", "c3n1", "c3n2", "c4n0", "c4n1", "c4n2"]);
    expect(selected).not.toEqual(["c4n0", "c4n1", "c4n2"]);
    expect(cut.selection.start).toBe(0n);
    expect(events.map((event) => event.scheduleElapsed)).toEqual(before);
    expect(cut.status).toBe("recent");
  });

  it("does not split pedal-connected chords only because the note-offs leave a gap", () => {
    const pedal = ev({ id: "ped", atMs: 0, kind: "cc", controller: 64, value: 127, note: 0, velocity: 0 });
    const events = [
      pedal,
      ...chord(1, 20, 60, 180),
      ...chord(2, 520, 65, 180),
      ...chord(3, 1020, 67, 180),
      ...chord(4, 4020, 72, 180),
    ];
    const cut = recentPhraseCut(events, opts);
    expect(onsets(events, cut.selection)).toEqual([
      "c1n0", "c1n1", "c1n2",
      "c2n0", "c2n1", "c2n2",
      "c3n0", "c3n1", "c3n2",
      "c4n0", "c4n1", "c4n2",
    ]);
    expect(events.some((event) => event.kind === "cc" && event.value < 64)).toBe(false);
    expect(cut.status).toBe("recent");
    expect(cut.controllerSeed.some((seed) => seed.controller === 64 && seed.value === 127) || eventsInSelection(events, cut.selection).some((event) => event.id === "ped")).toBe(true);
  });

  it("still splits two phrases when the pause is real silence", () => {
    const first = [0, 180, 360].flatMap((atMs, index) => [
      ev({ id: "a" + index, atMs, note: 60 }),
      ev({ id: "af" + index, atMs: atMs + 80, kind: "note-off", note: 60, velocity: 0 }),
    ]);
    const second = [5000, 5180, 5360].flatMap((atMs, index) => [
      ev({ id: "b" + index, atMs, note: 67 }),
      ev({ id: "bf" + index, atMs: atMs + 80, kind: "note-off", note: 67, velocity: 0 }),
    ]);
    const events = [...first, ...second];
    const cut = recentPhraseCut(events, opts);
    expect(onsets(events, cut.selection).every((id) => id.startsWith("b"))).toBe(true);
    expect(onsets(events, cut.selection).some((id) => id.startsWith("a"))).toBe(false);
    expect(cut.priorPhrase).not.toBeNull();
  });

  it("keeps four uneven chords after a longer line, including under a 40 bpm bar", () => {
    const gaps = [180, 260, 140, 320, 220, 410, 190, 280, 150, 360, 240, 300];
    const pitches = [60, 62, 64, 67, 64, 62, 60, 65, 67, 65, 64, 62, 60, 67, 69, 67, 65, 64, 62, 60, 64, 67, 72, 67, 64, 60, 62, 64, 65, 67, 64, 62, 60, 64, 67, 65];
    const events: CapturedEvent[] = [];
    let at = 800;
    let n = 1;
    for (let i = 0; i < pitches.length; i += 1) {
      const hold = 90 + (i % 5) * 25;
      events.push(ev({ id: "p" + n, atMs: at, note: pitches[i] }));
      n += 1;
      events.push(ev({ id: "p" + n, atMs: at + hold, kind: "note-off", note: pitches[i], velocity: 0 }));
      n += 1;
      at += gaps[i % gaps.length];
    }
    const chords = [
      { id: "C", atMs: at + 980, pitches: [60, 64, 67] },
      { id: "Am", atMs: 0, pitches: [57, 64, 69] },
      { id: "F", atMs: 0, pitches: [53, 60, 65] },
      { id: "G", atMs: 0, pitches: [55, 62, 67] },
    ];
    const steps = [1680, 2240, 1790];
    for (let i = 1; i < chords.length; i += 1) {
      chords[i].atMs = chords[i - 1].atMs + steps[i - 1];
    }
    for (const chord of chords) {
      const releaseAt = chord.atMs + 470 + (chord.pitches[0] % 3) * 40;
      events.push(ev({ id: chord.id + "d", atMs: chord.atMs - 40, kind: "cc", controller: 64, value: 127, note: 0, velocity: 0 }));
      events.push(ev({ id: chord.id + "u", atMs: releaseAt + 30, kind: "cc", controller: 64, value: 0, note: 0, velocity: 0 }));
      chord.pitches.forEach((pitch, index) => {
        events.push(ev({ id: chord.id + "n" + index, atMs: chord.atMs + index * 16, note: pitch }));
      });
      chord.pitches.forEach((pitch, index) => {
        events.push(ev({ id: chord.id + "f" + index, atMs: releaseAt, kind: "note-off", note: pitch, velocity: 0 }));
      });
    }
    events.sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : 0));
    const before = events.map((event) => event.scheduleElapsed);
    for (const gridPeriodTicks of [null, 1_500_000n]) {
      const cut = recentPhraseCut(events, { ...opts, gridPeriodTicks, gridOriginTicks: 800_000n });
      const selected = onsets(events, cut.selection);
      expect(selected).toEqual(["Cn0", "Cn1", "Cn2", "Amn0", "Amn1", "Amn2", "Fn0", "Fn1", "Fn2", "Gn0", "Gn1", "Gn2"]);
      expect(selected).not.toContain("p1");
      expect(events.map((event) => event.scheduleElapsed)).toEqual(before);
    }
  });

  it("stays ambiguous on continuous playing and does not select the whole ribbon", () => {
    const events = Array.from({ length: 36 }, (_, index) => ev({ id: "n" + index, atMs: index * 280, note: 60 + (index % 5) }));
    const cut = recentPhraseCut(events, opts);
    const selected = eventsInSelection(events, cut.selection);
    expect(cut.status).toBe("ambiguous");
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.length).toBeLessThan(events.length);
    expect(selected[selected.length - 1].id).toBe("n35");
    expect(selected[0].id).not.toBe("n0");
    expect(cut.note).toMatch(/not a found phrase|not the whole ribbon/i);
  });
});
