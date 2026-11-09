# Portable synth core — engineering spike

Original C++17 DSP, independent of Blocks, UI frameworks, Web Audio and plugin SDKs. A C ABI is the host boundary: native hosts link the static library; the browser host compiles the same source to WebAssembly. This is not a finished VST plugin or an analogue circuit emulation.

Implemented: 16-note polyphony; PolyBLEP saw/pulse oscillators; detune and pulse width; curved ADSR; one-pole low-pass; seeded per-voice pitch drift; soft drive; per-note Pitch Drop. No unison, resonance, wavetable engine, sampler, EQ, reverb or automation editor yet. Oldest-voice stealing can click and needs refinement before release.

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
- ABI 1 exposes 18 stable parameter IDs and descriptors with units, ranges, defaults and linear/log mappings. See the header rather than copying parameter indices into a new UI.
- Most parameters smooth over 5 ms. ADSR and Pitch Drop settings are captured on note-on, so those changes affect new notes. Pitch Drop is a per-voice envelope recipe, not a new oscillator.
- Patch version 1 stores baseline values only. Notes, pedal, audio clock and transient envelopes are not saved. Unknown versions/nonfinite values are rejected atomically; finite values clamp to ranges.
- Reset clears voices and restores deterministic drift state while retaining parameters. The host owns transport and timing; the core has no wall-clock timer or Blocks tape state.

`tests/core_tests.cpp` exercises mappings, patch rejection, sample offsets/order, bounded output, sustain/overlap ownership, isolation, render allocation and block-size invariance. `tests/render_wav.cpp` produces a reproducible three-second fixture. CI compares native and WebAssembly PCM with a maximum two-unit PCM16 tolerance; exact cross-platform floating-point identity is not promised.

## Independent release path

First prove the sound and CPU budget on phones, refine voice stealing and filter quality, then freeze the parameter/preset contract. A VST3 adapter can wrap this core with processor/controller, host automation, state persistence and editor; it needs SDK integration, validation and platform packaging. The browser adapter is already a separate host. Neither host should put UI types or Blocks layer objects into this library. Licensing, branding, installers and release signing need an explicit distribution decision before publishing a standalone product.
