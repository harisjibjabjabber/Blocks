# Piano-roll quality checkpoint

8 November 2026, Europe/London. Owner: main coordinating agent. Frontend, core engineering, independent browser QA, and embedded UI/UX contributed to this checkpoint.

## State and scope

Application baseline: `main` at `7ef7982a6b446af2269d41601703722f71380aab`. Work continued from `wip/piano-roll` at `54d3686bc5133c5aafd67f5e2bcf1ac9126db685`, on `codex/piano-roll-quality`. Handover/design source: `handover/status` at `75a78ce39daf8f6ccff9fe5ea42a97cda2b24878`. The older documentation branch was not merged into application code.

This is a local browser correction with independent UX and QA evidence. It is not full storyboard acceptance or authorization to merge/deploy. The existing live site remains separate. The original capture-prefix defect remains open; none of the synthetic playing below is Haris's missing take.

## Implemented

- Dedicated editor shell with pinned Back, Undo/Redo and Play/Stop/Capture; responsive phone/desktop layouts in Graphite/Paper themes.
- Shared roll and keyboard pitch geometry, real black/white keys, C4 marker, pitch fitting, and tap alternatives for view navigation.
- Single-note draw, select, move, resize, erase and velocity changes. Gestures use baseline previews and one reversible commit. Cancel, Escape, second touch and undo during drag discard pending work. No-op gestures do not add undo entries.
- Explicit quantise preview: solid proposed positions and dashed originals, with Cancel/Apply. Complete-grid changes preserve notes. Raw MIDI, CC64 and silent tails stay intact.
- Engine-owned selected-layer playback position and sounding pitches. Audition uses an isolated audio path and never emits into capture history. Native capabilities remain explicitly unavailable where unsupported.
- Committed edits, undo and redo update looping playback at the next seam. Erase-all retains the loop as silence. Raw and edited loop paths exclude attacks at the end boundary.
- Portable web build, explicit web typecheck, isolated Chrome test harness, strict browser assertions, and CI checks with retained browser artifacts. Pages now checks types/tests before building a release.

## UI/UX authority and verdict

Haris requires UI/UX to stay embedded throughout implementation and actively test the running product. UI/UX can issue **Pass**, **Changes required**, or **Reject**; a block cannot be silently waived by the coordinator or replaced with green unit tests. QA has its own independent verdict. Both must pass for the relevant acceptance scope.

The reviewer rejected the initial layout because scrolling hid Undo and transport. It also required corrections to the record-dot Capture icon, wrapped tools, quantise preview direction, narrow-note text overflow and pitch clipping after resize. These were corrected and retested.

**Final local UX verdict: PASS for this implemented correction scope. Full storyboard/release acceptance: BLOCKED.**

Independent UX exercised populated takes at 1440×900, 390×844 and 320×740, and both themes. Back/Undo/Redo and transport remained in the viewport, all fixture pitches fitted, notes remained readable, and no uncaught browser exceptions were observed. Audition followed by Capture preserved the seven-note fixture without adding audition notes.

## Verification actually performed

| Evidence class | Result and boundary |
|---|---|
| Web types | `npm run typecheck:web` passed. This is a web build check, not an Android/iOS build. |
| Automated tests | `npm run test:js`: 117 passed across 17 files. Includes synthetic capture regressions and editing/core invariants. |
| Rendered audio | Chrome OfflineAudioContext passed attack, note-off release, sustained hold, pedal-up and stop cleanup checks. This is not listening or latency measurement. |
| Production build | `npm run build:web` passed with exact `/Blocks/` base. |
| Browser QA | `npm run test:browser`: 17 checks passed on the local development build and production preview, with four screenshots and zero uncaught exceptions. Uses actual Chrome pointer input and explicitly emulated touch. |
| Independent UX | Separate actual-build walkthrough, rejection/fix/retest cycle and screenshots. Local correction passed; full release remains blocked. |
| Native host tests | Not executed on this Windows machine because `g++` is unavailable. The Ubuntu `checks` workflow runs the native suite through `npm test`; read the corresponding Actions result before claiming it passed. |
| Physical devices/listening | Not run. No Fold, USB MIDI, pedal hardware, measured latency or audiovisual-sync claim. |

Browser QA checks capture via onscreen notes, draw/move/resize/velocity/erase, exact undo/redo, no-op history, Escape/pointercancel, undo during drag, emulated second-touch cancellation, grid immutability, quantise preview/cancel/apply, audition isolation, recapture integrity, moving playhead/stop, note hit-testing after resize, and phone/desktop light/dark viewport/pinned-control geometry.

The proof script records source commit, dirty-tree status, result, screenshots and exceptions. Run with a server at `BLOCKS_PROOF_URL`, optionally setting `BLOCKS_PROOF_DIR`. The `checks` workflow tests the built site and uploads `piano-roll-browser-evidence`. Use its exact run/commit for durable CI evidence. Local outputs are outside the source repository.

## Remaining acceptance blockers and scope

- Real-device touch/Fold usability, audiovisual timing at 90/140 BPM, and deployed-build recording required by the full acceptance package remain outstanding. A local production preview is not a public deployment.
- Multiselect/marquee/chord selection, full velocity lane/group scaling, clipboard/full keyboard command map, session undo, screen-reader note actions, accessible range-slider actions, minimap/edge auto-scroll/overlapping-handle picker, and full quantise parameters remain broader storyboard work.
- Pause/seek are not implemented transport features and are not represented by fake controls or estimated positions.
- Main-screen Quantise, pickup repetition and remaining product choices stay open; no user decision was silently invented.
- Prefix contamination remains a separate Capture/Timing task. Preserve the synthetic/research provenance and do not call these checks a reproduction or fix of Haris's real take.

## Next handoff

Product scopes the next bounded interaction/accessibility increment from the outstanding storyboard criteria. UX supplies the interaction contract and tests each running increment. Frontend and core agree interfaces before parallel edits; independent QA verifies the integrated candidate. Keep UX's blocking authority and distinct evidence classes. No merge to main or deployment while full release acceptance is blocked.
