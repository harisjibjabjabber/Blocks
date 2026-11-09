import { describe, expect, it } from "vitest";
import { LayerTape } from "./layer-tape";
import type { IncomingEvent } from "./capture";

function event(sequence: number, time: number, kind: IncomingEvent["kind"] = "note-on", note = 60): IncomingEvent {
  return { domain: "web-performance-us", sequence: BigInt(sequence), portId: "test", sessionId: "s", channel: 0, kind, note, velocity: kind === "note-on" ? 90 : 0, controller: kind === "cc" ? 64 : 0, value: kind === "cc" ? 127 : 0, sourceTimestamp: BigInt(time), receiptTimestamp: BigInt(time), missingSourceTimestamp: false, raw: [], origin: "raw-midi" };
}
const tape = () => new LayerTape("web-performance-us", 120_000_000n, 4096, 262144);
describe("layer tape membership", () => {
  it("starts empty after capture without resetting absolute session timing", () => {
    const t = tape(); t.push(event(1, 100)); t.push(event(2, 200, "note-off"));
    const old = t.snapshot(); t.advance(); expect(t.snapshot()).toEqual([]);
    t.push(event(3, 300, "note-on", 67)); t.push(event(4, 400, "note-off", 67));
    expect(t.snapshot().map(e => e.note)).toEqual([67, 67]);
    expect(t.snapshot()[0].scheduleElapsed).toBe(200n);
    expect(old.map(e => e.scheduleElapsed)).toEqual([0n, 100n]);
  });
  it("carries pedal context but no old attacks, orphan releases or blank duration", () => {
    const t = tape(); t.push(event(1, 100, "cc")); t.push(event(2, 200)); t.advance();
    t.push(event(3, 300, "note-off")); expect(t.snapshot()).toEqual([]);
    t.push(event(4, 500, "note-on", 67));
    const next = t.snapshot(); expect(next.map(e => e.kind)).toEqual(["cc", "note-on"]);
    expect(next[0].value).toBe(127); expect(next[0].scheduleElapsed).toBe(next[1].scheduleElapsed);
    expect(next[0].sourceTimestamp).toBe(100n);
  });
  it("Undo merges new playing exactly once and retains its later release", () => {
    const t = tape(); t.push(event(1, 100)); t.push(event(2, 200, "note-off"));
    const before = t.checkpoint(); t.advance(); t.push(event(3, 300, "note-on", 67));
    t.restore(before); t.push(event(4, 400, "note-off", 67)); t.restore(before);
    expect(t.snapshot().map(e => e.id)).toEqual(["s:1", "s:2", "s:3", "s:4"]);
    expect(t.snapshot().map(e => e.scheduleElapsed)).toEqual([0n, 100n, 200n, 300n]);
  });
});
