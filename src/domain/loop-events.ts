import type { CapturedEvent } from "./capture";

/** A loop is [start, end): releases at its end are valid, new attacks are not. */
export function loopEvents(events: readonly CapturedEvent[], bounds: { start: bigint; end: bigint }): CapturedEvent[] {
  return events.filter(event => {
    if (event.scheduleElapsed < bounds.start || event.scheduleElapsed > bounds.end) return false;
    if (event.id.endsWith(":seed") || event.id.endsWith(":hold")) return false;
    return event.scheduleElapsed < bounds.end || event.kind !== "note-on" || event.velocity === 0;
  });
}
