import { expect, it } from "vitest";
import { preferCaptureBars } from "./capture-bars";
import { recentPhraseCut, withCaptureRange } from "./recent-phrase";
import type { CapturedEvent } from "./capture";

it("uses four bars as a soft prefix preference, preserves pickups, and honours eight/Free", () => {
  const events = Array.from({ length: 24 }, (_, i) => ({ id: String(i), kind: "note-on", velocity: 90, note: 60, channel: 0, scheduleElapsed: BigInt(i * 500000), sequence: BigInt(i), raw: [] } as unknown as CapturedEvent));
  const cut = withCaptureRange(events, recentPhraseCut(events, { ticksPerSecond: 1000000, gridPeriodTicks: null, gridOriginTicks: null, historyMayBeTruncated: false }), { start: 0n, end: 12000000n });
  const before = structuredClone(events);
  expect(preferCaptureBars(events, cut, 120, 4, 4, 1000000).loop).toEqual({ start: 4000000n, end: 12000000n });
  expect(preferCaptureBars(events, cut, 120, 8, 4, 1000000)).toBe(cut);
  expect(preferCaptureBars(events, cut, 120, null, 4, 1000000)).toBe(cut);
  const pickup = { ...events[0], id: "pickup", scheduleElapsed: 3800000n };
  expect(preferCaptureBars([...events, pickup], cut, 120, 4, 4, 1000000).loop.start).toBe(3800000n);
  expect(events).toEqual(before);
  expect(preferCaptureBars(events.filter(e => e.scheduleElapsed < 3500000n || e.scheduleElapsed > 4500000n), cut, 120, 4, 4, 1000000)).toBe(cut);
  expect(preferCaptureBars(events, cut, null, 4, 4, 1000000)).toBe(cut);
});
