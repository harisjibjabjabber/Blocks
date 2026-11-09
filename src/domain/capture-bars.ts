import type { CapturedEvent } from "./capture";
import { withCaptureRange, type RecentPhraseCut } from "./recent-phrase";

/** A soft length preference, not a claim to have detected meter or intention.
 * Keep the phrase finder's end (including its final rhythmic slot), and only
 * shorten an overlong prefix when a real attack is close to the expected start.
 * The full source tape remains available for recovery. */
export function preferCaptureBars(events: readonly CapturedEvent[], cut: RecentPhraseCut, bpm: number | null, bars: 4 | 8 | null, beatsPerBar: number, ticksPerSecond: number): RecentPhraseCut {
  if (!bars || !bpm || !Number.isFinite(bpm) || bpm <= 0) return cut;
  const beat = BigInt(Math.round(60 * ticksPerSecond / bpm));
  if (beat <= 0n) return cut;
  const length = beat * BigInt(bars * beatsPerBar);
  if (cut.loop.end - cut.loop.start <= length + beat / 2n) return cut;
  const attacks = [...new Set(events.filter(e => e.kind === "note-on" && e.velocity > 0 && e.scheduleElapsed >= cut.selection.start && e.scheduleElapsed <= cut.selection.end).map(e => e.scheduleElapsed))].sort((a,b) => a < b ? -1 : 1);
  if (attacks.length < 8) return cut;
  const expected = cut.loop.end - length;
  // Half a beat permits pickups and timing looseness without jumping to a
  // distant attack; favour the earliest plausible attack to avoid clipping.
  const start = attacks.find(t => t > cut.selection.start && t >= expected - beat / 2n && t <= expected + beat / 2n);
  if (start === undefined) return cut;
  return { ...withCaptureRange(events, cut, { start, end: cut.loop.end }),
    note: `Suggested ${bars}-bar window near a played attack. Length is a preference, not detected intent. Earlier notes remain in the take.` };
}
