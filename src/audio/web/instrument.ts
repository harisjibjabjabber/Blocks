import { EP_PRESET } from "./preset";

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
}

export class WebElectricPiano {
  readonly presetId = EP_PRESET.id;
  private readonly master: GainNode;
  private readonly voices: Voice[] = [];
  private readonly pedal = new Map<string, boolean>();
  private readonly expression = new Map<string, number>();
  private sustainCc = 64;
  private generation = 0;

  constructor(private readonly context: AudioContext) {
    this.master = context.createGain();
    this.master.gain.value = EP_PRESET.outputGain;
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
  ): void {
    const offline = "startRendering" in this.context;
    if (this.context.state !== "running" && !offline) {
      return;
    }
    const when = Math.max(time, this.context.currentTime);
    const source = message.source ?? "midi";
    if (message.kind === "note-on" && message.velocity > 0) {
      this.noteOn(when, message.channel, message.note, message.velocity, source);
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

  releaseSource(source: VoiceSource, time: number): void {
    for (const voice of this.voices.filter((item) => item.source === source)) {
      this.release(voice, Math.max(time, this.context.currentTime), voice.pedal ? EP_PRESET.pedalReleaseSeconds : EP_PRESET.releaseSeconds);
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

  private noteOn(time: number, channel: number, note: number, velocity: number, source: VoiceSource): void {
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
    const frequency = EP_PRESET.tuningA4Hz * 2 ** ((note - 69) / 12);
    const velocityGain = (velocity / 127) ** EP_PRESET.velocityCurve;
    const carrier = this.context.createOscillator();
    const mod = this.context.createOscillator();
    const modGain = this.context.createGain();
    const amp = this.context.createGain();
    const tremolo = this.context.createOscillator();
    const tremoloGain = this.context.createGain();
    const tremoloOffset = this.context.createGain();
    carrier.type = "sine";
    mod.type = "sine";
    tremolo.type = "sine";
    carrier.frequency.setValueAtTime(frequency, time);
    mod.frequency.setValueAtTime(frequency * EP_PRESET.modulatorRatio, time);
    tremolo.frequency.setValueAtTime(EP_PRESET.tremoloRateHz, time);
    const index = EP_PRESET.modIndexAtFullVelocity * (0.35 + 0.65 * velocityGain) * frequency;
    modGain.gain.setValueAtTime(index, time);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, index * 0.15), time + EP_PRESET.decaySeconds);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    tremoloGain.gain.setValueAtTime(EP_PRESET.tremoloDepth, time);
    tremolo.connect(tremoloGain);
    tremoloGain.connect(tremoloOffset.gain);
    tremoloOffset.gain.setValueAtTime(1 - EP_PRESET.tremoloDepth, time);
    carrier.connect(amp);
    amp.connect(tremoloOffset);
    tremoloOffset.connect(this.master);
    const peak = 0.2 * velocityGain * ((this.expression.get(source + ":" + channel) ?? 127) / 127);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + EP_PRESET.attackSeconds);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * EP_PRESET.sustainLevel), time + EP_PRESET.decaySeconds);
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
    this.release(voice, time, EP_PRESET.releaseSeconds);
  }

  private setPedal(time: number, channel: number, down: boolean, source: VoiceSource): void {
    this.pedal.set(source + ":" + channel, down);
    if (!down) {
      for (const voice of this.voices.filter((item) => item.source === source && item.channel === channel && item.pedal && !item.keyDown)) {
        this.release(voice, time, EP_PRESET.pedalReleaseSeconds);
      }
    }
  }

  private release(voice: Voice, time: number, seconds: number): void {
    const stopsAt = time + seconds + 0.03;
    if (voice.stopsAt <= stopsAt) return;
    voice.keyDown = false;
    const gain = voice.amp.gain;
    const floor = 0.0001;
    let level = floor;
    if (typeof gain.cancelAndHoldAtTime === "function") {
      try {
        gain.cancelAndHoldAtTime(time);
        level = Math.max(floor, gain.value);
      } catch {
        gain.cancelScheduledValues(time);
        level = Math.max(floor, gain.value);
      }
    } else {
      gain.cancelScheduledValues(time);
      level = Math.max(floor, gain.value);
    }
    gain.setValueAtTime(level, time);
    gain.exponentialRampToValueAtTime(floor, time + seconds);
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
