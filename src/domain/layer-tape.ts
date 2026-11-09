import { RollingHistory, type CapturedEvent, type IncomingEvent, type TimeDomain } from "./capture";

export interface TapeCheckpoint { events: CapturedEvent[]; controllers: CapturedEvent[] }

function controllers(events: readonly CapturedEvent[]): CapturedEvent[] {
  const latest = new Map<string, CapturedEvent>();
  for (const event of events) if (event.kind === "cc") latest.set(`${event.portId}:${event.channel}:${event.controller}`, event);
  return [...latest.values()];
}

/** A layer owns its tape; rotating membership never resets the session clock.
 * Old held attacks are not re-recorded in the next layer. Their real releases
 * still reach the engine; controller context carries without inventing notes. */
export class LayerTape {
  private history: RollingHistory;
  private context: CapturedEvent[] = [];
  constructor(domain: TimeDomain, window: bigint, maxEvents: number, maxRawBytes: number) {
    this.history = new RollingHistory(domain, window, maxEvents, maxRawBytes);
  }
  push(event: IncomingEvent): CapturedEvent { return this.history.push(event); }
  ribbonNotice() { return this.history.ribbonNotice(); }
  snapshot(): CapturedEvent[] {
    const events = this.history.snapshot();
    const first = events.findIndex(event => event.kind === "note-on" && event.velocity > 0);
    if (first < 0) return [];
    // A pedal/control arriving before the first new attack is context, not tape
    // duration. Its synthetic scheduling copy leaves source/receipt times intact.
    const start = events[first].scheduleElapsed;
    const seed = controllers([...this.context, ...events.slice(0, first)]).map(event => ({
      ...event, id: `${event.id}:tape-context`, scheduleElapsed: start,
      raw: event.raw ? event.raw.slice() : null,
    }));
    return [...seed, ...events.slice(first)];
  }
  checkpoint(): TapeCheckpoint { return { events: this.history.snapshot(), controllers: this.context.slice() }; }
  advance(): void {
    this.context = controllers([...this.context, ...this.history.snapshot()]);
    this.history.clear();
  }
  restore(checkpoint: TapeCheckpoint): void {
    // New playing since Capture must survive Undo, including a still-held note.
    const unique = new Map([...checkpoint.events, ...this.history.snapshot()].map(event => [event.id, event]));
    this.history.replace([...unique.values()].sort((a, b) => a.sequence < b.sequence ? -1 : a.sequence > b.sequence ? 1 : 0));
    this.context = checkpoint.controllers.slice();
  }
}
