export const EP_PRESET = {
  id: "blocks.ep.fm.v1",
  name: "Warm EP",
  tuningA4Hz: 440,
  velocityCurve: 1.5,
  modulatorRatio: 1,
  modIndexAtFullVelocity: 2.4,
  // Tunable envelope. These are not durations anyone set as a target.
  attackSeconds: 0.006,
  decaySeconds: 2.2,
  sustainLevel: 0.16,
  releaseSeconds: 0.4,
  pedalReleaseSeconds: 1.1,
  tremoloRateHz: 4.8,
  tremoloDepth: 0.15,
  outputGain: 10 ** (-9 / 20),
} as const;

/** Original procedural two-oscillator pad; no samples or third-party DSP. */
export const PAD_PRESET = {
  ...EP_PRESET,
  id: "blocks.pad.warm.v1",
  name: "Warm Pad",
  attackSeconds: 0.16,
  decaySeconds: 1.0,
  sustainLevel: 0.72,
  releaseSeconds: 0.7,
  pedalReleaseSeconds: 0.9,
  tremoloRateHz: 0.7,
  tremoloDepth: 0.05,
  outputGain: 10 ** (-12 / 20),
} as const;

export type SynthPreset = { [K in keyof typeof EP_PRESET]: (typeof EP_PRESET)[K] extends number ? number : string };
