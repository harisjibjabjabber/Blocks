export type LearnTarget = "capture" | "transport";

export interface ControlEvent {
  kind: string;
  controller: number;
}

export type LearnDecision =
  | { accept: false; message: string }
  | { accept: true; controller: number; message: string };

export interface ControlMap {
  capture: number | null;
  transport: number | null;
}

export function emptyControlMap(): ControlMap {
  return { capture: null, transport: null };
}

export function controlLabel(controller: number | null): string {
  return controller === null ? "not learned" : "CC " + controller;
}

export function learnControl(target: LearnTarget, event: ControlEvent): LearnDecision {
  if (event.kind === "note-on" || event.kind === "note-off") {
    return { accept: false, message: "Playing keys are not used for Capture or Play/Stop." };
  }
  if (event.kind !== "cc") {
    return { accept: false, message: "That is not a controller. Use a CC other than 64." };
  }
  if (event.controller === 64) {
    return { accept: false, message: "CC 64 stays sustain. It is not Capture or Play/Stop." };
  }
  const name = target === "capture" ? "Capture" : "Play/Stop";
  return { accept: true, controller: event.controller, message: name + " is CC " + event.controller + "." };
}

export function routeLearnedControl(
  event: ControlEvent,
  learning: LearnTarget | null,
  map: ControlMap,
): { record: true; decision: LearnDecision | null; fire: "capture" | "transport" | null } {
  if (learning) {
    return { record: true, decision: learnControl(learning, event), fire: null };
  }
  if (event.kind === "cc" && map.capture !== null && event.controller === map.capture) {
    return { record: true, decision: null, fire: "capture" };
  }
  if (event.kind === "cc" && map.transport !== null && event.controller === map.transport) {
    return { record: true, decision: null, fire: "transport" };
  }
  return { record: true, decision: null, fire: null };
}
