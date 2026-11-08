# Slice record

## Outcome

Blocks plays MIDI into Warm EP (`blocks.ep.fm.v1`), keeps a 120-second ribbon with event and byte caps, captures that ribbon into a new layer, and can loop it. The original timestamps stay put. Half, double, phase, and loop length move only the 4/4 grid. Bass, pad, drums, and the KW piano are not in the build. The UI proposal was not implemented as a whole and was not user-tested.

## Owned files

Capture domain: `src/domain/capture.ts`, `inference.ts`, `phrase.ts`, `project.ts`, `host.test.ts`.

Web MIDI: `src/midi/web/complete.ts`, `enable.ts`.

Web audio: `src/audio/web/preset.ts`, `instrument.ts`, `schedule.ts`.

Adapters: `src/adapters/engine.web.ts`, `engine.native.ts`.

UI: `src/ui/App.tsx`.

Native parser, queue, FM voice, callback: `native/include/blocks/*`, `native/src/*.cpp`, `native/tests/test_main.cpp`.

Android: `android/blocks-engine/`, `android/app/src/main/java/com/blocks/sketchbook/BlocksNative.kt`, `BlocksMidi.kt`, `BlocksEngineModule.kt`, `BlocksEnginePackage.kt`.

Oboe 1.11.0: `third_party/oboe/` (samples and apps removed; library, license, and headers kept).

## Inputs and outputs

Input is a MIDI byte stream, or a labelled on-screen key. Output is the FM voice and a captured phrase whose elapsed times are the input timestamps. Replay reads those times. It does not write a heard-time back into the take.

## Acceptance

The host tests listed in the verification report passed. The APK contains the native engine library. The web page renders the Play controls. Device gates are open.

## Dependencies

React Native 0.88.1, React 19.3.0, React Native Web 0.21.2, Oboe 1.11.0 Apache-2.0, NDK 27.1.12297006, CMake 3.22.1, minSdk 29. No sample decoder. No SFZ or SF2 engine.

## Limitations

No measured latency, no audition, no emulator, no keyboard proof. Native MIDI is foreground-first. The ribbon caps are slice limits, not a phone measurement. One meter, 4/4. One undo. Stay silent persists in the project JSON. Debug APK JS still comes from Metro.

## Change report

The seeded README was replaced with run instructions. The Play screen follows the lead corrections rather than the proposed spec.
