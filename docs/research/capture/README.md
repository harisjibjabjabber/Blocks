# Blocks Capture: product research and spec (Capture & Timing)

SYNTHETIC fixtures and research only. No app code was changed by this research package. 8 Nov 2026, revised after the lead review (decisions D1-D9 in `capture-spec.md` §0). Code references were re-checked at Blocks main `534279f`; later Capture commits are a different cut. See `../../handover/README.md` for what is implemented, broken, and still open. Do not read "today" in these files as the live Pages build.

Checkout notes for this import:

- `historical/534279f/recent-phrase.ts` is a byte copy of git blob `93292fe449865871f63df08766b7f57ec823e2c7`. That blob is `src/domain/recent-phrase.ts` at both `534279f` and `fadfdcf`. The snapshot did not contain the file; it was taken from this repository's git history so the harness has a path. It differs from `fdba348` and from `497894e`. A historical repro is not evidence against those commits or the current pipeline. The harness was not rerun for this import.
- `capture-spec.md` cites `capture-contract-v1.md`. That file was not in the snapshot and not in the durable notes. Its contents are not invented here.
- `capture-spec.md` points at `prototype-findings.md` sections 7 and 8. The imported findings file ends at section 6.

- `capture-spec.md`: the product and algorithm spec: journey, components with TS contracts, policies, abstention UI, milestones, parameters, open decisions
- `prototype-findings.md`: what the current repo/live capture does (file and line) and the M0 fix
- `evaluation-plan.md`: metrics, fixture matrix, human session protocol, harness smoke results
- `source-ledger.md`: every source with URL, licence, version and evidence class
- `fixtures/`: `generate.mjs` (18 SYNTHETIC sessions, 22 capture steps), `evaluate.mjs` (validator + scorer + reference M0), `data/`
- `musician-review.md`: 11 ambiguous examples in plain language for Haris (non-blocking)
- `fixtures/generate-holdout.mjs`, `fixtures/data-holdout/`: HOLDOUT set (never used for tuning)
- `fixtures/check-arithmetic.mjs`: BPM × bars × seconds checker
- `evaluation-smoke-results.txt|json` (tuning) and `evaluation-holdout-results.txt|json` (holdout): harness output (synthetic; not accuracy claims)
