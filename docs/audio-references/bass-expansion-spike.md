# Bass voice expansion spike

11 November 2026. Research and roadmap only; no DSP or UI implementation in this spike.

## Sound direction

Interpret the Zeds Dead reference as the darker, voiced/growling side of their bass palette, with weight underneath expressive midrange. This is a design interpretation rather than a recipe for every track. In a [direct interview](https://www.musicradar.com/news/zeds-deads-dc-on-producing-their-debut-album-and-striving-for-that-human-feel), DC discusses Operator basses, restrained distortion and a human, imperfect feel. [Ableton's Operator documentation](https://www.ableton.com/en/manual/live-instrument-reference/#operator) describes combining FM, subtractive and additive synthesis.

The current Rotor source rotates overtone phase around a fixed fundamental. A useful next step is control over harmonic balance and vocal resonances:

- **Growl voice:** ratio-locked FM/phase modulation plus moving formant resonances. Keep integer harmonic ratios in the guided range; shape the upper voice around a stable foundation. Prototype before choosing an alias-control strategy or promising production quality.
- **Bite colour:** extend the existing harmonic/drive tools with a controlled fold/asymmetric stage and useful pre/post tone shaping. Evaluate gain-matched settings rather than making the louder option appear better.
- **Fray experiment:** envelope/velocity-aware deviations of upper-harmonic shape and saturation bias, with bounded memory across notes. Keep sub tuning stable. This is an ear-led candidate, not an established improvement.

Avoid adding a permanent dial for every DSP coefficient. A selectable bass voice/recipe can reuse Spin, Motion and Grit, with deeper controls disclosed when wanted. Compare patches using the same notes, envelopes and gain before expanding the interface.

FM, formants, wavetable motion and folding are established techniques. No claim of worldwide novelty is justified. A distinctive product could combine anchored low end, expressive upper harmonics and envelope-aware movement under a few coherent controls. A candidate signature is **Motion Curl**: movement accelerates/decelerates inside a synced cycle but lands exactly on its next beat/bar boundary, extending the musical timing idea already used for Arp Curl.

## Dedicated mini Sub oscillator

Recommend an independent, centred, single-note sub voice. Default Off; Sine first, Triangle optional. Main controls: Level, stepped Octave and Clean/FX routing. Put note priority and phase/polarity options in Details; use lowest-held-note priority for chords initially, with last-note priority available. Avoid creating nine overlapping sub voices for a nine-note chord.

The sub follows the final musical note stream, including note effects, velocity, sustain, release and glide. Clean routing bypasses audio filters, Character/drive/Sauce, stereo widening and delay. Rejoin after the main colour path, before common master volume/metering and final output protection. Note ownership, amplitude gating, Stop and panic must always apply. [Serum's documented Direct routing](https://xferrecords.com/web-manual/serum-2/routing-an-oscillator-or-filter) is an established reference for bypassing filters and effects.

The current core applies a nonlinear output stage after Delay. Simply adding a sub before it would still colour/intermodulate that sub. The direct branch therefore needs an explicit place in the output architecture, with headroom and overload handling. Check phase/cancellation against the main oscillators, particularly at octave zero; do not disguise cancellation with a gain increase. Keep this portable in the C++ engine with additive saved state.

## Spin BPM Sync

Use one **Free Hz / Sync** switch; the existing Spin dial displays frequency or musical division accordingly. Preserve both stored values and migrate existing patches to Free. Offer note divisions, triplets/dotted values and explicit bar lengths. At 120 BPM, quarter notes are 2 Hz, eighth notes 4 Hz, sixteenths 8 Hz; a 4/4 bar is 0.5 Hz. Whole-note and bar labels differ in other time signatures.

Use a shared standalone/host musical clock. Keep free-running behaviour as the default, with optional note retrigger in Details. Interpolate tempo changes without waveform jumps; never silently cap a synced rate to the old 20 Hz free-rate limit. The source guard and parameter schema need deliberate handling of faster synced divisions. Native waveform previews follow the same musical phase.

## Filter envelope discoverability

The engine already has a separate curved filter envelope and depth parameter 24. Add a visible **Env Amount** dial directly to the Filter card, default zero, plus a direct link to the Filter envelope graph. Reuse existing state, Undo, reset and DSP. This is a discoverability improvement; optional shared amp/filter-envelope linking can be considered separately.

## Recommended order

1. Foundation pass: clean mono Sub, Spin Sync and visible Filter Env Amount.
2. Growl prototype: harmonic modulation plus formant motion, a few guided voices and fixed-gain auditions.
3. Audition Fray/Motion Curl and additional distortion colours; retain only clearly useful variations.

Validate the changed paths with focused note-lifecycle, bypass/latency, mono/phase, gain/DC, spectral and preview checks. Musical preference still needs listening.
