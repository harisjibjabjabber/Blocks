import { ENVELOPE_RANGES, type SynthEnvelope } from "../audio/instruments";
import type { Palette } from "./theme";

export interface SynthControlsProps {
  palette: Palette;
  envelope: SynthEnvelope;
  onChange: (envelope: SynthEnvelope) => void;
}

export type EnvelopeParameter = keyof SynthEnvelope;
export const ENVELOPE_CONTROLS: readonly { key: EnvelopeParameter; label: string }[] = [
  { key: "attackMs", label: "Attack" },
  { key: "decayMs", label: "Decay" },
  { key: "sustain", label: "Sustain" },
  { key: "releaseMs", label: "Release" },
];
const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

/** Time dials are logarithmic so short attacks retain useful travel. */
export function envelopeDialUnit(key: EnvelopeParameter, value: number): number {
  const [min, max] = ENVELOPE_RANGES[key];
  const bounded = Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
  return key === "sustain" ? (bounded - min) / (max - min) : Math.log(bounded / min) / Math.log(max / min);
}

export function envelopeDialValue(key: EnvelopeParameter, unit: number): number {
  const [min, max] = ENVELOPE_RANGES[key];
  const position = clampUnit(unit);
  const value = key === "sustain" ? min + position * (max - min) : min * Math.pow(max / min, position);
  return key === "sustain" ? Math.round(value * 1000) / 1000 : Math.round(value);
}

export function envelopeValueLabel(key: EnvelopeParameter, value: number): string {
  if (key === "sustain") return `${Number((value * 100).toFixed(1))}%`;
  return value < 1000 ? `${Math.round(value)} ms` : `${Number((value / 1000).toFixed(2))} s`;
}

/** Rounded short time values must still advance on every keyboard step. */
export function stepEnvelopeDial(key: EnvelopeParameter, value: number, amount: number): number {
  const next = envelopeDialValue(key, envelopeDialUnit(key, value) + amount);
  if (next !== value || amount === 0) return next;
  const [min, max] = ENVELOPE_RANGES[key];
  return Math.max(min, Math.min(max, value + Math.sign(amount) * (key === "sustain" ? .001 : 1)));
}
