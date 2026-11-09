# Portable synth core - engineering spike

Original C++17 DSP, independent of Blocks, UI frameworks, Web Audio and plugin SDKs. A C ABI is the host boundary: native hosts link the static library; the browser host compiles the same source to WebAssembly. This is not a finished VST plugin or an analogue circuit emulation.

Implemented: 16-note polyphony; per-oscillator sine/triangle/saw/pulse/square selection and independent levels; detune and pulse width; curved amplitude and filter ADSRs; one-pole low-pass with dry/wet mix; seeded per-voice pitch drift and settling; soft drive; per-note Pitch Drop; bounded Fullness harmonic enrichment. No unison, resonance, user-loaded wavetables, sampler, EQ, reverb or automation editor yet.

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
- ABI 4 exposes 35 stable parameter IDs with units, ranges, defaults and linear/log/discrete mappings. Waveforms at IDs 19/20 use physical values 0/1/2/3/4 for Sine/Triangle/Saw/Pulse/Square; defaults remain Saw/Pulse. Square fixes duty at 50%; Pulse alone follows pulse width. Discrete setters round to the nearest bounded integer. IDs 21/22 are independent oscillator levels, 23 filter mix, 24 filter-envelope amount, 25-31 its ADSR and curves, and 32-34 settling amount/time and velocity movement. See the header for the contract.
- Most parameters smooth with a5ms time constant. Each oscillator has five continuously smoothed waveform weights, allowing retargeting during a held note without an abrupt enum switch. ADSR and Pitch Drop settings are captured on note-on, so those changes affect new notes.
- Patch version 4 stores 35 baseline values (144 bytes). Notes, pedal, audio clock and transient envelopes are not saved. The setter accepts version 1's 18 values, version 2's 19, or version 3's 21 without reading beyond that prefix. Old versions derive independent levels from their Mix and receive filter mix 1, filter amount 0 and disabled new movement. Versions 1/2 receive Saw/Pulse; version 1 also receives Fullness 0. Unknown versions/nonfinite values reject atomically; finite values clamp to ranges. The worklet delegates migration to this core.
- Legacy Mix (ID 1) is a compatibility shortcut: setting it sets levels to 1-Mix and Mix. Setting either level leaves the other alone and updates exported Mix to level2/(level1+level2), or 0.5 if both are zero. Version 4 patch levels are authoritative; an inconsistent Mix field is canonicalized. Levels each span 0-1 and can sum to 2. Hosts must use an atomic target update when setting both levels. The worklet accepts `{kind:'parameter-batch', values:[{id,value},...], frame?}`: it validates the entire batch/capacity, enqueues all at one frame in caller order, or rejects all without touching the existing queue.
- Reset clears voices and restores deterministic drift state while retaining parameters. The host owns transport and timing; the core has no wall-clock timer or Blocks tape state.

`tests/core_tests.cpp` exercises mappings, patch rejection, sample offsets/order, bounded output, sustain/overlap ownership, isolation, render allocation and block-size invariance. `tests/render_wav.cpp` produces a reproducible three-second fixture. CI compares native and WebAssembly PCM with a maximum two-unit PCM16 tolerance; exact cross-platform floating-point identity is not promised.

## Waveforms and bounded voice ownership

Sine uses an immutable2048-point table with linear interpolation. Triangle uses eight immutable Fourier tables (odd harmonic limits1/3/7/15/31/63/127/255), with continuous interpolation between safe adjacent tables. Retained partials stay below0.45 times the sample rate; tables are compiled into the binary and shared read-only between instances. There is no initialization-time harmonic synthesis or per-sample harmonic summation. Saw, pulse and fixed-duty square use the original PolyBLEP implementation. Interpolation and nonlinear drive have finite aliasing error; this is not an alias-free claim. Sine/triangle tables have zero mean. Legacy variable-width pulse retains its original DC component in the dry path for compatibility.

`tests/generate_wave_tables.py` regenerates the original mathematical tables using Python's standard library. General background is [Julius O. Smith, Wavetable Synthesis](https://mail.dsprelated.com/freebooks/sasp/Wavetable_Synthesis.html); the implementation and tables here are original and no external DSP code was copied.

Waveform changes crossfade weighted outputs with a5ms time constant and keep oscillator phase continuous. Weights normalize to one and eventually snap to exact one-hot values, allowing the original dry Saw/Pulse path to remain bit-identical after reset or a settled selection.

Voice stealing prefers quiet released voices, then pedal-held voices, then oldest held voices. A stolen voice gets a3ms snapshot fade in one of16 extra fixed slots. The replacement starts at its exact NoteOn sample while the old contribution fades. If all tail slots are occupied, the quietest remaining level x velocity x remaining-time tail is replaced, with deterministic first-slot tie breaking. This keeps memory/work bounded; it does not promise zero clicks under tail overflow. Tails do not add playable polyphony or unison and are excluded from `bs_active_voices`. Panic clears both pools immediately. Fixed per-channel/key64-bit on/off ordinals cost32KiB per instance; counter overflow resets voice/ownership state safely rather than wrapping.

## Filter envelope and per-note movement

The independent filter ADSR snapshots its attack/decay/sustain/release and three bends at NoteOn. It advances even when amount is zero, so later live modulation uses the correct note position. NoteOff/pedal release starts its own release from the current filter-envelope level; it never prolongs a voice beyond the amplitude envelope. Amount and dry/wet mix remain live smoothed controls. The cutoff is `clamp(baseCutoff * 2^(amountSemitones * envelope / 12), 20Hz, 0.45*sampleRate)`, with amount from -48 to +48 semitones. Amount 0 keeps the original cutoff path. Filter state remains warm at dry mix 0; the dry/filtered blend precedes the existing Drive. Defaults: amount 0, mix 1, attack 5ms, decay 250ms, sustain 0, release 150ms, straight curves.

Settling adds a small signed, independently seeded pitch offset at NoteOn. It decays exponentially to 1% of its starting value at the chosen settling time (20ms-1s, default 180ms). Amount is 0-20 cents, default 0. Velocity sensitivity 0-1, default 0, scales the new articulation and existing drift amplitude by `(1-sensitivity)+sensitivity*velocity`; harder notes therefore move more without exceeding the selected amplitudes. While new movement is enabled, each note has a seeded drift-rate multiplier from 0.8 to 1.2. Settling amount/time, velocity scale and rate multiplier snapshot per note; existing drift amount and nominal speed stay live.

The new random stream does not consume the original drift generator. With settling amount and velocity sensitivity both zero, rate multipliers remain exactly 1 and prior drift sequencing remains intact. There is no new noise source, unison, automation lane or moving base tuning. Advanced drift still spans 0-40 cents, and there is no combined drift-plus-settling clamp; choosing a musical macro range is a host/listening decision.

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

Fullness=0 retains the dry signal path. Although independent levels permit floating-point rounding differences, the tested legacy three-second WASM PCM16 fixture has zero changed samples out of 288000, SHA256 `17ad3d934576286d4a1f5384b90e57ec6969ecc3d6b6ce590abd0f46ac63bc56`. `BS_FIXTURE_FULLNESS=0` selects it. The normal harness uses0.55 to exercise the current enrichment path in native/WASM comparisons. The former0.55 golden sound is intentionally superseded, the current patch schema is ABI 4.

## Measured checks and limits

Local measurements: Emscripten7.0.0 / Node22.23.4 WASM on Windows x64. These are controlled fixtures, not universal loudness/alias/CPU specifications.

- Eight-second detuned four-note chords in the user's sustained reference and Velvet/Glass/Low Tide fixtures, with Fullness0/0.5/1: maximum AC RMS level change0.406dB. The reference retains drift20cents, speed0.58Hz and detune4.8cents. Tests reject changes beyond1.5dB.
- The user's separate zero-sustain decay fixture covers MIDI48/60/72/84/96 and stays within1.5dB. This deliberately tests both short attacks and long phase-diverging notes.
- Sine/Sine, Drive1, MIDI60: fundamental ratio0.9909, added second harmonic amplitude0.00210. The output changes without materially suppressing the fundamental.
- An isolated coherent11.73kHz sine sends the cubic's third harmonic above Nyquist. Current-residual ADAA reduces folded non-harmonic power28.56dB compared with the same residual sampled directly. This does not measure the entire synth's alias spectrum.
- Twenty-five waveform pairs x MIDI 36/60/84 x Fullness 0/0.25/0.5/0.75/1 produce 375 finite signals. No intermediate RMS/fundamental dip below the quieter endpoint was observed in this mix0.35/width0.5/zero-detune grid. Long detuned fixtures above cover the previously missed condition separately.
- Held-note waveform retargeting during an unfinished fade is exactly block invariant at blocks127/256. Maximum adjacent-sample change in the tested sweep is below0.022. This is a regression bound, not a universal click specification.
- A coherent5.895kHz triangle fixture has folded non-harmonic power below one thousandth of the naive triangle. Table-tier boundary changes are below0.000000003 for an infinitesimal frequency crossing.
- Square equals Pulse at width 0.5 and is unaffected by the Pulse Width control. Independent level/mix alias coherence, legacy migrations and atomic worklet batches pass.
- Filter tests cover positive/negative plucks, all three curves, independent release with pedal, exact dry bypass, snapshots and live sample-accurate modulation. Pitch settling measures 16.28 cents for a hard note versus 3.27 cents for a soft note early in a 20-cent fixture; it settles to 0.00032 cents after about two seconds. Reset/block invariance and disabled-new-movement behavior pass.
- Released/pedal priority, stolen same-key FIFO, first-sample single-steal continuity,64 dense steals overflowing tails, panic, maximum parameters at8kHz, instance isolation, deterministic reset and zero render allocations pass.
- Sixteen voices at48kHz, one second of audio: approximately 91ms with Fullness off, 95ms at 1, and 130ms with filter envelope, settling, velocity sensitivity and 40-cent drift enabled in one local warmed run. Timings are printed without a machine-dependent pass threshold. These are not phone or plugin-host CPU guarantees; use the separate benchmark for distributions and dense event spikes.

## Offline auditions and timing

`blocks_synth_auditions` and `blocks_synth_benchmark` are optional CMake targets. From the repository, `node scripts/render-synth-auditions.mjs` produces five six-second actual-core WAVs and exact patch/event/source-hash manifests; factory patches are checked against the web host's shared preset definitions. Files use fixed output gain, not individual normalization. `node scripts/benchmark-synth.mjs` measures 24 cases across 1/8/16 notes, two waveform pairs, Fullness 0/0.5/1 and dense stealing, with per-block percentiles and maxima. These are offline hosts, not device or UI measurements.

One local Windows x64 / Node 22.23.4 / Emscripten 7.0.0 run at 48 kHz and 128-frame blocks measured roughly 75–95 ms per audio second for steady 16-note cases and 102–121 ms with dense retriggers. The largest recorded render block was 0.72 ms against a 2.67 ms audio-block duration. These figures exclude AudioWorklet messaging/copies, UI, devices and thermal effects, and must not be used as phone guarantees. CI records timings without a machine-dependent pass threshold.

## Independent release path

Prove sound and CPU budget on phones, review dense-steal behavior and filter quality, then freeze the parameter/preset contract. A VST3 adapter can wrap this core with processor/controller, host automation, state persistence and editor; it needs SDK integration, validation and platform packaging. The browser adapter is already a separate host. Neither host should put UI types or Blocks layer objects into this library. A researched ladder-inspired Tone stage would be a separate future design, not a renamed claim about Fullness. Licensing, branding, installers and release signing need an explicit distribution decision before publishing a standalone product.
