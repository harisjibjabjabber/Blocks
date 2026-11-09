# Portable synth core - engineering spike

Original C++17 DSP, independent of Blocks, UI frameworks, Web Audio and plugin SDKs. A C ABI is the host boundary: native hosts link the static library; the browser host compiles the same source to WebAssembly. This is not a finished VST plugin or an analogue circuit emulation.

Implemented: 16-note polyphony; per-oscillator sine/triangle/saw/pulse selection; detune and pulse width; curved ADSR; one-pole low-pass; seeded per-voice pitch drift; soft drive; per-note Pitch Drop; bounded Fullness harmonic enrichment. No unison, resonance, user-loaded wavetables, sampler, EQ, reverb or automation editor yet.

## Native build

```sh
cmake -S packages/synth-core -B build/synth -DCMAKE_BUILD_TYPE=Release
cmake --build build/synth --config Release
ctest --test-dir build/synth -C Release --output-on-failure
cmake --install build/synth --config Release --prefix /your/install/path
```

Consumers can use `add_subdirectory` or `find_package(blocks_synth CONFIG REQUIRED)` and link `Blocks::Synth`. The public header is `blocks_synth.h`. No runtime assets are needed. Toolchain, platform and C++ standard-library linkage still apply; there are no third-party DSP or application dependencies.

## Host contract

- Create/prepare off the audio thread; render into host-owned stereo float buffers. The core allocates no heap memory during render. Call an instance from one thread at a time; queue UI updates to the audio thread.
- Pass note, pedal and physical-unit parameter events sorted by sample offset within each block. Equal-offset events retain order. Out-of-range offsets or unsorted blocks are rejected with silence; inspect the return value.
- MIDI channel and per-key FIFO ordinals preserve ownership even after a voice is stolen: the old NoteOff consumes its original ordinal instead of releasing a replacement. Panic silences immediately. Each instance owns its voices, random state, pedal state and patch.
- ABI3 exposes21 stable parameter IDs with units, ranges, defaults and linear/log/discrete mappings. IDs0-18 are unchanged; oscillator waveforms are IDs19/20. Physical values0/1/2/3 mean Sine/Triangle/Saw/Pulse; defaults remain Saw/Pulse. Discrete setters round to the nearest bounded integer. See the header for the actual contract.
- Most parameters smooth with a5ms time constant. Each oscillator has four continuously smoothed waveform weights, allowing retargeting during a held note without an abrupt enum switch. ADSR and Pitch Drop settings are captured on note-on, so those changes affect new notes.
- Patch version3 stores21 baseline values only. Notes, pedal, audio clock and transient envelopes are not saved. The setter accepts version1's18 values or version2's19 values without reading beyond that prefix. Both gain default Saw/Pulse waveforms; version1 also gains Fullness=0. The getter always writes version3 (88bytes); allocate using the current descriptor count. Unknown versions/nonfinite values are rejected atomically; finite values clamp to ranges. The reference worklet applies the same migration.
- Reset clears voices and restores deterministic drift state while retaining parameters. The host owns transport and timing; the core has no wall-clock timer or Blocks tape state.

`tests/core_tests.cpp` exercises mappings, patch rejection, sample offsets/order, bounded output, sustain/overlap ownership, isolation, render allocation and block-size invariance. `tests/render_wav.cpp` produces a reproducible three-second fixture. CI compares native and WebAssembly PCM with a maximum two-unit PCM16 tolerance; exact cross-platform floating-point identity is not promised.

## Waveforms and bounded voice ownership

Sine uses an immutable2048-point table with linear interpolation. Triangle uses eight immutable Fourier tables (odd harmonic limits1/3/7/15/31/63/127/255), with continuous interpolation between safe adjacent tables. Retained partials stay below0.45 times the sample rate; tables are compiled into the binary and shared read-only between instances. There is no initialization-time harmonic synthesis or per-sample harmonic summation. Saw and pulse retain the original PolyBLEP implementation. Interpolation and nonlinear drive have finite aliasing error; this is not an alias-free claim. Sine/triangle tables have zero mean. Legacy variable-width pulse retains its original DC component in the dry path for compatibility.

`tests/generate_wave_tables.py` regenerates the original mathematical tables using Python's standard library. General background is [Julius O. Smith, Wavetable Synthesis](https://mail.dsprelated.com/freebooks/sasp/Wavetable_Synthesis.html); the implementation and tables here are original and no external DSP code was copied.

Waveform changes crossfade weighted outputs with a5ms time constant and keep oscillator phase continuous. Weights normalize to one and eventually snap to exact one-hot values, allowing the original dry Saw/Pulse path to remain bit-identical after reset or a settled selection.

Voice stealing prefers quiet released voices, then pedal-held voices, then oldest held voices. A stolen voice gets a3ms snapshot fade in one of16 extra fixed slots. The replacement starts at its exact NoteOn sample while the old contribution fades. If all tail slots are occupied, the quietest remaining level x velocity x remaining-time tail is replaced, with deterministic first-slot tie breaking. This keeps memory/work bounded; it does not promise zero clicks under tail overflow. Tails do not add playable polyphony or unison and are excluded from `bs_active_voices`. Panic clears both pools immediately. Fixed per-channel/key64-bit on/off ordinals cost32KiB per instance; counter overflow resets voice/ownership state safely rather than wrapping.

## Fullness: same-phase harmonic enrichment

Fullness now adds a small bounded harmonic residual to the ACTUAL oscillator mix, before the existing Tone filter and Drive stage. It no longer replaces the dry foundation with a separately phased or separately filtered signal. For oscillator mix x, the residual is:

```
h(x) = 0.12*x*x + 0.20*(x*x*x - 0.75*x)
enriched = x + Fullness * DC_block(ADAA(h(x)))
output path = existing one-pole Tone -> existing tanh Drive -> envelope/pan/output
```

The residual input is bounded to[-1,1]; its analytic primitive extends continuously outside those bounds. For a unit sine, the cubic-minus-linear term has no fundamental and adds a third harmonic; the quadratic adds an even harmonic. Other amplitudes/waveforms can change the fundamental modestly. A10Hz DC blocker removes the residual's bias only. The original dry signal and its DC behavior remain untouched. Residual history stays current while bypassed, avoiding stale-state reactivation. There is no automatic gain pumping, pitch-dependent attenuation, phase rotation, four-pole wet path, resonance or transistor model.

The original polynomial/primitive are in `src/fullness.h`. First-order antiderivative antialiasing follows equation9 of [Parker, Zavalishin and Le Bivic, DAFx2016](https://www.dafx.de/paper-archive/2016/dafxpapers/20-DAFx-16_paper_41-PN.pdf). No external implementation was copied. ADAA reduces aliasing and adds a small delay/filtering effect to the residual; arbitrary nonlinear processing is not alias-free.

This intentionally changes Fullness>0 timbre from the earlier prototype. The previous path's phase and RMS compensation assumed coherent oscillator phases. Long detuned factory notes broke that assumption: Velvet lost about9-11dB at maximum Fullness. A proposed65% wet cap still lost7-8dB and was rejected. The current design removes that faulty assumption instead of adding output gain. It is a corrective harmonic-body prototype, not a claim of Moog warmth or circuit equivalence. At high Drive, existing saturation can mask this subtle enrichment; musical listening remains a separate acceptance gate.

Fullness=0 retains the original dry signal and arithmetic. The legacy three-second WASM PCM16 fixture remains byte-identical, SHA256 `17ad3d934576286d4a1f5384b90e57ec6969ecc3d6b6ce590abd0f46ac63bc56`. `BS_FIXTURE_FULLNESS=0` selects it. The normal harness uses0.55 to exercise the current enrichment path in native/WASM comparisons. The former0.55 golden sound is intentionally superseded, although the patch schema is still ABI3.

## Measured checks and limits

Local measurements: Emscripten7.0.0 / Node22.23.4 WASM on Windows x64. These are controlled fixtures, not universal loudness/alias/CPU specifications.

- Eight-second detuned four-note chords in the user's sustained reference and Velvet/Glass/Low Tide fixtures, with Fullness0/0.5/1: maximum AC RMS level change0.406dB. The reference retains drift20cents, speed0.58Hz and detune4.8cents. Tests reject changes beyond1.5dB.
- The user's separate zero-sustain decay fixture covers MIDI48/60/72/84/96 and stays within1.5dB. This deliberately tests both short attacks and long phase-diverging notes.
- Sine/Sine, Drive1, MIDI60: fundamental ratio0.9909, added second harmonic amplitude0.00210. The output changes without materially suppressing the fundamental.
- An isolated coherent11.73kHz sine sends the cubic's third harmonic above Nyquist. Current-residual ADAA reduces folded non-harmonic power28.56dB compared with the same residual sampled directly. This does not measure the entire synth's alias spectrum.
- Sixteen waveform pairs x MIDI36/60/84 x Fullness0/0.25/0.5/0.75/1 produce240 finite signals. No intermediate RMS/fundamental dip below the quieter endpoint was observed in this mix0.35/width0.5/zero-detune grid. Long detuned fixtures above cover the previously missed condition separately.
- Held-note waveform retargeting during an unfinished fade is exactly block invariant at blocks127/256. Maximum adjacent-sample change in the tested sweep is below0.022. This is a regression bound, not a universal click specification.
- A coherent5.895kHz triangle fixture has folded non-harmonic power below one thousandth of the naive triangle. Table-tier boundary changes are below0.000000003 for an infinitesimal frequency crossing.
- Released/pedal priority, stolen same-key FIFO, first-sample single-steal continuity,64 dense steals overflowing tails, panic, maximum parameters at8kHz, instance isolation, deterministic reset and zero render allocations pass.
- Sixteen voices at48kHz, one second of audio: approximately81ms with Fullness off and87ms at1 in one local warmed run. Timings are printed without a machine-dependent pass threshold. These are not phone or plugin-host CPU guarantees; use the separate benchmark for distributions and dense event spikes.

## Offline auditions and timing

`blocks_synth_auditions` and `blocks_synth_benchmark` are optional CMake targets. From the repository, `node scripts/render-synth-auditions.mjs` produces five six-second actual-core WAVs and exact patch/event/source-hash manifests; factory patches are checked against the web host's shared preset definitions. Files use fixed output gain, not individual normalization. `node scripts/benchmark-synth.mjs` measures 24 cases across 1/8/16 notes, two waveform pairs, Fullness 0/0.5/1 and dense stealing, with per-block percentiles and maxima. These are offline hosts, not device or UI measurements.

One local Windows x64 / Node 22.23.4 / Emscripten 7.0.0 run at 48 kHz and 128-frame blocks measured roughly 75–95 ms per audio second for steady 16-note cases and 102–121 ms with dense retriggers. The largest recorded render block was 0.72 ms against a 2.67 ms audio-block duration. These figures exclude AudioWorklet messaging/copies, UI, devices and thermal effects, and must not be used as phone guarantees. CI records timings without a machine-dependent pass threshold.

## Independent release path

Prove sound and CPU budget on phones, review dense-steal behavior and filter quality, then freeze the parameter/preset contract. A VST3 adapter can wrap this core with processor/controller, host automation, state persistence and editor; it needs SDK integration, validation and platform packaging. The browser adapter is already a separate host. Neither host should put UI types or Blocks layer objects into this library. A researched ladder-inspired Tone stage would be a separate future design, not a renamed claim about Fullness. Licensing, branding, installers and release signing need an explicit distribution decision before publishing a standalone product.
