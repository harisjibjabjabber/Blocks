# Blocks — gestures, input ownership and equivalents (PROPOSED, rev 2; §9 rev 3.2; §10 rev 3.3)
**All thresholds and sizes below are proposals pending measurement on device.** Rev 2 applies the lead decisions (see `CHANGELOG.md`).

## 1. Ownership rules (conflict-free by construction)
| Pointer count | Where | Owner | Notes |
|---|---|---|---|
| 1 finger | Note grid | **Current tool** (Edit / Draw / Range) | Never scrolls the grid. |
| 1 finger | Time ruler / key ruler | **Navigation**: pan along that axis | Double-tap a ruler = zoom to fit loop / pitch range. |
| 1 finger | Overview strip | Pan (drag the viewport window); tap = jump | |
| 1 finger | Loop brace handles (48 hit) | Loop start/end | Has priority over the ruler pan inside its hit area. |
| 1 finger | Velocity lane | Select/adjust the velocity of the note under the stem (drag: P1) | |
| 2 fingers | Anywhere in the editor | **Navigation**: pinch zoom + pan | The axis is locked by the initial finger-separation angle: < 30° from horizontal = time zoom; > 60° = pitch zoom; between = both. |
| 2nd finger arrives during a 1-finger edit | Grid | Cancels and reverts the edit, then navigates | Prevents accidental moves while zooming. |
| 3 fingers | — | Unused (reserved for OS) | |
| Any | Play screen ribbon | Horizontal drag scrubs the ribbon view only; Capture is unaffected | The ribbon never edits. |
| Any | On-screen keys | Instrument. "Swipe: Play" = glissando; "Swipe: Scroll" = change octave view | Mode is shown as text on the toggle. |

Thresholds: slop 8dp; long-press 500 ms; double-tap 300 ms; momentum pan on; edge auto-scroll zone 32dp.

## 2. Piano-roll gesture table
| Gesture | Edit tool | Draw tool | Range tool |
|---|---|---|---|
| Tap empty | Deselect all | Add note (last length, snapped, offset 0) + audition | Clear range |
| Tap note | Select only this (audition) | Select only this (never delete) | Select the note's time span |
| Tap note while "＋Add" quasimode held, or long-press note | Toggle in selection | Toggle in selection | — |
| Drag note body | Move selection (time snap, offset kept; pitch by lane) | Move selection | Extend range |
| Drag note handle (L/R) | Resize start/end of all selected | Same | — |
| Drag empty | Marquee select | Add note, drag sets length | Select time range |
| Double-tap note | Select the chord (same start ±1/32) | Same | — |
| Tap key on key ruler | Select all notes of that pitch in view | Same | — |
| Ambiguous tap (2 candidates within 8dp) | Picker listing candidates | Picker | — |
| Pinch / 2-finger drag | Zoom / pan | Zoom / pan | Zoom / pan |

Delete, Duplicate, Quantise, Len ±, Vel ±, Nudge and Transpose are **actions in the action bar**, not modes.

## 3. Selection and resize visual states (non-colour)
| State | Visual | Assistive output |
|---|---|---|
| Idle note | Filled, 1dp outline | "Note E3, bar 1 beat 3, eighth, velocity 72" |
| Selected | 3dp outline + light fill + handle tabs + "3 selected" badge | "… selected" |
| Pressed / dragging | Note lifts (shadow), dashed ghost at origin, loupe with readout | Live region: "moving to F3, bar 2 beat 1" (throttled 4/s) |
| Resizing | Handle highlighted, ghost of old length, readout "len ¼ → ½" | "length half" |
| Marquee | Dashed rectangle, notes inside outlined | "4 notes in selection" on release |
| Muted layer / deactivated | Dashed outline + "MUTED" text | "muted" |
| Invalid drop (out of range) | Ghost with ✕ + text "out of range" | "can't place here" |

## 4. Touch / keyboard / controller equivalents
| Action | Touch | Keyboard (web / Fold w/ keyboard) | Controller (learnable) | Screen reader |
|---|---|---|---|---|
| Capture | Capture button | C | Any spare CC/button/pad (optional, first gate; no spare pedal needed) | Button "Capture, last 8 bars to layer 2" |
| Keep review | Keep / dismiss / play on | Enter | Learnable (later gate) | Button |
| Discard review | Discard | Backspace in review | Learnable (later gate) | Button, undo announced |
| Play / Stop | Transport | Space | Learnable (later gate) | Toggle button "Playing" |
| Undo / Redo | Buttons | Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z | Undo/Redo learnable (later gate) | Button with label "Undo move 3 notes" |
| Target / new layer | Tap slot | 1–4 (Play view) | Learnable (later gate) | Radio group "Target layer" |
| Change sound | Sound chip → row | Ctrl/Cmd+K, arrows, Enter | Next/Prev learnable (later gate) | List |
| Loop length | Chips / brace drag | [ and ] | — | Adjustable "Loop length 8 bars" |
| Beat one | ◀ beat / beat ▶ / tap note | , and . | — | Adjustable "Beat one, offset 1 beat" |
| Tool switch | Chips | E / D / R | — | Radio group |
| Select next/prev note | Tap | Tab / Shift+Tab (time order) | — | Swipe through list |
| Move note | Drag body | Arrows (grid step), Shift+arrows (octave/bar) | — | Custom actions "earlier, later, up, down" |
| Resize | Drag handle / Len ± | Alt+←/→ | — | Custom actions "longer, shorter" |
| Velocity | Vel ± / lane | V then ↑↓ (±1), Shift (±10) | — | Adjustable, ±10 steps (cf. S11) |
| Duplicate | Action bar | Ctrl/Cmd+D | — | Action |
| Delete | Action bar | Delete | — | Action |
| Quantise | Quantise… | Q | — | Dialog |
| Zoom | Pinch / ruler double-tap / +− in ⋯ | Ctrl/Cmd + / − | — | Buttons "Zoom in time" |
| Pan | 2-finger / rulers / overview | Scroll wheel, Shift+wheel | — | Buttons "Scroll later" |

## 5. Screen-reader structure
- Play screen order: Readiness → Ribbon summary ("Last 2 minutes 10 seconds kept, last note 2 seconds ago") → Target layer group → Transport → Capture.
- The piano roll exposes notes as a **list in time order** (not 2-D hit-testing). Each item: "Note D4, bar 3 beat 2, eighth, velocity 84, selected". Custom actions: select, earlier, later, up semitone, down semitone, up octave, longer, shorter, louder, softer, delete, duplicate, audition [S36 for accessibilityActions; S11 for precedent].
- Live region (polite): capture results ("Captured 8 bars at 92 BPM to layer 2, looping"), save failures (assertive), device changes.
- All state carried by colour also has text or shape (WCAG 1.4.1 [S18]); all drags have single-tap alternatives (WCAG 2.5.7 [S19]).

## 6. Controller mapping policy (lead decision)
- No takeover by default: sustain (CC 64) and playable keys are never mapped unless the user explicitly chooses to map them, after a warning.
- An **optional command zone** (for example a key range the user gives up) is off by default and must be explicitly enabled.
- Mapping grows with gates: Capture first. Play/Stop, Undo/Redo, sound stepping and target/new layer follow in later gates; they are deferred, not dropped.
- Touch keys are source-tagged in the same capture pipeline and never count as device readiness.

## 7. Selection persistence
Note/event IDs are stable across derived edits and re-inference (A12), so a selection survives grid changes, quantise and undo/redo. Full touch selection (Range, chord and pitch select, velocity-lane drag) is a **required later milestone**.

## 8. Sizes and rationale (dp, proposals pending measurement)
| Element | Size | Rationale |
|---|---|---|
| Minimum hit target | 48×48, 8 gap | Android guidance [S15]; ≥ 1 cm NN/g [S21] |
| Edge / corner controls | ≥ 56 | Corners need ~12 mm vs ~7 mm centre [S24] |
| Capture button | 112 tall, full width (portrait); 192×236 rail (landscape) | Primary, used eyes-off; centre/bottom preferred [S24] |
| Transport buttons | 56 | Frequent, near edges |
| Layer slot | ≈82×56 (phone strip); 112–142 rows in overview | Holds number + state text; rows hold thumbnail + M/S |
| Key lane | 32 default, 16–64 zoom, edit disabled < 24 | 24 CSS px floor [S17]; hit area expanded to 48 |
| Note handle | 24 visible, 48 hit, outside short notes | Short notes remain movable |
| Loupe | 120×80, ×2.5, 96 above finger | Finger obscures target [S23] |
| On-screen white key | ≥ 44 wide, 160–200 tall | Playable at speed; HIG 44pt [S16] |
| Sheet max height | 60 % (compact height), 85 % otherwise | Keeps the loop context visible |
| Type | 14 / 16 / 20 / 24 / 32 sp | 16 body; 32 Capture label |

## 9. Take history / capture range (rev 3.2, PROPOSED)
**Every numeric value in this table (48 dp zones, 72 dp magnifier offset, 40 dp slide-up override, 32 dp edge zone, zoom limits, ≥ 6 s Undo toast) is provisional until device testing** (spec §0b.9 OQ-3).

| Input | Where it starts | Result | Snap / override | Follow |
|---|---|---|---|---|
| 1-finger drag | Inside ⟦ zone (48 dp wide, full roll height, or the 48 × 48 dp tab) | Moves loop **start**; **end fixed → length changes**. Magnifier above finger, offset 72 dp up (provisional). | Onsets + bars (grid) / onsets (free time). Slide finger ≥ 40 dp up (provisional) = fine, no snap. Desktop Ctrl/Cmd = no snap. | Pauses; Back to live shown |
| 1-finger drag | Inside ⟧ zone | Moves loop **end**; start fixed → length changes | same | Pauses |
| 1-finger drag | Slide control, or either handle while *Slide (phase)* is on | Both handles move together: **length kept, beat one shifts** | Beats (default), onsets; ‹ › buttons step one beat | Pauses |
| Handle drag within 32 dp (provisional) of roll edge | — | Edge auto-scroll, speed ∝ depth (provisional) | — | Paused |
| 1-finger drag | Anywhere else on the roll or the overview strip | Pan through retained history | — | Pauses |
| Pinch | Roll | Zoom time (min ≈1 bar / 4 s, max all retained history; provisional) | — | Pauses |
| 2nd finger during handle drag | — | Cancel drag, revert range | — | — |
| Tap | Back to live › | Jump to the live edge and resume following | — | Resumes |
| Tap | Note on Play | Nothing (no accidental edits) | — | — |
| Long-press | Note on Play | Open Edit at that time (destructive edits live there) | — | — |
| Tap | Aa labels chip | Toggle chord labels and role tags | — | — |
| Tap | Undo toast (shown ≥ 6 s, provisional) / ↶ | Undo last range / slide / label change | — | — |

Keyboard and screen-reader equivalents: see `spec.md` §0b.7. While a handle is held, chord labels fade out so the notes under the finger stay readable. Handles win over pan by construction: hit-testing checks handle zones first.


## 10. Full-screen editor ownership (rev 3.3, PROPOSED)
Supersedes §1–2 inside the full-screen editor where they differ (tools are now **Draw / Select / Erase**). **Every number here is provisional until device testing** (spec OQ-3).

| Input | Where | Draw | Select | Erase | Notes |
|---|---|---|---|---|---|
| 1-finger tap | Empty grid | Add note (last length, snapped) | Deselect all | — | One finger always acts per tool; never pans |
| 1-finger tap | Note | Select it (never deletes) | Select only it | Erase it | Audition if Hear edits ♪ on |
| 1-finger drag | Empty grid | Add note, drag sets length | **Marquee** select | Swipe-erase notes crossed | |
| 1-finger drag | Selected note body | Move | **Move pitch + time** (snap 1/16, offset kept) | Erase | Loupe + readout above finger |
| 1-finger drag | End handle of selected note (48 dp hit, provisional) | Resize | **Resize** (start fixed) | — | Readout "1 → 1½ beats" |
| Long-press / add-quasimode tap | Note | Toggle in selection | Toggle in selection | — | |
| Double-tap | Note | Select chord | Select chord (same start ±1/32) | — | |
| Tap | Key column | Select all notes of that pitch | same | — | |
| 1-finger drag | Velocity group bar (24) | — | Scale selected velocities proportionally | — | Numeric readout updates live |
| 1-finger drag | Ruler | Pan time | Pan time; Shift-drag (desktop) = time range | Pan time | **Loop bracket is read-only (🔒)** |
| 2-finger drag / pinch | Anywhere in the editor | Pan / zoom | Pan / zoom | Pan / zoom | **Always navigation** |
| 2nd finger during a 1-finger edit | Grid | Cancel + revert | Cancel + revert | Cancel + revert stroke | Hint "Second finger cancels and reverts" |
| Tap | Tool button | Switch tool | | | Active tool filled + ✓ (non-colour) |
| Tap | ↶ / ↷ | Undo / redo one labelled step | | | Shared sketch history (A10) |
| Tap | ‹ Play / system Back | Return to Play; loop never stops | | | Session Undo toast on Play |

Mouse (desktop): drag empty = marquee, Shift-click = add, double-click = chord, Alt-drag = no snap, wheel = scroll, Ctrl/Cmd-wheel = zoom. Keyboard: `D` `S` `E` tools; ↑↓ pitch (Shift octave); ←→ grid step (Alt no snap); Shift ←→ length; Ctrl/Cmd `A` `C` `V` `D`; Delete; `Q` quantise preview; `V` then ↑↓ velocity ±5; Ctrl/Cmd `Z` / Shift `Z`; Space play/stop; Esc back to Play.
