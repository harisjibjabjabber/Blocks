# Studio oscillator source: research, implementation and evidence

Studio is an original Fourier-table source, selected after comparing the existing quadratic PolyBLEP implementation, a 2x PolyBLEP/FIR candidate, and a bandlimited table candidate. This improves source fidelity; it does not claim to reproduce a particular analog oscillator or establish subjective warmth. Analog waveform shaping and downstream nonlinear aliasing are separate problems.

## Research decision

[Dannenberg's primary study of waveform-table interpolation](https://www.cs.cmu.edu/~rbd/papers/tlu98/tlu.html) explains how upper harmonics have fewer effective samples per cycle, and why table size, interpolation order, spectral slope and cache behavior must be evaluated together. This supports measuring interpolation artifacts rather than assuming that a nominally bandlimited table is exact.

[Välimäki, Pekonen and Nam's integrated-polynomial research](https://research.aalto.fi/fi/publications/perceptually-informed-synthesis-of-bandlimited-classical-waveform/) studies polynomial bandlimited correction methods. The existing quadratic PolyBLEP remains a useful efficient baseline; the alternative measured here oversamples that baseline rather than silently substituting a different correction polynomial. [Franck and Välimäki's higher-order integrated-wavetable work](https://research.spa.aalto.fi/publications/papers/dafx12-hoiws/) reports reduced aliasing with integration/differentiation, but also discusses quantization effects. That is a distinct candidate, not the implementation delivered here.

[Pekonen's doctoral thesis](https://research.aalto.fi/en/publications/filter-based-oscillator-algorithms-for-virtual-analog-synthesis/) separately addresses antialiasing and analog waveform models, including phase distortion and frequency-dependent postfiltering. Our inference is to keep source fidelity and deliberate waveform coloration separate: neither stronger aliasing nor a cleaner mathematical saw alone proves a richer analog sound.

No proprietary synth code, sampled instruments, or externally licensed DSP implementation was copied. The generator uses original ordinary Fourier coefficients and numpy's numerical FFT API.

## Runtime contract

`src/wave_source.h` exposes stateless `blocks_detail::StudioOscillator::sample(wave, phase, step, width)` and `mix(weights, phase, step, width)`. It owns no phase clock, envelopes, voice lifecycle or RNG. Callers supply finite phase/width and positive step no greater than .45. The original Unison C phases, seven-copy capacity and low-detune body protection remain independent.

- Sine uses the existing source exactly.
- Saw uses Fourier coefficients `i/(pi*h)` for positive harmonics.
- Triangle uses real `4/(pi*pi*h*h)` coefficients at odd harmonics, preserving the original cosine-phase convention and fundamental amplitude.
- Pulse is the difference of two phase-shifted saws plus `2*width-1`. Its duty-dependent DC is deliberately preserved; Square always uses width .5.
- Thirty-one immutable tiers span 1–3257 harmonics. Table lengths are powers of two, at least2048 samples and at least eight samples per highest harmonic. Cubic interpolation reads four periodic neighbors.
- Tier selection permits harmonics below .49 of the sample rate. New harmonic groups fade over a2% frequency interval using smoothstep, so both ends of every transition are continuous. Modulation can still generate sidebands; this is not an arbitrary-FM/PWM alias-free guarantee.
- There is no latency, allocation, lock, table generation or IO in sample/mix. Checked-in float data occupies1,540,096 bytes (about1.47MiB); generated C++ text is about5.25MB. Runtime preparation does not build the bank.

At the lowest MIDI pitch (~8.176Hz), the maximum tier reaches about26.63kHz. That covers the audible20kHz reference band at conventional rates, but does not promise preservation of every ultrasonic harmonic up to Nyquist at192/384kHz. The existing engine's maximum phase-step policy still applies at very high pitches/low sample rates.

Compatibility is explicit: the additive sound config selects Legacy0 or Studio1 without changing the44-parameter tone ABI. Existing API defaults and old imported patches remain Legacy. New application Init uses Studio. Root integration crossfades source modes over5ms at shared phase; it adds no oscillator latency. Legacy keeps its original arithmetic branch and is tested with actual PCM nulls by integration tests.

## Source measurements

The reproducible source renderer compares mode0 Legacy, mode1 2x PolyBLEP plus31-tap halfband FIR, and mode2 production Studio. It is source-only: filter, Drive, Fullness, master saturation and voice gain are excluded. The2x comparator has7 output samples of latency on Saw/Pulse, corrected in comparisons; unchanged Sine/Triangle controls have no delay. It is not integrated into the engine.

The1,578 static cases cover nominal MIDI24–108 at every semitone, five Pulse widths .1/.3/.5/.7/.9, and octave Sine/Triangle controls. Each uses65,536 coherent samples at48kHz after warmup. Frequencies are deliberately quantized to the nearest odd FFT bin; actualHz are recorded and are not an instrument tuning error. Metrics cover0–20kHz excluding DC. Unwanted-bin energy excludes expected harmonic bins; aliases landing on a wanted harmonic appear in the wanted-spectrum error instead.

| Source | Saw unwanted median / worst dBc | Pulse unwanted median / worst dBc | Worst wanted8–20kHz loss: Saw / Pulse / Triangle |
|---|---:|---:|---:|
| Legacy | -41.39 / -28.85 | -41.22 / -24.11 | -2.66 / -3.88 / -10.14dB |
| 2x/FIR | -58.65 / -43.60 | -58.91 / -41.65 | -.78 / -1.31 / -10.14dB |
| Studio | -111.28 / -82.11 | -112.07 / -79.45 | -.27 / -.37 / -.068dB |

Studio's worst fundamental error in the Saw/Pulse/Triangle cases is below0.000001dB. The new triangle improves upper-partial retention rather than compensating with output gain. The prior4096-sample experimental bank had lower median interpolation noise in some stationary cases; this adaptive bank extends low-note coverage and improves the measured worst cases. Neither numerical noise-floor figure is a listening threshold.

Four dynamic cases use a16x/32x analytic-source/FIR reference with convergence reported. The common0–20kHz total error includes phase, intended spectral and PWM discrepancies, not just aliasing:

| Dynamic case | Legacy | 2x/FIR | Studio | Reference16x/32x convergence |
|---|---:|---:|---:|---:|
| Six-octave Saw sweep | -25.54 | -35.79 | -37.58 | -42.88dB |
| 440Hz Pulse,7Hz PWM | -30.75 | -40.84 | -45.20 | -47.84dB |
| 440Hz Saw,±50ct pitch movement | -29.03 | -39.35 | -51.18 | -46.44dB |
| Fast pitch/PWM stress | -24.45 | -34.21 | -34.47 | -41.84dB |

The precise pitch-movement margin is below reference convergence and therefore uncertain. Full-Nyquist total error instead favors the2x candidate in all four cases; the different ranking reflects guard-band and phase differences, so these are not interchangeable alias metrics. Studio dynamic peak is1.359; the broader pure sweep test reaches1.436. No source clipping or peak normalization conceals overshoot. Fixed-gain .2 PCM24 ABC auditions are available in the evidence directory.

## Cost and validation

Windows desktop, Node22, Emscripten7 WASM-O2,32 oscillators,48kHz,128-frame blocks, three alternating-order trials. Median milliseconds per audio second:

| Source | Triangle | Saw | Pulse |
|---|---:|---:|---:|
| Legacy | 48.86 | 24.08 | 29.68 |
| 2x/FIR comparator | 49.93 | 145.86 | 151.25 |
| Studio | 105.43 | 105.31 | 115.93 |

Studio worst observed source-only blocks were .474/.471/.490ms respectively. This is a meaningful cost increase over Legacy, not a free quality upgrade. It is below the straightforward2x/FIR comparator for Saw/Pulse. These results do not establish whole-synth deadlines or phone safety; integrated16-note/seven-copy/filter loads are a separate benchmark.

Six focused groups in `tests/wave_source_tests.cpp` pass: pure weighted mixing/Sine/Square semantics; actual FFT unwanted-energy and wanted-harmonic improvements; Triangle fundamental/upper-partial retention; all tier boundaries;8–384kHz finite pitch/PWM sweeps with zero sample allocation; stationary Pulse mean. The test matrix's worst Studio/Legacy unwanted-bin energy ratio is6.78e-5, and largest infinitesimal tier-boundary difference4.89e-15. Integrated mode automation, compatibility nulls, voice ownership and memory-fit checks are additional host/core gates.

## Reproduce

From the repository root, using this workspace's adjacent toolchain:

```powershell
python packages/synth-core/tools/generate_wave_source.py
$compiler = "../toolchain/emsdk/upstream/emscripten/em++.py"
$node = "../toolchain/node-v22.23.4-win-x64/node.exe"
$out = "../synth-studio-source-evidence"
New-Item -ItemType Directory -Force $out | Out-Null
python $compiler packages/synth-core/tests/wave_source_tests.cpp -std=c++17 -O2 -sINITIAL_MEMORY=67108864 -sENVIRONMENT=node -sEXIT_RUNTIME=1 -o "$out/source-tests.mjs"
& $node --input-type=module -e "import run from '../synth-studio-source-evidence/source-tests.mjs';await run();if(process.exitCode)throw Error('failed');"
python $compiler packages/synth-core/tests/wave_source_render.cpp -std=c++17 -O2 -sINITIAL_MEMORY=67108864 -sENVIRONMENT=node -sEXIT_RUNTIME=1 -sNODERAWFS=1 -o "$out/render.mjs"
& $node --input-type=module -e "import run from '../synth-studio-source-evidence/render.mjs';await run({arguments:['../synth-studio-source-evidence']});if(process.exitCode)throw Error('failed');"
python packages/synth-core/tools/analyze_wave_source.py $out
python $compiler packages/synth-core/tests/wave_source_benchmark.cpp -std=c++17 -O2 -sINITIAL_MEMORY=67108864 -sENVIRONMENT=node -sEXIT_RUNTIME=1 -o "$out/benchmark.mjs"
& $node --input-type=module -e "import run from '../synth-studio-source-evidence/benchmark.mjs';await run();if(process.exitCode)throw Error('failed');" | Set-Content "$out/benchmark.jsonl"
```

Check every exit code. The generator needs numpy; analysis additionally needs scipy/soundfile. The checked-in generated header makes normal native/WASM builds independent of Python. Raw static audio is about414MB and is not repository source. Evidence includes full metrics, source hashes, per-run timing and fixed-gain auditions; a compact summary is retained with the source tests.
