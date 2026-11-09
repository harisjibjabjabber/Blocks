import { describe, expect, it } from "vitest";
import type { CapturedEvent } from "./capture";
import { inferPulse } from "./inference";
import { MIDI_TEMPO_ONSET_LIMIT, midiTempoCandidates } from "./midi-tempo";

const series = (length: number, spacing: number, offset = 0) => Array.from({ length }, (_, i) => offset + i * spacing);
function events(times: number[]): CapturedEvent[] {
  return times.map((seconds, i) => {
    const time = BigInt(Math.round(seconds * 1_000_000));
    return { id: `n${i}`, kind: "note-on", velocity: 90, note: 60, channel: 0, controller: 0, value: 0, origin: "raw-midi", domain: "web-performance-us", portId: "test", sessionId: "test", sequence: BigInt(i), scheduleElapsed: time, sourceTimestamp: time, receiptTimestamp: time, elapsedSource: time, elapsedReceipt: time, missingSourceTimestamp: false, raw: [0x90, 60, 90] };
  });
}

describe("MIDI onset tempo candidates via pinned music-tempo", () => {
  it.each([[.5, 120], [.6, 100]])("finds the centre of exact%s-second intervals, not the old tolerance-plateau edge", (interval, bpm) => {
    const input = events(series(16, interval));
    const before = structuredClone(input);
    const report = inferPulse(input, 1_000_000);
    expect(report.pulse).toBe("estimated"); expect(report.bpm).toBeCloseTo(bpm, 5);
    expect(report.periodTicks).toBe(BigInt(Math.round(interval * 1_000_000)));
    expect(report.ambiguity).toBe("half-double"); expect(input).toEqual(before);
  });

  it("does not mistake a beat phase for an identified downbeat", () => {
    const times = series(16, .5, 100.25);
    const evidence = midiTempoCandidates(events(times).map(event => event.scheduleElapsed), 1_000_000);
    expect(evidence.candidates[0].bpm).toBeCloseTo(120, 5);
    expect(evidence.candidates[0].phaseTicks).toBe(100_250_000n);
    const report = inferPulse(events(times), 1_000_000);
    expect(report.reason).toMatch(/does not prove the bar or downbeat/);
    expect(report.pickupCandidate).toBe(false);
  });

  it("retains a pickup and competing phases for unaccented eighths", () => {
    const pickup = inferPulse(events([0, ...series(16, .5, .25)]), 1_000_000);
    expect(pickup.bpm).toBeCloseTo(120, 5); expect(pickup.pickupCandidate).toBe(true);
    const evidence = midiTempoCandidates(events(series(32, .25)).map(event => event.scheduleElapsed), 1_000_000);
    expect(evidence.ambiguous).toBe(true);
    expect(evidence.candidates.slice(0, 2).map(candidate => candidate.phaseTicks)).toEqual([0n, 250_000n]);
  });

  it("keeps swing and syncopation as timing evidence instead of quantising input", () => {
    const swing = events(series(16, .5).flatMap(time => [time, time + 1 / 3]));
    const before = structuredClone(swing);
    const report = inferPulse(swing, 1_000_000);
    expect(report.bpm).toBeCloseTo(120, 2); expect(report.swing).not.toBeNull();
    expect(report.ambiguity).toBe("half-double"); expect(swing).toEqual(before);
    const syncopation = inferPulse(events([0, .75, 1, 1.5, 2.25, 2.75, 3, 3.5, 4, 4.75, 5, 5.5, 6.25, 6.75, 7, 7.5]), 1_000_000);
    expect(syncopation.bpm).toBeCloseTo(120, 2); expect(syncopation.syncopationCount).toBeGreaterThan(0);
  });

  it("groups tightly rolled chords and stays near the beat under small timing perturbations", () => {
    const chords = events(series(16, .5).flatMap(time => [time, time + .012, time + .024]));
    expect(inferPulse(chords, 1_000_000).bpm).toBeCloseTo(120, 4);
    const jittered = events(series(24, .6).map((time, i) => time + [0, .009, -.006, .004][i % 4]));
    const report = inferPulse(jittered, 1_000_000);
    expect(report.bpm).toBeGreaterThan(99); expect(report.bpm).toBeLessThan(101);
  });

  it("does not present sparse chord spacing as proof of four bars or120BPM", () => {
    const report = inferPulse(events([0, 2, 4, 6]), 1_000_000);
    expect(report.pulse).toBe("estimated"); expect(report.bpm).toBeCloseTo(60, 4);
    expect(report.ambiguity).toBe("half-double");
    expect(report.reason).toMatch(/Sparse attacks/); expect(report.reason).toMatch(/prior/);
  });

  it("retains the existing gap analysis while the candidate adapter abstains after long untracked rests", () => {
    const input = events([...series(8, .5), ...series(8, .5, 16)]);
    const report = inferPulse(input, 1_000_000);
    expect(report.gaps).toHaveLength(1); expect(report.bpm).toBeCloseTo(120, 4);
    expect(midiTempoCandidates(input.map(event => event.scheduleElapsed), 1_000_000).candidates).toEqual([]);
  });

  it("requires four distinct onset groups and caps candidate work to the latest512", () => {
    expect(midiTempoCandidates([0n, 300_000n, 900_000n], 1_000_000).candidates).toEqual([]);
    expect(inferPulse(events([0, .3, .9]), 1_000_000).bpm).toBeNull();
    const input = events(series(4096, .025)).map(event => event.scheduleElapsed);
    const evidence = midiTempoCandidates(input, 1_000_000);
    expect(evidence.truncated).toBe(true); expect(evidence.analysedOnsets).toBe(MIDI_TEMPO_ONSET_LIMIT);
    expect(input).toHaveLength(4096);
  });
});
