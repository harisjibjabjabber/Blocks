# Harmonic character study

10 November 2026. The bounded native helper and rack integration are implemented and have passed nine focused C++/WASM groups. Broader integrated/UI validation is separate, and the sound is not listening-approved. The user wants rich, raw, beautiful sound at the edge of breaking, with desktop/standalone/VST quality now taking priority over mobile optimization. No proprietary Softube circuit or dynamics algorithm is claimed. This document does not replace the living product roadmap.

## Current implementation and the useful gap

The current Drive is a memoryless `tanh(input * amount)` with amount 1–12. Fullness adds an antialiased polynomial residual plus a positive low-frequency body component; it is not a transformer or tube model. The output bus also applies `tanh`. Existing Tone modes are the legacy one-pole and a linear resonant TPT low-pass. Consequently, improving oscillator antialiasing alone cannot remove harmonics folded by the later nonlinear stages.

A new processor should earn its place through a distinct harmonic balance and useful response to attacks. Relabelling the existing Drive, adding a global dark filter, or increasing output level is insufficient. Preserve existing Drive/Fullness and old patch interpretation. Fullness already owns body enhancement: do not quietly duplicate its bass gain in this first Harmonics processor.

## Primary evidence and reuse boundaries

- [Softube Harmonics official manual](https://www.softube.com/user-manuals/harmonics-analog-saturation-processor): the product separates distortion type, Drive, frequency emphasis, parallel mix, dynamics and output level. Its Character control changes emphasis before distortion. Its documented dynamics feature analyzes incoming material and restores or thickens dynamics, but the manual does not disclose a reproducible implementation. These are useful product distinctions, not permission or evidence to copy its internal algorithm. Our two curves and bounded transient-preservation rule will be original and explicitly narrower.
- [Parker, Zavalishin and Le Bivic, DAFx 2016](https://www.dafx.de/paper-archive/2016/dafxpapers/20-DAFx-16_paper_41-PN.pdf): continuous-time convolution leads to antiderivative antialiasing (ADAA); combining it with oversampling can reduce nonlinear aliasing. The first-order linear case is `(x[n]+x[n-1])/2`, so the method also introduces half-sample group delay and high-frequency attenuation. An ADAA badge is not evidence of transparent dry/wet mixing or zero aliasing. Feedback-filter insertion requires a separate stability/topology analysis.
- [Bilbao, Esqueda, Parker and Valimaki, IEEE SPL 2017](https://www.research.ed.ac.uk/en/publications/antiderivative-antialiasing-for-memoryless-nonlinearities/): higher antiderivative orders extend the method, with numerical and spectral tradeoffs. Use an original implementation of the equations; a published manuscript is not a blanket software license.
- [Werner and Azelborn, DAFx 2023](https://www.dafx.de/paper-archive/details/cu51KU_JsiXj1cvMi-2DOw): piecewise polynomial waveshapers allow analytical antiderivatives; smoothing corners and modest oversampling are complementary options. This supports a small, inspectable polynomial candidate rather than an unverified collection of hardware-labelled flavours.
- [chowdsp_wdf license](https://github.com/Chowdhury-DSP/chowdsp_wdf/blob/main/LICENSE): the wave-digital-filter library is BSD-3-Clause and is a possible future circuit-model foundation with attribution obligations. No dependency is added by this study. In contrast, [chowdsp_utils](https://github.com/Chowdhury-DSP/chowdsp_utils/blob/master/LICENSE.md) has module-specific licenses and GPLv3 non-module code; do not treat the entire project as permissive. Any later adoption must pin and inspect the actual files and dependencies.

## Bounded implementation contract

Two original models: **Soft**, symmetric soft saturation; **Asymmetric**, biased soft saturation with the static zero-input offset removed and DC controlled. Neither is called Tube or Transformer. Soft is `f(x)=x-x^3/3` for `|x|<=1`, continuing at `+/-2/3` outside. Its primitive is `x^2/2-x^4/12` inside and `5/12+(|x|-1)*2/3` outside. Asymmetric is `(f(x+0.3)-f(0.3))/0.91`, which retains unit slope at zero and generates even harmonics. Its primitive follows by shifting and subtracting the constant term. These simple inspectable curves are original choices, not circuit models.

Additive per-instance settings keep the existing Sauce v1 328-byte layout. New Sauce type `BS_SAUCE_HARMONICS=2` uses amount as Drive 1–12 and disallows `primary`. Its additional `bs_harmonics_entry` contains `uint32 id, model; float tone, dynamics, mix, output_db` (24 bytes). `bs_harmonics_config` contains `uint32 version, count` followed by 16 entries (392 bytes), version 1. IDs are unique and nonzero. Proposed APIs: `bs_default_harmonics`, `bs_set_harmonics`, `bs_get_harmonics`. Unknown/stale IDs have no signal path until a matching Harmonics node exists.

| Setting | Range | New-instance default | Meaning |
|---|---|---|---|
| Drive | 1–12 | 1 | Increases input to the saturation curve; enabled Drive 1 is not exact bypass |
| Model | Soft / Asymmetric | Soft | Original transfer family |
| Tone | −1…1 | 0 | Bounded emphasis before the nonlinear residual; not a post-output loudness macro |
| Dynamics | 0…1 | 0 | Bounded reduction of distortion during detected attacks; not Softube's algorithm or an expander |
| Mix | 0…1 | 1 | Aligned dry/wet blend; dry includes Tone, antialias filtering and DC filter |
| Output | −12…12 dB | 0 dB | Explicit trim, not hidden automatic gain compensation |

New instances default powered **Off**, so adding one is exact bypass until enabled. Only the existing Sauce modulation destination 0 (Drive) is included initially. Model, Tone, Dynamics and Output must not appear as routable until their actual native route semantics exist. All additional settings are validated atomically, persisted by stable node ID, and independent across duplicate nodes. Existing primary Drive/Fullness scans must not mistake type 2 for Fullness.

## Antialiasing and alignment decision

Compare direct evaluation, first-order ADAA, and properly filtered 2x ADAA against a converged high-rate reference. Do not select a version merely because it is quieter or loses more wanted treble. Oversampling must include reconstruction and decimation filtering, not repeated samples followed by averaging.

The coordinator chose **full aligned saturation**, not additive residual colour. Both paths pass through the same 31-tap Blackman-windowed half-band reconstruction/decimation filters; the dry path also receives the first-order ADAA linear averaging kernel. The nominal linear filter group delay is 15.25 native samples per enabled node. A matched 5 Hz DC blocker on both paths adds frequency-dependent phase. Mix blends these aligned paths, never an immediate dry signal against delayed wet. Mix 0 and Drive 1 are not exact bypass. Power Off bypasses the node, with the existing graph's five-millisecond transition; serial enabled nodes accumulate latency. Old Drive/Fullness-only processing keeps its existing arithmetic.

The 31 coefficients are immutable constants generated from normalized Blackman-windowed half-band sinc; constructors do not calculate trigonometry or copy coefficient arrays. Rate-dependent coefficients are prepared only for actual Harmonics nodes. The first candidate uses straightforward fixed FIR state rather than a throughput optimization. WASM object sizes are 1,000 bytes per Harmonics state and 36,232 bytes per AudioRack. The host build reserves a larger stack for its fixed Voice/Graph copies. These memory costs are reported, not presented as a mobile certification.

Tone and dynamics belong before the residual shaper, with identical controls on its linear reference. Changing Drive should alter the shaper's input, not change the antiderivative between the two samples in a divided difference. For a curve/model change, retain separate antiderivative state and use a bounded transition. Avoid raw division by a nearly zero sample difference; use the continuous limit and test that branch explicitly.

Tone uses a 700 Hz one-pole split: positive values add up to one high-frequency residual, negative values add up to one low-frequency component. It precedes both the shaper and aligned dry reference, so Mix 0 includes this emphasis. Tone is not a neutral-volume shelf; fixed-gain comparisons and explicit output trim expose its level effects.

Dynamics uses fast (1 ms attack / 50 ms release) and slow (25 ms / 150 ms) level followers. The bounded positive relative difference reduces the excess drive above 1 by at most 75%, weighted by Dynamics. It never boosts quiet input or modifies the dry gain, but can respond to amplitude modulation as well as note attacks; it is not a perfect onset classifier or Softube's proprietary dynamics system. The core supplies the same pre-filter stereo magnitude to both channels so detector behavior is linked. All coefficients are sample-rate dependent.

## Initial measured evidence

Nine focused groups pass: schema/atomic bounds, analytical primitive and equal-input limit, low-level aligned dry/wet response at 8/44.1/48/96/384 kHz, six coherent spectral cases, asymmetric DC/silence/reset, duplicate/reordered rack state and invalid rejection, powered-off exact bypass, bounded dynamics, and actual additive C APIs/power transitions/panic. No allocations were observed in watched rendering. The remaining integration suite is owned separately; these nine groups are not a complete release sign-off.

At 48 kHz, input sine amplitude 0.4 and Drive 8, coherent tones near 1/5/10 kHz showed 11.1–32.7 dB less out-of-harmonic-bin energy than directly evaluated curves, and 5.3–23.5 dB less than first-order ADAA without oversampling. In these same cases the 2x path's fundamental amplitude was closer to the directly evaluated curve than the 1x ADAA path. For the roughly 10 kHz Soft case, amplitudes were 0.84045 direct, 0.77145 at 1x, and 0.82453 at 2x. This narrow measurement distinguishes alias reduction from simply deleting wanted harmonics; it is not a universal alias-free or perceptual ranking. The dynamics fixture's first-50-ms energy ratio was 0.344 versus Dynamics 0, demonstrating a substantial change, not proving musical preference.

Controlled real-core PCM24/48 kHz auditions and an immutable source snapshot are in `work/harmonics-evidence` outside the repository. `auditions.json` records all source/raw/WAV hashes, exact patch/events, matching gains and deterministic rerender. Two fixtures contain C2 repeated plucks and a C3 minor chord. Each plays A=bypass, B=Soft, C=Asymmetric at 0/5/10 seconds, with four seconds of audio and one second of silence per segment. B/C use Drive 4, Tone 0, Dynamics 0, Mix 1, Output 0 dB. Fixed-gain RMS relative to bypass was 1.093/1.205 for plucks and 1.078/1.176 for the chord. Separate matched files attenuate each whole fixture to the lowest RMS; there is no hidden peak normalization. Listening is still pending.

## Gates before calling this an improvement

1. Mathematical tests: transfer/primitive consistency, equal-input limit, zero input, symmetry versus even-order content, DC rejection, finite outputs for overload, control bounds and atomic invalid configuration rejection.
2. Signal tests: coherent sine and two-tone references from bass through high notes, saw/pulse chords, transients and quiet tails at 44.1/48/96 kHz. Record wanted harmonic error, alias energy, fundamental/low-band level, DC, crest factor and attack retention. Include high Drive and resonant-filter input. No blanket “alias-free” claim.
3. Integration tests: default/off/Drive-1/Mix-0 neutral rules; legacy exact comparisons; duplicate-node independence; order/reorder and queued transitions; modulation changing only effective Drive; release, panic, state restore and sample-block invariance. No render allocation or shared mutable channel state.
4. Audition: a small matched set of held bass, repeated plucks and chords, both fixed gain and separately documented gain-matched versions. Preserve gain metadata and latency. Richness and musical preference require listening; THD alone does not rank beauty.
5. Performance: measure the actual C++/WASM implementation with realistic polyphony, stereo Unison and rack counts. Desktop quality is the first selection gate in this phase; report CPU/memory honestly and optimize later. Do not infer physical-phone support from workstation timing or quote another paper's timings as ours.

Deferred: hysteresis/transformer memory, five hardware-labelled flavours, automatic loudness matching, multiband distortion, full compressor/expander, extra body shelves and a broad modulation matrix. A cleanly separated helper can later support an external audio host; this phase does not ship a VST package.
