# Verification matrix

Status words: `host` means a deterministic test on this machine. `open` means the check still needs a device, a browser with hardware, or an emulator that was not run.

| Check | Where | Status |
|---|---|---|
| Straight pulse, original times unchanged | `src/domain/host.test.ts` | host |
| Staggered chords stay one attack | host test | host |
| Swing reported, not quantised | host test | host |
| Syncopation counted, time kept | host test | host |
| Pickup candidate | host test | host |
| Sparse chords and pedal events kept | host test | host |
| False start and gap | host test | host |
| No pulse, no invented bpm | host test | host |
| Half/double does not change project tempo | host test | host |
| Quantise is a copy; recover clears it | host test | host |
| Loop tools refuse a missing pulse | host test | host |
| Android and web clocks are not mixed | host test | host |
| Equal time orders by sequence | host test | host |
| Missing source timestamp flagged | host test | host |
| Web complete messages, velocity 0, CC 64 | host test | host |
| Web rejects fragments, running status, SysEx | host test | host |
| Enable resumes audio before MIDI, `sysex: false` | host test | host |
| Unsupported, denied, no device, suspended | host test | host |
| Port listener replaced, not stacked | host test | host |
| Audio times come from the audio clock; overdue notes are dropped | host test | host |
| Fragmented MIDI, running status, velocity 0, repeats, sustain | `native/tests/test_main.cpp` | host |
| SysEx ignored, including a fragment across feeds | native test | host |
| Ingest overflow, synthetic releases with empty raw bytes, discontinuity | native test | host |
| Disconnect panic is not raw MIDI | native test | host |
| Nanosecond to frame error within half a frame | native test | host |
| Note starts at the converted frame | native test | host |
| Old stream generation does not play | native test | host |
| Very late note-on is counted and not sounded | native test | host |
| Two producers can fill the ingest queue | native test | host |
| Louder velocity is louder; pedal holds | native test | host |
| C++/Oboe files compile with the NDK | `aarch64-linux-android29-clang++ -c` | host, objects only |
| Debug APK links `libblocksengine.so` | Gradle `assembleDebug` | see the verification report |
| Emulator boot and install | not run unless the report says it started | open |
| Browser with a real keyboard | not run | open |
| USB or Fold attach, hotplug, unplug of notes and CC 64 | not run | open |
| Fresh reconnect without a duplicate listener on a device | host covers the assignment; the device does not | open |
| Velocity and pedal capture/replay by ear | not run | open |
| Tab suspension on a real browser | state machine only | open |
| Web gate and Android gate | open until that evidence exists | open |
| Audition of `blocks.ep.fm.v1` | not done | open |
| Sample packs | not bundled | not applicable |

`getOutputTimestamp` is not used and is not reported as latency.
