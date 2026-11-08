// SYNTHETIC phrase-capture fixtures (tuning vs holdout). Not Haris's MIDI. Labels are provisional designer labels.
// Run: node generate-phrase.mjs  -> data/{tuning,holdout}/*.json
// Each fixture: raw events (µs ticks), press time, optional locked grid, and expected:
//   period {startUs,endUs,bars,bpm}  nominal loop period (bars x beat period) the designer intended
//   phraseGroupIds / noodleGroupIds / tailGroupIds / pickupGroupIds  coverage labels by onset group
//   acceptable: list of {startUs,endUs,label} alternatives (2/8 bars, half/double, free time)
//   freeTimeOk / freeTimeExpected
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const US = 1e6;
function make(spec, R) {
  const ev = []; let seq = 0; const groups = []; // group: {id, onUs, role, tag}
  const push = (tS, o) => ev.push({ id: "e" + seq, sequence: seq++, scheduleElapsed: Math.round(tS * US), channel: o.ch ?? 0, kind: o.kind, note: o.note ?? 0, velocity: o.vel ?? 0, controller: o.cc ?? 0, value: o.val ?? 0 });
  const jit = (s) => (R() * 2 - 1) * s;
  function group(tag, t, notes, durS, { roll = 0, ch = 0, vel = 80, heldToEnd = false } = {}) {
    const gid = "g" + groups.length; groups.push({ id: gid, onUs: Math.round(t * US), tag, n: notes.length });
    notes.forEach((n, k) => { const on = t + (notes.length > 1 ? (k / (notes.length - 1)) * roll : 0); push(on, { kind: "note-on", note: n, vel: vel + Math.round(jit(10)), ch });
      if (!heldToEnd) push(Math.max(on + 0.03, t + durS + jit(0.03)), { kind: "note-off", note: n, ch }); });
    return gid;
  }
  let t = 1.0;
  // --- noodling: free rubato melodic/chordal material, not on any grid
  if (spec.noodleS) { const end = t + spec.noodleS; while (t < end) { const ioi = spec.noodleSameTempo ? 60 / spec.bpm / 2 : 0.12 + R() * 0.55; const n = 58 + Math.floor(R() * 24);
      const chordy = R() < 0.25; group("noodle", t, chordy ? [n - 12, n - 5, n] : [n], ioi * (0.5 + R() * 0.8), { roll: chordy ? 0.03 : 0 }); t += ioi; } t += spec.restS ?? 0.5; }
  // --- phrase
  const beat0 = 60 / spec.bpm; let b = 0; // beat counter
  const drift = spec.drift ?? 0; const totalBeats = spec.bars * 4;
  const beatLen = (k) => beat0 * (1 + drift * (k / totalBeats - 0.5));
  const tAt = (beats) => { let x = 0; const whole = Math.floor(beats); for (let k = 0; k < whole; k++) x += beatLen(k); return x + (beats - whole) * beatLen(whole); };
  if (spec.pickup) { group("pickup", t - spec.pickup * beat0 + jit(0.02), [spec.pickupNote ?? 67], spec.pickup * beat0 * 0.9); }
  const S = t;
  if (spec.pedal) push(S - 0.02, { kind: "cc", cc: 64, val: 127 });
  const timing = spec.timingJitter ?? 0.025;
  for (const item of spec.items) { // {beat, dur(beats), notes, roll, ch, vel}
    const on = S + tAt(item.beat) + jit(timing) + (item.early ?? 0);
    group("phrase", on, item.notes, tAt(item.beat + item.dur) - tAt(item.beat) - (spec.legato ? -0.03 : 0.05), { roll: item.roll ?? 0, ch: item.ch ?? 0, heldToEnd: item.heldToEnd });
    if (spec.pedal && spec.repedal && item.chordChange) { push(on + 0.03, { kind: "cc", cc: 64, val: 0 }); push(on + 0.09, { kind: "cc", cc: 64, val: 127 }); }
  }
  const E = S + tAt(totalBeats);
  let tail = null;
  if (spec.endDownbeat) tail = group("tail", E + jit(timing), spec.endDownbeat, beat0 * 0.8, { roll: 0.02 });
  if (spec.pedal) push(E + (spec.endDownbeat ? beat0 : 0.1), { kind: "cc", cc: 64, val: 0 });
  const lastEv = Math.max(...ev.map((e) => e.scheduleElapsed)) / US;
  const press = lastEv + (spec.trailingS ?? 0.6);
  ev.sort((a, b) => a.scheduleElapsed - b.scheduleElapsed || a.sequence - b.sequence);
  const per = (bars) => ({ startUs: Math.round((E - (tAt(totalBeats) * bars) / spec.bars) * US), endUs: Math.round(E * US), bars });
  const acceptable = (spec.acceptBars ?? []).map((bars) => ({ ...per(bars), label: bars + " bars" }));
  return { id: spec.id, set: spec.set, label: "SYNTHETIC (" + spec.set.toUpperCase() + "): not a recorded take; provisional designer labels", title: spec.title, covers: spec.covers,
    pressUs: Math.round(press * US), lockedGrid: spec.locked ? { beatUs: Math.round(beat0 * US), originUs: Math.round((S - 4 * beat0 * (spec.locked.barsBefore ?? 2)) * US) } : null,
    trueBpm: spec.bpm, expected: { period: { ...per(spec.bars), bpm: spec.bpm }, acceptable, freeTimeOk: !!spec.freeTimeOk, freeTimeExpected: !!spec.freeTimeExpected,
      groups: groups.map((g) => ({ id: g.id, onUs: g.onUs, tag: g.tag })) },
    events: ev.map((e) => ({ ...e, scheduleElapsed: String(e.scheduleElapsed) })) };
}
// ---------- helpers to write progressions ----------
const C = { Dm7: [50, 53, 57, 60], G7: [43, 53, 57, 59], Cmaj7: [48, 52, 55, 59], A7: [45, 52, 55, 61], Fmaj7: [41, 52, 57, 60], Bb7: [46, 50, 56, 62], Em7: [40, 55, 59, 62], Am7: [45, 55, 60, 64] };
const prog = (names, durs, o = {}) => { let b = 0; return names.map((n, i) => { const it = { beat: b, dur: durs[i], notes: C[n], roll: o.rollFixed ? o.rollFixed[i % o.rollFixed.length] : o.roll ? o.roll * (0.5 + (i % 2)) : 0, chordChange: true, early: o.earlyLate ? (i % 2 ? 0.05 : -0.04) : 0, heldToEnd: o.heldLast && i === names.length - 1 }; b += durs[i]; return it; }); };
const line = (pattern, o = {}) => pattern.map(([beat, dur, note]) => ({ beat, dur, notes: Array.isArray(note) ? note : [note], ch: o.ch ?? 0 }));
const repeat = (p, times, beatsPer) => Array.from({ length: times }, (_, k) => p.map(([b, d, n]) => [b + k * beatsPer, d, n])).flat();
const SPECS = {
  tuning: [
    { id: "PT01-even-4chords-after-noodle", title: "Even 4 chords (1 bar each) after noodling", bpm: 96, bars: 4, noodleS: 10, restS: 0.4, items: prog(["Dm7", "G7", "Cmaj7", "A7"], [4, 4, 4, 4]), acceptBars: [2, 8], covers: ["noodle", "chords"] },
    { id: "PT02-uneven-3-1-2-2-plus-2bars", title: "Uneven chords 6+2+4+4 beats, final downbeat", bpm: 104, bars: 4, noodleS: 12, restS: 0.6, items: prog(["Dm7", "G7", "Cmaj7", "A7"], [6, 2, 4, 4], { roll: 0.06 }), endDownbeat: C.Dm7, acceptBars: [2, 8], covers: ["uneven", "rolled", "endDownbeat"] },
    { id: "PT03-pedal-through-changes", title: "Pedal held through changes, rolled, drift", bpm: 84, bars: 4, noodleS: 8, restS: 0.5, pedal: true, repedal: false, drift: 0.03, items: prog(["Fmaj7", "Bb7", "Am7", "Dm7"], [4, 4, 4, 4], { roll: 0.08 }), acceptBars: [2, 8], covers: ["pedal", "drift"] },
    { id: "PT04-bass-syncopated", title: "Syncopated mono bass, 2-bar riff x2", bpm: 100, bars: 4, noodleS: 9, restS: 0.5, items: line(repeat([[0, 0.75, 36], [0.75, 0.75, 36], [1.5, 0.5, 43], [2.5, 0.5, 46], [3, 1, 48], [4, 1.5, 41], [5.5, 0.5, 41], [6.5, 1.5, 43]], 2, 8)), acceptBars: [2, 8], covers: ["bass", "syncopation", "repetition"] },
    { id: "PT05-legato-melody", title: "Legato melody, long notes", bpm: 90, bars: 4, noodleS: 8, restS: 0.7, legato: true, items: line([[0, 3, 72], [3, 1, 74], [4, 2, 76], [6, 2, 74], [8, 3, 71], [11, 1, 72], [12, 4, 69]]), acceptBars: [2, 8], covers: ["melody", "legato"] },
    { id: "PT06-free-rubato-chords", title: "Four chords in free rubato (no pulse)", bpm: 70, bars: 4, drift: 0.35, timingJitter: 0.25, noodleS: 6, restS: 1.0, items: prog(["Em7", "A7", "Dm7", "G7"], [3, 5, 2, 6], { roll: 0.1 }), freeTimeOk: true, acceptBars: [2, 8], covers: ["rubato", "free time"] },
  ],
  holdout: [
    { id: "PH01-uneven-6-2-4-4-noodle-final-downbeat", title: "4-bar uneven progression 6+2+4+4 after long noodling, plays next downbeat", bpm: 92, bars: 4, noodleS: 22, restS: 0.35, items: prog(["Dm7", "G7", "Cmaj7", "A7"], [6, 2, 4, 4], { roll: 0.05, earlyLate: true }), endDownbeat: C.Dm7, acceptBars: [2, 8], covers: ["uneven", "noodling", "endDownbeat", "early/late"] },
    { id: "PH02-uneven-2-2-3-1-x2-held-final", title: "2+2+3+1 beats twice (8 chords = 4 bars... of 2-bar cycle), final chord held through the press", bpm: 110, bars: 4, noodleS: 15, restS: 0.5, items: [...prog(["Dm7", "G7", "Cmaj7", "A7"], [2, 2, 3, 1]), ...prog(["Dm7", "G7", "Cmaj7", "A7"], [2, 2, 3, 1], { heldLast: true }).map((x) => ({ ...x, beat: x.beat + 8 }))], trailingS: 0.9, acceptBars: [2, 8], covers: ["uneven", "held final", "repetition"] },
    { id: "PH03-pedal-held-rubato-drift", title: "Pedal held through all changes, rolled chords, +5% drift", bpm: 80, bars: 4, noodleS: 14, restS: 0.6, pedal: true, drift: 0.05, timingJitter: 0.04, items: prog(["Cmaj7", "Am7", "Dm7", "G7"], [4, 4, 2, 6], { roll: 0.09 }), acceptBars: [2, 8], covers: ["pedal", "rubato", "uneven"] },
    { id: "PH04-pickup-melody-into-bar1", title: "Melody with a 1-beat pickup before bar 1, plus comp", bpm: 120, bars: 4, noodleS: 10, restS: 0.8, pickup: 1, pickupNote: 67, items: [...prog(["Cmaj7", "A7", "Dm7", "G7"], [4, 4, 4, 4]), ...line([[0, 1.5, 72], [1.5, 0.5, 71], [2, 2, 69], [4, 2, 73], [6, 2, 76], [8, 3, 74], [11, 1, 72], [12, 4, 71]])], acceptBars: [2, 8], covers: ["pickup", "mixed hands"] },
    { id: "PH05-half-double-fast-eighths", title: "Fast eighth-note bass at 150 bpm feel (or 75)", bpm: 150, bars: 4, noodleS: 9, restS: 0.5, items: line(repeat([[0, 0.5, 40], [0.5, 0.5, 52], [1, 0.5, 47], [1.5, 0.5, 52], [2, 0.5, 45], [2.5, 0.5, 52], [3, 0.5, 47], [3.5, 0.5, 50]], 4, 4)), acceptBars: [2, 8], covers: ["half/double", "bass", "dense"] },
    { id: "PH06-locked-grid-second-layer-bass", title: "Second layer: syncopated bass against a locked grid, starts on an off-beat", bpm: 96, bars: 4, noodleS: 6, restS: 0.6, locked: { barsBefore: 3 }, items: line(repeat([[0.5, 0.5, 38], [1, 1, 38], [2.5, 1, 45], [3.5, 0.5, 43], [4, 2, 43], [6.5, 1, 41], [7.5, 0.5, 40]], 2, 8)), acceptBars: [2], covers: ["locked grid", "syncopation", "bass"] },
    { id: "PH07-sparse-melody", title: "Sparse melody: 6 notes over 4 bars with long rests", bpm: 88, bars: 4, noodleS: 10, restS: 0.6, items: line([[0, 1, 72], [2, 2, 76], [5, 1, 74], [8, 2, 71], [12, 1, 69], [14, 2, 72]]), acceptBars: [2, 8], freeTimeOk: true, covers: ["sparse", "melody"] },
    { id: "PH08-arpeggios", title: "Continuous 8th-note arpeggios over 4 chords", bpm: 100, bars: 4, noodleS: 10, restS: 0.4, items: line([0, 1, 2, 3].flatMap((bar) => { const ch = [C.Dm7, C.G7, C.Cmaj7, C.A7][bar]; return Array.from({ length: 8 }, (_, k) => [bar * 4 + k * 0.5, 0.5, ch[[0, 1, 2, 3, 2, 1, 3, 2][k]] + 12]); })), acceptBars: [2, 8], covers: ["arpeggio", "dense"] },
    { id: "PH09-repeated-1bar-motif", title: "1-bar motif repeated 4 times", bpm: 108, bars: 4, noodleS: 12, restS: 0.5, items: line(repeat([[0, 0.5, 67], [0.5, 0.5, 70], [1, 1, 72], [2.5, 0.5, 70], [3, 1, 67]], 4, 4)), acceptBars: [1, 2, 8], covers: ["repetition", "melody"] },
    { id: "PH10-continuous-scalar-runs", title: "Continuous 16th scalar runs, no gaps, no accents", bpm: 90, bars: 2, noodleS: 0, items: line(Array.from({ length: 32 }, (_, k) => [k * 0.25, 0.25, [60, 62, 64, 65, 67, 69, 71, 72][Math.abs(((k + 7) % 14) - 7)]])), acceptBars: [1, 4], freeTimeOk: true, covers: ["dense runs", "no gaps"] },
    { id: "PH11-free-rubato-ballad", title: "Four chords, free rubato ballad (expect free-time abstention)", bpm: 60, bars: 4, drift: 0.4, timingJitter: 0.3, noodleS: 8, restS: 0.9, items: prog(["Fmaj7", "Em7", "Dm7", "Cmaj7"], [5, 3, 6, 2], { roll: 0.12 }), freeTimeOk: true, freeTimeExpected: true, acceptBars: [2, 8], covers: ["rubato", "abstain"] },
    { id: "PH12-mixed-hands-trailing-silence", title: "LH bass + RH syncopated comp, then 3 s of silence before the press", bpm: 116, bars: 4, noodleS: 10, restS: 0.5, trailingS: 3.0, items: [...line(repeat([[0, 1.5, 36], [1.5, 0.5, 43], [2, 2, 40]], 4, 4)), ...line(repeat([[0.5, 0.5, [55, 59, 64]], [2.5, 1, [55, 59, 64]]], 4, 4))], acceptBars: [2, 8], covers: ["mixed hands", "trailing silence", "syncopation"] },
    // added 19:50 London after the 497894e retest report: rolls with 60-120 ms BETWEEN notes (total spread = 3 x step for 4-note chords)
    { id: "PH13-rolled-60-120ms-after-noodle", title: "Four rolled chords (60-120 ms between notes) after noodling, no pedal, free time", bpm: 92, bars: 4, noodleS: 14, restS: 0.5, items: prog(["Dm7", "G7", "Cmaj7", "A7"], [4, 4, 4, 4], { rollFixed: [0.18, 0.27, 0.36, 0.24] }), acceptBars: [2, 8], covers: ["roll 60-120ms", "noodling"] },
    { id: "PH14-rolled-60-120ms-pedal", title: "Rolled chords 60-120 ms apart, pedal held through, uneven 6+2+4+4", bpm: 88, bars: 4, noodleS: 12, restS: 0.5, pedal: true, items: prog(["Fmaj7", "Bb7", "Am7", "Dm7"], [6, 2, 4, 4], { rollFixed: [0.18, 0.27, 0.36, 0.24] }), acceptBars: [2, 8], covers: ["roll 60-120ms", "pedal", "uneven"] },
    { id: "PH15-rolled-60-120ms-locked-grid", title: "Rolled chords 60-120 ms apart against a locked grid (second layer)", bpm: 96, bars: 4, noodleS: 6, restS: 0.6, locked: { barsBefore: 3 }, items: prog(["Cmaj7", "Am7", "Dm7", "G7"], [4, 4, 4, 4], { rollFixed: [0.18, 0.27, 0.36, 0.24] }), acceptBars: [2], covers: ["roll 60-120ms", "locked grid"] },
  ],
};
for (const set of ["tuning", "holdout"]) {
  const dir = path.join(HERE, "data", set); fs.mkdirSync(dir, { recursive: true });
  SPECS[set].forEach((s, i) => { const R = rng(set === "tuning" ? 1000 + i : 777000 + i * 31); const doc = make({ ...s, set }, R);
    doc.rawChecksum = crypto.createHash("sha256").update(JSON.stringify(doc.events)).digest("hex"); fs.writeFileSync(path.join(dir, s.id + ".json"), JSON.stringify(doc)); });
}
console.log("wrote", SPECS.tuning.length, "tuning +", SPECS.holdout.length, "holdout SYNTHETIC phrase fixtures");
