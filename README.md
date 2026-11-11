# Blocks

A musical sketchbook for Android and the web. Play MIDI into a procedural electric piano, keep a short rolling history, and capture that history into layers.

## Implemented

- Warm EP, preset `blocks.ep.fm.v1`. Procedural FM electric piano with velocity and sustain. It is not a sampled piano and not a brand name.
- Web MIDI and Android `android.media.midi`, copied off the system callback before the buffer is reused.
- A ribbon that keeps about 120 seconds, plus an event cap and a byte cap. 120 is the history window, not a tempo.
- A new sketch has no grid. The first pulse reading can propose one and lock it. Later readings do not change that tempo. Half, double, phase, and loop length move only the 4/4 overlay.
- Capture writes a new layer. One undo puts the ribbon back. After capture, the layer loops unless "stay silent" is set.
- The Sound chip follows the real `AudioContext` state (`running`, `suspended`, `interrupted`, `closed`), including when MIDI permission is denied. On-screen keys stay available either way. They are labelled touch, not a MIDI device.
- Capture and Play/Stop can be learned from a controller other than CC 64. Playing keys are refused. CC 64 stays sustain.
- Android audio is Oboe 1.11.0. The callback does not allocate, lock, or do I/O.
- A static web build with base path exactly `/Blocks/`.

## Planned

Sampled piano, drums, bass, and pad. Autosave of the ribbon, export, and a fixed layer limit. Controller learn beyond Capture and Play/Stop. A measured keyboard-to-speaker latency number. Proof on USB, a Samsung Fold, or a pedal. None of that is in this tree.

## Piano-roll correction branch

The browser editor now has pitch-aligned keys, isolated key audition, an engine-driven selected-layer playhead, reversible single-note editing, and explicit quantise preview. Committed edits join playback at the next loop boundary. The editor keeps Back, Undo/Redo and transport visible at narrow widths. Raw capture history and musical silent tails remain separate from edited playback.

This is a scoped local correction, not full storyboard or release acceptance. Multi-selection, marquee, the full velocity lane/clipboard/keyboard workflow, physical-touch validation, and audiovisual timing evidence remain outstanding. Capture prefix contamination is still open. See `docs/piano-roll-quality-checkpoint.md` for the exact scope, evidence, and blockers.

## Setup

Web, local:

```bash
npm install
npm run web
```

The dev server binds to `0.0.0.0:41713` with base `/`. Open `http://localhost:41713` or `http://127.0.0.1:41713` and tap **Enable**. That click resumes the `AudioContext` before the MIDI permission request. Localhost is the only secure context this build has been checked on.

Static site, base exactly `/Blocks/`:

```bash
npm run build:web
```

Output is `dist/`. Serve it under `/Blocks/`. See `docs/web-pages.md`.

Android debug APK, when you choose to build one:

```bash
export ANDROID_HOME="$HOME/android-sdk"
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64
```

Requirements: JDK 17 or 21, Android SDK platform 36 or 37, build-tools 37.0.0, NDK `27.1.12297006`, CMake 3.22.1. `minSdk` is 29. The debug APK can embed the JavaScript bundle so it does not need Metro. iOS is not a supported build.

## Tests

Use Node 22.11 or newer. The web build is portable across Windows and Linux.

```bash
npm ci
npm run typecheck:web
npm run test:js
npm run build:web
```

The offline audio test launches an isolated headless Chrome profile. Set `CHROME` to the browser executable if it is not found automatically. For interaction checks, start the web server in another terminal, then run `npm run test:browser`. The strict browser script fails on a failed check, and saves screenshots and JSON outside the repository by default. `BLOCKS_PROOF_URL` and `BLOCKS_PROOF_DIR` override the URL and evidence folder. This is synthetic browser evidence, not physical-touch, listening, or hardware validation.

```bash
npm test
```

`npm test` runs Vitest and the native host tests (`g++`). Vitest covers capture, the first-grid rule, the Sound chip against `AudioContext` states, and Web MIDI enable order. The native tests cover MIDI parsing, sustain, queue overflow, and nanosecond-to-frame conversion. They do not open a device.

```bash
npm run test:js
npm run test:native
```

## Browsers and Web MIDI

From the MDN browser-compat record used for this implementation (`api/Navigator.json`, `requestMIDIAccess`):

- Desktop Chrome and Edge, and Chrome on Android, expose the API.
- Desktop Firefox exposes it from version 108 only behind a site-permission extension, a secure context, and the `midi` permission policy.
- Firefox for Android, Safari, and Safari on iOS do not expose it.

An exposed API is not proof a keyboard worked.

## Not tested

USB MIDI, a Samsung Fold, a sustain pedal on hardware, and latency were not tested. No latency number is claimed.

## Licenses

Oboe 1.11.0 is vendored in `third_party/oboe` under the Apache License 2.0 (`third_party/oboe/LICENSE`). React Native, React, and the other npm packages keep the licenses recorded in `package-lock.json`. No sample library is bundled. This repository does not add its own license file.
