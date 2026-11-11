# Portable synth core

Original C++17 audio engine with a C ABI, independent of UI frameworks, Web Audio and plugin SDKs. Native hosts link the static library; the browser compiles the same implementation to WebAssembly. The current engine supports a single current patch/API schema set and the Studio oscillator source.

## Signal and control modules

- Sixteen logical note voices; per-oscillator Sine, Triangle, Saw, Pulse or Square, independent levels and 1-7-copy Unison.
- Independent opt-in Rotor/Growl/Throat/Fray sources, native waveform preview, shared clock, free/synced Spin, optional retrigger and cycle-preserving Curl.
- Mono/Glide, ordered Arp/Strum/Pitch Drop note processing, sustain and deterministic voice ownership.
- Curved amplitude and filter envelopes, Soft/LP12/Ladder filters and per-oscillator filter routing. Ladder retains 8x reconstruction and nonlinear scalar feedback.
- Repeated ordered Drive, Fullness and Harmonics inserts. Harmonics has original Round/Tube/Fold profiles, analytic antiderivatives, polyphase 2x processing, wet tone tilt and envelope-aware transient recovery.
- A centred single-note Sub with Sine/Triangle, lowest/last priority, glide and Clean/FX routing. Clean joins after main colour and before common master gain/final protection; it still obeys note envelopes and panic.
- Typed drawable LFOs, stereo Width and regular/ping-pong Delay.

Rendering uses prepared fixed storage with no heap allocation. Note and parameter events have sample offsets. Configuration setters validate atomically; processing and source-preview functions reject invalid arguments. Output protection does not imply unlimited patch headroom or a universal CPU guarantee.

## Build and install

```sh
cmake -S packages/synth-core -B build/synth -DCMAKE_BUILD_TYPE=Release
cmake --build build/synth --parallel 2
ctest --test-dir build/synth --output-on-failure
cmake --install build/synth --prefix build/synth-install
cmake -S packages/synth-core/tests/consumer -B build/consumer -DCMAKE_PREFIX_PATH=build/synth-install
cmake --build build/consumer --parallel 2
```

The installed CMake target is `Blocks::Synth`. Public headers cover tone/events, performance, note rack, modulation v3, audio rack, Harmonics, Voicing v2, Bass v2, shared clock/Sub, routing, sound and Delay. The consumer fixture exercises the installed interface. Current tone state is ABI 7/count 44; Bass is 80 bytes, Voicing 32, clock 12, Sub 32 and modulation v3 2232. These version numbers identify the current schemas; retired converters/APIs are not provided.

## WebAssembly and checks

Set EMSDK to official Emscripten 7.0.0; Node 22 and Python are required.

```sh
node scripts/build-synth.mjs
node scripts/test-synth-core.mjs
```

`SYNTH_FUNCTIONAL_ONLY=1` skips timing/render targets when functional checks run alongside other work. Performance measurements should run separately without competing test/browser workloads. `blocks_synth_phase11_chain_benchmark` accepts Harmonics model 0/1/2 and Unison count, and reports four/nine-note Ladder workloads with Harmonics off/on. Source hashes, workload settings and backend matter when comparing timings.

The current C API, clock/Sub routing and preview contract are documented in [the expansion report](../../docs/audio-references/bass-expansion-implementation.md). [Harmonics research](../../docs/research/harmonics-quality-20261111.md) records aliasing fixtures, dynamics, gain and processing cost. Generated harmonic tables have checked-in generators and no audio samples; generation dependencies are needed only to regenerate tables. DSP is original, with primary research references in the reports.

This is an instrument engine, not a packaged VST or a claimed hardware/commercial-plugin emulation. Wider listening, physical-device performance, external audio hosting and plugin adapters remain separate work. Older phase reports are historical and do not impose patch-compatibility constraints.
