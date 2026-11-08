// NEW independent VALIDATION set (separate generator, separate seed 20261108). Frozen before any predictor ran on it.
// SYNTHETIC; provisional designer labels; not Haris's MIDI. Run: node generate-validation.mjs -> data-validation/validation/*.json + FREEZE.txt
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const OUT = path.join(HERE, "data-validation", "validation");
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = mulberry(20261108); const j = (s) => (R() * 2 - 1) * s;
function build(c) {
  const ev = [], groups = []; let seq = 0; const US = 1e6;
  const ev_ = (t, kind, note, extra = {}) => ev.push({ id: "v" + seq, sequence: seq++, scheduleElapsed: Math.round(t * US), channel: extra.ch ?? 0, kind, note, velocity: kind === "note-on" ? 70 + Math.floor(R() * 30) : 0, controller: extra.cc ?? 0, value: extra.val ?? 0 });
  const group = (tag, t, pitches, dur, step = 0, legatoOverlap = 0) => { groups.push({ id: "g" + groups.length, onUs: Math.round(t * US), tag, size: pitches.length });
    pitches.forEach((p, k) => { const on = t + k * step; ev_(on, "note-on", p); ev_(on + Math.max(0.04, dur - k * step + legatoOverlap + j(0.02)), "note-off", p); }); };
  const cc = (t, v) => ev_(t, "cc", 0, { cc: 64, val: v });
  let t = 0.8; const beat = 60 / c.bpm;
  if (c.noodle) { // random-walk noodling (different model from generate-phrase.mjs): scale steps, occasional dyads, uneven IOIs
    let p = 64; const end = t + c.noodle; while (t < end) { p = Math.max(52, Math.min(84, p + [-3, -2, -1, 1, 2, 4][Math.floor(R() * 6)])); const ioi = 0.09 + R() ** 2 * 0.7;
      group("noodle", t, R() < 0.15 ? [p - 7, p] : [p], ioi * (0.6 + R() * 0.6)); t += ioi; } t += c.rest ?? 0.6; }
  const S = t; if (c.pedalAll) cc(S - 0.03, 127);
  const at = (b) => S + b * beat * (1 + (c.rubato ?? 0) * Math.sin(b * 1.3)) + j(c.jitter ?? 0.02);
  if (c.pickup) group("pickup", S - c.pickup * beat + j(0.015), [c.pickupNote], c.pickup * beat * 0.9);
  for (const [b, d, ps, opt = {}] of c.items) group("phrase", at(b), ps, d * beat * (opt.legato ? 1.08 : 0.9), opt.step ?? 0, 0);
  const E = S + c.bars * 4 * beat;
  if (c.post) group("postlude", E + 0.4, c.post, 0.5);
  if (c.pedalAll) cc(Math.max(...ev.map((e) => e.scheduleElapsed)) / US + 0.05, 0);
  ev.sort((a, b) => a.scheduleElapsed - b.scheduleElapsed || a.sequence - b.sequence);
  const press = Math.max(...ev.map((e) => e.scheduleElapsed)) / US + (c.trail ?? 0.5);
  const per = (bars) => ({ startUs: Math.round((E - bars * 4 * beat) * US), endUs: Math.round(E * US), bars, label: bars + " bars" });
  return { id: c.id, set: "validation", label: "SYNTHETIC VALIDATION (independent generator, seed 20261108): provisional labels; not a recorded take", title: c.title, wholeSessionIsPhrase: !c.noodle,
    pressUs: Math.round(press * US), lockedGrid: c.locked ? { beatUs: Math.round(beat * US), originUs: Math.round((S - 8 * beat) * US) } : null, trueBpm: c.bpm,
    expected: { period: { ...per(c.bars), bpm: c.bpm }, acceptable: (c.alt ?? []).map(per), freeTimeOk: !!c.freeOk, freeTimeExpected: !!c.freeExp, groups: groups.map(({ id, onUs, tag, size }) => ({ id, onUs, tag: tag === "postlude" ? "phrase" : tag, size })) },
    events: ev.map((e) => ({ ...e, scheduleElapsed: String(e.scheduleElapsed) })) };
}
const scale = (start, n, step = 0.25, base = 60) => Array.from({ length: n }, (_, k) => [start + k * step, step, [[0, 2, 4, 5, 7, 9, 11, 12][k % 8] + base]]);
const CASES = [
  { id: "V01-single-note-take", title: "One long bass note is the whole take", bpm: 100, bars: 1, items: [[0, 4, [36]]], freeOk: true },
  { id: "V02-short-complete-motif", title: "Three-note motif, nothing else played", bpm: 110, bars: 1, items: [[0, 1, [67]], [1, 1, [69]], [2, 2, [72]]], freeOk: true },
  { id: "V03-whole-session-is-2bar-progression", title: "Short session that IS the phrase: 2 chords over 2 bars", bpm: 90, bars: 2, items: [[0, 4, [48, 55, 64]], [4, 4, [53, 57, 64]]], alt: [1], freeOk: true },
  { id: "V04-legato-melody-after-noodle", title: "Overlapping legato melody (each note held into the next)", bpm: 84, bars: 4, noodle: 9, items: [[0, 2, [72], { legato: true }], [2, 1, [74], { legato: true }], [3, 1, [76], { legato: true }], [4, 3, [77], { legato: true }], [7, 1, [76], { legato: true }], [8, 2, [74], { legato: true }], [10, 2, [72], { legato: true }], [12, 4, [71], { legato: true }]], alt: [2, 8] },
  { id: "V05-pedalled-scalar-runs", title: "Scalar 16th runs with the pedal held throughout (one sounding blur)", bpm: 96, bars: 2, pedalAll: true, items: scale(0, 32), alt: [1, 4], freeOk: true },
  { id: "V06-bass-syncopated-after-noodle", title: "Syncopated mono bass after noodling", bpm: 104, bars: 4, noodle: 11, items: [0, 4, 8, 12].flatMap((o) => [[o, 0.75, [38]], [o + 0.75, 0.75, [38]], [o + 2, 0.5, [45]], [o + 2.5, 1.5, [43]]]), alt: [1, 2, 8] },
  { id: "V07-melody-pickup", title: "Melody with a 2-eighth pickup", bpm: 120, bars: 4, noodle: 7, pickup: 0.5, pickupNote: 64, items: [[0, 2, [67]], [2, 2, [72]], [4, 3, [71]], [7, 1, [69]], [8, 4, [67]], [12, 4, [64]]], alt: [2, 8] },
  { id: "V08-mixed-hands", title: "LH bass + RH melody and shells", bpm: 100, bars: 4, noodle: 10, items: [0, 4, 8, 12].flatMap((o, i) => [[o, 2, [[38, 43, 36, 45][i]]], [o + 0.5, 1, [[65, 65, 64, 61][i], [72, 71, 71, 67][i]]], [o + 2, 2, [[45, 50, 43, 40][i]]], [o + 2.5, 1.5, [[77, 74, 76, 73][i]]]]), alt: [2, 8] },
  { id: "V09-rubato-chords-free", title: "Four chords, strong rubato (no steady pulse)", bpm: 66, bars: 4, noodle: 8, rubato: 0.3, jitter: 0.2, items: [[0, 5, [41, 52, 57, 64]], [5, 3, [40, 50, 55, 62]], [8, 5, [38, 53, 57, 60]], [13, 3, [43, 53, 59, 62]]], freeOk: true, freeExp: true },
  { id: "V10-pedal-through-noodle-and-progression", title: "Pedal held through noodling AND the progression", bpm: 92, bars: 4, noodle: 8, rest: 0.3, pedalAll: true, items: [[0, 4, [50, 57, 60, 65]], [4, 4, [43, 53, 59, 64]], [8, 4, [48, 55, 59, 64]], [12, 4, [45, 55, 61, 64]]], alt: [2, 8] },
  { id: "V11-two-chord-idea-after-noodle", title: "Two chords, 2 bars each, after noodling", bpm: 96, bars: 4, noodle: 10, items: [[0, 8, [45, 52, 55, 60], { step: 0.03 }], [8, 8, [50, 53, 57, 60], { step: 0.03 }]], alt: [2, 8] },
  { id: "V12-progression-plus-postlude-note", title: "Four chords then one postlude note", bpm: 100, bars: 4, noodle: 10, post: [79], items: [[0, 4, [48, 52, 55, 59]], [4, 4, [45, 52, 55, 60]], [8, 4, [41, 52, 57, 60]], [12, 4, [43, 53, 59, 62]]], alt: [2, 8] },
  { id: "V13-sparse-melody-after-noodle", title: "Sparse melody, five notes over four bars", bpm: 80, bars: 4, noodle: 8, items: [[0, 2, [69]], [3, 1, [72]], [6, 2, [71]], [9, 3, [67]], [13, 3, [64]]], alt: [2, 8], freeOk: true },
];
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true }); const hash = crypto.createHash("sha256");
for (const c of CASES) { const doc = build(c); doc.rawChecksum = crypto.createHash("sha256").update(JSON.stringify(doc.events)).digest("hex"); const txt = JSON.stringify(doc); hash.update(txt); fs.writeFileSync(path.join(OUT, c.id + ".json"), txt); }
const freeze = `FROZEN ${new Date().toString()} (box clock, Europe/London)\nfiles ${CASES.length}\nsha256(concat in id order) ${hash.digest("hex")}\ngenerator sha256 ${crypto.createHash("sha256").update(fs.readFileSync(fileURLToPath(import.meta.url))).digest("hex")}\nNo predictor had been run on this set at freeze time.\n`;
fs.writeFileSync(path.join(HERE, "data-validation", "FREEZE.txt"), freeze); console.log(freeze);
