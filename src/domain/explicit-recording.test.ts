import { describe, expect, it } from "vitest";
import type { CapturedEvent } from "./capture";
import { recordedTake } from "./explicit-recording";

function event(id: string, source: bigint | null, receipt: bigint, changes: Partial<CapturedEvent> = {}): CapturedEvent {
  return {
    id, domain: "web-performance-us", sequence: receipt, portId: "midi", sessionId: "session", channel: 0,
    kind: "note-on", note: 60, velocity: 90, controller: 0, value: 0, sourceTimestamp: source,
    receiptTimestamp: receipt, missingSourceTimestamp: source === null, raw: [0x90, 60, 90], origin: "raw-midi",
    elapsedSource: source === null ? null : 999n, elapsedReceipt: 999n, scheduleElapsed: 999n, ...changes,
  };
}

describe("explicit Record/Stop interval", () => {
  it("keeps lead and tail silence and the full phrase through a long rest", () => {
    const input = [
      event("first", 1_500_000n, 1_505_000n),
      event("first-off", 1_700_000n, 1_705_000n, { kind: "note-off", velocity: 0 }),
      event("second", 7_000_000n, 7_010_000n, { note: 67 }),
      event("second-off", 7_200_000n, 7_210_000n, { kind: "note-off", note: 67, velocity: 0 }),
    ];
    const result = recordedTake(input, 1_000_000n, 9_000_000n);
    expect(result.bounds).toEqual({ start: 0n, end: 8_000_000n });
    expect(result.events.map(item => item.id)).toEqual(input.map(item => item.id));
    expect(result.events.map(item => item.scheduleElapsed)).toEqual([500_000n, 700_000n, 6_000_000n, 6_200_000n]);
    expect(result.events[0].elapsedReceipt).toBe(505_000n);
  });

  it("gates by receipt, excludes outside events, and retains an exact-stop release", () => {
    const input = [event("before", 99n, 99n), event("start", 100n, 100n), event("stop", 200n, 200n, { kind: "note-off", velocity: 0 }), event("after", 199n, 201n)];
    expect(recordedTake(input, 100n, 200n).events.map(item => item.id)).toEqual(["start", "stop"]);
  });

  it("uses the shared source clock and receipt fallback without rewriting captured timestamps or bytes", () => {
    const input = [event("source", 125n, 140n), event("missing", null, 150n), event("late", 90n, 110n)];
    const before = structuredClone(input);
    const result = recordedTake(input, 100n, 200n);
    expect(result.events.map(item => [item.id, item.scheduleElapsed])).toEqual([["late", -10n], ["source", 25n], ["missing", 50n]]);
    const copied = result.events.find(item => item.id === "source")!;
    expect(copied).toMatchObject({ sourceTimestamp: 125n, receiptTimestamp: 140n, elapsedSource: 25n, elapsedReceipt: 40n, raw: [0x90, 60, 90] });
    expect(copied).not.toBe(input[0]); expect(copied.raw).not.toBe(input[0].raw);
    expect(Object.isFrozen(copied)).toBe(true); expect(Object.isFrozen(copied.raw)).toBe(true);
    expect(input).toEqual(before);
  });

  it("allows an explicit silent recording without inventing notes or shortening its bounds", () => {
    expect(recordedTake([], 100n, 500n)).toEqual({ events: [], bounds: { start: 0n, end: 400n } });
  });

  it("rejects invalid intervals and mixed clock domains", () => {
    for (const [start, end] of [[-1n, 1n], [1n, 1n], [2n, 1n]]) expect(() => recordedTake([], start, end)).toThrow(RangeError);
    const native = event("native", 100n, 100n, { domain: "android-monotonic-ns" });
    expect(() => recordedTake([native], 0n, 200n)).toThrow(/clock domain/);
    expect(() => recordedTake([native, event("web", 100n, 100n)], 0n, 200n, "android-monotonic-ns")).toThrow(/clock domain/);
  });
});
