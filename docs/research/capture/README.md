# Blocks Capture: product research and spec (Capture & Timing)

SYNTHETIC fixtures and research only. No app code was changed by this research package. 8 Nov 2026. See `../../handover/README.md`. Do not read "today" or "current main" in the older paragraphs as the live site.

Checkout notes for this import:

- The current research baseline is `3412f612fe5f5f8d818ec50ad62ab9cd2a3cab3e`. Comparisons to `fdba348124d4cefe6fbeba2a7c187e47de705528` and `497894e170ac150f06e5a8bea34d0d4e7f34e2fd` are historical.
- `phrase-results-holdout.json` is a supersession note. The old bytes are only in `phrase-results-holdout-SUPERSEDED.json`. PH01–15 are regression cases, not fresh holdout evidence. Current regression outputs are `phrase-results-regression.*`.
- Keep baseline metrics (`phrase-results-validation.json`, `phrase-results-regression.json`) distinct from candidate metrics (`*-candidate.json`). The candidate is not validated and is not the app.
- `historical/3412f61/`, `historical/fdba348/`, and `historical/497894e/` are git extracts. The archive did not include those copies. The harness was not rerun.
- Last-chord Capture is unresolved. The live script remains `/Blocks/assets/index-CsEdtvjV.js` until a later behavior commit says otherwise.


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
- `phrase-results.txt`: index of phrase results, labelled **per commit** (fdba348 and 497894e historical; **3412f61 current main**).
- `phrase-results-tuning.*`, `phrase-results-regression.*` (PH01-15, the **regression/development set**, formerly "holdout"), `phrase-results-validation.*` (V01-13 independent validation set), `*-candidate.json` (reference with the candidate grouping). `phrase-results-holdout.json` is superseded.
- `fixtures/phrase/generate-phrase.mjs`, `fixtures/phrase/evaluate-phrase.mjs`, `fixtures/phrase/data/{tuning,holdout}`: 6 tuning and 15 regression/development fixtures (folder name kept).
- `source-audit-2026-11-08.md`: claim audit and source-lead verification. Linked from `source-ledger.md` §F.
- `checkpoints/2026-11-08-last-chord-retest-497894e.md`: retest provenance (updated: evidence file read, stored ranges reproduced).

## Added 8 Nov 2026, about 20:00 (baseline 3412f61)
- `checkpoints/2026-11-08-baseline-3412f61.md`: current-main source, hashes, verified vs not verified.
- `fixtures/phrase/generate-validation.mjs` (new generator, seed 20261108) and `fixtures/phrase/data-validation/{validation,FREEZE.txt}`: 13-case independent validation set, frozen 19:57:01 GMT before any predictor ran. `data-validation/diagnostic-post-freeze/D01.json`: post-freeze diagnostic, not scored as validation.
- `fixtures/phrase/grouping-check.mjs`, `grouping-results.{txt,json}`: legato/run collapse check and candidate attack-onset grouping.
- `fixtures/phrase/verify-retest-3412f61.mjs`, `retest-reproduction-497894e-3412f61.txt`: re-execution of the implementation team's described retest.
- `evaluate-phrase.mjs` now scores 3412f61 (as App calls it), uses conditional trap definitions, and supports `GROUPING=candidate`.
- `harmony-analysis-STAGED-DRAFT.md`, `fixtures/generate-harmony.mjs`, `fixtures/evaluate-harmony.mjs`, `fixtures/score-harmony-mireval.py`, `evaluation-harmony-results.{txt,json}`: paused harmony draft.
- `fixtures/repro-four-chords.mjs` and `repro-four-chords-results.txt`: an earlier hypothesis check run on the recent-phrase.ts copy **as of 534279f/fadfdcf** (not fdba348 or 497894e).
