/** Time axis of the take ribbon. Empty time after the last attack is part of the period, not a new note. */

export interface RibbonNote {
  id: string;
  scheduleElapsed: bigint;
  note: number;
}

export interface RibbonMark {
  id: string;
  note: number;
  /** 0 is the first drawn attack. 100 is the period end when that end is later than the last attack. */
  xPercent: number;
  y: number;
}

export function ribbonMarks(notes: readonly RibbonNote[], coverageEnd?: bigint): RibbonMark[] {
  if (notes.length === 0) {
    return [];
  }
  const start = notes[0].scheduleElapsed;
  const last = notes[notes.length - 1].scheduleElapsed;
  const end = coverageEnd !== undefined && coverageEnd > last ? coverageEnd : last;
  const span = end > start ? end - start : 1n;
  const lowest = notes.reduce((min, event) => Math.min(min, event.note), notes[0].note);
  const highest = notes.reduce((max, event) => Math.max(max, event.note), notes[0].note);
  const pitch = Math.max(1, highest - lowest);
  return notes.map((event) => ({
    id: event.id,
    note: event.note,
    xPercent: Number(((event.scheduleElapsed - start) * 100n) / span),
    y: ((highest - event.note) / pitch) * 116,
  }));
}
