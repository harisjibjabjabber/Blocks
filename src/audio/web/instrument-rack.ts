import { WebElectricPiano, type VoiceSource } from "./instrument";
import { EP_PRESET, PAD_PRESET } from "./preset";
import { clampEnvelope, instrumentId, type InstrumentId, type SynthEnvelope } from "../instruments";

/** Shared preset banks, with independent source ownership and ADSR snapshots.
 * Sample-backed voices can implement this same routing boundary later. */
export class WebInstrumentRack {
  private readonly banks: Record<InstrumentId, WebElectricPiano>;
  private readonly sources = new Map<VoiceSource, { id: InstrumentId; envelope?: SynthEnvelope }>();
  private readonly controllers = new Map<VoiceSource, Map<string, Parameters<WebElectricPiano["play"]>[1]>>();
  constructor(private readonly context: AudioContext) {
    this.banks = {
      "blocks.ep.fm.v1": new WebElectricPiano(context, EP_PRESET),
      "blocks.pad.warm.v1": new WebElectricPiano(context, PAD_PRESET),
    };
  }
  configure(source: VoiceSource, requested: string, envelope?: SynthEnvelope): InstrumentId {
    const id = instrumentId(requested);
    if ((this.sources.get(source)?.id ?? EP_PRESET.id) !== id) {
      const controls = [...(this.controllers.get(source)?.values() ?? [])];
      this.releaseSource(source, this.context.currentTime, 0.025);
      // Keep a physically held pedal/expression across a sound change without
      // emitting synthetic MIDI or retriggering held keys.
      for (const control of controls) this.banks[id].play(this.context.currentTime, control);
      if (controls.length) this.controllers.set(source, new Map(controls.map(control => [`${control.channel}:${control.controller}`, control])));
    }
    this.sources.set(source, { id, envelope: envelope ? clampEnvelope(envelope, id) : undefined });
    return id;
  }
  play(time: number, message: Parameters<WebElectricPiano["play"]>[1]): void {
    const source = message.source ?? "midi";
    if (message.kind === "cc") {
      const controls = this.controllers.get(source) ?? new Map();
      controls.set(`${message.channel}:${message.controller}`, { ...message, source });
      this.controllers.set(source, controls);
    }
    const config = this.sources.get(source);
    this.banks[config?.id ?? EP_PRESET.id].play(time, message, config?.envelope);
  }
  setSourceVolume(source: VoiceSource, volume: number): void { for (const bank of Object.values(this.banks)) bank.setSourceVolume(source, volume); }
  releasePitch(source: VoiceSource, channel: number, note: number, time: number): void { for (const bank of Object.values(this.banks)) bank.releasePitch(source, channel, note, time); }
  releaseSource(source: VoiceSource, time: number, seconds?: number): void {
    for (const bank of Object.values(this.banks)) bank.releaseSource(source, time, seconds);
    this.controllers.delete(source);
  }
  soundingPitches(source: VoiceSource): readonly number[] {
    return [...new Set(Object.values(this.banks).flatMap(bank => [...bank.soundingPitches(source)]))].sort((a,b) => a-b);
  }
  setSustainController(cc: number): void { for (const bank of Object.values(this.banks)) bank.setSustainController(cc); }
  cancelAll(): void { for (const bank of Object.values(this.banks)) bank.cancelAll(); this.controllers.clear(); }
  silenceAll(): void { this.cancelAll(); }
}
