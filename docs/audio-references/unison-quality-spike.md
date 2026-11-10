# Unison and oscillator quality spike

10 November 2026. The user rejected the current Unison sound as nasal/phasey. Technical tests and desktop timing do not constitute musical approval. Live Unison DSP is frozen while research and isolated oscillator comparisons continue. Neutral Init/reset/Output/Delay work is retained; this phase is not marked ready.

## Target and code audit

Lush, thick, raw and gently unstable, with a convincing fundamental. More treble or loudness alone is not the target. Unison adds closely spaced partials and beating; nonlinear colour can add further overtones.

The current generator is already hybrid: PolyBLEP saw/pulse/square, a 2048-point sine table and bandlimited mipmapped triangle tables. Current Unison restarts every lane at zero, uses symmetric linear cents offsets, shares note-level drift across copies, maps low/high pitch monotonically left/right and weights copies by 1/N. At C4, four copies with 25-cent maximum offsets have adjacent spacings about 2.50/2.52/2.54 Hz. Coherent, recurring interference is a strong hypothesis to audition, not a diagnosis of the exact user patch. The gain rule also loses power as copies decorrelate; changing gain changes downstream saturation and must be tested independently.

## Primary references

| Reference | Verified public behavior | Useful distinction |
|---|---|---|
| [Diva guide, Trimmers](https://u-he.com/downloads/manuals/plugins/diva/Diva-user-guide.pdf) | Separate voice/oscillator detune, drift and cutoff/envelope/PW/glide variance; analog and oscillator-reset transient policies. | Fixed differences, evolving motion and phase policy are separate mechanisms. |
| [Sylenth1 manual, oscillator section](https://www.lennardigital.com/files/Sylenth1Manual.pdf) | Separate Unison, Detune, Stereo, Phase and Retrigger controls. | Effective virtual-analog unison does not require a wavetable instrument. |
| [Serum 2 official guide, oscillator pp42–43 and Blend](https://xferrecords.com/manual/serum-2) | Describes a distracting repeatable sweep from detuned voices starting together, independent phase randomization, and central/detuned voice balance. | Test phase first, then body/layer balance. This is consistent with our hypothesis, not proof of the user's exact cause. |
| [Massive X voice manual](https://docs.native-instruments.com/ni-tech-manuals/massive-x-manual/en/voice-page.html) | Freerun/reset modes, phase spread and unison of the full routed voice architecture. | Oscillator-bank unison and full-voice stacking are distinct cost/character choices. |
| [Prophet-5 guide, Vintage and Unison](https://www.sequential.com/wp-content/uploads/2021/02/Prophet-5-Users-Guide-1.3.pdf) | Physical voice stacking; vintage variation includes oscillators, filters, envelopes and amplifiers. | One shared pitch LFO is not a complete analog-voice model. |

These manuals describe public behavior, not proprietary DSP internals. Open-source checks are pinned: [Vital 636ca0e](https://github.com/mtytel/vital/blob/636ca0ef517a4db087a6a08a6a8a5e704e21f836/src/synthesis/producers/synth_oscillator.cpp) has phase randomization, shaped detune and center/detuned Blend with energy normalization. [Surge helper 7209f14](https://github.com/surge-synthesizer/sst-basic-blocks/blob/7209f14567b37a0db6986c7cb1680089e97c8516/include/sst/basic-blocks/dsp/OscillatorDriftUnisonCharacter.h) uses linear symmetric offsets, alternating pan and 1/sqrt(N) gain; [Classic d307b47](https://github.com/surge-synthesizer/surge/blob/d307b472cd5e986baf61f9db0a4f173183aba3f9/src/common/dsp/oscillators/ClassicOscillator.cpp) has reset/random phase initialization and per-lane drift. Linear spacing alone is therefore not inherently defective. Any adopted code must retain its actual licensing obligations; architecture study does not require copying it.

## Sound-generation choice

Keep a modular virtual-analog source layer. Choose implementations by wanted-harmonic accuracy, aliasing, modulation behavior and actual WASM cost, rather than the label "wavetable" or "analog".

[Pekonen's Aalto thesis](https://research.aalto.fi/en/publications/filter-based-oscillator-algorithms-for-virtual-analog-synthesis/) covers polynomial/table antialiasing, audibility and MiniMoog Voyager waveform models using phase distortion or frequency-dependent post-filtering. [Brandt, Hard Sync Without Aliasing](https://www.cs.cmu.edu/~eli/papers/icmc01-hardsync.pdf) motivates fractional-event MinBLEP for sync. [Esqueda/Valimaki/Bilbao, BLAMP](https://www.dafx.de/paper-archive/details/xRM0GiuF-JmeN0_aaP9VNg) treats slope discontinuities, including triangle corners. These are different tools, not a ranking with one universal winner.

The bounded source comparison is current PolyBLEP versus an oversampled analytic candidate and a carefully bandlimited table candidate. Keep sine/triangle controls. Test steady notes and moving pitch/PWM, with exact Fourier references for stationary tones and a converged high-rate reference for modulation. Measure wanted harmonic loss as well as unwanted energy: a duller source must not win simply by filtering more highs. Nonlinear Drive can add new aliases after source generation, so measure source and driven paths separately. Defer a production MinBLEP/sync engine until that capability earns its complexity.

## Proposed implementation sequence

1. Preserve the current prototype and a controlled dry listening fixture. Isolate coherent restart, seeded independent phase starts and properly specified free-running phase; hold tuning, gain and pan constant. Randomizing at note-on is not literally continuous idle phase.
2. Compare balanced center/layer Blend and alternating stereo placement separately. Use fixed-gain and gain-matched clips. Changing 1/N to 1/sqrt(N) can raise coherent peaks, so normalization is not a drop-in cure.
3. Compare linear versus gently shaped/irregular but centered detune. Add small independent lane motion only after the phase/mix result is preferred. Preserve deliberate note-level Pitch/Hit controls separately from micro-variation.
4. Refactor source generation behind an isolated interface and publish measured candidate comparisons. Preserve the live legacy path while evaluating. Add analog waveform/tolerance profiles only where evidence and listening support them.
5. Prefer an efficient oscillator bank for the first mobile design; audition a small full-voice stack if independent filter/envelope variation justifies the extra work. Existing two-channel processing is not itself evidence of a defect.
6. Replace the live Unison only after listening preference. Retain a repeatable-attack option for bass/plucks and independent control over amount/speed. Keep the UI compact until the sound design settles.

Acceptance includes C1/C3/C5, repeated plucks, eight-second sustains and chords, counts 2/3/4, stereo and mono, fundamental retention, attack variability, envelope troughs, DC/peaks/aliasing, ownership, allocation-free rendering and measured CPU. Zero-detune cancellation needs an explicit check: phase randomization can make that case worse. Count 1 stays exact. Initial listening uses a small matched set rather than hundreds of clips. Existing maximum-rack and physical-phone limits remain open.
