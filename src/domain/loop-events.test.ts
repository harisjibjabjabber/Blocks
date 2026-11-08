import { describe, expect, it } from "vitest";
import { loopEvents } from "./loop-events";
import type { CapturedEvent } from "./capture";

describe("raw loop boundaries", () => {
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
