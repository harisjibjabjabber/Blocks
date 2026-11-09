# Standalone browser instrument

This independent instrument loads the portable core as raw WebAssembly in an AudioWorklet. It imports no Blocks application code or UI framework. The touch/desktop surface has two oscillator selectors, waveform feedback, a tone canvas, curved envelope, Character/Fullness, Sauce (Drive/Pitch Drop), a top-right Volume/peak control, a playable keyboard and collapsed Precision. It remains a prototype pending physical phone and listening acceptance.

Install/activate official Emscripten 7.0.0 and set `EMSDK` to its directory. With Node 22 and Python available:

```sh
node scripts/build-synth.mjs
python -m http.server 41821 --bind 127.0.0.1 --directory packages/synth-web/build
```

Open http://127.0.0.1:41821 and press Start sound. Serve the entire output folder, including fonts and their license notices, to host it independently; deployment requires HTTPS (localhost is allowed). No backend is needed. MIDI is optional and requested only through Connect MIDI; browser/device support varies. The font files are existing handover assets with OFL notices; synthesis needs no sound assets.

Touch/glissando keys, desktop ASDF keyboard input, a real output waveform, descriptor-based parameters, Init, versioned JSON patch import/export, Stop and optional MIDI are supported. Edit a patch before enabling sound. ADSR/Pitch Drop edits affect new notes; tone/drive/drift edits affect held notes. The reference keyboard uses channel 15; external MIDI preserves its channel. Hiding the page stops sound, losing focus releases notes, and leaving closes the audio context.

Character recipe 2 maps drift up to the user's preferred 20 cents, drive 1–2.2× and speed 0.1–0.6 Hz. Its first 60% retains recipe 1's mapping, preserving the three factory patches' physical values. The core's advanced drift range remains 40 cents. Individual Precision edits show Custom when they no longer match the recipe; patches preserve physical values and export the recipe version. The rounded [user movement reference](../../docs/audio-references/user-movement-20ct.json) records the accepted 20-cent/0.58-Hz/4.8-cent-detune feel; it is not blanket approval of the captured Drive/Fullness sound.

Factory patches are Velvet Current, Glass Garden and Low Tide. Preset/import/Init release voices; normal gestures do not. One completed pointer gesture creates one Undo entry. Escape/pointer cancellation restores the exact patch, and another editing pointer cannot steal the gesture; keyboard pointers remain independent. Oscillator waveform selection changes live through a short core crossfade; no notes are rewritten. ABI/patch 3 stores 21 values. Imports of v1/v2 retain Saw/Pulse defaults, and v1 gains Fullness zero. The Fullness sound itself has intentionally changed to correct the previous detuned-note cancellation.

Envelope timing gestures are relative to the full plot width, with Shift providing finer desktop movement. Points and Precision dedicate 70% of timing travel to 30 ms–2 s; short and long tails remain available up to the unchanged core limits. Labels show physical times, rather than pretending to be a linear time ruler. Curves use the core's `progress^(2^bend)` law; decay's vertical position sets sustain. These are UI editing maps, not changes to saved seconds or the core's automation mapping.

The visible waveform is labelled Preview when it shows ideal selected oscillator shapes, and Output (auto) when it shows actual analyser data. Display-only scaling keeps quiet playing visible and never changes the sound or acts as a level meter. Top-right Volume controls the existing output-gain parameter. Its peak indicator uses actual stereo maxima accumulated across every audio block: amber is near full scale, red is finite output at/above 1 or an invalid-sample warning. Peaks hold until Clear peak. Intentional Drive saturation does not itself trigger digital clipping. No end-to-end forced clipping claim is made; unit tests check threshold/channel/interval handling using known samples.

Fullness now adds a small same-phase antialiased harmonic residual before the shared Tone/Drive path, preserving the original oscillator foundation. It no longer replaces the signal with a dark four-pole filter. It is not a Moog circuit model, and its musical character still needs listening acceptance. The broader drive/ladder study, internal noise texture, voice/unison UI and effects suite remain future work.

The adapter reserves 16 MiB of WASM memory, a 1024-event queue and buffers for audio blocks up to 2048 frames. Oversized blocks produce silence; queue overflow panics. The C++ render path allocates no heap memory, but JS messaging/telemetry is not allocation-free. Real mobile CPU, thermal, latency and hardware MIDI validation remain release gates.

```sh
node scripts/test-synth-core.mjs
node --test packages/synth-web/*.test.mjs
node scripts/synth-standalone-proof.mjs
node scripts/render-synth-auditions.mjs
node scripts/benchmark-synth.mjs
```

The browser proof needs the server above and Chrome (`CHROME` can select its executable). It runs in a separate temporary profile, measures actual analyser output, checks held-note filter/Fullness changes and stopping/resume, and captures 320/390/1440 px layouts. It also exercises gestures, Undo, pointer cancellation/ownership and versioned file import/export. Automated signal checks do not establish musical sound quality or physical phone usability.
