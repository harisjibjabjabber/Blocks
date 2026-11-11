# Harmonics Suite v2: implementation and evidence

This records the audio-only v2 design. Dynamics never changes note ADSR, voice lifetime or MIDI events. The public configuration is204bytes; meter data is44bytes. The global stereo bus follows voice amplitude and FX-routed Sub, then feeds Width/Delay. Clean Sub bypasses the Suite with matching latency.

OTT stores Depth50% while its power defaultsOff, so enabling it is meaningful without changing neutral startup. Compressor manual Trim spans−24..+24dB independently of Auto Makeup.

## Feature, inspiration, purpose and actual implementation

| Feature | Reference and purpose | Actual Blocks DSP |
| --- | --- | --- |
| Amp | [Radiator manual](https://www.soundtoys.com/wp-content/uploads/Radiator-Manual.pdf): staged amplification with tone between nonlinear stages. Warm body at moderate gain, overloaded amplification at the extreme. | Two differently biased rational saturators,700Hz interstage low/high tilt, level-history supply sag with20ms attack/180ms recovery, and voiced high-frequency damping. Original heuristic amplifier; no Altec/Softube circuit claim. |
| Clip | [Drum Buss Hard distortion](https://www.ableton.com/en/manual/live-audio-effect-reference/#drum-buss): hard-edged density; our style omits its separate bass enhancement. | Symmetric hard clipping at±0.5 after drive/pre-tone weighting, inside the4× oversampled path. It is not a particular Decapitator style. |
| Sine Crush | Your sine-fold/crush request and the creative foldback category in [Saturn](https://www.fabfilter.com/downloads/pdf/help/ffsaturn2-manual.pdf); original periodic folding, intentionally more disruptive than warm saturation. | Sine folding, with drive-dependent ultrasonic damping above18dB. Adds changing harmonic clusters rather than another saturator label. |
| Tape | [Saturn's tape-colour category](https://www.fabfilter.com/downloads/pdf/help/ffsaturn2-manual.pdf), interpreted through spectral/memory behaviour; not Decapitator's Ampex-preamp style or a magnetic-circuit model. | Symmetric arctangent compression,25Hz retained-state feedback and drive-dependent high-frequency loss. Rate-aware memory. |
| Rectify | [Saturn's rectification/DC-removal category](https://www.fabfilter.com/downloads/pdf/help/ffsaturn2-manual.pdf), implemented as our own octave-rich colour. | Rounded full-wave rectification of a bounded input, DC blocking and high-drive ultrasonic damping. Fundamental-to-octave redistribution is intentional. |
| Two Colour slots | Staged colour/parallel experimentation, with independent level matching. | Two serial, independently bypassable style/Drive/Tone/Mix/Out processors share one4× oversampling chain. No second hidden per-voice effect. |
| Punch compressor | [Giannoulis/Massberg/Reiss](https://aes.org/publications/elibrary/elibrary-page/?id=16354), and [Drum Buss behaviour](https://www.ableton.com/en/manual/live-audio-effect-reference/): control peaks while retaining useful onset. | Feed-forward stereo-linked peak detector, soft-knee dB gain computer, default−30dB threshold/4:1/3ms attack/150ms release. Smoothed analytic Auto Makeup, capped18dB, plus signed−24..+24dB manual Trim (neutral0). |
| Crush | [Devil-Loc manual](https://www.soundtoys.com/wp-content/uploads/Devil-Loc-Deluxe-Manual.pdf): pressure, recovery memory and saturation after limiting. | Up to30dB detector pressure,1.3ms gain-reduction attack, load-dependent recovery up to6× the selected base time, then independently driven hard crunch. Separate output trim. |
| Signed Dynamics | [SPL's differential-envelope explanation](https://spl.audio/wp-content/uploads/TransientDesigner4_9842_OM_E.pdf), [Gin/MGA follower ratios](https://github.com/FigBug/Gin/blob/master/modules/gin_dsp/dsp/gin_transientshaper.h), [Airwindows Point](https://github.com/airwindows/airwindows/blob/master/plugins/WinVST/Point/PointProc.cpp), with [Drum Buss](https://www.ableton.com/en/manual/live-audio-effect-reference/#drum-buss) and [Softube Harmonics](https://www.softube.com/user-manuals/harmonics-analog-saturation-processor) as the musical behaviour targets. | Original level-independent audio detector with fast/base followers, peak memory and onset hold. Tight boosts onset and expands down falling body; Bloom lifts existing body/tails. Gain follows a24sample-aligned pre-colour sidechain and is applied after distortion. The complementary100Hz foundation receives one quarter of the high-band gain in dB. Silence is never turned into additional notes or synthesized sustain. |
| OTT-style multiband | [David Braun's explicitly MIT-licensed measured xfer_ott function](https://github.com/grame-cncm/faustlibraries/blob/b8f0e061808aa320b899e82f81043164ace1d00f/compressors.lib): genuine two-knee up/down density and per-band makeup. | Adapted fitted knees, makeup/depth and timing laws. Original complementary subtractive crossover, adjustable bands, exact neutral reconstruction, stereo mean-square detection, bounded upward lift and a low-level guard. It does not inherit the source's commercial-plugin match measurements. |
| Band controls | Make compression and tone changes explicit. | Each band has upper threshold, output gain and independent upward/downward strength; global depth/time and crossover controls remain. Meter values are actual applied band gain. |
| Mix, output and feedback | Level comparisons and truthful editing. | Fixed24native-sample dry alignment; overall and per-stage trims; actual peak/reduction meters. Colour and audio-burst graphs are clearly labelled deterministic settings references, not live waveform capture. |

## Targeted evidence

-14 isolated helper groups pass, covering atomic204/44-byte validation, exact neutral/Mix0/disabled paths, five styles, Tone, compressor calibration/stereo link, Crush memory, OTT up/down, smoothing, previews, serial layering, Dynamics level independence, output trims, silence and sample rates8k–192k.
- Native integration is independently tested by Engineering: original note lifecycle, Clean Sub bypass, block-size determinism and allocation-free processing remain separate gates.
- On a0.12-amplitude C3 sine at18dB drive, every style pair differs by at least0.146 normalized RMS after level matching. This establishes distinct waveforms, not subjective superiority.
- Compressor test:15.732dB measured reduction against15.732dB static prediction. Crush retains25.36dB of its30dB reduction after one selected base-recovery interval under heavy load, demonstrating recovery memory.
- The sourced OTT law produces+23.13dB on a quiet steady440Hz fixture and−11.01dB on a loud one. A saw-pluck body gains9× energy. Its onset can overshoot: the same fixture's crest increases8.21→10.59. OTT is a density effect, not a brickwall safety limiter; output trim and the host's protection remain relevant.
- The full synth's C2/G2/C3/G3 saw motif, Attack2ms/Decay240ms/Sustain0, measures attack2–25ms versus body60–200ms. Dry ratio1.815; Tight3.366 (+5.36dB contrast), Bloom1.106 (−4.30dB). The ratio is invariant under matched-RMS listening gain. Earlier weak/opposite behaviour was rejected and corrected.
- A harder440Hz Clip fixture measures Tight+22.87dB and Bloom−19dB relative attack/body contrast, showing that the post-colour audio gain still works after heavy saturation. This stronger synthetic result is not substituted for the real instrument fixture.

## Aliasing and limitations

The reproducible probe is `tests/harmonics_suite_quality_probe.cpp`; `scripts/analyze-suite-alias.py` analyzes30 coherent-sine cases at48kHz,18/36dB drive, approximately29.3/134.8/2103.5Hz. Input amplitude is0.12. Non-harmonic FFT energy is referenced to the fundamental, or the intended octave for Rectify. It is not a broadband or universal alias-free certificate.

At2103.5Hz/36dB, final non-harmonic ratios are Amp−61.72dB, Clip−41.48dB, Sine Crush−46.36dB, Tape−58.05dB, Rectify−40.34dB. Sine Crush and Rectify initially failed this corner at−16.66/−14.04dB; smooth high-drive damping and rounded rectification fixed that defect. Moderate-drive brightness is retained. Stacking, hotter input, extreme Tone and arbitrary broadband sources can behave differently.

The linear-phase oversampling delay is24samples. Model-specific minimum-phase spectral shaping remains intentional. Depth0 with neutral band trims reconstructs exactly; this differs from a phase-rotating Linkwitz–Riley implementation. At unusually low sample rates, crossover coefficients cap at0.2Fs/0.45Fs, so requested frequencies above those limits are not physically achieved.

The Suite contains no random/noise generator. Extreme settings can be very loud before host protection; per-stage trims are explicit. Automated evidence does not establish a commercial-model match or replace the user's listening judgment. Root owns final complete-engine CPU benchmarking and the fixed/matched audition pack.

## Licensing and source boundary

`THIRD_PARTY_NOTICES.txt` carries the full MIT notice for David Braun's specifically licensed gain-law function. No other Faust helpers are imported. Gin/MGA, Airwindows, SPL, Softube and Soundtoys are research references; their code is not incorporated. No closed-source algorithm or hardware emulation is claimed.


## Complete-engine timing and listening files

Root measured the actual48kHz/128-frame engine with two Studio sources (levels1/.3), Ladder Drive12/cutoff2kHz/resonance.6, four/nine held notes and one/seven copies per oscillator. Each case has64warm-up blocks and three192-block trials. The table shows medians; all-stage settings are specified by `tests/phase11_chain_benchmark.cpp` (the historical filename is retained). Test browsers were closed. These Node/WASM wall-clock figures exclude browser host messaging, UI and device latency.

| Notes | Unison copies per source | Suite Off ms/audio second | All stages ms/audio second | All-stage p99 block ms | Worst all-stage block ms |
| --- | --- | --- | --- | --- | --- |
| 4 | 1 | 227.8 | 266.7 | 0.835 | 1.054 |
| 9 | 1 | 452.1 | 490.7 | 1.592 | 1.727 |
| 4 | 7 | 552.8 | 581.2 | 1.931 | 2.100 |
| 9 | 7 | 1230.7 | 1238.2 | 4.130 | 4.232 |

The128-frame deadline is2.667ms. Four-note/seven-copy and nine-note/single-copy fixtures fit; nine-note/seven-copy Ladder exceeds it even with Suite Off. A shared processor avoids multiplying Suite cost by note count, but does not solve maximum source/filter load. There is no automatic voice cap or quality downgrade. Small timing differences can be scheduling noise; these are workload-specific measurements, not a general computer CPU rating or proof of real-time safety for all patches.

`tests/phase12_suite_audition.cpp` renders14 actual-instrument cases: dry, warm/extreme Amp, Clip, Sine Crush, Punch compressor, Crush memory, OTT, full chain, Tight, Bloom, Tape, Rectify and layered colour. The28 four-second stereo float WAVs include fixed common gain and matched−30dBFS RMS versions. No limiter/peak normalization is applied to those files; all matched peaks remain below0dBFS (maximum about.912). The complete synth's normal final colour/protection remains in the tested path. Native motif regression independently tests the Tight/Bloom contrast. Local files, metrics and source manifests live outside the checkout in `work/phase12-auditions` and `work/phase12-perf`; CI uploads reproducible auditions/timing artifacts. Listening preference remains for user review.


## Final validation

Local checks: all25 functional WASM targets passed; final focused native helper14 and integration8 groups passed after the signed-Trim and motif regressions. The installed/public consumer passed. All80 frontend Node tests passed, including the worklet bridge. Focused Suite19 and expansion17 checks plus final6 native/UI spots passed. Independent live UX passed10 checks across320/390/1024/1440, including touch drag/Undo and full desktop Tone keyboard. Broader standalone, Tone layout, sound/rack interaction and seeded-cache recovery checks passed. Final preview revision is `b2b929bff86ad0a7575e`. GitHub CI results are tracked on the draft PR separately; no physical-device or human listening approval is inferred.
