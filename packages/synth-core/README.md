# Portable synth core — engineering spike

Original C++17 DSP, independent of Blocks, UI frameworks, Web Audio and plugin SDKs. A C ABI is the host boundary: native hosts link the static library; the browser host compiles the same source to WebAssembly. This is not a finished VST plugin or an analogue circuit emulation.

Implemented: 16-note polyphony; PolyBLEP saw/pulse oscillators; detune and pulse width; curved ADSR; one-pole low-pass; seeded per-voice pitch drift; soft drive; per-note Pitch Drop; parallel Fullness processing with antialiased asymmetric saturation and a nonresonant four-pole filter. No unison, resonance, wavetable engine, sampler, EQ, reverb or automation editor yet. Oldest-voice stealing can click and needs refinement before release.

## Native build

```sh
cmake -S packages/synth-core -B build/synth -DCMAKE_BUILD_TYPE=Release
cmake --build build/synth --config Release
ctest --test-dir build/synth -C Release --output-on-failure
cmake --install build/synth --config Release --prefix /your/install/path
```

Consumers can use `add_subdirectory` or `find_package(blocks_synth CONFIG REQUIRED)` and link `Blocks::Synth`. The public header is `blocks_synth.h`. No runtime assets are needed. Toolchain, platform and C++ standard-library linkage still apply; dependency-free here means no third-party DSP or application dependencies.

## Host contract

- Create/prepare off the audio thread; render into host-owned stereo float buffers. The core allocates no heap memory during render. Call an instance from one thread at a time; queue UI updates to the audio thread.
- Pass note, pedal and physical-unit parameter events sorted by sample offset within each block. Equal-offset events retain order. Out-of-range offsets or unsorted blocks are rejected with silence; inspect the return value.
- MIDI channel and FIFO note ownership prevent one overlapping key release from killing all matching notes. Panic silences immediately. Each instance owns its voices, random state, pedal state and patch.
- ABI 2 exposes 19 stable parameter IDs and descriptors with units, ranges, defaults and linear/log mappings. IDs 0–17 are unchanged; Fullness is appended as ID 18, range 0–1, default 0. See the header rather than copying parameter indices into a new UI.
- Most parameters smooth over 5 ms. ADSR and Pitch Drop settings are captured on note-on, so those changes affect new notes. Pitch Drop is a per-voice envelope recipe, not a new oscillator.
- Patch version 2 stores 19 baseline values only. Notes, pedal, audio clock and transient envelopes are not saved. The setter also accepts version 1's first 18 values and supplies Fullness=0, without reading a nineteenth value. The getter always writes version 2 (80 bytes); hosts must allocate using the current descriptor count. Unknown versions/nonfinite values are rejected atomically; finite values clamp to ranges. The reference worklet similarly migrates JSON/message version 1 arrays of length 18; exports use version 2.
- Reset clears voices and restores deterministic drift state while retaining parameters. The host owns transport and timing; the core has no wall-clock timer or Blocks tape state.

`tests/core_tests.cpp` exercises mappings, patch rejection, sample offsets/order, bounded output, sustain/overlap ownership, isolation, render allocation and block-size invariance. `tests/render_wav.cpp` produces a reproducible three-second fixture. CI compares native and WebAssembly PCM with a maximum two-unit PCM16 tolerance; exact cross-platform floating-point identity is not promised.

## Fullness signal path and limits

Fullness=0 retains the original dry signal path and arithmetic. A legacy three-second WAV rendered with the new core at zero matched the pre-change PCM16 file byte for byte. `BS_FIXTURE_FULLNESS=0` selects that legacy harness fixture; the normal harness uses 0.55 so native/WASM comparisons exercise the new path.

The parallel path reverses the pulse's polarity relative to the saw to reinforce their fundamentals. The legacy mix's opposing polarities can substantially cancel the fundamental near its default mix; changing this relation only in the parallel path preserves existing patches when Fullness is off. Before blending, two fixed fat paths (original phase and quarter-cycle offset, each with independent processing state) rotate the fat fundamental toward the legacy fundamental's phase. The target uses the analytic complex first Fourier components, including pulse width; its angle is smoothed over 5 ms. Where the legacy fundamental is nearly zero and its phase is undefined, the prior orientation is retained. This avoids a hard polarity switch or a fade of the fat signal through zero. Oscillator frequencies, drift and Pitch Drop are unchanged. There is no sub-oscillator or random pitch shift in Fullness.

The phase alignment fixes a measured defect in the initial prototype: at oscillator mix 0.70 and Fullness 0.5, opposing dry/wet fundamentals caused a roughly 23 dB RMS dip on MIDI 60. Testing only Fullness 0 and 1 did not detect it. The current regression suite tests intermediate blends and both fundamental amplitude and overall RMS.

Processing is: aligned oscillator mix → asymmetric monotonic polynomial saturation with first-order antiderivative antialiasing → 10 Hz DC blocker → four cascaded stable one-pole low-pass stages → approximate level compensation → linear dry/wet blend. Saturation adds both even and odd harmonics. Per-pole cutoff compensation keeps the combined corner near the requested cutoff at lower frequencies; each pole is limited below Nyquist. There is no resonant feedback loop, circuit solver, or claim of Moog/transistor equivalence. Fullness is a designed sound path, not an analogue-model certification.

The original saturator and analytic primitive are in `src/fullness.h`. The antialiasing method follows equation 9 of [Parker, Zavalishin and Le Bivic, DAFx 2016](https://www.dafx.de/paper-archive/2016/dafxpapers/20-DAFx-16_paper_41-PN.pdf). No external implementation was copied. First-order ADAA reduces aliasing and introduces a small delay/filtering effect; it does not make arbitrary nonlinear processing alias-free.

Measured fixtures, Emscripten 7.0.0 / Node 22.23.4 WASM on Windows x64:

- Fullness 0 versus 1, oscillator mix 0.15/0.35/0.70, pulse width 0.5, no detune/drift, MIDI 36/60/84: level changes ranged from −0.74 to +0.31 dB. Tests allow ±2 dB. This is approximate, fixture-based compensation, not universal loudness normalization across all patches.
- Default mix, MIDI 36/60/84/96: RMS ratios were 0.963/0.990/1.036/1.036; absolute measured DC was below 0.000009. Tests check the expected fundamental, nearby-frequency rejection and unchanged oscillator tuning. Harmonic balance intentionally changes.
- A coherent 5.895 kHz sine through the isolated saturator produced 8.54 dB less folded non-harmonic power with ADAA than the same shape sampled directly. This is one reproducible comparison, not a full synth aliasing specification.
- A 135-point grid covers Fullness 0/0.25/0.5/0.75/1, mixes 0.15/0.35/0.70, pulse widths 0.25/0.5/0.75 and MIDI 36/60/84. The worst intermediate RMS dip below the quieter endpoint was 2.66 dB; the worst fundamental dip was 0.013 dB. Fifteen additional Low Tide fixture points (680 Hz cutoff, −3 cents detune, Character 0.6) had worst intermediate dips of 0.12 dB RMS and 0.015 dB fundamental. Tests reject dips exceeding 3 dB below either endpoint's lower value. This does not promise monotonic loudness or universal matching: the Low Tide MIDI 84 wet endpoint itself is approximately 5 dB quieter because of the different filter response.
- Sixteen voices at 48 kHz, one second of audio: roughly 77–83 ms with Fullness off and 107–112 ms at 1 with both phase paths in local warmed runs. The test prints timings without a machine-dependent pass threshold. These measurements are not phone or plugin-host CPU guarantees.

Tests also exercise maximum drive/Fullness at 8 kHz, zero render allocations, release/panic, patch migration, deterministic reset and exact block-size invariance with automated Fullness, mix and pulse-width changes. The tested mix/width sweep has a maximum adjacent-sample change below 0.02; this is a regression bound, not a universal click-free certification. Oversampling, resonance, physical-device listening and a broader alias/CPU sweep remain future quality gates.

## Independent release path

First prove the sound and CPU budget on phones, refine voice stealing and filter quality, then freeze the parameter/preset contract. A VST3 adapter can wrap this core with processor/controller, host automation, state persistence and editor; it needs SDK integration, validation and platform packaging. The browser adapter is already a separate host. Neither host should put UI types or Blocks layer objects into this library. Licensing, branding, installers and release signing need an explicit distribution decision before publishing a standalone product.
