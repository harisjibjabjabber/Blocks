# Contracts

These are the boundaries this slice implements, and the sound proposals it does not implement.

## Capture record

Every stored event carries a time domain, a sequence, a port, a session, a channel, a kind, raw bytes or an explicit null, an origin, a receipt timestamp, and a source timestamp or a missing flag. Android domain unit is signed nanoseconds. Web domain unit is integer microseconds derived from performance-origin milliseconds. A function that is handed the other domain throws. There is no conversion between them.

`scheduleElapsed` uses the source timestamp when it exists, otherwise the receipt timestamp. Both are relative to the first timestamp of that kind in the rolling history. Equal schedule times sort by sequence.

Origins:

- `raw-midi` — bytes from a device, or a replay of those bytes
- `touch` — the on-screen pads
- `synthetic-overflow` — note releases created because a queue was full, raw length 0
- `synthetic-disconnect` — releases after the device went away
- `synthetic-lifecycle` — releases when audio stops for focus or pause

Synthetic releases are not raw MIDI.

## Phrase

Capture copies the rolling window into a frozen performance. Each event keeps the id assigned when it was recorded. Half, double, phase, and loop length move a 4/4 grid overlay. They do not rewrite input timestamps and they do not invent events past the last recorded one. The sketch tempo stays at its locked value. Inference may return no reading or one reading. It does not invent a set of three candidates or a confidence score. Quantise is not applied on this screen.

## Play screen

This is the first slice, not the proposed UI spec. That proposal was not user-tested and is not engine law.

- The sound label is Warm EP (`blocks.ep.fm.v1`). It is not a brand and not a sampled piano.
- Enable resumes audio before the MIDI prompt. The browser decides how many prompts appear.
- Readiness separates unsupported API, denial, no device, disconnect, and suspended audio.
- The ribbon targets 120 seconds, with a hard cap of 4096 events and 262144 counted bytes. Age eviction and overload are reported separately. Overflow is not described as lossless. These caps are slice limits, not a measurement from a phone.
- Capture writes a new layer. It does not overwrite one. The default after capture is to loop. Stay silent is a persistent project setting. Review stays on the page. One undo puts the ribbon back and removes that capture.
- A capture made while a loop is running waits for the next loop boundary. The selection uses events that already exist.
- On-screen keys are labelled as on-screen keys and are not a MIDI input.
- CC 64 remains sustain. It is not the Capture control. Pitch bend, channel pressure, and expression stay in the raw take when the parser accepts them. Whether the FM voice sounds each of them is separate. A synthetic panic release is not raw input.
- Native MIDI is foreground-first. The in-memory ribbon is kept when audio stops.
- No heard-time rewrite and no latency compensation. There is no measured keyboard-to-speaker latency.
- Piano roll, autosave of the ribbon, export, a fixed four-layer maximum, and full controller learn are not in this slice. One grid and one loop are the shared model so far.

## MIDI and audio

Native parser accepts fragments, running status, and interleaved realtime bytes. It counts and drops System Exclusive. Web accepts one complete message and rejects running status, fragments, and SysEx.

Live sound does not use a UI timer as the note time. Capture does not require a running audio stream.

Android frame conversion error is at most one frame by nearest-integer math. Late and stale counts are counters, not latency measurements. Web overdue events outside 40 ms are dropped rather than played as a burst.

Queue capacities: ingest 256, audio SPSC 256 (255 usable), capture 4096. Voices: 16. Sustain threshold: controller value 64 or higher. Default controller: 64.

## Sound presets

| Id | Status in this slice |
|---|---|
| `blocks.ep.fm.v1` | Implemented. Procedural FM electric piano. Parameter values are in the preset sources. Not auditioned. Not a sampled piano. Android and web are separate renders. |
| `blocks.bass.pluck.v1` | Proposed only. No code. |
| `blocks.pad.soft.v1` | Proposed only. No code. |
| `blocks.drums.electro.v1` | Proposed only. Not bundled, not converted, not auditioned. If a later slice adds it, the only approved starter is FreePats Synthesizer Percussion 2022-07-18, archive sha256 `dbb2e5bb8268022fffa6dcc3d11a93368316038bf3ae81a965c58e9d490ed23b`, CC0, the 12-slot GM map in the sound-library manifest. Key and root move together. Hats choke. Drum one-shots ignore sustain. It is electronic, not acoustic jazz, brushes, or a real ride. Converted-pack hashes would have to be checked, and the licence text and voluntary credit kept. No SFZ/SF2 engine. No decode, IO, or allocation on the audio thread. |
| `blocks.piano.kw-small.v1` | Optional proposal. Upright Piano KW small 2019-07-03, archive sha256 `e346ef198fcda0694fc66ddb80c2db2a1c700e96e3a1801930e3cebfed37047f`, CC0, one recorded velocity layer, not auditioned, not mandatory, not bundled. The quarantined WAV extract is not a source. No photos or logos. |

Rejected for commercial bundling: jRhodes3d, because its samples are CC BY-NC. Not selected, and not promoted: Salamander, VSCO, Karoryfer, Muldjord, and the TinySoundFont example. Those stay held.

No public release of this slice.

## Platform gates

Web readiness is true only when the audio context is running and MIDI access succeeded. Missing API, denial, no device, disconnect, and suspended audio stay distinct.

Android readiness for sound is a started Oboe stream. MIDI capture can still deliver events when that start fails. Physical attach, hotplug, unplug, velocity, pedal, and listener checks are not claimed from this host.
