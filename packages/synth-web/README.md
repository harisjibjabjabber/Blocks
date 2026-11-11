# Standalone browser instrument

A separate browser instrument for the portable C++ synth. Audio runs in an AudioWorklet through WebAssembly; no Blocks application framework is required. Studio is the standard oscillator source. The interface and patch importer support one complete current format.

## Play and shape

Tone has two independent oscillator cards with Sine, Triangle, Saw, Pulse and Square, Mix and 1-7-copy Unison. Bass On reveals Rotor, Growl, Throat and Fray voices with Spin, Motion and Grit. Spin switches between free Hz and synced musical periods; Timing exposes Curl and optional note retrigger. Global tempo uses plus/minus controls. Native source math supplies waveform previews; visible Tone animation follows native phase telemetry. Stopped previews use a stated reference pose, and tall shapes scale to the plot without changing audio levels.

The shared Filter has Soft, resonant LP12 and nonlinear Ladder LP24 modes, independent Osc 1/2 routing, Drive where applicable and a visible bipolar Env Amount. Envelope opens the curved filter-envelope graph. Lower Base Cutoff for upward envelope sweeps. The Ladder shape plot is a normalized small-signal preview, excluding drive-dependent distortion, reconstruction filtering and modulation.

The mini Sub is centred and monophonic, with Level, Octave and Clean/FX routing. Details contains Sine/Triangle and lowest/last-note priority. It follows performed notes, sustain, release and glide. Clean bypasses colour, filtering, width, delay and reverb while retaining amplitude gating, master volume and final output protection. The inactive Sub shares the desktop waveform strip; enabled details can scroll.

Sauce contains repeatable, reorderable Fullness blocks plus Arp, Strum and Pitch Drop note processors. Harmonics has its own page with independent Compressor, Colour, Crush and OTT-style stages. Two serial Colour slots offer Amp, Clip, Sine Crush, Tape and Rectify with independent Drive/Tone/Mix/Output; signed Dynamics uses audio-domain compression/expansion (Tight/Neutral/Bloom), leaving ADSR unchanged. Mix preserves aligned original dry audio. Details exposes timing, knee, makeup, recovery, multiband strengths and output trim. Colour reference diagrams are settings previews; the level/gain meters come from the native processor. Character shares the same Suite Drive state through its shortcut. Width, Delay and Reverb follow the Suite in the Space tab; Clean Sub bypasses processing with the same24sample alignment. Drawable LFOs retain typed routes; extended Suite/Bass mapping remains future work.

Preset/import/Init release voices. Dial edits remain live, completed gestures create one Undo entry, and Escape/pointer cancellation restores their starting state. The touch keyboard and MIDI are optional ways to play. [Two complete example patches](examples/README.md) are bundled as listening starting points.

## CPU display

CPU estimates this synth's audio-thread work as a percentage of the render deadline, not whole-computer utilization. At 48 kHz/128 frames, 100% is about 2.67 ms per block. It averages half a second, uses a coarse clock where a high-resolution worklet timer is unavailable, and clears on Stop. Other audio nodes and hardware latency are outside this measurement. Heavy voice/unison/filter/effect combinations can exceed the deadline.

## Build and preview

Install official Emscripten 7.0.0 and set EMSDK to that SDK directory. With Node 22 and Python:

```sh
node scripts/build-synth.mjs
python -m http.server 41821 --bind 127.0.0.1 --directory packages/synth-web/build
```

Open http://127.0.0.1:41821 and press Start sound. Serve the complete output directory, including fonts and OFL notices. HTTPS is required away from localhost. There is no backend. Every module, worklet, WASM binary and stylesheet uses one content revision to avoid stale mixed assets; the build removes retired source-comparison and per-node Harmonics UI assets.

## Current patch format

Export writes `blocks-synth-patch`, tone version 7/count 44, and complete performance, rack, modulation v3, explicit clock, Sub, Bass v2, Voicing v2, sound, routing, delay, width and mandatory current Suite v2 sections. Import validates every section before mutation, including representable Float32 parameter boundaries. Retired/incomplete formats are rejected; no patch migrations or compatibility fallbacks remain.

## Verification and references

Run `node --test packages/synth-web/*.test.mjs`. Focused browser checks include `synth-expansion-proof.mjs`, `synth-osc-bass-proof.mjs`, `synth-sound-proof.mjs`, `synth-tone-layout-proof.mjs`, `synth-gesture-proof.mjs`, `synth-standalone-proof.mjs`, `synth-filter-shape-proof.mjs` and `synth-cache-proof.mjs` under `scripts/`. They use isolated muted Chrome profiles; they never attach to the user's browser.

See [Bass/Sub/clock contracts](../../docs/audio-references/bass-expansion-implementation.md), [Phase12 Harmonics design and references](../../docs/research/phase12-harmonics-suite.md) and the [product roadmap](../../docs/synth-product-plan.md). Listening and physical-device acceptance are separate from automated checks. Sampler, MIDI Pitch Echo, VST packaging and external audio input are future work.

Phase13 adds a compact Reverb card in Space: Plate/Hall/Shimmer, Decay/Tone/Mix and contextual Shimmer Amount/Interval. Space & tone exposes predelay, low cut, size, diffusion, movement/rate, wet width and trim. All changes participate in Undo, cancellation and double-tap defaults; current patch files require strict Reverb v2/68 state. Master Volume is before output protection; its tooltip shows pre-protection level and gain reduction. The short Moving Space insert is now implemented separately in Sauce.

The small Reverb Wet waveform uses native audio telemetry, scaled by master before protection, and clears on Off/Stop/Panic. No decorative animation or extra AudioNode is used.

Current follow-up: Space owns Width/Delay/Reverb and its own keyboard visibility; Sauce owns the rack. Reverb Ducking is default0 and follows input audio to reduce only wet return. Makeup trim remains additive with Auto Makeup and is paired visibly beside it. The Sauce Add menu includes repeated Moving Space/Impact Bus blocks, with live controls, power/order/delete/reset/Undo and current-file persistence. Bus order is real within its typed group; cross-group routing and general parameter mapping remain later. Moving Space movement now supports the existing shared LFOs.

Moving Space has signed Env on its main card. Details → LFO movement assigns shared LFO sources with signed Depth, explicit shared On/Off, Edit and Remove. Edit uses the existing drawable Free/Sync/Retrigger editor. Routes start at0 without enabling a source; deletion/Undo/persistence retain the unified modulation state.
