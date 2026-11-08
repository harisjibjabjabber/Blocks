// HYPOTHESIS CHECK ONLY (not a diagnosis). Runs recentPhraseCut from the 534279f / fadfdcf cut
// (checkout copy ../historical/534279f/recent-phrase.ts, git blob 93292fe449865871f63df08766b7f57ec823e2c7).
// That file is byte-identical at those two commits and is not the fdba348 or 497894e cut.
// A result here is not evidence against fdba348 or the current pipeline.
// SYNTHETIC four-chord progressions only. It tests one plausible cause of the user report
// "Capture takes only the final chord": the break rule compares ONSET-to-onset gaps of attack
// clusters with max(1.5 s, 2 beats), so slow chords that ring (held or pedalled) can each look
// like a separate phrase. It cannot see the App wrapper, the device, or what the user actually played.
// Run from this directory: node --experimental-strip-types repro-four-chords.mjs
// This import was not executed for the handover commit.
import { recentPhraseCut } from "../historical/534279f/recent-phrase.ts";
const TPS = 1_000_000; // ticks per second used for this check
const prog = [[50, 53, 57, 60], [43, 53, 57, 59], [48, 52, 55, 59], [45, 52, 55, 61]]; // Dm7 G7 Cmaj7 A7
function build({ bpm, beatsPerChord, pedal, legato }) {
  const ev = []; let seq = 0; const beat = 60 / bpm; const t0 = 1.0;
  const push = (t, o) => ev.push({ id: "e" + seq, sequence: seq++, scheduleElapsed: BigInt(Math.round(t * TPS)), channel: 0, note: 0, velocity: 0, controller: 0, value: 0, ...o });
  if (pedal) push(t0 - 0.05, { kind: "cc", controller: 64, value: 127 });
  prog.forEach((ch, i) => { const on = t0 + i * beatsPerChord * beat; const off = on + beatsPerChord * beat * (legato ? 0.98 : 0.5);
    if (pedal && i > 0) { push(on + 0.01, { kind: "cc", controller: 64, value: 0 }); push(on + 0.06, { kind: "cc", controller: 64, value: 127 }); }
    ch.forEach((n, k) => push(on + k * 0.004, { kind: "note-on", note: n, velocity: 80 }));
    ch.forEach((n) => push(off, { kind: "note-off", note: n }));
  });
  if (pedal) push(t0 + 4 * beatsPerChord * beat + 0.2, { kind: "cc", controller: 64, value: 0 });
  return ev.sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : a.sequence - b.sequence));
}
const cases = [];
for (const bpm of [70, 90, 120, 160]) for (const beatsPerChord of [2, 4]) for (const tempoKnown of [false, true]) for (const pedal of [false, true])
  cases.push({ bpm, beatsPerChord, tempoKnown, pedal, legato: true });
console.log("SYNTHETIC hypothesis check: how many of 4 chord attacks land in recentPhraseCut's selection (real function, read-only copy)");
console.log("bpm  beats/chord  onset-gap(s)  grid-passed  pedal  chordsSelected  status");
for (const c of cases) {
  const ev = build(c); const beatT = BigInt(Math.round((60 / c.bpm) * TPS));
  const r = recentPhraseCut(ev, { ticksPerSecond: TPS, gridPeriodTicks: c.tempoKnown ? beatT : null, gridOriginTicks: null, historyMayBeTruncated: false });
  const attacks = [...new Set(ev.filter((e) => e.kind === "note-on").map((e) => Math.floor(Number(e.scheduleElapsed) / 1000)))];
  const chordStarts = prog.map((_, i) => ev.filter((e) => e.kind === "note-on")[i * 4].scheduleElapsed);
  const n = chordStarts.filter((t) => t >= r.selection.start && t <= r.selection.end).length;
  console.log(`${String(c.bpm).padEnd(4)} ${String(c.beatsPerChord).padEnd(12)} ${(c.beatsPerChord * 60 / c.bpm).toFixed(2).padEnd(13)} ${String(c.tempoKnown).padEnd(12)} ${String(c.pedal).padEnd(6)} ${String(n).padEnd(15)} ${r.status}`);
}
