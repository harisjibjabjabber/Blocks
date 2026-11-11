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
  /** Playback wrap and ribbon end. Trailing silence is empty time, not a new note. */
  loop: CutBounds;
  /** Measured attack spacing of the phrase. Null when the spacing is too weak to extend the loop. */
  periodTicks: bigint | null;
  /** First onset the spacing is measured from. Null when periodTicks is null. */
  phaseOriginTicks: bigint | null;
  periodConfidence: "measured" | "fallback";
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
  /** Legacy read-only grid origin. Grid phase alone never establishes a phrase boundary. */
  gridOriginTicks: bigint | null;
  historyMayBeTruncated: boolean;
}

const CHORD_MS = 40;
/** Unchanged hypothesis. A break still has to clear this. Equal chord spacing is not a break. */
const FREE_GAP_MS = 1500;

function ms(ticksPerSecond: number, millis: number): bigint {
  return BigInt(Math.round((millis / 1000) * ticksPerSecond));
}

function medianOf(values: bigint[]): bigint {
  if (values.length === 0) {
    return 0n;
  }
  const sorted = values.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[Math.floor(sorted.length / 2)];
}

function pedalAt(events: readonly CapturedEvent[], time: bigint): boolean {
  let down = false;
  for (const event of events) {
    if (event.scheduleElapsed > time) {
      break;
    }
    if (event.kind === "cc" && event.controller === 64) {
      down = event.value >= 64;
    }
  }
  return down;
}

/** Silence before the next attack. Note-off gaps under a held CC64 are not silence. Without any release, the attack gap is all the list contains. */
function silenceBeforeNext(events: readonly CapturedEvent[], prev: bigint, next: bigint, chord: bigint): bigint {
  const keys = new Set<string>();
  for (const event of events) {
    if (event.scheduleElapsed < prev || event.scheduleElapsed > prev + chord) {
      continue;
    }
    if (event.kind === "note-on" && event.velocity > 0) {
      keys.add(event.channel + ":" + event.note);
    }
  }
  if (keys.size === 0) {
    return next - prev;
  }
  let pedal = pedalAt(events, prev);
  const released = new Set<string>();
  let sawRelease = false;
  let lastSoundOff: bigint | null = null;
  const allReleased = () => [...keys].every((key) => released.has(key));
  for (const event of events) {
    if (event.scheduleElapsed <= prev || event.scheduleElapsed >= next) {
      continue;
    }
    if (event.kind === "cc" && event.controller === 64) {
      const wasDown = pedal;
      pedal = event.value >= 64;
      if (wasDown && !pedal && allReleased()) {
        lastSoundOff = event.scheduleElapsed;
      }
      continue;
    }
    const key = event.channel + ":" + event.note;
    if (!keys.has(key)) {
      continue;
    }
    if (event.kind === "note-off" || (event.kind === "note-on" && event.velocity === 0)) {
      sawRelease = true;
      released.add(key);
      if (!pedal && allReleased()) {
        lastSoundOff = event.scheduleElapsed;
      }
    }
  }
  if (!sawRelease) {
    return next - prev;
  }
  if (lastSoundOff === null) {
    return 0n;
  }
  const silence = next - lastSoundOff;
  return silence > 0n ? silence : 0n;
}

function isPhraseBreak(index: number, gaps: bigint[], threshold: bigint): boolean {
  const gap = gaps[index];
  if (gap <= threshold) {
    return false;
  }
  const others = gaps.filter((_, other) => other !== index);
  if (others.length === 0) {
    return true;
  }
  const median = medianOf(others);
  if (median <= 0n) {
    return true;
  }
  return gap * 2n > median * 5n;
}

function repeatedSpacing(gaps: bigint[]): boolean {
  if (gaps.length < 3) {
    return false;
  }
  const median = medianOf(gaps);
  if (median <= 0n) {
    return false;
  }
  return gaps.every((gap) => gap * 2n <= median * 3n && median * 2n <= gap * 3n);
}

/** Attacks that sound together. A later note joins the stack while an earlier one is still held, or while CC64 is holding it. This is not a wider attack window. */
function overlapStacks(events: readonly CapturedEvent[]): { time: bigint; count: number; soundEnd: bigint }[] {
  const ordered = events.slice().sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : a.sequence < b.sequence ? -1 : a.sequence > b.sequence ? 1 : 0));
  let pedal = false;
  const notes: { key: string; released: boolean; alive: boolean }[] = [];
  const stacks: { time: bigint; count: number; soundEnd: bigint }[] = [];
  const anyAlive = () => notes.some((note) => note.alive);
  const silenceStack = (time: bigint) => {
    const stack = stacks[stacks.length - 1];
    if (stack && !anyAlive()) {
      stack.soundEnd = time;
    }
  };
  for (const event of ordered) {
    if (event.kind === "cc" && event.controller === 64) {
      const wasDown = pedal;
      pedal = event.value >= 64;
      if (wasDown && !pedal) {
        for (const note of notes) {
          if (note.released) {
            note.alive = false;
          }
        }
        silenceStack(event.scheduleElapsed);
      }
      continue;
    }
    const key = event.channel + ":" + event.note;
    if (event.kind === "note-off" || (event.kind === "note-on" && event.velocity === 0)) {
      const note = notes.find((item) => item.alive && item.key === key && !item.released);
      if (note) {
        note.released = true;
        if (!pedal) {
          note.alive = false;
          silenceStack(event.scheduleElapsed);
        }
      }
      continue;
    }
    if (event.kind === "note-on" && event.velocity > 0) {
      if (!anyAlive()) {
        notes.length = 0;
        stacks.push({ time: event.scheduleElapsed, count: 1, soundEnd: event.scheduleElapsed });
      } else {
        stacks[stacks.length - 1].count += 1;
      }
      notes.push({ key, released: false, alive: true });
    }
  }
  return stacks;
}

interface FingerStack {
  time: bigint;
  attacks: bigint[];
  fingerOff: (bigint | null)[];
}

/** Same joining as overlapStacks, plus the finger release of each attack. Pedal does not count as a finger hold. */
function fingerStacks(events: readonly CapturedEvent[]): FingerStack[] {
  const ordered = events.slice().sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : a.sequence < b.sequence ? -1 : a.sequence > b.sequence ? 1 : 0));
  const notes: { key: string; stack: number; index: number; alive: boolean }[] = [];
  const stacks: FingerStack[] = [];
  const anyAlive = () => notes.some((note) => note.alive);
  for (const event of ordered) {
    if (event.kind === "cc") {
      continue;
    }
    const key = event.channel + ":" + event.note;
    if (event.kind === "note-off" || (event.kind === "note-on" && event.velocity === 0)) {
      const note = notes.find((item) => item.alive && item.key === key);
      if (note) {
        note.alive = false;
        const stack = stacks[note.stack];
        if (stack.fingerOff[note.index] === null) {
          stack.fingerOff[note.index] = event.scheduleElapsed;
        }
      }
      continue;
    }
    if (event.kind === "note-on" && event.velocity > 0) {
      if (!anyAlive()) {
        notes.length = 0;
        stacks.push({ time: event.scheduleElapsed, attacks: [event.scheduleElapsed], fingerOff: [null] });
      } else {
        const stack = stacks[stacks.length - 1];
        stack.attacks.push(event.scheduleElapsed);
        stack.fingerOff.push(null);
      }
      notes.push({ key, stack: stacks.length - 1, index: stacks[stacks.length - 1].attacks.length - 1, alive: true });
    }
  }
  return stacks;
}

/** A stack is a chord when its notes are still held after the time it took to attack them. A brief legato smear is not. */
function isHarmonic(stack: FingerStack): boolean {
  if (stack.attacks.length < 2) {
    return false;
  }
  const last = stack.attacks[stack.attacks.length - 1];
  const span = last - stack.attacks[0];
  const check = last + span;
  return stack.fingerOff.every((off) => off === null || off > check);
}

function harmonicStart(stacks: FingerStack[]): { start: bigint; throughEnd: boolean } | null {
  const harmonic: number[] = [];
  for (let i = 0; i < stacks.length; i += 1) {
    if (isHarmonic(stacks[i])) {
      harmonic.push(i);
    }
  }
  if (harmonic.length < 3) {
    return null;
  }
  let first = harmonic[harmonic.length - 1];
  let count = 1;
  for (let k = harmonic.length - 2; k >= 0; k -= 1) {
    const between = harmonic[k + 1] - harmonic[k] - 1;
    if (between > 0) {
      break;
    }
    first = harmonic[k];
    count += 1;
  }
  if (count < 3 || harmonic[harmonic.indexOf(first) + count - 1] !== harmonic[harmonic.length - 1]) {
    return null;
  }
  const tail = stacks.length - 1 - harmonic[harmonic.length - 1];
  return { start: stacks[first].time, throughEnd: tail <= count };
}

function nearClass(gap: bigint, model: bigint): boolean {
  return model > 0n && gap * 2n <= model * 3n && model * 2n <= gap * 3n;
}

/** Recent attacks whose gaps match the short and long classes measured on the tail. Not a new silence constant. */
function classWalkStart(clusters: bigint[]): number | null {
  if (clusters.length < 7) {
    return null;
  }
  const gaps: bigint[] = [];
  for (let i = 1; i < clusters.length; i += 1) {
    gaps.push(clusters[i] - clusters[i - 1]);
  }
  const seed = gaps.slice(-6);
  const shorts: bigint[] = [];
  const longs: bigint[] = [];
  for (let i = seed.length; i >= 2; i -= 2) {
    const left = seed[i - 2];
    const right = seed[i - 1];
    if (left <= right) {
      shorts.push(left);
      longs.push(right);
    } else {
      shorts.push(right);
      longs.push(left);
    }
  }
  const shortM = medianOf(shorts);
  const longM = medianOf(longs);
  let start = gaps.length;
  while (start > 0 && (nearClass(gaps[start - 1], shortM) || nearClass(gaps[start - 1], longM))) {
    start -= 1;
  }
  if (gaps.length - start < 4) {
    return null;
  }
  return start;
}

function attacksReleased(events: readonly CapturedEvent[], start: bigint, end: bigint): boolean {
  const ons = events.filter((event) => event.kind === "note-on" && event.velocity > 0 && event.scheduleElapsed >= start && event.scheduleElapsed <= end);
  if (ons.length === 0) {
    return false;
  }
  return ons.every((on) => events.some((event) => (event.kind === "note-off" || (event.kind === "note-on" && event.velocity === 0)) && event.note === on.note && event.channel === on.channel && event.scheduleElapsed > on.scheduleElapsed));
}

function onsetGaps(times: bigint[]): bigint[] {
  const gaps: bigint[] = [];
  for (let i = 1; i < times.length; i += 1) {
    gaps.push(times[i] - times[i - 1]);
  }
  return gaps;
}

function measuredPeriod(times: bigint[], selection: CutBounds): { loop: CutBounds; periodTicks: bigint; phaseOriginTicks: bigint } | null {
  if (times.length < 4) {
    return null;
  }
  const gaps = onsetGaps(times);
  if (!repeatedSpacing(gaps)) {
    return null;
  }
  const spacing = medianOf(gaps);
  if (spacing <= 0n) {
    return null;
  }
  return {
    loop: { start: selection.start, end: times[times.length - 1] + spacing },
    periodTicks: spacing,
    phaseOriginTicks: times[0],
  };
}

/** The loop ends one measured slot after the last chord onset. A short release does not pull that end in, and it does not move the notes. */
function nominalLoop(events: readonly CapturedEvent[], selection: CutBounds, clusters: bigint[]): {
  loop: CutBounds;
  periodTicks: bigint | null;
  phaseOriginTicks: bigint | null;
  periodConfidence: "measured" | "fallback";
} {
  const fallback = {
    loop: { start: selection.start, end: selection.end },
    periodTicks: null,
    phaseOriginTicks: null,
    periodConfidence: "fallback" as const,
  };
  const harmonic = fingerStacks(events)
    .filter((stack) => stack.time >= selection.start && stack.time <= selection.end && isHarmonic(stack))
    .map((stack) => stack.time);
  const clusterTimes = clusters.filter((time) => time >= selection.start && time <= selection.end);
  const measured = measuredPeriod(harmonic, selection) ?? measuredPeriod(clusterTimes, selection);
  if (!measured) {
    return fallback;
  }
  return { ...measured, periodConfidence: "measured" };
}

function sizedClusters(events: readonly CapturedEvent[], chord: bigint): { time: bigint; count: number }[] {
  const attacks = events
    .filter((event) => event.kind === "note-on" && event.velocity > 0)
    .map((event) => event.scheduleElapsed)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const clusters: { time: bigint; count: number }[] = [];
  for (const time of attacks) {
    const last = clusters[clusters.length - 1];
    if (last === undefined || time - last.time > chord) {
      clusters.push({ time, count: 1 });
    } else {
      last.count += 1;
    }
  }
  return clusters;
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
      loop: { start: 0n, end: 0n },
      periodTicks: null,
      phaseOriginTicks: null,
      periodConfidence: "fallback",
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
  const sized = sizedClusters(events, chord);
  const clusters = sized.map((cluster) => cluster.time);
  const gaps: bigint[] = [];
  for (let i = 1; i < clusters.length; i += 1) {
    gaps.push(silenceBeforeNext(events, clusters[i - 1], clusters[i], chord));
  }
  const breaks: number[] = [];
  for (let i = 0; i < gaps.length; i += 1) {
    if (isPhraseBreak(i, gaps, gap)) {
      breaks.push(i + 1);
    }
  }
  const attackGaps: bigint[] = [];
  for (let i = 1; i < clusters.length; i += 1) {
    attackGaps.push(clusters[i] - clusters[i - 1]);
  }
  const timeNote = beat === null ? "Free time: no locked beat, so the gap hypothesis is 1.5s." : "A locked beat was read and not changed. The gap hypothesis is max(1.5s, 2 beats).";
  // A locked tempo/phase is not evidence that the wanted phrase is one bar.
  // Preserve the available tape unless rest or progression evidence narrows it.
  let selection: CutBounds = { start: first, end: last };
  let status: RecentPhraseCut["status"] = "ambiguous";
  let priorPhrase: CutBounds | null = null;
  let priorBar: CutBounds | null = null;
  let how = "No silence cleared the gap hypothesis, so this window is the whole ribbon and may be the whole session.";

  const stacks = overlapStacks(events);
  let stackStart = stacks.length;
  while (stackStart > 0 && stacks[stackStart - 1].count >= 2) {
    stackStart -= 1;
  }
  const soundingGaps: bigint[] = [];
  if (stacks.length - stackStart >= 3) {
    for (let i = stackStart + 1; i < stacks.length; i += 1) {
      const silence = stacks[i].time - stacks[i - 1].soundEnd;
      soundingGaps.push(silence > 0n ? silence : 0n);
    }
  }
  let stackCut = stackStart;
  for (let i = 0; i < soundingGaps.length; i += 1) {
    if (isPhraseBreak(i, soundingGaps, gap)) {
      stackCut = stackStart + i + 1;
    }
  }

  let runStart = sized.length;
  while (runStart > 0 && sized[runStart - 1].count >= 2) {
    runStart -= 1;
  }
  const runGaps = gaps.slice(runStart, Math.max(runStart, sized.length - 1));
  let chordCut = runStart;
  if (stacks.length - stackStart < 3 && sized.length - runStart >= 3) {
    for (let i = 0; i < runGaps.length; i += 1) {
      if (isPhraseBreak(i, runGaps, gap)) {
        chordCut = runStart + i + 1;
      }
    }
  }

  if (stacks.length - stackStart >= 3) {
    const phraseStart = stacks[stackCut].time;
    selection = { start: phraseStart, end: last };
    status = "recent";
    how = "Notes that are still sounding, including under the pedal, stay one chord. Those chords stay one progression. Basic cut, not finished Capture.";
    if (stackCut > 0) {
      priorPhrase = boundsFrom(events, stacks[0].time, phraseStart - 1n);
    }
  } else if (sized.length - runStart >= 3) {
    const phraseStart = clusters[chordCut];
    selection = { start: phraseStart, end: last };
    status = "recent";
    how = "The recent chords stay one progression. Rests are compared with each other, not with the earlier line. Basic cut, not finished Capture.";
    if (chordCut > 0) {
      priorPhrase = boundsFrom(events, clusters[0], phraseStart - 1n);
    }
  } else if (breaks.length > 0) {
    const split = breaks[breaks.length - 1];
    const phraseStart = clusters[split];
    selection = { start: phraseStart, end: last };
    status = "recent";
    how = "Basic recent-phrase cut after the last hypothetical rest. Not a validated phrase.";
    const previousStart = breaks.length > 1 ? clusters[breaks[breaks.length - 2]] : clusters[0];
    const previousEndLimit = phraseStart - 1n;
    priorPhrase = boundsFrom(events, previousStart, previousEndLimit);
  } else if (gaps.length > 0 && gaps.every((item) => item === 0n)) {
    status = "recent";
    how = "Note-offs under a held CC64 are not rests, so the chords stay one phrase. Basic cut, not finished Capture.";
  } else if (repeatedSpacing(attackGaps)) {
    const median = medianOf(attackGaps);
    const phraseSpan = median * 8n;
    if (phraseSpan > 0n && last - first > phraseSpan * 2n) {
      const snapped = [...clusters].reverse().find((time) => time <= last - phraseSpan && time > first);
      if (snapped !== undefined && snapped < last) {
        selection = { start: snapped, end: last };
        status = "ambiguous";
        how = "No gap stood out from the spacing. This is a bounded recent window, not a found phrase and not the whole ribbon.";
        priorPhrase = boundsFrom(events, first, snapped - 1n);
      }
    } else {
      status = "recent";
      how = "These attacks keep one spacing, so they stay one progression. A rest that matches that spacing is not a phrase break. Basic cut, not finished Capture.";
    }
  }

  // A later pattern pass must not undo an already-supported rest boundary
  // and pull an abandoned idea back into the new phrase.
  const latestRestStart = breaks.length ? clusters[breaks[breaks.length - 1]] : first;
  const passage = harmonicStart(fingerStacks(events.filter(event => event.scheduleElapsed >= latestRestStart)));
  if (passage && passage.throughEnd) {
    selection = { start: passage.start, end: last };
    status = "recent";
    how = "Notes that stay held together after they are attacked stay one chord. A short tail after those chords stays in the raw range. Basic cut, not finished Capture.";
    if (passage.start > first) {
      priorPhrase = boundsFrom(events, first, passage.start - 1n);
    }
  } else {
    const walked = classWalkStart(clusters);
    if (walked !== null) {
      const walkStart = clusters[walked];
      const released = attacksReleased(events, walkStart, last);
      if (walked > 0 && walkStart >= latestRestStart && walkStart < selection.start) {
        selection = { start: walkStart, end: last };
        status = "recent";
        how = "The recent attacks repeat a short gap and a long gap measured from the tail. Earlier gaps do not match those two. Basic cut, not finished Capture.";
        priorPhrase = boundsFrom(events, first, walkStart - 1n);
      } else if (walked > 0 && walkStart >= latestRestStart && selection.start === first && status === "ambiguous") {
        selection = { start: walkStart, end: last };
        status = "recent";
        how = "The recent attacks repeat a short gap and a long gap measured from the tail. Earlier gaps do not match those two. Basic cut, not finished Capture.";
        priorPhrase = boundsFrom(events, first, walkStart - 1n);
      } else if (walked === 0 && latestRestStart === first && released && selection.start !== first) {
        selection = { start: first, end: last };
        status = "recent";
        how = "The take repeats one measured spacing and the notes were released, so the window stays the whole ribbon. Basic cut, not finished Capture.";
        priorPhrase = null;
      }
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
  } else if (selection.start > first) {
    deferred.push("Note-boundary expansion was not allowed to fall back to a wider cut.");
  }

  const selectedCount = eventsBetween(events, selection.start, selection.end).length;
  const note = [
    how,
    timeNote,
    GAP_HYPOTHESIS,
    "This is not the finished Capture journey.",
    selectedCount + " events in the window, " + events.length + " in the raw history.",
  ].join(" ");

  const period = nominalLoop(events, selection, clusters);
  const periodNote = period.periodConfidence === "measured"
    ? " The loop and the ribbon run to one measured slot after the last chord onset. An early release does not shorten that slot and does not move the notes. Empty time is silence."
    : " Spacing was too weak to extend the loop, so it stays on the recorded events.";
  return {
    status,
    selection,
    loop: period.loop,
    periodTicks: period.periodTicks,
    phaseOriginTicks: period.phaseOriginTicks,
    periodConfidence: period.periodConfidence,
    priorPhrase,
    priorBar,
    heldNoteIds,
    controllerSeed,
    deferred,
    note: note + periodNote,
  };
}

/** Apply an explicit capture range without re-running or rewriting the phrase finder.
 * Empty time inside these bounds is retained; raw attacks/releases stay untouched. */
export function withCaptureRange(events: readonly CapturedEvent[], proposal: RecentPhraseCut, bounds: CutBounds): RecentPhraseCut {
  if (typeof bounds.start !== "bigint" || typeof bounds.end !== "bigint" || bounds.start < 0n || bounds.end <= bounds.start) {
    throw new RangeError("Capture range must have non-negative start and positive duration.");
  }
  const ordered = events.slice().sort((a, b) => a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : a.sequence < b.sequence ? -1 : a.sequence > b.sequence ? 1 : 0);
  const selection = { start: bounds.start, end: bounds.end };
  const heldNoteIds = heldNotes(ordered, selection.start);
  const controllerSeed = seedControllers(ordered, selection.start);
  // Keep history/playback limitations, but replace assertions tied to the old cut.
  const deferred = proposal.deferred.filter(item => !item.startsWith("A note was already sounding at the cut.") && !item.startsWith("A note is still on at the end of the cut.") && !item.startsWith("Note-boundary expansion"));
  if (heldNoteIds.length) deferred.push("A note was already sounding at the cut. Its original attack remains in raw history; playback can seed the hold without widening the chosen range.");
  if (noteStillOpen(ordered, selection)) deferred.push("A note is still on at the end of the cut. No note-off was invented. Playback uses the release tail.");
  return {
    ...proposal,
    selection,
    loop: { ...selection },
    periodTicks: null,
    phaseOriginTicks: null,
    periodConfidence: "fallback",
    priorPhrase: null,
    priorBar: null,
    heldNoteIds,
    controllerSeed,
    deferred,
    note: `Manual capture range. The chosen start and end also define the loop, including empty time. Raw events and timing were not edited. ${eventsBetween(ordered, selection.start, selection.end).length} events in the window, ${events.length} in raw history.`,
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
