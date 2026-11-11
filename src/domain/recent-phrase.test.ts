import { describe, expect, it } from "vitest";
import type { CapturedEvent } from "./capture";
import { eventsInSelection, moveSelectionStart, recentPhraseCut, withCaptureRange, type RecentPhraseOptions } from "./recent-phrase";

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

describe("explicit pre-capture range", () => {
  it("uses the exact requested range including silence and drops inferred period claims", () => {
    const events = [0, 500, 1000, 1500].flatMap((atMs, index) => [ev({ sequence: index * 2, atMs }), ev({ sequence: index * 2 + 1, atMs: atMs + 100, kind: "note-off", velocity: 0 })]);
    const proposal = recentPhraseCut(events, options());
    expect(proposal.periodConfidence).toBe("measured");
    const before = structuredClone({ events, proposal });
    const bounds = { start: 250_000n, end: 3_000_000n };
    const cut = withCaptureRange(events, proposal, bounds);
    expect(cut.selection).toEqual(bounds); expect(cut.loop).toEqual(bounds);
    expect(cut.selection).not.toBe(bounds); expect(cut.loop).not.toBe(cut.selection);
    expect(cut).toMatchObject({ periodTicks: null, phaseOriginTicks: null, periodConfidence: "fallback", priorPhrase: null, priorBar: null });
    expect(cut.note).toContain("Manual capture range"); expect(cut.note).not.toMatch(/measured slot|spacing was too weak/i);
    expect({ events, proposal }).toEqual(before);
    expect(cut.deferred).not.toBe(proposal.deferred);
  });

  it("re-seeds held attacks and the latest per-channel controllers at the new start", () => {
    const events = [
      ev({ sequence: 1, atMs: 0, note: 48 }),
      ev({ sequence: 2, atMs: 10, kind: "cc", controller: 64, value: 127 }),
      ev({ sequence: 3, atMs: 20, kind: "cc", controller: 64, value: 0 }),
      ev({ sequence: 4, atMs: 30, kind: "cc", controller: 64, value: 96, channel: 1 }),
      ev({ sequence: 5, atMs: 100, note: 64 }),
      ev({ sequence: 6, atMs: 200, kind: "note-off", note: 48, velocity: 0 }),
      ev({ sequence: 7, atMs: 300, kind: "note-off", note: 64, velocity: 0 }),
    ];
    const proposal = recentPhraseCut(events, options());
    const cut = withCaptureRange([...events].reverse(), proposal, { start: 100_000n, end: 250_000n });
    expect(cut.heldNoteIds).toEqual(["e1"]); // Attack at the boundary stays an ordinary selected event.
    expect(cut.controllerSeed).toEqual([
      { channel: 0, controller: 64, value: 0, sourceId: "e3" },
      { channel: 1, controller: 64, value: 96, sourceId: "e4" },
    ]);
    expect(eventsInSelection(events, cut.selection).map(event => event.id)).toEqual(["e5", "e6"]);
    expect(cut.deferred.join(" ")).toMatch(/already sounding|No note-off was invented/);
    const later = withCaptureRange(events, cut, { start: 400_000n, end: 500_000n });
    expect(later.heldNoteIds).toEqual([]);
    expect(later.deferred.join(" ")).not.toMatch(/already sounding at the cut|still on at the end/);
  });

  it("preserves truncation limitations without copying stale range explanations", () => {
    const events = [ev({ sequence: 1, atMs: 0 }), ev({ sequence: 2, atMs: 200 })];
    const proposal = recentPhraseCut(events, options({ historyMayBeTruncated: true }));
    const cut = withCaptureRange(events, proposal, { start: 100_000n, end: 400_000n });
    expect(cut.deferred.join(" ")).toMatch(/cannot reconstruct/);
    expect(cut.deferred.join(" ")).not.toMatch(/Note-boundary expansion/);
  });

  it("rejects negative, empty and reversed ranges without mutating the proposal", () => {
    const events = [ev({ sequence: 1, atMs: 0 })];
    const proposal = recentPhraseCut(events, options());
    const before = structuredClone(proposal);
    for (const bounds of [{ start: -1n, end: 1n }, { start: 1n, end: 1n }, { start: 2n, end: 1n }]) expect(() => withCaptureRange(events, proposal, bounds)).toThrow(RangeError);
    expect(proposal).toEqual(before);
  });
});

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

  it("does not discard a continuous melody merely because a previous layer has a locked grid", () => {
    const events = Array.from({ length: 24 }, (_, index) => index * 500).flatMap((atMs, index) => [
      ev({ sequence: index * 2, atMs, note: 60 + index % 7 }),
      ev({ sequence: index * 2 + 1, atMs: atMs + 200, note: 60 + index % 7, kind: "note-off", velocity: 0 }),
    ]);
    const before = structuredClone(events);
    const free = recentPhraseCut(events, options());
    expect(ids(events, free.selection)).toEqual(events.map(event => event.id));
    for (const gridPeriodTicks of [400_000n, 500_000n, 750_000n]) {
      for (const gridOriginTicks of [0n, 125_000n, 90_000_000n]) {
        const cut = recentPhraseCut(events, options({ gridPeriodTicks, gridOriginTicks }));
        expect(cut.selection).toEqual(free.selection);
        expect(cut.loop).toEqual(free.loop);
        expect(cut.priorBar).toBeNull();
      }
    }
    expect(events).toEqual(before);
  });

  it("finds a released phrase and its pickup after noodling and a real rest with an unrelated grid origin", () => {
    const times = [0, 200, 400, 600, 800, 5000, 5250, 5750, 6250, 6750, 7250];
    const events = times.flatMap((atMs, index) => [
      ev({ sequence: index * 2, atMs, note: 60 + index % 5 }),
      ev({ sequence: index * 2 + 1, atMs: atMs + 100, note: 60 + index % 5, kind: "note-off", velocity: 0 }),
    ]);
    const cut = recentPhraseCut(events, options({ gridPeriodTicks: 500_000n, gridOriginTicks: 17_000_000n }));
    expect(cut.selection.start).toBe(5_000_000n);
    expect(cut.selection.end).toBe(7_350_000n);
    expect(ids(events, cut.selection)).toEqual(events.slice(10).map(event => event.id));
  });

  it("keeps a repeated two-spacing motif intact without forcing it to one bar", () => {
    const events = [0, 250, 1000, 1250, 2000, 2250, 3000, 3250, 4000, 4250].flatMap((atMs, index) => [
      ev({ sequence: index * 2, atMs, note: 60 + index % 2 }),
      ev({ sequence: index * 2 + 1, atMs: atMs + 100, note: 60 + index % 2, kind: "note-off", velocity: 0 }),
    ]);
    const cut = recentPhraseCut(events, options({ gridPeriodTicks: 500_000n, gridOriginTicks: 0n }));
    expect(ids(events, cut.selection)).toEqual(events.map(event => event.id));
  });

  it("documents that an isolated long internal rest is still treated as a phrase boundary", () => {
    // No pitch/motif model can currently distinguish this intended internal rest
    // from a new phrase. Preserve that limitation rather than claim recognition.
    const events = [0, 500, 1000, 1500, 5000, 5500, 6000, 6500].flatMap((atMs, index) => [
      ev({ sequence: index * 2, atMs }),
      ev({ sequence: index * 2 + 1, atMs: atMs + 100, kind: "note-off", velocity: 0 }),
    ]);
    const cut = recentPhraseCut(events, options({ gridPeriodTicks: 500_000n }));
    expect(cut.selection.start).toBe(5_000_000n);
    expect(cut.priorPhrase).not.toBeNull();
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


describe("recent phrase prefix", () => {
  it("does not let chord-pattern recognition pull an earlier idea back across a clear rest", () => {
    let sequence = 0;
    const events = [0, 500, 1000, 5000, 5500, 6000].flatMap((atMs, i) => {
      const pitches = i < 3 ? [48, 52, 55] : [60, 64, 67];
      return [...pitches.map(note => ev({ sequence: ++sequence, atMs, note })),
        ...pitches.map(note => ev({ sequence: ++sequence, atMs: atMs + 400, note, kind: "note-off", velocity: 0 }))];
    });
    const before = structuredClone(events);
    const cut = recentPhraseCut(events, options());
    expect(cut.selection.start).toBe(5_000_000n);
    expect(eventsInSelection(events, cut.selection).filter(e => e.kind === "note-on").map(e => e.note)).toEqual([60, 64, 67, 60, 64, 67, 60, 64, 67]);
    expect(events).toEqual(before);
  });
});
