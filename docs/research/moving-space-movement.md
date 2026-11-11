# Moving Space: independent envelope and LFO movement

Implemented 11 November 2026 following the user's request. Moving Space now combines independently signed audio-envelope and shared-LFO contributions. This extends the [creative effects follow-up](space-creative-and-punch-followup.md); it does not add another oscillator clock to each block.

## Controls and behavior

The compact card has Mix, **Env** and Space. Env is the existing `motion` field, now−1..1, default+.45. It follows the actual stereo input envelope at that point in the creative bus, not the synth's ADSR curve. Negative depth reverses its bend. Its prior positive default sound remains unchanged.

Under Details, **LFO movement** can assign any existing LFO, including extra Sauce LFOs. Each assignment has signed Depth, explicit shared On/Off, Edit and Remove. New routes start at0 and do not automatically enable their source. Edit opens that actual generator's existing drawable shape, Free/BPM Sync and optional Retrigger controls. Shared power and shape edits affect its other destinations too. Multiple sources may feed the same block, each with its own depth; the route-capacity limit is explicit.

Use Env for motion tied to a pluck/hit, an LFO for sustained movement, or both together. On/Off/bypass and editing preserve generator phase. Note-trigger reset happens only if the source's existing Retrigger option is enabled. Disabled sources continue advancing according to the existing LFO contract.

## Engine contract

- Creative config remains48-byte nodes/776-byte rack; no extra field or private LFO state was introduced. `motion` now accepts−1..1 instead of0..1.
- Existing2232-byte Modulation v3 gains destination kind3: stable Moving Space ID, parameter0, signed depth. Browser kind is `effects`.
- Source waveform, source intensity and route depth produce the same sample-clocked value used elsewhere. Stable source-ID summation preserves exact behavior when sources are reordered. All LFO contributions sum before they meet the independent envelope contribution and before the final±4ms movement bound/.45sample-per-frame slew.
- Two equal opposite routes cancel exactly; no route, zero depth, disabled source and missing native target are inert. Impact does not consume these offsets. The saved baseline Env value is never overwritten by modulation.
- Source configuration changes retain clocks by stable ID. Source cross-modulation still uses its complete previous-sample snapshot. No render/configuration allocation was added.
- UI deletion prunes only routes to the removed effect; one Undo restores both target and routes. Current-file import rejects invalid/missing destinations before changing the live patch. General Creative/Suite/Bass/Reverb parameter mapping remains future work.

## Focused verification

Six processor groups pass: signed envelope reversal, LFO-only sustained motion, exact cancellation, combined bounds at8–384kHz, unchanged default/dry behavior, external clock continuity and no allocation. Unit diagnostics report actual bounded tap displacement; there is no simulated phase display.

Five actual CAPI/engine groups pass: kind3 validation/waveform/intensity/depth, all24 source permutations, zero/cancel/orphan exact audio, independent live depths without note/clock/baseline changes, and120/240BPM plus optional note retrigger. Actual held-note matched-waveform differences were1.216 for LFO movement,1.148 for reversed LFO depth and1.309 for opposite Env depths. These establish processing differences, not a subjective sound-quality verdict.

Existing Modulation v3, Modulation and Creative rack integration regressions pass. All93 frontend tests pass. The new11-group actual-browser proof passes native readback, pointer cancellation, reset/Undo, shared power/editor ownership, multiple sources, capacity, orphan pruning, file roundtrip and320/390/1440 layout checks. A final live-audio smoke verified clean header punctuation and the native route; older malformed arrow/sharp text literals were also repaired. Independent UI review passed the actual320/390/1440 screenshots and control proof; listening preference remains open.

Evidence: workspace `work/phase13-review/moving-modulation.log`, `work/phase15-moving-lfo-node.log`, `work/phase15-moving-lfo-evidence/moving-lfo-proof.json`, and `work/phase15-text-smoke/report.json`. New native regressions are registered in CMake and the WASM runner; CI now includes35 functional targets.
