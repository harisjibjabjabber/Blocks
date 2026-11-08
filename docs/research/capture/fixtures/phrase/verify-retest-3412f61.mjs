// Re-executes the implementation team's described synthetic retest history (implementation-report-3412f61-overlap-retest.md)
// against read-only copies of recent-phrase.ts at 497894e and 3412f61, called as App does (beatForCut: only a LOCKED tempo is passed).
// Our reconstruction of their prose description; not their script and not Haris's MIDI.
// Not rerun for this import. Imports are git extracts; the archive did not include the external copies.
// 497894e is historical. 3412f612fe5f5f8d818ec50ad62ab9cd2a3cab3e is the current research baseline, not a solved Capture.
import { recentPhraseCut as cut497 } from "../../historical/497894e/recent-phrase.ts";
import { recentPhraseCut as cut341 } from "../../historical/3412f61/recent-phrase.ts";
const gaps = [180, 260, 140, 320, 220, 410, 190, 280, 150, 360, 240, 300]; const linePitches = [60, 64, 67, 62, 65, 69, 60, 64, 72, 67, 64, 62];
const chords = [[10930, [60, 64, 67]], [12610, [57, 64, 69]], [14850, [53, 60, 65]], [16640, [55, 62, 67]]];
function history(roll, pedal) {
  const ev = []; let seq = 0; const push = (ms, o) => ev.push({ id: "e" + seq, sequence: BigInt(seq++), scheduleElapsed: BigInt(Math.round(ms * 1000)), channel: 0, note: 0, velocity: 0, controller: 0, value: 0, ...o });
  let t = 800; for (let i = 0; i < 36; i++) { const p = linePitches[i % 12]; push(t, { kind: "note-on", note: p, velocity: 80 }); push(t + 90 + (i * 37) % 100, { kind: "note-off", note: p }); t += gaps[i % 12]; }
  const rolls = [[0, 60, 120], [0, 90, 180], [0, 70, 190], [0, 110, 180]];
  chords.forEach(([at, ps], ci) => { const offs = roll ? rolls[ci] : [0, 16, 32]; let lastOff = 0, firstOff = Infinity;
    if (pedal) push(at - 50, { kind: "cc", controller: 64, value: 127 });
    ps.forEach((p, k) => { const on = at + offs[k]; const off = roll ? on + 460 + 30 * k : at + 470 + (ps[0] % 2 ? 40 : 0); push(on, { kind: "note-on", note: p, velocity: 80 }); push(off, { kind: "note-off", note: p }); lastOff = Math.max(lastOff, off); firstOff = Math.min(firstOff, off); });
    if (pedal === "after") push(lastOff + (roll ? 40 : 30), { kind: "cc", controller: 64, value: 0 }); if (pedal === "before") push(firstOff - (roll ? 50 : 70), { kind: "cc", controller: 64, value: 0 }); });
  return ev.sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : Number(a.sequence - b.sequence)));
}
console.log("history | pedal | tempo mode | 497894e stored ms (chord note-ons) | 3412f61 stored ms (chord note-ons, line note-ons)");
for (const roll of [false, true]) for (const pedal of ["after", "before", null]) for (const mode of ["unlocked", "proposed40", "locked40"]) {
  const ev = history(roll, pedal); const grid = mode === "locked40" ? BigInt(1_500_000) : null; // beatForCut passes only a locked tempo
  const row = [roll ? "roll60-120" : "16ms", pedal ?? "none", mode];
  for (const fn of [cut497, cut341]) { const c = fn(ev, { ticksPerSecond: 1e6, gridPeriodTicks: grid, gridOriginTicks: null, historyMayBeTruncated: false });
    const sel = ev.filter((e) => e.kind === "note-on" && e.scheduleElapsed >= c.selection.start && e.scheduleElapsed <= c.selection.end);
    const chordN = sel.filter((e) => e.scheduleElapsed >= 10930000n).length, lineN = sel.length - chordN;
    row.push(`${Number(c.selection.start) / 1000}-${Number(c.selection.end) / 1000} (${chordN}/12 chord, ${lineN} line)`); }
  console.log(row.join(" | "));
}
