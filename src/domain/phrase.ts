import type { CapturedEvent } from "./capture";
import type { InferenceReport } from "./inference";

export interface PhraseOverlay {
  selectionStart: bigint;
  selectionEnd: bigint;
  /** Playback loop. Separate from the raw selection. Falls back to the selection when omitted. */
  loopStart?: bigint;
  loopEnd?: bigint;
  tempoChoice: "estimated" | "half" | "double";
  phaseBeats: number;
  quantiseStrength: number;
  playback: { mode: "original" } | { mode: "tempo"; bpm: number };
}

export function loopWindow(overlay: PhraseOverlay): { start: bigint; end: bigint } {
  return {
    start: overlay.loopStart ?? overlay.selectionStart,
    end: overlay.loopEnd ?? overlay.selectionEnd,
  };
}

export interface Performance {
  domain: CapturedEvent["domain"];
  events: CapturedEvent[];
}

export function capturePerformance(events: readonly CapturedEvent[]): Performance {
  if (events.length === 0) {
    throw new Error("Nothing to capture.");
  }
  return {
    domain: events[0].domain,
    events: events.map((event) => Object.freeze({ ...event, raw: event.raw ? Object.freeze(event.raw.slice()) : null })),
  };
}

export function defaultOverlay(events: readonly CapturedEvent[]): PhraseOverlay {
  return {
    selectionStart: events[0].scheduleElapsed,
    selectionEnd: events[events.length - 1].scheduleElapsed,
    loopStart: events[0].scheduleElapsed,
    loopEnd: events[events.length - 1].scheduleElapsed,
    tempoChoice: "estimated",
    phaseBeats: 0,
    quantiseStrength: 0,
    playback: { mode: "original" },
  };
}

export function chosenPeriod(report: InferenceReport, choice: PhraseOverlay["tempoChoice"]): bigint | null {
  if (report.periodTicks === null) {
    return null;
  }
  if (choice === "half") {
    return report.periodTicks * 2n;
  }
  if (choice === "double") {
    return report.periodTicks / 2n > 0n ? report.periodTicks / 2n : report.periodTicks;
  }
  return report.periodTicks;
}

export function chosenBpm(report: InferenceReport, choice: PhraseOverlay["tempoChoice"]): number | null {
  const period = chosenPeriod(report, choice);
  if (period === null || report.bpm === null || report.periodTicks === null) {
    return null;
  }
  return report.bpm * (Number(report.periodTicks) / Number(period));
}

export interface DerivedEvent {
  event: CapturedEvent;
  scheduleElapsed: bigint;
}

export function deriveSchedule(
  performance: Performance,
  overlay: PhraseOverlay,
  report: InferenceReport,
): { events: DerivedEvent[]; note: string } {
  const selected = performance.events.filter(
    (event) => event.scheduleElapsed >= overlay.selectionStart && event.scheduleElapsed <= overlay.selectionEnd,
  );
  if (overlay.quantiseStrength <= 0 || report.pulse !== "estimated") {
    return {
      events: selected.map((event) => ({ event, scheduleElapsed: event.scheduleElapsed })),
      note: overlay.quantiseStrength <= 0 ? "Quantise is off. Original elapsed times are used." : "No pulse, so quantise was not applied.",
    };
  }
  const period = chosenPeriod(report, overlay.tempoChoice);
  if (period === null || period <= 0n) {
    return {
      events: selected.map((event) => ({ event, scheduleElapsed: event.scheduleElapsed })),
      note: "No period, so quantise was not applied.",
    };
  }
  const origin = overlay.selectionStart + (period * BigInt(overlay.phaseBeats)) / 4n;
  const strength = Math.min(1, overlay.quantiseStrength);
  const shiftFor = new Map<string, bigint>();
  const derived = selected.map((event) => {
    const key = event.channel + ":" + event.note;
    if (event.kind === "note-off" && shiftFor.has(key)) {
      return { event, scheduleElapsed: event.scheduleElapsed + (shiftFor.get(key) as bigint) };
    }
    const relative = event.scheduleElapsed - origin;
    const mod = ((relative % period) + period) % period;
    const delta = mod < period - mod ? -mod : period - mod;
    const applied = (delta * BigInt(Math.round(strength * 1000))) / 1000n;
    if (event.kind === "note-on") {
      shiftFor.set(key, applied);
    }
    return { event, scheduleElapsed: event.scheduleElapsed + applied };
  });
  return { events: derived, note: "Quantise moved a derived copy. The captured events were not edited." };
}

export function withQuantise(overlay: PhraseOverlay, strength: number): PhraseOverlay {
  return { ...overlay, quantiseStrength: Math.max(0, Math.min(1, strength)) };
}

export function withChoice(overlay: PhraseOverlay, tempoChoice: PhraseOverlay["tempoChoice"]): PhraseOverlay {
  return { ...overlay, tempoChoice };
}

export function shiftBeat(overlay: PhraseOverlay): PhraseOverlay {
  return { ...overlay, phaseBeats: (overlay.phaseBeats + 1) % 4 };
}

export function loopShorter(overlay: PhraseOverlay, report: InferenceReport): { overlay: PhraseOverlay; note: string } {
  const period = chosenPeriod(report, overlay.tempoChoice);
  if (period === null) {
    return { overlay, note: "No pulse, so the loop length stays put." };
  }
  const window = loopWindow(overlay);
  const bar = period * 4n;
  const next = window.end - bar;
  if (next <= window.start + period) {
    return { overlay, note: "A shorter loop would pass the start of the recording." };
  }
  return { overlay: { ...overlay, loopStart: window.start, loopEnd: next }, note: "Loop end moved one bar earlier. The raw selection was not moved." };
}

export function loopLonger(
  overlay: PhraseOverlay,
  report: InferenceReport,
  performance: Performance,
): { overlay: PhraseOverlay; note: string } {
  const period = chosenPeriod(report, overlay.tempoChoice);
  if (period === null) {
    return { overlay, note: "No pulse, so the loop length stays put." };
  }
  const window = loopWindow(overlay);
  const last = performance.events[performance.events.length - 1].scheduleElapsed;
  const next = window.end + period * 4n;
  if (next > last) {
    return { overlay, note: "The recording ends here. The loop was not extended past it." };
  }
  return { overlay: { ...overlay, loopStart: window.start, loopEnd: next }, note: "Loop end moved one bar later inside the recording. The raw selection was not moved." };
}

export function nudgeBoundary(overlay: PhraseOverlay, report: InferenceReport, performance: Performance): { overlay: PhraseOverlay; note: string } {
  const period = chosenPeriod(report, overlay.tempoChoice);
  if (period === null) {
    return { overlay, note: "No pulse, so the boundary stays put." };
  }
  const first = performance.events[0].scheduleElapsed;
  const last = performance.events[performance.events.length - 1].scheduleElapsed;
  let next = overlay.selectionStart + period;
  if (next >= overlay.selectionEnd) {
    next = first;
  }
  if (next < first) {
    next = first;
  }
  if (next >= last) {
    return { overlay, note: "The boundary cannot move past the recording." };
  }
  return { overlay: { ...overlay, selectionStart: next }, note: "Selection start moved by one estimated beat." };
}

export function recover(events: readonly CapturedEvent[]): PhraseOverlay {
  return defaultOverlay(events);
}

export function playbackStretch(report: InferenceReport, overlay: PhraseOverlay): { stretch: number; note: string } {
  if (overlay.playback.mode === "original") {
    return { stretch: 1, note: "Playback uses the original elapsed times." };
  }
  const bpm = chosenBpm(report, overlay.tempoChoice);
  if (bpm === null || overlay.playback.bpm <= 0) {
    return { stretch: 1, note: "No pulse estimate, so playback stays at the recorded elapsed time." };
  }
  return {
    stretch: bpm / overlay.playback.bpm,
    note: "Playback tempo is a separate choice. Project tempo was not changed.",
  };
}
