# Blocks design package — changelog

## Rev 3.3 — 8 Nov 2026 (full-screen piano-roll editor, storyboarded before implementation; Haris via lead)
Still PROPOSED. Nothing implemented or tested; no claim that engine capture or editing works today. All notes and counts are example data; all numbers provisional.
- **New frames 17–27** (hybrid dark + light; boards `*.png`, 2x screens `src/*@2x.png`, editable `src/*.html`): 17 entry from Play (tap a layer's notes; loop keeps playing), 18 legible editor (keys, ruler, layer strip, other layers as ghosts, Select), 19 move pitch + time with loupe readout, 20 marquee and two-finger ownership, 21 resize with end handle, 22 Draw, 23 Erase with Undo, 24 velocity panel tied to the selection (bars, numbers, drag-to-scale), 25 quantise preview (explicit scope, grid, strength, swing; originals as dashed ghosts; never automatic), 26 ⋯ Duplicate/Copy/Paste/Select all/Delete, 27 return to Play with playhead and loop preserved. Plus `fold-18-editor` and `desktop-18-editor` (keyboard + mouse) and `editor-overview.png`.
- **Quick Quantise on the play screen: evaluated and recommended against** (spec §0c.10, AC-ED-15).
- Loop boundary and phase are read-only in the editor (🔒), kept separate from note edits.
- Tools renamed for the full-screen editor: Draw / Select / Erase (spec §0c supersedes §3.11 where they differ).
- Generator `hifi/src/editor.py`, wired into `hybrid.py` (frames, Fold/desktop alts, editor overview, prototype roles and interaction geometry); `build.py` prototype gains an editor simulation (select/move, draw, erase, velocity scaling, quantise strength preview).
- Docs: spec §0c, `gestures.md` §10 ownership table, `state-machines.md` editor diagram, `acceptance-criteria.md` AC-ED-01–15, `LIMITATIONS.md` item 13, `hifi/README.md`, `README.md` (index, rebuild, prototype, evidence), `tokens.json` (`hifiDirections.hybrid.rev33`, provisional).
- Contrast: `hifi/contrast-rev33.tsv` (`hifi/src/contrast_rev33.py`), 0 fails in both themes. Checks: `checks/run_checks.sh` §3b–3d plus editor interactions in `checks/prototype-test.js`.
- Page: new "Full-screen editor (rev 3.3)" section, status and changelog; `page/` export refreshed.

## Rev 3.2.1 — 8 Nov 2026 (doc-only; no visual changes)
- **Repeating pickup** is now labelled explicit PROPOSED behaviour, not an engine contract. "First pass only" is recorded as an unresolved audition/test question: spec §0b.4 and new §0b.9 (OQ-1), `qa-review.md` item 18, `usability-test-script.md` task R4 and a post-task question, AC-RNG-09, `state-machines.md`, `tokens.json`. No control added.
- **Provisional gesture numbers:** every numeric gesture value (48 dp zones, 72 dp magnifier offset, 40 dp slide-up override, 32 dp edge zone, ≥ 6 s Undo toast, zoom limits, 15 px label cap) is marked provisional until device testing in `spec.md` §0b, `gestures.md` §9, `tokens.json` (`hifiDirections.hybrid.rev32`) and AC-RNG-10; tracked as OQ-3; `qa-review.md` item 19.
- **Harmony labels and role tags:** optional and research-gated, no further visual work; arpeggio and bass tags are deliberately not drawn (spec §0b.5, AC-HAR-01, tokens).
- **Self-contained archive:** `hifi/src/build.py` ROOT is now package-relative (was an absolute box path). Top-level `README.md` rewritten with a file index, exact rebuild steps and check evidence; new `LIMITATIONS.md`; new `checks/` (`run_checks.sh`, `prototype-test.js`, dated `check-log.txt`); `hifi/src/contrast_rev32.py` (reproduces `contrast-rev32.tsv`); fonts copied to `hifi/fonts/` with OFL licences and `build.py` now reads them from the package (falls back to the original box path); the wireframe generator copied to `wireframes/src/gen_wire.py` with package-relative paths (verified to reproduce all 17 SVGs byte-for-byte) plus `wire.json`; the review Page source exported to `page/` with a section-to-file map and the Page-only text copied in; `.gitignore` for `__pycache__`.
- Page: status and changelog updated to rev 3.2.1. No PNG, HTML frame or prototype change.

## Rev 3.2 — 8 Nov 2026 (Settings; take history + capture range; Haris via lead)
Still PROPOSED. No claim that the current build supports any of this. All notes and chord names are design/example data.
- **Settings → Appearance** (frame 08): System (default) / Light / Dark, reached from the Blocks ⌄ menu, never on the play surface; preview strip; changes apply instantly without interrupting audio, playback or MIDI; choice persists. ACs AC-SET-01–03; appearance state machine.
- **Take history is now the main Play view**: a real piano roll of the rolling history with the proposed capture range, ⟦/⟧ handles (48 dp), magnifier, live edge, overview strip, auto-follow and Back to live. Layer cards stay visible.
- **Priority framing:** the engine picks the phrase; the storyboard shows one-action success first (09: four chords + pickup, no handles), then the failure (10: last chord only) and its correction (11 drag ⟦, 12 fixed + Undo).
- **Three operations kept apart:** (a) non-destructive boundary adjustment — dragging start changes length, end fixed (11, 13a); (c) Slide/phase nudge — length kept, beat one shifts (13b); (b) cutting/note edits only in Edit, explicit and undoable.
- **States:** free time vs grid (15 vs 09–12), snap onset/beat/bar/off + override (11, 16), pan/zoom/auto-follow/Back to live (16), pickups and held notes across the end (14), Undo (12).
- **Optional harmony labels + role tags** (PROPOSED capability, recognition under research, mock data): jazz extensions/alterations/inversions, honest alternatives ("or Dm9/G"), chord/melody/arpeggio/bass tags; small, toggleable, never primary.
- Fold-expanded and desktop variants of frame 11 (stepper panel; keyboard map).
- Docs: spec §0b, gestures §9, state machines (follow/pan/range, capture range, appearance), ACs AC-RNG-01–11, AC-HAR-01, AC-SET-01–03.
- Prototype: Blocks ⌄ → Settings (appearance options switch the theme), draggable range handles with snapping and keyboard on 09–12 and 15, Boundaries ↔ Slide toggle, Back to live, Undo.

## Rev 3.1 — 8 Nov 2026 (hybrid precedence, Haris via lead)
- **Precedence (rev 3.1, Haris via lead): the hybrid.** Graphite Studio's main UI is the structural base, and it takes precedence. Its information architecture, its explicit separate instrument/layer cards, its controls and the discoverability of its features all stay. From Paper Score the hybrid borrows character only: editorial serif headings (sketch title, capture-sheet headlines such as "Four bars, at ninety-two."), italic chord and sound names, and stave hairlines inside layer cards. It never replaces the structure with a score sheet and never hides instruments. The same hybrid comes in **dark** (the default for playing) and **light** (daylight, review, export). Assets are in `hifi/hybrid/{dark,light}/`, and the tokens are in `tokens.json` → `hifiDirections.hybrid`.
- New: `hifi/hybrid/dark/` and `hifi/hybrid/light/`. Each has 01–07 phone frames, the Fold (05) and desktop (07) frames, a storyboard overview and editable `src/*.html`. There is also a dark-vs-light board, `hifi/hybrid/hybrid-dark-vs-light.png`.
- `hifi/prototype/index.html` now shows the hybrid, with a Dark / Light toggle. The Page's storyboard has the same toggle, and the Page has an adopted-hybrid callout.
- Both hybrid palettes pass WCAG AA for text (`hifi/contrast.tsv`, themes C and D). 48 dp targets, non-colour layer cues, and A1–A12 are unchanged.
- The rev 3 direction boards (A, B, A-vs-B) are kept as inputs.

## Rev 3 — 8 Nov 2026 (high-fidelity visual and storyboard pass)
Still PROPOSED: nothing is implemented or user-tested. Everything in it is design/example data, and the prototype is a simulation, not working MIDI/audio.
- Two hi-fi directions in `hifi/directions/`: **A Graphite Studio** (dark instrument, recommended) and **B Paper Score** (light editorial). Each has a board with its palette, type, layer key and rationale, and there is an A-vs-B recommendation board.
- A seven-frame storyboard in A (`hifi/storyboard/`). It runs: free play → Capture with an immediate loop → the honest "no steady pulse" state → bass over the loop → an in-sync second Capture with phase OK and Undo → drums on screen pads → optional quantise. Frame 05 also has a Fold-expanded version and frame 07 a desktop browser version.
- A self-contained clickable prototype in `hifi/prototype/index.html`, plus an interactive storyboard and both directions on the Page.
- Visual changes from the rev 2 north star: the accent is now `#FF7442` ("ember"); Capture uses a reach-back glyph, not a record dot; chord names are serif italic; empty slots fold into one 48 dp row so every real layer stays above the thumb zone; dim text was raised to pass AA (`hifi/contrast.tsv`).
- All A1–A12 decisions and the earlier corrections still apply.

## Rev 2 — 8 Nov 2026 (lead integration decisions)
Still PROPOSED: not implemented and not user-tested. All numbers are proposals pending measurement.

**Visual north star — "sexy, sleek" (owner direction from Haris):**
- New section in the spec (§0), in `tokens.json` (`visualNorthStar`) and on the Page.
- The look: a premium dark-first instrument aesthetic with one confident accent (Signal `#FF6A3D`), refined typography, generous negative space, minimal chrome, subtle tactile motion that respects reduced-motion, and a crisp hardware-like finish.
- Do/don't rules and computed contrast ratios are included.
- Restyled wireframes: 00 Play portrait, 03 Fold open, 05 desktop, 08 Capture review, 11 piano roll, 16 edge states. Fold-open M/S buttons were enlarged to 48dp.
- Sexy never overrides usability or accessibility.

**Adopted by the lead:**
- The loop starts immediately after Capture; a persistent "Stay silent" option turns that off.
- Capture review doesn't block playing, and Undo reverts a capture.
- Original take, grid, playback tempo and quantise stay separate.
- A new layer joins at the next loop boundary.

**A1–A12 resolved** (spec §8 has the full text and where each is applied):
- **A1 – history:** 120 s rolling history plus a hard cap. Ordinary age eviction and overload are separate states, with gaps flagged. Synthetic releases are stored apart from raw events. Capture continues while audio is suspended only if MIDI keeps arriving. Native is foreground-only at first.
- **A2 – tempo:** locked once set.
- **A3 – timing:** input-event time is preserved.
- **A4 – tempo choices:** extra alternatives only when inference justifies them. ½ / ×2 / Set BPM are always offered, "no pulse" is a designed state, and meter starts at 4/4.
- **A5 – shared grid:** shared tempo and meter, with a common loop at first.
- **A6 – capture target:** an empty or new layer. When all slots are full the user chooses; nothing is replaced silently.
- **A7 – touch keys:** touch events are source-tagged.
- **A8 – controller data:** raw CC64, bend and pressure are kept; lanes are read-only; there are no synthetic events in MIDI export.
- **A9 – stem tails:** follow the sound's release; export length is visible and changeable.
- **A10 – undo:** session undo plus durable snapshots.
- **A11 – parts:** four parts is a milestone, not a maximum; the first slice has one part.
- **A12 – IDs:** stable event and note IDs.

**Other corrections:**
- No spare pedal is required; Capture can be mapped to any CC, button or pad.
- Sustain and playing keys are not taken by default; an optional command zone exists.
- Controller actions after Capture are staged for later gates, not dropped. Stems and full touch selection are required later milestones.
- Capture while playing selects only history already played. Held notes get playback-only synthetic releases.
- The electric-piano sound name is replaced with the placeholder "Warm EP", and sound-browser names are placeholders.
- First-run touch count is no longer fixed (one enable gesture plus whatever the browser prompts).
- The unchecked browser recommendation is removed.

**Files changed:**
- `spec.md`
- `acceptance-criteria.md` (new AC-DEC-01…11; AC-RDY-01/05, CAP-03/05/06, REV-03, LAY-01, EXP-01, CTL-01, P1-01…04 revised)
- `gestures.md`
- `state-machines.md`
- `research.md` (decision cells only)
- `tokens.json` (history, export, controller, parts, copy and a measurement note)
- `components.md`
- `qa-review.md`
- `usability-test-script.md`
- `README.md`
- `CHANGELOG.md` (new)
- Wireframes 00–03, 05, 06–11, 13, 14 (all footers now say sizes are proposals)
- New `16-capture-edge-states.svg`: no pulse, capture while playing, overload gap, all slots full

## Rev 1 — 8 Nov 2026
Initial package: research, spec, gestures, acceptance criteria, state machines, components, tokens, QA, test script, and 16 wireframes.
