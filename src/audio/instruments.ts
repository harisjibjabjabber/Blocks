export type InstrumentId = "blocks.ep.fm.v1" | "blocks.pad.warm.v1";

/** Sound metadata is independent of MIDI performance data. Samplers can use
 * the same routing contract once an actual sample library is available. */
export interface InstrumentDescriptor {
  id: InstrumentId;
  name: string;
  type: "synth" | "sampler";
}

export const INSTRUMENTS: readonly InstrumentDescriptor[] = [
  { id: "blocks.ep.fm.v1", name: "Warm EP", type: "synth" },
  { id: "blocks.pad.warm.v1", name: "Warm Pad", type: "synth" },
];

export function instrumentId(value: string): InstrumentId {
  return value === "blocks.pad.warm.v1" ? value : "blocks.ep.fm.v1";
}

export interface SynthEnvelope { attackMs: number; decayMs: number; sustain: number; releaseMs: number }
export const ENVELOPE_RANGES = { attackMs: [2, 3000], decayMs: [10, 5000], sustain: [0, 1], releaseMs: [20, 5000] } as const;
export function defaultEnvelope(id: string): SynthEnvelope {
  return id === "blocks.pad.warm.v1"
    ? { attackMs: 160, decayMs: 1000, sustain: 0.72, releaseMs: 700 }
    : { attackMs: 6, decayMs: 2200, sustain: 0.16, releaseMs: 400 };
}
export function clampEnvelope(value: SynthEnvelope | undefined, id = "blocks.ep.fm.v1"): SynthEnvelope {
  const result = defaultEnvelope(id);
  for (const key of Object.keys(result) as (keyof SynthEnvelope)[]) {
    const number = value?.[key];
    const [min, max] = ENVELOPE_RANGES[key];
    if (typeof number === "number" && Number.isFinite(number)) result[key] = Math.max(min, Math.min(max, number));
  }
  return result;
}
