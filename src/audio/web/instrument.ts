import { EP_PRESET } from "./preset";

interface Voice {
  osc: OscillatorNode[];
  mod: OscillatorNode;
  modGain: GainNode;
  amp: GainNode;
  note: number;
  channel: number;
  keyDown: boolean;
  pedal: boolean;
}

export class WebElectricPiano {
  readonly presetId = EP_PRESET.id;
  private readonly master: GainNode;
  private readonly voices: Voice[] = [];
  private readonly pedal = new Array(16).fill(false);
  private readonly expression = new Array(16).fill(127);
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
    this.pedal.fill(false);
  }

  play(
    time: number,
    message: { kind: string; channel: number; note: number; velocity: number; controller: number; value: number },
  ): void {
    if (this.context.state !== "running") {
      return;
    }
    const when = Math.max(time, this.context.currentTime);
    if (message.kind === "note-on" && message.velocity > 0) {
      this.noteOn(when, message.channel, message.note, message.velocity);
    } else if (message.kind === "note-off" || (message.kind === "note-on" && message.velocity === 0)) {
      this.noteOff(when, message.channel, message.note);
    } else if (message.kind === "cc") {
      if (message.controller === this.sustainCc) {
        this.setPedal(when, message.channel, message.value >= 64);
      } else if (message.controller === 11) {
        this.expression[message.channel] = message.value;
      }
    }
  }

  private noteOn(time: number, channel: number, note: number, velocity: number): void {
    const existing = this.voices.find((voice) => voice.channel === channel && voice.note === note);
    if (existing) {
      this.stopVoice(existing, time);
      this.voices.splice(this.voices.indexOf(existing), 1);
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
    const peak = 0.2 * velocityGain * (this.expression[channel] / 127);
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
    });
  }

  private noteOff(time: number, channel: number, note: number): void {
    const voice = this.voices.find((item) => item.channel === channel && item.note === note);
    if (!voice) {
      return;
    }
    voice.keyDown = false;
    if (this.pedal[channel]) {
      voice.pedal = true;
      return;
    }
    this.release(voice, time);
  }

  private setPedal(time: number, channel: number, down: boolean): void {
    this.pedal[channel] = down;
    if (!down) {
      for (const voice of this.voices.filter((item) => item.channel === channel && item.pedal && !item.keyDown)) {
        this.release(voice, time);
      }
    }
  }

  private release(voice: Voice, time: number): void {
    voice.amp.gain.cancelScheduledValues(time);
    voice.amp.gain.setValueAtTime(Math.max(0.0001, voice.amp.gain.value), time);
    voice.amp.gain.exponentialRampToValueAtTime(0.0001, time + EP_PRESET.releaseSeconds);
    this.stopVoice(voice, time + EP_PRESET.releaseSeconds + 0.02);
    this.voices.splice(this.voices.indexOf(voice), 1);
  }

  private stopVoice(voice: Voice, time: number): void {
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
