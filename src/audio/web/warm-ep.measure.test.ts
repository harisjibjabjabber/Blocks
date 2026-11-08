import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Warm EP offline Web Audio, not a schedule mock", () => {
  it("decays to silence after note-off, holds with the pedal, and stops cleanly", () => {
    const out = execFileSync("node", ["scripts/measure-warm-ep.mjs"], { encoding: "utf8" });
    const measured = JSON.parse(out) as {
      releaseAttack: number;
      afterRelease: number;
      secondAttack: number;
      afterSecond: number;
      pedalStillOn: number;
      afterPedalUp: number;
      afterStop: number;
    };
    expect(measured.releaseAttack).toBeGreaterThan(0.005);
    expect(measured.afterRelease).toBe(0);
    expect(measured.secondAttack).toBeGreaterThan(0.005);
    expect(measured.afterSecond).toBe(0);
    expect(measured.pedalStillOn).toBeGreaterThan(0.002);
    expect(measured.afterPedalUp).toBe(0);
    expect(measured.afterStop).toBe(0);
  }, 30000);
});
