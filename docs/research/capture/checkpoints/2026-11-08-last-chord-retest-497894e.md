# Checkpoint: last-chord retest at 497894e (archived 8 Nov 2026, about 19:55 London)

- **Source:** an external implementation report, outside this repository. **Not readable at audit time** ("File not found"). An earlier external finding was also not found. The machine path was omitted from this checkout. The report text that later became readable is `handover-evidence/implementation-report-497894e-rolled-chord-retest.md`.
- **Claims relayed (not verified by me):**
  - The tested commit is 497894e170ac150f06e5a8bea34d0d4e7f34e2fd.
  - The live bundle is index-CqMoO9xx.js.
  - Tight attacks after improvisation are preserved (synthetic).
  - Rolls with 60-120 ms between notes keep only F/G or the whole prefix, depending on pedal or grid.
  - This is not the user's exact last-G failure.
  - The scheduler plays all stored notes, so the loss is at stored-range selection.
  - The chord-run case (≥ 3 clusters of 2+ notes, 40 ms clustering) is fragile.
- **What I verified myself (read-only GitHub API):**
  - 497894e exists, committed 2026-11-08 19:43 London, one commit ahead of fdba348. Message: "Keep a four-chord run after an improvisation."
  - Files changed: recent-phrase.ts, project.ts (`beatForCut`), App.tsx and tests.
  - The chord-run code is at recent-phrase.ts L353-375 with `CHORD_MS = 40` (L48).
  - My local copy's git blob hash is 3742f05ed36e.
- **What I did not verify:** the bundle name or contents, the scheduler claim, and the device behaviour.
- **My synthetic check** (`phrase-results.txt`): PH13-15 have rolls of 60-120 ms between notes. main-497894e gives WHOLE_TRAP (no pedal), WHOLE_TRAP (pedal) and FINAL_TRAP (locked grid). This is consistent with the relayed roll finding. It is not Haris's MIDI.
