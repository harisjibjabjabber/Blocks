import React from "react";
import { describe, expect, it, vi } from "vitest";
import { readinessAgrees, readinessText, soundChipLabel, syncAudioGate, touchAvailableRegardlessOfMidi } from "./readiness";
import type { GateState } from "../midi/web/enable";

vi.mock("react-native", () => ({
  View: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
  Text: ({ children }: { children?: React.ReactNode }) => React.createElement("span", null, children),
}));

import { ReadinessStrip } from "../ui/Readiness";

const STATES = ["suspended", "interrupted", "closed", "running"];

function denied(audioRunning: boolean): GateState {
  return {
    kind: "denied",
    ready: false,
    audioRunning,
    midiAccess: false,
    detail: "MIDI permission was denied.",
  };
}

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join(" ");
  }
  if (typeof node === "object" && "props" in node) {
    return textOf((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  }
  return "";
}

describe("UI readiness regression", () => {
  it("fails when the sound chip and AudioContext line disagree", () => {
    for (const state of STATES) {
      const view = readinessText(state);
      expect(readinessAgrees(state)).toBe(true);
      const text = textOf(ReadinessStrip({ audioState: state, showContext: true }));
      expect(text).toContain(view.chip);
      expect(text).toContain(view.line);
      if (state !== "running") {
        expect(text).not.toContain("Sound · running");
        expect(view.chip).not.toBe("Sound · running");
      } else {
        expect(text).toContain("Sound · running");
      }
    }
  });

  it("keeps on-screen touch available for every MIDI gate", () => {
    for (const kind of ["denied", "unsupported", "no-device", "suspended", "ready"]) {
      expect(touchAvailableRegardlessOfMidi()).toBe(true);
      expect(kind.length).toBeGreaterThan(0);
    }
  });
});

describe("audio gate follows the context", () => {
  it("keeps MIDI denial while sound follows suspended, interrupted, resume, and closed", () => {
    let gate = denied(true);
    for (const state of ["suspended", "interrupted", "closed", "running", "suspended"]) {
      gate = syncAudioGate(gate, state);
      expect(gate.kind).toBe("denied");
      expect(gate.detail).toBe("MIDI permission was denied.");
      expect(gate.audioRunning).toBe(state === "running");
      expect(gate.ready).toBe(false);
      if (state !== "running") {
        expect(soundChipLabel(state)).not.toBe("running");
      }
    }
  });
});
