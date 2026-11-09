import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("synth presets rendered in real OfflineAudioContext", () => {
  it("renders a distinct dynamic pad and audible ADSR changes, with clean release and panic", () => {
    const measured = JSON.parse(execFileSync(process.execPath, ["scripts/measure-synth.mjs"], { encoding: "utf8" })) as Record<string, { early: number; attack: number; sustain: number; released: number; pedal: number; silence: number; peak: number }>;
    expect(measured.pad.attack).toBeGreaterThan(.003);
    expect(measured.pad.sustain).toBeGreaterThan(measured.ep.sustain * 1.5);
    expect(measured.fast.early).toBeGreaterThan(measured.slow.early * 5);
    expect(measured.pad.attack).toBeGreaterThan(measured.quiet.attack * 2);
    expect(measured.pad.sustain).toBeGreaterThan(measured.lowSustain.sustain * 3);
    expect(measured.longDecay.sustain).toBeGreaterThan(measured.shortDecay.sustain * 1.8);
    expect(measured.longRelease.released).toBeGreaterThan(.0002);
    expect(measured.pad.released).toBe(0);
    expect(measured.pedal.pedal).toBeGreaterThan(.002);
    expect(measured.longRelease.pedal).toBeLessThan(measured.longRelease.sustain);
    expect(measured.quiet.pedal).toBeLessThan(measured.quiet.sustain);
    for (const sample of Object.values(measured)) { expect(sample.silence).toBe(0); expect(sample.peak).toBeLessThan(1); }
    expect(measured.stopped.attack).toBe(0);
  }, 30000);
});
