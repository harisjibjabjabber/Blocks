import { describe, expect, it } from "vitest";
import type { CapturedEvent } from "./capture";
import { eventsInSelection, recentPhraseCut, type RecentPhraseOptions } from "./recent-phrase";
import { ribbonMarks } from "../ui/ribbon-scale";

/**
 * Synthetic. Same attacks, two articulations. Not Haris's take.
 * The period is one measured slot after the last chord onset.
 */

const opts: RecentPhraseOptions = {
  ticksPerSecond: 1_000_000,
  gridPeriodTicks: null,
  gridOriginTicks: null,
  historyMayBeTruncated: false,
};

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
    sessionId: "period",
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

function progression(finalReleaseMs: number, pedalUpMs: number): CapturedEvent[] {
  const events: CapturedEvent[] = [];
  const chords = [
    { id: "C", at: 0, notes: [60, 64, 67] },
    { id: "Am", at: 1600, notes: [57, 64, 69] },
    { id: "F", at: 3200, notes: [53, 60, 65] },
    { id: "G", at: 4800, notes: [55, 62, 67] },
  ];
  for (const chord of chords) {
    const release = chord.id === "G" ? finalReleaseMs : 400;
    events.push(ev({ id: chord.id + "d", atMs: chord.at - 20, kind: "cc", controller: 64, value: 127, note: 0, velocity: 0 }));
    chord.notes.forEach((note, index) => {
      events.push(ev({ id: chord.id + "n" + index, atMs: chord.at + index * 12, note }));
    });
    chord.notes.forEach((note, index) => {
      events.push(ev({ id: chord.id + "f" + index, atMs: chord.at + release, kind: "note-off", note, velocity: 0 }));
    });
    const pedalUp = chord.id === "G" ? pedalUpMs : release + 30;
    events.push(ev({ id: chord.id + "u", atMs: chord.at + pedalUp, kind: "cc", controller: 64, value: 0, note: 0, velocity: 0 }));
  }
  return events.sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : 0));
}

function playback(events: CapturedEvent[], loop: { start: bigint; end: bigint }) {
  return events.filter((event) => event.scheduleElapsed >= loop.start && event.scheduleElapsed <= loop.end);
}

describe("final chord slot, short release and a real hold", () => {
  const short = progression(180, 220);
  const held = progression(1400, 1450);
  const shortBefore = short.map((event) => event.scheduleElapsed);
  const heldBefore = held.map((event) => event.scheduleElapsed);
  const shortCut = recentPhraseCut(short, opts);
  const heldCut = recentPhraseCut(held, opts);

  it("uses one measured period for both articulations", () => {
    expect(shortCut.periodConfidence).toBe("measured");
    expect(heldCut.periodConfidence).toBe("measured");
    expect(shortCut.periodTicks).toBe(1_600_000n);
    expect(heldCut.periodTicks).toBe(shortCut.periodTicks);
    expect(shortCut.phaseOriginTicks).toBe(0n);
    expect(heldCut.phaseOriginTicks).toBe(0n);
    expect(shortCut.loop.end).toBe(6_400_000n);
    expect(heldCut.loop.end).toBe(shortCut.loop.end);
    expect(shortCut.loop.end).toBeGreaterThan(short.find((event) => event.id === "Gf0")!.scheduleElapsed);
    expect(heldCut.loop.end).toBeGreaterThan(held.find((event) => event.id === "Gf0")!.scheduleElapsed);
  });

  it("does not move raw notes or the pedal, and does not drop their releases from playback", () => {
    expect(short.map((event) => event.scheduleElapsed)).toEqual(shortBefore);
    expect(held.map((event) => event.scheduleElapsed)).toEqual(heldBefore);
    for (const [events, cut, releaseMs, pedalMs] of [
      [short, shortCut, 180, 220],
      [held, heldCut, 1400, 1450],
    ] as const) {
      const played = playback(events, cut.loop);
      const offs = played.filter((event) => event.id.startsWith("Gf"));
      const pedal = played.find((event) => event.id === "Gu");
      expect(offs.map((event) => Number(event.scheduleElapsed) / 1000)).toEqual([4800 + releaseMs, 4800 + releaseMs, 4800 + releaseMs]);
      expect(Number(pedal?.scheduleElapsed) / 1000).toBe(4800 + pedalMs);
      const durationUs = cut.loop.end - cut.loop.start;
      const offAt = offs[0].scheduleElapsed - cut.loop.start;
      expect(offAt).toBeLessThan(durationUs);
    }
  });

  it("leaves silence after a short release and is still holding just before the wrap", () => {
    const duration = shortCut.loop.end - shortCut.loop.start;
    const shortOff = short.find((event) => event.id === "Gf0")!.scheduleElapsed - shortCut.loop.start;
    const heldOff = held.find((event) => event.id === "Gf0")!.scheduleElapsed - heldCut.loop.start;
    const justBeforeWrap = duration - 500_000n;
    expect(shortOff < justBeforeWrap).toBe(true);
    expect(heldOff > justBeforeWrap).toBe(true);
    expect(duration).toBe(heldCut.loop.end - heldCut.loop.start);
  });

  it("draws the same trailing empty space on the ribbon for both articulations", () => {
    const notes = short.filter((event) => event.kind === "note-on" && event.velocity > 0);
    const withoutPeriod = ribbonMarks(notes);
    const shortDraw = ribbonMarks(notes, shortCut.loop.end);
    const heldDraw = ribbonMarks(notes, heldCut.loop.end);
    const last = shortDraw[shortDraw.length - 1];
    expect(last.xPercent).toBeCloseTo(heldDraw[heldDraw.length - 1].xPercent, 5);
    expect(last.xPercent).toBeLessThan(80);
    expect(withoutPeriod[withoutPeriod.length - 1].xPercent).toBeGreaterThan(99);
    const stored = eventsInSelection(short, shortCut.selection).filter((event) => event.kind === "note-on" && event.velocity > 0);
    expect(stored).toHaveLength(notes.length);
  });
});

describe("weak spacing does not invent empty time", () => {
  it("leaves the loop on the recorded events", () => {
    const events = [0, 200, 900, 1200].map((atMs, index) => ev({ id: "n" + index, atMs }));
    const cut = recentPhraseCut(events, opts);
    expect(cut.periodConfidence).toBe("fallback");
    expect(cut.periodTicks).toBeNull();
    expect(cut.phaseOriginTicks).toBeNull();
    expect(cut.loop.end).toBe(cut.selection.end);
    expect(cut.loop.end).toBe(events[events.length - 1].scheduleElapsed);
  });
});
