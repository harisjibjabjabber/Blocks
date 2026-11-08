/** Loop bounds over a retained history. Moving a bound does not edit or delete events. */

export interface RangeBounds {
  start: bigint;
  end: bigint;
}

export function playbackEvents<T extends { scheduleElapsed: bigint }>(events: readonly T[], bounds: RangeBounds): T[] {
  return events.filter((event) => event.scheduleElapsed >= bounds.start && event.scheduleElapsed <= bounds.end);
}

export function moveBound(current: RangeBounds, edge: "start" | "end", time: bigint, floor: bigint, ceiling: bigint): RangeBounds {
  if (edge === "start") {
    let start = time;
    if (start < floor) {
      start = floor;
    }
    if (start >= current.end) {
      start = current.end - 1n;
    }
    return { start, end: current.end };
  }
  let end = time;
  if (end > ceiling) {
    end = ceiling;
  }
  if (end <= current.start) {
    end = current.start + 1n;
  }
  return { start: current.start, end };
}

export function timeAt(x: number, width: number, origin: bigint, span: bigint): bigint {
  if (width <= 0 || span <= 0n) {
    return origin;
  }
  const ratio = Math.min(1, Math.max(0, x / width));
  return origin + BigInt(Math.round(ratio * Number(span)));
}

/** One previous pair of bounds. A second correction replaces it; undo returns this pair once. */
export function undoRange(previous: RangeBounds | null, current: RangeBounds): RangeBounds {
  return previous ?? current;
}
