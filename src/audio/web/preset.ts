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
