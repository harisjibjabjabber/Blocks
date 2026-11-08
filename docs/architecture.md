# Architecture

## Decision

One React Native UI, two platform adapters, and one capture domain that never treats Android nanoseconds and web performance time as the same clock.

| Module | Owns | Does not own |
|---|---|---|
| `src/domain` | Rolling history, immutable phrases, pulse reports, overlays | Devices, audio, storage IO |
| `src/midi` | Web MIDI message checks and the enable/permission state machine | Parsing of fragmented native bytes |
| `native/` | MIDI 1.0 byte parser, ingest queue, SPSC audio queue, FM voice, Oboe callback | Phrase inference |
| `src/audio/web` | Web Audio FM piano and lookahead scheduling | Android frames |
| `src/ui` | The sketchpad screen | Clocks and DSP |
| `src/domain/project.ts` plus the platform stores | Project tempo, sustain CC, captured phrase JSON | Autosave of the rolling buffer |
| `android/` | Debug APK, `MidiManager`, audio focus, lifecycle | iOS |

Android live notes go from `MidiReceiver` to the C++ queue to the Oboe callback. JavaScript receives a copy for the rolling history. Replay on Android is scheduled in the serializer and the audio callback, not with UI timers. On the web, note times are `AudioContext.currentTime` seconds. The 10 ms timer only feeds a 25 ms lookahead.

## Play screen

The proposed UI spec, gestures, acceptance criteria, and tokens are not engine law and were not user-tested. The Play screen follows the lead corrections: Warm EP, readiness, a 120-second ribbon with separate age and overload notices, Capture onto a new layer, non-modal review, one undo, loop-after-capture unless stay-silent is set, and manual half, double, phase, and loop corrections on a 4/4 grid. Input timestamps are not rewritten.

## Clocks

`MidiReceiver.onSend` documents its timestamp as based on `System.nanoTime()`. The current AOSP implementation of `System.nanoTime` is `clock_gettime(CLOCK_MONOTONIC)` in `platform/libcore` `ojluni/src/main/native/System.c` (`System_nanoTime`). The JavaDoc does not name the clock. It does say the value does not include deep sleep, which matches `CLOCK_MONOTONIC` rather than `CLOCK_BOOTTIME`. An older AOSP change tried `CLOCK_MONOTONIC_RAW` and was reverted. This slice therefore reads `CLOCK_MONOTONIC` in the native engine and `System.nanoTime()` at receipt in Kotlin. They are the same documented time base on current AOSP, not a wall clock.

A timestamp of `0` is flagged missing. AOSP `MidiReceiver.send` without a timestamp forwards `0L` and comments that this should become `TIMESTAMP_NONE`.

Relative offsets are signed 64-bit nanoseconds. Conversion to frames is nearest-integer `__int128` arithmetic. The mathematical error is at most half a frame. That is a conversion bound, not a latency claim. The mapping is a generation plus an anchor. Restart, route-error reopen, and sample-rate change publish a new generation. Events stamped with an older generation are counted stale and are not played as a burst. Events more than 20 ms behind the callback are counted late. Note-ons that late are dropped. Note-offs still run so a note does not stick. The 20 ms window is a drop policy, not a measured latency.

Web records `MIDIMessageEvent.timeStamp` and `performance.now()`, both performance-origin milliseconds, and stores integer microseconds in that domain only. Replay maps those microseconds onto `AudioContext.currentTime` with an anchor taken when playback starts. Suspension or a new generation cancels scheduled nodes and the anchor. History is not rewritten. `AudioContext.getOutputTimestamp` is not called. It is not a keyboard-to-speaker measurement.

Equal timestamps keep their sequence order.

## Native audio path

Producers (the MIDI binder thread, touch, replay) copy bytes into a mutex-protected ingest ring of 256 chunks. A serializer thread is the only consumer of that ring and the only producer of two SPSC rings: 256 slots toward the audio callback (255 usable) and 4096 slots toward capture. The callback reads the audio ring, renders, and returns. It does not allocate, lock, log, call JNI, or close the stream.

Overflow sets a panic. The serializer emits note releases with origin `synthetic-overflow`, raw length 0, and increments a discontinuity count. Disconnect and lifecycle stops use `synthetic-disconnect` and `synthetic-lifecycle`. Those records are not raw MIDI.

The voice is `blocks.ep.fm.v1`: one carrier, one modulator at ratio 1, velocity-scaled index, a short attack, a decay toward a sustain level, a release, and a slow tremolo. Sixteen voices. Public parameter values live in `native/include/blocks/ep_preset.hpp` and `src/audio/web/preset.ts`. The two implementations are not claimed to match sample for sample. They have not been auditioned as a sign-off.

Oboe is the transport. The instrument is not Oboe.

## Android product pins

- React Native 0.88.1, New Architecture flag on, Hermes on. The engine is a `ReactContextBaseJavaModule` registered with `BaseReactPackage` (`isTurboModule = false`) so the APK does not wait on a generated spec. The realtime path does not cross that bridge.
- `minSdk` 29. The 0.88 template default is 24. MIDI exists at 23 and AAudio at 26, but this slice targets AAudio-era Fold-class devices and does not ship the OpenSL fallback as a supported path. Oboe is still linked and would use its own fallback if the min were lower.
- `compileSdk` 37, `targetSdk` 36, build-tools 37.0.0, NDK 27.1.12297006, CMake 3.22.1. `sdkmanager` has `platforms;android-37.0`, not `platforms;android-37`.
- Oboe 1.11.0, vendored from the tag tarball, Apache-2.0. License: `third_party/oboe/LICENSE` and https://www.apache.org/licenses/LICENSE-2.0. Version macros: `third_party/oboe/include/oboe/Version.h`.
- Stream request: low-latency, exclusive (the negotiated mode is reported, not assumed), float stereo, no explicit sample rate, `Usage::Media`, `ContentType::Music`.
- Conflict: the Android games low-latency checklist says `AAUDIO_USAGE_GAME`. Oboe `Definitions.h` says `Usage::Media` is for music performance and `Usage::Game` is for game audio. This app is a music performance, so the stream uses Media. Low latency still comes from the performance mode, the exclusive request, and the callback.
- Audio focus is `AUDIOFOCUS_GAIN` with pause-when-ducked. Loss stops the stream and does not resume it. The player taps Enable again. There is no foreground service and no background playback. `onHostPause` stops the stream.
- One MIDI input at a time, byte-stream transport, no SysEx, no UMP, no Bluetooth MIDI.

## Web pins

Enable order is fixed: the click resumes audio, then the page requests MIDI with `sysex: false`. Ready means the context is running and access succeeded. Unsupported API, denial, no device, disconnect, and suspended audio are different states. Hotplug uses `onstatechange` and replaces `onmidimessage`. It does not add a second listener.

## On-screen controller

For this slice the on-screen controller is the Touch pad row plus sustain learn. It is not a piano roll.

## iOS

Out of scope. The template `ios/` directory is not built or signed.

## Licenses

- App code in this repo: the project’s own source, shipped with the repo.
- Oboe 1.11.0: Apache-2.0, https://github.com/google/oboe/blob/1.11.0/LICENSE and https://www.apache.org/licenses/LICENSE-2.0.
- React Native and React Native Web: MIT, as published by their packages.
- No sample set is bundled, so no sample license is in the binary.
