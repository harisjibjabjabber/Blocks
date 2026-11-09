# Standalone browser reference host

This engineering harness loads the portable core as raw WebAssembly in an AudioWorklet. It imports no Blocks application code or UI framework. Its parameter controls are functional reference controls; the approved touch synth design remains a separate design study, not a completed production UI.

Install/activate official Emscripten 7.0.0 and set `EMSDK` to its directory. With Node 22 and Python available:

```sh
node scripts/build-synth.mjs
python -m http.server 41821 --bind 127.0.0.1 --directory packages/synth-web/build
```

Open http://127.0.0.1:41821 and press Start sound. Serve these four output files together to host it independently; deployment requires HTTPS (localhost is allowed). No backend is needed. MIDI is optional and requested only through Connect MIDI; browser/device support varies.

Touch/glissando keys, desktop ASDF keyboard input, a real output waveform, all 18 parameters, Init, versioned JSON patch import/export, Stop and optional MIDI are supported. ADSR/Pitch Drop edits affect new notes; tone/drive/drift edits affect held notes. The reference keyboard uses channel 15; external MIDI preserves its channel. Hiding the page stops sound, losing focus releases notes, and leaving closes the audio context.

The adapter reserves 16 MiB of WASM memory, a 1024-event queue and buffers for audio blocks up to 2048 frames. Oversized blocks produce silence; queue overflow panics. The C++ render path allocates no heap memory, but JS messaging/telemetry is not allocation-free. Real mobile CPU, thermal, latency and hardware MIDI validation remain release gates.

```sh
node scripts/test-synth-core.mjs
node scripts/synth-standalone-proof.mjs
```

The second command needs the server above and Chrome (`CHROME` can select its executable). It runs in a separate temporary profile, measures actual analyser output, checks held-note filter changes and stopping/resume, and captures 320/390 px layouts. Automated signal checks do not establish musical sound quality or physical phone usability.
