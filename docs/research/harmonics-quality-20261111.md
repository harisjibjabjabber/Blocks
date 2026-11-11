# Harmonics: colour, attack response and headroom

## Reference and scope

The [official Softube Harmonics manual](https://www.softube.com/user-manuals/harmonics-analog-saturation-processor) describes different saturation characters and a dynamics control that changes the relationship between the incoming envelope and distorted material. That is a useful product reference: the controls should affect texture and playing expression, not merely increase level. It does not specify a reproducible DSP algorithm, and this implementation does not reproduce its circuitry or claim its sound.

The [official Soundtoys Decapitator manual](https://www.soundtoys.com/wp-content/uploads/Decapitator-Manual.pdf), pages7–10, distinguishes Drive, a dark/bright tone control, parallel Mix and output compensation. Its pre-distortion tilt changes which frequencies saturate. Blocks instead uses a post-distortion tilt in its new profiles so that strong Drive cannot erase the audible tone change. No commercial style names, hardware models or interface artwork are copied.

## Diagnosis and current design

The original Tone control boosts one band before clipping. Heavy Drive reduces its effect. Original Dynamics only reduces Drive during attacks; it does not restore attack contrast. The old test deliberately checked that attacks became quieter. The synth also processes Sauce before the final voice amplitude envelope, so a detector reading only the Sauce input misses actual ADSR and velocity.

The user explicitly removed older-patch compatibility from the product scope. The old Soft/Asymmetric algorithms, UI choices, migration constraints and compatibility tests are removed. The current392-byte configuration has24-byte entries and exactly three models. Fresh nodes and native defaults select Round, model0. Earlier model IDs must not be interpreted as the current format.

| Model | Character | Implementation |
| --- | --- | --- |
|0 Round | Soft, odd-harmonic shoulder | Original quintic curve with continuous first and second derivatives at the clipping boundary |
|1 Tube | Asymmetric, even and odd harmonics | Biased Round curve, normalized to unit small-signal slope; an original mathematical curve, not a tube-circuit emulation |
|2 Fold | More pronounced, non-monotonic colour | Original bounded periodic quadratic fold, continuous first derivative, exact periodic primitive |

All profiles use exact analytical primitives with first-order antiderivative antialiasing and2× FIR oversampling. Model changes crossfade; inactive new profiles do not run continuously. Newly activated states initialize from the preceding driven sample rather than an unrelated old history.

New Tone is a wet-path700Hz tilt. Each endpoint gives reciprocal±12dB low/high asymptotes;0 is neutral. This deliberately provides audible colour under heavy distortion. Mix0 remains aligned, filtered dry and does not include new Tone/Dynamics. It is not exact bypass: use node power for that. The established nominal filter/ADAA latency remains15.25 native samples plus DC-filter phase.

Dynamics compares a peak envelope with a smoothed copy of that same envelope. A12% deadband rejects steady carrier ripple. It combines reduced attack saturation with bounded attack-envelope recovery, leaving sustained gain unchanged in the test fixture. Actual voice amplitude/velocity is supplied separately to the detector; it never divides the signal by its envelope. Output trim remains explicit, since Tone and attack recovery can increase peaks.

## Reproducible verification

The optimization was first verified against a frozen original processor:786,432 samples across four sample rates, both original models, three Drive values, automated controls and resets matched exactly. That historical reference and report now live outside the checkout in`work/harmonics-phase11`; preserving older sounds is no longer a runtime or test requirement. The FIR optimization removes zero-stuffed interpolation multiplications and discarded downsample outputs while preserving coefficient and accumulation order.

The current`harmonics_quality_tests.cpp` checks transfer primitives/boundaries, schema bounds, Tone contrast, Dynamics midpoint, normalized profile differences, alias spectra, aligned dry, DC, reset, amplitude-context handling, quiet-signal invariance and allocation-free transitions. `harmonics_tests.cpp` covers the three current profiles and the current rack/API state. CAPI expression tests in`bass_expansion_tests.cpp` demonstrate actual post-envelope attack/body improvements of7.41dB at velocity.2 and7.33dB at velocity.8, using Round/Drive8 with a30ms attack and150ms decay.

At48kHz/Drive8, the new profiles change the4000Hz/110Hz component ratio by29.3dB between Tone endpoints. Dynamics0/.5/1 gives progressively stronger attack/body contrast; maximum changes are8.57dB Round,8.11dB Tube and9.87dB Fold in the isolated pluck fixture. Sustained level change is0.000dB on the tested steady signal. This does not assert identical behavior for every envelope or input spectrum.

## Alias limits

Absolute unwanted inharmonic energy relative to the fundamental,48kHz, neutral Tone/Dynamics, Drive8:

| Input | Round | Tube | Fold |
| --- | ---: | ---: | ---: |
| Coherent sine32.96Hz |−174.65dBc |−174.61dBc |−131.93dBc |
| Coherent sine131.10Hz |−133.77dBc |−133.67dBc |−104.17dBc |
| Coherent sine2093.26Hz |−52.74dBc |−43.45dBc |−47.71dBc |
| Bandlimited saw130.37Hz |−47.94dBc |−47.70dBc |−37.95dBc |

The saw includes harmonics to Nyquist. Its inharmonic alias energy falls17.39/17.31/15.90dB respectively versus the corresponding raw non-antialiased curve. Fold remains the roughest profile on this broadband fixture. These are specific coherent tests, not an alias-free guarantee, perceptual masking measurement, or comparison against either commercial product. Strong high-note distortion remains a listening-review item.

## Performance and auditions

The initial optimization-only alternating WASM probe reduced240,000 samples of original Harmonics processing from58–61ms to32–34ms, with identical output. The three redesigned profiles subsequently measured32–35ms before the final removal of all old-profile branches. These are isolated processor timings, not a claim that the entire synth is twice as fast. Current-only timings are emitted by`harmonics_quality_probe.cpp`. Root-owned full-chain benchmarks cover the four/nine-note, seven-copy, Ladder cases separately.

`harmonics_quality_probe.cpp` writes18 four-second float WAV files for current Tone, Dynamics and all three styles. Twelve archived before-change clips are retained separately for comparison, giving30 files in the final audition pack. `fixed` files share one0.2 audition attenuation; `matched` files are independently normalized to−20dBFS RMS. No limiter or per-peak normalization is applied. All matched audition peaks remain below0dBFS. The local evidence directory is`work/harmonics-phase11/final-audio` outside the repository checkout. Compile the probe with the public include directory; run`probe capture <output-directory>`. With Emscripten use a`.cjs` output and`-sNODERAWFS=1` to write actual files.

Numerical tests and rendered files establish the implemented behavior. Human listening preference, comparison with commercial instruments and physical audio-device latency are not claimed as verified.

## Full-chain checkpoint

An alternating WASM benchmark used48kHz/128frames, Studio, Ladder Drive12/cutoff2kHz/resonance.6, four/nine notes, one/seven unison copies, three trials after64warm-up blocks. With Harmonics enabled the full chain decreased about1.8–5.8% versus the previous runtime, rather than the isolated45–49% processor reduction. Without Harmonics changes ranged−.05% to+6.5%. Nine notes/seven copies still exceeds the2.667ms deadline: current p99 median3.89ms with Harmonics and3.64ms without. These fixtures do not certify maximum-polyphony real-time performance. The reproducible fixture is`tests/phase11_chain_benchmark.cpp`; local trial reports are outside the checkout in`work/phase11-perf-baseline`.
