# Standalone browser reference host

This independent instrument loads the portable core as raw WebAssembly in an AudioWorklet. It imports no Blocks application code or UI framework. The first touch/desktop surface follows the approved graphite/ivory design: tone canvas, curved envelope, Character and Pitch Drop, a playable keyboard, and collapsed Precision controls. It remains a prototype pending physical phone and listening acceptance.

Install/activate official Emscripten 7.0.0 and set `EMSDK` to its directory. With Node 22 and Python available:

```sh
node scripts/build-synth.mjs
python -m http.server 41821 --bind 127.0.0.1 --directory packages/synth-web/build
```

Open http://127.0.0.1:41821 and press Start sound. Serve the entire output folder, including fonts and their license notices, to host it independently; deployment requires HTTPS (localhost is allowed). No backend is needed. MIDI is optional and requested only through Connect MIDI; browser/device support varies. The font files are existing handover assets with OFL notices; synthesis needs no sound assets.

Touch/glissando keys, desktop ASDF keyboard input, a real output waveform, descriptor-based parameters, Init, versioned JSON patch import/export, Stop and optional MIDI are supported. Edit a patch before enabling sound. ADSR/Pitch Drop edits affect new notes; tone/drive/drift edits affect held notes. The reference keyboard uses channel 15; external MIDI preserves its channel. Hiding the page stops sound, losing focus releases notes, and leaving closes the audio context.

Character is a bounded macro over existing physical parameters: drift 0–10 cents, drive 1–2.2× and speed 0.1–0.6 Hz. Individual Precision edits show Custom when they no longer match that mapping; patches preserve the underlying values. It does not introduce another independent parameter writer or alter MIDI notes. Factory patches are Velvet Current (soft drifting chords), Glass Garden (short bright pluck) and Low Tide (dark pulse body). Preset/import/Init release voices; normal gestures do not. One completed pointer gesture creates one Undo entry. Escape/pointer cancellation restores the exact patch, and another pointer cannot steal the gesture; keyboard pointers remain independent.

Envelope points use perceptual/logarithmic stage timing, with displayed times rather than a linear time ruler. Attack, decay and release curves use the core's `progress^(2^bend)` law. Decay's vertical position sets sustain. Graphs preview settings; the small waveform is the actual output, and no animated envelope position claims to track individual voices. Precision retains accessible range controls for all parameters. Fullness is a separate engine path, not a pitch-detune macro or a claim to emulate Moog circuitry.

The adapter reserves 16 MiB of WASM memory, a 1024-event queue and buffers for audio blocks up to 2048 frames. Oversized blocks produce silence; queue overflow panics. The C++ render path allocates no heap memory, but JS messaging/telemetry is not allocation-free. Real mobile CPU, thermal, latency and hardware MIDI validation remain release gates.

```sh
node scripts/test-synth-core.mjs
node --test packages/synth-web/recipes.test.mjs
node scripts/synth-standalone-proof.mjs
```

The browser proof needs the server above and Chrome (`CHROME` can select its executable). It runs in a separate temporary profile, measures actual analyser output, checks held-note filter/Fullness changes and stopping/resume, and captures 320/390/1440 px layouts. It also exercises gestures, Undo, pointer cancellation/ownership and versioned file import/export. Automated signal checks do not establish musical sound quality or physical phone usability.
