# Live effects, processor order and standalone migration — 13 November 2026

## Result

Multiple modulation sources remain independent on the same destination. Assigned dials now show a count and separate coloured ranges; the local editor exposes all sources. A real native destination for Character Pitch follows the macro’s existing nonlinear Drift/Attack Settling curves, adding deltas without changing saved values or overriding independent parameter routes. Envelope response is preserved. Browser verification combines Env 1, Env 2 and LFO 1 on this dial and observes the summed effective unit value, not just three stored assignments.

The Creative FX rack had a concrete live-update defect: repeated configuration during fade-in restarted fade-out even when the new topology was already active. Workspace control refreshes could therefore keep an effect nearly silent. Same-topology changes now update controls without restarting the topology transition; identical refreshes are cheap no-ops. Before the fix, the repeated-update fixture differed from one-shot configuration by a maximum0.060949 sample; afterward it is exact0. Delay/Reverb’s20/50ms tap transitions remain intentional.

## Real signal order

The compact Audio flow strip reorders three actual bus groups: Sauce FX (Moving Space/Impact), Harmonics and Space (Width→Delay→Reverb). Source Character/Fullness and note generators retain their place before the shared bus. The UI does not falsely imply that an entire Character or Sauce page is a movable audio stage.

A version1,16-byte native configuration stores the three-group permutation. Defaults preserve the prior processing order. A5ms fade-out, switch and5ms fade-in avoids a hard order discontinuity while each stage continues advancing its state once per sample. Delay tails are retained; Clean Sub still bypasses the effects; reported output latency is unchanged. Order supports file recall and one-step Undo. Drag previews do not mutate the engine before release; cancellation leaves saved and audio order untouched. Keyboard and touch move controls share the same state.

## Ladder optimization with preserved math

The Ladder keeps8× processing, its127-tap resamplers,15.75-sample filter latency and the same nonlinear function. At exactly zero feedback, its implicit equation reduces to u=rhs. The new branch skips redundant Newton work in that case; resonant cases retain the solver.

A frozen reference and candidate matched bit-for-bit in162 six-rate cases, including PCM, FIR/pole states, residuals and live resonance changes. In an isolated8-filter,48kHz,WASM-O2 helper benchmark, three alternating trials gave these medians:

| Resonance | Drive | Reference | Candidate | Change |
|---|---:|---:|---:|---:|
|0|1|162.20ms|119.31ms|−26.4%|
|0|12|287.49ms|179.77ms|−37.5%|
|0.7|1|257.92ms|260.08ms|+0.84%|
|0.7|12|279.10ms|281.33ms|+0.80%|

These are isolated helper timings with residual diagnostics enabled, not an app-wide CPU reduction or a safe-polyphony guarantee. No global lower oversampling, fast-math or unverified SIMD rewrite was introduced. The current ladder is a simplified scalar-feedback virtual-analog topology, not a claim to reproduce a complete Moog transistor circuit. SIMD and adaptive rates need separate performance, spectrum, transition and latency evidence. [Emscripten’s official SIMD documentation](https://emscripten.org/docs/porting/simd) describes the relevant WebAssembly facilities and platform differences.

## Validation and migration

118 frontend tests and29 focused native/WASM groups plus the public consumer pass. Native groups cover live configuration, all six neutral bus permutations, nonlinear order differences, state validation, switching boundaries, tails, Clean Sub, block invariance, allocation and Character macro audio. The browser modulation proof has17 groups and the flow proof10, including actual three-source native movement, file state/Undo and320/390/1440 touch/desktop geometry. Physical DAW/MIDI/device listening remains distinct.

The separate private [Blocks-Synth repository](https://github.com/harisjibjabjabber/Blocks-Synth) preserves the standalone browser instrument and C++ core. A direct, pinned MIT Steinberg SDK adapter starts VST3 hosting. Its current scope and validator evidence are recorded in that repository’s docs/vst3-migration.md: native tone/MIDI/automation is an initial preview; the full instrument UI and complete patch/config recall are still migration gates.
