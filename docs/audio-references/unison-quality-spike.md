# Unison and oscillator quality spike

10 November 2026. The user rejected the original Unison sound as nasal/phasey, then selected phase profile C after repeated listening: its pluck was smoother than B's subtle bounce. The prototype now carries that phase policy plus tested low-detune body protection; the oscillator-generation replacement remains isolated. Technical tests and desktop timing do not constitute blanket musical approval. Neutral Init/reset/Output/Delay work is retained.

## Target and code audit

Lush, thick, raw and gently unstable, with a convincing fundamental. More treble or loudness alone is not the target. Unison adds closely spaced partials and beating; nonlinear colour can add further overtones.

The current generator is already hybrid: PolyBLEP saw/pulse/square, a 2048-point sine table and bandlimited mipmapped triangle tables. The initially audited Unison restarted every lane at zero, used symmetric linear cents offsets, shared note-level drift across copies, mapped low/high pitch monotonically left/right and weighted copies by 1/N. At C4, four copies with 25-cent maximum offsets have adjacent spacings about 2.50/2.52/2.54 Hz. Coherent, recurring interference was therefore a strong hypothesis to audition, not a diagnosis of the exact user patch. The gain rule also loses power as copies decorrelate; changing gain changes downstream saturation and must be tested independently.

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

## Isolated refactor and measured source result

The reviewable [oscillator-source package](../../packages/synth-core/experimental/oscillator-quality/README.md) now contains an opt-in source interface, original table/FIR generation, renderer, analyzer, tests, summaries and source hashes. It is not imported into the live engine. Generated raw data is excluded from Git.

The completed comparison covers 1,578 coherent static renders and four moving pitch/PWM scenarios. Saw median non-harmonic energy is approximately -41.4 dBc for the current PolyBLEP, -58.7 for 2x/FIR and -129.7 for the table candidate in these fixtures. Wanted high-band retention improves too; the result is not simply a darker low-pass. These numerical floors are not human audibility thresholds.

Metric choice matters. Full-Nyquist total waveform error favors 2x/FIR, while a common 0-20 kHz comparison favors the table candidate across all four dynamic cases. Total dynamic error includes phase/timbre/PWM differences and reference uncertainty, not only aliasing. One measured margin is below reference convergence and must not be treated as precise. See the package for both rankings and all caveats.

Isolated 32-oscillator desktop WASM cost is roughly 2.2x saw/2.7x pulse for the table candidate and 5.7x/4.8x for the straightforward 2x/FIR candidate. The latter also needs seven output samples of latency aligned across every waveform/oscillator/dry path before integration. Source peaks and nonlinear-stage headroom require separate checks. The table is therefore the leading source candidate, not an accepted musical replacement. Cleaner source generation does not establish the requested lushness.

## Phase audition decision and guarded implementation

The offline A/B/C study held Count3, +/-10 cents, Spread0.6, C3, patch/events, source, pan and gain rules fixed. A restarted all phases; B independently seeded all phases; C fixed the center phase and seeded the outer lanes. The user first judged B/C similar, then repeatedly preferred C: B had a subtle pluck bounce while C was smooth. These seeded starts are not continuous free-running oscillators. The study and exact hashes are in workspace `work/unison-phase-study`.

Unchanged C cannot safely cover every setting: actual zero-detune sine cases nearly cancelled (Count2/3/4 approximately -58/-30/-40 dB versus Count1). Fixed center phase is not fixed center amplitude. The prototype therefore blends in a dominant center below2 cents using the existing smoothed detune: guard=1-smoothstep(detune/2), anchor weight1/N toward0.75, other weights1/N toward0.25/(N-1), and anchor pan toward center. Scalar weights sum1; per-channel pre-protection gain is not guaranteed unity (one coherent case can rise about0.86dB). No phase convergence, pitch bend, hidden gain normalization or added latency is used.

At >=2 cents the listened C arithmetic is unchanged. Four independent PCM comparisons show Count1 and the exact C10 pluck/sustain examples remain byte-identical. Eight focused Unison groups include120 zero-detune cases, live detune transitions, boundary continuity, ownership/release and no render allocations. Tested minimum settled RMS was0.5015 of Count1; live10-to-zero minimum0.5057, rather than near-silence. These fixtures establish the safeguard, not universal loudness or complete analog-character approval. Workspace evidence: `work/unison-C-guard`.

## Remaining implementation sequence

1. Preserve the current prototype and a controlled dry listening fixture. Isolate coherent restart, seeded independent phase starts and properly specified free-running phase; hold tuning, gain and pan constant. Randomizing at note-on is not literally continuous idle phase.
2. Compare balanced center/layer Blend and alternating stereo placement separately. Use fixed-gain and gain-matched clips. Changing 1/N to 1/sqrt(N) can raise coherent peaks, so normalization is not a drop-in cure.
3. Compare linear versus gently shaped/irregular but centered detune. Add small independent lane motion only after the phase/mix result is preferred. Preserve deliberate note-level Pitch/Hit controls separately from micro-variation.
4. Refactor source generation behind an isolated interface and publish measured candidate comparisons. Preserve the live legacy path while evaluating. Add analog waveform/tolerance profiles only where evidence and listening support them.
5. Compare the preferred oscillator bank with a small two-voice stack if independent filter/envelope variation could supply the missing body. Neither architecture is predetermined by a mobile budget: decide from matched listening and measured cost. Existing two-channel processing is not itself evidence of a defect.
6. Replace the live Unison only after listening preference. Retain a repeatable-attack option for bass/plucks and independent control over amount/speed. Keep the UI compact until the sound design settles.

Acceptance includes C1/C3/C5, repeated plucks, eight-second sustains and chords, counts 2/3/4, stereo and mono, fundamental retention, attack variability, envelope troughs, DC/peaks/aliasing, ownership, allocation-free rendering and measured CPU. Zero-detune cancellation needs an explicit check: phase randomization can make that case worse. Count 1 stays exact. Initial listening uses a small matched set rather than hundreds of clips. Existing maximum-rack and physical-phone limits remain open.
