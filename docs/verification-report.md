# Verification report

Host checks were run on this machine. Browser hardware, USB, a Fold, playing feel, and latency were not. The UI proposal was not user-tested. QA stays open.

## Commands and results

JavaScript host tests:

```text
npx vitest run
Test Files  1 passed (1)
Tests  21 passed (21)
```

Native host tests:

```text
npm run test:native
g++ -std=c++20 -O2 -Wall -Wextra -I native/include native/src/midi_parser.cpp native/src/instrument.cpp native/src/pipeline.cpp native/src/render.cpp native/tests/test_main.cpp -o /tmp/blocks-host-tests && /tmp/blocks-host-tests
native host tests passed
```

`npm test` runs both.

NDK compile of the Oboe engine and JNI bridge, objects only, not a device run:

```text
aarch64-linux-android29-clang++ -std=c++20 -c native/src/oboe_engine.cpp native/src/jni_bridge.cpp
exit 0
```

Debug APK:

```text
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64 --no-daemon
BUILD SUCCESSFUL in 2m 45s
```

APK path: `/workspace/android/app/build/outputs/apk/debug/app-debug.apk`

APK sha256: `c4aa0796756b67a64026fefa360b62155ee1bb9bfeecf6f3c178a00dcf809e0c`

`unzip -l` shows `lib/arm64-v8a/libblocksengine.so` and `lib/x86_64/libblocksengine.so`.

The web dev server answered HTTP 200 on port 41713. A headless Chrome screenshot showed Warm EP, the readiness lines, the empty take ribbon, labelled on-screen keys, and the Capture bar. That is a render check. It is not proof a keyboard, a pedal, or a speaker worked. Enable was not clicked in that browser, so no MIDI permission result was observed.

## Not run

- Android emulator. `/dev/kvm` exists, and no emulator package or AVD was installed. No system image was downloaded. The emulator was not started.
- A physical keyboard, USB MIDI, CC 64, hotplug, or a Samsung Fold.
- An audition of Warm EP.
- Browser proof that Web MIDI received a device. API support from the BCD file is not that proof.

Web and Android gates stay open.

## Commit

The commit that contains this report is recorded after `git rev-parse HEAD` in the stamp line below once that commit exists. The APK hash above is of the debug APK built before the Play-screen copy pass. That pass did not change the C++ or Kotlin, so the packaged `libblocksengine.so` is the one from this Gradle run. Debug APKs load JavaScript from Metro rather than baking this later UI into the APK.

Stamp: see the commit that adds this file.
