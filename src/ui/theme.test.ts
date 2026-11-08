import { describe, expect, it } from "vitest";
import { graphite, paper, playChrome, resolveTheme } from "./theme";

describe("appearance", () => {
  it("resolves graphite, paper, and the system choice", () => {
    expect(resolveTheme("dark", false)).toBe(graphite);
    expect(resolveTheme("light", true)).toBe(paper);
    expect(resolveTheme("system", true)).toBe(graphite);
    expect(resolveTheme("system", false)).toBe(paper);
  });

  it("keeps a 44px handle on a narrow phone width", () => {
    const phone = playChrome(360);
    const fold = playChrome(344);
    expect(phone.narrow).toBe(true);
    expect(fold.narrow).toBe(true);
    expect(phone.handlePx).toBeGreaterThanOrEqual(44);
    expect(fold.handlePx).toBeGreaterThanOrEqual(44);
    expect(playChrome(1280).narrow).toBe(false);
  });
});
