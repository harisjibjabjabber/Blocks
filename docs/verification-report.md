# Verification report

Host checks and a browser smoke of the running web app were done on this machine. No emulator launch, device, USB, Fold, pedal, or latency run. The UI proposal was not user-tested. QA stays open.

## Packaging

Debug APKs are signed with the debug keystore. The standalone build sets `debuggableVariants = []` so Gradle runs `createBundleDebugJsAndAssets`, and `MainApplication` sets `useDevSupport = false` so launch does not probe Metro.

```text
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64 --no-daemon
BUILD SUCCESSFUL in 17s
```

The standalone APK contains `assets/index.android.bundle` (Hermes bytecode) plus `lib/arm64-v8a/libblocksengine.so` and `lib/x86_64/libblocksengine.so`.

| File | sha256 |
|---|---|
| Metro debug APK, kept | `c4aa0796756b67a64026fefa360b62155ee1bb9bfeecf6f3c178a00dcf809e0c` |
| Standalone debug APK | `3395360529263bfa6782c22a827e323ec9062ac94bd422443ebd1f6bea4c5ac3` |

Store paths, both still present:

- `/cursor/stores/bc-cda16613-24d8-5558-8bb3-7f3eeac46b26/media/blocks-debug.apk`
- `/cursor/stores/bc-cda16613-24d8-5558-8bb3-7f3eeac46b26/media/blocks-debug-metro.apk` (same bytes and hash as the Metro APK)
- `/cursor/stores/bc-cda16613-24d8-5558-8bb3-7f3eeac46b26/media/blocks-standalone-debug.apk`

## Audio and timing

Separate from packaging. The standalone `libblocksengine.so` bytes match the Metro APK for both ABIs. arm64-v8a sha256 `7b3b417bf2034c38402db8a26fd1ad1b8ff8c8837723da86c053706403ac3a5c`. x86_64 sha256 `61028283622503e17ea2519c544bc3e1f5402c724051c85ed4019bc632e8f4c7`. Both exports include `Java_com_blocks_sketchbook_BlocksNative_nativeEnqueue`, `nativeReplay`, and `nativePoll`. The audio callback was not retuned for this package. No latency number is claimed.

Host tests, unchanged engine:

```text
npx vitest run
Tests  22 passed (22)
```

The new case checks that CC 64 and note-ons are refused as Capture or Play/Stop mappings, that another CC can be learned, and that every event is still recorded.

## Browser smoke

Chrome, headless, against `http://127.0.0.1:41713/` (HTTP 200 on this machine). Real clicks on the running page. Not USB, not a pedal, not a Fold, not a latency measurement.

| Screenshot | What the page showed |
|---|---|
| `media/touch-instrument.png` | On-screen C key. Ribbon gained note events. |
| `media/audiocontext-state.png` | `AudioContext: running` after Enable. It was `suspended` before that click. |
| `media/permission-denied.png` | `Input · permission denied` and `MIDI permission was denied.` |
| `media/capture.png` | `Captured 3 events into layer-1.` |
| `media/replay.png` | Same take, button reads `Stop loop`. |
| `media/undo.png` | After Undo capture, `Layer · empty`. |

`requestMIDIAccess` is a function in this Chrome, including with `--disable-features=WebMIDI`. The unsupported screen was not reached. A granted MIDI permission was not obtained either: the browser returned `NotAllowedError`, so the no-device screen was not reached and no `no-device` screenshot is kept. No hardware controller was moved, so the learned-CC label was not exercised in the browser. The host test covers that refusal and mapping.

## Not run

- Emulator. `$HOME/android-sdk/emulator/emulator` is not installed. It was not booted, and the standalone APK was not installed or launched.
- USB, a pedal, a Fold, hotplug, and any latency measurement.
- An outside-the-machine GET. The server is bound to `0.0.0.0:41713` and answers on this machine. No public URL is claimed.

Web and Android device gates stay open.

## Commit

Implementation commit for this packaging and learn pass is recorded below after `git rev-parse`. The stamp commit only adds that hash.

Stamp: implementation commit `e4fefc54c33426e70d3e14c94a6673b902f8e5df`.
