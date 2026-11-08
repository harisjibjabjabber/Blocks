# Last-chord retest

Synthetic only. Haris's MIDI was not available, and none of these events is his take. The earlier note is `docs/capture/last-chord-finding.md`. `fdba348` is still in the history.

The numbers below are what the capture functions returned when this history was executed. They are not a description of the rule we hoped would apply.

## The history

36 single notes from 800 ms, then four chords. Gaps between the single notes cycle through 180, 260, 140, 320, 220, 410, 190, 280, 150, 360, 240, and 300 ms. Each note has a real note-off, held 90–190 ms. Pitches repeat inside the line (60, 64, 67, and others).

Chord attacks, each note 16 ms after the previous one in the chord:

| Chord | Attack (ms) | Pitches |
| --- | ---: | --- |
| C | 10930 | 60, 64, 67 |
| Am | 12610 | 57, 64, 69 |
| F | 14850 | 53, 60, 65 |
| G | 16640 | 55, 62, 67 |

Attack gaps between the chords: 1680, 2240, 1790 ms. Note-offs are at the attack plus 470 ms, plus 0 or 40 ms depending on the root. Three families were run: pedal down before the chord and up 30 ms after the note-offs; pedal up 70 ms before the note-offs; no pedal.

Full history: 104 events and 48 note-ons when the pedal is present (36 line notes + 12 chord notes), from 800 ms to 17180 ms in the pedal-after-fingers family. No event has an origin other than raw MIDI. A looping layer does not write replay into the history. That stayed false in every run.

A capture of the line alone, before the chords, stored 800–9740 ms (72 events). `inferPulse` on that selection returned period 1490 ms, 40.27 bpm, 36 onsets. `proposeTempo` stored 40 bpm and did not lock it. A second accept locks 40. The line's loop duration was 8.94 s.

## What fdba348 did with this history

`inferPulse` never removed notes from the loop. It only returned a reading. `planFromElapsed` plus `selectDue` scheduled every stored note-on. None fell outside the loop duration. The drop, where there was one, was the phrase cut that chose the stored range. The loop duration is that range.

Pedal held through the note-offs, then lifted. No grid:

- stored 800–17180 ms, 104 events, 48 note-ons
- loop 16.38 s
- scheduled 48 note-ons, including the line and all four chords
- status ambiguous
- `inferPulse`: 40 onsets, 40.27 bpm

The same history with the 40 bpm proposal passed in as a beat, including while the 8.94 s line loop was already running, and again with the grid locked at 40:

- stored 12800–17180 ms, 20 events, 6 note-ons
- loop 4.38 s
- scheduled pitches 53, 60, 65, 55, 62, 67
- C 0/3, Am 0/3, F 3/3, G 3/3
- `inferPulse` on that stored range: 2 onsets, no pulse, "Too few attacks to estimate a pulse."
- scheduled note-ons: 6. Note-ons outside the loop: 0

The proposal was not locked, and the cut still said a locked beat had been read. The running layer did not add or remove notes. The new loop was 4.38 s, not the layer's 8.94 s.

Pedal up before the fingers, and the no-pedal family, with no grid:

- stored 14850–17150 ms, 6 note-ons
- loop 2.3 s
- scheduled pitches 53, 60, 65, 55, 62, 67
- C 0/3, Am 0/3, F 3/3, G 3/3
- scheduled note-ons: 6. Outside the loop: 0

With the 40 bpm proposal or the locked grid, those two families stored 12800–17150 ms, loop 4.35 s, and still scheduled only F and G.

This trace did not reduce the progression to the single G chord. It reduced it to F and G, or, when the pedal lift was not counted as the end of the sound, it kept the line and all four chords. The stage that removed C and Am was the cut.

## What changed

`FREE_GAP_MS` is still 1500. The 2.5× comparison is unchanged. No layout, copy, or styling file changed.

A trailing run of at least three attacks that each contain two or more notes is judged on its own rests. Those rests still use the existing 1.5 s hypothesis and the existing 2.5× test, but the median is the other rests in that run, not the single-note line in front of it. A note-off during a held CC64 is remembered, so the sound ends when the pedal lifts after the fingers have released.

`beatForCut` returns a tempo only when the grid is locked. A proposed 40 bpm is no longer passed into the cut. The second capture still accepts that number into the project. The shared clock, raw timestamps, and controllers are unchanged.

## The same history after the change

Every family and every mode now stores the twelve chord note-ons and schedules these pitches, in order: 60, 64, 67, 57, 64, 69, 53, 60, 65, 55, 62, 67. Repeated pitches are separate note-ons. The first line note is not in the selection. The history is still 48 note-ons.

| Mode | Stored note-ons | Range (ms) | Loop | Scheduled | Outside loop | Tempo passed into the cut |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| Pedal after fingers, no grid, proposed, or while the line loops | 12 of 48 | 10930–17180 | 6.25 s | 12 | 0 | none |
| Same family, grid locked at 40 | 12 of 48 | 10930–17180 | 6.25 s | 12 | 0 | 40 |
| Pedal before fingers, and no pedal, unlocked | 12 of 48 | 10930–17150 | 6.22 s | 12 | 0 | none |
| Those families, grid locked at 40 | 12 of 48 | 10930–17150 | 6.22 s | 12 | 0 | 40 |

`inferPulse` on that stored range reports 4 onsets and 36.25 bpm. That reading is not a bar, and it is not the list of scheduled notes. The 8.94 s line loop does not replace this 6.25 s take.

## Commit and deploy

Commit `497894e170ac150f06e5a8bea34d0d4e7f34e2fd` on `main`.

Pages run: https://github.com/harisjibjabjabber/Blocks/actions/runs/42516460709

https://harisjibjabjabber.github.io/Blocks/ returned HTTP 200. The script is `/Blocks/assets/index-CqMoO9xx.js`, HTTP 200, 372299 bytes, last-modified 19:44:03 GMT. It contains the new cut text. The previous script was `index-DGbe1J8t.js`.

## Musical limit

This is still not Haris's take, and it does not know harmonic function. Notes more than 40 ms apart are not one chord, so a rolled chord can still fall through the older cut. Two chords are not enough to form the run, so a two-chord idea can still be cut to the last chord. One single note after the chords hides the run. A rest that is an outlier among the chord rests themselves still splits, under the same 1.5 s and 2.5× tests. A long passage that is only chords, with no single-note line and no outlier rest, stays one progression, and that can be the whole comping session.

## Rolled chords, executed on 497894e

This run does not close the last-chord report. No code was changed for it, and nothing was deployed. The live script is still `/Blocks/assets/index-CqMoO9xx.js`. The 1.5 s hypothesis and the 40 ms attack cluster were not widened.

Same line as above, 36 notes from 800 ms. The four chords are rolled. Each step between notes in a chord is 60–120 ms. Each note has its own note-off, 460 ms after its attack plus 30 ms for each later note in the chord. Pitches still repeat: 64 in C and Am, 60 in C and F, 67 in C and G.

| Chord | First note (ms) | Roll offsets (ms) | Pitches |
| --- | ---: | --- | --- |
| C | 10930 | 0, 60, 120 | 60, 64, 67 |
| Am | 12610 | 0, 90, 180 | 57, 64, 69 |
| F | 14850 | 0, 70, 190 | 53, 60, 65 |
| G | 16640 | 0, 110, 180 | 55, 62, 67 |

The first-note gaps are again 1680, 2240, and 1790 ms. Pedal down is 50 ms before the first note. In one family the pedal lifts 40 ms after the last note-off. In the other it lifts 50 ms before the earliest note-off. The third family has no pedal. The prefix reading is again 40.27 bpm, stored as a proposal of 40 and, in the locked case, accepted as 40. History stays raw MIDI. Replay from a looping layer is not in it.

`inferPulse` did not remove notes. `selectDue` scheduled every stored note-on. The outside-loop count is 0 in every row. The stored range is the cut.

Pedal lifts after the fingers. Unlocked, and the same again with 40 bpm proposed but not locked (`beatForCut` passes no tempo):

- stored 800–17380 ms, 104 events, 48 of 48 note-ons
- loop 16.58 s
- scheduled 48 note-ons, the line and all four chords
- status ambiguous
- `inferPulse`: 48 onsets, 40 bpm

The same family with 40 locked:

- stored 12800–17380 ms, 20 events, 6 of 48 note-ons
- loop 4.58 s
- scheduled pitches 53, 60, 65, 55, 62, 67
- C 0/3, Am 0/3, F 3/3, G 3/3
- `inferPulse`: 6 onsets, 36.25 bpm

Pedal lifts before the fingers. Unlocked and proposed:

- stored 14850–17340 ms, 15 events, 6 of 48 note-ons
- loop 2.49 s
- scheduled the same six pitches, F and G
- C 0/3, Am 0/3

That family with 40 locked:

- stored 12800–17340 ms, 20 events, 6 note-ons
- loop 4.54 s
- scheduled the same six pitches

No pedal. Unlocked and proposed:

- stored 14850–17340 ms, 12 events, 6 of 48 note-ons
- loop 2.49 s
- scheduled the same six pitches

No pedal, 40 locked:

- stored 12800–17340 ms, 15 events, 6 note-ons
- loop 4.54 s
- scheduled the same six pitches

This execution does not keep only G. When the rests are counted, the cut keeps the last two rolled chords and drops C and Am. When the pedal covers the releases and the tempo is not locked, the cut keeps the whole line. A 60–120 ms roll is not seen as one chord, so the progression path from the tighter chords does not apply. That is the open failure.
