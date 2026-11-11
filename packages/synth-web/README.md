# Standalone browser instrument

A separate browser instrument for the portable C++ synth. Audio runs in an AudioWorklet through WebAssembly; no Blocks application framework is required. Studio is the standard oscillator source. The interface and patch importer support one complete current format.

## Play and shape

Tone has two independent oscillator cards with Sine, Triangle, Saw, Pulse and Square, Mix and 1-7-copy Unison. Bass On reveals Rotor, Growl, Throat and Fray voices with Spin, Motion and Grit. Spin switches between free Hz and synced musical periods; Timing exposes Curl and optional note retrigger. Global tempo uses plus/minus controls. Native source math supplies waveform previews; visible Tone animation follows native phase telemetry. Stopped previews use a stated reference pose, and tall shapes scale to the plot without changing audio levels.

Tone uses independent Filter A/B tabs, each with Soft, resonant LP12 or nonlinear Ladder LP24, Osc 1/2 routing, Cutoff/Resonance/Mix and Ladder Drive. Oscillators split equally between their selected enabled parallel filters, so selecting both does not double the input. Filter B starts off. Shape plots show normalized base/small-signal response, excluding nonlinear drive and modulation.

Osc 1, Osc 2 and Sub each have octave −3…+3 and fine pitch. Factory Osc 2 offsets appear in its visible Fine control. Sub is centred/monophonic and uses the matching oscillator card, five wave choices, Level, lowest/last priority and Clean/FX routing. Clean bypasses colour and Space, retaining amplitude gating, master and protection. Its waveform preview uses the native Sub generator.

A persistent bottom dock provides four drawable LFOs and three curved envelopes across Tone, Character, Harmonics, Space and Sauce. Env 1 is the real per-voice amplitude envelope; Env 2/3 are assignable. Select a source tab to edit, or drag its separate arrow handle to a highlighted dial. Touch/keyboard users can activate the handle then choose a target. An intentional new assignment starts at +10%; adjust signed Depth in the quick row. Shared LFO power stays explicit so enabling one cannot silently wake unrelated saved routes. Double-tap Depth returns to zero. The optional Matrix shows the same assignments and replaces the graph while open. Source switching returns to its graph.

Continuous Tone, filter, envelope, oscillator Bass/fine/unison, Harmonics, Space and Creative FX controls share typed routes. Each source supports eight assignments. Discrete model/routing/count switches and composite recipes are excluded. Synced LFO Division is discrete; its Clock speed target remains available in Matrix. Depth arcs show routing amount; moving markers use actual native physical control telemetry. Voice-scoped markers show the newest active main voice. Shared effects use the maximum active envelope value; this is note-envelope modulation, distinct from Moving Space's incoming-audio Env follower.

Sauce contains repeatable, reorderable Fullness, Arp, Strum, Pitch Drop, Moving Space and Impact blocks. Fixed dock LFOs are not Sauce blocks. Harmonics retains its independent Compressor, two serial Colour slots (Amp/Clip/Sine Crush/Tape/Rectify), Crush and OTT-style stages. Character shares the Suite Drive through its shortcut. Space contains Width, Delay and Plate/Hall/Shimmer. Full routing between processing groups remains future work.

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

Export writes `blocks-synth-patch`, tone version 7/count 44, and complete envelopes, tuning, filterBank, performance, rack, modulation v3 (four fixed sources), explicit clock, Sub, Bass v2, Voicing v2, sound, routing, delay, width and mandatory current Suite v2 sections. Import validates every section before mutation, including representable Float32 parameter boundaries. Retired/incomplete formats are rejected; no patch migrations or compatibility fallbacks remain.

## Verification and references

Run `node --test packages/synth-web/*.test.mjs`. Focused browser checks include `synth-expansion-proof.mjs`, `synth-osc-bass-proof.mjs`, `synth-sound-proof.mjs`, `synth-tone-layout-proof.mjs`, `synth-gesture-proof.mjs`, `synth-standalone-proof.mjs`, `synth-filter-shape-proof.mjs` and `synth-cache-proof.mjs` under `scripts/`. They use isolated muted Chrome profiles; they never attach to the user's browser.

See [Bass/Sub/clock contracts](../../docs/audio-references/bass-expansion-implementation.md), [Phase12 Harmonics design and references](../../docs/research/phase12-harmonics-suite.md) and the [product roadmap](../../docs/synth-product-plan.md). Listening and physical-device acceptance are separate from automated checks. Sampler, MIDI Pitch Echo, VST packaging and external audio input are future work.

Phase13 adds a compact Reverb card in Space: Plate/Hall/Shimmer, Decay/Tone/Mix and contextual Shimmer Amount/Interval. Space & tone exposes predelay, low cut, size, diffusion, movement/rate, wet width and trim. All changes participate in Undo, cancellation and double-tap defaults; current patch files require strict Reverb v2/68 state. Master Volume is before output protection; its tooltip shows pre-protection level and gain reduction. The short Moving Space insert is now implemented separately in Sauce.

The small Reverb Wet waveform uses native audio telemetry, scaled by master before protection, and clears on Off/Stop/Panic. No decorative animation or extra AudioNode is used.

Current follow-up: Space owns Width/Delay/Reverb and its own keyboard visibility; Sauce owns the rack. Reverb Ducking is default0 and follows input audio to reduce only wet return. Makeup trim remains additive with Auto Makeup and is paired visibly beside it. The Sauce Add menu includes repeated Moving Space/Impact Bus blocks, with live controls, power/order/delete/reset/Undo and current-file persistence. Bus order is real within its typed group; cross-group audio routing remains later. Continuous parameter mapping now uses the shared dock.

Moving Space retains its signed incoming-audio Env follower. Assign note envelopes or LFOs from the shared dock to its visible dials; Matrix edits the same routes. Source power remains explicit, new assignments start at +10%, and deletion/Undo/persistence retain the unified state.
