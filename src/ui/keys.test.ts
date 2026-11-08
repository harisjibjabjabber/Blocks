import { describe, expect, it } from "vitest";
import { touchFromPress } from "./keys";

describe("on-screen key gestures", () => {
  it("does not start a second note from the click that follows release", () => {
    const phases = ["in", "out", "press"] as const;
    expect(phases.map((phase) => touchFromPress(phase))).toEqual(["on", "off", "ignore"]);
  });
});
