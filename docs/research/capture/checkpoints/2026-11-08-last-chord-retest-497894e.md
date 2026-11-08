# Checkpoint: last-chord retest at 497894e (archived 8 Nov 2026, about 19:55 London)

- **Source:** an external implementation report, outside this repository. **Not readable at audit time** ("File not found"). An earlier external finding was also not found. The machine path was omitted from this checkout.
- **Update (about 20:01 London):** the report is now `handover-evidence/implementation-report-497894e-rolled-chord-retest.md` (sha256 6a02b535…8d6f). The checkpoint author read it. Its stored ranges for tight and rolled chords were **reproduced exactly** by executing the read-only 497894e `recentPhraseCut` on that author's reconstruction of the described history (`fixtures/phrase/verify-retest-3412f61.mjs`; `retest-reproduction-497894e-3412f61.txt`). That run was not repeated for this import. 497894e is **historical**; the current research baseline is 3412f61 (`2026-11-08-baseline-3412f61.md`).
- **Claims relayed (originally unverified; see update):**
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
- **What I did not verify:** the bundle name or contents, the scheduler claim, and the device behaviour. (Stored-range selection: now verified, see update.)
- **My synthetic check** (`phrase-results.txt`): PH13-15 have rolls of 60-120 ms between notes. 497894e (historical, not current main) gives WHOLE_TRAP (no pedal), WHOLE_TRAP (pedal) and FINAL_TRAP (locked grid) on the regression/development set. This is consistent with the relayed roll finding. It is not Haris's MIDI.
