# Product brief

Blocks is a musical sketchbook for a person who writes jazz at a keyboard, uses Ableton to finish pieces, and often has a Samsung Fold on the stand. The screen should stay quiet. The thing being protected is the performance: chords that are not lined up, swing, velocity, the sustain pedal, and small timing that is not a grid.

## This slice

1. MIDI comes in from a real keyboard.
2. It plays Warm EP (`blocks.ep.fm.v1`), a procedural FM electric piano. Velocity changes loudness and brightness. Sustain holds notes. The label is not a brand and not a sampled piano.
3. While stopped, a ribbon keeps about 120 seconds, and also stops at a hard event cap or byte cap. Age and overload are shown as different losses.
4. Capture freezes that history into an immutable phrase.
5. After Capture, the default is to loop the new layer. Stay silent is a setting that persists. Review sits on the Play screen. One undo reverts that capture. The sketch tempo stays locked. Input timestamps are not rewritten to a heard time.
6. Sustain stays CC 64. It is not used as the Capture button.

Nothing in the slice quantises or forces a scale unless the player asks. Asking only changes a derived playback view. The captured events stay as they were. The project tempo changes only when the player uses the tempo buttons.

## What the player sees

A dark page with the preset name, an Enable control, the MIDI port state, sustain learn, a large Capture control, the project tempo, and the captured phrases. Phrase tools offer half-time, double-time, a shorter or longer loop, a beat-one shift, a boundary nudge, optional quantise, playback at the project tempo, and recover. If the attacks do not make a pulse, the tools say so and do not invent a tempo.

Touch pads are labeled Touch. They are for trying the sound with a finger. They are not a silent stand-in for a missing keyboard.

## Out of this slice

Four layers, drums, a touch piano roll, autosave of the rolling buffer, MIDI part files, and WAV stems are written down as later work. There are no accounts, no cloud, no plugin hosting, no mastering, and no marketplace. There is no claim that a phrase can be exported as an Ableton session. There is no iOS build. There is no public release of this slice.

## Sound, stated narrowly

The only sound that plays is the procedural electric piano. Procedural bass (`blocks.bass.pluck.v1`) and a soft pad (`blocks.pad.soft.v1`) are proposals. A 12-slot electronic drum map (`blocks.drums.electro.v1`) and an optional one-layer upright (`blocks.piano.kw-small.v1`) are proposals. None of those are in the APK or the web bundle, and none of them have been auditioned in this app.
