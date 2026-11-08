// Blocks Capture — Stage-1 HARMONY & ROLE reference predictor + harness (research artefact).
// Run: node evaluate-harmony.mjs [tuning|holdout] [--pairs out.json]
// Stage 1 (proposal): deterministic. Segments on pressed keys + pedal-sounding state, clusters rolled
// onsets, scores jazz chord templates on duration-weighted pitch classes, offers rootless readings as
// ALTERNATIVES, tags note roles with a simple register/skyline heuristic, and may abstain.
// Output = ranked hypotheses with plain reasons. No confidence percentages are produced or displayed.
// Results on SYNTHETIC fixtures with PROVISIONAL labels are a smoke test, not accuracy claims.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SET = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "tuning";
const DIR = path.join(HERE, "data-harmony", SET);
const ANALYZER = { id: "blocks.harmony.stage1-reference", version: "0.1.0" };

// ---- unvalidated parameters (proposals) ----
const P = { ROLL_STEP_NS: 0.06e9, ROLL_MAX_NS: 0.15e9, BASS_MAX: 52, MELODY_MIN: 57, PEDAL_W: 0.1, APPROACH_W: 0, SLASH_PEN: 0.08, MELODY_W: 0.35,
  MISS_PEN: 0.12, SIZE_PEN: 0.02, ROOTLESS_PEN: 0.05, BASS_ROOT_BONUS: 0.1, MIN_PCS: 3, MIN_FIT: 0.7, TOPK: 3 };
const NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
// Harte qualities with intervals (semitones). 5th (7) is optional when absent; 11 omitted from 13ths.
const T = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], "sus4": [0, 5, 7], maj6: [0, 4, 7, 9], min6: [0, 3, 7, 9], "7": [0, 4, 7, 10], maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10], hdim7: [0, 3, 6, 10], dim7: [0, 3, 6, 9], minmaj7: [0, 3, 7, 11], "9": [0, 4, 7, 10, 2], maj9: [0, 4, 7, 11, 2], min9: [0, 3, 7, 10, 2], "13": [0, 4, 7, 10, 2, 9],
  min11: [0, 3, 7, 10, 2, 5], "7(b9)": [0, 4, 7, 10, 1], "7(#9)": [0, 4, 7, 10, 3], "7(#11)": [0, 4, 7, 10, 6], "7(b13)": [0, 4, 7, 10, 8], "sus4(b7)": [0, 5, 7, 10],
  "sus4(b7,9)": [0, 5, 7, 10, 2], "maj7(#11)": [0, 4, 7, 11, 6], "maj6(9)": [0, 4, 7, 9, 2] };
const BASS_IV = { 0: "", 1: "b2", 2: "9", 3: "b3", 4: "3", 5: "4", 6: "b5", 7: "5", 8: "b6", 9: "6", 10: "b7", 11: "7" };

// ---- derived notes: retrigger pairing per stream (as in capture-spec §4.2), CC64 sounding ----
function deriveNotes(events) {
  const held = new Map(), pedal = new Map(), pend = new Map(), notes = [];
  for (const e of events) {
    const k = e.src + "|" + e.port + "|" + e.ch;
    if (e.type === "on" && e.d2 > 0) { const key = k + ":" + e.d1; const p = held.get(key); if (p) { p.keyOff = e.tNs; p.soundOff = e.tNs; }
      const n = { stream: k, ch: e.ch, pitch: e.d1, vel: e.d2, on: e.tNs, keyOff: null, soundOff: null }; held.set(key, n); notes.push(n); }
    else if (e.type === "off" || (e.type === "on" && e.d2 === 0)) { const key = k + ":" + e.d1; const n = held.get(key); if (!n) continue; held.delete(key); n.keyOff = e.tNs;
      if ((pedal.get(k) ?? 0) >= 64) { if (!pend.has(k)) pend.set(k, []); pend.get(k).push(n); } else n.soundOff = e.tNs; }
    else if (e.type === "cc" && e.d1 === 64) { pedal.set(k, e.d2); if (e.d2 < 64) { for (const n of pend.get(k) ?? []) n.soundOff = e.tNs; pend.set(k, []); } }
  }
  const end = events.length ? events[events.length - 1].tNs : 0;
  for (const n of notes) { if (n.keyOff === null) { n.keyOff = end; n.open = true; } if (n.soundOff === null) n.soundOff = Math.max(n.keyOff, end); }
  return notes;
}
// ---- onset clusters: rolled chords chain while earlier keys are still down ----
function clusters(notes) {
  const ons = [...notes].sort((a, b) => a.on - b.on || a.pitch - b.pitch); const out = [];
  for (const n of ons) { const c = out[out.length - 1];
    if (c && n.on - c.last <= P.ROLL_STEP_NS && n.on - c.first <= P.ROLL_MAX_NS && c.notes.every((x) => x.keyOff > n.on)) { c.notes.push(n); c.last = n.on; }
    else out.push({ first: n.on, last: n.on, notes: [n] }); }
  return out;
}
// ---- role heuristic: register + cluster shape + skyline/bass contour ----
function tagRoles(cls) {
  const all = cls.flatMap((c) => c.notes);
  for (const c of cls) { const ps = [...c.notes].sort((a, b) => a.pitch - b.pitch);
    const lowerLine = all.some((m) => !c.notes.includes(m) && m.on < c.first && m.keyOff > c.first && m.pitch < ps[0].pitch - 2);
    if (ps.length === 1) { const n = ps[0]; n.role = n.pitch <= P.BASS_MAX ? "bass" : n.pitch >= P.MELODY_MIN ? "melody" : "ambiguous"; continue; }
    const low = ps[0], next = ps[1];
    const lowIsBass = !lowerLine && low.pitch <= P.BASS_MAX && next.pitch - low.pitch >= 5;
    ps.forEach((n, i) => { n.role = i === 0 && lowIsBass ? "bass" : "comp"; });
  }
  // a single line whose notes all sit in bass register stays bass; a note struck while a held chord sounds above it is melody
  return cls;
}
const pcName = (pc) => NAMES[((pc % 12) + 12) % 12];
function candidates(w0, bassPc, rootlessOk, bassW = 0) {
  const out = [];
  for (let r = 0; r < 12; r++) for (const [q, iv] of Object.entries(T)) {
    const pcs = new Set(iv.map((x) => (r + x) % 12));
    const slash = bassPc !== null && !pcs.has(bassPc);
    let w = w0;
    if (slash) { w = [...w0]; w[bassPc] = Math.max(0, w[bassPc] - bassW); const tt = w.reduce((x, y) => x + y, 0) || 1; w = w.map((x) => x / tt); }
    let inT = 0; for (let pc = 0; pc < 12; pc++) if (pcs.has(pc)) inT += w[pc];
    const outT = 1 - inT;
    let missing = 0, rootMissing = w[r] < 1e-6;
    for (const x of iv) { const pc = (r + x) % 12; if (w[pc] < 1e-6 && x !== 7 && !(x === 0 && rootlessOk)) missing++; }
    if (rootMissing && !rootlessOk) continue;
    let score = inT - outT - P.MISS_PEN * missing - P.SIZE_PEN * iv.length - (slash ? P.SLASH_PEN : 0);
    const reasons = [];
    if (rootMissing) { score -= P.ROOTLESS_PEN; reasons.push("rootless reading: " + pcName(r) + " not played"); }
    let label = pcName(r) + ":" + q;
    if (bassPc !== null) { if (bassPc === r) score += P.BASS_ROOT_BONUS; else { const ivb = (bassPc - r + 12) % 12; label += "/" + BASS_IV[ivb]; reasons.push(pcs.has(bassPc) ? "inversion: bass " + pcName(bassPc) : "slash bass " + pcName(bassPc) + " not in chord"); } }
    if (missing) reasons.push(missing + " chord tone(s) not played");
    if (!rootMissing && iv.includes(7) && w[(r + 7) % 12] < 1e-6) reasons.push("no 5th (common)");
    out.push({ label, root: r, quality: q, rootless: rootMissing, score, fit: inT, reasons });
  }
  out.sort((a, b) => b.score - a.score || a.label.length - b.label.length);
  return out;
}
function analyse(doc, scope) {
  const ch = scope === "piano" ? 1 : scope === "bass" ? 2 : null;
  const evs = doc.events.filter((e) => ch === null || e.ch === ch);
  const notes = deriveNotes(evs); const cls = tagRoles(clusters(notes));
  const { bpm, beatsPerBar, originNs } = doc.context; const barNs = (beatsPerBar * 60 / bpm) * 1e9;
  const end = Math.max(...notes.map((n) => n.soundOff));
  // boundaries: chord attacks (>=3 notes, or >=2 incl. bass) ; bars without a chord attack split at bar lines
  const attacks = cls.filter((c) => c.notes.length >= 3 || (c.notes.length >= 2 && c.notes.some((n) => n.role === "bass"))).map((c) => c.first);
  const starts = new Set(attacks);
  for (let t = originNs; t < end - barNs * 0.25; t += barNs) if (!attacks.some((a) => a >= t - 0.1e9 && a < t + barNs - 0.1e9)) starts.add(t);
  const st = [...starts].sort((a, b) => a - b); const spans = [];
  for (let i = 0; i < st.length; i++) {
    const a = st[i], b = i + 1 < st.length ? st[i + 1] : Math.min(end, a + 2 * barNs);
    const w = new Array(12).fill(0); let low = null; const flags = [];
    let pedalOnly = 0;
    for (const n of notes) {
      const keyOv = Math.max(0, Math.min(n.keyOff, b) - Math.max(n.on, a)); const sndOv = Math.max(0, Math.min(n.soundOff, b) - Math.max(n.on, a)) - keyOv;
      if (keyOv + sndOv <= 0) continue;
      const rw = n.role === "melody" ? P.MELODY_W : 1;
      w[n.pitch % 12] += rw * (keyOv + P.PEDAL_W * Math.max(0, sndOv));
      if (sndOv > 0 && n.on < a) pedalOnly += sndOv;
      if (keyOv > 0 && n.role === "bass" && (low === null || n.on < low.on && n.on >= a - 0.1e9 || (low.on < a - 0.1e9 && n.on >= a - 0.1e9))) low = n;
    }
    if (pedalOnly > 0.2e9) flags.push("PEDAL_BLUR");
    const tot = w.reduce((x, y) => x + y, 0); if (tot <= 0) continue; for (let k = 0; k < 12; k++) w[k] /= tot;
    // approach tone: single-line note on the last beat, a semitone from the next span's first note
    const nextOn = notes.filter((n) => n.on >= b - 0.05e9).sort((x, y) => x.on - y.on)[0];
    let approach = null;
    if (nextOn) { const lastN = notes.filter((n) => n.on >= a && n.on < b - 0.05e9).sort((x, y) => y.on - x.on)[0]; if (lastN && [1, 11].includes(((lastN.pitch - nextOn.pitch) % 12 + 12) % 12) && b - lastN.on <= (60 / bpm) * 1.05e9) { approach = lastN; } }
    if (approach) { const dw = (1 - P.APPROACH_W) * Math.max(0, Math.min(approach.keyOff, b) - approach.on) / tot; w[approach.pitch % 12] = Math.max(0, w[approach.pitch % 12] - dw); const t2 = w.reduce((x, y) => x + y, 0); for (let k = 0; k < 12; k++) w[k] /= t2; }
    const pcsPresent = w.filter((x) => x > 0.04).length;
    const bassPc = low && low.role === "bass" ? low.pitch % 12 : null;
    const singleLine = notes.filter((n) => n.on >= a && n.on < b).every((n, _, arr) => arr.every((m) => m === n || m.on >= n.keyOff || n.on >= m.keyOff));
    const rootlessOk = bassPc === null && !singleLine;
    const lowBass = scope !== "bass" && bassPc === null;
    const bassW = low && low.role === "bass" ? Math.max(0, Math.min(low.keyOff, b) - Math.max(low.on, a)) / tot : 0;
    const cands = candidates(w, singleLine ? null : bassPc, rootlessOk, bassW);
    if (approach) flags.push("APPROACH_TONE");
    const reasons = [];
    if (approach) reasons.push("last note " + pcName(approach.pitch) + " read as a chromatic approach");
    if (singleLine) reasons.push("implied by a single line (no simultaneous notes)");
    if (lowBass && !singleLine) reasons.push("no bass in this layer: roots are guesses");
    if (flags.includes("PEDAL_BLUR")) reasons.push("pedal keeps earlier notes sounding; pressed keys weighted higher");
    if ([8, 1, 3, 6, 10].some((pc) => w[pc] > 0.04)) flags.push("SPELLING_CONTEXTUAL");
    let abstain = null;
    if (pcsPresent < P.MIN_PCS) abstain = { reason: "TOO_FEW_PITCH_CLASSES", text: "only " + pcsPresent + " pitch classes: too little to name a chord" };
    else if (!cands.length || cands[0].fit < P.MIN_FIT) abstain = { reason: "NO_TEMPLATE_FITS", text: "no chord template explains most of the sound" };
    // literal readings first; rootless readings stay alternatives unless a bass (combined/bass scope) supports them
    const ranked = []; const seen = new Set();
    for (const c of cands) { const key = c.label; if (seen.has(key)) continue; seen.add(key); ranked.push(c); if (ranked.length >= P.TOPK) break; }
    spans.push({ startNs: a, endNs: b, scope, abstain, alternatives: abstain ? [] : ranked.map((c) => ({ label: c.label, rootless: c.rootless, reasons: c.reasons })), flags, evidence: reasons });
  }
  // merge consecutive spans with identical top label (repeated comping of the same chord)
  const merged = [];
  for (const s of spans) { const p = merged[merged.length - 1]; if (p && !p.abstain && !s.abstain && p.alternatives[0]?.label === s.alternatives[0]?.label) p.endNs = s.endNs; else merged.push(s); }
  const roles = notes.map((n) => ({ onNs: n.on, pitch: n.pitch, ch: n.ch, role: n.role }));
  return { spans: merged, roles };
}

// ---- harness ----
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const pairs = []; const rows = []; let roleOk = 0, roleN = 0; const bErr = []; let rawOk = 0;
for (const f of files) {
  const doc = JSON.parse(fs.readFileSync(path.join(DIR, f)));
  const before = crypto.createHash("sha256").update(JSON.stringify(doc.events)).digest("hex");
  Object.freeze(doc.events); doc.events.forEach(Object.freeze);
  const scopes = [...new Set(doc.expected.spans.map((s) => s.scope))];
  const out = {}; for (const sc of scopes) out[sc] = analyse(doc, sc);
  for (const ex of doc.expected.spans) {
    const pred = out[ex.scope].spans; let best = null, bo = 0;
    for (const p of pred) { const ov = Math.min(p.endNs, ex.endNs) - Math.max(p.startNs, ex.startNs); if (ov > bo) { bo = ov; best = p; } }
    const top = best && !best.abstain ? best.alternatives.map((x) => x.label) : [];
    const topK = top.some((l) => ex.acceptableTopK.includes(l));
    const abst = !!best?.abstain;
    const abstApp = ex.abstainExpected ? abst : ex.abstainOk ? true : !abst;
    const flagsMissing = (ex.flagsExpected ?? []).filter((fl) => !best?.flags.includes(fl));
    rows.push({ id: doc.id, scope: ex.scope, truth: ex.truth, top1: top[0] ?? (abst ? "ABSTAIN:" + best.abstain.reason : "-"), top: top.join(" | "), truthInTopK: ex.truth ? top.includes(ex.truth) : null, acceptableInTopK: ex.truth ? topK : null, abstained: abst, abstainAppropriate: abstApp, flagsMissing, rootlessOffered: ex.rootlessExpected ? best?.alternatives.some((x) => x.rootless && x.label === ex.truth) ?? false : null });
    if (ex.truth) pairs.push({ id: doc.id, scope: ex.scope, ref: ex.truth, est: top[0] ?? "N", durS: (ex.endNs - ex.startNs) / 1e9 });
  }
  for (const r of doc.expected.roles) { const sc = r.ch === 2 ? "bass" : "piano"; const o = out[sc] ?? analyse(doc, sc); const p = o.roles.find((x) => x.onNs === r.onNs && x.pitch === r.pitch); roleN++; if (p && p.role === r.role) roleOk++; }
  for (const [sc, bs] of Object.entries(doc.expected.boundaries ?? {})) for (const tb of bs) { const pb = out[sc]?.spans.map((s) => s.startNs) ?? []; const e = Math.min(...pb.map((x) => Math.abs(x - tb))); bErr.push(e / 1e6); }
  if (crypto.createHash("sha256").update(JSON.stringify(doc.events)).digest("hex") === before && before === doc.rawChecksum.value) rawOk++;
  if (process.argv.includes("--annotations") ) console.log(JSON.stringify({ fixture: doc.id, analyzer: ANALYZER, out }, null, 1));
}
const n = rows.length, withTruth = rows.filter((r) => r.truth);
console.log(`== Stage-1 harmony reference ${ANALYZER.version} on ${SET.toUpperCase()} (SYNTHETIC, provisional labels, not an accuracy claim)${SET === "tuning" ? "  [IN-SAMPLE: written while looking at these fixtures]" : "  [HOLDOUT: not used to tune]"}`);
console.log(`fixtures ${files.length} | labelled spans ${n} | truth in top-${P.TOPK} ${withTruth.filter((r) => r.truthInTopK).length}/${withTruth.length} | an acceptable label in top-${P.TOPK} ${withTruth.filter((r) => r.acceptableInTopK).length}/${withTruth.length} | abstention appropriate ${rows.filter((r) => r.abstainAppropriate).length}/${n} | role tags ${roleOk}/${roleN} | boundary err median ${bErr.length ? bErr.sort((a, b) => a - b)[Math.floor(bErr.length / 2)].toFixed(0) + " ms (n=" + bErr.length + ", max " + Math.max(...bErr).toFixed(0) + ")" : "-"} | raw unchanged ${rawOk}/${files.length}`);
for (const r of rows) console.log(`  ${r.id.padEnd(40)} ${r.scope.padEnd(8)} truth=${String(r.truth).padEnd(10)} top=[${r.top || r.top1}] inTopK=${r.truthInTopK ?? "-"} acc=${r.acceptableInTopK ?? "-"} abstApp=${r.abstainAppropriate}${r.rootlessOffered === null ? "" : " rootlessOffered=" + r.rootlessOffered}${r.flagsMissing.length ? " missingFlags=" + r.flagsMissing : ""}`);
const pi = process.argv.indexOf("--pairs"); if (pi > 0) fs.writeFileSync(process.argv[pi + 1], JSON.stringify({ set: SET, analyzer: ANALYZER, pairs }, null, 1));
