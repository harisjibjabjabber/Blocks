import { describe, expect, it } from "vitest";
import { loopEvents } from "./loop-events";
import type { CapturedEvent } from "./capture";

describe("raw loop boundaries", () => {
  const event = (id: string, at: bigint, changes: Partial<CapturedEvent> = {}): CapturedEvent => ({ id, kind: "note-on", scheduleElapsed: at, elapsedSource: at, elapsedReceipt: at, sourceTimestamp: at, receiptTimestamp: at, domain: "web-performance-us", sequence: at, portId: "test", sessionId: "test", channel: 0, note: 60, velocity: 90, controller: 0, value: 0, missingSourceTimestamp: false, origin: "raw-midi", raw: [0x90, 60, 90], ...changes });
  it("seeds an attack held across a manual range without moving raw history", () => {
    const input = [event("on", 0n), event("off", 500n, { kind: "note-off", velocity: 0 })];
    const before = structuredClone(input);
    const result = loopEvents(input, { start: 100n, end: 225n });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "on:hold", scheduleElapsed: 100n, sourceTimestamp: 0n, note: 60, velocity: 90 });
    expect(result[0]).not.toBe(input[0]); expect(input).toEqual(before);
  });
  it("retains pedal-held notes per channel without treating released notes as finger holds", () => {
    const input = [event("on", 0n), event("other-on", 1n, { channel: 1 }), event("down", 10n, { kind: "cc", controller: 64, value: 127 }), event("off", 20n, { kind: "note-off", velocity: 0 }), event("other-off", 21n, { channel: 1, kind: "note-off", velocity: 0 }), event("up", 200n, { kind: "cc", controller: 64, value: 0 })];
    const result = loopEvents(input, { start: 100n, end: 250n });
    expect(result.map(item => item.id)).toEqual(["on:hold", "off:hold", "up"]);
    expect(result[0].scheduleElapsed).toBe(100n); expect(result[1].scheduleElapsed).toBe(100n);
    expect(loopEvents(input, { start: 225n, end: 250n })).toEqual([]);
  });

  it("does not replay a new attack at end, but preserves release and pedal bytes there", () => {
    const event = (id: string, kind: CapturedEvent["kind"], time: bigint, velocity: number): CapturedEvent => ({
      id, kind, scheduleElapsed: time, elapsedSource: time, elapsedReceipt: time, sourceTimestamp: time, receiptTimestamp: time,
      domain: "web-performance-us", sequence: 1n, portId: "test", sessionId: "test", channel: 0, note: 60,
      velocity, controller: 64, value: 0, missingSourceTimestamp: false, origin: "raw-midi", raw: [0x90, 60, velocity],
    });
    const input = Object.freeze([
      Object.freeze(event("earlier", "note-on", 0n, 90)),
      Object.freeze(event("on", "note-on", 100n, 90)),
      Object.freeze(event("next-on", "note-on", 200n, 90)),
      Object.freeze(event("off", "note-off", 200n, 0)),
      Object.freeze(event("zero-off", "note-on", 200n, 0)),
      Object.freeze(event("pedal", "cc", 200n, 0)),
    ]);
    const before = structuredClone(input);
    const result = loopEvents(input, { start: 100n, end: 200n });
    expect(result.map(event => event.id)).toEqual(["on", "off", "zero-off", "pedal"]);
    expect(result[0]).toBe(input[1]);
    expect(input).toEqual(before);
  });
});
