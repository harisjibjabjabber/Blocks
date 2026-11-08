import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pagesBase } from "./pages-base";

describe("GitHub Pages base path", () => {
  it("stays at the site root until a project path is configured", () => {
    expect(pagesBase(undefined)).toBe("/");
    expect(pagesBase("")).toBe("/");
    expect(pagesBase("/")).toBe("/");
    expect(pagesBase("/")).not.toMatch(/github\.io/);
  });

  it("uses the configured project path", () => {
    expect(pagesBase("Blocks")).toBe("/Blocks/");
    expect(pagesBase("/Blocks")).toBe("/Blocks/");
    expect(pagesBase("/Blocks/")).toBe("/Blocks/");
  });

  it("builds the static site at exactly /Blocks/", () => {
    const pkg = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
    expect(pkg).toContain("BLOCKS_BASE=/Blocks/");
    const workflow = readFileSync(new URL("../../.github/workflows/pages.yml", import.meta.url), "utf8");
    expect(workflow).toContain("npm run build:web");
    expect(workflow).not.toContain("github.event.repository.name");
  });
});
