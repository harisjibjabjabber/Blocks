# Blocks

A jazz sketchpad for someone who already uses Ableton and a Samsung Fold. This slice is MIDI in, a procedural electric piano, a bounded rolling history, capture, and phrase replay. Screen controls stay few.

The keyboard sound in this build is labelled Warm EP. The preset id is `blocks.ep.fm.v1`, a procedural FM electric piano with velocity and sustain. It is not a sampled piano and not a licensed brand. No sample library is bundled.

## Run the local web app

```bash
npm install
npm run web
```

The dev server binds to `0.0.0.0:41713`.

Web MIDI needs a secure context: `http://localhost:41713` or HTTPS. Open the page, tap **Enable**. That gesture resumes the `AudioContext` before `navigator.requestMIDIAccess({ sysex: false })`. Grant the MIDI permission, then play a plugged-in keyboard. The port list updates when a device is attached or removed.

Browser support, from the MDN browser-compat-data `api/Navigator.json` `requestMIDIAccess` entry read for this implementation:

- Desktop Chrome and Edge, and Chrome on Android, expose the API (Chrome since 43; Edge and Chrome Android are recorded as `mirror`).
- Desktop Firefox exposes it from version 108 only behind a site-permission add-on, a secure context, and the `midi` permission policy.
- Firefox for Android, Safari, and iOS Safari do not expose it (`firefox_android` is `false`; `safari` is `false`; `safari_ios` is `mirror`).

An exposed API is not proof that a keyboard worked. If the API, the permission, or the device is missing, the page says so. It does not invent notes.

The on-screen pads are labeled **Touch**. They are an extra input.

## Debug APK

Requirements: JDK 17 or 21, Android SDK with platform 36 or 37, build-tools 37.0.0, NDK `27.1.12297006`, and CMake 3.22.1. `minSdk` is 29.

```bash
export ANDROID_HOME="$HOME/android-sdk"
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64
```

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. It links Oboe 1.11.0 and the C++ callback, and it contains the compiled JavaScript bundle. Installing it does not require Metro. This is the React Native CLI / Gradle app, not Expo Go. iOS is not a supported build. The `ios/` directory is the unused React Native template.

Install on a device that supports USB MIDI through `android.media.midi`. The app asks for audio focus, opens the first MIDI output port it can read, and copies callback bytes before they leave `onSend`.

## Tests

```bash
npm test
```

That runs the JavaScript host tests (`vitest`) and the native host tests (g++). The native tests cover fragmented MIDI, running status, velocity zero, repeat notes, sustain, queue overflow, and the nanosecond-to-frame conversion. They do not open a device or an emulator.

## What this tree does not do

No accounts, cloud, plugin hosting, mastering, marketplace, or native Ableton export. Autosave of the rolling buffer, drum layers, a touch piano roll, and WAV stems are documented in `docs/backlog.md` and are not built. Sample packs, including the proposed FreePats drum subset and the optional KW small piano, are not downloaded or bundled here. Nothing is deployed to GitHub Pages or any public host.
