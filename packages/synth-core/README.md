# Portable synth core - engineering spike

Original C++17 DSP, independent of Blocks, UI frameworks, Web Audio and plugin SDKs. A C ABI is the host boundary: native hosts link the static library; the browser host compiles the same source to WebAssembly. This is not a finished VST plugin or an analogue circuit emulation.

Implemented: 16-note polyphony, independent Mono, sample-clock Curl arp and one-shot Strum; per-oscillator sine/triangle/saw/pulse/square selection and independent levels; detune and pulse width; curved amplitude and filter ADSRs; one-pole low-pass with dry/wet mix; seeded per-voice pitch drift and settling; soft drive; per-note Pitch Drop; bounded Fullness harmonic enrichment. No unison, resonance, user-loaded wavetables, sampler, EQ, reverb or automation editor yet.

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
- ABI 5 exposes 40 stable parameter IDs with units, ranges, defaults and linear/log/discrete mappings. Waveforms at IDs 19/20 use physical values 0/1/2/3/4 for Sine/Triangle/Saw/Pulse/Square; defaults remain Saw/Pulse. Square fixes duty at 50%; Pulse alone follows pulse width. Discrete setters round to the nearest bounded integer. IDs 21/22 are independent oscillator levels, 23 filter mix, 24 filter-envelope amount, 25-31 its ADSR and curves, 32-34 settling amount/time and velocity movement, 35 envelope response, 36/37 Drive/Pitch Drop enables, 38 Sauce order (0 Drive then Fullness, 1 Fullness then Drive), and 39 Fullness enable. Envelope response and enables default to 1; order defaults to 0. See the header for the contract.
- Most parameters smooth with a5ms time constant. Each oscillator has five continuously smoothed waveform weights, allowing retargeting during a held note without an abrupt enum switch. ADSR and Pitch Drop settings are captured on note-on, so those changes affect new notes.
- Patch version 5 stores 40 baseline values (164 bytes). Notes, pedal, audio clock and transient envelopes are not saved. The setter accepts version 1's 18 values, version 2's 19, version 3's 21, or version 4's 35 without reading beyond that prefix. Old versions derive independent levels from their Mix and receive filter mix 1, filter amount 0 and disabled new movement. Versions 1/2 receive Saw/Pulse; version 1 also receives Fullness 0. Unknown versions/nonfinite values reject atomically; finite values clamp to ranges. Versions 1-4 receive envelope response 0, Drive/Pitch Drop/Fullness enables 1 and Sauce order 0, preserving their previous bypass behavior. The worklet delegates migration to this core.
- Legacy Mix (ID 1) is a compatibility shortcut: setting it sets levels to 1-Mix and Mix. Setting either level leaves the other alone and updates exported Mix to level2/(level1+level2), or 0.5 if both are zero. Version 4/5 patch levels are authoritative; an inconsistent Mix field is canonicalized. Levels each span 0-1 and can sum to 2. Hosts must use an atomic target update when setting both levels. The worklet accepts `{kind:'parameter-batch', values:[{id,value},...], frame?}`: it validates the entire batch/capacity, enqueues all at one frame in caller order, or rejects all without touching the existing queue.
- Reset clears voices and restores deterministic drift state while retaining parameters. The host owns transport and timing; the core has no wall-clock timer or Blocks tape state.

`tests/core_tests.cpp` exercises mappings, patch rejection, sample offsets/order, bounded output, sustain/overlap ownership, isolation, render allocation and block-size invariance. `tests/render_wav.cpp` produces a reproducible three-second fixture. CI compares native and WebAssembly PCM with a maximum two-unit PCM16 tolerance; exact cross-platform floating-point identity is not promised.

## Waveforms and bounded voice ownership

Sine uses an immutable2048-point table with linear interpolation. Triangle uses eight immutable Fourier tables (odd harmonic limits1/3/7/15/31/63/127/255), with continuous interpolation between safe adjacent tables. Retained partials stay below0.45 times the sample rate; tables are compiled into the binary and shared read-only between instances. There is no initialization-time harmonic synthesis or per-sample harmonic summation. Saw, pulse and fixed-duty square use the original PolyBLEP implementation. Interpolation and nonlinear drive have finite aliasing error; this is not an alias-free claim. Sine/triangle tables have zero mean. Legacy variable-width pulse retains its original DC component in the dry path for compatibility.

`tests/generate_wave_tables.py` regenerates the original mathematical tables using Python's standard library. General background is [Julius O. Smith, Wavetable Synthesis](https://mail.dsprelated.com/freebooks/sasp/Wavetable_Synthesis.html); the implementation and tables here are original and no external DSP code was copied.

Waveform changes crossfade weighted outputs with a5ms time constant and keep oscillator phase continuous. Weights normalize to one and eventually snap to exact one-hot values, allowing the original dry Saw/Pulse path to remain bit-identical after reset or a settled selection.

Voice stealing prefers quiet released voices, then pedal-held voices, then oldest held voices. A stolen voice gets a3ms snapshot fade in one of16 extra fixed slots. The replacement starts at its exact NoteOn sample while the old contribution fades. If all tail slots are occupied, the quietest remaining level x velocity x remaining-time tail is replaced, with deterministic first-slot tie breaking. This keeps memory/work bounded; it does not promise zero clicks under tail overflow. Tails do not add playable polyphony or unison and are excluded from `bs_active_voices`. Panic clears both pools immediately. Fixed per-channel/key64-bit on/off ordinals cost32KiB per instance; counter overflow resets voice/ownership state safely rather than wrapping.

## Filter envelope and per-note movement

The independent filter ADSR snapshots its attack/decay/sustain/release and three bends at NoteOn. It advances even when amount is zero, so later live modulation uses the correct note position. NoteOff/pedal release starts its own release from the current filter-envelope level; it never prolongs a voice beyond the amplitude envelope. Amount and dry/wet mix remain live smoothed controls. The cutoff is `clamp(baseCutoff * 2^(amountSemitones * envelope / 12), 20Hz, 0.45*sampleRate)`, with amount from -48 to +48 semitones. Amount 0 keeps the original cutoff path. Filter state remains warm at dry mix 0; the dry/filtered blend precedes the existing Drive. Defaults: amount 0, mix 1, attack 5ms, decay 250ms, sustain 0, release 150ms, straight curves.

Settling adds a small signed, independently seeded pitch offset at NoteOn. It decays exponentially to 1% of its starting value at the chosen settling time (20ms-1s, default 180ms). Amount is 0-80 cents, default 0. Velocity sensitivity 0-1, default 0, scales the new articulation and existing drift amplitude by `(1-sensitivity)+sensitivity*velocity`; harder notes therefore move more without exceeding the selected amplitudes. While new movement is enabled, each note has a seeded drift-rate multiplier from 0.8 to 1.2. Settling amount/time, velocity scale and rate multiplier snapshot per note; existing drift amount and nominal speed stay live.

The new random stream does not consume the original drift generator. With settling amount and velocity sensitivity both zero, rate multipliers remain exactly 1 and prior drift sequencing remains intact. There is no new noise source, unison, automation lane or moving base tuning. Advanced drift now spans 0-120 cents, and there is no combined drift-plus-settling clamp. These expanded limits are experimental audition ranges, not a recommended musical maximum; choosing a macro cap remains a listening decision.

Envelope response (ID35, default1) continuously reduces excessive movement for sustained or slow envelope shapes, using the actual amplitude ADSR durations and bends. It does not infer how long a performer will hold a key. Short plucks retain more early motion; sustained drift returns to a29.8-cent requested-depth budget and settling approaches an8.9-cent budget, with an accelerated settling time. Lower requested amounts remain lower. Response0 bypasses this adaptation; imported v1-v4 patches receive0. Requested movement knobs are preserved, so turning response off restores their manual meaning.

`tests/motion_response_tests.cpp` checks the helper matrix and rendered sine pitch. In its deterministic high-motion fixture (requested drift120cents, settling60cents), early short-pluck motion is55.38cents versus56.44manual; sustained/long-decay/slow-attack/long-release cases are about8.65-8.74cents. Late sustained peak is28.79cents versus115.85manual. These are fixture measurements, not universal excursions or a listening verdict. Tests also verify migrated v4/manual audio equality, preserved parameter values and sample/block invariance during response retargeting.

## Optional performance engine

Tone patches use ABI 5 with 40 parameters. Performance uses a separate version-1, 48-byte `bs_performance_config` and the additive `bs_default_performance`, `bs_set_performance`, `bs_get_performance` and `bs_performance_pending` APIs. Hosts may serialize it as an optional patch field. Seven uint32 fields (version, mode, order, division, triplet, seed, mono) occupy offsets 0-24; five floats (bpm, curl, gate, strum_ms, randomness) occupy offsets 28-44. Invalid/nonfinite settings reject atomically.

Modes are Off (0), Arp (1) and Strum (2), with an independent Mono boolean. Orders are Up, Down, As Played and seeded Random. Defaults are Off, Mono false, Up, eighth notes, no triplets, 120 BPM, Curl 0, gate 0.7, strum 35ms, randomness 0.25 and seed 0xc0ffee. Bounds are BPM 40-240, Curl -0.8 to +0.8, gate 0.1-0.95, strum 0-100ms, randomness 0-1; straight divisions are 4/8/16/32/64; triplets are supported only for 4/8/16. The core and worklet reject 32T/64T.

Mono keeps one primary voice, with bounded 3ms retirement tails for de-clicking. Physically held keys take priority over pedal-latched keys; the newest note within the selected class wins. Releasing it restores the previous eligible note. Repeated keys and MIDI channels retain independent ownership counts. In Strum+Mono, queued notes do not become restoration candidates before their own attack.

Arp runs entirely on the core sample clock. Its four-beat phrase duration is T = sampleRate * 240 / BPM, with N = division (or division * 3/2 for triplets). Step i occurs at `T * expm1(-curl*i/N) / expm1(-curl)`; Curl 0 uses the straight fraction. Absolute phrase offsets are rounded once to a sample, avoiding accumulated interval rounding. Gate is a fraction of the actual curved interval. A new physically held key or removal from the pedal-eligible chord restarts at step one on the current sample. A pedal-latched key pressed again also restarts. Repeated same-key NoteOn ownership counts do not restart while that key remains physically held; releasing under pedal retains membership and does not restart. Pedal-up restarts only if it removes eligible notes. The restart stops the old generated gate, resets the order cursor and seeded random sequence, and applies pending settings immediately. All input events at a sample are handled before the scheduler tick, so simultaneous chord edits produce one attack chosen from the final chord. The first restart is immediate; further membership edits within20ms of that restart update the eligible note pool without resetting clock/order again. This fixed, non-sliding window avoids repeated attacks from staggered chord fingers and adds no first-note delay. Empty-to-new always restarts, even within the window. This is gesture grouping, not chord prediction. Releasing all eligible notes stops generated notes and scheduling. Random Arp selects from the held chord with replacement using the seeded generator.

Changes to active Arp settings wait until the next four-beat seam or a chord restart, whichever comes first. The getter returns requested settings; the pending API identifies an unapplied request. Restoring the active configuration before the seam cancels that pending change. Mode or Mono changes panic and clear held ownership immediately. All Off/default behavior remains the original input-to-voice route.

Strum collects new chord input for 20ms, then emits ordered notes across the selected spread once. Spread 0 emits immediately without collection latency. Random spacing uses bounded positive intervals normalized to the exact spread endpoint; random order shuffles the collected chord. New keys form a new gesture without endlessly retriggering old held notes. Releasing a key before its scheduled attack cancels that generation, even with pedal down. Pedal can sustain notes that actually sounded. Strum setting edits affect new scheduling, while already scheduled sample positions remain fixed.

The scheduler stores at most 128 unique held channel/key pairs and 128 queued Strum attacks. Excess new unique held notes are ignored until a slot becomes free; existing ownership is retained. Rendering, input handling and scheduling allocate no memory. These are bounded prototype semantics, not an external-clock synchronization implementation: there is no host tempo sync, MIDI clock, swing lane or octave expansion in this slice.

The worklet accepts `{kind:'performance', config:{...numeric fields...}}`, delegates validation to the core, and includes `performancePending` in status messages. A valid Mode/Mono change removes stale queued note/pedal input while retaining queued tone automation; an invalid config leaves the queue untouched. Stop/panic clears notes and scheduled work.

`tests/performance_tests.cpp` records internal scheduler callbacks into fixed test storage, without a production trace API. It checks exact Curl frames and endpoints across divisions/triplets, minimum interval bounds at 240 BPM, seeded orders, pending cancellation, sample-exact chord restarts, same-sample and non-sliding20ms grouping, repeated/pedal ownership, release/pedal cancellation before and after Strum publication, Mono restoration, actual audio pitch/primary voice counts, block-size invariance, panic and zero allocations. It runs in both native CTest and the WASM test script.

## Fullness: additive harmonic colour and low-band body

Fullness preserves its input and adds antialiased harmonic colour plus a separate DC-free low-band component. The whole stage is in `src/sauce.h`, after Tone and before envelope/pan. Default order is Drive then Fullness; the alternative is Fullness then Drive. Both Fullness paths remain warm, and order changes crossfade. For the input to that stage:

```
h(x) = 0.20*x*x + 0.25*x*x*x
colour = x + Fullness * DC_block(ADAA(h(x)))
body = 0.5 * (LP180(colour) - LP10(colour))
stageOutput = colour + Fullness * body
default path = Tone -> Drive -> Fullness -> envelope/pan -> master/output
other order = Tone -> Fullness -> Drive -> envelope/pan -> master/output
```

The residual input is bounded to [-1,1]; its analytic primitive extends continuously outside those bounds. The quadratic adds even colour and the cubic adds odd colour and foundation energy; the former negative linear subtraction is gone. A 10Hz DC blocker removes residual bias. Body uses one-pole alpha for 180Hz and alpha/18 for the slower average (approximately 10Hz), then adds half their difference. The difference has nonnegative real response and zero steady DC, so this linear body addition cannot cancel the dry foundation. This property does not replace actual-signal testing of the complete nonlinear rack. Fullness intentionally raises low-band energy and can raise overall level; there is no broadband gain knob, automatic normalization, pitch trim, four-pole replacement, resonance or transistor model.

The original polynomial/primitive are in `src/fullness.h`. First-order antiderivative antialiasing follows equation9 of [Parker, Zavalishin and Le Bivic, DAFx2016](https://www.dafx.de/paper-archive/2016/dafxpapers/20-DAFx-16_paper_41-PN.pdf). No external implementation was copied. ADAA reduces aliasing and adds a small delay/filtering effect to the residual; arbitrary nonlinear processing is not alias-free.

Historical fixes: the original phase/RMS-compensated wet path lost about 9–11dB on long detuned Velvet notes; a 65% wet cap still lost 7–8dB and was rejected. The subsequent `.12*x²+.20*(x³-.75*x)` pre-Tone residual removed that failure but was too subtle at high Drive. The current stronger additive body and selectable whole-stage placement supersede both. Fullness before strong Drive can still be compressed; default post-Drive placement retains a measurable low-band effect. This is original DSP, not a Moog/circuit-equivalence claim. Musical listening remains a separate gate.

Fullness0 retains the dry path with other processing equal. Every Fullness0 float-output fingerprint in the 180-case two-order comparison matched the verified earlier-core baseline. `BS_FIXTURE_FULLNESS=0` selects the separate dry golden fixture; the normal harness uses .55 to exercise current processing. Earlier nonzero audio, including former .55 fixtures, is intentionally superseded. Schema compatibility preserves physical values and explicit migration defaults, not old nonzero Fullness timbre.

## Measured checks and limits

Local measurements: Emscripten7.0.0 / Node22.23.4 WASM on Windows x64. These are controlled fixtures, not universal loudness/alias/CPU specifications.

- Eight-second detuned four-note chords in the user's sustained reference and Velvet/Glass/Low Tide fixtures, with Fullness0/.5/1: maximum measured AC change 3.270dB. The reference retains drift20 cents, speed .58Hz and detune4.8 cents. The regression separately bounds loss above -.15dB and intentional growth below +6dB; the old symmetric ±1.5dB constraint described the superseded subtle effect.
- The separate zero-sustain decay fixture covers MIDI48/60/72/84/96 under the same stricter attenuation/bounded-growth limits, alongside long phase-diverging notes.
- Sine/Sine, Drive1, MIDI60: fundamental ratio1.3156 and second harmonic amplitude .003075. The test now requires positive bounded foundation growth, not near-unity amplitude.
- An isolated coherent11.73kHz sine sends the cubic's third harmonic above Nyquist. Current-residual ADAA reduces the folded-alias ratio by25.208dB versus the same stronger polynomial sampled directly. This does not measure the entire synth's alias spectrum or establish universal alias-free output.
- The separate 180-case actual-core comparison covers six bass/chord/Sine fixtures, Drive1/4/12, two orders and five Fullness amounts. At Drive12, default-order detuned bass changes +4.51dB AC, +4.82dB low-band and +1.84dB high-band; detuned chords change +2.91/+3.70/+1.68dB. The pre-Drive order is much more compressed. Maximum AC growth was4.75dB; the smallest RMS change was -.00062dB for a high-Sine/pre-Drive case. Exact manifests and fixed-gain recordings distinguish tonal balance from mere output gain.
- New body tests verify nonnegative real response, no linear dry cancellation, steady DC rejection and time-domain behaviour at sample rates8–384kHz. The mathematical body-only maximum gain in the tested frequency grid was1.450526; the harmonic stage adds its own intentional colour/energy.
- Twenty-five waveform pairs x MIDI 36/60/84 x Fullness 0/0.25/0.5/0.75/1 produce 375 finite signals. No intermediate RMS/fundamental dip below the quieter endpoint was observed in this mix0.35/width0.5/zero-detune grid. Long detuned fixtures above cover the previously missed condition separately.
- Held-note waveform retargeting during an unfinished fade is exactly block invariant at blocks127/256. Maximum adjacent-sample change in the current sweep is .024011, below the unchanged .025 bound. This is a regression bound, not a universal click specification.
- A coherent5.895kHz triangle fixture has folded non-harmonic power below one thousandth of the naive triangle. Table-tier boundary changes are below0.000000003 for an infinitesimal frequency crossing.
- Square equals Pulse at width 0.5 and is unaffected by the Pulse Width control. Independent level/mix alias coherence, legacy migrations and atomic worklet batches pass.
- Filter tests cover positive/negative plucks, all three curves, independent release with pedal, exact dry bypass, snapshots and live sample-accurate modulation. Pitch settling measures 16.28 cents for a hard note versus 3.27 cents for a soft note early in a 20-cent fixture; it settles to 0.00032 cents after about two seconds. Reset/block invariance and disabled-new-movement behavior pass.
- Released/pedal priority, stolen same-key FIFO, first-sample single-steal continuity,64 dense steals overflowing tails, panic, maximum parameters at8kHz, instance isolation, deterministic reset and zero render allocations pass.
- Timing results are recorded separately below from the full current benchmark. They are not physical-phone or plugin-host CPU guarantees; single warmed core runs exclude host messaging, UI, devices and thermal behaviour.

## Reproducing the Fullness comparison

Use an immutable copy of a coherent prior core's `src` and `include` directories as the baseline. Do not combine an in-progress header with a different descriptor table. The recorded baseline used the previously verified ABI4 snapshot; the new matrix used a coherent ABI5/40-parameter snapshot. Each manifest records exact source hashes, build hash, physical parameters, sample-offset events and audio hashes. The scripts require the same EMSDK/Python setup as other offline hosts:

```sh
node scripts/compare-synth-fullness.mjs --core=/path/to/verified-prior-core --out=../synth-fullness-before
node scripts/compare-synth-fullness.mjs --unit --out=../synth-fullness-after --before=../synth-fullness-before
node scripts/verify-fullness-comparison.mjs ../synth-fullness-after
```

The final verification requires all180 current cases, matching Fullness0 float-output fingerprints, finite headroom, separate attenuation/growth bounds and a measurable high-Drive low-band emphasis. WAVs alternate Fullness0/1 at Drive1/4/12 in eight-second segments, with fixed Output .3 and velocity .72; no per-file normalization. Low/high ratios with negligible baseline Sine energy are not perceptual level measurements. Listening, phone performance and whole-synth alias quality remain separate gates.

## Offline auditions and timing

`blocks_synth_auditions` and `blocks_synth_benchmark` are optional CMake targets. From the repository, `node scripts/render-synth-auditions.mjs` produces five six-second actual-core WAVs and exact patch/event/source-hash manifests; factory patches are checked against the web host's shared preset definitions. Files use fixed output gain, not individual normalization. `node scripts/benchmark-synth.mjs` measures 45 cases across 1/8/16 notes, three waveform pairs, Fullness 0/0.5/1, active filter/movement, dense stealing and saturated 128-held-note Mono/Arp/Strum pools, with per-block percentiles and maxima. These are offline hosts, not device or UI measurements.

One local Windows x64 / Node 22.23.4 / Emscripten 7.0.0 run at 48 kHz and 128-frame blocks measured about 92-162 ms per audio second for steady 16-note cases and 153-216 ms with dense retriggers. Saturated 128-held-note performance cases at 240 BPM and straight 1/64 measured 21 ms Mono, 139 ms Arp and 152 ms Strum per audio second. The largest recorded block across all 45 cases was 1.52 ms against a 2.67 ms audio-block duration. These figures exclude AudioWorklet messaging/copies, UI, devices and thermal effects; they are not phone guarantees. CI records timings without a machine-dependent pass threshold.


## Independent release path

Prove sound and CPU budget on phones, review dense-steal behavior and filter quality, then freeze the parameter/preset contract. A VST3 adapter can wrap this core with processor/controller, host automation, state persistence and editor; it needs SDK integration, validation and platform packaging. The browser adapter is already a separate host. Neither host should put UI types or Blocks layer objects into this library. A researched ladder-inspired Tone stage would be a separate future design, not a renamed claim about Fullness. Licensing, branding, installers and release signing need an explicit distribution decision before publishing a standalone product.
