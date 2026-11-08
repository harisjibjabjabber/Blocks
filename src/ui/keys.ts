/** Pointer phases for an on-screen key. "press" is the click after release and must not start a new note. */
export type PressPhase = "in" | "out" | "press";

export function touchFromPress(phase: PressPhase): "on" | "off" | "ignore" {
  if (phase === "in") {
    return "on";
  }
  if (phase === "out") {
    return "off";
  }
  return "ignore";
}
