/// <reference path="./music-tempo-types.d.ts" />
import TempoInduction from "music-tempo/dist/node/TempoInduction.js";
import BeatTracking from "music-tempo/dist/node/BeatTracking.js";

export const MIDI_TEMPO_ONSET_LIMIT = 512;
export interface MidiTempoCandidate {
  periodTicks: bigint;
  bpm: number;
  phaseTicks: bigint;
  score: number;
  acceptedOnsets: number;
}
export interface MidiTempoEvidence {
  candidates: MidiTempoCandidate[];
  ambiguous: boolean;
  sparse: boolean;
  analysedOnsets: number;
  truncated: boolean;
}

/** Pinned BeatRoot-derived candidate engine, given MIDI onset times, not audio.
 * The upstream 60–200 BPM initial octave prior is not evidence for a meter or
 * a downbeat. Agent scores/support thresholds are heuristics, not probabilities.
 * See docs/tempo-inference.md for attribution, benchmark and remaining limits. */
export function midiTempoCandidates(onsets: readonly bigint[], ticksPerSecond: number): MidiTempoEvidence {
  const empty = { candidates: [], ambiguous: false, sparse: false, analysedOnsets: 0, truncated: false };
  if (!Number.isFinite(ticksPerSecond) || ticksPerSecond <= 0 || onsets.length < 4) return empty;
  const ordered = [...new Set(onsets)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const window = ordered.slice(-MIDI_TEMPO_ONSET_LIMIT);
  const origin = window[0];
  const evidence = { ...empty, analysedOnsets: window.length, truncated: ordered.length > window.length };
  if (window.length < 4) return evidence;
  // Upstream seeds alternative phases during its first five seconds. Supplying
  // absolute session times would accidentally disable that initialisation.
  const times = window.map(time => Number(time - origin) / ticksPerSecond);
  if (!times.every(Number.isFinite)) return evidence;
  try {
    const clusters = TempoInduction.mergeClusters(TempoInduction.processRhythmicEvents(times));
    const scores = TempoInduction.calculateScore(clusters);
    const tempos = TempoInduction.createTempoList({ ...clusters, ...scores });
    const agents = BeatTracking.trackBeat(times, times.map(() => 1), tempos)
      .filter(agent => Number.isFinite(agent.beatInterval) && agent.beatInterval > 0 && Number.isFinite(agent.score) && agent.score > 0 && agent.events.length >= Math.max(4, Math.ceil(times.length * 0.4)))
      .sort((a, b) => b.score - a.score);
    const accepted = agents.filter(agent => {
      // Reject unsettled agents whose accepted beats do not support one useful
      // constant editing grid. Timing is never corrected in the source events.
      const errors = agent.events.slice(1).map((time, i) => {
        const beats = (time - agent.events[i]) / agent.beatInterval;
        return Math.abs(beats - Math.round(beats));
      }).sort((a, b) => a - b);
      return errors.length > 0 && errors[Math.floor(errors.length / 2)] <= 0.08 && errors[Math.floor((errors.length - 1) * 0.9)] <= 0.18;
    });
    const candidates = accepted.slice(0, 8).map(agent => ({
      periodTicks: BigInt(Math.round(agent.beatInterval * ticksPerSecond)),
      bpm: 60 / agent.beatInterval,
      phaseTicks: origin + BigInt(Math.round(agent.events[0] * ticksPerSecond)),
      score: agent.score,
      acceptedOnsets: agent.events.length,
    })).filter(candidate => candidate.periodTicks > 0n);
    const best = candidates[0];
    if (!best) return evidence;
    const gaps = times.slice(1).map((time, i) => time - times[i]).sort((a, b) => a - b);
    const sparse = gaps[Math.floor(gaps.length / 2)] > Number(best.periodTicks) / ticksPerSecond * 1.5;
    const ambiguous = sparse || candidates.slice(1).some(candidate => {
      if (candidate.score < best.score * 0.85) return false;
      const period = Number(best.periodTicks);
      const phase = Math.abs(Number(candidate.phaseTicks - best.phaseTicks)) % period;
      return Math.abs(Number(candidate.periodTicks - best.periodTicks)) > period * 0.04 || Math.min(phase, period - phase) > period * 0.08;
    });
    return { ...evidence, candidates, sparse, ambiguous };
  } catch {
    // The upstream package throws on empty IOI sets; absence is an honest result.
    return evidence;
  }
}
