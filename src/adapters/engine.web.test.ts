import { describe, expect, it, vi } from "vitest";
import type { IncomingEvent } from "../domain/capture";
import { createWebEngine, type PlaybackEvent } from "./engine.web";

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
  stops: number[] = [];
  frequency = new FakeParam();
  gain = new FakeParam();
  type = "sine";
  connect() {
    return this;
  }
  disconnect() {}
  start() {}
  stop(time: number) { this.stops.push(time); }
}

class FakeContext {
  oscillators: FakeNode[] = [];
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
    const oscillator = new FakeNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }
}

function note(): PlaybackEvent {
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
  it("preserves a125ms loop and applies a shorter duration only at its seam", async () => {
    vi.useFakeTimers();
    try {
      const context = new FakeContext(); context.setState("running"); context.currentTime = 10;
      const engine = createWebEngine({ createContext: () => context as unknown as AudioContext });
      engine.loopLayer("short", [note()], 1, 0.125, 0n);
      context.currentTime = 10.04; await vi.advanceTimersByTimeAsync(10);
      context.currentTime = 10.05 + 0.14;
      expect(engine.transport("short").positionSeconds).toBeCloseTo(0.015);
      await vi.advanceTimersByTimeAsync(10);
      engine.updateLayer("short", [{ ...note(), note: 64 }], 1, 0.0625, 0n);
      context.currentTime = 10.29; await vi.advanceTimersByTimeAsync(10);
      expect(engine.transport("short").positionSeconds).toBeCloseTo(0.115);
      context.currentTime = 10.305; await vi.advanceTimersByTimeAsync(10);
      expect(engine.transport("short").positionSeconds).toBeCloseTo(0.005);
      context.currentTime = 10.37;
      expect(engine.transport("short").positionSeconds).toBeCloseTo(0.0075);
      engine.stopReplay();
    } finally { vi.useRealTimers(); }
  });

  it("ignores invalid loop durations without replacing valid playback", () => {
    const context = new FakeContext(); context.setState("running"); context.currentTime = 10;
    const engine = createWebEngine({ createContext: () => context as unknown as AudioContext });
    engine.loopLayer("valid", [note()], 1, 0.125, 0n);
    for (const invalid of [0, -1, Infinity, NaN]) {
      engine.loopLayer("invalid", [note()], 1, invalid, 0n);
      engine.loopLayer("valid", [note()], 1, invalid, 0n);
      engine.updateLayer("valid", [note()], 1, invalid, 0n);
    }
    context.currentTime = 10.19;
    expect(engine.transport("invalid").state).toBe("stopped");
    expect(engine.transport("valid").positionSeconds).toBeCloseTo(0.015);
    engine.stopReplay();
  });

  it("touch keys resume audio without requesting MIDI and preserve played events", () => {
    const context = new FakeContext();
    const requestMidi = vi.fn();
    const engine = createWebEngine({ createContext: () => context as unknown as AudioContext, requestMIDIAccess: requestMidi });
    const events: IncomingEvent[] = [];
    const stop = engine.subscribe(event => events.push(event));
    engine.touch(61, 96, true); engine.touch(61, 0, false);
    expect(context.state).toBe("running");
    expect(requestMidi).not.toHaveBeenCalled();
    expect(events.map(event => [event.kind, event.note, event.velocity])).toEqual([["note-on", 61, 96], ["note-off", 61, 0]]);
    expect(context.oscillators.length).toBeGreaterThan(0);
    stop(); engine.silence();
  });
  it("schedules a held-note seam release at the boundary, not the lookahead tick", async () => {
    vi.useFakeTimers();
    try {
      const context = new FakeContext();
      context.setState("running");
      context.currentTime = 10;
      const engine = createWebEngine({ createContext: () => context as unknown as AudioContext });
      engine.loopLayer("held", [note()], 2, 2, 0n);
      context.currentTime = 10.04;
      await vi.advanceTimersByTimeAsync(10);
      const firstCarrier = context.oscillators[0];
      context.currentTime = 12.035;
      await vi.advanceTimersByTimeAsync(10);
      // The release envelope begins at 12.05, not at the 12.035 scheduling tick.
      expect(firstCarrier.stops[0]).toBeCloseTo(12.05 + 0.4 + 0.03);
      expect(engine.transport("held").positionSeconds).toBeCloseTo(1.985 / 2);
      engine.stopReplay();
    } finally { vi.useRealTimers(); }
  });

  it("keeps selected-layer clocks through a silent tail and wraps without a timer tick", () => {
    const context = new FakeContext();
    context.setState("running");
    context.currentTime = 10;
    const engine = createWebEngine({ createContext: () => context as unknown as AudioContext });
    engine.loopLayer("first", [note()], 1, 2, 0n);
    engine.loopLayer("selected", [{ ...note(), scheduleElapsed: 9_000_000n }], 1, 2, 9_000_000n);
    context.currentTime = 10.05 + 1.9;
    expect(engine.transport("first").positionSeconds).toBeCloseTo(1.9);
    expect(engine.transport("selected").positionSeconds).toBeCloseTo(10.9);
    expect(engine.transport("missing").positionSeconds).toBeNull();
    const revision = engine.transport("selected").revision;
    context.currentTime = 10.05 + 2.1;
    expect(engine.transport("selected").positionSeconds).toBeCloseTo(9.1);
    expect(engine.transport("selected").revision).toBeGreaterThan(revision);
    engine.stopReplay();
  });

  it("keeps audition outside capture and isolates overlapping layer note-offs and sustain", async () => {
    vi.useFakeTimers();
    try {
      const context = new FakeContext();
      context.setState("running");
      context.currentTime = 10;
      const engine = createWebEngine({ createContext: () => context as unknown as AudioContext });
      const capture: IncomingEvent[] = [];
      engine.subscribe((event) => capture.push(event));
      const cc = (at: bigint, value: number): PlaybackEvent => ({ ...note(), kind: "cc", controller: 64, value, scheduleElapsed: at });
      const off = (at: bigint): PlaybackEvent => ({ ...note(), kind: "note-off", velocity: 0, scheduleElapsed: at });
      engine.loopLayer("pedalled", [cc(0n, 127), note(), off(100_000n), cc(600_000n, 0)], 1, 4, 0n);
      engine.loopLayer("plain", [note(), off(100_000n)], 1, 4, 0n);
      engine.audition(60, true);
      engine.audition(60, false);
      engine.stopAudition();
      expect(capture).toEqual([]);
      // A scheduled lookahead note must not light before its audio start.
      context.currentTime = 10.04;
      await vi.advanceTimersByTimeAsync(10);
      expect(engine.soundingPitches("plain")).toEqual([]);
      context.currentTime = 10.05;
      expect(engine.soundingPitches("plain")).toEqual([60]);
      context.currentTime = 10.14;
      await vi.advanceTimersByTimeAsync(10);
      context.currentTime = 10.60;
      expect(engine.soundingPitches("plain")).toEqual([]);
      expect(engine.soundingPitches("pedalled")).toEqual([60]);
      context.currentTime = 10.64;
      await vi.advanceTimersByTimeAsync(10);
      context.currentTime = 11.2;
      expect(engine.soundingPitches("pedalled")).toEqual([60]);
      context.currentTime = 11.9;
      expect(engine.soundingPitches("pedalled")).toEqual([]);
      expect(capture).toEqual([]);
      engine.stopReplay();
    } finally { vi.useRealTimers(); }
  });

  it("applies edited notes at the next seam without resetting phase, including erase-all", async () => {
    vi.useFakeTimers();
    try {
      const context = new FakeContext();
      context.setState("running");
      context.currentTime = 10;
      const engine = createWebEngine({ createContext: () => context as unknown as AudioContext });
      const off = { ...note(), kind: "note-off" as const, velocity: 0, scheduleElapsed: 100_000n };
      engine.loopLayer("edit", [note(), off], 1, 2, 0n);
      context.currentTime = 10.04;
      await vi.advanceTimersByTimeAsync(10);
      context.currentTime = 10.14;
      await vi.advanceTimersByTimeAsync(10);
      context.currentTime = 11;
      engine.updateLayer("edit", [{ ...note(), note: 64 }, { ...off, note: 64 }], 1, 2, 0n);
      expect(engine.transport("edit").positionSeconds).toBeCloseTo(0.95);
      context.currentTime = 12.055;
      await vi.advanceTimersByTimeAsync(10);
      expect(engine.soundingPitches("edit")).toEqual([64]);
      expect(engine.transport("edit").positionSeconds).toBeCloseTo(0.005);
      context.currentTime = 12.14;
      await vi.advanceTimersByTimeAsync(10);
      engine.updateLayer("edit", [], 1, 2, 0n);
      context.currentTime = 14.055;
      await vi.advanceTimersByTimeAsync(10);
      expect(engine.soundingPitches("edit")).toEqual([]);
      expect(engine.transport("edit").state).toBe("playing");
      expect(engine.transport("edit").positionSeconds).toBeCloseTo(0.005);
      engine.stopReplay();
    } finally { vi.useRealTimers(); }
  });

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

  it("reports the loop position from the audio clock and wraps back to the origin", async () => {
    vi.useFakeTimers();
    const context = new FakeContext();
    const engine = createWebEngine({
      createContext: () => context as unknown as AudioContext,
      requestMIDIAccess: async () => ({ inputs: new Map(), onstatechange: null }),
    });
    context.setState("running");
    context.currentTime = 10;
    const started = engine.transport();
    expect(started.availability).toBe("available");
    expect(started.state).toBe("stopped");
    expect(started.positionSeconds).toBeNull();
    engine.loopLayer("layer", [{ ...note(), scheduleElapsed: 2_000_000n }], 1, 1, 1_000_000n);
    const scheduled = engine.transport();
    expect(scheduled.state).toBe("playing");
    expect(scheduled.positionSeconds).toBeNull();
    context.currentTime = 10.05 + 0.25;
    const mid = engine.transport();
    expect(mid.positionSeconds).toBeCloseTo(1.25, 5);
    expect(mid.revision).toBe(scheduled.revision);
    context.currentTime = 10.05 + 1.05;
    await vi.advanceTimersByTimeAsync(30);
    const wrapped = engine.transport();
    expect(wrapped.revision).toBeGreaterThan(mid.revision);
    expect(wrapped.positionSeconds).not.toBeNull();
    expect(wrapped.positionSeconds!).toBeGreaterThanOrEqual(1);
    expect(wrapped.positionSeconds!).toBeLessThan(1.2);
    engine.stopLayer("layer");
    const stopped = engine.transport();
    expect(stopped.state).toBe("stopped");
    expect(stopped.positionSeconds).toBeNull();
    vi.useRealTimers();
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
