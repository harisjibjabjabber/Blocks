# Ways of working

These are project roles and current working agreements for Blocks. They are not a transcript of anyone's private instructions. Where an earlier instruction or authority is unknown, it is marked unknown. Nothing here is a claim that each named role performed every task under that heading.

Verified with git on 8 Nov 2026, after `git fetch origin`:

| Fact | SHA |
|---|---|
| `origin/main` | `7ef7982a6b446af2269d41601703722f71380aab` |
| Merge-base of `handover/status` and `origin/main` | `497894e170ac150f06e5a8bea34d0d4e7f34e2fd` |
| `origin/handover/status` before this edit | `75f679362df80e266ac5d30f110dd6a9d60f5e13` |
| `origin/wip/piano-roll` | `54d3686bc5133c5aafd67f5e2bcf1ac9126db685` |

`7ef7982a6b446af2269d41601703722f71380aab` is the `main` tip this fetch saw. It is not an ancestor of `handover/status`, and this branch is not an ancestor of `main`. Do not merge this branch onto `main`, and do not replace `main` with this older tree. The app-source diff from the merge-base to this branch is empty. Take application code from the latest `main`. Take these documents from `handover/status`. This branch is not a substitute for `main`.

The live script reported for that tip is `/Blocks/assets/index-XkfYLbpj.js`. That build is not accepted. The roll is unfinished: crowded tools, no moving playhead in the rejected build, and browser checks of draw, move, resize, erase, velocity, grid, and quantise were not done. It was not refused as a feature. Passing unit tests, or showing a control, is not delivery. The correction tip is `origin/wip/piano-roll` at `54d3686bc5133c5aafd67f5e2bcf1ac9126db685`. It is unaccepted and was not deployed. `scripts/roll-proof.mjs` is in that commit and was not run against `19b6d456bc8277086ab366974e8a1c40aa13e685`. Screenshots are still not in the repository. Do not deploy it, and do not merge it onto `main`.

## Roles

Responsibilities, not a work log.

| Name | Responsibility |
|---|---|
| Daw Bot, Product Manager | Product and engineering coordination, priorities, integration, and handover. |
| Blocks, Capture & Timing | Retrospective phrase, tempo, grid, and loop research. |
| Blocks, Audio & MIDI | Android and web audio and MIDI, sustain, timing, and release reliability. |
| Blocks, UI/UX & Interaction Design | Editable visual design and storyboards, phone, Fold, and light and dark interaction, plus specifications. |
| Blocks, Instruments & Sound Library | Sound candidates, licence, provenance, mapping, and interchange. |
| Blocks, QA & Musical Workflow | Independent workflow review, reproduction, regression, and musical acceptance. |
| Shared room | Blocks, Product & Engineering. |
| Haris Jabbar | Product owner, musician tester, and decision maker. |
| Cursor coding project | Repository implementation and integration. |

Specialist research and design are context and evidence. They are not automatically production code or sign-off. Independent device or latency approval has not been recorded. Do not claim it. Who first authorised a particular earlier cut, when that is not written in the repository, is unknown.

The names above are optional role labels for a new human team. They are not required. Map the responsibilities onto people or tools.

## How the work is organized

The overall lead coordinates Blocks. Each component has one product manager, the component owner. Frontend engineering and backend engineering work with that owner and with UX in a focused mini-team. Audio and MIDI, Capture and Timing, QA, Instruments, and UX stay the roles already listed. New names below are organizational owners. They are not separate products and not extra coding projects. The one existing coding project remains the implementation and integration route.

The first mini-team is the piano roll. Its component owner is Blocks · Piano Roll. The team is Frontend Engineering, Backend Engineering, UI/UX, and the overall lead. Backend here means core, data, and playback. There is no server. The room name Blocks · Piano Roll Team is optional context, not a dependency.

The component owner writes one bounded scope and the interface and acceptance handoff. Frontend and backend agree the interfaces and build to the reviewed UX. UX reviews the actual build, not a mock. Browser and touch interaction, plus playback alignment, are required along with automated tests. The lead accepts only after both the design evidence and the function evidence exist.

## Current practice

- Keep the musician playing. Retrospective Capture comes first.
- The cut has to cope with chords, melody, bass, arpeggios, and mixed playing.
- Original MIDI stays immutable. Raw timing stays. CC64 stays. Musical silent tails stay. Edits are reversible and happen on a working copy.
- Bars are used only when tempo, meter, and phase are known.
- The ribbon and the expanded editor are one piano roll.
- Expressive timing stays. Quantise is opt-in and undoable.
- Browser-first. Android code and the existing APK artifact stay. The standalone debug APK was built and never launched.
- Look at the visual storyboard before building new UI.
- Keep Graphite structure and Paper character, in light and dark.
- Capture correctness is not excused by editor handles.
- Haris said rev 3.3 looks great. That is positive visual feedback, not approval to implement speculative functionality. Main-screen Quantise is still open. The designer recommends Quantise only inside the editor. Haris has not agreed to remove a main-screen shortcut.
- While work is active, concise progress about every 30 minutes, plus meaningful results and blockers. Keep the GitHub handover current at milestones, including unfinished draft status and the next step.
- Do not rely only on chats, Pages, or this account.
- Research keeps source URLs, licence, and provenance. Separate documented fact, hypothesis, and our own proposal. Ableton is a behavior reference, not its private algorithm.
- Track coding outcomes with commit and build identifiers. Trace a failure from input to selection, stored range, loop period, and scheduled replay. A user failure outranks a green synthetic suite.
- Keep synthetic, unit, and research results separate from rendered audio, listening, and actual hardware, latency, and device tests.
- Frozen validation is distinct from tuning and regression, and it was labelled by the same designer. Keep known fixture defects, including the V10 pedal wording and unscored D01.
- Do not ask Haris to refresh or retest again without a stronger end-to-end trace. Do not expand into unrelated scope.

The current design proposal includes rev 3.3 and the rev 3.4 ribbon contract at `docs/design/hifi/ribbon-rev34-contract.md`. The approved UI slice is the main play screen, Graphite and Paper, dark and light, plus start and end handles on the take ribbon, audition when the finger lifts, and one undo. Frames 11–16 are that ribbon storyboard. Haris authorized the piano roll, and the ribbon is that roll. Snap and main-screen Quantise stay open. The archived Capture research baseline is `3412f612fe5f5f8d818ec50ad62ab9cd2a3cab3e`. The 20:30 GMT ending report stays user-reported resolved for that hearing, not a universal sign-off. Prefix contamination remains the open selection miss. At 20:31 GMT the phrase was a single loop, so a repeated pattern is not required. At 20:32 GMT the bad captures were intermittent, and the half-and-half figure is his estimate, not a measured rate.

## Piano roll decisions

Each row is proposed, implemented, or verified. Proposed means the decision is recorded and is not accepted in a build. Implemented would mean the behavior is in a named commit that was checked. Verified would mean a browser, touch, or device check of that commit. None of these rows are implemented or verified. `origin/wip/piano-roll` is `54d3686bc5133c5aafd67f5e2bcf1ac9126db685`, unaccepted and not deployed, and `7ef7982a6b446af2269d41601703722f71380aab` is not accepted.

| Decision | Status |
|---|---|
| Piano keys are real key shapes, aligned with the pitch rows. C4 is MIDI 60 and is the middle-C marker. | Proposed |
| The live ribbon keyboard is slim and display-only. | Proposed |
| Editor key audition is separate from edits, capture, and history. It is enabled only when the row target is large enough. The design proposal is a row height of at least 24 dp. That size was not device-tested. | Proposed |
| Sounding-key highlights for the selected layer come only from authoritative playback or sustain state. No fake highlights. | Proposed |
| Widths are provisional: editor about 40 dp, phone about 28 dp, ribbon 16–20 dp. Validate them before treating them as final. They are not tested. | Proposed |

Original MIDI stays immutable. Raw timing stays. CC64 stays. The silent tail stays. Those are standing agreements, not a new verification of `7ef7982a6b446af2269d41601703722f71380aab`. Edits stay reversible and on a working copy.

## How a piece of work moves

1. **Request.** What the musician or the lead asked for, and what is out of scope.
2. **Specialist deliverable.** Research or design, with assumptions and the checks that were actually run. Say what was not run.
3. **Lead decision.** What is accepted, deferred, or still open. If the authority for an older decision is not in the repo, write unknown.
4. **Implementation and integration.** Application code on `main`, through the coding project. Docs stay identifiable as docs.
5. **Independent verification.** QA or a separate pass. Synthetic, rendered, listening, and hardware results stay in separate classes.
6. **Commit and deploy evidence.** Commit SHA, and a build or Pages identifier when one exists. A docs commit on this branch is not a deploy.
7. **Status and next step.** Shipped, proposed, broken, or draft, and the next executable step.

Use [checkpoint-template.md](checkpoint-template.md) at a milestone.

## Takeover

A new human team should:

1. Read [README.md](README.md) and this file.
2. Fetch the latest `main`, `handover/status`, and `wip/piano-roll`. This fetch saw `origin/main` at `7ef7982a6b446af2269d41601703722f71380aab` and `origin/wip/piano-roll` at `54d3686bc5133c5aafd67f5e2bcf1ac9126db685`. That WIP is unaccepted and was not deployed. `scripts/roll-proof.mjs` is in that commit and was not run against `19b6d456bc8277086ab366974e8a1c40aa13e685`. Screenshots are still not in the repository. Reproduce the named baseline from `main`, not from this branch. Do not deploy the WIP, and do not merge it onto `main`.
3. Keep the design gate and the release gate. `7ef7982a6b446af2269d41601703722f71380aab` is not accepted because the roll is unfinished, not because the feature was refused. Haris authorized the piano roll, and the ribbon is that roll. The 20:30 ending report is not a universal sign-off.
4. Map the responsibilities above onto people or tools. The role labels are optional.

**Recommendation.** Keep handover documents on a branch that is not `main`. A push to `main` is what the Pages workflow deploys, so a documentation commit on that other branch does not publish the site, and a clone of `main` alone does not contain the handover. That split is a recommendation for how to continue. It is not a finished process beyond the documents already on `handover/status`.
