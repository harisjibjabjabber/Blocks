import { describe, expect, it } from "vitest";
import type { CapturedEvent } from "../domain/capture";
import { moveBound, playbackEvents, undoRange, type RangeBounds } from "./range";

function note(id: string, atMs: number): CapturedEvent {
  const at = BigInt(atMs * 1000);
  return {
    id,
    domain: "web-performance-us",
    sequence: 1n,
    portId: "t",
    sessionId: "t",
    channel: 0,
    kind: "note-on",
    note: 60,
    velocity: 90,
    controller: 0,
    value: 0,
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

describe("range handles over a retained history", () => {
  const history = [note("a", 0), note("b", 400), note("c", 800), note("d", 1200)];
  const captured: RangeBounds = { start: 800_000n, end: 2_000_000n };

  it("drops earlier notes from the loop and brings them back without deleting them", () => {
    const cropped = moveBound(captured, "start", 1_200_000n, 0n, 2_000_000n);
    expect(playbackEvents(history, cropped).map((event) => event.id)).toEqual(["d"]);
    expect(history.map((event) => event.id)).toEqual(["a", "b", "c", "d"]);
    const restored = moveBound(cropped, "start", 0n, 0n, 2_000_000n);
    expect(playbackEvents(history, restored).map((event) => event.id)).toEqual(["a", "b", "c", "d"]);
    expect(history[0].scheduleElapsed).toBe(0n);
  });

  it("undoes one bounds change and leaves the source list", () => {
    const cropped = moveBound(captured, "start", 1_200_000n, 0n, 2_000_000n);
    expect(undoRange(captured, cropped)).toEqual(captured);
    expect(history).toHaveLength(4);
  });

  it("drags the end through the silent ceiling and does not pass it", () => {
    const earlier = moveBound(captured, "end", 1_000_000n, 0n, 2_000_000n);
    expect(earlier.end).toBe(1_000_000n);
    expect(playbackEvents(history, earlier).map((event) => event.id)).toEqual(["c"]);
    const back = moveBound(earlier, "end", 2_000_000n, 0n, 2_000_000n);
    expect(back.end).toBe(2_000_000n);
    const past = moveBound(captured, "end", 9_000_000n, 0n, 2_000_000n);
    expect(past.end).toBe(2_000_000n);
  });
});
