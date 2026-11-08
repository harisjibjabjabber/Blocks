/**
 * Loop position from the audio clock the engine already owns.
 * The UI does not add wall time. Stop removes the slot, so there is no frozen playhead.
 */

export interface TransportSnapshot {
  availability: "unavailable" | "available";
  state: "playing" | "stopped";
  /** scheduleElapsed seconds from zero. Null until the audio clock has reached the cycle. */
  positionSeconds: number | null;
  originSeconds: number | null;
  revision: number;
}

export function readTransport(args: {
  audioRunning: boolean;
  hasSlot: boolean;
  now: number;
  cycleStart: number | null;
  duration: number | null;
  originUs: bigint | null;
  stretch: number;
  revision: number;
}): TransportSnapshot {
  const originSeconds = args.originUs === null ? null : Number(args.originUs) / 1_000_000;
  if (!args.audioRunning) {
    return { availability: "unavailable", state: "stopped", positionSeconds: null, originSeconds, revision: args.revision };
  }
  if (!args.hasSlot || args.cycleStart === null || args.duration === null || !(args.duration > 0) || args.originUs === null) {
    return { availability: "available", state: "stopped", positionSeconds: null, originSeconds, revision: args.revision };
  }
  const offset = args.now - args.cycleStart;
  if (!(offset >= 0)) {
    return { availability: "available", state: "playing", positionSeconds: null, originSeconds, revision: args.revision };
  }
  // cycleStart is the immutable audio start, not the scheduler's lookahead cursor.
  // This keeps the line present through silent tails and across timer delays.
  const cycle = Math.floor(offset / args.duration);
  const within = offset - cycle * args.duration;
  const stretch = args.stretch > 0 ? args.stretch : 1;
  return {
    availability: "available",
    state: "playing",
    positionSeconds: originSeconds! + within / stretch,
    originSeconds,
    revision: args.revision + cycle,
  };
}
