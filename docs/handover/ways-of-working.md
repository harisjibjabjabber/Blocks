# Ways of working

These are project roles and current working agreements for Blocks. They are not a transcript of anyone's private instructions. Where an earlier instruction or authority is unknown, it is marked unknown. Nothing here is a claim that each named role performed every task under that heading.

Verified with git on 8 Nov 2026, after `git fetch origin main`:

| Fact | SHA |
|---|---|
| `origin/main` | `91291d80a3c6bb5e91cc6635243f00bf218672f0` |
| Merge-base of `handover/status` and `origin/main` | `497894e170ac150f06e5a8bea34d0d4e7f34e2fd` |
| `handover/status` tip before this document | `c61829fa8e330d3dadb5989e7cb5416f4644a7cf` |

`91291d80a3c6bb5e91cc6635243f00bf218672f0` is the `main` tip verified by `git fetch` on 8 Nov 2026. It is not an ancestor of `handover/status`. `957480eda2de13005613d27cc875d2853c9fbde4` is the previous tip and is not an ancestor of this branch either. `handover/status` is not an ancestor of `main`. The app-source diff from the merge-base to this branch is empty. Take application code from the latest `main`. Take these documents from `handover/status`. This branch is not a substitute for `main`.

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

## Current practice

- Keep the musician playing. Retrospective Capture comes first.
- The cut has to cope with chords, melody, bass, arpeggios, and mixed playing.
- Original MIDI stays immutable. Expressive timing stays. Quantise is opt-in and undoable.
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

The current design proposal is rev 3.3. The archived Capture research baseline is `3412f612fe5f5f8d818ec50ad62ab9cd2a3cab3e`. Last-chord Capture is still unresolved. Neither is shipped. The live script named for `957480e`, `/Blocks/assets/index-DGlo7_W4.js`, was overtaken by a later `main` commit. `git fetch` on 8 Nov 2026 verified the `main` tip as `91291d80a3c6bb5e91cc6635243f00bf218672f0`, whose live script is `/Blocks/assets/index-CPO7bfKa.js`. A still later behavior commit can change that script. This document does not. At 20:30 GMT Haris said the ending problem has gone in that test. That is user-reported resolved for that hearing, not a universal sign-off. Prefix contamination, older playing captured with the chords, is the open selection miss. At 20:31 GMT he said the phrase is a single loop, so a repeated pattern is not something he can be required to play. At 20:32 GMT he said the bad captures are intermittent. The first few did not include the noodling, and he informally estimates about half of them do now. That 50/50 is his estimate, not a measured rate. At 20:33 GMT he said automatic capture will never be perfect and the priority now includes making a miss fast to fix. That priority sits beside the open prefix miss. At 20:34 GMT he asked for the UI build. The approved slice is the main play screen, Graphite and Paper, dark and light, plus start and end handles on the take ribbon, audition when the finger lifts, and one undo. Frames 11–16 are the relevant storyboard. Frames 17–27 stay unbuilt. Snap and main-screen Quantise stay open. His exact take is not available. The ending report from 20:30 stays user-reported resolved for that hearing. `git fetch` still shows `origin/main` at `91291d80a3c6bb5e91cc6635243f00bf218672f0`, so the live script remains `/Blocks/assets/index-CPO7bfKa.js`. No later code change is recorded here as already deployed.

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
2. Fetch both the latest `main` and `handover/status`. Reproduce the named baseline from `main`, not from this branch.
3. Keep the design gate and the release gate. Rev 3.3 is not approval to build the production screen. Last-chord Capture is not fixed.
4. Map the responsibilities above onto people or tools. The role labels are optional.

**Recommendation.** Keep handover documents on a branch that is not `main`. A push to `main` is what the Pages workflow deploys, so a documentation commit on that other branch does not publish the site, and a clone of `main` alone does not contain the handover. That split is a recommendation for how to continue. It is not a finished process beyond the documents already on `handover/status`.
