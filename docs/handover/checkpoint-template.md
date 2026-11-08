# Checkpoint template

Copy this at a milestone. Fill the blanks from the repository and from checks that were actually run. Write unknown rather than guessing. Do not promote a unit test or a visible control into delivery. Do not treat a design picture as a shipped screen.

This copy is the pin from `git fetch origin` on 8 Nov 2026. Re-fetch before the next checkpoint. Do not copy these SHAs forward without checking.

## Owner

The piano-roll component owner is Blocks · Piano Roll. The overall lead coordinates Blocks. Frontend Engineering, Backend Engineering, and UI/UX work with that owner. Backend means core, data, and playback. There is no server.

## Scope

One piano roll. The ribbon and the expanded editor are that roll. Haris authorized it. Original MIDI, raw timing, CC64, and the silent tail stay. Edits stay reversible and on a working copy. Bars only when tempo, meter, and phase are known.

## Current commit and build

Application code on `main` is not accepted. The correction is on `wip/piano-roll` and was not deployed. Documentation is on `handover/status`. Do not merge `handover/status` or `wip/piano-roll` onto `main`, and do not replace `main` with this older tree.

Fetched with `git fetch origin` on 8 Nov 2026:

| Ref | SHA | What it is |
|---|---|---|
| `origin/main` | `7ef7982a6b446af2269d41601703722f71380aab` | App tip. Not accepted. |
| Live script for that tip | `/Blocks/assets/index-XkfYLbpj.js` | Not accepted. |
| `origin/wip/piano-roll` | `54d3686bc5133c5aafd67f5e2bcf1ac9126db685` | Unaccepted tip. Not deployed. |
| `origin/handover/status` before this pin | `75f679362df80e266ac5d30f110dd6a9d60f5e13` | Docs only. Not a substitute for `main`. |
| Merge-base of `handover/status` and `origin/main` | `497894e170ac150f06e5a8bea34d0d4e7f34e2fd` | App-source diff from here to this branch is empty. |

`origin/main` is an ancestor of `origin/wip/piano-roll`. `origin/wip/piano-roll` is not an ancestor of `origin/main`. The fetched tip is `54d3686bc5133c5aafd67f5e2bcf1ac9126db685`. Its parent is `19b6d456bc8277086ab366974e8a1c40aa13e685`, which stays unaccepted and was not deployed. `scripts/roll-proof.mjs` is in `54d3686bc5133c5aafd67f5e2bcf1ac9126db685` and was not run against `19b6d456bc8277086ab366974e8a1c40aa13e685`. Screenshots are still not in the repository.

## Design sources

Already on `handover/status`:

- Rev 3.3 editor: `docs/design/spec.md` §0c, and `docs/design/hifi/hybrid/dark/` and `light/` frames 17–27. Haris authorized the piano roll. These frames are the storyboard, not the live site.
- Rev 3.4 ribbon contract: `docs/design/hifi/ribbon-rev34-contract.md`, with frames 11–16 under `docs/design/hifi/hybrid/dark/` and `light/`.
- Design handoff, which labels proposals and unrun evidence and is not implemented: `docs/design/HANDOVER.md`, `docs/design/acceptance-criteria.md`, `docs/design/CHANGELOG.md`, `docs/design/piano-roll-correction-brief.md`, `docs/design/piano-roll-handover.md`, `docs/design/frontend-handover-20261108.md`, and `docs/design/backend-core-handoff.md`. Canonical acceptance IDs: AC-KEY-01 through AC-KEY-05, AC-PH-01, AC-ALN-01, and AC-EVD-01. These files update those documents. They do not replace the rest of the design tree.

## Known failures

`7ef7982a6b446af2269d41601703722f71380aab` and `/Blocks/assets/index-XkfYLbpj.js` are not accepted. The rejected build has crowded tools and no moving playhead. Browser checks of draw, move, resize, erase, velocity, grid, and quantise were not done. It was not refused as a feature. `54d3686bc5133c5aafd67f5e2bcf1ac9126db685` is also unaccepted and was not deployed. Prefix contamination remains the open selection miss. The 20:30 GMT ending report stays user-reported resolved for that hearing, not a universal sign-off. His exact take is not available.

## Verified versus unverified evidence

| Class | Verified | Unverified |
|---|---|---|
| Automated tests | Passing tests are not delivery. | `scripts/roll-proof.mjs` is in `54d3686bc5133c5aafd67f5e2bcf1ac9126db685` and was not run against `19b6d456bc8277086ab366974e8a1c40aa13e685`. |
| Browser and touch, and playback alignment | Required before acceptance. | Draw, move, resize, erase, velocity, grid, and quantise were not checked in the browser on the rejected build. Screenshots are still not in the repository. |
| Design review of the actual build | Required before the lead accepts. | A mock is not this review. The 24 dp audition threshold and the provisional widths were not device-tested. |
| Listening, hardware, latency, device | | Independent approval has not been recorded. |

## Decisions

| Decision | Status |
|---|---|
| Piano keys are real key shapes, aligned with the pitch rows. C4 is MIDI 60 and is the middle-C marker. | Proposed |
| The live ribbon keyboard is slim and display-only. | Proposed |
| Editor key audition is separate from edits, capture, and history. It is enabled only when the row target is large enough. The design proposal is a row height of at least 24 dp. That size was not device-tested. | Proposed |
| Sounding-key highlights for the selected layer come only from authoritative playback or sustain state. No fake highlights. | Proposed |
| Widths are provisional: editor about 40 dp, phone about 28 dp, ribbon 16–20 dp. Validate them. They are not tested. | Proposed |
| Original MIDI, raw timing, CC64, and the silent tail stay. | Standing agreement. Not a new verification of `7ef7982a6b446af2269d41601703722f71380aab` or `54d3686bc5133c5aafd67f5e2bcf1ac9126db685`. |

The lead accepts only after both the design evidence and the function evidence exist.

## Files

- `docs/handover/ways-of-working.md` — working model. Docs.
- `docs/handover/README.md` — handover entry. Docs.
- `docs/design/HANDOVER.md`, `docs/design/acceptance-criteria.md`, `docs/design/CHANGELOG.md`, `docs/design/piano-roll-correction-brief.md`, `docs/design/piano-roll-handover.md`, `docs/design/frontend-handover-20261108.md`, `docs/design/backend-core-handoff.md` — design handoff. Proposals and unrun evidence. Not implemented.
- `origin/wip/piano-roll` at `54d3686bc5133c5aafd67f5e2bcf1ac9126db685` — unaccepted app correction. Not in this docs branch. Not deployed. `scripts/roll-proof.mjs` was not run. Screenshots are not in the repository.

## Next executable step

Do not treat `7ef7982a6b446af2269d41601703722f71380aab` or `54d3686bc5133c5aafd67f5e2bcf1ac9126db685` as accepted. Do not deploy the WIP. `scripts/roll-proof.mjs` is in that commit and was not run against `19b6d456bc8277086ab366974e8a1c40aa13e685`. Screenshots are still not in the repository. Continue on `wip/piano-roll` until UX can review the actual build, with browser and touch interaction, a moving playhead from authoritative playback, and the edit, grid, and quantise actions checked. Validate the provisional widths and the 24 dp row height on a device before calling them tested.
