export type GateKind = "idle" | "unsupported" | "denied" | "no-device" | "disconnected" | "suspended" | "ready";

export interface GateState {
  kind: GateKind;
  ready: boolean;
  audioRunning: boolean;
  midiAccess: boolean;
  detail: string;
}

export interface EnableDeps {
  resume: () => Promise<void>;
  audioState: () => string;
  requestMIDIAccess?: (options: { sysex: boolean }) => Promise<MidiAccessLike>;
}

export interface MidiAccessLike {
  inputs: Iterable<[string, MidiPortLike]>;
  onstatechange: ((event: unknown) => void) | null;
}

export interface MidiPortLike {
  id: string;
  name?: string;
  state: string;
  onmidimessage: ((event: { data: Uint8Array; timeStamp: number }) => void) | null;
}

export const idleGate = (): GateState => ({
  kind: "idle",
  ready: false,
  audioRunning: false,
  midiAccess: false,
  detail: "Tap Enable. Audio resumes before the MIDI permission request.",
});

export async function enableFromGesture(deps: EnableDeps): Promise<{ gate: GateState; access: MidiAccessLike | null; order: string[] }> {
  const order: string[] = [];
  if (typeof deps.requestMIDIAccess !== "function") {
    return {
      gate: { kind: "unsupported", ready: false, audioRunning: false, midiAccess: false, detail: "This browser has no Web MIDI API." },
      access: null,
      order,
    };
  }
  order.push("resume");
  let audioState = "suspended";
  try {
    await deps.resume();
    audioState = deps.audioState();
  } catch {
    audioState = "suspended";
  }
  const audioRunning = audioState === "running";
  order.push("midi");
  let access: MidiAccessLike;
  try {
    access = await deps.requestMIDIAccess({ sysex: false });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : "";
    return {
      gate: {
        kind: "denied",
        ready: false,
        audioRunning,
        midiAccess: false,
        detail: name === "SecurityError" || name === "NotAllowedError" ? "MIDI permission was denied." : "MIDI access failed.",
      },
      access: null,
      order,
    };
  }
  const inputs = Array.from(access.inputs.values()).filter((port) => port.state !== "disconnected");
  if (inputs.length === 0) {
    return {
      gate: {
        kind: "no-device",
        ready: false,
        audioRunning,
        midiAccess: true,
        detail: "MIDI is allowed, and no input is connected.",
      },
      access,
      order,
    };
  }
  if (!audioRunning) {
    return {
      gate: {
        kind: "suspended",
        ready: false,
        audioRunning: false,
        midiAccess: true,
        detail: "Audio is suspended. MIDI is available, and sound stays stopped.",
      },
      access,
      order,
    };
  }
  return {
    gate: { kind: "ready", ready: true, audioRunning: true, midiAccess: true, detail: "Audio is running and a MIDI input is connected." },
    access,
    order,
  };
}

export function bindMidiInputs(previous: MidiPortLike[], inputs: Iterable<MidiPortLike>, handler: MidiPortLike["onmidimessage"]): MidiPortLike[] {
  for (const port of previous) {
    port.onmidimessage = null;
  }
  const next: MidiPortLike[] = [];
  for (const port of inputs) {
    if (port.state === "disconnected") {
      continue;
    }
    port.onmidimessage = handler;
    next.push(port);
  }
  return next;
}

export function gateAfterDisconnect(gate: GateState): GateState {
  if (!gate.midiAccess) {
    return gate;
  }
  return { ...gate, kind: "disconnected", ready: false, detail: "The MIDI input disconnected." };
}
