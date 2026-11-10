# Isolated oscillator source spike — 2026-11-10

No live Blocks engine, Unison, filter, Drive or Fullness code is changed. This is an original, opt-in source experiment, not an accepted replacement. Cleaner spectra do not establish a thicker/lusher sound, and the current Unison listening rejection remains open.

`oscillator_source.h` is the small reviewable source interface: `prepare(rate, mode)`, `reset(phase)`, `sample(wave, Hz, pulseWidth)`, `latency(wave)`. Mode 0 reproduces the current quadratic PolyBLEP saw/pulse; mode 1 evaluates it at 2× rate and applies a 31-tap Kaiser halfband decimator; mode 2 uses an original Fourier-sum saw mip bank and phase-differenced pulse, with cubic interpolation. Sine/triangle use the current repository source unchanged as controls. No allocation/locks/IO occur in sample(). This experimental API expects valid prepared input; it is not a hardened public host contract.

Mode 1 delays saw/pulse by **7 output samples (0.146 ms at 48 kHz)**. Sine/triangle controls currently remain zero-latency: integrating this candidate would require aligning all oscillator/waveform/dry paths before blending. Mode 2 is zero-latency and stores 26 × 4096 floats (416 KiB) plus small metadata; it fades added harmonic groups over a 2% frequency interval. This may introduce moving partial attenuation, and is not a continuously bandlimited PWM/FM guarantee. Both new candidates can overshoot ±1; none is artificially normalized or clipped here.

## Measured comparison

1,578 coherent static renders at 48 kHz cover every semitone MIDI 24–108 (C1–C8), saw and pulse widths .1/.3/.5/.7/.9, plus octave sine/triangle controls. Each render has 65,536 samples after 256 warmup samples. Frequency is the nearest odd FFT bin, with actual Hz in metadata. Static metrics are restricted to 0–20 kHz and exclude DC. Alias means energy outside expected harmonic bins; folding onto a wanted harmonic cannot be separated and instead appears in harmonic error. No level matching conceals losses.

| Source | Saw alias median / worst dBc | Pulse alias median / worst dBc | Worst wanted 8–20 kHz energy loss, saw / pulse |
|---|---:|---:|---:|
| Current PolyBLEP | −41.4 / −28.9 | −41.2 / −24.1 | −2.66 / −3.88 dB |
| 2× PolyBLEP + FIR | −58.7 / −43.6 | −58.9 / −41.6 | −0.78 / −1.31 dB |
| Fourier mip bank | −129.7 / −78.1 | −129.8 / −75.4 | −0.27 / −0.37 dB |

The table candidate wins these stationary spectral tests without winning by merely dulling wanted partials. These figures are numerical tests, not human audibility thresholds. Existing triangle controls are identical in all modes; their worst wanted high-band loss is −10.14 dB, so low alias alone is insufficient to judge their current mip design.

Dynamic tests compare against 16× and 32× naive analytic sources followed by a long Kaiser FIR, with matched sample-held controls. Reference convergence is −41 to −47 dB; it is not mathematical ground truth. Candidates are delay-aligned and endpoints discarded. The following **total waveform error** includes phase/timbre/PWM differences, not just aliasing (lower is better):

| Scenario | Baseline | 2× | Table | 16× vs 32× reference |
|---|---:|---:|---:|---:|
| Six-octave saw sweep | −23.60 | −29.91 | −25.88 | −42.15 dB |
| 440 Hz pulse, 7 Hz PWM .1–.9 | −28.80 | −35.03 | −29.17 | −47.09 dB |
| 440 Hz saw, ±50-cent 6 Hz pitch movement | −27.04 | −33.32 | −27.35 | −45.70 dB |
| Fast pitch/PWM stress | −22.59 | −28.84 | −24.54 | −41.11 dB |

The 2x candidate wins the full-Nyquist metric in all four cases. This metric is not directly comparable to the 0-20 kHz stationary alias figures. A common 0-20 kHz comparison keeps identical FFT bins from the aligned, endpoint-trimmed signals, including DC. It measures total error, not alias alone:

| Scenario | Baseline | 2x | Table | 16x/32x reference convergence |
|---|---:|---:|---:|---:|
| Saw sweep | -25.54 | -35.79 | -37.67 | -42.88 dB |
| Slow PWM | -30.75 | -40.84 | -45.20 | -47.84 dB |
| Pitch movement | -29.03 | -39.35 | -51.18 | -46.44 dB |
| Fast pitch/PWM | -24.45 | -34.21 | -34.52 | -41.84 dB |

The table candidate has lowest measured common-band error in all four cases. Its pitch-movement error is below reference convergence, so that precise margin is uncertain. Ranking reversal demonstrates why differing guard bands must not decide candidate choice. Finite-window FFT band selection adds a common boundary limitation. No claim is made that mip transitions are inaudible. Strongest dynamic peaks are 1.00 / 1.25 / 1.36 respectively. Fixed-gain .2, PCM24 audition files are source-only, without a downstream nonlinear stage; this is necessary to separate source quality from Drive/master saturation aliasing.

## Cost and recommendation

Windows desktop, Node 22 / Emscripten 7 WASM −O2; 32 independent oscillators, 128-frame blocks at 48 kHz, 100 warmup blocks and 750 measured blocks per case, three runs with alternating order. Median milliseconds per audio second:

| Mode | Saw | Pulse | Worst observed 128-frame block, saw / pulse |
|---|---:|---:|---:|
| Baseline | 24.95 | 31.49 | .279 / .512 ms |
| 2× FIR | 143.47 | 150.92 | .546 / .577 ms |
| Table | 55.33 | 84.29 | .590 / .550 ms |

This is isolated source cost, not whole synth or phone performance. Short-run worst blocks include OS/JIT noise. Raw per-run p99/max/peaks are in `benchmark.jsonl`. The straightforward FIR is approximately 5.7× / 4.8× baseline throughput cost; table approximately 2.2× / 2.7×. No optimized production halfband implementation was evaluated.

Recommendation: keep both as bounded candidates for level-controlled listening; table is the more economical candidate and best in the measured stationary/common-band dynamic tests. The 2x candidate better matches the full-Nyquist reference at appreciable cost and alignment complexity; that does not establish a superior audible-band result. Do not replace the live source or claim the user's lushness request solved. A later continuous mip-transition/triangle study and phase-policy Unison audition should remain separate, scoped decisions.

## Reproduce

Run from the repository root. Python requires numpy/scipy/soundfile. Generated outputs stay in ignored `out/`. Adapt toolchain paths if necessary.

```powershell
$spike = "packages/synth-core/experimental/oscillator-quality"
$compiler = "../toolchain/emsdk/upstream/emscripten/em++.py"
$node = "../toolchain/node-v22.23.4-win-x64/node.exe"
python "$spike/generate_tables.py" "$spike/out"
python $compiler "$spike/render.cpp" -Ipackages/synth-core/src "-I$spike/out" -std=c++17 -O2 -sINITIAL_MEMORY=67108864 -sENVIRONMENT=node -sEXIT_RUNTIME=1 -sNODERAWFS=1 -o "$spike/out/render.mjs"
& $node --input-type=module -e "import run from './packages/synth-core/experimental/oscillator-quality/out/render.mjs'; await run({arguments:['packages/synth-core/experimental/oscillator-quality/out']}); if(process.exitCode)throw Error('render failed');"
python "$spike/analyze.py" "$spike/out"
python $compiler "$spike/tests.cpp" -Ipackages/synth-core/src "-I$spike/out" -std=c++17 -O2 -sENVIRONMENT=node -sEXIT_RUNTIME=1 -o "$spike/out/tests.mjs"
& $node --input-type=module -e "import run from './packages/synth-core/experimental/oscillator-quality/out/tests.mjs'; await run(); if(process.exitCode)throw Error('tests failed');"
python $compiler "$spike/benchmark.cpp" -Ipackages/synth-core/src "-I$spike/out" -std=c++17 -O2 -sENVIRONMENT=node -sEXIT_RUNTIME=1 -o "$spike/out/benchmark.mjs"
& $node --input-type=module -e "import run from './packages/synth-core/experimental/oscillator-quality/out/benchmark.mjs'; await run(); if(process.exitCode)throw Error('benchmark failed');" | Set-Content "$spike/out/benchmark.jsonl"
```

Check every exit code before continuing. Tests passed: deterministic/reset sweeps, finite bounded output, zero sample allocations, unchanged sine/triangle controls. No block-processing API exists in this sample-at-a-time source. Production CMake/runtime do not import this experiment.

Raw static data is about414 MB and excluded. `summary.json` retains aggregate spectra, per-dynamic results and all raw timing rows. `source-manifest.json` hashes packaged source. Original measured artifacts and four `audition-*-ABC.wav` comparisons remain in `work/oscillator-quality-spike`. ABC order is baseline/2x/table, fixed gain .2 and no per-file normalization. The generated float32 bank samples/FIR coefficients were checked equal to measured source; source formatting differs. Packaging adds output-directory arguments only.

## Primary research and provenance

The code implements original formulas; no Vital/Surge/GPL source was copied. Candidate selection was informed by [Välimäki et al., differentiated polynomial waveforms (2010)](https://mac.kaist.ac.kr/pubs/ValimakiNamSmithAbel-taslp2010.pdf), [integrated polynomial interpolation / BLEP research (2012)](https://mac.kaist.ac.kr/pubs/ValimakiPeknenNam-jasa2012.pdf), and [Pekonen's filter-based oscillator thesis (2014)](https://research.aalto.fi/en/publications/filter-based-oscillator-algorithms-for-virtual-analog-synthesis/). DPW and higher-order BLEP/BLAMP were researched but not implemented in this bounded three-way experiment. BLAMP addresses slope discontinuities; minBLEP's event/state cost is more relevant when hard sync or arbitrary discontinuities become requirements. The included bank is generated from the ordinary truncated Fourier series, and its FIR from scipy's public filter-design API; neither is copied synth code.
