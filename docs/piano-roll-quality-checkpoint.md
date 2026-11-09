# Blocks build review — storyboard restoration

9 November 2026. Branch: `codex/piano-roll-quality`. Draft PR: https://github.com/harisjibjabjabber/Blocks/pull/1

## What changed

The earlier editor introduced an unsupported layout and confusing controls. Its scoped UX approval was withdrawn after the user's rejection. This revision follows the handover's frame 18 layout: title and layer identity, settings bar, dominant roll, visible velocity lane, context controls and Draw/Select/Erase with compact outlined Capture. Desktop uses a layer/tool rail and inspector; narrow screens retain the bottom tools. The original Graphite/Paper palette and bundled Instrument Serif, Inter Tight and Geist Mono fonts are restored. Invented headline copy was removed from Play, which now uses the actual sketch name, layer cards and next-capture target.

The user's requested amendments are real piano keys, clearer grid lines and a settings bar. Snap offers Off, Bar, straight 1/2 through 1/64, triplets and custom fractions such as 3/8 or 1/12. A complete tempo/meter grid is explicitly confirmed, with bar 1 at loop start. Move aligns to the grid by default; an optional mode preserves timing offset. Alt bypasses snap. Exact rational positions prevent triplet rounding drift. Changing settings never quantises existing notes; quantise remains a separate preview/apply action.

Single-note draw, move, resize, erase and velocity are reversible. The velocity lane now edits actual velocities. Audition remains isolated from captured MIDI, and edits update loop playback at the next seam. Original performance, controller events and silent tails are preserved.

## Review and evidence

**Independent UI/UX: PASS for restored frame-18 layout and implemented single-note flow. Full storyboard functionality and release acceptance: CHANGES REQUIRED.** The coordinator cannot replace this gate with green automated tests.

The reviewer exercised the running product and rejected clipped velocity lanes, a truncated snap field, stale pitch fitting after resize, missing loop status, an oversized Capture control and an overfilled inspector. These were corrected and retested at 1440×900, 840×1000, 390×844 and 320×740, including both themes. The grid and velocity lane fit at rest; C4 remains visible after resize; no page-width overflow was observed. All three bundled fonts loaded. Browser interaction review covered grid immutability, quantise cancel/apply/undo, drawing/undo/redo and velocity-lane editing.

Independent code review also found hidden preview state during panel changes and desktop-to-phone transitions, stale custom-snap labels, Escape handling in focused fields, and view commands replayed on another layer. These were fixed and covered by production browser checks where applicable.

Validation: web typecheck passed; 132 JavaScript tests across 19 files passed; production build succeeded with `/Blocks/` base. The expanded browser harness checks actual pointer editing, snap lattices, history and cancellation, velocity, audition isolation, recapture integrity, playback position, responsive layout and loaded fonts. It records source state, screenshots and uncaught exceptions. CI runs typecheck, the JavaScript and native host suites, production build and the browser harness; current results are attached to the PR. Windows does not have g++, so native verification comes from CI.

The prior scoped implementation was already pushed in commit `4aa1b8f`; its CI passed all steps, including native tests. The current revision's result must be read from its own CI run, not inferred from that earlier success.

## Remaining scope

This revision restores the visual hierarchy and implemented editing flow; it does not claim every storyboard behavior is complete. Chord/multiple-note selection, other-layer ghosts and below-range cues, richer selection actions, and adjustable quantise strength remain absent (current strength is honestly shown as 50%). Clipboard/full shortcut coverage, session undo, further accessibility and range gestures remain broader work.

Physical touch/Fold, USB MIDI and pedal hardware, listening/latency and deployed-build audiovisual acceptance have not been certified. The separate capture-prefix defect remains open; synthetic fixtures are not a reproduction of the user's missing take. No merge to main or deployment was performed.
