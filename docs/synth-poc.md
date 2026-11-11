# Synth proof of concept

The web build provides two procedural **Synth** presets: Warm EP (`blocks.ep.fm.v1`) and Warm Pad (`blocks.pad.warm.v1`). Neither is a sampler. Warm Pad is original project DSP: triangle plus a quiet saw oscillator detuned by five cents, a velocity/key-sensitive low-pass filter, amplitude envelope, and gentle tremolo. No external samples, soundfonts, DSP library, or audio assets were imported. This is a functional sound-design prototype, not a listening-quality acceptance claim.

`src/audio/instruments.ts` defines instrument descriptors with `type: "synth" | "sampler"`, supported IDs, defaults, and a clamped `SynthEnvelope`. The sampler category is an architectural contract only; there is no empty sampler control or promised sample library. A future sample implementation must identify source files, hashes, licensing and attribution, loading failures, and decoded-memory costs before integration.

## Ownership and capture

`WebInstrumentRack` routes touch, MIDI, isolated editor audition, and each `replay:layer-id` source independently. Selecting or editing a layer sound also selects that sound and envelope for live input and the next capture; it does not replace other existing layers. Preset changes release that source's old voices briefly; subsequent attacks use the new sound. The rack carries that source's controller state across preset changes, including a held sustain pedal, without inventing captured MIDI or retriggering held keys. Loop scheduling and raw event timestamps remain unchanged.

Engine setters are `setLiveInstrument(id, envelope?)`, `setLayerInstrument(layerId, id, envelope?)`, and `setAuditionInstrument(id, envelope?)`. They return the supported resolved ID. App stores sound ID and a copied envelope on each Take. The descriptor list is `engine.instruments`; old projects or unknown IDs resolve to Warm EP.

Envelope values are attack 2–3000 ms, decay 10–5000 ms, sustain 0–1, and release 20–5000 ms. All input is clamped with finite-number checks. Each attack snapshots its envelope. Dial changes on the same preset affect subsequent live, audition and loop attacks; they do not restart loops, release held voices, or continuously morph already sounding notes. Release begins at the analytically calculated envelope level, avoiding the incorrect use of `AudioParam.value` at a future scheduled note-off. The original fixed EP pedal release remains for callers without custom ADSR; a custom envelope uses its release time for both key-up and pedal-up.

Web banks retain the existing twelve-voice cap per preset, shared across sources; audition has separate banks. More simultaneous layered notes can steal voices. The added filter and oscillator graph have not been benchmarked on physical phones. No native parity is claimed: the native engine exposes only fixed Warm EP, resolves setters to EP and reports `capabilities.synthEnvelope: false`; synth dials and Warm Pad should not be offered there.

## Verification and audition artifact

`src/adapters/engine.web.test.ts` covers independent layer/live routing, unchanged captured MIDI, source-specific sound changes, sustain across a sound change, per-voice ADSR snapshots, and invalid parameter clamping, in addition to existing scheduler/transport coverage.

`src/audio/web/synth.measure.test.ts` executes `scripts/measure-synth.mjs` in a real browser `OfflineAudioContext`, not an audio-node mock. It measures attack speed, decay, sustain level, release duration, velocity dynamics, sustain pedal, silence after panic, and amplitude bounds. The existing Warm EP offline suite remains green. These establish generated signal behavior, not perceived quality, device latency, or physical-touch acceptance.

To create a listening comparison, run `node scripts/measure-synth.mjs /absolute/path/demo.wav`. The generated mono 48 kHz WAV contains two chords on Warm EP in the first six seconds, followed by the same chords on Warm Pad. The command also prints measured RMS results. Do not describe it as auditioned until someone has actually listened.

Live-routing regression: the browser observes real oscillator creation and AudioParam scheduling after editing a captured layer. Warm Pad produces one triangle/saw/tremolo voice and applies the selected attack/release, rather than leaving live input on Warm EP.
