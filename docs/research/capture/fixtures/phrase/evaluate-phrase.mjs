// Phrase-capture harness: research predictor vs historical cuts and the 3412f61 research baseline.
// Run: node --experimental-strip-types evaluate-phrase.mjs [tuning|holdout] [--detail]
// Not rerun for this import. The predictor is not the app and is not validated to ship.
// Current research baseline: 3412f612fe5f5f8d818ec50ad62ab9cd2a3cab3e.
// fdba348124d4cefe6fbeba2a7c187e47de705528 and 497894e170ac150f06e5a8bea34d0d4e7f34e2fd stay historical.
// The archive did not include those source copies. These imports are git extracts under historical/.
// main-fdba348 is called like App.capture() at that commit. It is not the device or the live bundle.
// SYNTHETIC fixtures, provisional labels: NOT Haris's MIDI.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { recentPhraseCut } from "../../historical/fdba348/recent-phrase.ts";
import { recentPhraseCut as recentPhraseCut497 } from "../../historical/497894e/recent-phrase.ts";
import { recentPhraseCut as recentPhraseCut341 } from "../../historical/3412f61/recent-phrase.ts";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SET = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "tuning";
const DATA = process.env.PHRASE_DATA || path.join(HERE, "data");
const US = 1e6;
export const P = { // unvalidated starting values (see phrase-capture-handoff.md §5)
  GROUP_STEP_S: 0.07, GROUP_MAX_S: 0.16, BEAT_MIN_S: 0.33, BEAT_MAX_S: 1.2, IOI_MAX_S: 6, TEMPO_WINDOW_S: 18, CLUSTER_S: 0.025, MAX_TEMPI: 14,
  RECENT_S: 40, BARS: [1, 2, 4, 8], BEATS_PER_BAR: 4, DRIFTS: [-0.04, 0, 0.04], SIGMA_ABS_S: 0.04, SIGMA_REL: 0.05, OFFGRID: 0.3, OFFGRID_PEN: 0.6,
  LEVEL_W: [1, 0.7, 0.3], BAR_PRIOR: { 1: -0.2, 2: -0.06, 4: 0.08, 8: -0.04 }, TEMPO_CENTER_BPM: 110, TEMPO_PRIOR: 0.12,
  MIN_GROUPS: 3, MIN_SPAN_S: 2.0, ABSTAIN_FIT: 0.6, FREE_MAX_S: 20, FREE_MIN_S: 3,
};
// ---------- shared: onset groups (role-agnostic) + sounding state ----------
export function analyseEvents(events) {
  const notes = []; const held = new Map(); let pedal = false; const pend = [];
  for (const e of events) { const t = Number(e.scheduleElapsed) / US; const k = e.channel + ":" + e.note;
    if (e.kind === "note-on" && e.velocity > 0) { const p = held.get(k); if (p) { p.off = t; p.snd = t; } const n = { on: t, off: null, snd: null, note: e.note, vel: e.velocity }; held.set(k, n); notes.push(n); }
    else if (e.kind === "note-off" || (e.kind === "note-on" && e.velocity === 0)) { const n = held.get(k); if (!n) continue; held.delete(k); n.off = t; if (pedal) pend.push(n); else n.snd = t; }
    else if (e.kind === "cc" && e.controller === 64) { pedal = e.value >= 64; if (!pedal) { for (const n of pend) n.snd = t; pend.length = 0; } } }
  const end = events.length ? Number(events[events.length - 1].scheduleElapsed) / US : 0;
  for (const n of notes) { if (n.off === null) { n.off = Infinity; n.open = true; } if (n.snd === null) n.snd = Math.max(n.off, end); }
  notes.sort((a, b) => a.on - b.on);
  const groups = [];
  if (process.env.GROUPING === "candidate") { // attack-onset candidate (grouping-check.mjs); ABS 130 ms / REL 0.4 UNVALIDATED, set a priori
    const mono = (ps) => { if (ps.length < 3) return false; const d = ps.slice(1).map((p, i) => p - ps[i]); return d.every((x) => x > 0 && x <= 2) || d.every((x) => x < 0 && x >= -2); };
    let g = null; for (let i = 0; i < notes.length; i++) { const n = notes[i];
      if (g) { const prev = notes[i - 1]; const before = g.start > 0 ? notes[g.start].on - notes[g.start - 1].on : Infinity; let k = i + 1; while (k < notes.length && notes[k].on - notes[k - 1].on <= 0.13) k++;
        const after = k < notes.length ? notes[k].on - notes[k - 1].on : Infinity; const ctx = Math.min(before, after); const win = Math.min(0.13, 0.4 * (Number.isFinite(ctx) ? ctx : 1));
        if (n.on - prev.on <= win && prev.snd > n.on && !mono([...g.notes.map((x) => x.note), n.note])) { g.notes.push(n); g.lastOn = n.on; continue; } }
      g = { start: i, t: n.on, lastOn: n.on, notes: [n] }; groups.push(g); }
  } else
  for (const n of notes) { const g = groups[groups.length - 1];
    if (g && n.on - g.lastOn <= P.GROUP_STEP_S && n.on - g.t <= P.GROUP_MAX_S) { g.notes.push(n); g.lastOn = n.on; } else groups.push({ t: n.on, lastOn: n.on, notes: [n] }); }
  for (const g of groups) { g.snd = Math.max(...g.notes.map((n) => n.snd)); g.dur = Math.max(...g.notes.map((n) => Math.min(n.off, n.snd) - n.on)); g.pitch = g.notes.reduce((s, n) => s + n.note, 0) / g.notes.length; }
  const med = [...groups.map((g) => g.dur)].sort((a, b) => a - b)[Math.floor(groups.length / 2)] ?? 0;
  for (const g of groups) g.accent = 1 + (g.dur >= 1.5 * med ? 0.5 : 0); // long-note accent, never note count
  return { notes, groups };
}
function tempoCandidates(gs, endT) {
  // IOI histogram over the recent material only (Dixon-style clustering idea, implemented from the description; no GPL code):
  // every pair of onset groups up to 6 s apart votes, folded into the beat range by small integer ratios.
  const recentG = gs.filter((g) => g.t >= endT - P.TEMPO_WINDOW_S); const bins = new Map();
  for (let i = 0; i < recentG.length; i++) for (let j = i + 1; j < recentG.length; j++) { const d = recentG[j].t - recentG[i].t; if (d > P.IOI_MAX_S) break; if (d < 0.1) continue;
    for (const f of [1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4]) { const T = d * f; if (T < P.BEAT_MIN_S || T > P.BEAT_MAX_S) continue; const k = Math.round(Math.log(T) / Math.log(1.02));
      const w = (recentG[i].accent + recentG[j].accent) / 2 / (1 + Math.abs(Math.log2(f)) * 0.5) / (j - i); bins.set(k, (bins.get(k) ?? 0) + w); } }
  const sm = [...bins.keys()].map((k) => ({ k, v: (bins.get(k - 1) ?? 0) * 0.5 + bins.get(k) + (bins.get(k + 1) ?? 0) * 0.5 })).sort((a, b) => b.v - a.v);
  const out = []; for (const { k } of sm) { const T = Math.pow(1.02, k); if (!out.some((x) => Math.abs(x - T) / T < 0.03)) out.push(T); if (out.length >= P.MAX_TEMPI) break; }
  return out;
}
const tol = (x) => (x >= 1 ? 0 : 1 - x * x); // bounded tolerance-window residual (robust: an outlier costs at most 1)
function gridFit(win, S, T, nBeats, drift) {
  const beatAt = (k) => { // time of beat k (fractional) with linear drift across the window
    const len = (j) => T * (1 + drift * (j / nBeats - 0.5)); let x = S; const w = Math.floor(k); for (let j = 0; j < w; j++) x += len(j); return x + (k - w) * len(w); };
  const sigma = P.SIGMA_ABS_S + P.SIGMA_REL * T; let num = 0, den = 0; const perGroup = [];
  for (const g of win) { let best = 0;
    const kApprox = (g.t - S) / T; for (let k = Math.floor(kApprox) - 1; k <= Math.ceil(kApprox) + 1; k++) for (const [li, step] of [[0, 1], [1, 0.5], [2, 0.25]].map(([l, s]) => [l, s]))
      for (let q = 0; q < 1; q += step) { const r = Math.abs(g.t - beatAt(k + q)); best = Math.max(best, P.LEVEL_W[li] * tol(r / sigma)); }
    num += g.accent * best; den += g.accent; perGroup.push(best); }
  return { fit: den ? num / den : 0, beatAt, sigma, perGroup };
}
function barSupport(win, beatAt, nBars, sigma) { let hit = 0; for (let b = 0; b < nBars; b++) { const t = beatAt(b * P.BEATS_PER_BAR); if (win.some((g) => Math.abs(g.t - t) <= sigma * 1.5 || (g.t < t && g.snd > t + sigma && g.dur > sigma * 4 && b > 0 && false))) hit++; } return hit / nBars; }
function repetition(win, S, half) { if (win.length < 4) return 0; const key = (g, off) => Math.round((g.t - off) / 0.08) + ":" + (Math.round(g.pitch) % 12);
  const A = new Set(win.filter((g) => g.t < S + half).map((g) => key(g, S))), B = new Set(win.filter((g) => g.t >= S + half).map((g) => key(g, S + half)));
  const inter = [...A].filter((x) => B.has(x) || B.has(x.replace(/^(-?\d+)/, (m) => String(+m + 1))) || B.has(x.replace(/^(-?\d+)/, (m) => String(+m - 1)))).length; return A.size + B.size ? (2 * inter) / (A.size + B.size) : 0; }
// ---------- REFERENCE predictor: pulse-first, joint tempo/phase/range, end-anchored ----------
export function referencePredict(events, pressUs, lockedGrid) {
  const { groups } = analyseEvents(events); const press = pressUs / US; const reasons = [];
  const recent = groups.filter((g) => g.t >= press - P.RECENT_S);
  if (recent.length < P.MIN_GROUPS) return { mode: "abstain", reasons: ["too little material"], coverage: [0, press], alternatives: [] };
  const last = recent[recent.length - 1]; const tempi = lockedGrid ? [lockedGrid.beatUs / US] : tempoCandidates(recent, last.t);
  const cands = [];
  const endAnchors = (T) => { // loop END candidates: last attack as next-downbeat (tail), or the end of the last sounding notes on the beat grid
    const out = [{ E: last.t, kind: "final-attack-as-next-downbeat" }]; const sndEnd = Math.min(last.snd, press);
    for (const k of [1, 2, 3, 4]) { const E = last.t + k * T; if (E <= sndEnd + 0.6 * T && E <= press + 0.3 * T) out.push({ E, kind: "last-group+" + k + "beats" }); }
    if (lockedGrid) { const bar = (lockedGrid.beatUs * P.BEATS_PER_BAR) / US, o = lockedGrid.originUs / US; return out.map((a) => ({ ...a, E: o + Math.round((a.E - o) / bar) * bar, kind: a.kind + "->locked bar line" })).filter((a, i, arr) => arr.findIndex((b) => Math.abs(b.E - a.E) < 1e-6) === i); }
    return out; };
  // Walk backwards bar by bar from each END anchor. Each bar may shift its local phase a little (slow drift / rubato tolerance);
  // raw times are never moved. The phrase is the maximal recent run of bars that the grid explains; noodling breaks the run.
  for (const T of tempi) for (const anc of endAnchors(T)) {
    const bpm = 60 / T; const sig = P.SIGMA_ABS_S + P.SIGMA_REL * T; const barLen = T * P.BEATS_PER_BAR;
    const bars = []; let E = anc.E, shift = 0, empties = 0;
    for (let j = 0; j < 8; j++) {
      const bEnd = E - j * barLen + shift; let best = null;
      for (const d of lockedGrid ? [0] : [-0.05, -0.025, 0, 0.025, 0.05]) { const bS = bEnd - barLen * (1 + d);
        const inBar = recent.filter((g) => g.t >= bS - sig && g.t < bEnd - sig); if (!inBar.length) { if (!best) best = { bS, d, fit: null, off: 0, n: 0, inBar, onDown: false }; continue; }
        const gf = gridFit(inBar, bS, (bEnd - bS) / P.BEATS_PER_BAR, P.BEATS_PER_BAR, 0); const off = gf.perGroup.filter((x) => x < P.OFFGRID).length / inBar.length;
        const onDown = inBar.some((g) => Math.abs(g.t - bS) <= sig * 1.5); const q = gf.fit - P.OFFGRID_PEN * off + (onDown ? 0.1 : 0) - Math.abs(d) * 1.5;
        if (!best || best.fit === null || q > best.q) best = { bS, d, fit: gf.fit, off, n: inBar.length, inBar, onDown, q }; }
      const sounding = recent.some((g) => g.t < best.bS && g.snd > best.bS + barLen * 0.5);
      if (best.fit === null) { if (!sounding && ++empties > 1) break; bars.push({ ...best, ok: true, empty: true }); shift += 0; continue; }
      const ok = best.fit >= P.ABSTAIN_FIT && best.off <= 0.25; if (!ok) break; bars.push({ ...best, ok }); shift = best.bS - (bEnd - barLen); // carry the local phase
    }
    while (bars.length && bars[bars.length - 1].empty) bars.pop();
    const run = bars.length; if (!run) continue;
    for (const N of P.BARS) { if (N > run) continue; const use = bars.slice(0, N); const S = use[N - 1].bS; const win = use.flatMap((b) => b.inBar);
      if (win.length < P.MIN_GROUPS || E - S < P.MIN_SPAN_S) continue;
      const fits = use.filter((b) => !b.empty); const fit = fits.reduce((x, b) => x + b.fit, 0) / Math.max(1, fits.length); const off = fits.reduce((x, b) => x + b.off, 0) / Math.max(1, fits.length);
      const sup = use.filter((b) => b.onDown).length / N; const startGroup = use[N - 1].onDown;
      const rep = N >= 2 ? repetition(win, S, (E - S) / 2) : 0; const maximal = N === Math.max(...P.BARS.filter((x) => x <= run));
      const endOk = anc.kind.startsWith("final") ? 0.15 : Math.abs(Math.min(last.snd, press) - E) < 0.75 * T ? 0.1 : 0;
      const score = fit - P.OFFGRID_PEN * off + 0.3 * sup + (startGroup ? 0.15 : -0.05) + endOk + 0.15 * rep + (maximal ? 0.25 : 0) + (P.BAR_PRIOR[N] ?? 0)
        - P.TEMPO_PRIOR * Math.abs(Math.log2(bpm / P.TEMPO_CENTER_BPM)) - (bpm < 60 || bpm > 180 ? 0.3 : 0);
      cands.push({ S, E, T, bpm, bars: N, run, drift: use.reduce((x, b) => x + b.d, 0) / N, anchor: anc.kind, fit, off, sup, rep, startGroup, score, nGroups: win.length });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const alts = []; for (const c of cands) { if (alts.some((a) => Math.abs(a.S - c.S) < 0.2 && Math.abs(a.E - c.E) < 0.2)) continue; alts.push(c); if (alts.length >= 4) break; }
  const best = alts[0];
  const coverageOf = (c) => { const sig = P.SIGMA_ABS_S + P.SIGMA_REL * c.T; const inWin = recent.filter((g) => g.t >= c.S - sig && g.t < c.E - sig);
    const pick = recent.filter((g) => g.t < c.S - sig && g.t >= c.S - 1.25 * c.T); const pickups = pick.filter((g) => { const i = recent.indexOf(g); return i === 0 || g.t - recent[i - 1].t > 0.75 * c.T; });
    const tails = recent.filter((g) => g.t >= c.E - sig && g.t <= c.E + sig * 2);
    return { from: Math.min(c.S, ...pickups.map((g) => g.t)), to: c.E, groups: [...pickups, ...inWin].map((g) => g.t), pickups: pickups.map((g) => g.t), tails: tails.map((g) => g.t) }; };
  if (!best || best.fit < P.ABSTAIN_FIT) {
    // FREE-TIME fallback: latest strong boundary (sounding silence + IOI/register change), bounded; never one group, never the whole session
    const bScore = (i) => { const g = recent[i], p = recent[i - 1]; if (!p) return 0; const silence = Math.max(0, g.t - Math.max(...recent.slice(Math.max(0, i - 6), i).map((x) => x.snd)));
      const ioiPrev = i > 1 ? p.t - recent[i - 2].t : 0, ioi = g.t - p.t; const rIoi = ioiPrev + ioi ? Math.abs(ioi - ioiPrev) / (ioi + ioiPrev) : 0; const reg = Math.min(1, Math.abs(g.pitch - p.pitch) / 12);
      return silence + 0.5 * rIoi + 0.3 * reg; };
    let bi = -1, bs = -1; for (let i = 1; i < recent.length; i++) { const g = recent[i]; if (press - g.t > P.FREE_MAX_S) continue; if (recent.length - i < 4 || last.snd - g.t < P.FREE_MIN_S) continue; const s = bScore(i); if (s > bs) { bs = s; bi = i; } }
    const startT = bi >= 0 ? recent[bi].t : Math.max(recent[0].t, press - 12); const grp = recent.filter((g) => g.t >= startT);
    reasons.push(best ? "no beat grid explains the attacks well enough (best fit " + (best.fit < 0.45 ? "poor" : "weak") + "), so no tempo is proposed" : "no grid candidate had enough material");
    reasons.push("free-time window starts at the strongest recent boundary (" + (bs > 0.8 ? "a sounding silence" : "a change in spacing/register") + ") and ends with the last sounding note");
    return { mode: "free", coverage: { from: startT, to: Math.min(last.snd, press), groups: grp.map((g) => g.t), pickups: [], tails: [] }, period: null, alternatives: alts.slice(0, 3).map((c) => ({ ...c, coverage: coverageOf(c) })), reasons };
  }
  reasons.push(best.bars + " bars at about " + best.bpm.toFixed(0) + " bpm (one reading; half/double kept as alternatives)", best.anchor.startsWith("final") ? "the last attack reads as the next downbeat: it is kept as a tail, not inside the loop" : "the loop ends where the last notes stop sounding, on the beat grid",
    best.startGroup ? "an attack lands on the start downbeat" : "no attack on the start downbeat (pickup or syncopation)");
  return { mode: lockedGrid ? "locked-grid" : "proposed-grid", period: { S: best.S, E: best.E, bars: best.bars, bpm: best.bpm, drift: best.drift }, coverage: coverageOf(best), alternatives: alts.slice(1, 4).map((c) => ({ ...c, coverage: coverageOf(c) })), reasons };
}
// ---------- current main transcription ----------
function mainPredict(doc, withGrid, fn = recentPhraseCut) {
  const ev = doc.events.map((e) => ({ ...e, scheduleElapsed: BigInt(e.scheduleElapsed), sequence: BigInt(e.sequence) }));
  const beatUs = doc.lockedGrid ? doc.lockedGrid.beatUs : Math.round((60 / doc.trueBpm) * US);
  const cut = fn(ev, { ticksPerSecond: US, gridPeriodTicks: withGrid ? BigInt(beatUs) : null, gridOriginTicks: withGrid && doc.lockedGrid ? BigInt(doc.lockedGrid.originUs) : null, historyMayBeTruncated: false });
  const a = Number(cut.selection.start) / US, b = Number(cut.selection.end) / US; return { status: cut.status, from: a, to: b };
}
// ---------- scoring (same coverage metric for every predictor) ----------
function classify(doc, includedTimes) {
  const G = doc.expected.groups; const inc = new Set(includedTimes.map((t) => Math.round(t * 1000)));
  const isIn = (g) => inc.has(Math.round(g.onUs / 1000));
  const ph = G.filter((g) => g.tag === "phrase" || g.tag === "pickup"), nd = G.filter((g) => g.tag === "noodle");
  const rec = ph.filter(isIn).length / ph.length, nIn = nd.filter(isIn).length;
  const cat = ph.length >= 3 && ph.filter(isIn).length <= Math.max(1, Math.floor(ph.length * 0.25)) ? "FINAL_TRAP" : nd.length && nIn / nd.length > 0.5 ? "WHOLE_TRAP" : rec >= 0.9 && nIn <= 1 ? "GOOD" : "PARTIAL";
  return { cat, recall: rec, noodleIncluded: nIn + "/" + nd.length };
}
function periodMatch(doc, period, T) { if (!period) return null; const tolS = 0.3 * (60 / doc.trueBpm);
  const m = (x) => Math.abs(period.S - x.startUs / US) <= tolS && Math.abs(period.E - x.endUs / US) <= tolS;
  if (m(doc.expected.period)) return "DEFAULT"; if (doc.expected.acceptable.some(m)) return "ALTERNATIVE"; return "OTHER"; }
const dir = path.join(DATA, SET); const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const tally = { ref: {}, refPeriod: {}, mainFree: {}, mainGrid: {}, m497: {}, m341: {} }; const rows = [];
const inc = (o, k) => (o[k] = (o[k] ?? 0) + 1);
for (const f of files) {
  const doc = JSON.parse(fs.readFileSync(path.join(dir, f)));
  const evN = doc.events.map((e) => ({ ...e, scheduleElapsed: Number(e.scheduleElapsed) }));
  const r = referencePredict(evN, doc.pressUs, doc.lockedGrid);
  const rc = classify(doc, r.coverage.groups ?? []);
  let pm = r.mode === "free" ? (doc.expected.freeTimeExpected ? "DEFAULT(free)" : doc.expected.freeTimeOk ? "ALTERNATIVE(free)" : "ABSTAINED") : (periodMatch(doc, r.period) ?? `NO_PERIOD(${r.mode})`);
  if (r.mode !== "free" && doc.expected.freeTimeExpected) pm = pm === "OTHER" ? "OTHER(expected free)" : pm + "(expected free)";
  const altHit = r.mode === "free" ? r.alternatives.some((c) => periodMatch(doc, c) === "DEFAULT") : r.alternatives.some((c) => periodMatch(doc, c) === "DEFAULT");
  const groupsAt = (a, b) => doc.expected.groups.filter((g) => g.onUs / US >= a - 1e-6 && g.onUs / US <= b + 1e-6).map((g) => g.onUs / US);
  const mf = mainPredict(doc, false), mg = mainPredict(doc, true);
  const mfc = classify(doc, groupsAt(mf.from, mf.to)), mgc = classify(doc, groupsAt(mg.from, mg.to));
  const m3 = mainPredict(doc, !!doc.lockedGrid, recentPhraseCut341); const m3c = classify(doc, groupsAt(m3.from, m3.to)); inc(tally.m341, m3c.cat);
  // 497894e: beatForCut() means a proposed tempo is not a beat until accepted, so a first layer is cut in free time; a locked grid is passed
  const m4 = mainPredict(doc, !!doc.lockedGrid, recentPhraseCut497); const m4c = classify(doc, groupsAt(m4.from, m4.to)); inc(tally.m497, m4c.cat);
  inc(tally.ref, rc.cat); inc(tally.refPeriod, pm.split("(")[0]); inc(tally.mainFree, mfc.cat); inc(tally.mainGrid, mgc.cat);
  rows.push({ id: doc.id, ref: { mode: r.mode, bars: r.period?.bars ?? null, bpm: r.period ? +r.period.bpm.toFixed(1) : null, S: r.period ? +r.period.S.toFixed(2) : null, E: r.period ? +r.period.E.toFixed(2) : null, cov: rc, period: pm, defaultInAlternatives: altHit, reasons: r.reasons },
    expected: { S: doc.expected.period.startUs / US, E: doc.expected.period.endUs / US, bars: doc.expected.period.bars, bpm: doc.trueBpm }, mainFree: { ...mfc, status: mf.status }, mainGrid: { ...mgc, status: mg.status }, main497: { ...m4c, status: m4.status }, main341: { ...m3c, status: m3.status } });
}
console.log(`== Phrase capture on ${(process.env.SET_LABEL ? "VALIDATION" : SET.toUpperCase())} fixtures (SYNTHETIC, provisional labels; not Haris's MIDI)${SET === "tuning" ? " [IN-SAMPLE for the reference]" : process.env.SET_LABEL ? " [" + process.env.SET_LABEL + "]" : " [REGRESSION/DEVELOPMENT SET (formerly holdout): it has influenced design discussion, so it is no longer a fresh holdout]"}`);
console.log("coverage categories: GOOD = >=90% of intended-phrase groups and <=1 unrelated earlier group; FINAL_TRAP = <=25% of a longer (>=3-group) intended phrase; WHOLE_TRAP = >50% of UNRELATED earlier material. A single-event or whole-session selection is GOOD when that IS the intended phrase");
console.log("reference coverage:", JSON.stringify(tally.ref), "| reference period:", JSON.stringify(tally.refPeriod));
console.log("main-fdba348 free time (no tempo passed):", JSON.stringify(tally.mainFree), "| main-fdba348 with the true beat passed as a grid (= a proposed tempo at fdba348):", JSON.stringify(tally.mainGrid));
console.log("main-497894e as App calls it (free time unless the fixture has a locked grid):", JSON.stringify(tally.m497));
console.log("main-3412f61 (CURRENT baseline) as App calls it (beatForCut: locked grid only):", JSON.stringify(tally.m341));
for (const x of rows) console.log(`  ${x.id.padEnd(44)} REF ${x.ref.mode.padEnd(13)} ${x.ref.bars ? x.ref.bars + "bar@" + x.ref.bpm : "free".padEnd(9)} ${x.ref.cov.cat.padEnd(10)} period=${x.ref.period.padEnd(20)} | expected ${x.expected.bars}bar@${x.expected.bpm} | fdba348 free ${x.mainFree.cat.padEnd(10)} grid ${x.mainGrid.cat.padEnd(10)} | 497894e ${x.main497.cat.padEnd(10)} | 3412f61 ${x.main341.cat}`);
if (process.argv.includes("--detail")) console.log(JSON.stringify(rows, null, 1));
const outJ = process.argv.indexOf("--json"); if (outJ > 0) fs.writeFileSync(process.argv[outJ + 1], JSON.stringify({ set: SET, tally, rows }, null, 1));
