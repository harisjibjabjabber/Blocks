import { describe, expect, it } from "vitest";
import type { CapturedEvent } from "./capture";
import { eventsInSelection, moveSelectionStart, recentPhraseCut, type RecentPhraseOptions } from "./recent-phrase";

const TICKS = 1_000_000;

function ev(partial: {
  sequence: number;
  atMs: number;
  kind?: CapturedEvent["kind"];
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  channel?: number;
}): CapturedEvent {
  const at = BigInt(Math.round(partial.atMs * 1000));
  return {
    id: "e" + partial.sequence,
    domain: "web-performance-us",
    sequence: BigInt(partial.sequence),
    portId: "p",
    sessionId: "s",
    channel: partial.channel ?? 0,
    kind: partial.kind ?? "note-on",
    note: partial.note ?? 60,
    velocity: partial.velocity ?? 100,
    controller: partial.controller ?? 0,
    value: partial.value ?? 0,
    sourceTimestamp: at,
    receiptTimestamp: at,
    missingSourceTimestamp: false,
    raw: [0x90, partial.note ?? 60, partial.velocity ?? 100],
    origin: "touch",
    elapsedSource: at,
    elapsedReceipt: at,
    scheduleElapsed: at,
  };
}

function options(extra?: Partial<RecentPhraseOptions>): RecentPhraseOptions {
  return {
    ticksPerSecond: TICKS,
    gridPeriodTicks: null,
    gridOriginTicks: null,
    historyMayBeTruncated: false,
    ...extra,
  };
}

function ids(events: CapturedEvent[], selection: { start: bigint; end: bigint }): string[] {
  return eventsInSelection(events, selection).map((event) => event.id);
}

describe("basic recent-phrase cut, not validated capture", () => {
  it("cuts long noodling then a distinct phrase, and leaves the raw times", () => {
    const noodling = Array.from({ length: 12 }, (_, index) => ev({ sequence: index + 1, atMs: index * 200 }));
    const phrase = [5000, 5200, 5400, 5600, 5800].map((atMs, index) => ev({ sequence: 20 + index, atMs, note: 64 }));
    const events = [...noodling, ...phrase];
    const before = events.map((event) => event.scheduleElapsed);
    const cut = recentPhraseCut(events, options());
    expect(cut.status).toBe("recent");
    expect(cut.note).toMatch(/hypothesis/i);
    expect(cut.note).toMatch(/not a validated phrase|Not a validated phrase|not the finished Capture/i);
    expect(ids(events, cut.selection)).toEqual(phrase.map((event) => event.id));
    expect(cut.priorPhrase).not.toBeNull();
    expect(ids(events, cut.priorPhrase as { start: bigint; end: bigint })[0]).toBe("e1");
    expect(events.map((event) => event.scheduleElapsed)).toEqual(before);
  });

  it("keeps the later of two phrases separated by a rest", () => {
    const first = [0, 200, 400, 600].map((atMs, index) => ev({ sequence: index + 1, atMs }));
    const second = [4000, 4200, 4400, 4600].map((atMs, index) => ev({ sequence: index + 10, atMs, note: 67 }));
    const events = [...first, ...second];
    const cut = recentPhraseCut(events, options());
    expect(ids(events, cut.selection)).toEqual(second.map((event) => event.id));
    expect(cut.priorPhrase).not.toBeNull();
    expect(ids(events, cut.priorPhrase as { start: bigint; end: bigint })).toEqual(first.map((event) => event.id));
  });

  it("uses the last bar once a grid exists, and does not return the whole session", () => {
    const events = Array.from({ length: 21 }, (_, index) => ev({ sequence: index + 1, atMs: index * 500 }));
    const beat = 500_000n;
    const cut = recentPhraseCut(events, options({ gridPeriodTicks: beat, gridOriginTicks: 0n }));
    expect(cut.status).toBe("recent");
    expect(cut.note).toMatch(/locked beat was read and not changed/i);
    const selected = eventsInSelection(events, cut.selection);
    expect(selected.length).toBeLessThan(events.length);
    expect(selected[selected.length - 1].id).toBe("e21");
    expect(Number(cut.selection.end - cut.selection.start)).toBeLessThanOrEqual(2_000_000);
    expect(cut.priorBar).not.toBeNull();
    expect(cut.selection.start).not.toBe(events[0].scheduleElapsed);
  });

  it("stays in free time and says the cut is ambiguous when the pulse is unreliable", () => {
    const times = [0, 200, 900, 1200, 2100, 2500, 3300, 3600];
    const events = times.map((atMs, index) => ev({ sequence: index + 1, atMs }));
    const cut = recentPhraseCut(events, options());
    expect(cut.status).toBe("ambiguous");
    expect(cut.note).toMatch(/Free time/);
    expect(cut.note).toMatch(/hypothesis/i);
    expect(cut.priorPhrase).toBeNull();
    expect(cut.priorBar).toBeNull();
    expect(ids(events, cut.selection)).toEqual(events.map((event) => event.id));
  });

  it("does not widen the selection to the whole session when a note crosses the cut", () => {
    const events = [
      ev({ sequence: 1, atMs: 0, note: 48 }),
      ev({ sequence: 2, atMs: 100, kind: "note-off", note: 48, velocity: 0 }),
      ...Array.from({ length: 16 }, (_, index) => ev({ sequence: index + 3, atMs: 300 + index * 500, note: 60 })),
      ev({ sequence: 30, atMs: 7800, note: 72 }),
      ev({ sequence: 31, atMs: 8600, kind: "note-off", note: 72, velocity: 0 }),
    ];
    const beat = 500_000n;
    const cut = recentPhraseCut(events, options({ gridPeriodTicks: beat, gridOriginTicks: 300_000n }));
    expect(cut.selection.start).toBeGreaterThan(events[0].scheduleElapsed);
    expect(ids(events, cut.selection)).not.toContain("e1");
    expect(cut.heldNoteIds.includes("e1")).toBe(false);
    expect(cut.note).not.toMatch(/validated capture/i);
    expect(cut.deferred.join(" ")).toMatch(/not used to widen the selection|Note-boundary expansion/i);
  });

  it("keeps a held note as context when capture happens while it is down", () => {
    const events = [
      ev({ sequence: 1, atMs: 0 }),
      ev({ sequence: 2, atMs: 1800, note: 64 }),
      ev({ sequence: 3, atMs: 2000, note: 67 }),
    ];
    const cut = recentPhraseCut(events, options());
    expect(ids(events, cut.selection)).toEqual(["e2", "e3"]);
    expect(cut.deferred.join(" ")).toMatch(/No note-off was invented/);
    expect(events.some((event) => event.kind === "note-off")).toBe(false);
  });

  it("seeds CC64 and CC66 without inventing a pedal-up, and defers sostenuto", () => {
    const events = [
      ev({ sequence: 1, atMs: 0, note: 48 }),
      ev({ sequence: 2, atMs: 100, kind: "cc", controller: 64, value: 127, note: 0, velocity: 0 }),
      ev({ sequence: 3, atMs: 110, kind: "cc", controller: 66, value: 127, note: 0, velocity: 0 }),
      ev({ sequence: 4, atMs: 2000, note: 60 }),
      ev({ sequence: 5, atMs: 2200, note: 64 }),
    ];
    const cut = recentPhraseCut(events, options());
    expect(cut.controllerSeed.map((entry) => entry.controller).sort()).toEqual([64, 66]);
    expect(events.filter((event) => event.kind === "cc" && event.value < 64)).toHaveLength(0);
    expect(cut.deferred.join(" ")).toMatch(/CC66/);
    expect(cut.deferred.join(" ")).toMatch(/no last pedal-up|pedal-up/i);
  });

  it("does not drop overlapping same-pitch notes from the raw list", () => {
    const events = [
      ev({ sequence: 1, atMs: 0, note: 60 }),
      ev({ sequence: 2, atMs: 1800, note: 60 }),
      ev({ sequence: 3, atMs: 2000, note: 64 }),
      ev({ sequence: 4, atMs: 2300, kind: "note-off", note: 60, velocity: 0 }),
    ];
    const before = events.map((event) => event.id);
    const cut = recentPhraseCut(events, options());
    expect(events.map((event) => event.id)).toEqual(before);
    expect(ids(events, cut.selection)).toEqual(["e2", "e3", "e4"]);
    expect(cut.deferred.join(" ")).toMatch(/same-pitch/);
  });

  it("a second cut sees only the events it is given, not the earlier session", () => {
    const session = [0, 200, 400].map((atMs, index) => ev({ sequence: index + 1, atMs }));
    const phrase = ev({ sequence: 9, atMs: 4000, note: 70 });
    const first = recentPhraseCut([...session, phrase], options());
    expect(ids([...session, phrase], first.selection)).toEqual(["e9"]);
    const later = [0, 180, 360].map((atMs, index) => ev({ sequence: 100 + index, atMs, note: 70 }));
    const second = recentPhraseCut(later, options());
    expect(ids(later, second.selection)).toEqual(["e100", "e101", "e102"]);
    expect(ids(later, second.selection)).not.toEqual(expect.arrayContaining(["e1", "e2", "e3"]));
  });

  it("offers one window, not three confident alternatives", () => {
    const events = [0, 2000, 2200].map((atMs, index) => ev({ sequence: index + 1, atMs }));
    const cut = recentPhraseCut(events, options());
    expect(cut.selection).toBeTruthy();
    expect(Array.isArray(cut.selection)).toBe(false);
    expect(cut.priorBar).toBeNull();
  });

  it("moves the selection without editing timestamps", () => {
    const events = [0, 1800, 2000, 2200].map((atMs, index) => ev({ sequence: index + 1, atMs }));
    const cut = recentPhraseCut(events, options());
    const before = events.map((event) => event.scheduleElapsed);
    const later = moveSelectionStart(events, cut.selection, "later", TICKS);
    expect(later.selection.start).toBeGreaterThan(cut.selection.start);
    expect(events.map((event) => event.scheduleElapsed)).toEqual(before);
    const back = moveSelectionStart(events, later.selection, "earlier", TICKS);
    expect(back.selection.start).toBeLessThan(later.selection.start);
  });

  it("records truncation instead of inventing the missing history", () => {
    const events = [0, 200].map((atMs, index) => ev({ sequence: index + 1, atMs }));
    const cut = recentPhraseCut(events, options({ historyMayBeTruncated: true }));
    expect(cut.deferred.join(" ")).toMatch(/cannot reconstruct/);
  });
});
