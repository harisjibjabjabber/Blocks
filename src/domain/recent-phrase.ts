import type { CapturedEvent } from "./capture";

/**
 * Basic recent-phrase cut.
 * Not musically validated Capture, and not the later journey
 * (a loop in sync, optional quantise, bass, drums).
 * A later contract and evaluation corpus can replace this module.
 * It does not mutate events, write a tempo, or quantise.
 *
 * The silence gap max(1.5s, 2 beats), or 1.5s in free time, is a tuning hypothesis, not a law.
 */

export const GAP_HYPOTHESIS =
  "Silence longer than max(1.5s, 2 beats), or 1.5s when there is no locked beat, is a tuning hypothesis, not a law.";

export interface CutBounds {
  start: bigint;
  end: bigint;
}

export interface ControllerSeed {
  channel: number;
  controller: number;
  value: number;
  sourceId: string;
}

export interface RecentPhraseCut {
  status: "recent" | "ambiguous";
  selection: CutBounds;
  priorPhrase: CutBounds | null;
  priorBar: CutBounds | null;
  heldNoteIds: string[];
  controllerSeed: ControllerSeed[];
  deferred: string[];
  note: string;
}

export interface RecentPhraseOptions {
  ticksPerSecond: number;
  /** Read-only locked beat. Null means free time. Never written back. */
  gridPeriodTicks: bigint | null;
  /** Read-only phase origin from an earlier layer. Not stored on the project. */
  gridOriginTicks: bigint | null;
  historyMayBeTruncated: boolean;
}

const CHORD_MS = 40;
const FREE_GAP_MS = 1500;

function ms(ticksPerSecond: number, millis: number): bigint {
  return BigInt(Math.round((millis / 1000) * ticksPerSecond));
}

function clustersOf(events: readonly CapturedEvent[], chord: bigint): bigint[] {
  const attacks = events
    .filter((event) => event.kind === "note-on" && event.velocity > 0)
    .map((event) => event.scheduleElapsed)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const clusters: bigint[] = [];
  for (const time of attacks) {
    const last = clusters[clusters.length - 1];
    if (last === undefined || time - last > chord) {
      clusters.push(time);
    }
  }
  return clusters;
}

function eventsBetween(events: readonly CapturedEvent[], start: bigint, end: bigint): CapturedEvent[] {
  return events.filter((event) => event.scheduleElapsed >= start && event.scheduleElapsed <= end);
}

function lastTime(events: readonly CapturedEvent[], start: bigint, end: bigint): bigint {
  let last = start;
  for (const event of events) {
    if (event.scheduleElapsed >= start && event.scheduleElapsed <= end && event.scheduleElapsed > last) {
      last = event.scheduleElapsed;
    }
  }
  return last;
}

function boundsFrom(events: readonly CapturedEvent[], start: bigint, endLimit: bigint): CutBounds | null {
  const inside = events.filter((event) => event.scheduleElapsed >= start && event.scheduleElapsed <= endLimit);
  if (!inside.some((event) => event.kind === "note-on" && event.velocity > 0)) {
    return null;
  }
  let end = start;
  for (const event of inside) {
    if (event.scheduleElapsed > end) {
      end = event.scheduleElapsed;
    }
  }
  return { start, end };
}

function heldNotes(events: readonly CapturedEvent[], start: bigint): string[] {
  const open = new Map<string, string>();
  const ordered = events.slice().sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : a.sequence < b.sequence ? -1 : 1));
  for (const event of ordered) {
    if (event.scheduleElapsed >= start) {
      break;
    }
    const key = event.channel + ":" + event.note;
    if (event.kind === "note-on" && event.velocity > 0) {
      open.set(key, event.id);
    } else if (event.kind === "note-off" || (event.kind === "note-on" && event.velocity === 0)) {
      open.delete(key);
    }
  }
  return [...open.values()];
}

function seedControllers(events: readonly CapturedEvent[], start: bigint): ControllerSeed[] {
  const latest = new Map<string, ControllerSeed>();
  for (const event of events) {
    if (event.scheduleElapsed >= start || event.kind !== "cc") {
      continue;
    }
    latest.set(event.channel + ":" + event.controller, {
      channel: event.channel,
      controller: event.controller,
      value: event.value,
      sourceId: event.id,
    });
  }
  return [...latest.values()];
}

function noteStillOpen(events: readonly CapturedEvent[], selection: CutBounds): boolean {
  const open = new Set<string>();
  for (const event of events) {
    if (event.scheduleElapsed < selection.start || event.scheduleElapsed > selection.end) {
      continue;
    }
    const key = event.channel + ":" + event.note;
    if (event.kind === "note-on" && event.velocity > 0) {
      open.add(key);
    } else if (event.kind === "note-off" || (event.kind === "note-on" && event.velocity === 0)) {
      open.delete(key);
    }
  }
  return open.size > 0;
}

function samePitchOverlap(events: readonly CapturedEvent[]): boolean {
  const open = new Set<string>();
  const ordered = events.slice().sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : 0));
  for (const event of ordered) {
    const key = event.channel + ":" + event.note;
    if (event.kind === "note-on" && event.velocity > 0) {
      if (open.has(key)) {
        return true;
      }
      open.add(key);
    } else if (event.kind === "note-off" || (event.kind === "note-on" && event.velocity === 0)) {
      open.delete(key);
    }
  }
  return false;
}

function pedalNeverLifts(events: readonly CapturedEvent[]): boolean {
  let down = false;
  let liftedAfter = false;
  let sawDown = false;
  for (const event of events) {
    if (event.kind === "cc" && event.controller === 64) {
      down = event.value >= 64;
      if (down) {
        sawDown = true;
        liftedAfter = false;
      } else if (sawDown) {
        liftedAfter = true;
      }
    }
  }
  return sawDown && down && !liftedAfter;
}

export function eventsInSelection(events: readonly CapturedEvent[], selection: CutBounds): CapturedEvent[] {
  return events.filter((event) => event.scheduleElapsed >= selection.start && event.scheduleElapsed <= selection.end);
}

export function recentPhraseCut(events: readonly CapturedEvent[], options: RecentPhraseOptions): RecentPhraseCut {
  const deferred: string[] = [
    "Source separation of touch, MIDI, and replay is deferred. This cut only sees the events it is given.",
  ];
  if (options.historyMayBeTruncated) {
    deferred.push("Older events may already have left the ribbon. This cut cannot reconstruct them.");
  }
  if (events.length === 0) {
    return {
      status: "ambiguous",
      selection: { start: 0n, end: 0n },
      priorPhrase: null,
      priorBar: null,
      heldNoteIds: [],
      controllerSeed: [],
      deferred,
      note: "Nothing to cut. " + GAP_HYPOTHESIS,
    };
  }
  const first = events.reduce((min, event) => (event.scheduleElapsed < min ? event.scheduleElapsed : min), events[0].scheduleElapsed);
  const last = events.reduce((max, event) => (event.scheduleElapsed > max ? event.scheduleElapsed : max), events[0].scheduleElapsed);
  const chord = ms(options.ticksPerSecond, CHORD_MS);
  const freeGap = ms(options.ticksPerSecond, FREE_GAP_MS);
  const beat = options.gridPeriodTicks !== null && options.gridPeriodTicks > 0n ? options.gridPeriodTicks : null;
  const gap = beat !== null && beat * 2n > freeGap ? beat * 2n : freeGap;
  const clusters = clustersOf(events, chord);
  const breaks: number[] = [];
  for (let i = 1; i < clusters.length; i += 1) {
    if (clusters[i] - clusters[i - 1] > gap) {
      breaks.push(i);
    }
  }
  const timeNote = beat === null ? "Free time: no locked beat, so the gap hypothesis is 1.5s." : "A locked beat was read and not changed. The gap hypothesis is max(1.5s, 2 beats).";
  let selection: CutBounds = { start: first, end: last };
  let status: RecentPhraseCut["status"] = "ambiguous";
  let priorPhrase: CutBounds | null = null;
  let priorBar: CutBounds | null = null;
  let how = "No silence cleared the gap hypothesis, so this window is the whole ribbon and may be the whole session.";

  if (breaks.length > 0) {
    const split = breaks[breaks.length - 1];
    const phraseStart = clusters[split];
    selection = { start: phraseStart, end: last };
    status = "recent";
    how = "Basic recent-phrase cut after the last hypothetical rest. Not a validated phrase.";
    const previousStart = breaks.length > 1 ? clusters[breaks[breaks.length - 2]] : clusters[0];
    const previousEndLimit = phraseStart - 1n;
    priorPhrase = boundsFrom(events, previousStart, previousEndLimit);
  } else if (beat !== null) {
    const bar = beat * 4n;
    const origin = options.gridOriginTicks ?? first;
    const relative = last - origin;
    const mod = ((relative % bar) + bar) % bar;
    let barStart = last - (mod === 0n ? bar : mod);
    if (barStart < first) {
      barStart = first;
    }
    if (barStart < last) {
      selection = { start: barStart, end: last };
      status = "recent";
      how = "No rest cleared the hypothesis. The window is the last bar of the locked grid, as a basic cut. The grid and its phase were not changed.";
      const earlier = barStart - bar;
      if (earlier >= first) {
        priorBar = boundsFrom(events, earlier, barStart - 1n);
      }
    } else {
      how = "The recording is shorter than one bar of the locked grid. The window stays the whole ribbon. The grid was not changed.";
    }
  }

  if (breaks.length > 0 && beat !== null) {
    const bar = beat * 4n;
    const earlier = selection.start - bar;
    if (earlier >= first) {
      priorBar = boundsFrom(events, earlier, selection.start - 1n);
    }
  }

  const heldNoteIds = heldNotes(events, selection.start);
  const controllerSeed = seedControllers(events, selection.start);
  if (heldNoteIds.length > 0) {
    deferred.push("A note was already sounding at the cut. Its attack stays in the raw history and is not used to widen the selection back through the session. Playback can start that hold with the loop.");
  }
  if (noteStillOpen(events, selection)) {
    deferred.push("A note is still on at the end of the cut. No note-off was invented. Playback uses the release tail.");
  }
  if (pedalNeverLifts(events)) {
    deferred.push("Continuous pedalled play with no last pedal-up is deferred as a phrase finder. CC64 in the history is seeded; no pedal-up event was added.");
  }
  if (controllerSeed.some((entry) => entry.controller === 66) || events.some((event) => event.kind === "cc" && event.controller === 66)) {
    deferred.push("CC66 is kept in the controller seed when it is already in the history. Sostenuto is not a separate hold in the Warm EP yet.");
  }
  if (samePitchOverlap(events)) {
    deferred.push("Overlapping same-pitch notes stay in the raw history. Playback still uses one voice per channel and note, so a later note-on replaces the earlier one.");
  }
  if (selection.start === first && selection.end === last && events.length > 1 && status === "ambiguous") {
    deferred.push("Note-boundary expansion was not allowed to fall back to a wider cut. The window is already the whole ribbon because no rest or bar was used.");
  }

  const selectedCount = eventsBetween(events, selection.start, selection.end).length;
  const note = [
    how,
    timeNote,
    GAP_HYPOTHESIS,
    "This is not the finished Capture journey.",
    selectedCount + " events in the window, " + events.length + " in the raw history.",
  ].join(" ");

  return {
    status,
    selection,
    priorPhrase,
    priorBar,
    heldNoteIds,
    controllerSeed,
    deferred,
    note,
  };
}

export function moveSelectionStart(
  events: readonly CapturedEvent[],
  selection: CutBounds,
  direction: "earlier" | "later",
  ticksPerSecond: number,
): { selection: CutBounds; note: string } {
  const chord = ms(ticksPerSecond, CHORD_MS);
  const clusters = clustersOf(events, chord);
  if (direction === "later") {
    const next = clusters.find((time) => time > selection.start && time < selection.end);
    if (next === undefined) {
      return { selection, note: "No later attack inside this window." };
    }
    return {
      selection: { start: next, end: selection.end },
      note: "Selection start moved to the next attack. Raw times were not edited. This is still a basic cut.",
    };
  }
  const earlier = [...clusters].reverse().find((time) => time < selection.start);
  if (earlier === undefined) {
    return { selection, note: "No earlier attack in the raw history." };
  }
  return {
    selection: { start: earlier, end: selection.end },
    note: "Selection start moved to the previous attack. Raw times were not edited. This is still a basic cut.",
  };
}

export function lastEventTime(events: readonly CapturedEvent[], selection: CutBounds): bigint {
  return lastTime(events, selection.start, selection.end);
}
