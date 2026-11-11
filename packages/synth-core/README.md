# Portable synth core

Original C++17 audio engine with a C ABI, independent of UI frameworks, Web Audio and plugin SDKs. Native hosts link the static library; the browser compiles the same implementation to WebAssembly. The current engine supports a single current patch/API schema set and the Studio oscillator source.

## Signal and control modules

- Sixteen logical note voices; per-oscillator Sine, Triangle, Saw, Pulse or Square, independent levels and 1-7-copy Unison.
- Independent opt-in Rotor/Growl/Throat/Fray sources, native waveform preview, shared clock, free/synced Spin, optional retrigger and cycle-preserving Curl.
- Mono/Glide, ordered Arp/Strum/Pitch Drop note processing, sustain and deterministic voice ownership.
- Curved amplitude and filter envelopes, Soft/LP12/Ladder filters and per-oscillator filter routing. Ladder retains 8x reconstruction and nonlinear scalar feedback.
- Repeated ordered Fullness inserts, followed by a shared stereo Harmonics suite: Compressor → two serial Colour slots (Amp/Clip/Sine Crush/Tape/Rectify) → Crush → OTT-style multiband → Output. Stages bypass independently; native meters show gain changes. Colour/Crush use 4x reconstruction.
- Audio-domain Tight/Neutral/Bloom dynamics uses signal detection/compression/expansion, leaving note ADSR and ownership unchanged. The Suite declares24samples of latency even when disabled; Clean Sub receives the same alignment delay.
- A centred single-note Sub with Sine/Triangle, lowest/last priority, glide and Clean/FX routing. Clean joins after main colour and before common master gain/final protection; it still obeys note envelopes and panic.
- Typed drawable LFOs, stereo Width, regular/ping-pong Delay and stereo Plate/Hall/Shimmer reverb. Reverb is one global prepared processor; Shimmer pitch-shifts actual wet audio in feedback.
- Master gain now precedes stereo-linked lookahead sample-peak protection, replacing the final always-on tanh. No colour when gain reduction is inactive; ~1ms output lookahead (48 samples at48kHz) plus the24-sample Suite alignment. `bs_output_latency` reports total fixed bus latency; `bs_get_output_meters` reports pre-protection level/output/reduction. This is not certified true-peak protection.

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

The installed CMake target is `Blocks::Synth`. Public headers cover tone/events, performance, note rack, modulation v3, audio rack, Harmonics Suite, Voicing v2, Bass v2, shared clock/Sub, routing, sound, Delay, Reverb and output telemetry. The consumer fixture exercises the installed interface. Current tone state is ABI 7/count 44; Bass is 80 bytes, Voicing 32, clock 12, Sub 32, Suite v2 (see public header; meters44) and modulation v3 2232. These version numbers identify the current schemas; retired converters/APIs are not provided.

## WebAssembly and checks

Set EMSDK to official Emscripten 7.0.0; Node 22 and Python are required.

```sh
node scripts/build-synth.mjs
node scripts/test-synth-core.mjs
```

`SYNTH_FUNCTIONAL_ONLY=1` skips timing/render targets when functional checks run alongside other work. Performance measurements should run separately without competing test/browser workloads. `blocks_synth_phase11_chain_benchmark` accepts Harmonics model 0/1/2 and Unison count, and reports four/nine-note Ladder workloads with Suite Off, Colour-only and all-stages processing. Its historical filename does not imply identical Phase11 sound. Source hashes, workload settings and backend matter when comparing timings.

The current C API, clock/Sub routing and preview contract are documented in [the expansion report](../../docs/audio-references/bass-expansion-implementation.md). [Phase12 Harmonics research](../../docs/research/phase12-harmonics-suite.md) records signal ownership, circuit/DSP findings and acceptance gates; the earlier Phase11 report is historical. Tone IDs12/36/38 are reserved and do not provide a second distortion path. Generated harmonic tables have checked-in generators and no audio samples; generation dependencies are needed only to regenerate tables. DSP combines original processing with attributed MIT-licensed OTT fit laws; primary references and third-party notices document the boundary.

This is an instrument engine, not a packaged VST or a claimed hardware/commercial-plugin emulation. Wider listening, physical-device performance, external audio hosting and plugin adapters remain separate work. Older phase reports are historical and do not impose patch-compatibility constraints.

Phase13 DSP, sources, controls, evidence and limitations: [space/output results](../../docs/research/phase13-reverb-results.md). Reverb v2/68 exposes wet-only width/trim and self-ducking, predelay, decay, size, diffusion, low cut, damping, movement and Shimmer interval/amount. Off fades send/wet; existing tail memory advances and can return if re-enabled. Panic/reset discard histories. Clean Sub bypasses the reverb send and joins before common master/protection.

`bs_get_reverb_scope` copies128 recent decimated wet-left samples for display without changing audio state. The browser displays these under the Reverb dials; this is not a spectrum or stereo meter.

Creative FX: `blocks_creative_fx.h` exposes a776-byte config for16 independent Moving Space/Impact stereo inserts. The bus precedes Harmonics and excludes Clean Sub; setters are allocation-free and topology edits fade through dry. See [follow-up DSP and evidence](../../docs/research/space-creative-and-punch-followup.md). Tight now releases prior-body attenuation quickly for repeated hits; no note ADSR changes.

Moving Space Env (`motion`) is signed-1..1. Shared LFO routes target kind3/effect ID/parameter0 with independent signed depths in the unchanged Modulation v3 layout. All contributions combine before physical tap bounds. See [movement contract and verification](../../docs/research/moving-space-movement.md).
