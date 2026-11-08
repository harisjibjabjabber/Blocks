# Checkpoint template

Copy this at a milestone. Fill the blanks from the repository and from checks that were actually run. Write unknown rather than guessing. Do not promote a unit test or a visible control into delivery. Do not treat a design picture as a shipped screen.

Last fetch of `origin/main`, 8 Nov 2026: `7ef7982a6b446af2269d41601703722f71380aab`. That build is not accepted. Re-fetch before the next checkpoint. If the tip is still `7ef7982a6b446af2269d41601703722f71380aab`, it is still not accepted.

## Owner

The component owner for this scope. The piano-roll component owner is Blocks · Piano Roll. The overall lead coordinates Blocks. A role label is optional.

## Scope

One bounded scope. Name the product question in one sentence, and name what is out of scope. The approved slice is the main play screen, Graphite and Paper, dark and light, plus start and end handles on the take ribbon, audition when the finger lifts, and one undo. Frames 17–27 stay unbuilt. Snap and main-screen Quantise stay open.

## Current commit and build

Application code comes from latest `main`. Documentation comes from `handover/status`. Record both SHAs from `git rev-parse` after `git fetch`. Do not copy an old SHA forward without checking. Do not merge `handover/status` onto `main`, and do not replace `main` with this older tree.

| Ref | SHA | What it is |
|---|---|---|
| `origin/main` | `7ef7982a6b446af2269d41601703722f71380aab` on the last fetch | App code. Not accepted. |
| Live script | `/Blocks/assets/index-XkfYLbpj.js` | Reported for that tip. Not accepted. |
| `handover/status` | | Docs only. Not a substitute for `main` |
| Merge-base | `497894e170ac150f06e5a8bea34d0d4e7f34e2fd` on the last fetch | |

## Design sources

Already on this branch:

- Rev 3.3 editor: `docs/design/spec.md` §0c, and `docs/design/hifi/hybrid/dark/` and `light/` frames 17–27. Those frames stay unbuilt.
- Rev 3.4 ribbon contract: `docs/design/hifi/ribbon-rev34-contract.md`, with frames 11–16 under `docs/design/hifi/hybrid/dark/` and `light/`.

## Known failures

Prefix contamination is the open selection miss. The 20:30 GMT ending report stays user-reported resolved for that hearing, not a universal sign-off. `7ef7982a6b446af2269d41601703722f71380aab` is a bare roll with a crowded toolbar and no moving playhead. Editing, grid, and quantise controls were not exercised in the browser. His exact take is not available.

## Verified versus unverified evidence

Keep these apart. Name the command or the saved file. Say whether it was rerun.

| Class | Verified | Unverified |
|---|---|---|
| Automated tests | Passing tests are not delivery. | |
| Browser and touch, and playback alignment | Required before acceptance. | The current main build was not exercised this way. |
| Design review of the actual build | Required before the lead accepts. | A mock is not this review. |
| Listening, hardware, latency, device | | Independent approval has not been recorded. |

A user failure outranks a green synthetic suite. Frozen validation is not tuning and is not regression.

## Decisions

What the component owner handed off, what frontend and backend agreed, and what the lead accepted. The lead accepts only after both the design evidence and the function evidence exist. If an older authority is not in the repo, write unknown.

## Files

List the paths a reader must open. Mark each as app source, research, design proposal, or evidence.

## Next executable step

One concrete action, with the repo and the SHA it should start from. For this round: do not treat `7ef7982a6b446af2269d41601703722f71380aab` as accepted. Rebuild the approved slice so UX can review the actual build, with browser and touch interaction, playback alignment, and automated tests. If the step is only a suggestion, label it as a recommendation.
