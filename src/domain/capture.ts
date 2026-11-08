export type TimeDomain = "android-monotonic-ns" | "web-performance-us";

export type EventOrigin =
  | "raw-midi"
  | "touch"
  | "synthetic-overflow"
  | "synthetic-disconnect"
  | "synthetic-lifecycle";

export type MidiKind = "note-on" | "note-off" | "cc" | "pitch" | "other";

export interface IncomingEvent {
  domain: TimeDomain;
  sequence: bigint;
  portId: string;
  sessionId: string;
  channel: number;
  kind: MidiKind;
  note: number;
  velocity: number;
  controller: number;
  value: number;
  sourceTimestamp: bigint | null;
  receiptTimestamp: bigint;
  missingSourceTimestamp: boolean;
  raw: readonly number[] | null;
  origin: EventOrigin;
}

export interface CapturedEvent extends IncomingEvent {
  id: string;
  elapsedSource: bigint | null;
  elapsedReceipt: bigint;
  scheduleElapsed: bigint;
}

export type RibbonNotice =
  | { kind: "none" }
  | { kind: "age"; dropped: number }
  | { kind: "overload"; dropped: number; reason: "events" | "bytes" };

export interface SessionClock {
  domain: TimeDomain;
  sourceEpoch: bigint | null;
  receiptEpoch: bigint | null;
}

export function domainsCompatible(left: TimeDomain, right: TimeDomain): boolean {
  return left === right;
}

export function relative(later: bigint, earlier: bigint): bigint {
  return later - earlier;
}

export class RollingHistory {
  private clock: SessionClock;
  private events: CapturedEvent[] = [];
  private notice: RibbonNotice = { kind: "none" };

  constructor(
    readonly domain: TimeDomain,
    readonly window: bigint,
    readonly maxEvents: number,
    readonly maxRawBytes = 262144,
  ) {
    this.clock = { domain, sourceEpoch: null, receiptEpoch: null };
  }

  push(incoming: IncomingEvent): CapturedEvent {
    if (incoming.domain !== this.domain) {
      throw new Error("Refusing to mix " + incoming.domain + " into " + this.domain);
    }
    if (this.clock.receiptEpoch === null) {
      this.clock = { ...this.clock, receiptEpoch: incoming.receiptTimestamp };
    }
    if (incoming.sourceTimestamp !== null && this.clock.sourceEpoch === null) {
      this.clock = { ...this.clock, sourceEpoch: incoming.sourceTimestamp };
    }
    const elapsedReceipt = incoming.receiptTimestamp - (this.clock.receiptEpoch as bigint);
    const elapsedSource =
      incoming.sourceTimestamp !== null && this.clock.sourceEpoch !== null
        ? incoming.sourceTimestamp - this.clock.sourceEpoch
        : null;
    const event: CapturedEvent = {
      ...incoming,
      id: incoming.sessionId + ":" + incoming.sequence.toString(),
      raw: incoming.raw ? incoming.raw.slice() : null,
      elapsedReceipt,
      elapsedSource,
      scheduleElapsed: elapsedSource ?? elapsedReceipt,
    };
    const index = this.events.findIndex((item) => item.sequence > event.sequence);
    if (index === -1) {
      this.events.push(event);
    } else {
      this.events.splice(index, 0, event);
    }
    this.trim();
    return event;
  }

  snapshot(): CapturedEvent[] {
    return this.events.map((event) => ({ ...event, raw: event.raw ? event.raw.slice() : null }));
  }

  replace(events: readonly CapturedEvent[]): void {
    this.events = events.map((event) => ({ ...event, raw: event.raw ? event.raw.slice() : null }));
    this.notice = { kind: "none" };
  }

  clear(): void {
    this.events = [];
    this.notice = { kind: "none" };
  }

  get length(): number {
    return this.events.length;
  }

  ribbonNotice(): RibbonNotice {
    return this.notice;
  }

  oldestAge(nowElapsed: bigint): bigint {
    if (this.events.length === 0) {
      return 0n;
    }
    return nowElapsed - this.events[0].scheduleElapsed;
  }

  private trim(): void {
    if (this.events.length === 0) {
      return;
    }
    const newest = this.events[this.events.length - 1].scheduleElapsed;
    const aged = this.events.filter((event) => newest - event.scheduleElapsed <= this.window);
    const ageDropped = this.events.length - aged.length;
    this.events = aged;
    let overloadDropped = 0;
    let overloadReason: "events" | "bytes" = "events";
    while (this.events.length > this.maxEvents || this.rawBytes() > this.maxRawBytes) {
      if (this.events.length === 0) {
        break;
      }
      overloadReason = this.events.length > this.maxEvents ? "events" : "bytes";
      this.events.shift();
      overloadDropped += 1;
    }
    if (overloadDropped > 0) {
      this.notice = { kind: "overload", dropped: overloadDropped, reason: overloadReason };
    } else if (ageDropped > 0) {
      this.notice = { kind: "age", dropped: ageDropped };
    }
  }

  private rawBytes(): number {
    return this.events.reduce((sum, event) => sum + (event.raw ? event.raw.length : 0) + 32, 0);
  }
}
