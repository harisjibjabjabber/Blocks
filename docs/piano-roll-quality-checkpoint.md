# Blocks workflow review

9 November 2026. Branch: codex/piano-roll-quality. [Draft PR](https://github.com/harisjibjabjabber/Blocks/pull/1).

## Current behavior

The handover remains the visual reference. This revision addresses the user's subsequent rejection of editor discoverability, range controls and main-screen clutter.

- Draw MIDI is visible above the empty/live roll and creates a blank two-bar layer in Draw mode. Playback works with no captured source and requests no MIDI permission. A selected layer has visible Edit MIDI above its roll and in the fixed transport row.
- The main screen uses one time-zoom slider, Full take, drag-to-pan and pinch zoom. Full take reveals retained earlier notes and recorded silence. Wheel over the ruler zooms time; wheel over the piano axis adjusts note height. The editor also exposes time/pitch zoom controls.
- Compact bottom grips mark range endpoints. Drag across the editor ruler to set a range; drag either grip to adjust it. Grid previews and commits match. Range and note changes share ordered Undo/Redo.
- Cut range replaces the working notes in the same layer, trims crossing notes, removes notes outside the range and makes the chosen start Bar 1. Undo restores the original working notes and grid. Cutting a playing secondary layer stops it and schedules it at the shared first-loop boundary; it waits in silence until that boundary.
- Live Capture and existing-layer editing are explicit separate contexts. New performance input clears a stale pending Live range, so later Capture follows the new performance. Zoom never changes capture bounds. The automatic phrase-selection algorithm is unchanged.
- Record/Stop is an alternative to Capture. It retains the explicit recording interval, including leading silence, long rests and trailing silence. Capture is disabled during that explicit recording.
- BPM uses immediate minus/plus controls. Rulers show Bar labels with separate beat numbers. Vertical subdivisions follow the selected snap lattice, including triplets; finer detail appears when zooming in. Quantise directly applies the selected division at100% with Undo; advanced strength/swing preview remains available.
- Prior keyboard, multi-note editing, background layers, clipboard, capture deletion/Undo and storyboard typography remain.

## Verification

Web types,172 JavaScript tests across21 files and production build pass locally. The browser suite covers direct drawing from an empty project and playback, visible editor access, range/note history, exact snap positions, quantise, stale-range recovery, Record/Stop silence, same-layer cutting, full-take recovery, keyboard lifecycle and responsive layouts. It uses isolated synthetic mouse/touch input, not physical hardware or listening certification.

Department agents contributed design, implementation and QA. UX explicitly withdrew the earlier approval after the user's feedback and blocked overlapping controls. The final slider, bottom-grip and empty-editor revisions were visually checked by the coordinator at320,390 and1440 widths after the department agents reached their session usage limit. Independent UX sign-off for this latest revision remains pending; earlier UI approval must not be presented as current acceptance.

The exported build review records the final source revision and CI outcome. CI also runs native host tests; Windows has no local g++.

## Remaining scope

Takes currently remain in memory, so refreshing clears the session. Group transport, physical phone/Fold and MIDI/pedal testing, listening/latency and deployed audiovisual acceptance remain separate. Capture-prefix inference still needs its own algorithm work; this revision provides explicit recording and recovery controls without claiming that algorithm is fixed. Main and deployment remain unchanged.
