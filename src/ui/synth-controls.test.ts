import { describe, expect, it } from "vitest";
import { ENVELOPE_RANGES } from "../audio/instruments";
import { ENVELOPE_CONTROLS, envelopeDialUnit, envelopeDialValue, envelopeValueLabel, stepEnvelopeDial } from "./synth-controls";

describe("envelope dial controls", () => {
  it("reaches both physical limits and clamps pointer overshoot for every dial", () => {
    for (const { key } of ENVELOPE_CONTROLS) {
      const [min, max] = ENVELOPE_RANGES[key];
      expect(envelopeDialValue(key, -2)).toBe(min);
      expect(envelopeDialValue(key, 3)).toBe(max);
      expect(envelopeDialUnit(key, min)).toBeCloseTo(0);
      expect(envelopeDialUnit(key, max)).toBeCloseTo(1);
    }
  });
  it("keeps short attacks adjustable by keyboard instead of rounding every step away", () => {
    expect(stepEnvelopeDial("attackMs", 2, .01)).toBe(3);
    expect(stepEnvelopeDial("attackMs", 2, -.01)).toBe(2);
    expect(stepEnvelopeDial("attackMs", 3000, .01)).toBe(3000);
    expect(stepEnvelopeDial("sustain", .16, .01)).toBe(.17);
  });
  it("gives short times useful dial travel and keeps units readable", () => {
    expect(envelopeDialValue("attackMs", .5)).toBeLessThan(100);
    expect(envelopeValueLabel("attackMs", 6)).toBe("6 ms");
    expect(envelopeValueLabel("decayMs", 2200)).toBe("2.2 s");
    expect(envelopeValueLabel("sustain", .162)).toBe("16.2%");
  });
});
