# Phase 13: quality review and reverb spike

11 November 2026. Initial runtime audit against ad65074 by product, DSP and engineering reviewers. This document records the research decisions; subsequent implementation and evidence are in [Phase13 results](phase13-reverb-results.md). No listening approval or claim of parity with Serum, Soundtoys or Valhalla.

## Current quality and priorities

The architecture supports useful original sounds, but final sound quality remains open. Priorities: whole-chain headroom, distinctive colour models, stable low end, then spaciousness. More controls do not establish quality.

Verified path: oscillators/unison → per-note filter/Fullness/amp/pan → Harmonics → Width → Delay → native-rate tanh → master gain. Aligned Clean Sub joins after tanh. Lowering master cannot reduce tanh input drive. This extra nonlinearity can undo benefits of oversampling inside Harmonics.

Reprocessed the existing 30 Suite coherent-sine PCM fixtures through `numpy.tanh`, corresponding to the final waveshaper with Width/Delay inactive and no Clean Sub. Each fixture contains 8192 samples at 48kHz after warmup, source amplitude .12. Analysis excludes DC/legal in-band harmonic bins and references fundamental (octave for Rectify). At 2103.515625Hz with Amp/36dB drive, nonharmonic energy changes from −61.72 to −40.00dB and RMS falls 2.20dB. Tape/36dB changes from −58.05 to −49.80dB; Clip/36dB from −41.48 to −35.18dB. Evidence: workspace `work/phase13-review/post-tanh-probe.json`. This isolated steady-sine measurement establishes a consequence, not subjective audibility or whole-synth certification.

First compare real plucks/chords/leads with intentional output colour separated from protection. Evaluate a stereo-linked lookahead gain limiter with declared latency, aligned routes and independent reconstructed-peak checks. It is a candidate, not automatically transparent. [Signalsmith limiter design](https://www.geraintluff.co.uk/writing/2022/limiter/).

Other quality opportunities: high-detune unison uses 1/N copy normalization, lowering incoherent RMS and therefore downstream drive; preserve safe peaks while evaluating perceived level. Main/Sub phase and mono compatibility need actual-patch checks. Nine-note/seven-copy stress already exceeds the 128-frame budget with Suite off: this is an existing instrument limit, not a future-reverb finding. No silent voice downgrade.

Further audit targets: existing static-wave tests do not establish quality during fast PWM, glide, harmonic-table transitions or combined Bass/motion/unison. Held-note switching between Ladder's delayed oversampled path and the ordinary filter path also needs alignment/comb-filter measurements. These are coverage gaps and hypotheses, not demonstrated audible defects.

## Reverb references

| Reference | Behaviour worth learning | Application |
|---|---|---|
| [ValhallaPlate controls](https://valhalladsp.com/2015/11/08/valhallaplate-the-controls/) | Restrained modulation reduces metallic ringing; output EQ and decay are separate | Stable lush default, expressive movement at higher settings |
| [ValhallaPlate diffusion](https://valhalladsp.com/2015/11/18/valhallaplate-diffusion-and-presets/) | Solve density internally rather than require corrective controls | Compact, well-tuned Plate |
| [SuperPlate manual](https://www.soundtoys.com/wp-content/uploads/SuperPlate-Manual.pdf) | Predelay/input filtering preserve clarity; Auto-Decay changes decay duration | Clear transients and controlled bass; defer dynamic decay rather than relabel wet ducking |
| [Dattorro paper](https://aes.org/publications/elibrary/elibrary-page/?id=10160) | Published diffusion/cross-coupled tank architecture | Original bounded Plate prototype |
| [Signalsmith Basics](https://github.com/Signalsmith-Audio/basics/blob/main/include/signalsmith-basics/reverb.h) | Public multichannel feedback/diffusion network | Hall reference/candidate |
| [Valhalla VintageVerb modes](https://valhalladsp.com/2023/02/10/valhallavintageverb-the-modes/) | Concert Hall uses lush chorusing; Random Space/Smooth Random use randomized delay modulation; Chaotic Hall adds restrained wow/flutter and colour | Compare a clear expansive Hall with an organic-motion variant, keeping pitch wander controlled |
| [ValhallaShimmer controls](https://valhalladsp.com/2010/11/27/valhallashimmer-the-controls/) | Diffuse delay networks with audio pitch shifting inside feedback produce accumulating harmonic clouds | Research Shimmer as a genuine pitch-shifted wet-feedback mode, not extra MIDI voices |

Commercial manuals describe behaviour, not full proprietary DSP. Do not claim EMT/Valhalla/Soundtoys model equivalence. Signalsmith is MIT but depends on DSP/STFX components; audit licences, dependencies and reset (which appears to omit delay4) before adoption. [Small MIT Dattorro C reference](https://github.com/el-visio/dattorro-verb) also needs sample-rate/index/allocation adaptation.

## Proposed implementation scope

Prototype offline: dense Plate for immediate sheen; modulated feedback-delay-network Hall for spacious bloom; Shimmer for evolving pitched ambience. Ship modes only if they sound usefully different. Preserve stereo injection, including antiphase input; naive mono summation is insufficient.

Hall research explicitly includes VintageVerb's Concert Hall, Smooth Random and Chaotic Hall approaches: distinguish diffusion/attack, damping and modulation character, rather than just lengthening a Plate. The organic-motion option fits our north star, but should not impose seasick pitch movement on every patch.

Shimmer research is now in scope at the user's request. Proposed wet-only pitch-shift branch inside controlled feedback, with selectable upward/downward intervals, Shimmer Amount, filtering and optional gradual bloom. Start auditions at +12 semitones; compare downward and dual-shift variants only after the basic loop is stable. Evaluate a windowed dual-read-head time-domain pitch shifter as an initial candidate, with anti-alias filtering and sufficient diffusion to conceal grain/repetition; architecture and quality remain unproven until rendered. Feedback gain, pitch-shifter energy, accumulated bass/treble and parameter edits require explicit stability tests. Do not infer stability from a feedback coefficient below one alone.

This differs from the separate MIDI Pitch Echo backlog: reverb shifts the actual processed audio/tail, preserving its colour and diffusion, while MIDI echoes retrigger voices. Offer Shimmer as a distinct mode or optional wet branch with contextual controls, sharing the reverb infrastructure without assuming that a Hall preset plus pitch shift reproduces Valhalla's private algorithm. Keep dry pitch untouched and default shimmer amount off outside the Shimmer mode.

One portable global stereo processor after Delay, independent of note count. Wet path: predelay → input low-cut → diffusion/tank with frequency-dependent decay → wet EQ/width → mix. Clean Sub bypasses the send by default. Final protection follows the common mix, subject to the headroom decision. Allocate at prepare; smooth gains/damping; crossfade delay edits; specify power/type/tail/panic behaviour.

UI: compact Reverb Output card in Sauce. Main: Type, Decay, Tone, Mix, power. Details: Predelay, Low Cut, modulation amount/rate, wet Width, output Trim; Shimmer adds Amount and Interval contextually. Start off with useful stored settings. Plate 1.6s/18% mix/12ms predelay/180Hz low cut are audition starting points, not approved defaults. Defer freeze, preamp models, Auto-Decay and Moving Space. Shimmer is researched now, with implementation following the validated base reverb.

## Sequence and acceptance

1. Resolve output headroom with fixed-gain and separately gain-matched listening fixtures, two-tone/chord intermodulation and reconstructed-peak checks.
2. Render dry/Plate/Hall/Shimmer bass plucks, arpeggio, sustained chord and bright lead with exact patch/event manifests. For Shimmer, check harmonic buildup, grain artifacts, dry-pitch preservation and bounded tails at high feedback.
3. Measure octave-band decay, density buildup, late-tail spectral peaks, stereo correlation, mono/antiphase response. Confirm finite tails, Mix0/Off behaviour and Clean Sub isolation.
4. Verify live predelay/decay/type edits, deterministic block partitioning and panic without stale tails or render allocation.
5. Measure isolated and full-chain cost. Independent UX may reject interaction/layout. Listening must approve character; engineering tests do not grant that approval.

The initial spike delivered review and research. The user subsequently authorized implementation: see [the delivered scope and evidence](phase13-reverb-results.md), including the original shared FDN choice rather than a copied Dattorro implementation.
