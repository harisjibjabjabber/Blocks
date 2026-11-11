import type { CapturedEvent } from "./capture";

/** A loop is [start, end): releases at its end are valid, new attacks are not. */
export function loopEvents(events: readonly CapturedEvent[], bounds: { start: bigint; end: bigint }): CapturedEvent[] {
  const ordered = events.slice().sort((a, b) => a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : a.sequence < b.sequence ? -1 : a.sequence > b.sequence ? 1 : 0);
  const pedal = new Map<number, boolean>();
  const held = new Map<string, { on: CapturedEvent; off?: CapturedEvent }>();
  for (const event of ordered) {
    if (event.scheduleElapsed >= bounds.start) break;
    if (event.id.endsWith(":seed") || event.id.endsWith(":hold")) continue;
    if (event.kind === "cc" && event.controller === 64) {
      pedal.set(event.channel, event.value >= 64);
      if (event.value < 64) for (const [key, voice] of held) if (voice.on.channel === event.channel && voice.off) held.delete(key);
      continue;
    }
    const key = `${event.channel}:${event.note}`;
    if (event.kind === "note-on" && event.velocity > 0) held.set(key, { on: event });
    else if (event.kind === "note-off" || (event.kind === "note-on" && event.velocity === 0)) {
      const voice = held.get(key);
      if (voice && pedal.get(event.channel)) voice.off = event;
      else held.delete(key);
    }
  }
  const attacksAtStart = new Set(ordered.filter(event => event.scheduleElapsed === bounds.start && event.kind === "note-on" && event.velocity > 0).map(event => `${event.channel}:${event.note}`));
  const preface: CapturedEvent[] = [];
  for (const [key, voice] of held) {
    if (attacksAtStart.has(key)) continue;
    // Derived playback context only. Source timestamps, payloads and raw history stay intact.
    preface.push({ ...voice.on, id: voice.on.id + ":hold", scheduleElapsed: bounds.start });
    if (voice.off) preface.push({ ...voice.off, id: voice.off.id + ":hold", scheduleElapsed: bounds.start });
  }
  return [...preface, ...ordered.filter(event => {
    if (event.scheduleElapsed < bounds.start || event.scheduleElapsed > bounds.end) return false;
    if (event.id.endsWith(":seed") || event.id.endsWith(":hold")) return false;
    return event.scheduleElapsed < bounds.end || event.kind !== "note-on" || event.velocity === 0;
  })];
}
