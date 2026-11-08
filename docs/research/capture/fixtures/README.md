# Capture fixtures (SYNTHETIC)

All files in `data/` are **SYNTHETIC**. `generate.mjs` builds them from a seeded PRNG and hand-written musical intent. They aren't user data. The labels are the designer's intent and stay pending until a human jazz pianist confirms them. No accuracy claims are made.

- `node generate.mjs` writes the **TUNING** set to `data/` (generator v0.2.1, 18 fixtures, 22 steps). `m0Predict` was tuned on it, so its results there are in-sample.
- `node generate-holdout.mjs` writes the **HOLDOUT** set to `data-holdout/` (10 fixtures, 14 steps). It was written after `m0Predict` was frozen (hash `50c2c3c16c5d3077`) and is never used for tuning.
- `node --experimental-strip-types evaluate.mjs [--data data|data-holdout] [--json]` validates every fixture (label, set, order, seq, SHA-256 checksum, ranges), then scores `prototype-f62b2a5`, `m0-reference` and, if `../historical/534279f/recent-phrase.ts` exists, `recentPhraseCut()` from that file. The file in this checkout is git blob `93292fe449865871f63df08766b7f57ec823e2c7`, the same object at `534279f` and `fadfdcf`, and not the cut in `fdba348` or `497894e`. A run of it is not evidence about those later commits. These commands were not rerun for the handover import. The harness also checks derived pairing (retrigger policy) where a fixture declares counts.
- `node check-arithmetic.mjs [data|data-holdout]` checks BPM × bars × seconds for every labelled loop and alternative.
- Labels are **provisional (D9)** with no accuracy gate. `../musician-review.md` lists the ambiguous ones for Haris.
- The buffer policy in fixtures is the existing 120 s age bound (D8). "10 min / 200k" was a former proposal and isn't used.

Fixture schema (one session per file):
```
{ id, label: "SYNTHETIC…", synthetic: true, set: "tuning"|"holdout", title, stresses[], generator{script,version,seed},
  clockDomain: "synthetic-ns", timeUnit, bufferPolicy{maxAgeNs}, labelStatus, rawChecksum{algo,of,value},
  steps: [ { kind: "first-capture"|"layer-capture", part?, captureAtNs,
             context: { projectGrid: null | {bpm|null, projectOriginNs, beatsPerBar, freeCycleNs?}, playingLayers[] },
             expected: { mode, flags[], reasonCode?, default, acceptable[], unacceptable[], tempo, derivedChecks?, corrections?, loopPolicy?, projectAfter? } } ],
  events: [ { seq, tNs, src, port, ch, type: "on"|"off"|"cc"|"bend"|"cpress", d1, d2 } ] }
```
Note-on with `d2 = 0` is a note-off. Streams are `src|port|ch`. Bass layer = ch 2 and drums = ch 10 in journey fixtures. That's a fixture convention, not a product rule.
