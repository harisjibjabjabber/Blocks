export type GateKind =
  | "idle"
  | "unsupported"
  | "site-addon"
  | "policy-blocked"
  | "settings-blocked"
  | "denied"
  | "no-device"
  | "disconnected"
  | "suspended"
  | "ready"
  | "failed";

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
  isSecureContext?: () => boolean;
  browser?: "firefox" | "other";
  permission?: { state: "granted" | "denied" | "prompt" | null; policyAllows: boolean | null };
}

export interface MidiAccessLike {
  inputs: Iterable<[string, MidiPortLike]>;
  onstatechange: ((event: MIDIConnectionEvent) => void) | null;
}

export interface MidiPortLike {
  id: string;
  name?: string | null;
  state: string;
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
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
  const runningNow = () => {
    try {
      return deps.audioState() === "running";
    } catch {
      return false;
    }
  };
  order.push("resume");
  try {
    await deps.resume();
  } catch {
    // The live state is read again at each return.
  }
  if (deps.isSecureContext && !deps.isSecureContext()) {
    return {
      gate: {
        kind: "unsupported",
        ready: false,
        audioRunning: runningNow(),
        midiAccess: false,
        detail: "Web MIDI needs HTTPS or localhost. Audio resumed on the click. This build has only been checked on localhost.",
      },
      access: null,
      order,
    };
  }
  if (deps.permission?.policyAllows === false) {
    return {
      gate: {
        kind: "policy-blocked",
        ready: false,
        audioRunning: runningNow(),
        midiAccess: false,
        detail: "The midi permission policy blocks this page. A site setting cannot override that. Open the top-level page. On-screen keys still play. This is not a broken take.",
      },
      access: null,
      order,
    };
  }
  if (typeof deps.requestMIDIAccess !== "function") {
    if (deps.browser === "firefox") {
      return {
        gate: {
          kind: "site-addon",
          ready: false,
          audioRunning: runningNow(),
          midiAccess: false,
          detail:
            "Desktop Firefox does not expose requestMIDIAccess here until a site-permission add-on is installed. From Firefox 108 that add-on is offered in a secure context when the midi permission policy allows it. This is a browser requirement, not a missing Web MIDI design and not a permission denial this page can see. Chrome or Edge is the easier first hardware test. Next: install the site-permission add-on Firefox offers for this site, or open the page in Chrome or Edge. On-screen keys still play.",
        },
        access: null,
        order,
      };
    }
    return {
      gate: {
        kind: "unsupported",
        ready: false,
        audioRunning: runningNow(),
        midiAccess: false,
        detail: "requestMIDIAccess is not on this page. On-screen keys still play. This is not a permission denial.",
      },
      access: null,
      order,
    };
  }
  if (deps.permission?.state === "denied") {
    return {
      gate: {
        kind: "settings-blocked",
        ready: false,
        audioRunning: runningNow(),
        midiAccess: false,
        detail:
          "MIDI for this site is already blocked in the browser settings. This page did not see a prompt, and it will not ask again while the setting stays blocked. Allow MIDI for this site, then press Try MIDI. On-screen keys still play.",
      },
      access: null,
      order,
    };
  }
  order.push("midi");
  let access: MidiAccessLike;
  try {
    access = await deps.requestMIDIAccess({ sysex: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : "";
    const siteAddon = name === "SecurityError" && /site permission add-on/i.test(message);
    const blocked = siteAddon ? "site-addon" : name === "NotAllowedError" ? "denied" : "failed";
    const detail = siteAddon
      ? "SecurityError: " + message + " Desktop Firefox gates Web MIDI behind a site-permission add-on. This is a browser requirement, not a permission denial this page can see and not a broken take. Chrome or Edge is the easier first hardware test. Next: install the site-permission add-on Firefox offers for this site, or open the page in Chrome or Edge. On-screen keys still play."
      : name === "NotAllowedError"
        ? "NotAllowedError. This page cannot see whether a prompt appeared. If Try MIDI does not ask again, allow MIDI for this site in the browser settings. This is not a broken take. On-screen keys still play."
        : name === "SecurityError"
          ? "SecurityError. The page is not allowed to request MIDI, or the call had no user gesture. This is not recorded as a choice you made. Press the button again, or open the top-level page. On-screen keys still play."
          : (name || "Error") + " while requesting MIDI. This is an API or runtime failure, not a permission denial and not a missing phrase. On-screen keys still play.";
    return {
      gate: {
        kind: blocked,
        ready: false,
        audioRunning: runningNow(),
        midiAccess: false,
        detail,
      },
      access: null,
      order,
    };
  }
  const inputs = Array.from(access.inputs, ([, port]) => port).filter((port) => port.state !== "disconnected");
  const audioRunning = runningNow();
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
