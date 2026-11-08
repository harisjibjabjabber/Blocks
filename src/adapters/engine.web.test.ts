import { describe, expect, it, vi } from "vitest";
import type { IncomingEvent } from "../domain/capture";
import { createWebEngine } from "./engine.web";

class FakeParam {
  value = 0.2;
  setValueAtTime(value: number) {
    this.value = value;
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  frequency = new FakeParam();
  gain = new FakeParam();
  type = "sine";
  connect() {
    return this;
  }
  disconnect() {}
  start() {}
  stop() {}
}

class FakeContext {
  state = "suspended";
  currentTime = 1;
  sampleRate = 48000;
  destination = new FakeNode();
  private listeners: Array<() => void> = [];
  addEventListener(_type: string, listener: () => void) {
    this.listeners.push(listener);
  }
  removeEventListener() {}
  setState(next: string) {
    this.state = next;
    for (const listener of this.listeners) {
      listener();
    }
  }
  resume() {
    this.setState("running");
    return Promise.resolve();
  }
  createGain() {
    return new FakeNode();
  }
  createOscillator() {
    return new FakeNode();
  }
}

function note(): IncomingEvent {
  return {
    domain: "web-performance-us",
    sequence: 1n,
    portId: "touch",
    sessionId: "test",
    channel: 0,
    kind: "note-on",
    note: 60,
    velocity: 90,
    controller: 0,
    value: 0,
    scheduleElapsed: 0n,
    sourceTimestamp: 0n,
    receiptTimestamp: 0n,
    missingSourceTimestamp: false,
    raw: [0x90, 60, 90],
    origin: "touch",
  };
}

describe("web engine adapter", () => {
  it("follows suspended, interrupted, resume, and closed without claiming running", async () => {
    const context = new FakeContext();
    const engine = createWebEngine({
      createContext: () => context as unknown as AudioContext,
      requestMIDIAccess: async () => {
        context.setState("suspended");
        throw new DOMException("denied", "NotAllowedError");
      },
    });
    await engine.enable();
    expect(engine.getGate().kind).toBe("denied");
    expect(engine.getGate().audioRunning).toBe(false);
    expect(engine.readAudioState()).toBe("suspended");
    for (const state of ["interrupted", "closed", "running", "suspended"]) {
      context.setState(state);
      expect(engine.readAudioState()).toBe(state);
      expect(engine.getGate().audioRunning).toBe(state === "running");
      expect(engine.getGate().kind).toBe("denied");
      if (state !== "running") {
        expect(engine.getGate().audioRunning).toBe(false);
      }
    }
  });

  it("schedules replay on the audio clock only while the context is running", async () => {
    vi.useFakeTimers();
    const context = new FakeContext();
    const engine = createWebEngine({
      createContext: () => context as unknown as AudioContext,
      requestMIDIAccess: async () => ({ inputs: new Map(), onstatechange: null }),
    });
    context.setState("suspended");
    engine.replay([note()], 1);
    await vi.advanceTimersByTimeAsync(30);
    const silent = JSON.parse(await engine.stats()) as { scheduled: number };
    expect(silent.scheduled).toBe(0);
    context.setState("running");
    context.currentTime = 1;
    engine.replay([note()], 1);
    context.currentTime = 1.04;
    await vi.advanceTimersByTimeAsync(20);
    const sounding = JSON.parse(await engine.stats()) as { scheduled: number; audio: string };
    expect(sounding.audio).toBe("running");
    expect(sounding.scheduled).toBeGreaterThan(0);
    engine.stopReplay();
    vi.useRealTimers();
  });

  it("keeps the first layer when a second layer starts", async () => {
    vi.useFakeTimers();
    const context = new FakeContext();
    context.setState("running");
    context.currentTime = 10;
    const engine = createWebEngine({
      createContext: () => context as unknown as AudioContext,
      requestMIDIAccess: async () => ({ inputs: new Map(), onstatechange: null }),
    });
    engine.loopLayer("piano", [note()], 1, 2);
    engine.loopLayer("bass", [{ ...note(), note: 64 }], 1, 1);
    await vi.advanceTimersByTimeAsync(20);
    const both = JSON.parse(await engine.stats()) as { layers: number };
    expect(both.layers).toBe(2);
    engine.stopLayer("bass");
    const left = JSON.parse(await engine.stats()) as { layers: number };
    expect(left.layers).toBe(1);
    engine.stopReplay();
    vi.useRealTimers();
  });

  it("plays piano, bass, and drums together without writing replay into history", async () => {
    vi.useFakeTimers();
    const context = new FakeContext();
    context.setState("running");
    context.currentTime = 5;
    const engine = createWebEngine({
      createContext: () => context as unknown as AudioContext,
      requestMIDIAccess: async () => ({ inputs: new Map(), onstatechange: null }),
    });
    const heard: string[] = [];
    engine.subscribe((event) => heard.push(event.origin));
    engine.loopLayer("piano", [note()], 1, 2);
    engine.loopLayer("bass", [{ ...note(), note: 40 }], 1, 2);
    engine.loopLayer("drums", [{ ...note(), note: 36 }], 1, 1);
    await vi.advanceTimersByTimeAsync(30);
    const stats = JSON.parse(await engine.stats()) as { layers: number };
    expect(stats.layers).toBe(3);
    expect(heard).toEqual([]);
    engine.stopLayer("drums");
    expect(JSON.parse(await engine.stats()).layers).toBe(2);
    engine.stopReplay();
    vi.useRealTimers();
  });
});

describe("dependency-injection mocks, not hardware proof", () => {
  it("mock only: Web MIDI unsupported still accepts on-screen touch", async () => {
    const context = new FakeContext();
    const engine = createWebEngine({
      createContext: () => context as unknown as AudioContext,
      requestMIDIAccess: undefined,
    });
    const origins: string[] = [];
    engine.subscribe((event) => origins.push(event.origin));
    await engine.enable();
    expect(engine.getGate().kind).toBe("unsupported");
    expect(engine.ports()).toEqual([]);
    engine.touch(60, 100, true);
    expect(origins).toEqual(["touch"]);
    engine.stopReplay();
  });

  it("mock only: Web MIDI with no input is no-device and touch still records", async () => {
    const context = new FakeContext();
    const engine = createWebEngine({
      createContext: () => context as unknown as AudioContext,
      requestMIDIAccess: async () => ({ inputs: new Map(), onstatechange: null }),
    });
    const origins: string[] = [];
    engine.subscribe((event) => origins.push(event.origin));
    await engine.enable();
    expect(engine.getGate().kind).toBe("no-device");
    expect(engine.getGate().detail).toMatch(/no input/i);
    engine.touch(64, 80, true);
    expect(origins).toEqual(["touch"]);
    expect(engine.getGate().kind).toBe("no-device");
  });
});
