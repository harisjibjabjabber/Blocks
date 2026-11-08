// Blocks Capture — evaluation harness smoke test over SYNTHETIC fixtures (research artefact).
// Run: node --experimental-strip-types evaluate.mjs [--data data|data-holdout] [--json]
// Not rerun for the handover import. The 534279f predictor is not the current cut.
//   --data data          TUNING set (m0Predict parameters were tuned on it: in-sample)
//   --data data-holdout  HOLDOUT set (generated separately by generate-holdout.mjs; never used to tune)
// It validates every fixture, then scores two reference predictors:
//   "prototype-f62b2a5": mimics what the live prototype selects (whole 120 s ribbon, cleared after each capture)
//   "m0-reference":      the proposed M0 rule (latest true silence, bounded, bar-snapped when a grid exists)
//   "main-534279f":      the REAL recentPhraseCut() from Blocks main 534279f (checkout copy in
//                        ../historical/534279f/recent-phrase.ts; git blob 93292fe, same at fadfdcf,
//                        not the fdba348 or 497894e cut), wrapped in a model of App.capture()
//                        (history cleared after each capture, 120 s ribbon). Skipped if that file is absent.
//                        A run of this predictor is not evidence about fdba348 or later commits.
// Results are a harness smoke test on synthetic data with designer-intent labels.
// They are NOT accuracy claims about any algorithm or about real playing.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argData = process.argv.indexOf("--data");
const DATA = path.resolve(HERE, argData >= 0 ? process.argv[argData + 1] : "data");
const MAIN_CUT_PATH = path.resolve(HERE, "../historical/534279f/recent-phrase.ts");
let recentPhraseCut = null;
if (fs.existsSync(MAIN_CUT_PATH)) {
  try { ({ recentPhraseCut } = await import(pathToFileURL(MAIN_CUT_PATH).href)); } catch (e) { console.log("main-534279f predictor unavailable: " + e.message); }
}
const NS = 1e9;

// ---- unvalidated starting parameters (proposals, NOT acceptance thresholds) ----
const P = {
  GAP_MIN_NS: 1.5 * NS,          // gap = max(1.5 s, 2 beats) — proposal
  GAP_BEATS: 2,
  SOUNDING_REST_NS: 1.0 * NS,    // onset gap while something still sounds — proposal
  MAX_FREE_NS: 30 * NS,          // bounded candidate length without grid — proposal
  MAX_BARS: 16,                  // bounded candidate length with grid — proposal
  EARLY_MARGIN_NS: 0.06 * NS,    // onset this close before a bar line belongs to that bar — proposal
  LANDING_MARGIN_NS: 0.08 * NS,  // final hit this close to a bar line = landing downbeat — proposal
  DRUM_MIN_NS: 0.05 * NS,
  TOL_START_NS: 0.15 * NS,       // scoring tolerance (proposal)
  TOL_END_NS: 0.5 * NS,
};

const sha = (events) => crypto.createHash("sha256").update(JSON.stringify(events)).digest("hex");
const deepFreeze = (o) => { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v); return o; };

function validate(doc) {
  const errs = [];
  if (doc.synthetic !== true || !/^SYNTHETIC/.test(doc.label)) errs.push("missing SYNTHETIC label");
  let prevT = -1, prevSeq = 0;
  for (const e of doc.events) {
    if (e.tNs < prevT) errs.push("events not time-ordered at seq " + e.seq);
    if (e.seq !== prevSeq + 1) errs.push("seq gap at " + e.seq);
    if (!Number.isSafeInteger(e.tNs)) errs.push("unsafe tNs at " + e.seq);
    prevT = e.tNs; prevSeq = e.seq;
  }
  if (sha(doc.events) !== doc.rawChecksum.value) errs.push("checksum mismatch");
  if (!["tuning", "holdout"].includes(doc.set)) errs.push("missing set (tuning|holdout)");
  for (const st of doc.steps) {
    const d = st.expected.default;
    if (d.startNs !== undefined && d.startNs > st.captureAtNs) errs.push(st.kind + ": default starts after capture");
    if (d.endNs !== undefined && d.endNs > st.captureAtNs + 1) errs.push(st.kind + ": default ends after capture");
  }
  return errs;
}

// ---------- shared derivation: per-stream note pairing + CC64/CC66 sounding ----------
const streamKey = (e) => e.src + "|" + e.port + "|" + e.ch;
function deriveNotes(events, captureAtNs, watermark = null) {
  const streams = new Map();
  const S = (k) => { if (!streams.has(k)) streams.set(k, { held: new Map(), cc64: 0, cc66: 0, latched: new Set() }); return streams.get(k); };
  const notes = []; const diag = { orphanOffs: 0, retriggers: 0 };
  if (watermark) for (const [k, w] of Object.entries(watermark)) { const s = S(k); s.cc64 = w.cc64; s.cc66 = w.cc66; for (const h of w.held) { const n = { stream: k, pitch: h.pitch, onNs: null, evictedOnset: true, keyOffNs: null, soundOffNs: null }; s.held.set(h.pitch, n); notes.push(n); } }
  const pend64 = new Map(); // stream -> notes keyed off while pedal down
  for (const e of events) {
    const k = streamKey(e), s = S(k);
    if (e.type === "on" && e.d2 > 0) {
      const prev = s.held.get(e.d1);
      if (prev) { prev.keyOffNs = e.tNs; prev.soundOffNs = e.tNs; prev.endReason = "RETRIGGER"; diag.retriggers++; }
      const n = { stream: k, pitch: e.d1, onNs: e.tNs, keyOffNs: null, soundOffNs: null, drum: e.ch === 10 };
      s.held.set(e.d1, n); notes.push(n);
    } else if (e.type === "off" || (e.type === "on" && e.d2 === 0)) {
      const n = s.held.get(e.d1);
      if (!n) { diag.orphanOffs++; continue; }
      s.held.delete(e.d1); n.keyOffNs = e.tNs;
      const latched = s.latched.has(n);
      if (s.cc64 >= 64 || (latched && s.cc66 >= 64)) { if (!pend64.has(k)) pend64.set(k, new Set()); pend64.get(k).add(n); }
      else n.soundOffNs = n.drum ? Math.max(e.tNs, n.onNs + P.DRUM_MIN_NS) : e.tNs;
    } else if (e.type === "cc" && e.d1 === 64) {
      s.cc64 = e.d2;
      if (e.d2 < 64 && pend64.has(k)) for (const n of [...pend64.get(k)]) if (!(s.latched.has(n) && s.cc66 >= 64)) { n.soundOffNs = e.tNs; pend64.get(k).delete(n); }
    } else if (e.type === "cc" && e.d1 === 66) {
      const was = s.cc66; s.cc66 = e.d2;
      if (was < 64 && e.d2 >= 64) for (const n of s.held.values()) s.latched.add(n); // latch only notes held NOW
      if (e.d2 < 64) { if (pend64.has(k)) for (const n of [...pend64.get(k)]) if (s.latched.has(n) && s.cc64 < 64) { n.soundOffNs = e.tNs; pend64.get(k).delete(n); } s.latched.clear(); }
    }
  }
  for (const n of notes) if (n.soundOffNs === null) { n.open = true; n.soundOffNs = captureAtNs; } // tentative, derived only
  return { notes, diag };
}

function windowAndWatermark(events, captureAtNs, maxAgeNs) {
  const cut = captureAtNs - maxAgeNs;
  const kept = [], wm = {};
  const W = (k) => (wm[k] ??= { held: new Map(), cc64: 0, cc66: 0 });
  for (const e of events) {
    if (e.tNs > captureAtNs) break;
    if (e.tNs >= cut) { kept.push(e); continue; }
    const w = W(streamKey(e));
    if (e.type === "on" && e.d2 > 0) w.held.set(e.d1, { pitch: e.d1 });
    else if (e.type === "off" || e.type === "on") w.held.delete(e.d1);
    else if (e.type === "cc" && e.d1 === 64) w.cc64 = e.d2;
    else if (e.type === "cc" && e.d1 === 66) w.cc66 = e.d2;
  }
  const watermark = {}; for (const [k, w] of Object.entries(wm)) watermark[k] = { cc64: w.cc64, cc66: w.cc66, held: [...w.held.values()] };
  return { kept, truncated: cut > 0 && events.some((e) => e.tNs < cut), cutNs: Math.max(0, cut), watermark };
}

// ---------- predictor: what prototype f62b2a5 selects ----------
function prototypePredict(doc, step, state) {
  const since = state.lastCaptureNs ?? -Infinity;
  let evs = doc.events.filter((e) => e.tNs <= step.captureAtNs && e.tNs > since);
  if (evs.length) { const newest = evs[evs.length - 1].tNs; evs = evs.filter((e) => newest - e.tNs <= 120 * NS); }
  state.lastCaptureNs = step.captureAtNs; // App.capture() calls history.clear()
  if (!evs.length) return { mode: "none", candidates: [] };
  const c = { startNs: evs[0].tNs, endNs: evs[evs.length - 1].tNs };
  return { mode: "unknown", candidates: [c], projectBpm: step.context.projectGrid?.bpm ?? null, flags: [] };
}

// ---------- predictor: proposed M0 reference ----------
function m0Predict(doc, step) {
  const maxAge = doc.bufferPolicy?.maxAgeNs ?? 600 * NS;
  const { kept, truncated, cutNs, watermark } = windowAndWatermark(doc.events, step.captureAtNs, maxAge);
  const target = step.part === "bass" ? (e) => e.ch === 2 : step.part === "drums" ? (e) => e.ch === 10 : step.kind === "layer-capture" ? () => true : (e) => e.ch !== 2 && e.ch !== 10;
  const evs = kept.filter(target);
  const flags = [];
  if (truncated) flags.push("HISTORY_TRUNCATED");
  const { notes, diag } = deriveNotes(evs, step.captureAtNs, truncated ? watermark : null);
  if (diag.orphanOffs) flags.push("ORPHAN_NOTE_OFF");
  { const open = new Map(); let hit = false; for (const e of evs) { const k = e.ch + ":" + e.d1, sk = streamKey(e); if (e.type === "on" && e.d2 > 0) { const o = open.get(k); if (o && o.size && ![...o].every((x) => x === sk)) hit = true; if (!open.has(k)) open.set(k, new Set()); open.get(k).add(sk); } else if (e.type === "off" || e.type === "on") open.get(k)?.delete(sk); } if (hit) flags.push("CROSS_STREAM_SAME_KEY"); } // diagnostic only (engine keys voices by channel+note)
  if (notes.some((n) => n.evictedOnset)) flags.push("ONSET_EVICTED");
  if (notes.some((n) => n.open && !n.evictedOnset)) flags.push("OPEN_NOTES_AT_CAPTURE");
  { const st = new Map(); for (const e of evs) if (e.type === "cc" && e.d1 === 64) st.set(streamKey(e), e.d2); if ([...st.values()].some((v) => v >= 64)) flags.push("PEDAL_DOWN_AT_CAPTURE"); }
  if (!notes.length) return { mode: "abstain", reasonCode: "NOTHING_PLAYED", candidates: [], flags };
  const grid = step.context.projectGrid;
  const beatNs = grid?.bpm ? (60 / grid.bpm) * NS : null;
  const gap = Math.max(P.GAP_MIN_NS, beatNs ? P.GAP_BEATS * beatNs : 0);
  // union of sounding intervals
  const iv = notes.map((n) => [n.onNs ?? cutNs, n.soundOffNs]).sort((a, b) => a[0] - b[0]);
  const clusters = [];
  for (const [a, b] of iv) { const last = clusters[clusters.length - 1]; if (last && a - last[1] < gap) last[1] = Math.max(last[1], b); else clusters.push([a, b]); }
  let [cs, ce] = clusters[clusters.length - 1];
  const touchesWatermark = truncated && cs <= cutNs + 1;
  const tooLong = grid?.bpm ? ce - cs > P.MAX_BARS * 4 * beatNs : ce - cs > P.MAX_FREE_NS;
  const candidates = [];
  const onsets = notes.filter((n) => n.onNs !== null && n.onNs >= cs).map((n) => n.onNs).sort((a, b) => a - b);
  // onset-gap (sounding-rest) boundaries inside the last cluster, latest first
  const restSplits = [];
  for (let i = onsets.length - 1; i > 0; i--) if (onsets[i] - onsets[i - 1] >= P.SOUNDING_REST_NS) restSplits.push(onsets[i]);
  let start = onsets[0] ?? cs, reason = "LATEST_SILENCE";
  if (touchesWatermark || tooLong) {
    flags.push(touchesWatermark ? "NO_SILENCE_IN_HISTORY" : "NO_SILENCE_FOUND");
    if (restSplits.length) { start = restSplits[0]; reason = "SOUNDING_REST_BOUNDARY"; }
    else { start = Math.max(cs, ce - (grid?.bpm ? 8 * 4 * beatNs : 20 * NS)); reason = "BOUNDED_FALLBACK"; flags.push("BOUNDED_FALLBACK"); }
  }
  if (!grid) {
    candidates.push({ startNs: start, endNs: ce, mode: "free", reason });
    if (reason === "LATEST_SILENCE" && restSplits.length) candidates.push({ startNs: restSplits[0], endNs: ce, mode: "free", reason: "SOUNDING_REST_BOUNDARY" });
    if (clusters.length > 1) { const [ps] = clusters[clusters.length - 2]; candidates.push({ startNs: ps, endNs: ce, mode: "free", reason: "PREVIOUS_SILENCE" }); }
    return { mode: "free", reasonCode: "M0_HAS_NO_PULSE_ESTIMATOR", candidates, flags };
  }
  // established grid: snap to bars (or free cycles)
  const unit = grid.bpm ? grid.beatsPerBar * beatNs : grid.freeCycleNs;
  const o = grid.projectOriginNs;
  const barOf = (t) => Math.floor((t - o) / unit);
  let firstOn = onsets.find((t) => t >= start) ?? start;
  let startBar = barOf(firstOn + P.EARLY_MARGIN_NS);
  if (firstOn < o + startBar * unit) flags.push("PICKUP");
  // anacrusis rule (proposal): material only in the last <= 1 beat before a bar line -> pickup into the next bar
  if (beatNs) { const nextLine = o + (startBar + 1) * unit; const inBar = onsets.filter((t) => t >= firstOn && t < nextLine - P.EARLY_MARGIN_NS); if (nextLine - firstOn <= beatNs + P.EARLY_MARGIN_NS && inBar.every((t) => nextLine - t <= beatNs + P.EARLY_MARGIN_NS) && onsets.some((t) => t >= nextLine - P.EARLY_MARGIN_NS)) { startBar += 1; flags.push("PICKUP"); } }
  const lastOn = onsets[onsets.length - 1];
  let endBar = barOf(lastOn) + 1;
  const lastLine = o + Math.round((lastOn - o) / unit) * unit;
  const after = onsets.filter((t) => t > lastOn);
  if (Math.abs(lastOn - lastLine) <= P.LANDING_MARGIN_NS && after.length === 0 && onsets.length > 1) { endBar = Math.round((lastOn - o) / unit); flags.push("LANDING_DOWNBEAT_AT_SEAM"); }
  const capBar = barOf(step.captureAtNs);
  if (step.captureAtNs - (o + capBar * unit) > 0 && onsets.some((t) => barOf(t) === capBar) && endBar > capBar) { endBar = capBar; flags.push("INCOMPLETE_CURRENT_BAR_EXCLUDED"); }
  const span = Math.max(1, endBar - startBar);
  const lens = [1, 2, 4, 8, 16].filter((L) => L >= span);
  const L = Math.min(lens[0] ?? P.MAX_BARS, P.MAX_BARS);
  const mode = grid.bpm ? "bar-range" : "cycle-range";
  const mk = (sb, len) => (grid.bpm ? { startBar: sb, lengthBars: len } : { startCycle: sb, lengthCycles: len });
  candidates.push({ ...mk(endBar - L, L), startNs: o + (endBar - L) * unit, endNs: o + endBar * unit, reason });
  if (L > 1) candidates.push({ ...mk(endBar - L / 2, L / 2), reason: "HALF_LENGTH" });
  candidates.push({ ...mk(endBar - 2 * L, L), reason: "PREVIOUS_SAME_LENGTH" });
  candidates.push({ ...mk(endBar - 2 * L, 2 * L), reason: "DOUBLE_LENGTH" });
  return { mode, candidates, projectBpm: grid.bpm, flags };
}

// ---------- predictor: real recentPhraseCut() from main 534279f, inside a model of App.capture() ----------
function mainPredict(doc, step, state) {
  const since = state.lastCaptureNs ?? -Infinity;
  let evs = doc.events.filter((e) => e.tNs <= step.captureAtNs && e.tNs > since);
  if (evs.length) { const newest = evs[evs.length - 1].tNs; evs = evs.filter((e) => newest - e.tNs <= 120 * NS); }
  if (evs.length > 4096) evs = evs.slice(-4096);
  state.lastCaptureNs = step.captureAtNs; // App.tsx L266 history.clear() still present at 534279f
  if (!evs.length) return { mode: "none", candidates: [], flags: [] };
  const kind = (e) => (e.type === "on" ? "note-on" : e.type === "off" ? "note-off" : e.type === "cc" ? "cc" : e.type === "bend" ? "pitch" : "other");
  const captured = evs.map((e) => ({ domain: "android-monotonic-ns", sequence: BigInt(e.seq), portId: e.src + "/" + e.port, sessionId: "fx", channel: e.ch - 1, kind: kind(e),
    note: e.type === "on" || e.type === "off" ? e.d1 : 0, velocity: e.type === "on" ? e.d2 : 0, controller: e.type === "cc" ? e.d1 : 0, value: e.type === "cc" ? e.d2 : 0,
    sourceTimestamp: BigInt(e.tNs), receiptTimestamp: BigInt(e.tNs), missingSourceTimestamp: false, raw: null, origin: "raw-midi",
    id: "e" + e.seq, elapsedSource: BigInt(e.tNs), elapsedReceipt: BigInt(e.tNs), scheduleElapsed: BigInt(e.tNs) }));
  const g = step.context.projectGrid; // App passes a locked grid only after the first capture auto-locked one
  const cut = recentPhraseCut(captured, { ticksPerSecond: 1e9, gridPeriodTicks: g?.bpm ? BigInt(Math.round((60 / g.bpm) * 1e9)) : null, gridOriginTicks: g?.bpm ? BigInt(g.projectOriginNs) : null, historyMayBeTruncated: false });
  const toC = (b, reason) => ({ startNs: Number(b.start), endNs: Number(b.end), reason });
  const candidates = [toC(cut.selection, cut.status)];
  if (cut.priorPhrase) candidates.push(toC(cut.priorPhrase, "priorPhrase"));
  if (cut.priorBar) candidates.push(toC(cut.priorBar, "priorBar"));
  return { mode: "unknown", candidates, projectBpm: g?.bpm ?? null, flags: [], status: cut.status };
}

// ---------- scoring ----------
function matches(pred, gt, beatNs) {
  if (gt.startBar !== undefined) return pred.startBar === gt.startBar && pred.lengthBars === gt.lengthBars;
  if (gt.startCycle !== undefined) return pred.startCycle === gt.startCycle && pred.lengthCycles === gt.lengthCycles;
  if (gt.startNs === undefined || pred.startNs === undefined) return false;
  const tolEnd = Math.max(P.TOL_END_NS, beatNs ?? 0);
  return Math.abs(pred.startNs - gt.startNs) <= P.TOL_START_NS && Math.abs(pred.endNs - gt.endNs) <= tolEnd;
}
function modeOk(pm, em) { if (em === "grid") return pm === "grid"; return pm === em; }

function score(doc, predictor) {
  const out = []; const state = {};
  const before = sha(doc.events);
  deepFreeze(doc.events);
  for (const step of doc.steps) {
    const ex = step.expected;
    const pred = predictor(doc, step, state);
    const beatNs = ex.tempo?.bpm ? (60 / ex.tempo.bpm) * NS : null;
    const top = pred.candidates[0];
    const rankIdx = pred.candidates.findIndex((c) => matches(c, ex.default, beatNs));
    const accHit = top ? (ex.acceptable ?? []).some((a) => matches(top, a, beatNs)) : false;
    const defOk = !!top && matches(top, ex.default, beatNs);
    const unacc = top ? (ex.unacceptable ?? []).some((u) => matches(top, u, beatNs)) : false;
    out.push({
      fixture: doc.id, step: step.kind + (step.part ? ":" + step.part : ""),
      selectionDefaultOk: defOk, selectionAcceptable: !defOk && accHit, selectionUnacceptable: unacc,
      modeOk: modeOk(pred.mode, ex.mode), predMode: pred.mode, expectedMode: ex.mode,
      rankOfDefault: rankIdx >= 0 ? rankIdx + 1 : null,
      startErrMs: top?.startNs !== undefined && ex.default.startNs !== undefined ? Math.round(Math.abs(top.startNs - ex.default.startNs) / 1e6) : null,
      expectedFlagsRaised: (ex.flags ?? []).filter((f) => pred.flags?.includes(f)),
      expectedFlagsMissing: (ex.flags ?? []).filter((f) => !pred.flags?.includes(f)),
      projectTempoUnchanged: step.kind === "layer-capture" ? pred.projectBpm === step.context.projectGrid.bpm : null,
    });
  }
  // derived pairing checks (retrigger policy, per stream), where a fixture declares them
  for (const [i, step] of doc.steps.entries()) {
    const dc = step.expected.derivedChecks; if (!dc || !dc.notesByStream || predictor !== m0Predict) continue;
    const { notes, diag } = deriveNotes(doc.events.filter((e) => e.tNs <= step.captureAtNs), step.captureAtNs);
    const by = {}; for (const n of notes) by[n.stream] = (by[n.stream] ?? 0) + 1;
    out[i].derivedPairingOk = JSON.stringify(Object.entries(by).sort()) === JSON.stringify(Object.entries(dc.notesByStream).sort())
      && (dc.retriggerClosures === undefined || dc.retriggerClosures === diag.retriggers) && (dc.orphanNoteOffs === undefined || dc.orphanNoteOffs === diag.orphanOffs);
  }
  const rawUnchanged = sha(doc.events) === before;
  for (const r of out) r.rawUnchanged = rawUnchanged;
  return out;
}

// ---------- run ----------
const files = fs.readdirSync(DATA).filter((f) => f.endsWith(".json") && f !== "index.json").sort();
let bad = 0;
const docs = files.map((f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")));
for (const d of docs) { const e = validate(d); if (e.length) { bad++; console.log("INVALID", d.id, e); } }
console.log(`validated ${docs.length} fixtures, ${bad} invalid`);
const results = {};
const predictors = [["prototype-f62b2a5", prototypePredict], ["m0-reference", m0Predict]];
if (recentPhraseCut) predictors.push(["main-534279f", mainPredict]);
const setName = docs[0]?.set ?? "?";
const m0Hash = crypto.createHash("sha256").update(m0Predict.toString() + deriveNotes.toString() + JSON.stringify(P)).digest("hex").slice(0, 16);
console.log(`set=${setName.toUpperCase()} data=${path.relative(HERE, DATA)} m0Predict+deriveNotes+P hash=${m0Hash}` + (setName === "tuning" ? "  [IN-SAMPLE: m0 parameters were tuned on this set]" : "  [HOLDOUT: not used to tune m0Predict]"));
for (const [name, fn] of predictors) {
  results[name] = docs.flatMap((d) => score(JSON.parse(JSON.stringify(d)), fn));
}
if (process.argv.includes("--json")) { console.log(JSON.stringify({ set: setName, m0Hash, params: P, results }, null, 1)); process.exit(0); }
for (const [name, rows] of Object.entries(results)) {
  const n = rows.length;
  const c = (k) => rows.filter((r) => r[k] === true).length;
  console.log(`\n== ${name} (SYNTHETIC smoke test, designer-intent labels, not an accuracy claim)`);
  console.log(`steps ${n} | default selection ok ${c("selectionDefaultOk")} | acceptable-not-default ${c("selectionAcceptable")} | unacceptable ${c("selectionUnacceptable")} | mode ok ${c("modeOk")} | raw unchanged ${c("rawUnchanged")}/${n}`);
  for (const r of rows) console.log(`  ${r.fixture.padEnd(38)} ${r.step.padEnd(20)} default=${r.selectionDefaultOk ? "Y" : "n"} acc=${r.selectionAcceptable ? "Y" : "-"} bad=${r.selectionUnacceptable ? "!" : "-"} mode=${r.predMode}/${r.expectedMode} rank=${r.rankOfDefault ?? "-"} startErr=${r.startErrMs ?? "-"}ms missingFlags=${r.expectedFlagsMissing.join(",") || "-"}${r.derivedPairingOk === undefined ? "" : " pairing=" + (r.derivedPairingOk ? "ok" : "MISMATCH")}${r.projectTempoUnchanged === null ? "" : " tempoKept=" + r.projectTempoUnchanged}`);
}
