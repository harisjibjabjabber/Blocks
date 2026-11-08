# Blocks — staged UI handoff with testable acceptance criteria (PROPOSED, rev 2)
**All thresholds (ms, dp, s, counts) are proposals pending measurement.** Rev 2 applies the lead decisions A1–A12 (see spec §8 and `CHANGELOG.md`). P1 items marked "required later milestone" are not optional.
Each criterion is phrased so that QA can verify it on a device/browser without reading code. "Verify" methods: **M** = manual on device, **A** = automatable UI test, **SR** = screen reader (TalkBack / NVDA+Chrome), **L** = layout check at listed widths (320, 360, 412 portrait; 780×360 landscape; 720×800 Fold open; 1280×760 desktop).

## Stage P0 — "play, capture, hear, correct, fix, export MIDI" (first slice = one part; multi-part overview follows)
### Lead-decision criteria (rev 2)
| ID | Criterion | Verify |
|---|---|---|
| AC-DEC-01 | Original take, grid, playback tempo and quantise are four separately labelled controls. No grid control changes playback speed, and no tempo control re-maps bars. | M/A |
| AC-DEC-02 | After first capture the transport loops immediately by default. A persistent "After Capture: Stay silent" setting survives relaunch. Undo removes the capture in one step. | A |
| AC-DEC-03 | With a sketch tempo set, no capture (stopped or playing) changes the tempo. Only beat one/phase and selection can be corrected. | A |
| AC-DEC-04 | No-pulse input (e.g. a rubato phrase) produces a "No steady pulse found" review offering a free-time loop and Set BPM, and does not invent a tempo. | M |
| AC-DEC-05 | Input-event timestamps in the take equal the adapter's input times; no automatic latency offset is applied. | A |
| AC-DEC-06 | With every slot full, Capture asks (New layer when supported / Replace… / Keep as take only / Cancel). It never replaces or merges silently. | A |
| AC-DEC-07 | On-screen key notes enter the same capture history tagged `source: onscreen`. They never change MIDI readiness text. | A |
| AC-DEC-08 | Note/event IDs are unchanged after grid re-inference, quantise and undo/redo, so the selection persists. | A |
| AC-DEC-09 | In a hidden tab or with the app backgrounded, nothing claims capture continued. On return, any delivery gap is flagged in the ribbon. | M |
| AC-DEC-10 | Under injected input overload the UI shows a gap with time span. Capture may be partial and says so. Ordinary age eviction never shows an error. | A |
| AC-DEC-11 | Copy and wireframes use only placeholder sound names until the sound set is chosen, and recommend no browser that hasn't been checked. | L |

### Visual north star (owner direction)
| ID | Criterion | Verify |
|---|---|---|
| AC-VIS-01 | Dark-first theme: all text is ≥ 4.5:1 and all state indicators (selection outline, focus ring, playhead) are ≥ 3:1 against their background; measured on device screenshots. | L |
| AC-VIS-02 | Each screen region has at most one accent-coloured control group; Capture is the brightest element on Play. | L |
| AC-VIS-03 | With reduced motion on, Capture press, sheets and layer join use no scale, glow or slide; haptics remain optional. | M |
| AC-VIS-04 | No visual polish reduces a target below 48dp or removes a non-colour cue (grayscale review passes). | L |
| AC-VIS-05 | (rev 3) Every existing layer stays visible on Play while a capture sheet or toast is open; only the ribbon shrinks. Empty slots may collapse into one ≥48dp row. | L |
| AC-VIS-06 | (rev 3) The Capture affordance never uses a record-dot icon or "Rec/Arm" copy; it uses the reach-back glyph plus the "Capture" label. | L |
| AC-VIS-08 | (rev 3.1) Hybrid precedence: in dark and light, Play keeps Graphite's structure (separate layer cards with name, sound, state and mini-roll; thumb-zone controls). Paper elements (serif headings, italic chords, staves) are decoration inside that structure and never replace or hide an instrument. | L |
| AC-VIS-07 | (rev 3) Capture, Undo and the post-capture phase controls sit in the bottom thumb zone in portrait and on the bottom edge of a pane on Fold expanded, never in the hinge area. | L |

### Readiness
| ID | Criterion | Verify |
|---|---|---|
| AC-RDY-01 | On web, no sound plays and no MIDI prompt appears before the user makes the one explicit enable gesture ("Start (sound, then MIDI)"); that gesture resumes audio and then requests MIDI. Any extra browser prompt is reported as observed, not asserted as a fixed count. | M/A |
| AC-RDY-02 | The Input chip shows "receiving" only after at least one MIDI message has arrived from that port; a connected but silent port shows "connected · no notes yet". | M |
| AC-RDY-03 | On-screen keys never appear in the Input device list; their panel header reads "On-screen keys (this device)". | M/A |
| AC-RDY-04 | Each of: unsupported browser, permission denied, insecure context, audio suspended, no device, device disconnected shows its specific title + one primary fix (spec §3.6 table). Simulated with browser flags/devtools. | M |
| AC-RDY-05 | Unplugging the MIDI device while holding notes stops all sounding notes within a proposed 100 ms and shows the disconnect banner. The stops are stored as synthetic releases **separate from raw events**; in-memory history stays capturable. | M/A |
| AC-RDY-06 | "Start playing" is enabled whenever sound is ready, even with no MIDI. | A |
### Play / Capture
| ID | Criterion | Verify |
|---|---|---|
| AC-CAP-01 | No arm/record control exists on Play; playing any note shows it in the ribbon within 100 ms. | M |
| AC-CAP-02 | On an empty sketch, one Capture press creates Layer 1, displays inferred bars/BPM/meter, and starts looping from loop start (default setting). | M/A |
| AC-CAP-03 | With layers playing, Capture selects only history already played on the existing transport (ending at the last bar line already passed); it never captures future notes. The new layer is **queued** and starts at the next loop boundary, not mid-bar. Sketch tempo is unchanged. | M/A |
| AC-CAP-04 | Capture with an empty buffer changes nothing, shows "Nothing to capture yet — play something", and announces it via live region. | A/SR |
| AC-CAP-05 | Capture button (proposed sizes, pending measurement): ≥ 96dp tall and ≥ 50 % of width in portrait; ≥ 192dp wide rail in compact height; never inside a scroll view. | L |
| AC-CAP-06 | The history chip shows the kept duration (proposed 120 s target plus a hard cap) and updates at least once per second while playing. Ordinary age eviction shows no error; an overload drop shows a "gap" marker and text. | M/A |
| AC-CAP-07 | One Undo after Capture removes the layer and restores the prior target and transport state. | A |
### Capture review
| ID | Criterion | Verify |
|---|---|---|
| AC-REV-01 | Review sheet is non-modal: loop keeps playing and MIDI keeps sounding while it is open. | M |
| AC-REV-02 | Changing loop length, beat one, or "Count it as" never changes any note's original timestamp: toggling Original take after any correction plays the identical raw performance (compare exported "Original take" MIDI before/after: byte-identical events). | A |
| AC-REV-03 | First capture shows the inferred tempo plus **½, ×2 and Set BPM…** controls, even when inference returns one or zero candidates. Extra alternatives appear only when inference supplies them; no confidence percentages are shown anywhere. Meter defaults to 4/4. | M/A |
| AC-REV-04 | "Tap a note to set '1'" makes that note start the downbeat of bar 1. | M |
| AC-REV-05 | Notes before loop start are visible as dashed ghosts and become audible when the loop start is moved earlier. | M |
| AC-REV-06 | Dismissing, playing on > 2 bars, or pressing Capture again keeps the take; Discard shows an 8 s Undo snackbar. | A |
| AC-REV-07 | Grid correction controls are labelled differently from playback tempo; copy "Your timing is unchanged — only the grid moves." is visible under the timeline. | M |
| AC-REV-08 | Setting "After Capture: Stay silent" persists across relaunch and disables auto-loop. | A |
### Layers & sound
| ID | Criterion | Verify |
|---|---|---|
| AC-LAY-01 | The overview renders N parts without a hard-coded maximum (first slice: 1 part; milestone: ≥ 4). Target shows ◎ and the word "Target"; muted shows a dashed outline + "MUTED". | L/SR |
| AC-LAY-02 | Mute/solo do not stop the transport. | M |
| AC-SND-01 | Tapping a sound row auditions and assigns it to the target layer; Undo restores the previous sound. | M/A |
### Piano roll (core)
| ID | Criterion | Verify |
|---|---|---|
| AC-PR-01 | Active tool shown by ≥ 2 indicators (pressed chip + subtitle text). | L |
| AC-PR-02 | In Draw, tapping an existing note selects it and never deletes it. | A |
| AC-PR-03 | One-finger drag in the grid never pans; two-finger always pans/zooms in every tool. | M |
| AC-PR-04 | A second finger landing mid-move cancels the move and returns notes to their origin (no undo step created). | M |
| AC-PR-05 | Notes at 32dp lane height are selectable with ≥ 95 % first-try accuracy in the usability task (measured, not assumed). | Test |
| AC-PR-06 | Two candidate notes within 8dp of the touch point produce a picker rather than a guess. | A |
| AC-PR-07 | Every drag operation has a tap alternative: Len ±, Vel ±, nudge, loop steppers, zoom ± (WCAG 2.5.7). | M |
| AC-PR-08 | Loupe appears within 100 ms of drag start, stays fully on screen, and shows pitch, position and length as text. | M |
| AC-PR-09 | Each completed gesture is exactly one undo step with a descriptive label; Redo restores it. | A |
| AC-PR-10 | Quantise at 50 % moves each selected note start halfway to the nearest grid line; Cancel leaves notes unchanged; Original take unaffected. | A |
| AC-PR-11 | Duplicate places copies immediately after the selection's span and selects the copies. | A |
| AC-PR-12 | Hear edits on by default; toggling it off silences audition only. | M |
### Save / export / controller
| ID | Criterion | Verify |
|---|---|---|
| AC-SAV-01 | Every committed edit is saved within 3 s; status text shows "Saved". | A |
| AC-SAV-02 | Simulated write failure shows a persistent banner with Retry and Export now; edits continue in memory. | A |
| AC-SAV-03 | Force-kill then relaunch offers Open recovered / Open last saved; both remain until chosen. | M |
| AC-EXP-01 | MIDI export contains one track per non-empty layer, tempo and meter, and bar 1 = beat one. It preserves supported raw CC64, pitch bend and pressure/expression, and contains **no** synthetic panic/note-off events unless a boundary-render policy is selected. The Original-take option exports raw input times. Export length is shown and changeable. | A |
| AC-CTL-01 | Capture can be mapped to any spare CC, button or pad (no spare pedal needed). By default no mapping takes sustain (CC 64) or playable keys; mapping either shows a warning; the command zone is off unless enabled. | M |
### Accessibility & layout (all P0 screens)
| ID | Criterion | Verify |
|---|---|---|
| AC-A11Y-01 | All interactive elements ≥ 48×48dp hit area with ≥ 8dp separation (except piano-roll notes, which have expanded hit regions). | L/A |
| AC-A11Y-02 | No state conveyed by colour alone (selection, mute, readiness, target, errors). Grayscale screenshot review passes. | L |
| AC-A11Y-03 | Every control has a role + label; notes are reachable as a time-ordered list with custom actions. | SR |
| AC-A11Y-04 | At 200 % font scale, no text truncates on Play, Review, Readiness; Capture remains visible without scrolling. | L |
| AC-LYT-01 | Rotating/folding/unfolding during playback does not stop audio, close the review, or clear the selection. | M |
| AC-LYT-02 | No interactive element within 24dp of a separating hinge. | L |

## Rev 3.2 additions (PROPOSED; nothing implemented)
| ID | Criterion | Check |
|---|---|---|
| AC-RNG-01 | On Play, the take history shows real notes as pitch against time with durations, an auto-fitted pitch range, and a bar ruler (estimated or set) or a seconds ruler in free time. Layer cards stay visible in every range state. | L |
| AC-RNG-02 | **One-action success:** for the scripted four-chord test phrase (with a pickup), one Capture loops all four chords with no handle touched. The handle path is never required for the common case; the auto-proposal hit rate is measured in testing, not assumed. | M/U |
| AC-RNG-03 | When the auto-range is short (e.g. only the last chord), dragging ⟦ back to bar 1 takes one drag and no other touch. | U |
| AC-RNG-04 | Dragging ⟦ changes loop length with the end fixed; dragging ⟧ changes length with the start fixed. Slide keeps the length exactly and shifts beat one only. Neither changes any raw event's time or pitch (byte-compare raw take before/after). | A |
| AC-RNG-05 | Cutting, deleting or moving notes is impossible from the range handles; it exists only in Edit, behind an explicit tool choice, and is undoable. | L/A |
| AC-RNG-06 | Handles: ≥ 48 × 48 dp tab plus ≥ 48 dp-wide grab zone; a touch inside a handle zone never pans; a magnifier keeps the boundary visible above the finger; a second finger cancels and reverts. | L/M |
| AC-RNG-07 | Snap to onsets/beats/bars/off works; one-drag override (slide up / Ctrl-Cmd) gives unsnapped placement. In free time, only onset snapping exists and no barlines are drawn. | A/M |
| AC-RNG-08 | The view follows live input; pan, pinch or holding a handle pauses following and shows Back to live; Back to live (or `L`) resumes; Capture resumes following. Edge auto-scroll works while dragging. | M |
| AC-RNG-09 | A pickup before bar 1 is kept and shown; under the PROPOSED repeating-pickup behaviour (not an engine contract; first-pass-only is open, spec OQ-1) it plays before each repeat; a note held across the loop end is clipped for playback only, and the exported raw take keeps its full length. | A |
| AC-RNG-10 | Every range edit, slide and label toggle is one undo step; the toast offers Undo for ≥ 6 s (provisional until device testing) and the ↶ button always works. | A |
| AC-RNG-11 | Screen reader: handles are sliders announcing position and length; actions move by note, beat and bar and slide phase. Keyboard: `[` `]`, arrows (+Alt beat, +Shift bar), `S`, `,` `.`, `L`. | SR/K |
| AC-HAR-01 | Harmony labels and role tags are off-by-toggle, ≤ 15 px, never cover notes, fade during handle drags, and show uncertain alternatives as text ("or Dm9/G") at lower emphasis, never as percentages. Optional and research-gated; until then mock data only. Arpeggio and bass tags are deliberately not drawn. | L |
| AC-SET-01 | Appearance defaults to **System** on first run and follows OS/browser changes live. | A |
| AC-SET-02 | Switching System/Light/Dark re-themes instantly and never interrupts audio, playback, the loop phase or MIDI input (no glitch in a loopback recording across 20 switches). | M/A |
| AC-SET-03 | The appearance choice persists across relaunch on that device. Settings is reached from the Blocks ⌄ menu and never appears on the play surface. | A/L |

## Stage P1
| ID | Criterion |
|---|---|
| AC-P1-01 | **Required later milestone.** Aligned stems share one start and a common duration plus tail; the tail follows each preset's actual envelope/decay and the user's choice (no universal 2 s). The default export length is visible and configurable. Rendering tests pending. |
| AC-P1-02 | Controller mapping grows with later gates: Play/Stop, Undo/Redo, sound stepping and target/new layer, each with conflict warnings (sustain, playable note, existing mapping) and a timeout. |
| AC-P1-03 | **Required later milestone (full touch selection).** Range tool: Duplicate range / Delete range / Loop to range act across all pitches. |
| AC-P1-04 | **Required later milestone (full touch selection).** Chord select and key-ruler pitch select. |
| AC-P1-05 | Velocity lane drag with relative multi-note change shown as text. |
| AC-P1-06 | Quantise swing; "Tap the beat" grid correction. |
| AC-P1-07 | Tabletop posture layout (content top, controls bottom). |
| AC-P1-08 | Desktop three-region layout with full shortcut set and visible shortcut hints. |
| AC-P1-09 | Count-in option for capture-while-stopped. |
