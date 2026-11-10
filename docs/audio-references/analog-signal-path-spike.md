# Analog signal-path phase — oscillator, filter and harmonic colour

10 November 2026. Sound quality and desktop/VST portability now take priority over phone optimization. This phase integrates the previously isolated source research, an original nonlinear ladder and a separate Harmonics insert. No proprietary circuit/plugin reconstruction or subjective equivalence is claimed.

## Why these stages belong together

An oscillator's desired upper partials, digital aliases, nonlinear filter feedback and post-filter saturation are different phenomena. Adding arbitrary high-frequency distortion is not an analog model. Source generation should retain wanted harmonics without folding strong unwanted components into the audible band; nonlinear colour can then deliberately generate harmonics, with its own antialiasing. Stable fundamentals, moving voice relationships and controlled transients serve the user's north star: sounds at the edge of being broken while remaining musical.

The older PolyBLEP source remains the native default and the interpretation of saved files without new sound state. New browser Init selects Studio. Existing source/phase/Unison settings are independent: the user's preferred C phase initialization and maximum7 copies remain intact. Studio is generation quality, not an extra oscillator or a wavetable position control.

## Primary research and choices

- [Huovilainen, DAFx2004](https://www.dafx.de/paper-archive/2004/P_061.PDF), equations9–10: the buffered stages' currents depend on nonlinear input/output voltage differences. Nonlinearity belongs inside the filter, not just before a linear cascade. Its published implementation uses Euler integration and oversampling. Our original implementation uses a simultaneous trapezoidal solve instead; it is not a copy of that implementation.
- [D'Angelo/Valimaki PartI](https://dangelo.audio/taslp-ladder-part1): four stages and feedback determine poles, tuning and DC gain. [PartII](https://dangelo.audio/taslp-ladder-part2) addresses nonlinear delay-free loops and parameter changes. Its method is non-iterative; ours uses bounded Newton iterations, so its performance/stability guarantees must not be attributed to us. The author's errata concerns a figure caption. The linked full paper download was inaccessible in this session; the accessible abstract,2004 equations and our explicit derivation are the evidence used.
- [Cytomic linear trapezoidal SVF](https://www.cytomic.com/files/dsp/SvfLinearTrapOptimised.pdf) remains a good basis for the existing clean LP12. A linear SVF and nonlinear ladder are complementary models, not successive versions where the old one becomes invalid.
- [Pekonen's oscillator thesis](https://research.aalto.fi/en/publications/filter-based-oscillator-algorithms-for-virtual-analog-synthesis/) and the [prior measured source spike](unison-quality-spike.md) support comparison by aliasing, wanted-partial retention, modulation and cost. The production source agent records the new table bank's own measurements separately; prior numbers do not automatically apply to new tables.
- [Softube Harmonics manual](https://www.softube.com/user-manuals/harmonics-analog-saturation-processor): separate flavours, pre-emphasis, dynamics, parallel mix and output are useful product ideas. Its dynamics reconstruction is proprietary and is not reproduced here. See [our harmonic processor research](harmonic-character-spike.md) for the original transfer functions and AA/dry-path decision.

All production DSP is original mathematics/code with no new runtime library dependency. Reading open implementations is not permission to copy code without its licence. Generated tables/FIR coefficients are original numerical data, not downloaded instrument samples.

## Ladder derivation and contract

Four normalized stages obey dy/dt=wc*(shape(previous)-shape(y)); first input is driven input minus k*lastOutput. Trapezoidal integration gives y=s+g*(shape(previous)-shape(y)), stateNext=2*y-s. At each internal sample, the four unknown outputs are solved together. The Jacobian is bidiagonal plus the first-stage feedback corner; affine elimination solves each Newton update. There is no extra delayed feedback sample. A maximum8 iterations and bounded step limit work; convergence is measured rather than assumed.

The model uses tanh-like differential-pair curves. In[-4,4], a[7/6] Pade approximation and its analytical derivative have maximum error below1.50e-5 relative to tanh; a smooth3–4 transition to exact tanh tails avoids the rational function's far-field growth. The approximation is tested for monotonicity, and its measured solver residual is reported. It is a deliberate numerical model, not a measured transistor/temperature/tolerance simulation.

Cutoff uses prewarped g=tan(pi*cutoff/(8*sampleRate)) at8x processing. Feedback is k=3.8*Resonance, below the ideal small-signal oscillation threshold4. Input compensation1+k restores low-level DC gain; driven signals compress naturally and are not loudness-normalized. Drive1–12 is input gain with reciprocal output gain, so increasing Drive means increased nonlinear colour, not guaranteed increasing loudness. At zero resonance the cutoff denotes the individual stage corner, not the cascade's-3dB frequency; the asymptotic slope is24dB/oct.

Proper8x interpolation/decimation uses two127-tap Kaiser8.6 FIRs at normalized cutoff.125. Combined linear FIR group delay is15.75 native samples. Filter Mix uses the same reconstruction/decimation on its dry branch: no undelayed parallel dry is mixed with the delayed branch at steady state. Mix0 therefore includes filtering, rather than being exact bypass; choose an Existing filter model to leave the Ladder path. The nonlinear model transitions over10ms; transitioning to a different latency can temporarily change interference and does not constitute a plugin host latency-compensation implementation. No alias-free claim follows from8x oversampling. Arbitrary fast modulation and extreme drive must be measured separately from stationary small-signal response.

Existing Soft/Resonant paths, tone ABI7/44, saved presets and the legacy generator remain compatible. New additive sound state is16bytes/version1. Source changes share oscillator phases and fade5ms; Ladder model changes fade10ms; no note or sequencer restart. Cutoff, resonance, filter ADSR and Mix retain their existing routes. Ladder Drive is a new independent control. The response display must identify nonlinear Ladder truthfully rather than drawing the existing LP12 transfer as its response.

## Acceptance evidence

Tests and the final phase report record actual results: native/WASM legacy parity, source spectra and wanted harmonics, filter impulse/response and nonlinear spectra, rates8–384kHz, solver convergence, rapid parameter changes, dry alignment, ownership/panic, allocation-free rendering,7-copy/chord behavior, serialization/reset/Undo, browser interaction and desktop CPU. CPU is measured to identify overload rather than to force a mobile-quality compromise. Desktop measurements are not a guarantee for every computer or an external VST release.

Listening clips must retain fixed gain and optionally separately labelled RMS matching. Measurements cannot certify that the user prefers the new sound. Old imports are left reproducible; new sound tools are available for the next listening session.

## Phase7 measured result

The production Studio source was measured independently in1,578 stationary fixtures and four moving pitch/PWM cases. Median unwanted-bin energy for Saw/Pulse improved from about-41dBc to-111/-112dBc in the stated source-only matrix; wanted high-band triangle loss improved from-10.14 to-.068dB. These are fixture metrics, not hearing thresholds or an analog-character rating. See the source report for reference convergence and the differing full-Nyquist ranking.

Ladder validation covers144 rate/cutoff/resonance/drive cases,81 complex small-signal transfer measurements including all eight resampling images (maximum relative error2.56e-8), fast un-smoothed adversarial parameter changes and a maximum implicit-solve residual below1e-15 in the matrix. Two additional groups compare the optimized polyphase implementation sample-for-sample with the full zero-stuffed reference and verify history reset/warm dry. The8x source-independent filter still generates harmonics deliberately.

Oversampling was selected from actual nonlinear measurements. At roughly10kHz, input peak.4, cutoff6kHz, resonance.65 and Drive12, unwanted energy relative to the wanted fundamental was-4.34dBc at2x,-7.79 at4x and-34.66 at8x. Dominant unwanted bins tracked folded high odd harmonics. At roughly5kHz/Drive12 the same comparison was-19.12/-38.39/-64.62dBc.8x materially improves the extremes but does not make them alias-free. Wanted fundamental changes are recorded separately; lowering all output gain was not counted as alias suppression. Raw numerical evidence and hashes are in[ladder_quality_summary.json](../../packages/synth-core/tests/fixtures/ladder_quality_summary.json).

Harmonics has nine focused groups including actual public APIs. In six coherent Soft/Asymmetric tones,2x+ADAA reduced alias energy5.3–23.5dB versus1x ADAA, with better wanted-fundamental retention in the tested high tone. Five independent integration groups also pass against the final8x Ladder build: live/new-note settings, rate preparation, panic, type2 routing, queued reorder, seven-copy ownership, sample-block invariance and allocation-free processing. Full legacy differential output remains byte-identical in24cases/9,728,000 bytes (SHA2561a66985d6df13fc88b67ac5b26a75a4f12193b7f2a0bda782bd24184befb6d53).

UI validation passes75 actual-browser checks at320/390/1440 pixels and66 Node tests. Ten additional checks import both audition patches into the real browser host, verify state and play a note. Fixed-gain and separately RMS-matched Harmonics pluck/chord clips, settings and source hashes are retained in workspace`work/harmonics-evidence`. They isolate Harmonics; they are not a listening judgment or an A/B of the entire new signal path.

Desktop processing is intentionally more expensive. The[24-run Windows Node22/WASM-O2 benchmark](../../packages/synth-core/tests/fixtures/signal_path_desktop_timing.json) uses48kHz/128frames and3 trials per configuration. Median ms per audio second:

| Held notes / Unison | Studio + existing filter | Studio +8x Ladder +one Harmonics |
|---|---:|---:|
|4 /1|56.2|538.4|
|4 /7|173.1|1053.7|
|16 /1|194.2|2207.7|
|16 /7|646.6|4193.6|

The4-note/single-copy full chain had p99median1.65ms/worst1.89ms against a2.67ms block;4-note/seven-copy full chain exceeded that budget (p99median3.02ms/worst3.55ms). Heavier held-note cases cannot run in real time in this measured WASM configuration. These are actual limitations, not grounds to claim that every desktop handles the advertised maximum. No automatic voice reduction or silent quality downgrade is applied. The native CI benchmark is recorded separately; a future VST can optimize the same independent core. The larger fixed graphs require a1MiB WASM stack; the standalone still reserves32MiB with no render-time growth.

Source/filter/insert settings are explicit and saved. New Init stays neutral apart from source fidelity; the two example patches demonstrate the combined path. Musical approval, native-host listening, external audio input, host automation/PDC and release packaging remain separate work.
