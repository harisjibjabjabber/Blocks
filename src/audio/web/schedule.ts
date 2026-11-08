export interface PlannedEvent {
  audioTimeSec: number;
  elapsedUs: bigint;
  kind: "note-on" | "note-off" | "cc" | "pitch" | "other";
  channel: number;
  note: number;
  velocity: number;
  controller: number;
  value: number;
}

/** Next audio-clock start on an existing transport. A null epoch means this layer is the first and starts after `lead` seconds. */
export function joinAtSeam(now: number, epoch: number | null, period: number | null, lead = 0.05): { start: number; epoch: number } {
  if (epoch === null || period === null || !(period > 0)) {
    return { start: now + lead, epoch: now + lead };
  }
  const earliest = now + lead;
  if (earliest <= epoch) {
    return { start: epoch, epoch };
  }
  const steps = Math.ceil((earliest - epoch) / period);
  return { start: epoch + steps * period, epoch };
}

export function planFromElapsed(args: {
  audioStartSec: number;
  elapsedUs: bigint;
  anchorElapsedUs: bigint;
  stretch: number;
}): number {
  const deltaUs = args.elapsedUs - args.anchorElapsedUs;
  const seconds = Number(deltaUs) / 1_000_000;
  return args.audioStartSec + seconds * (args.stretch > 0 ? args.stretch : 1);
}

export interface DueDecision {
  when: number;
  late: boolean;
  drop: boolean;
}

export function liveAudioTime(args: {
  audioNowSec: number;
  performanceNowMs: number;
  eventTimeStampMs: number;
  lateToleranceSec: number;
}): DueDecision {
  const deltaSec = (args.eventTimeStampMs - args.performanceNowMs) / 1000;
  const when = args.audioNowSec + deltaSec;
  if (when < args.audioNowSec - args.lateToleranceSec) {
    return { when: args.audioNowSec, late: true, drop: true };
  }
  if (when < args.audioNowSec) {
    return { when: args.audioNowSec, late: true, drop: false };
  }
  return { when, late: false, drop: false };
}

export function selectDue(args: {
  planned: PlannedEvent[];
  nextIndex: number;
  audioNowSec: number;
  lookaheadSec: number;
  lateToleranceSec: number;
}): { index: number; due: PlannedEvent[]; late: number; dropped: number } {
  const horizon = args.audioNowSec + args.lookaheadSec;
  const due: PlannedEvent[] = [];
  let index = args.nextIndex;
  let late = 0;
  let dropped = 0;
  while (index < args.planned.length && args.planned[index].audioTimeSec <= horizon) {
    const event = args.planned[index];
    index += 1;
    if (event.audioTimeSec < args.audioNowSec - args.lateToleranceSec) {
      late += 1;
      dropped += 1;
      continue;
    }
    if (event.audioTimeSec < args.audioNowSec) {
      late += 1;
      due.push({ ...event, audioTimeSec: args.audioNowSec });
      continue;
    }
    due.push(event);
  }
  return { index, due, late, dropped };
}
