import { describe, expect, it } from "vitest";
import { liveAudioTime, planFromElapsed, selectDue } from "../audio/web/schedule";
import { RollingHistory, domainsCompatible, type IncomingEvent } from "./capture";
import { inferPulse } from "./inference";
import { capturePerformance, defaultOverlay, deriveSchedule, loopLonger, loopShorter, playbackStretch, recover, withChoice, withQuantise } from "./phrase";
import { createProject, gridStatusCopy, projectFromJson, projectToJson, proposeGrid, setProjectTempo } from "./project";
import { routeLearnedControl } from "./learn";
import { bindMidiInputs, enableFromGesture, type MidiPortLike } from "../midi/web/enable";
import { parseCompleteMidi } from "../midi/web/complete";

function event(partial: {
  sequence: bigint;
  at: bigint;
  kind?: IncomingEvent["kind"];
  domain?: IncomingEvent["domain"];
  note?: number;
  velocity?: number;
  controller?: number;
  value?: number;
  sourceTimestamp?: bigint | null;
  receiptTimestamp?: bigint;
  missingSourceTimestamp?: boolean;
  origin?: IncomingEvent["origin"];
}): IncomingEvent {
  const source = partial.sourceTimestamp === undefined ? partial.at : partial.sourceTimestamp;
  return {
    domain: partial.domain ?? "web-performance-us",
    sequence: partial.sequence,
    portId: "p",
    sessionId: "s",
    channel: 0,
    kind: partial.kind ?? "note-on",
    note: partial.note ?? 60,
    velocity: partial.velocity ?? 100,
    controller: partial.controller ?? 0,
    value: partial.value ?? 0,
    sourceTimestamp: source,
    receiptTimestamp: partial.receiptTimestamp ?? partial.at,
    missingSourceTimestamp: partial.missingSourceTimestamp ?? false,
    raw: [0x90, partial.note ?? 60, partial.velocity ?? 100],
    origin: partial.origin ?? "raw-midi",
  };
}

function historyFrom(times: bigint[], kind: IncomingEvent["kind"] = "note-on", extra?: Partial<IncomingEvent>): IncomingEvent[] {
  const history = new RollingHistory("web-performance-us", 60_000_000n, 4096);
  return times.map((time, index) =>
    history.push(
      event({
        sequence: BigInt(index + 1),
        at: time * 1000n,
        kind,
        sourceTimestamp: time * 1000n,
        receiptTimestamp: time * 1000n,
        ...extra,
      }),
    ),
  );
}

describe("clocks", () => {
  it("refuses to mix android and web timestamps", () => {
    expect(domainsCompatible("android-monotonic-ns", "web-performance-us")).toBe(false);
    const history = new RollingHistory("web-performance-us", 1_000_000n, 10);
    expect(() =>
      history.push(
        event({
          domain: "android-monotonic-ns",
          sequence: 1n,
          at: 1n,
        }),
      ),
    ).toThrow(/mix/);
  });

  it("keeps exact nanosecond subtraction and orders equal times by sequence", () => {
    const history = new RollingHistory("android-monotonic-ns", 10_000_000_000n, 10);
    const epoch = 9_000_000_000_000_000_000n;
    history.push(event({ domain: "android-monotonic-ns", sequence: 2n, at: epoch + 5n, sourceTimestamp: epoch + 5n, receiptTimestamp: epoch + 8n }));
    history.push(event({ domain: "android-monotonic-ns", sequence: 1n, at: epoch, sourceTimestamp: epoch, receiptTimestamp: epoch }));
    const snap = history.snapshot();
    expect(snap.map((item) => item.sequence)).toEqual([1n, 2n]);
    expect(snap[1].scheduleElapsed - snap[0].scheduleElapsed).toBe(5n);
  });

  it("shows age eviction separately from an overload drop", () => {
    const aged = new RollingHistory("web-performance-us", 1_000_000n, 10, 100000);
    aged.push(event({ sequence: 1n, at: 0n }));
    aged.push(event({ sequence: 2n, at: 2_000_000n }));
    expect(aged.length).toBe(1);
    expect(aged.ribbonNotice().kind).toBe("age");
    const packed = new RollingHistory("web-performance-us", 60_000_000n, 2, 100000);
    packed.push(event({ sequence: 1n, at: 0n }));
    packed.push(event({ sequence: 2n, at: 10n }));
    packed.push(event({ sequence: 3n, at: 20n }));
    expect(packed.length).toBe(2);
    expect(packed.ribbonNotice()).toEqual({ kind: "overload", dropped: 1, reason: "events" });
  });

  it("flags a missing source timestamp and still records receipt time", () => {
    const history = new RollingHistory("android-monotonic-ns", 1_000_000_000n, 10);
    const saved = history.push(
      event({
        domain: "android-monotonic-ns",
        sequence: 1n,
        at: 50n,
        sourceTimestamp: null,
        receiptTimestamp: 80n,
        missingSourceTimestamp: true,
      }),
    );
    expect(saved.missingSourceTimestamp).toBe(true);
    expect(saved.elapsedSource).toBeNull();
    expect(saved.scheduleElapsed).toBe(0n);
  });
});

describe("web midi messages", () => {
  it("accepts complete messages and rejects fragments and running status", () => {
    const note = parseCompleteMidi([0x90, 0x3c, 0x40]);
    expect(note.ok && note.kind).toBe("note-on");
    const zero = parseCompleteMidi([0x90, 0x3c, 0x00]);
    expect(zero.ok && zero.velocityZero).toBe(true);
    const pedal = parseCompleteMidi([0xb0, 0x40, 0x7f]);
    expect(pedal.ok && pedal.kind).toBe("cc");
    expect(parseCompleteMidi([0x3c, 0x40]).ok).toBe(false);
    expect(parseCompleteMidi([0x90, 0x3c]).ok).toBe(false);
    expect(parseCompleteMidi([0xf0, 0x01, 0xf7]).ok).toBe(false);
  });
});

describe("enable flow", () => {
  it("resumes audio before requesting MIDI, with sysex off", async () => {
    const calls: string[] = [];
    const result = await enableFromGesture({
      resume: async () => {
        calls.push("resume");
      },
      audioState: () => "running",
      requestMIDIAccess: async (options) => {
        calls.push("midi:" + String(options.sysex));
        return { inputs: [["1", { id: "1", name: "Keystep", state: "connected", onmidimessage: null }]], onstatechange: null };
      },
    });
    expect(calls).toEqual(["resume", "midi:false"]);
    expect(result.gate.ready).toBe(true);
  });

  it("resumes audio before refusing an insecure page, and does not ask for MIDI", async () => {
    const calls: string[] = [];
    const result = await enableFromGesture({
      resume: async () => {
        calls.push("resume");
      },
      audioState: () => "running",
      isSecureContext: () => false,
      requestMIDIAccess: async () => {
        calls.push("midi");
        return { inputs: [], onstatechange: null };
      },
    });
    expect(calls).toEqual(["resume"]);
    expect(result.gate.kind).toBe("unsupported");
    expect(result.gate.detail).toMatch(/localhost/);
    expect(result.gate.audioRunning).toBe(true);
    expect(result.gate.ready).toBe(false);
  });

  it("keeps readiness false when audio stays suspended", async () => {
    const result = await enableFromGesture({
      resume: async () => undefined,
      audioState: () => "suspended",
      requestMIDIAccess: async () => ({ inputs: [["1", { id: "1", state: "connected", onmidimessage: null }]], onstatechange: null }),
    });
    expect(result.gate.kind).toBe("suspended");
    expect(result.gate.ready).toBe(false);
  });

  it("re-reads audio after MIDI denial so a suspended context is not running", async () => {
    let state = "running";
    const result = await enableFromGesture({
      resume: async () => undefined,
      audioState: () => state,
      requestMIDIAccess: async () => {
        state = "suspended";
        throw new DOMException("no", "NotAllowedError");
      },
    });
    expect(result.gate.kind).toBe("denied");
    expect(result.gate.audioRunning).toBe(false);
  });

  it("mock only: Firefox without requestMIDIAccess is a site-permission add-on, not a denial", async () => {
    const result = await enableFromGesture({
      resume: async () => undefined,
      audioState: () => "running",
      browser: "firefox",
    });
    expect(result.gate.kind).toBe("site-addon");
    expect(result.gate.detail).toMatch(/site-permission add-on/);
    expect(result.gate.detail).not.toMatch(/you denied|permission was denied/i);
    expect(result.gate.audioRunning).toBe(true);
  });

  it("mock only: a denied permission state does not call requestMIDIAccess again", async () => {
    let called = false;
    const result = await enableFromGesture({
      resume: async () => undefined,
      audioState: () => "running",
      permission: { state: "denied", policyAllows: true },
      requestMIDIAccess: async () => {
        called = true;
        return { inputs: [], onstatechange: null };
      },
    });
    expect(called).toBe(false);
    expect(result.gate.kind).toBe("settings-blocked");
    expect(result.gate.detail).toMatch(/site settings|browser settings/i);
  });

  it("mock only: Firefox site-permission add-on SecurityError is not a denial", async () => {
    const result = await enableFromGesture({
      resume: async () => undefined,
      audioState: () => "running",
      requestMIDIAccess: async () => {
        throw new DOMException("WebMIDI requires a site permission add-on to activate", "SecurityError");
      },
    });
    expect(result.gate.kind).toBe("site-addon");
    expect(result.gate.detail).toMatch(/site-permission add-on/);
    expect(result.gate.detail).toMatch(/Chrome or Edge/);
    expect(result.gate.detail).not.toMatch(/you denied/i);
    expect(result.order).toEqual(["resume", "midi"]);
  });

  it("separates unsupported, denied, and no device", async () => {
    const unsupported = await enableFromGesture({ resume: async () => undefined, audioState: () => "running" });
    expect(unsupported.gate.kind).toBe("unsupported");
    const denied = await enableFromGesture({
      resume: async () => undefined,
      audioState: () => "running",
      requestMIDIAccess: async () => {
        throw new DOMException("no", "NotAllowedError");
      },
    });
    expect(denied.gate.kind).toBe("denied");
    const empty = await enableFromGesture({
      resume: async () => undefined,
      audioState: () => "running",
      requestMIDIAccess: async () => ({ inputs: [], onstatechange: null }),
    });
    expect(empty.gate.kind).toBe("no-device");
  });

  it("replaces port listeners instead of stacking them", () => {
    const calls: string[] = [];
    const port: MidiPortLike = { id: "a", state: "connected", onmidimessage: null };
    const first = () => calls.push("first");
    const second = () => calls.push("second");
    const bound = bindMidiInputs([], [port], first);
    bindMidiInputs(bound, [port], second);
    port.onmidimessage?.({ data: new Uint8Array([0x90, 60, 1]), timeStamp: 1 });
    expect(calls).toEqual(["second"]);
  });
});

describe("inference and phrase", () => {
  it("estimates a straight pulse and offers half and double without editing events", () => {
    const events = historyFrom([0n, 500n, 1000n, 1500n, 2000n, 2500n, 3000n, 3500n]);
    const before = events.map((item) => item.scheduleElapsed);
    const ids = events.map((item) => item.id);
    const report = inferPulse(events, 1_000_000);
    expect(report.pulse).toBe("estimated");
    expect(report.ambiguity).toBe("half-double");
    expect(Number(report.periodTicks)).toBeGreaterThan(450_000);
    expect(Number(report.periodTicks)).toBeLessThan(550_000);
    const performance = capturePerformance(events);
    const overlay = withChoice(defaultOverlay(events), "double");
    expect(performance.events.map((item) => item.scheduleElapsed)).toEqual(before);
    expect(performance.events.map((item) => item.id)).toEqual(ids);
    expect(overlay.tempoChoice).toBe("double");
  });

  it("treats a staggered chord as one attack", () => {
    const times = [0n, 15n, 30n, 500n, 510n, 1000n, 1020n, 1500n, 1510n, 2000n];
    const events = historyFrom(times);
    const report = inferPulse(events, 1_000_000);
    expect(report.staggeredChordCount).toBeGreaterThan(0);
    expect(Number(report.periodTicks ?? 0n)).toBeGreaterThan(400_000);
    expect(Number(report.maxStaggerTicks)).toBeGreaterThanOrEqual(20_000);
  });

  it("reports swing without quantising", () => {
    const events = historyFrom([0n, 400n, 600n, 1000n, 1200n, 1600n, 1800n, 2200n]);
    const report = inferPulse(events, 1_000_000);
    expect(report.swing).not.toBeNull();
    const derived = deriveSchedule(capturePerformance(events), defaultOverlay(events), report);
    expect(derived.events.map((item) => item.scheduleElapsed)).toEqual(events.map((item) => item.scheduleElapsed));
  });

  it("counts syncopation and leaves the time in place", () => {
    const events = historyFrom([0n, 500n, 750n, 1000n, 1500n, 2000n, 2500n]);
    const report = inferPulse(events, 1_000_000);
    expect(report.syncopationCount).toBeGreaterThan(0);
    expect(events[2].scheduleElapsed).toBe(750_000n);
  });

  it("marks a short leading interval as a pickup candidate", () => {
    const report = inferPulse(historyFrom([0n, 250n, 1000n, 2000n, 3000n, 4000n, 5000n]), 1_000_000);
    expect(report.pickupCandidate).toBe(true);
  });

  it("keeps sparse chords and pedal data", () => {
    const history = new RollingHistory("web-performance-us", 30_000_000n, 100);
    const times = [0n, 2000n, 4000n, 6000n, 8000n];
    times.forEach((time, index) => {
      history.push(event({ sequence: BigInt(index * 2 + 1), at: time * 1000n, kind: "note-on" }));
      history.push(
        event({
          sequence: BigInt(index * 2 + 2),
          at: time * 1000n + 10n,
          kind: "cc",
          controller: 64,
          value: 127,
          note: 0,
          velocity: 0,
        }),
      );
    });
    const events = history.snapshot();
    expect(events.some((item) => item.kind === "cc")).toBe(true);
    const report = inferPulse(events, 1_000_000);
    expect(report.onsetCount).toBe(5);
    expect(report.pulse).toBe("estimated");
  });

  it("separates a false start from the later pulse", () => {
    const report = inferPulse(historyFrom([0n, 400n, 5000n, 5500n, 6000n, 6500n, 7000n]), 1_000_000);
    expect(report.falseStart).toBe(true);
    expect(report.gaps.length).toBeGreaterThan(0);
    expect(report.pulse).toBe("estimated");
  });

  it("does not invent a pulse for three attacks", () => {
    const report = inferPulse(historyFrom([0n, 100n, 800n]), 1_000_000);
    expect(report.pulse).toBe("none");
    expect(report.bpm).toBeNull();
  });

  it("does not change a locked project tempo when a reading is chosen", () => {
    const fresh = createProject();
    expect(fresh.tempoBpm).toBeNull();
    expect(fresh.gridLocked).toBe(false);
    expect(gridStatusCopy(fresh)).not.toMatch(/locked/);
    expect(gridStatusCopy(fresh)).toMatch(/120 seconds is the ribbon/);
    const events = historyFrom([0n, 500n, 1000n, 1500n, 2000n, 2500n, 3000n]);
    const report = inferPulse(events, 1_000_000);
    const overlay = withChoice(defaultOverlay(events), "half");
    const first = proposeGrid(fresh, report.bpm);
    expect(first.proposed).toBe(report.bpm !== null);
    expect(first.project.gridLocked).toBe(report.bpm !== null);
    const established = { ...setProjectTempo(fresh, 96), gridLocked: true };
    const locked = proposeGrid(established, 140);
    expect(locked.project.tempoBpm).toBe(96);
    expect(locked.proposed).toBe(false);
    const played = playbackStretch(report, { ...overlay, playback: { mode: "tempo", bpm: locked.project.tempoBpm ?? 96 } });
    expect(played.stretch).not.toBeNaN();
    expect(locked.project.tempoBpm).toBe(96);
  });

  it("lets the first inference propose the grid and keeps an existing project locked", () => {
    const events = historyFrom([0n, 500n, 1000n, 1500n, 2000n]);
    const report = inferPulse(events, 1_000_000);
    const opened = proposeGrid(createProject(), report.bpm);
    expect(opened.proposed).toBe(true);
    expect(opened.project.gridLocked).toBe(true);
    expect(opened.project.tempoBpm).not.toBeNull();
    const again = proposeGrid(opened.project, 72);
    expect(again.proposed).toBe(false);
    expect(again.project.tempoBpm).toBe(opened.project.tempoBpm);
    const quiet = proposeGrid(createProject(), null);
    expect(quiet.proposed).toBe(false);
    expect(quiet.project.gridLocked).toBe(false);
    expect(gridStatusCopy(quiet.project)).not.toMatch(/locked/);
    const stored = projectFromJson(projectToJson({ ...createProject(), tempoBpm: 88, gridLocked: true, phrases: [{ id: "layer-1", createdAt: "t", domain: "web-performance-us", events: [] }] }));
    expect(stored?.gridLocked).toBe(true);
    expect(stored?.tempoBpm).toBe(88);
    const later = proposeGrid(stored as NonNullable<typeof stored>, 140);
    expect(later.project.tempoBpm).toBe(88);
    const emptyOld = projectFromJson(JSON.stringify({ name: "Sketch", tempoBpm: 120, sustainCc: 64, afterCapture: "loop", phrases: [] }));
    expect(emptyOld?.gridLocked).toBe(false);
    expect(emptyOld?.tempoBpm).toBeNull();
    expect(gridStatusCopy(emptyOld as NonNullable<typeof emptyOld>)).not.toMatch(/locked/);
  });

  it("quantises only a copy and can recover", () => {
    const events = historyFrom([0n, 500n, 740n, 1000n, 1500n, 2000n, 2500n]);
    const performance = capturePerformance(events);
    const original = performance.events[2].scheduleElapsed;
    const report = inferPulse(events, 1_000_000);
    const untouched = deriveSchedule(performance, withQuantise(defaultOverlay(events), 0), report);
    expect(untouched.events[2].scheduleElapsed).toBe(original);
    const snapped = deriveSchedule(performance, withQuantise(defaultOverlay(events), 1), report);
    expect(performance.events[2].scheduleElapsed).toBe(original);
    expect(snapped.events[2].scheduleElapsed).not.toBe(original);
    expect(recover(events).quantiseStrength).toBe(0);
  });

  it("refuses to lengthen a loop past the recording when there is no pulse", () => {
    const events = historyFrom([0n, 80n, 300n]);
    const report = inferPulse(events, 1_000_000);
    const overlay = defaultOverlay(events);
    expect(loopLonger(overlay, report, capturePerformance(events)).note).toMatch(/No pulse/);
    expect(loopShorter(overlay, report).overlay.selectionEnd).toBe(overlay.selectionEnd);
  });
});

describe("web scheduler", () => {
  it("places notes on the audio clock and drops an overdue backlog", () => {
    const start = planFromElapsed({ audioStartSec: 10, elapsedUs: 0n, anchorElapsedUs: 0n, stretch: 1 });
    expect(start).toBe(10);
    const later = planFromElapsed({ audioStartSec: 10, elapsedUs: 500_000n, anchorElapsedUs: 0n, stretch: 2 });
    expect(later).toBe(11);
    const planned = [
      { audioTimeSec: 1, elapsedUs: 0n, kind: "note-on" as const, channel: 0, note: 60, velocity: 100, controller: 0, value: 0 },
      { audioTimeSec: 12, elapsedUs: 1n, kind: "note-on" as const, channel: 0, note: 64, velocity: 90, controller: 0, value: 0 },
    ];
    const selected = selectDue({ planned, nextIndex: 0, audioNowSec: 12, lookaheadSec: 0.03, lateToleranceSec: 0.04 });
    expect(selected.dropped).toBe(1);
    expect(selected.due.map((item) => item.note)).toEqual([64]);
    const live = liveAudioTime({ audioNowSec: 3, performanceNowMs: 1000, eventTimeStampMs: 1000, lateToleranceSec: 0.04 });
    expect(live.when).toBe(3);
    expect(live.drop).toBe(false);
  });
});

describe("controller learn", () => {
  it("refuses CC 64 and playing keys, and still records every event", () => {
    const map = { capture: null, transport: null };
    const sustain = routeLearnedControl({ kind: "cc", controller: 64 }, "capture", map);
    expect(sustain.record).toBe(true);
    expect(sustain.fire).toBeNull();
    expect(sustain.decision?.accept).toBe(false);
    const key = routeLearnedControl({ kind: "note-on", controller: 60 }, "transport", map);
    expect(key.record).toBe(true);
    expect(key.decision?.accept).toBe(false);
    expect(key.decision?.message).toMatch(/Playing keys/);
    const learned = routeLearnedControl({ kind: "cc", controller: 67 }, "capture", map);
    expect(learned.decision).toEqual({ accept: true, controller: 67, message: "Capture is CC 67." });
    const armed = routeLearnedControl({ kind: "cc", controller: 67 }, null, { capture: 67, transport: 1 });
    expect(armed.record).toBe(true);
    expect(armed.fire).toBe("capture");
    const stopped = routeLearnedControl({ kind: "cc", controller: 1 }, null, { capture: 67, transport: 1 });
    expect(stopped.fire).toBe("transport");
    const noteStillRecorded = routeLearnedControl({ kind: "note-on", controller: 60 }, null, { capture: 67, transport: 1 });
    expect(noteStillRecorded.record).toBe(true);
    expect(noteStillRecorded.fire).toBeNull();
  });
});
