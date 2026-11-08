# Blocks Capture: product research and spec (Capture & Timing)

SYNTHETIC fixtures and research only. No app code was changed by this research package. 8 Nov 2026, revised after the lead review (decisions D1-D9 in `capture-spec.md` §0). Code references were re-checked at Blocks main `534279f`; later Capture commits are a different cut. See `../../handover/README.md`. Do not read "today" in these files as the live Pages build.

Checkout notes for this import:

- The phrase-capture comparison baseline is `fdba348124d4cefe6fbeba2a7c187e47de705528` and `497894e170ac150f06e5a8bea34d0d4e7f34e2fd`. It does not evaluate `3412f612fe5f5f8d818ec50ad62ab9cd2a3cab3e`.
- `historical/fdba348/recent-phrase.ts` and `historical/497894e/recent-phrase.ts` are git extracts so `fixtures/phrase/evaluate-phrase.mjs` has a path. They were not in the research archive. The harness was not rerun. The reference predictor is not ready to ship: on its synthetic labels the right default loop length was 3 of 15, with 2 further acceptable alternatives. Proposed adaptive thresholds and the fallback have not been evaluated. Do not copy the handoff pseudocode into the app.
- `historical/534279f/recent-phrase.ts` is git blob `93292fe449865871f63df08766b7f57ec823e2c7`, the same object at `fadfdcf`. It is not the `fdba348` or `497894e` cut.
- `capture-spec.md` cites `capture-contract-v1.md`. That file was not in the snapshot and not in the durable notes.
- `handover-evidence/` holds two synthetic implementation reports. They are not Haris's take. The 3412f61 report is progress on a later commit, not the research baseline and not a solved Capture.

## Files

- `capture-spec.md`: the product and algorithm spec: journey, components with TS contracts, policies, abstention UI, milestones, parameters, open decisions
- `prototype-findings.md`: what the current repo/live capture does (file and line) and the M0 fix
- `evaluation-plan.md`: metrics, fixture matrix, human session protocol, harness smoke results
- `source-ledger.md`: every source with URL, licence, version and evidence class
- `fixtures/`: `generate.mjs` (18 SYNTHETIC sessions, 22 capture steps), `evaluate.mjs` (validator + scorer + reference M0), `data/`
- `musician-review.md`: 11 ambiguous examples in plain language for Haris (non-blocking)
- `fixtures/generate-holdout.mjs`, `fixtures/data-holdout/`: HOLDOUT set (never used for tuning)
- `fixtures/check-arithmetic.mjs`: BPM × bars × seconds checker
- `evaluation-smoke-results.txt|json` (tuning) and `evaluation-holdout-results.txt|json` (holdout): harness output (synthetic; not accuracy claims)


## Added 8 Nov 2026 evening (priority: core phrase capture)
- `phrase-capture-handoff.md`: **the handoff for the coding project** (recommendation, root cause with file:line at fdba348/497894e, pseudocode, interfaces, parameters, acceptance examples, tests).
- `phrase-results.txt` and `phrase-results-{tuning,holdout}.json`: synthetic results (reference vs main-fdba348 vs main-497894e).
- `fixtures/phrase/generate-phrase.mjs`, `fixtures/phrase/evaluate-phrase.mjs`, `fixtures/phrase/data/{tuning,holdout}`: 6 tuning and 15 holdout fixtures.
- `source-audit-2026-11-08.md`: claim audit and source-lead verification. Linked from `source-ledger.md` §F.
- `checkpoints/2026-11-08-last-chord-retest-497894e.md`: retest provenance.
- `harmony-analysis-STAGED-DRAFT.md`, `fixtures/generate-harmony.mjs`, `fixtures/evaluate-harmony.mjs`, `fixtures/score-harmony-mireval.py`, `evaluation-harmony-results.{txt,json}`: paused harmony draft.
- `fixtures/repro-four-chords.mjs` and `repro-four-chords-results.txt`: an earlier hypothesis check run on the recent-phrase.ts copy **as of 534279f/fadfdcf** (not fdba348 or 497894e).
