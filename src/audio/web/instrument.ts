import { EP_PRESET, type SynthPreset } from "./preset";
import { clampEnvelope, type SynthEnvelope } from "../instruments";

export type VoiceSource = "touch" | "midi" | "replay" | "audition" | `replay:${string}`;

interface Voice {
  osc: OscillatorNode[];
  mod: OscillatorNode;
  modGain: GainNode;
  amp: GainNode;
  note: number;
  channel: number;
  keyDown: boolean;
  pedal: boolean;
  source: VoiceSource;
  startedAt: number;
  stopsAt: number;
  releaseSeconds: number;
  pedalReleaseSeconds: number;
  peak: number;
  shape: SynthEnvelope;
  releaseAt?: number;
  releaseLevel?: number;
  releaseDuration?: number;
}

export class WebElectricPiano {
  get presetId(): string { return this.preset.id; }
  private readonly master: GainNode;
  private readonly sourceOutputs = new Map<VoiceSource, GainNode>();
  private readonly voices: Voice[] = [];
  private readonly pedal = new Map<string, boolean>();
  private readonly expression = new Map<string, number>();
  private sustainCc = 64;
  private generation = 0;

  constructor(private readonly context: AudioContext, private readonly preset: SynthPreset = EP_PRESET) {
    this.master = context.createGain();
    this.master.gain.value = this.preset.outputGain;
    this.master.connect(context.destination);
  }

  setSustainController(cc: number): void {
    this.sustainCc = cc;
  }

  cancelAll(): void {
    this.generation += 1;
    for (const voice of this.voices) {
      this.stopVoice(voice, this.context.currentTime);
    }
    this.voices.length = 0;
    this.pedal.clear();
    this.expression.clear();
  }

  play(
    time: number,
    message: { kind: string; channel: number; note: number; velocity: number; controller: number; value: number; source?: VoiceSource },
    envelope?: SynthEnvelope,
  ): void {
    const offline = "startRendering" in this.context;
    if (this.context.state !== "running" && !offline) {
      return;
    }
    const when = Math.max(time, this.context.currentTime);
    const source = message.source ?? "midi";
    if (message.kind === "note-on" && message.velocity > 0) {
      this.noteOn(when, message.channel, message.note, message.velocity, source, envelope);
    } else if (message.kind === "note-off" || (message.kind === "note-on" && message.velocity === 0)) {
      this.noteOff(when, message.channel, message.note, source);
    } else if (message.kind === "cc") {
      if (message.controller === this.sustainCc) {
        this.setPedal(when, message.channel, message.value >= 64, source);
      } else if (message.controller === 11) {
        this.expression.set(source + ":" + message.channel, message.value);
      }
    }
  }

  setSourceVolume(source: VoiceSource, volume: number): void {
    let output = this.sourceOutputs.get(source);
    if (!output) { output = this.context.createGain(); output.gain.value = 1; output.connect(this.master); this.sourceOutputs.set(source, output); }
    output.gain.cancelScheduledValues(this.context.currentTime);
    output.gain.setValueAtTime(output.gain.value, this.context.currentTime);
    output.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), this.context.currentTime + 0.015);
  }
  releasePitch(source: VoiceSource, channel: number, note: number, time: number): void {
    for (const voice of this.voices.filter(v => v.source === source && v.channel === channel && v.note === note)) this.release(voice, time, 0.015);
  }
  private outputFor(source: VoiceSource): GainNode {
    if (!this.sourceOutputs.has(source)) this.setSourceVolume(source, 1);
    return this.sourceOutputs.get(source)!;
  }
  releaseSource(source: VoiceSource, time: number, releaseSeconds?: number): void {
    for (const voice of this.voices.filter((item) => item.source === source)) {
      this.release(voice, Math.max(time, this.context.currentTime), releaseSeconds ?? (voice.pedal ? voice.pedalReleaseSeconds : voice.releaseSeconds));
    }
    for (let channel = 0; channel < 16; channel += 1) {
      this.pedal.delete(source + ":" + channel);
      this.expression.delete(source + ":" + channel);
    }
  }

  /** Scheduled voice lifetime, including the instrument's release envelope. */
  soundingPitches(source: VoiceSource): readonly number[] {
    this.prune();
    const now = this.context.currentTime;
    return [...new Set(this.voices.filter((voice) => voice.source === source && voice.startedAt <= now && now < voice.stopsAt).map((voice) => voice.note))].sort((a, b) => a - b);
  }

  private prune(): void {
    for (let index = this.voices.length - 1; index >= 0; index -= 1) {
      if (this.voices[index].stopsAt <= this.context.currentTime) this.voices.splice(index, 1);
    }
  }

  silenceAll(): void {
    this.cancelAll();
  }

  private noteOn(time: number, channel: number, note: number, velocity: number, source: VoiceSource, envelope?: SynthEnvelope): void {
    const shape = clampEnvelope(envelope, this.preset.id);
    this.prune();
    const existing = this.voices.find((voice) => voice.source === source && voice.channel === channel && voice.note === note && voice.keyDown);
    if (existing) {
      this.release(existing, time, 0.02);
    }
    while (this.voices.length >= 12) {
      const released = this.voices.find((voice) => !voice.keyDown) ?? this.voices[0];
      this.stopVoice(released, time);
      this.voices.splice(this.voices.indexOf(released), 1);
    }
    const frequency = this.preset.tuningA4Hz * 2 ** ((note - 69) / 12);
    const velocityGain = (velocity / 127) ** this.preset.velocityCurve;
    const carrier = this.context.createOscillator();
    const mod = this.context.createOscillator();
    const modGain = this.context.createGain();
    const amp = this.context.createGain();
    const tremolo = this.context.createOscillator();
    const tremoloGain = this.context.createGain();
    const tremoloOffset = this.context.createGain();
    const pad = this.preset.id === "blocks.pad.warm.v1";
    carrier.type = pad ? "triangle" : "sine";
    mod.type = pad ? "sawtooth" : "sine";
    tremolo.type = "sine";
    carrier.frequency.setValueAtTime(frequency, time);
    mod.frequency.setValueAtTime(frequency * (pad ? 2 ** (5 / 1200) : this.preset.modulatorRatio), time);
    tremolo.frequency.setValueAtTime(this.preset.tremoloRateHz, time);
    const index = this.preset.modIndexAtFullVelocity * (0.35 + 0.65 * velocityGain) * frequency;
    if (pad) {
      // A quiet detuned saw adds movement behind the triangle. The filter keeps
      // the upper register soft; envelope and dynamics remain velocity driven.
      const filter = this.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.min(7000, 850 + frequency * (1.5 + velocityGain)), time);
      filter.Q.setValueAtTime(0.5, time);
      modGain.gain.setValueAtTime(0.22, time);
      mod.connect(modGain); modGain.connect(filter);
      carrier.connect(filter); filter.connect(amp);
    } else {
      modGain.gain.setValueAtTime(index, time);
      modGain.gain.exponentialRampToValueAtTime(Math.max(1, index * 0.15), time + this.preset.decaySeconds);
      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(amp);
    }
    tremoloGain.gain.setValueAtTime(this.preset.tremoloDepth, time);
    tremolo.connect(tremoloGain);
    tremoloGain.connect(tremoloOffset.gain);
    tremoloOffset.gain.setValueAtTime(1 - this.preset.tremoloDepth, time);
    amp.connect(tremoloOffset);
    tremoloOffset.connect(this.outputFor(source));
    const peak = 0.2 * velocityGain * ((this.expression.get(source + ":" + channel) ?? 127) / 127);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + shape.attackMs / 1000);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * shape.sustain), time + (shape.attackMs + shape.decayMs) / 1000);
    carrier.start(time);
    mod.start(time);
    tremolo.start(time);
    this.voices.push({
      osc: [carrier, tremolo],
      mod,
      modGain,
      amp,
      note,
      channel,
      keyDown: true,
      pedal: false,
      source,
      startedAt: time,
      stopsAt: Infinity,
      releaseSeconds: shape.releaseMs / 1000,
      pedalReleaseSeconds: envelope ? shape.releaseMs / 1000 : this.preset.pedalReleaseSeconds,
      peak: Math.max(0.0002, peak),
      shape,
    });
  }

  private noteOff(time: number, channel: number, note: number, source: VoiceSource): void {
    const voice = this.voices.find((item) => item.source === source && item.channel === channel && item.note === note && item.keyDown);
    if (!voice) {
      return;
    }
    voice.keyDown = false;
    if (this.pedal.get(source + ":" + channel)) {
      voice.pedal = true;
      return;
    }
    this.release(voice, time, voice.releaseSeconds);
  }

  private setPedal(time: number, channel: number, down: boolean, source: VoiceSource): void {
    this.pedal.set(source + ":" + channel, down);
    if (!down) {
      for (const voice of this.voices.filter((item) => item.source === source && item.channel === channel && item.pedal && !item.keyDown)) {
        this.release(voice, time, voice.pedalReleaseSeconds);
      }
    }
  }

  private release(voice: Voice, time: number, seconds: number): void {
    const stopsAt = time + seconds + 0.03;
    if (voice.stopsAt <= stopsAt) return;
    voice.keyDown = false;
    const gain = voice.amp.gain;
    const floor = 0.0001;
    const exp = (from: number, to: number, fraction: number) => from * (to / from) ** Math.max(0, Math.min(1, fraction));
    const elapsed = time - voice.startedAt;
    const attack = voice.shape.attackMs / 1000;
    const decay = voice.shape.decayMs / 1000;
    const sustain = Math.max(floor, voice.peak * voice.shape.sustain);
    const level = voice.releaseAt !== undefined && time >= voice.releaseAt
      ? exp(voice.releaseLevel!, floor, (time - voice.releaseAt) / voice.releaseDuration!)
      : elapsed < attack ? exp(floor, voice.peak, elapsed / attack)
        : exp(voice.peak, sustain, (elapsed - attack) / decay);
    let held = false;
    if (typeof gain.cancelAndHoldAtTime === "function") {
      try {
        gain.cancelAndHoldAtTime(time);
        held = true;
      } catch {
        gain.cancelScheduledValues(time);
      }
    } else {
      gain.cancelScheduledValues(time);
    }
    // .value describes the current instant, not a future scheduled release.
    // Keep the analytical ADSR value so scheduling never amplifies a quiet key.
    if (!held && time > voice.startedAt) gain.exponentialRampToValueAtTime(level, time);
    gain.setValueAtTime(level, time);
    gain.exponentialRampToValueAtTime(floor, time + seconds);
    voice.releaseAt = time; voice.releaseLevel = level; voice.releaseDuration = seconds;
    this.stopVoice(voice, stopsAt);
  }

  private stopVoice(voice: Voice, time: number): void {
    voice.stopsAt = Math.min(voice.stopsAt, time);
    for (const osc of voice.osc) {
      try {
        osc.stop(time);
      } catch {
        // already stopped
      }
    }
    try {
      voice.mod.stop(time);
    } catch {
      // already stopped
    }
  }
}
