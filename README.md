# Blocks

A musical sketchbook for Android and the web. Play MIDI into a procedural electric piano, keep a short rolling history, and capture that history into layers.

## Continue from here

Start at [docs/handover/README.md](docs/handover/README.md). That page is the handover: what is implemented, proposed, tested, and broken, how to build and test, and where the imported design and research live. Roles and working agreements are in [docs/handover/ways-of-working.md](docs/handover/ways-of-working.md). A milestone note uses [docs/handover/checkpoint-template.md](docs/handover/checkpoint-template.md).

Take application code from the latest `main`. Take these documents from `handover/status`. This branch is not a substitute for `main`.

The public site is https://harisjibjabjabber.github.io/Blocks/ with base path `/Blocks/`. Last-chord Capture is not fixed. Commit `fdba348` (script `/Blocks/assets/index-DGbe1J8t.js`) is the build Haris refreshed and still heard as only the last chord. `git fetch` shows `main` is `91291d80a3c6bb5e91cc6635243f00bf218672f0`, which is not in this branch. The live script is `/Blocks/assets/index-CPO7bfKa.js`. On a synthetic four-chord line, `957480e` ended the loop at 4836 ms because it included 12 ms gaps inside a chord. `91291d8` uses the 1600 ms spacing between chords, and both a short release and a held chord end the loop at 6400 ms. Note-offs stay at 4980 ms and 6200 ms. That trace is not his take and not sign-off. At 20:20 GMT he played that live build and said the last chord is sliced quickly and the loop returns to the start. At 20:21 GMT he said that space should also appear on the ribbon when he stops. The intended loop includes trailing empty time. That empty time is not new MIDI, and an early release must not lengthen the notes. At 20:30 GMT he said the ending problem has gone in that test, and that garbage or older playing at the front is sometimes still captured with the chords. The ending is user-reported resolved for that hearing, not a universal sign-off. Prefix contamination is the open selection miss. At 20:31 GMT he said the phrase is a single loop, so a repeated pattern is not something he can be required to play. At 20:32 GMT he said the bad captures are intermittent. The first few did not include the noodling, and he informally estimates about half of them do now. That 50/50 is his estimate, not a measured rate. His exact take is not available. The ending report from 20:30 stays user-reported resolved for that hearing. This is not a shipped fix and not an editor redesign. No later code change is recorded here as already deployed. `git fetch` still shows `origin/main` at `91291d80a3c6bb5e91cc6635243f00bf218672f0`. Do not treat a documentation commit as a new UI.

The current UI proposal is rev 3.3 in [docs/design/hifi/hybrid](docs/design/hifi/hybrid), dark and light, including editor frames 17–27. It wins over rev 3.2.1 where they overlap. It is proposed example data, not implemented UI and not hardware validation. A thumbs-up on the delivery acknowledges the prototype caveats. It is not approval to build the production screen. The designer recommends Quantise only inside the editor. Haris has not agreed to remove a main-screen shortcut. That choice is open. Original storyboard and comparison PNGs are history. Capture research stays on baseline `3412f61`, and last-chord Capture is still unresolved. Neither is shipped.

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

Sampled piano, drums, bass, and pad. A piano roll, autosave of the ribbon, export, and a fixed layer limit. Controller learn beyond Capture and Play/Stop. A measured keyboard-to-speaker latency number. Proof on USB, a Samsung Fold, or a pedal. None of that is in this tree.

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
