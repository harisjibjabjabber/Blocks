// Legato/run collapse check + evaluation of the revised grouping CANDIDATE (attack-onset distinction). SYNTHETIC; research only.
// (1) stacks3412: own JS transcription of overlapStacks() in Blocks 3412f61 src/domain/recent-phrase.ts L157-206 (a new stack starts only when no note is
//     alive; a note stays alive while held, or after release while CC64 is down). Used only to count groups; not shipped code.
// (2) refGroups: the existing reference grouping (GROUP_STEP 70 ms chained, GROUP_MAX 160 ms) from evaluate-phrase.mjs.
// (3) candidate: attack-onset grouping; sounding overlap is REQUIRED but never sufficient.
//     note j joins the open group iff  (a) gap from the previous attack <= min(ABS_MAX, REL * the larger of the IOIs that bound the group),
//     (b) the previous group note is still sounding (key or CC64) at j's attack, and (c) the group would not become a monotonic stepwise line
//     (>=3 notes, same direction, every step <= 2 semitones). ABS_MAX 130 ms and REL 0.4 are UNVALIDATED proposals chosen a priori, not fitted.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { analyseEvents } from "./evaluate-phrase.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ABS_MAX = 0.13, REL = 0.4;
function stacks3412(events) { let pedal = false; const notes = [], stacks = []; const alive = () => notes.some((n) => n.alive);
  for (const e of events) { const t = Number(e.scheduleElapsed) / 1e6;
    if (e.kind === "cc" && e.controller === 64) { const was = pedal; pedal = e.value >= 64; if (was && !pedal) for (const n of notes) if (n.released) n.alive = false; continue; }
    const key = e.channel + ":" + e.note;
    if (e.kind === "note-off" || (e.kind === "note-on" && e.velocity === 0)) { const n = notes.find((x) => x.alive && x.key === key && !x.released); if (n) { n.released = true; if (!pedal) n.alive = false; } continue; }
    if (e.kind === "note-on") { if (!alive()) { notes.length = 0; stacks.push({ t, ids: [] }); } stacks[stacks.length - 1].ids.push(e.id); notes.push({ key, released: false, alive: true }); } }
  return stacks.map((s) => s.ids); }
function candidate(events) { const { notes } = analyseEvents(events); const ids = events.filter((e) => e.kind === "note-on" && e.velocity > 0).sort((a, b) => Number(a.scheduleElapsed) - Number(b.scheduleElapsed) || Number(a.sequence) - Number(b.sequence)).map((e) => e.id);
  notes.forEach((n, i) => (n.id = ids[i])); const on = notes.map((n) => n.on); const groups = []; let g = null;
  const mono = (ps) => { if (ps.length < 3) return false; const d = ps.slice(1).map((p, i) => p - ps[i]); return d.every((x) => x > 0 && x <= 2) || d.every((x) => x < 0 && x >= -2); };
  for (let i = 0; i < notes.length; i++) { const n = notes[i];
    if (g) { const prev = notes[i - 1]; const gap = n.on - prev.on; const before = g.start > 0 ? on[g.start] - on[g.start - 1] : Infinity;
      let k = i + 1; while (k < notes.length && notes[k].on - notes[k - 1].on <= ABS_MAX) k++; const after = k < notes.length ? notes[k].on - notes[k - 1].on : Infinity; // IOI that closes the would-be group
      const ctx = Math.min(before, after); const win = Math.min(ABS_MAX, REL * (Number.isFinite(ctx) ? ctx : 1));
      const sounding = prev.snd > n.on; const ps = [...g.notes.map((x) => x.note), n.note];
      if (gap <= win && sounding && !mono(ps)) { g.notes.push(n); continue; } }
    g = { start: i, notes: [n] }; groups.push(g); }
  return groups.map((x) => x.notes.map((n) => n.id)); }
function refIds(ev) { const ids = ev.filter((e) => e.kind === "note-on" && e.velocity > 0).sort((a, b) => Number(a.scheduleElapsed) - Number(b.scheduleElapsed) || Number(a.sequence) - Number(b.sequence)).map((e) => e.id); const A = analyseEvents(ev); return A.groups.map((g) => g.notes.map((n) => ids[A.notes.indexOf(n)])); }
function truth(doc) { const gs = doc.expected.groups.map((g) => ({ ...g, ids: [] })).sort((a, b) => a.onUs - b.onUs);
  for (const e of doc.events) if (e.kind === "note-on" && e.velocity > 0) { const t = Number(e.scheduleElapsed); let best = null; for (const g of gs) if (g.onUs <= t + 1000) best = g; (best ?? gs[0]).ids.push(e.id); }
  return gs.filter((g) => g.ids.length); }
function score(tr, pred) { const key = (a) => [...a].sort().join(","); const P = new Set(pred.map(key)); const exact = tr.filter((g) => P.has(key(g.ids))).length;
  const merged = pred.filter((p) => new Set(p.map((id) => tr.findIndex((g) => g.ids.includes(id)))).size > 1); const maxMerge = Math.max(0, ...merged.map((p) => new Set(p.map((id) => tr.findIndex((g) => g.ids.includes(id)))).size));
  const split = tr.filter((g) => !pred.some((p) => g.ids.every((id) => p.includes(id)))).length; return { n: pred.length, exact, merged: merged.length, maxMerge, split }; }
const sets = [["regression", path.join(HERE, "data", "holdout")], ["validation", path.join(HERE, "data-validation", "validation")], ["diag-post", path.join(HERE, "data-validation", "diagnostic-post-freeze")]]; const out = [];
for (const [set, dir] of sets) for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) { const doc = JSON.parse(fs.readFileSync(path.join(dir, f))); const ev = doc.events;
  const tr = truth(doc); const row = { set, id: doc.id, truthGroups: tr.length, s3412: score(tr, stacks3412(ev)), ref: score(tr, refIds(ev)), cand: score(tr, candidate(ev)) }; out.push(row); }
const fmt = (s) => `${String(s.n).padStart(3)} grp, exact ${String(s.exact).padStart(2)}, merged ${String(s.merged).padStart(2)} (max ${s.maxMerge}), split ${s.split}`;
console.log("set | fixture | truth groups | 3412f61 overlapStacks | reference 70/160 ms | candidate attack-onset");
for (const r of out) console.log(`${r.set.padEnd(10)} ${r.id.padEnd(44)} ${String(r.truthGroups).padStart(3)} | ${fmt(r.s3412)} | ${fmt(r.ref)} | ${fmt(r.cand)}`);
const tot = (k) => out.reduce((a, r) => ({ exact: a.exact + r[k].exact, merged: a.merged + r[k].merged, split: a.split + r[k].split }), { exact: 0, merged: 0, split: 0 }); const T = out.reduce((a, r) => a + r.truthGroups, 0);
console.log(`TOTAL truth groups ${T} | 3412f61 ${JSON.stringify(tot("s3412"))} | reference ${JSON.stringify(tot("ref"))} | candidate ${JSON.stringify(tot("cand"))}`);
if (process.argv[2] === "--json") fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
