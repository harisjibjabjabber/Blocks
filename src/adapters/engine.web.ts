import { WebElectricPiano } from "../audio/web/instrument";
import { EP_PRESET } from "../audio/web/preset";
import { joinAtSeam, liveAudioTime, planFromElapsed, selectDue, type PlannedEvent } from "../audio/web/schedule";
import { readTransport, type TransportSnapshot } from "../audio/web/transport";
import type { IncomingEvent } from "../domain/capture";
import { syncAudioGate } from "../domain/readiness";
import { bindMidiInputs, enableFromGesture, idleGate, type EnableDeps } from "../midi/web/enable";
import { parseCompleteMidi } from "../midi/web/complete";

export type PlaybackEvent = IncomingEvent & { scheduleElapsed: bigint };

export interface PortInfo {
  id: string;
  name: string;
  state: string;
}

export interface SketchEngine {
  kind: "web";
  domain: "web-performance-us";
  presetId: string;
  presetName: string;
  capabilities: { audition: boolean; soundingPitches: boolean };
  enable(): Promise<ReturnType<typeof idleGate>>;
  getGate(): ReturnType<typeof idleGate>;
  readAudioState(): string;
  ports(): PortInfo[];
  subscribe(listener: (event: IncomingEvent) => void): () => void;
  touch(note: number, velocity: number, down: boolean): void;
  audition(note: number, down: boolean): void;
  stopAudition(): void;
  soundingPitches(layerId: string): readonly number[];
  setSustain(cc: number): void;
  replay(events: PlaybackEvent[], stretch: number): void;
  loopLayer(id: string, events: PlaybackEvent[], stretch: number, durationSec: number, originUs?: bigint): void;
  updateLayer(id: string, events: PlaybackEvent[], stretch: number, durationSec: number, originUs?: bigint): void;
  stopLayer(id: string): void;
  transport(layerId?: string): TransportSnapshot;
  stopReplay(): void;
  silence(): void;
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
  // Separate voices and pedal state: editor audition cannot steal a loop voice.
  const auditionPiano = new WebElectricPiano(context);
  let gate = idleGate();
  let access: MIDIAccess | null = null;
  let bound: MIDIInput[] = [];
  let sequence = 1n;
  const sessionId = "web-" + Date.now().toString(36);
  const listeners = new Set<(event: IncomingEvent) => void>();
  let replayTimer: ReturnType<typeof setInterval> | null = null;
  let replayGeneration = 0;
  let scheduledNotes = 0;
  let transportEpoch: number | null = null;
  let transportPeriod: number | null = null;
  let transportRevision = 0;
  let loopTimer: ReturnType<typeof setInterval> | null = null;
  interface LoopSlot {
    id: string;
    events: PlaybackEvent[];
    stretch: number;
    generation: number;
    cycleStart: number;
    startedAt: number;
    duration: number;
    originUs: bigint;
    planned: PlannedEvent[];
    index: number;
    pending?: { events: PlaybackEvent[]; stretch: number; duration: number; originUs: bigint };
  }
  let slots: LoopSlot[] = [];
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

  const onMessage = (portId: string) => (event: { data: Uint8Array | null; timeStamp: number }) => {
    if (!event.data) return;
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
      auditionPiano.cancelAll();
    }
    gate = syncAudioGate(gate, context.state);
  };

  context.addEventListener("statechange", publishAudio);

  function layerSource(id: string): `replay:${string}` {
    return `replay:${id}`;
  }

  function planSlot(slot: LoopSlot, audioStart: number): PlannedEvent[] {
    const anchor = slot.originUs;
    return slot.events.filter((event) => {
      const time = Number(event.scheduleElapsed - anchor) / 1_000_000 * slot.stretch;
      return time >= 0 && (time < slot.duration || (time === slot.duration && event.kind !== "note-on"));
    }).map((event) => ({
      audioTimeSec: planFromElapsed({
        audioStartSec: audioStart,
        elapsedUs: event.scheduleElapsed,
        anchorElapsedUs: anchor,
        stretch: slot.stretch,
      }),
      elapsedUs: event.scheduleElapsed,
      kind: event.kind,
      channel: event.channel,
      note: event.note,
      velocity: event.velocity,
      controller: event.controller,
      value: event.value,
    }));
  }

  function clearTransportIfIdle() {
    if (slots.length > 0) {
      return;
    }
    transportEpoch = null;
    transportPeriod = null;
    if (loopTimer) {
      clearInterval(loopTimer);
      loopTimer = null;
    }
  }

  function pumpLayers() {
    if (context.state !== "running") {
      return;
    }
    const now = context.currentTime;
    for (const slot of slots) {
      if (slot.index >= slot.planned.length && now + 0.02 >= slot.cycleStart + slot.duration && (!slot.pending || now >= slot.cycleStart + slot.duration)) {
        const boundary = slot.cycleStart + slot.duration;
        piano.releaseSource(layerSource(slot.id), Math.max(now, boundary));
        // Skip missed cycles after a stalled scheduler, never replay a backlog.
        slot.cycleStart += Math.max(1, Math.floor((now - slot.cycleStart) / slot.duration)) * slot.duration;
        if (slot.pending) {
          const next = slot.pending;
          slot.events = next.events;
          slot.stretch = next.stretch;
          slot.duration = next.duration;
          slot.originUs = next.originUs;
          slot.startedAt = slot.cycleStart;
          slot.pending = undefined;
          transportRevision += 1;
        }
        slot.planned = planSlot(slot, slot.cycleStart);
        slot.index = 0;
      }
      const selected = selectDue({
        planned: slot.planned,
        nextIndex: slot.index,
        audioNowSec: now,
        lookaheadSec: 0.025,
        lateToleranceSec: 0.04,
      });
      slot.index = selected.index;
      for (const event of selected.due) {
        piano.play(event.audioTimeSec, { ...event, source: layerSource(slot.id) });
        scheduledNotes += 1;
      }
    }
  }

  function ensureLoopPump() {
    if (loopTimer) {
      return;
    }
    loopTimer = setInterval(pumpLayers, 10);
    pumpLayers();
  }

  function stopLayer(id: string) {
    if (!slots.some((slot) => slot.id === id)) {
      return;
    }
    piano.releaseSource(layerSource(id), context.currentTime);
    slots = slots.filter((slot) => slot.id !== id);
    transportRevision += 1;
    clearTransportIfIdle();
  }

  function loopLayer(id: string, events: PlaybackEvent[], stretch: number, durationSec: number, originUs?: bigint) {
    if (!Number.isFinite(durationSec) || durationSec <= 0) return;
    stopLayer(id);
    if (context.state !== "running" || (events.length === 0 && originUs === undefined)) {
      return;
    }
    const duration = durationSec;
    const joined = joinAtSeam(context.currentTime, transportEpoch, transportPeriod);
    if (transportEpoch === null) {
      transportEpoch = joined.epoch;
      transportPeriod = duration;
    }
    const slot: LoopSlot = {
      id,
      events,
      stretch: stretch > 0 ? stretch : 1,
      generation: 1,
      cycleStart: joined.start,
      startedAt: joined.start,
      duration,
      originUs: originUs ?? events[0].scheduleElapsed,
      planned: [],
      index: 0,
    };
    transportRevision += 1;
    slot.planned = planSlot(slot, slot.cycleStart);
    slots.push(slot);
    ensureLoopPump();
  }

  function updateLayer(id: string, events: PlaybackEvent[], stretch: number, durationSec: number, originUs?: bigint) {
    if (!Number.isFinite(durationSec) || durationSec <= 0) return;
    const slot = slots.find((item) => item.id === id);
    if (!slot) {
      loopLayer(id, events, stretch, durationSec, originUs);
      return;
    }
    // Repeated edits replace this pending copy. Preview never reaches the engine.
    slot.pending = { events: events.slice(), stretch: stretch > 0 ? stretch : 1, duration: durationSec, originUs: originUs ?? slot.originUs };
  }

  function stopReplay() {
    replayGeneration += 1;
    if (replayTimer) {
      clearInterval(replayTimer);
      replayTimer = null;
    }
    piano.releaseSource("replay", context.currentTime);
    for (const slot of slots) {
      piano.releaseSource(layerSource(slot.id), context.currentTime);
    }
    slots = [];
    clearTransportIfIdle();
    scheduledNotes = 0;
  }

  return {
    kind: "web",
    domain: "web-performance-us",
    presetId: EP_PRESET.id,
    presetName: EP_PRESET.name,
    capabilities: { audition: true, soundingPitches: true },
    getGate: () => {
      gate = syncAudioGate(gate, context.state);
      return gate;
    },
    readAudioState: () => context.state,
    ports: () => bound.map((port) => ({ id: port.id, name: port.name || "MIDI input", state: port.state })),
    async enable() {
      const permission = await readMidiPermission();
      const result = await enableFromGesture({
        resume: () => context.resume(),
        audioState: () => context.state,
        requestMIDIAccess,
        browser: firefoxBrowser() ? "firefox" : "other",
        permission,
        ...(typeof window === "undefined" ? {} : { isSecureContext: () => window.isSecureContext }),
      });
      gate = syncAudioGate(result.gate, context.state);
      access = (result.access as MIDIAccess | null) ?? null;
      if (access) {
        access.onstatechange = () => {
          auditionPiano.cancelAll();
          const hadConnected = bound.some((port) => port.state === "connected");
          rebind();
          const connected = Array.from(access?.inputs.values() ?? []).some((port) => port.state === "connected");
          if (!connected && hadConnected && gate.midiAccess) {
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
      // Touch keys unlock their own audio from the playing gesture; MIDI access
      // remains a separate explicit action for people connecting a controller.
      if (down && context.state === "suspended") void context.resume().catch(() => undefined);
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
      if (!decision.drop && context.state !== "closed") {
        piano.play(decision.when, { ...incoming, velocity: vel, source: "touch" });
      }
    },
    audition(note, down) {
      if (!Number.isInteger(note) || note < 0 || note > 127) return;
      auditionPiano.play(context.currentTime, { kind: down ? "note-on" : "note-off", channel: 0, note, velocity: down ? 96 : 0, controller: 0, value: 0, source: "audition" });
    },
    stopAudition() {
      auditionPiano.cancelAll();
    },
    soundingPitches(layerId) {
      return context.state === "running" ? piano.soundingPitches(layerSource(layerId)) : [];
    },
    setSustain(cc) {
      sustainCc = cc;
      piano.setSustainController(cc);
    },
    loopLayer,
    updateLayer,
    stopLayer,
    transport(layerId) {
      const slot = layerId === undefined ? slots[0] : slots.find((item) => item.id === layerId);
      return readTransport({
        audioRunning: context.state === "running",
        hasSlot: Boolean(slot),
        now: context.currentTime,
        cycleStart: slot ? slot.startedAt : null,
        duration: slot ? slot.duration : null,
        originUs: slot ? slot.originUs : null,
        stretch: slot ? slot.stretch : 1,
        revision: transportRevision,
      });
    },
    replay(events, stretch) {
      stopReplay();
      scheduledNotes = 0;
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
          piano.play(event.audioTimeSec, { ...event, source: "replay" });
          scheduledNotes += 1;
        }
        if (index >= planned.length) {
          piano.releaseSource("replay", context.currentTime);
          if (replayTimer) {
            clearInterval(replayTimer);
            replayTimer = null;
          }
        }
      };
      replayTimer = setInterval(pump, 10);
      pump();
    },
    stopReplay,
    silence() {
      stopReplay();
      piano.silenceAll();
      auditionPiano.cancelAll();
      scheduledNotes = 0;
    },
    async stats() {
      return JSON.stringify({
        preset: EP_PRESET.id,
        audio: context.state,
        ready: gate.ready,
        ports: bound.length,
        scheduled: scheduledNotes,
        layers: slots.length,
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

function firefoxBrowser(): boolean {
  return typeof navigator !== "undefined" && /firefox\//i.test(navigator.userAgent);
}

async function readMidiPermission(): Promise<{ state: "granted" | "denied" | "prompt" | null; policyAllows: boolean | null }> {
  let policyAllows: boolean | null = null;
  if (typeof document !== "undefined") {
    const policy = (document as Document & { permissionsPolicy?: { allowsFeature: (name: string) => boolean } }).permissionsPolicy;
    if (policy && typeof policy.allowsFeature === "function") {
      try {
        policyAllows = policy.allowsFeature("midi");
      } catch {
        policyAllows = null;
      }
    }
  }
  let state: "granted" | "denied" | "prompt" | null = null;
  if (typeof navigator !== "undefined" && navigator.permissions && typeof navigator.permissions.query === "function") {
    try {
      const result = await navigator.permissions.query({ name: "midi", sysex: false } as PermissionDescriptor);
      if (result.state === "granted" || result.state === "denied" || result.state === "prompt") {
        state = result.state;
      }
    } catch {
      state = null;
    }
  }
  return { state, policyAllows };
}
