import type { RollNote } from "./roll-notes";

export function isBlackKey(pitch: number): boolean {
  return [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
}

/** White keys fill half of each neighbouring accidental row; black keys overlay them.
 * The hit target remains the entire semitone row, independent of painted geometry. */
export function keyShape(pitch: number, top: number, row: number) {
  const black = isBlackKey(pitch);
  const above = !black && pitch < 127 && isBlackKey(pitch + 1) ? row / 2 : 0;
  const below = !black && pitch > 0 && isBlackKey(pitch - 1) ? row / 2 : 0;
  return { top: (top - pitch) * row - above, height: row + above + below, black };
}

export function sameNotes(a: readonly RollNote[], b: readonly RollNote[]): boolean {
  return a.length === b.length && a.every((n, i) => {
    const m = b[i];
    return n.id === m.id && n.pitch === m.pitch && n.start === m.start && n.end === m.end &&
      n.velocity === m.velocity && n.channel === m.channel && n.sourceOnId === m.sourceOnId && n.sourceOffId === m.sourceOffId;
  });
}

let drawnSequence = 0;
export function nextDrawId(notes: readonly RollNote[]): string {
  let id: string;
  do { id = `draw-${++drawnSequence}`; } while (notes.some(note => note.id === id));
  return id;
}

/** One gesture, one optional commit. Preview never edits its immutable baseline. */
export class RollTransaction {
  readonly baseline: readonly RollNote[];
  private next: RollNote[] | null = null;
  private active = true;
  constructor(notes: readonly RollNote[]) { this.baseline = notes.map(note => ({ ...note })); }
  preview(notes: RollNote[]) { if (this.active) this.next = notes; }
  cancel() { this.active = false; this.next = null; }
  commit(): RollNote[] | null {
    if (!this.active) return null;
    this.active = false;
    return this.next && !sameNotes(this.baseline, this.next) ? this.next : null;
  }
}
