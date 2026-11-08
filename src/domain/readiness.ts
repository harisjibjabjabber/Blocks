import type { GateState } from "../midi/web/enable";

const LIVE = new Set(["running", "suspended", "interrupted", "closed"]);

export function soundChipLabel(audioState: string): string {
  if (LIVE.has(audioState)) {
    return audioState;
  }
  return audioState === "" ? "suspended" : audioState;
}

export function readinessText(audioState: string): { chip: string; line: string } {
  return {
    chip: "Sound · " + soundChipLabel(audioState),
    line: "AudioContext: " + audioState,
  };
}

export function readinessAgrees(audioState: string): boolean {
  const view = readinessText(audioState);
  const running = audioState === "running";
  if (running) {
    return view.chip === "Sound · running" && view.line === "AudioContext: running";
  }
  return view.chip !== "Sound · running" && view.chip === "Sound · " + soundChipLabel(audioState) && view.line === "AudioContext: " + audioState;
}

export function syncAudioGate(gate: GateState, audioState: string): GateState {
  const running = audioState === "running";
  let kind = gate.kind;
  let detail = gate.detail;
  if (gate.kind === "ready" && !running) {
    kind = "suspended";
    detail = audioDetail(audioState);
  } else if (gate.kind === "suspended" && running && gate.midiAccess) {
    kind = "ready";
    detail = "Audio is running and a MIDI input is connected.";
  } else if (gate.kind === "suspended" && !running) {
    detail = audioDetail(audioState);
  }
  return {
    ...gate,
    kind,
    audioRunning: running,
    ready: running && kind === "ready",
    detail,
  };
}

function audioDetail(audioState: string): string {
  if (audioState === "interrupted") {
    return "Audio was interrupted.";
  }
  if (audioState === "closed") {
    return "Audio context is closed.";
  }
  return "Audio is suspended.";
}

export function touchAvailableRegardlessOfMidi(): boolean {
  return true;
}
