import { WebElectricPiano } from "../audio/web/instrument";
import { EP_PRESET } from "../audio/web/preset";
import { liveAudioTime, planFromElapsed, selectDue, type PlannedEvent } from "../audio/web/schedule";
import type { IncomingEvent } from "../domain/capture";
import { syncAudioGate } from "../domain/readiness";
import { bindMidiInputs, enableFromGesture, idleGate, type EnableDeps } from "../midi/web/enable";
import { parseCompleteMidi } from "../midi/web/complete";

export interface PortInfo {
  id: string;
  name: string;
  state: string;
}

export interface SketchEngine {
  kind: "web";
  presetId: string;
  presetName: string;
  enable(): Promise<ReturnType<typeof idleGate>>;
  getGate(): ReturnType<typeof idleGate>;
  readAudioState(): string;
  ports(): PortInfo[];
  subscribe(listener: (event: IncomingEvent) => void): () => void;
  touch(note: number, velocity: number, down: boolean): void;
  setSustain(cc: number): void;
  replay(events: IncomingEvent[], stretch: number): void;
  stopReplay(): void;
  stats(): Promise<string>;
  loadProject(): Promise<string>;
  saveProject(json: string): Promise<void>;
}

const STORE_KEY = "blocks.project.v1";

export interface WebEngineOptions {
  createContext?: () => AudioContext;
  requestMIDIAccess?: EnableDeps["requestMIDIAccess"];
}

export function createWebEngine(options: WebEngineOptions = {}): SketchEngine {
  const context = options.createContext
    ? options.createContext()
    : new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
  const requestMIDIAccess =
    options.requestMIDIAccess !== undefined
      ? options.requestMIDIAccess
      : typeof navigator !== "undefined" && navigator.requestMIDIAccess
        ? (midiOptions: { sysex: boolean }) => navigator.requestMIDIAccess(midiOptions)
        : undefined;
  const piano = new WebElectricPiano(context);
  let gate = idleGate();
  let access: MIDIAccess | null = null;
  let bound: MIDIInput[] = [];
  let sequence = 1n;
  const sessionId = "web-" + Date.now().toString(36);
  const listeners = new Set<(event: IncomingEvent) => void>();
  let replayTimer: ReturnType<typeof setInterval> | null = null;
  let replayGeneration = 0;
  let scheduledNotes = 0;
  let sustainCc = 64;
  piano.setSustainController(sustainCc);

  const emit = (event: IncomingEvent) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const toIncoming = (bytes: Uint8Array, timeStamp: number, portId: string, origin: IncomingEvent["origin"]): IncomingEvent | null => {
    const parsed = parseCompleteMidi(bytes);
    if (!parsed.ok) {
      return null;
    }
    const receipt = performance.now();
    return {
      domain: "web-performance-us",
      sequence: sequence++,
      portId,
      sessionId,
      channel: parsed.channel,
      kind: parsed.kind === "cc" || parsed.kind === "pitch" || parsed.kind === "note-on" || parsed.kind === "note-off" ? parsed.kind : "other",
      note: parsed.data1,
      velocity: parsed.kind === "note-on" || parsed.kind === "note-off" ? parsed.data2 : 0,
      controller: parsed.kind === "cc" ? parsed.data1 : 0,
      value: parsed.kind === "cc" || parsed.kind === "pitch" ? parsed.data2 : parsed.data1,
      sourceTimestamp: BigInt(Math.round(timeStamp * 1000)),
      receiptTimestamp: BigInt(Math.round(receipt * 1000)),
      missingSourceTimestamp: false,
      raw: origin === "touch" ? parsed.raw : parsed.raw,
      origin,
    };
  };

  const onMessage = (portId: string) => (event: { data: Uint8Array; timeStamp: number }) => {
    const incoming = toIncoming(event.data, event.timeStamp, portId, "raw-midi");
    if (!incoming) {
      return;
    }
    emit(incoming);
    if (context.state !== "running") {
      return;
    }
    const decision = liveAudioTime({
      audioNowSec: context.currentTime,
      performanceNowMs: performance.now(),
      eventTimeStampMs: event.timeStamp,
      lateToleranceSec: 0.04,
    });
    if (!decision.drop) {
      piano.play(decision.when, incoming);
    }
  };

  const rebind = () => {
    if (!access) {
      return;
    }
    const inputs = Array.from(access.inputs.values());
    bound = bindMidiInputs(bound, inputs, null) as MIDIInput[];
    bound = [];
    for (const input of inputs) {
      if (input.state === "disconnected") {
        continue;
      }
      input.onmidimessage = onMessage(input.id);
      bound.push(input);
    }
  };

  const publishAudio = () => {
    if (context.state !== "running") {
      stopReplay();
    }
    gate = syncAudioGate(gate, context.state);
  };

  context.addEventListener("statechange", publishAudio);

  function stopReplay() {
    replayGeneration += 1;
    if (replayTimer) {
      clearInterval(replayTimer);
      replayTimer = null;
    }
    piano.cancelAll();
  }

  return {
    kind: "web",
    presetId: EP_PRESET.id,
    presetName: EP_PRESET.name,
    getGate: () => {
      gate = syncAudioGate(gate, context.state);
      return gate;
    },
    readAudioState: () => context.state,
    ports: () => bound.map((port) => ({ id: port.id, name: port.name || "MIDI input", state: port.state })),
    async enable() {
      const result = await enableFromGesture({
        resume: () => context.resume(),
        audioState: () => context.state,
        requestMIDIAccess,
        ...(typeof window === "undefined" ? {} : { isSecureContext: () => window.isSecureContext }),
      });
      gate = syncAudioGate(result.gate, context.state);
      access = (result.access as MIDIAccess | null) ?? null;
      if (access) {
        access.onstatechange = () => {
          rebind();
          const connected = Array.from(access?.inputs.values() ?? []).some((port) => port.state === "connected");
          if (!connected && gate.midiAccess) {
            gate = { ...gate, kind: "disconnected", ready: false, detail: "The MIDI input disconnected." };
          } else if (connected && context.state === "running") {
            gate = { ...gate, kind: "ready", ready: true, audioRunning: true, detail: "Audio is running and a MIDI input is connected." };
          } else if (connected) {
            gate = { ...gate, kind: "suspended", ready: false, detail: "Audio is suspended." };
          } else {
            gate = { ...gate, kind: "no-device", ready: false, detail: "MIDI is allowed, and no input is connected." };
          }
        };
        rebind();
      }
      return gate;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    touch(note, velocity, down) {
      const status = down && velocity > 0 ? 0x90 : 0x80;
      const vel = down ? velocity : 0;
      const bytes = new Uint8Array([status, note, vel]);
      const now = performance.now();
      const incoming = toIncoming(bytes, now, "touch", "touch");
      if (!incoming) {
        return;
      }
      incoming.origin = "touch";
      emit(incoming);
      const decision = liveAudioTime({
        audioNowSec: context.currentTime,
        performanceNowMs: now,
        eventTimeStampMs: now,
        lateToleranceSec: 0.04,
      });
      if (!decision.drop && context.state === "running") {
        piano.play(decision.when, { ...incoming, velocity: vel });
      }
    },
    setSustain(cc) {
      sustainCc = cc;
      piano.setSustainController(cc);
    },
    replay(events, stretch) {
      stopReplay();
      if (context.state !== "running" || events.length === 0) {
        return;
      }
      const generation = replayGeneration;
      const anchor = events[0].scheduleElapsed;
      const audioStart = context.currentTime + 0.05;
      const planned: PlannedEvent[] = events.map((event) => ({
        audioTimeSec: planFromElapsed({
          audioStartSec: audioStart,
          elapsedUs: event.scheduleElapsed,
          anchorElapsedUs: anchor,
          stretch,
        }),
        elapsedUs: event.scheduleElapsed,
        kind: event.kind,
        channel: event.channel,
        note: event.note,
        velocity: event.velocity,
        controller: event.controller,
        value: event.value,
      }));
      let index = 0;
      const pump = () => {
        if (generation !== replayGeneration || context.state !== "running") {
          return;
        }
        const selected = selectDue({
          planned,
          nextIndex: index,
          audioNowSec: context.currentTime,
          lookaheadSec: 0.025,
          lateToleranceSec: 0.04,
        });
        index = selected.index;
        for (const event of selected.due) {
          piano.play(event.audioTimeSec, event);
          scheduledNotes += 1;
        }
        if (index >= planned.length && replayTimer) {
          clearInterval(replayTimer);
          replayTimer = null;
        }
      };
      replayTimer = setInterval(pump, 10);
      pump();
    },
    stopReplay,
    async stats() {
      return JSON.stringify({
        preset: EP_PRESET.id,
        audio: context.state,
        ready: gate.ready,
        ports: bound.length,
        scheduled: scheduledNotes,
      });
    },
    async loadProject() {
      return window.localStorage.getItem(STORE_KEY) ?? "";
    },
    async saveProject(json: string) {
      window.localStorage.setItem(STORE_KEY, json);
    },
  };
}

export function createEngine(): SketchEngine {
  return createWebEngine();
}
