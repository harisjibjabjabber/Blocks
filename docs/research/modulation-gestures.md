# Direct modulation controls — 12 November 2026

The user wants expressive routing, including stepped pitch and voicing controls, with depth editing where the sound is being edited. A source should feel like something carried to a dial; assignment should not require returning to a distant Matrix.

## Interaction decision

The [official Serum 2 manual](https://xferrecords.com/manual/serum-2/docs), Exploring Sound Modulation, documents Alt/Option-drag for assignment depth and Shift+Alt/Option-click for uni/bidirectional polarity. These are separate from negative depth (inversion). We use those gestures alongside explicit touch controls, retaining Blocks’ double-tap reset convention for base dials.

- Each source has a restrained six-dot grip. A source-coloured token follows the pointer, names the hovered destination, and leaves controls unobscured. Viewport-edge scrolling reaches controls above the source row. Hover a sound-page tab to change pages while carrying a source; touch users can tap the handle, navigate/scroll, then tap a destination. Enter/Space assigns a focused eligible destination; Escape cancels.
- Assigned dials have a coloured range, a native effective-value dot and a small amount marker. Drag the marker, or Alt-drag the base dial, to change signed depth without changing its base value. Shift provides fine adjustment. One Undo covers a drag; Escape/pointer cancellation restores the previous patch.
- Tap the amount marker for a local editor with source selection, Amount, Unipolar/Bipolar, Invert and Remove. An Off LFO is explicitly identified and can be enabled there. The Matrix retains explicit mode controls too. Multiple sources can affect the same dial.
- Source modes are actual DSP transforms, not renamed depth signs. LFO bipolar uses its signed waveform; unipolar remaps it to 0…1 before source intensity. Envelopes use 0…1 or 2e−1 while a voice exists; idle envelopes contribute zero. Signed depth then scales/inverts the signal. Base patch values remain unchanged.
- Assignment reuses an existing canonical destination instead of duplicating the same physical control under an alias. Dropping on a zero-depth placeholder gives it an initial useful amount. At a maximum base value the default depth points downwards.

## Engine contract

Current-format modulation is version 4: four sources, up to 32 independent assignments per source, each with explicit polarity. Envelopes are version 2: three sources with the same assignment capacity. The C route adds polarity and remains bounded, with no allocation during rendering. This is a deliberate current-format revision; no compatibility layer was added for retired patch formats.

Independent oscillator/sub octave modulation is stepped and bounded −3…+3; fine pitch and detune remain smooth. Previously missing bindings for Character’s Harmonics drive alias, selected OTT bands and Filter A envelope amount now address their real native parameters. Off sources and inactive controls are not represented by fake animation. Unison count is captured on subsequent note attacks. Synced LFO, Delay and Bass clocks expose real stepped division destinations without resetting phase. Independent Drop Amount/Fall/Curve snapshot on subsequent attacks; Arp BPM/Division/Curl/Gate adopt at a bar boundary; Strum Spread/Humanize apply to the next collection while preserving queued releases. These stable-ID note assignments survive save/import, are pruned with their node and restore in one Undo. Structural module topology/model choices remain separate from numeric signal parameters.

## Verification

The focused browser proof is `scripts/synth-modulation-gesture-proof.mjs`; it starts an actual AudioWorklet in a separate muted headless browser. It checks real pointer assignment, amount dragging/Undo/cancellation, modifier gestures, mode persistence, multiple sources, keyboard and cross-page assignment, actual Drop/Arp/Strum dial and non-dial assignments with save/import/deletion/Undo, and local editor bounds at 320/390/760/1440. Native polarity and octave fixtures exercise actual sound/state rather than relying on UI rings. Broader state/workspace checks remain required before checkpointing.

Physical phone/MIDI and musical preference still require real-device listening. Browser geometry and DSP fixtures do not establish commercial-plugin equivalence.
