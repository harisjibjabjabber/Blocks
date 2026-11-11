import { DeviceEventEmitter, NativeModules } from "react-native";
import { EP_PRESET } from "../audio/web/preset";
import { INSTRUMENTS, type InstrumentId, type SynthEnvelope } from "../audio/instruments";
import type { IncomingEvent } from "../domain/capture";

interface NativeEngine {
  start: () => Promise<string>;
  stop: () => void;
  touch: (note: number, velocity: number, down: boolean) => void;
  setSustain: (cc: number) => void;
  panic: (origin: number) => void;
  replay: (payload: string) => void;
  stopReplay: () => void;
  poll: () => string;
  stats: () => string;
  listDevices: () => string;
  openDevice: (id: number) => Promise<string>;
  closeDevice: () => void;
  readProject: () => string;
  writeProject: (json: string) => void;
}

export interface NativeGate {
  kind: "idle" | "ready" | "no-device" | "disconnected" | "suspended" | "denied";
  ready: boolean;
  audioRunning: boolean;
  midiAccess: boolean;
  detail: string;
}

const native = NativeModules.BlocksEngine as NativeEngine;

function parsePoll(json: string, sessionLabel: string): IncomingEvent[] {
  const parsed = JSON.parse(json) as Array<Record<string, unknown>>;
  return parsed.map((item) => ({
    domain: "android-monotonic-ns" as const,
    sequence: BigInt(String(item.sequence)),
    portId: String(item.port),
    sessionId: sessionLabel,
    channel: Number(item.channel),
    kind: String(item.kind) as IncomingEvent["kind"],
    note: Number(item.note),
    velocity: Number(item.velocity),
    controller: Number(item.controller),
    value: Number(item.value),
    sourceTimestamp: item.missing ? null : BigInt(String(item.source)),
    receiptTimestamp: BigInt(String(item.receipt)),
    missingSourceTimestamp: Boolean(item.missing),
    raw: Array.isArray(item.raw) && (item.raw as number[]).length > 0 ? (item.raw as number[]) : null,
    origin: String(item.origin) as IncomingEvent["origin"],
    elapsedSource: null,
    elapsedReceipt: 0n,
    scheduleElapsed: 0n,
  }));
}

export function createNativeEngine() {
  let gate: NativeGate = {
    kind: "idle",
    ready: false,
    audioRunning: false,
    midiAccess: false,
    detail: "Tap Enable to open audio and look for a MIDI input.",
  };
  const listeners = new Set<(event: IncomingEvent) => void>();
  const sessionLabel = "android-" + Date.now().toString(36);
  let timer: ReturnType<typeof setInterval> | null = null;
  let ports: { id: string; name: string; state: string }[] = [];

  const emit = (event: IncomingEvent) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  DeviceEventEmitter.addListener("blocksMidiDevices", (body: string) => {
    const devices = JSON.parse(body) as { id: number; name: string }[];
    ports = devices.map((device) => ({ id: String(device.id), name: device.name, state: "connected" }));
    if (ports.length === 0 && gate.midiAccess) {
      gate = { ...gate, kind: "disconnected", ready: false, detail: "The MIDI input disconnected." };
    }
  });
  DeviceEventEmitter.addListener("blocksAudioFocus", (body: string) => {
    const parsed = JSON.parse(body) as { state: string };
    if (parsed.state === "lost") {
      gate = { ...gate, kind: "suspended", ready: false, audioRunning: false, detail: "Audio focus was lost. Tap Enable to start again." };
    }
  });

  return {
    kind: "android" as const,
    domain: "android-monotonic-ns" as const,
    presetId: EP_PRESET.id,
    presetName: EP_PRESET.name,
    // The native bridge currently implements only the fixed Warm EP voice.
    instruments: INSTRUMENTS.filter(item => item.id === EP_PRESET.id),
    setLiveInstrument(_id: string, _envelope?: SynthEnvelope): InstrumentId { return EP_PRESET.id; },
    setLayerVolume(_layerId: string, _volume: number): void {},
    setLayerInstrument(_layerId: string, _id: string, _envelope?: SynthEnvelope): InstrumentId { return EP_PRESET.id; },
    setAuditionInstrument(_id: string, _envelope?: SynthEnvelope): InstrumentId { return EP_PRESET.id; },
    capabilities: { audition: false, soundingPitches: false, synthEnvelope: false },
    // Native bridge has no isolated audition or authoritative sounding-state API.
    audition(_note: number, _down: boolean) {},
    stopAudition() {},
    soundingPitches(_layerId: string): readonly number[] { return []; },
    getGate: () => gate,
    readAudioState: () => (gate.audioRunning ? "running" : "stopped"),
    async resumeAudio() { const state = JSON.parse(await native.start()) as { audio: boolean }; gate = { ...gate, audioRunning: state.audio, ready: state.audio && gate.midiAccess }; },
    ports: () => ports,
    async enable() {
      const raw = await native.start();
      const parsed = JSON.parse(raw) as { audio: boolean; midi: string; stats: { audioError?: string } | string };
      const stats = typeof parsed.stats === "string" ? JSON.parse(parsed.stats) : parsed.stats;
      const audioRunning = parsed.audio;
      const opened = parsed.midi === "open";
      if (!audioRunning && opened) {
        gate = { kind: "suspended", ready: false, audioRunning: false, midiAccess: true, detail: "Audio did not start. MIDI capture can continue. " + (stats.audioError || "") };
      } else if (!opened) {
        gate = { kind: "no-device", ready: false, audioRunning, midiAccess: true, detail: "No MIDI input is connected." };
      } else {
        gate = { kind: "ready", ready: audioRunning, audioRunning, midiAccess: true, detail: "Audio is running and a MIDI input is open." };
      }
      ports = JSON.parse(native.listDevices()).map((device: { id: number; name: string }) => ({
        id: String(device.id),
        name: device.name,
        state: "connected",
      }));
      return gate;
    },
    subscribe(listener: (event: IncomingEvent) => void) {
      listeners.add(listener);
      if (!timer) {
        timer = setInterval(() => {
          const batch = parsePoll(native.poll(), sessionLabel);
          for (const event of batch) {
            emit(event);
          }
        }, 30);
      }
      return () => listeners.delete(listener);
    },
    touch(note: number, velocity: number, down: boolean) {
      native.touch(note, velocity, down);
    },
    setSustain(cc: number) {
      native.setSustain(cc);
    },
    replay(events: (IncomingEvent & { scheduleElapsed: bigint })[], stretch: number) {
      const first = events[0]?.scheduleElapsed ?? 0n;
      const lines = events
        .map((event) => {
          const elapsed = event.scheduleElapsed - first;
          const scaled = BigInt(Math.round(Number(elapsed) * (stretch > 0 ? stretch : 1)));
          const status = event.kind === "note-off" ? 0x80 | event.channel : event.kind === "cc" ? 0xb0 | event.channel : 0x90 | event.channel;
          const data1 = event.kind === "cc" ? event.controller : event.note;
          const data2 = event.kind === "cc" ? event.value : event.velocity;
          return scaled.toString() + " " + status + " " + data1 + " " + data2 + " " + event.channel;
        })
        .join("\n");
      native.replay(lines);
    },
    stopReplay() {
      native.stopReplay();
    },
    transport(_layerId?: string) {
      return { availability: "unavailable" as const, state: "stopped" as const, positionSeconds: null, originSeconds: null, revision: 0 };
    },
    async stats() {
      return native.stats();
    },
    async loadProject() {
      return native.readProject();
    },
    async saveProject(json: string) {
      native.writeProject(json);
    },
  };
}

export function createEngine() {
  return createNativeEngine();
}
