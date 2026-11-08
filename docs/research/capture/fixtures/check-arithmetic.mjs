// Checks every labelled loop in a fixture set: BPM x bars x seconds must agree.
// Run: node check-arithmetic.mjs [data|data-holdout]   (no predictor is run)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(HERE, process.argv[2] ?? "data");
const NS = 1e9; let bad = 0, n = 0;
const dur = (L, bpb) => (L.lengthBars * (L.beatsPerBar ?? bpb) * 60) / L.bpm;
for (const fn of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json").sort()) {
  const f = JSON.parse(fs.readFileSync(path.join(dir, fn)));
  for (const [i, st] of f.steps.entries()) {
    const e = st.expected, d = e.default, g = st.context.projectGrid;
    const bpb = d?.loop?.beatsPerBar ?? g?.beatsPerBar ?? 4;
    const issues = [];
    if (d?.loop?.bpm) {
      n++;
      if (d.loop.barNs !== undefined && Math.abs(d.loop.barNs - (bpb * 60 / d.loop.bpm) * NS) > 1e3) issues.push("barNs != beatsPerBar*60/bpm");
      const D = dur(d.loop, bpb);
      for (const a of e.acceptable ?? []) if (a.loop?.bpm && a.loop.lengthBars) { n++; const A = dur(a.loop, bpb); if (Math.abs(A - D) > 1e-6) issues.push(`acceptable "${a.label}" lasts ${A.toFixed(3)} s but default lasts ${D.toFixed(3)} s`); }
    }
    if (g?.bpm && d?.startBar !== undefined && d.startNs !== undefined) {
      n++; const unit = (g.beatsPerBar * 60 / g.bpm) * NS;
      const s0 = g.projectOriginNs + d.startBar * unit, s1 = s0 + d.lengthBars * unit;
      if (Math.abs(s0 - d.startNs) > 1e3 || Math.abs(s1 - d.endNs) > 1e3) issues.push(`bar range ${d.startBar}+${d.lengthBars} != startNs/endNs`);
    }
    if (g && !g.bpm && g.freeCycleNs && d?.startCycle !== undefined && d.startNs !== undefined) {
      n++; const s0 = g.projectOriginNs + d.startCycle * g.freeCycleNs;
      if (Math.abs(s0 - d.startNs) > 1e3 || Math.abs(s0 + d.lengthCycles * g.freeCycleNs - d.endNs) > 1e3) issues.push("cycle range != startNs/endNs");
    }
    if (d?.startNs !== undefined && d.startNs > st.captureAtNs) issues.push("default starts after capture");
    if (issues.length) { bad++; console.log("ISSUE", f.id, "step", i, issues.join("; ")); }
  }
}
console.log(`${path.basename(dir)}: ${n} arithmetic checks, ${bad} step(s) with issues`);
