# Blocks UI v1 review

9 November 2026. Branch: codex/piano-roll-quality. [Draft PR](https://github.com/harisjibjabjabber/Blocks/pull/1).

## Delivered

The handover storyboard remains the reference: Play/history and capture range in sections 0b/0c, and frame 18 for the editor. The original palette, typography and hierarchy remain; no invented headlines or harmony data were added.

- Front-page Start/End markers select the next capture. Full-height grab zones and 48px tabs use the visible snap grid. Preview and commit agree, arrow keys move by the selected division, and cancellation restores the range. Manual selection persists while playing; Auto range and Undo range are available.
- BPM, meter and bars/beats are visible. Snap supports Off, Bar, straight divisions, triplets and custom fractions. Capture inherits exact manual bounds, including silence. Recording data stays intact. Grid phase remains stable when history expires.
- Captures have real layer cards and minirolls, deletion and Undo. Layer IDs stay unique after deletion and recapture.
- The editor opens with whole bars, piano keys and a visible velocity lane. Select supports double-click create/delete, drag move/resize, marquee and Shift selection. Draw also moves existing notes. B toggles Draw/Select. Touch double-tap selects a chord rather than deleting.
- Group move/resize, clipboard, duplicate, selection actions and session Undo are implemented. Velocity supports Set all or proportional scaling; other layers appear as optional ghosts. Quantise has explicit strength/swing and preview/apply/cancel.
- The playable bottom piano has black keys, octave controls, Major and Minor pentatonic modes and root selection. First touch starts audio without MIDI permission. Polyphony, slides, shared-key ownership and cancellation are handled.
- Keyboard-open layouts fit the roll and range tabs above the keys. Phones use a compact header; routine connection details live in Settings while sound recovery remains available.
- Short loops preserve their actual duration instead of a 400ms floor. Raw and edited playback preserve held-note/pedal context without changing recorded events. Moving the range start refreshes controller state.

## Department review and validation

Product decisions preceded engineering. UI/UX exercised the running build independently and had authority to block. QA maintained independent browser checks; the coordinator integrated fixes.

UX rejected both phone and desktop keyboard-open layouts when the dock obscured range controls. The header and plot sizing were corrected. Independent functional review verified proportional velocity, quantise apply/undo, other-layer visibility and capture deletion/restoration.

Web types, 160 JavaScript tests across 20 files, and production build passed locally. Browser checks cover exact marker snapping and Capture inheritance, short-loop wrapping, cancellation, group editing, clipboard, keyboard lifecycle, responsive layout and loaded fonts. Final source revision and CI results are recorded below after verification.

CI also runs native host tests; Windows has no local g++. Browser tests use synthetic mouse/touch input, not physical-device or listening certification.

## Remaining scope

Grouping remains the next separate step: layers stay separate and play/stop together. Physical phone/Fold, USB MIDI/pedal hardware, listening/latency and deployed audiovisual acceptance are unverified. The separate capture-prefix report needs the original missing-take reproduction; synthetic fixtures are not that reproduction. This is a draft review build; main and deployment remain unchanged.
