# Cumulative Capture research delta: baseline 3412f61

Copy window 2026-11-08 20:04:42–20:04:42 Europe/London (GMT).
Base: original snapshot 20261108-194317/MANIFEST.json, SHA256 `a00cc68081b1299b543dc1bb24b88e83f922c956164f77ca98625a7ab3a89491`.
Parent-reported previous GitHub archival commit: `328a7f643eaa01fbbc8a01650ddb6c246ba510c8` on `handover/status`. Not independently inspected here.

Apply current `blocks-capture-product/` files as a cumulative overlay on the original base. This supersedes the earlier 19:54 Capture delta where paths overlap, retaining its completed research artifacts and exact implementation reports. The prior delta's snapshot note remains historical, not current baseline guidance.

## Scope and evidence
64 actual current changed/new source files relative to the original base: baseline3412f61 checkpoint, updated older checkpoint/readme/spec/audit/handoff/evaluator; phrase tuning/regression/validation results including candidate JSON; grouping results; retest reconstruction output; validation/grouper/retest scripts, frozen validation files and separate diagnostic; prior synthetic fixtures/scorers and documentation changes.
Completed research checkpoint only. No generators, browser tasks or tests run by packaging. No external /workspace/research source copies, repository clone, repository inspection, writes or uploads. No partial future-work files identified. Local sources unmodified.

## Mandatory supersession handling for repository overlay
The old prior GitHub path `blocks-capture-product/phrase-results-holdout.json` is ABSENT locally and is now `blocks-capture-product/phrase-results-holdout-SUPERSEDED.json` (historical output). The old file was introduced in the earlier delta, not the original base; simple ZIP overlay cannot remove it.
Parent/cloud project MUST either (a) retain old filename only with an unmistakable historical/superseded label or accompanying supersession note pointing to the new regression outputs, or (b) replace it with a supersession note and retain historical data in -SUPERSEDED.json. Do not leave two apparently fresh holdout claims. No deletion is performed or implied by this packaging task.
PH01–15 are now regression/development cases because they influenced design discussion, NOT fresh holdout evidence. Latest outputs are phrase-results-regression.*. Older snapshot/delta notes are historical.

## Interpretation and caveats
Current research baseline: `3412f612fe5f5f8d818ec50ad62ab9cd2a3cab3e`; fdba348 and 497894e comparisons are historical. All fixtures/results remain SYNTHETIC and provisional; no claim Haris's bug was reproduced, fixed or user-validated. Proposal and candidate grouping are NOT READY TO SHIP.
Frozen V01–13 validation is independent of predictor tuning at freeze, NOT independent of its research designer or musician-reviewed ground truth. Keep FREEZE.txt and its original timestamp/hash. V10 has a known generator defect: its title implies pedal throughout noodling, but actual CC64 begins only at progression. Frozen V10 is deliberately unchanged and still separately reported. Post-freeze corrected D01 is an UNSCORED diagnostic, never part of validation aggregate scores.
Current3412f61 overlapStacks grouping regression: pedal-connected runs collapse (V05: 32 notes into one stack; diagnostic D01: 28 into one). This is distinct from selection coverage: D01 can still happen to get GOOD via an older fallback. Reference/candidate shortcomings and PARTIAL coverage must remain visible. Historical retest reconstruction validates selected synthetic cut ranges, not scheduler, Pages deployment or user's real performance.
Raw MIDI remains immutable; no forced quantise. Hardware and real-MIDI acceptance remain outstanding.

## Provenance / safety / limitations
Exact earlier implementation reports reused from shared /workspace/blocks-handover/evidence copies; hashes checked against prior PROVENANCE.json. Original private asset paths were NOT reopened. Existing provenance mapping retained. Specialist audit-time verified/not-verified statements remain unchanged as authored.
Each source copy re-read byte-identically during copying; bounded checkpoint, not atomic filesystem snapshot. Text credential-signature scan passed. No samples/browser state/credentials/.env/dependencies/chat transcripts bundled. External historical code imports remain a rerun dependency and are not bundled. No new tests are claimed.
ZIP paths/CRC/extracted bytes validated. Manifest provides old/current hashes and sizes; package manifest provides archive hash. Parent must inspect overlay precedence/supersession, commit via existing cloud project and verify commit/tree before claiming GitHub archival complete.
