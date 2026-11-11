# Warm filter: topology and performance correction

The previous distributed-nonlinearity Ladder was expensive and could lose level and upper-note brightness as Drive increased. The replacement retains eightfold oversampling but uses one nonlinear feedback element followed by four linear trapezoidal poles. This intentionally changes the experimental Ladder's sound. Soft/LP12, oscillator generation, Unison phases, and patch defaults are unchanged. Engineering selection is supported by these measurements; musical approval still requires listening.

## Research and equations

The primary reference is Vadim Zavalishin, [The Art of VA Filter Design, v1.1.1, section 4.6](https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_1.1.1.pdf). This original implementation uses the simplified nonlinear-feedback topology, not the distributed nonlinear stages described in section 4.7. It does not claim to reproduce a particular Moog circuit.

At eight times the native sample rate:

```
g = tan(pi*cutoff/(8*Fs)); G = g/(1+g); k = 3.8*Resonance
S = (1-G) * (s3 + G*(s2 + G*(s1 + G*s0)))
K = k*G^4
rhs = Drive*(1+k)*input - k*S
u + K*tanh(u) = rhs
```

The scalar equation has a unique solution: its derivative is at least 1. With the supported cutoff clamp, K is below .0021. Starting at rhs is within K of the root. Newton uses the existing smooth Pade/exact-tail approximation and analytical derivative, at most four iterations, stopping below a 1e-13 update. Each pole computes `y=G*input+(1-G)*state`, then `state=2*y-state`. G, G^4 and K are cached on coefficient changes. Unlike the prior model, each pole's cutoff is not separately compressed by its own nonlinearity.

Residual measurement is an explicit template diagnostic. Production omits five extra shape evaluations used only to measure convergence. Two contiguous decimator spans retain multiply/add order while removing per-tap wrap branches. Neither optimization changes the numerical solver's result.

## Reconstruction and gain

The 8x, 127-tap Kaiser8.6 FIR pair and matched filtered dry reference remain. Linear FIR delay is 15.75 native samples, plus the poles' frequency-dependent response. Mix0 is filtered dry, not undelayed bypass. No lower oversampling, voice cap, or render allocation was introduced.

Production consistently calls `processRaw`; this separate path omits inverse-Drive attenuation and final makeup, keeping FIR history in raw units. Dry is unaffected. At constant Drive this matches normalized output times Drive within rounding. During live Drive changes, raw history intentionally avoids the old mismatch between past inverse gains and current makeup. Each instance must retain its normalization policy. This exposes bounded raw wet, not automatic loudness matching. Product's 324-case study found full-level Drive12 versus1 RMS changes of +.94 to +5.40dB, compared with -9.84 to -5.27dB under square-root compensation. At .1-level input, raw wet grew by +11.75 to +20.28dB. These are fixture measurements, not universal gain guarantees. Downstream output protection still matters.

## Numerical and spectral evidence

- Initial exact optimizations matched the immutable predecessor's audio and recursive state in local WASM across six rates, 8–384kHz, with fast parameter edits.
- Scalar polyphase versus naive zero-stuffed FIR is exact in local WASM at all six rates. Native testing retains the separately documented scaled 1e-12 floating-point bound with printed diagnostics.
- Diagnostic-on/off output and states are exact. The 144-case rate/cutoff/resonance/Drive matrix measured peak .80632 and scalar-equation residual 1.78e-15. Adversarial unsmoothed edits measured peak 2.37303 with the same residual bound. These peaks use the comparison normalization before production makeup.
- 81 complex small-signal transfer checks, including all eight FIR images, measured maximum relative error 2.56e-8.
- Nine coherent 1/5/10kHz, Drive1/4/12 comparisons retained extreme 8x quality. At 10kHz/Drive12 unwanted/fundamental was about -34.75dBc versus -34.66 previously; at 5kHz/Drive12, -66.21 versus -64.62. This is not alias-free. Scalar fundamental was +.59 to +1.69dB at 5–10kHz, so improved ratios are not just darkening. At 1kHz/Drive12 it was -1.62dB versus the prior model.

The alias metric sums 0–20kHz unwanted bins, excluding DC and expected in-band odd harmonics. Aliases landing on wanted bins are not independently identified. The isolated topology comparison used equal inverse-Drive normalization on both models; the persistent alias probe uses final raw-wet normalization. The diagnostic `process` API retains the earlier normalized behavior for controlled comparisons.

## Performance scope

Windows Node22, Emscripten7 WASM-O2, 128-frame blocks at 48kHz. Precomputed seven-copy inputs isolate filter cost: oscillator/Harmonics/browser work is excluded. Four notes means eight stereo filter paths; eight notes means sixteen. Runs were balanced before/candidate/candidate/before.

| Isolated workload | Initial model ms/audio-second | Exact optimization | Scalar prototype |
| --- | ---: | ---: | ---: |
|4 notes, saw,20kHz,Drive12|852|761|294–415|
|4 notes, triangle,20kHz,Drive12|791|685|266–269|
|4 notes, saw,2kHz,Drive4|811|722|225–227|
|8 notes, saw,20kHz,Drive12|1759|1571|593–595|

The eight-note scalar comparison reduced filter cost about62%; p99 blocks were 1.82–1.86ms versus4.45–4.72ms for the optimized distributed model. The first four-note saw trial was cold/noisy, hence the range. These measurements preceded coefficient caching and do not establish full-instrument deadlines, mobile performance, or VST-host safety. Final integrated timing is reported separately.

## Evidence and reproduction

Local `work/ladder-performance-evidence/` contains the immutable predecessor/header hash, exact comparison source/log, isolated scalar source, timing/alias/numerical probes and summary. The implementation is `packages/synth-core/src/ladder_filter.h`; persistent fixtures are `ladder_polyphase_tests.cpp`, `sound_quality_tests.cpp`, and `ladder_alias_probe.cpp`.

The normal fail-fast core runner executes the first two. Compile the alias probe with C++17 and the target optimization/backend; WASM uses `-O2 -sENVIRONMENT=node -sEXIT_RUNTIME=1`. Invoke the generated Node module factory and check `process.exitCode`: successful factory resolution alone is not a successful test exit.

Final helper checks also measured constant-Drive raw versus normalized-times-Drive difference at most1.78e-15, and a live raw Drive sweep peak1.02635 with residual4.44e-16. Six helper groups passed locally. `packages/synth-core/tests/fixtures/warm_filter_summary.json` records the final raw-wet alias measurements, source hashes and historical controlled comparisons; `ladder_quality_summary.json` is explicitly historical. Final scalar8x versus1x reduces meaningful unwanted power by42.18–101.69dB in these cases; the1kHz/Drive1 result is at the numerical floor and does not support a meaningful reduction claim.


## Integrated correction and UI acceptance

The host now always uses the raw path for both stereo filter lanes. Existing normalized-path helpers remain comparison utilities. Dormant Ladder state clears once when leaving the model; zero-level Studio oscillators skip waveform reads while their phases continue; the shared oscillator2 detune ratio is calculated once per sample. Legacy defaults/Soft/LP12 and tone ABI7/44 stay unchanged.

The same24-run full-instrument fixture now measures four held notes/7copies/Studio+Ladder+one Harmonics at approximately 496.1ms per audio second versus1053.7 previously. Full numbers/hashes are in`warm_signal_path_timing.json`. This clears the measured4-note case while retaining8x processing;16-note full chains remain expensive. The old timing fixture is historical.

Twelve actual-core Triangle/Saw cases at MIDI36/60/84 and cutoff6/20kHz measured Drive12/1 RMS growth+4.42 to+5.43dB, replacing the earlier level sink. This is intentional level-changing drive, not AGC. A live raw-Drive seven-copy chord test retains ownership and exact sample-block invariance with no render allocation.

The Tone layout now gives Osc1/Osc2 their own waveform/Mix/shape cards and a shared filter card; Quality is global outside Unison. Desktop columns become a full-width filter row at intermediate widths and stack on phones. UI acceptance checks actual container/control bounds, popup reachability, source messages and touch/Undo across nine widths. Independent visual review found no P1/P2 overlap or clipping; physical-device/listening approval remains open.

The standalone source-switch audit reads actual native settings and renders both modes across20 cases. Sine is exact; Triangle/Saw/Pulse/Square differ at every tested pitch. Relative output-difference RMS grows with pitch (Triangle about-74dB at MIDI36 to-31dB at96; Saw about-36 to-20dB). Similar basic timbre is expected: Studio is fidelity/antialiasing, not an alternative analog character waveform. The browser proof also confirms the actual worklet receives oscillator0/1 on selection.
