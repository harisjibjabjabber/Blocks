/**
 * Working notes for the roll. Source capture events are read and never written.
 * CC64 stays on the source events and is copied through for playback.
 */

import type { CapturedEvent } from "../domain/capture";
import { loopEvents } from "../domain/loop-events";
import type { KnownGrid } from "./roll-time";
import { DEFAULT_SNAP, snapStep, snapTime, snapIndexAt, type SnapDivision } from "./snap";

export interface RollNote {
  id: string;
  channel: number;
  pitch: number;
  start: bigint;
  end: bigint;
  velocity: number;
  sourceOnId: string | null;
  sourceOffId: string | null;
}

type Pairable = {
  id: string;
  kind: string;
  note: number;
  velocity: number;
  channel: number;
  scheduleElapsed: bigint;
};

export function notesFromEvents(events: readonly Pairable[]): RollNote[] {
  const ordered = events.slice().sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : 0));
  const pending = new Map<string, { id: string; start: bigint; velocity: number; pitch: number; channel: number }>();
  const notes: RollNote[] = [];
  const last = ordered.length > 0 ? ordered[ordered.length - 1].scheduleElapsed : 0n;
  for (const event of ordered) {
    const key = event.channel + ":" + event.note;
    if (event.kind === "note-on" && event.velocity > 0) {
      const open = pending.get(key);
      if (open && event.scheduleElapsed > open.start) {
        notes.push({ id: open.id, channel: open.channel, pitch: open.pitch, start: open.start, end: event.scheduleElapsed, velocity: open.velocity, sourceOnId: open.id, sourceOffId: null });
      }
      pending.set(key, { id: event.id, start: event.scheduleElapsed, velocity: event.velocity, pitch: event.note, channel: event.channel });
    } else if (event.kind === "note-off" || (event.kind === "note-on" && event.velocity === 0)) {
      const open = pending.get(key);
      if (open) {
        const end = event.scheduleElapsed > open.start ? event.scheduleElapsed : open.start + 1n;
        notes.push({ id: open.id, channel: open.channel, pitch: open.pitch, start: open.start, end, velocity: open.velocity, sourceOnId: open.id, sourceOffId: event.id });
        pending.delete(key);
      }
    }
  }
  for (const open of pending.values()) {
    const end = last > open.start ? last : open.start + 1n;
    notes.push({ id: open.id, channel: open.channel, pitch: open.pitch, start: open.start, end, velocity: open.velocity, sourceOnId: open.id, sourceOffId: null });
  }
  return notes;
}

export function moveNote(notes: readonly RollNote[], id: string, start: bigint, pitch: number): RollNote[] {
  return notes.map((note) => {
    if (note.id !== id) {
      return note;
    }
    const length = note.end > note.start ? note.end - note.start : 1n;
    const nextPitch = Math.max(0, Math.min(127, pitch));
    return { ...note, pitch: nextPitch, start, end: start + length };
  });
}

export function resizeNote(notes: readonly RollNote[], id: string, edge: "start" | "end", time: bigint): RollNote[] {
  return notes.map((note) => {
    if (note.id !== id) {
      return note;
    }
    if (edge === "start") {
      const start = time < note.end ? time : note.end - 1n;
      return { ...note, start };
    }
    const end = time > note.start ? time : note.start + 1n;
    return { ...note, end };
  });
}

export function drawNote(notes: readonly RollNote[], note: RollNote): RollNote[] {
  return notes.concat(note);
}

export function eraseNote(notes: readonly RollNote[], id: string): RollNote[] {
  return notes.filter((note) => note.id !== id);
}

export function setVelocity(notes: readonly RollNote[], id: string, velocity: number): RollNote[] {
  const next = Math.max(1, Math.min(127, Math.round(velocity)));
  return notes.map((note) => (note.id === id ? { ...note, velocity: next } : note));
}

/** Quarter-note beat divided by 4. Tie at exactly half a step rounds away from zero. */
export function gridStep(grid: KnownGrid): bigint {
  return snapStep(grid, DEFAULT_SNAP) ?? 0n;
}

export function snapDelta(delta: bigint, step: bigint): bigint {
  if (step <= 0n) {
    return delta;
  }
  if (delta >= 0n) {
    return ((delta + step / 2n) / step) * step;
  }
  const abs = -delta;
  return -((abs + step / 2n) / step) * step;
}

export function nearestStep(time: bigint, grid: KnownGrid): bigint {
  return snapTime(time, grid, DEFAULT_SNAP);
}

/** A preview. The notes array and the source events are not written. */
export function quantisePreview(notes: readonly RollNote[], ids: readonly string[], grid: KnownGrid | null, division: SnapDivision = DEFAULT_SNAP, strength = 50, swing = 0): { id: string; start: bigint; end: bigint }[] {
  if (snapStep(grid, division) === null) {
    return [];
  }
  const chosen = new Set(ids);
  return notes
    .filter((note) => chosen.size === 0 || chosen.has(note.id))
    .map((note) => {
      const length = note.end > note.start ? note.end - note.start : 1n;
      let target = snapTime(note.start, grid, division);
      const index = snapIndexAt(target, grid, division);
      if (index !== null && index % 2n !== 0n) target += (snapStep(grid, division) ?? 0n) * BigInt(Math.round(Math.max(0, Math.min(50, swing)))) / 100n;
      const start = note.start + (target - note.start) * BigInt(Math.round(Math.max(0, Math.min(100, strength)))) / 100n;
      return { id: note.id, start, end: start + length };
    });
}

export function applyPreview(notes: readonly RollNote[], preview: readonly { id: string; start: bigint; end: bigint }[]): RollNote[] {
  const byId = new Map(preview.map((item) => [item.id, item]));
  return notes.map((note) => {
    const next = byId.get(note.id);
    return next ? { ...note, start: next.start, end: next.end } : note;
  });
}

export function workingPlayback(source: readonly CapturedEvent[], notes: readonly RollNote[], bounds: { start: bigint; end: bigint }): CapturedEvent[] {
  if (source.length === 0) {
    return [];
  }
  const template = source[0];
  // Keep expression payloads and timestamps intact, including pitch/pressure
  // represented as `other`. Note edits replace only note messages.
  const controllers = source.filter((event) => event.kind !== "note-on" && event.kind !== "note-off");
  const sounded: CapturedEvent[] = [];
  const boundaryReleases: CapturedEvent[] = [];
  for (const note of notes) {
    if (note.end <= note.start || note.start >= bounds.end) continue;
    sounded.push(cloneEvent(template, note.id + ":on", "note-on", note.pitch, note.velocity, note.channel, note.start));
    sounded.push(cloneEvent(template, note.id + ":off", "note-off", note.pitch, 0, note.channel, note.end));
    if (note.end > bounds.end) boundaryReleases.push(cloneEvent(template, note.id + ":off", "note-off", note.pitch, 0, note.channel, bounds.end));
  }
  // Resolve sustain on the edited note history before clipping. A finger release
  // before start can still sound under CC64; deleted notes never enter this copy.
  const played = loopEvents([...controllers, ...sounded], bounds);
  return [...played, ...boundaryReleases].sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : 0));
}

function cloneEvent(template: CapturedEvent, id: string, kind: CapturedEvent["kind"], note: number, velocity: number, channel: number, time: bigint): CapturedEvent {
  return {
    ...template,
    id,
    kind,
    note,
    velocity,
    channel,
    controller: 0,
    value: 0,
    scheduleElapsed: time,
    elapsedSource: time,
    elapsedReceipt: time,
    sourceTimestamp: time,
    receiptTimestamp: time,
    raw: null,
    origin: "touch",
  };
}
