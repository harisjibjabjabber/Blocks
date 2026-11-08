import { describe, expect, it } from "vitest";
import type { CapturedEvent } from "./capture";
import { eventsInSelection, recentPhraseCut, type RecentPhraseOptions } from "./recent-phrase";
import { createProject, proposeTempo } from "./project";

function ev(partial: {
  sequence: number;
  atMs: number;
  kind?: CapturedEvent["kind"];
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
}): CapturedEvent {
  const at = BigInt(Math.round(partial.atMs * 1000));
  return {
    id: "h" + partial.sequence,
    domain: "web-performance-us",
    sequence: BigInt(partial.sequence),
    portId: "holdout",
    sessionId: "hold",
    channel: 0,
    kind: partial.kind ?? "note-on",
    note: partial.note ?? 62,
    velocity: partial.velocity ?? 90,
    controller: partial.controller ?? 0,
    value: partial.value ?? 0,
    sourceTimestamp: at,
    receiptTimestamp: at,
    missingSourceTimestamp: false,
    raw: null,
    origin: "touch",
    elapsedSource: at,
    elapsedReceipt: at,
    scheduleElapsed: at,
  };
}

const opts = (extra?: Partial<RecentPhraseOptions>): RecentPhraseOptions => ({
  ticksPerSecond: 1_000_000,
  gridPeriodTicks: null,
  gridOriginTicks: null,
  historyMayBeTruncated: false,
  ...extra,
});

describe("holdout cases, not the examples used to check the cut", () => {
  it("fails if a later phrase is swallowed by the earlier session", () => {
    const early = [100, 280, 460].map((atMs, index) => ev({ sequence: index + 1, atMs, note: 55 }));
    const phrase = [3200, 3380, 3560, 3740].map((atMs, index) => ev({ sequence: index + 20, atMs, note: 70 }));
    const events = [...early, ...phrase];
    const before = events.map((event) => event.scheduleElapsed);
    const cut = recentPhraseCut(events, opts());
    const selected = eventsInSelection(events, cut.selection).map((event) => event.id);
    expect(selected).toEqual(phrase.map((event) => event.id));
    expect(selected).not.toEqual(events.map((event) => event.id));
    expect(events.map((event) => event.scheduleElapsed)).toEqual(before);
    expect(cut.controllerSeed.every((seed) => events.some((event) => event.id === seed.sourceId))).toBe(true);
  });

  it("keeps a just-over-hypothesis rest as a cut and a just-under rest as ambiguous", () => {
    const split = recentPhraseCut(
      [0, 220, 1900, 2100].map((atMs, index) => ev({ sequence: index + 1, atMs })),
      opts(),
    );
    expect(split.status).toBe("recent");
    expect(eventsInSelection([0, 220, 1900, 2100].map((atMs, index) => ev({ sequence: index + 1, atMs })), split.selection).map((event) => event.id)).toEqual(["h3", "h4"]);
    const continuous = [0, 220, 1600, 1820].map((atMs, index) => ev({ sequence: index + 1, atMs }));
    const ambiguous = recentPhraseCut(continuous, opts());
    expect(ambiguous.status).toBe("ambiguous");
    expect(eventsInSelection(continuous, ambiguous.selection)).toHaveLength(continuous.length);
  });

  it("keeps a held pedal in the seed and does not invent a pedal-up", () => {
    const events = [
      ev({ sequence: 1, atMs: 0, note: 50 }),
      ev({ sequence: 2, atMs: 40, kind: "cc", controller: 64, value: 127, note: 0, velocity: 0 }),
      ev({ sequence: 3, atMs: 2400, note: 64 }),
      ev({ sequence: 4, atMs: 2600, note: 67 }),
    ];
    const cut = recentPhraseCut(events, opts());
    expect(eventsInSelection(events, cut.selection).map((event) => event.id)).toEqual(["h3", "h4"]);
    expect(cut.controllerSeed.some((seed) => seed.controller === 64 && seed.value === 127)).toBe(true);
    expect(cut.deferred.join(" ")).toMatch(/pedal-up/i);
    expect(events.some((event) => event.kind === "cc" && event.value < 64)).toBe(false);
  });

  it("a second accept keeps the proposed number", () => {
    const before = createProject();
    const proposed = proposeTempo(before, 107.2, 0);
    expect(proposed.project.gridLocked).toBe(false);
    const accepted = proposeTempo(proposed.project, 144, 1);
    expect(accepted.project.tempoBpm).toBe(107);
    expect(accepted.project.gridLocked).toBe(true);
    expect(before.proposedTempoBpm).toBeNull();
  });
});
