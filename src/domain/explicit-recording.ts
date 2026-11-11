import type { CapturedEvent, TimeDomain } from "./capture";
import type { CutBounds } from "./recent-phrase";

/** Record/Stop uses an explicit clock interval, not a phrase-finder proposal.
 * For Web, both endpoints are performance.now() converted to microseconds.
 * Receipt time gates membership; source time retains the played timing. */
export function recordedTake(
  events: readonly CapturedEvent[],
  startReceiptTicks: bigint,
  endReceiptTicks: bigint,
  domain: TimeDomain = "web-performance-us",
): { events: CapturedEvent[]; bounds: CutBounds } {
  if (typeof startReceiptTicks !== "bigint" || typeof endReceiptTicks !== "bigint" || startReceiptTicks < 0n || endReceiptTicks <= startReceiptTicks) {
    throw new RangeError("Recording requires a non-negative start and a later stop in the same clock domain.");
  }
  if ((domain !== "web-performance-us" && domain !== "android-monotonic-ns") || events.some(event => event.domain !== domain)) {
    throw new Error("Recording events and Record/Stop endpoints must use the same clock domain.");
  }
  const recorded = events
    .filter(event => event.receiptTimestamp >= startReceiptTicks && event.receiptTimestamp <= endReceiptTicks)
    .map(event => {
      const elapsedSource = event.sourceTimestamp === null ? null : event.sourceTimestamp - startReceiptTicks;
      const elapsedReceipt = event.receiptTimestamp - startReceiptTicks;
      return Object.freeze({
        ...event,
        raw: event.raw ? Object.freeze(event.raw.slice()) : null,
        elapsedSource,
        elapsedReceipt,
        // A queued pre-start source event can be negative. Keep that timing;
        // playback bounds exclude it rather than silently moving its attack.
        scheduleElapsed: elapsedSource ?? elapsedReceipt,
      });
    })
    .sort((a, b) => a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : a.sequence < b.sequence ? -1 : a.sequence > b.sequence ? 1 : 0);
  return { events: recorded, bounds: { start: 0n, end: endReceiptTicks - startReceiptTicks } };
}
