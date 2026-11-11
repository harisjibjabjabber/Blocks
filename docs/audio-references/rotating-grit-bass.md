# Oscillator Bass: rotating harmonic source

This is an opt-in oscillator source, independently available on Oscillator 1 and 2. It is not a Sauce effect, pitch-drift trick, or an emulation of another instrument. Disabled is the compatibility default. Musical approval remains a listening gate.

## Controls and portable contract

Each oscillator retains Sine, Triangle, Saw, Pulse and Square. Bass adds On, Spin (0.1–20 Hz), Motion (0–1) and Grit (0–1), with stored defaults Off / 4 Hz / 0.65 / 0.35. Spin, Motion and Grit smooth over approximately 5 ms; On crossfades over 5 ms. The independent rotation clocks continue through idle, retriggers and panic; reset/prepare restore deterministic phase zero. Unison's existing C phase policy, note ownership, filter routing and envelopes remain unchanged.

The additive `blocks_osc_bass.h` API uses a 40-byte version-1 configuration: version/reserved followed by two 16-byte entries (`enabled`, `spin_hz`, `motion`, `grit`). Validation is atomic. Tone patch ABI and Sauce configuration are unchanged. The default/set/get functions, per-oscillator phase getter and pure `bs_osc_bass_preview` are installed public APIs. Native preview uses the same source calculation, with explicit waveform, source quality, pulse width, controls, rotation pose, frequency and sample rate. It is a source preview, not a scope of the final filtered or polyphonic output. No LFO routing to these new controls is exposed in this slice.

## Original source calculation

The selected wave is separated into DC, its fixed fundamental `F`, and higher harmonic components `H` and their quadrature partner `Q`. Generated immutable Fourier tables share the existing Studio source's harmonic limits, cubic lookup and mip transitions. The fundamental is removed from both higher-harmonic banks.

```
theta = pi * Motion * sin(2*pi*rotationPhase)
output = DC + F + (0.5 + Grit) * (cos(theta)*H + sin(theta)*Q)
```

This rotates overtone phases while retaining the carrier fundamental. Sine has no initial overtones, so its opt-in palette adds Grit-scaled second and third harmonics (coefficients 0.25 and 0.125) to the same rotation path. Pulse keeps its existing width-dependent DC; Square uses fixed 50% duty. Bass On uses its own bandlimited table source regardless of global Legacy/Studio selection; Bass Off restores the selected original source.

There is no FIR latency or extra logical voice. The added immutable float data is 1,540,096 bytes. Maximum stored harmonic count is 3257, so very low notes at unusually high sample rates retain that finite-bank limitation. A spectral guard reserves `10*Spin` Hz below 0.49 times sample rate. Time-varying phase modulation has theoretically unbounded sidebands: this guard is a measured leakage tradeoff, not a claim of perfect band limitation.

The implementation is original. Relevant primary background is Julius O. Smith's [additive amplitude/phase formulation](https://www.dsprelated.com/freebooks/sasp/Additive_Synthesis_Early_Sinusoidal.html), [grouped additive/wavetable synthesis](https://www.dsprelated.com/freebooks/sasp/Additive_Synthesis.html), and Joe Wright's [bandlimited wavetable paper](https://www.musicdsp.org/en/latest/_downloads/91daec88cb0d79aeb1c21d8afd4e3199/bandlimited.pdf). No external DSP implementation was copied.

## Recorded verification

Focused WASM-O2 verification passed six core groups: atomic API/preview validation; disabled compatibility; static source spectrum; moving spectrum; preview/clock lifecycle; and actual-core live edits, release, block invariance and allocation checks. The worklet suite passed 22 tests, including the 40-byte bridge. The extended public-header consumer compiled and exited successfully. CMake, the install list and the fail-fast core runner include the new tests/API; native CI remains the independent native-backend gate.

- Across 168 static poses covering five waves, C1–C3 and Pulse widths 0.1/0.5/0.9, maximum complex fundamental error was `9.39587529e-7`, added static-pose DC `3.85138553e-10`, and rotation energy variation `3.42921553e-6`.
- One coherent moving Saw fixture at 48 kHz, approximately 130.37 Hz carrier and 4.3945 Hz Spin, Motion/Grit 1, measured unwanted energy at **−88.30845 dBc** against its specified harmonic/sideband mask in 0–20 kHz. Intended sideband energy relative to fundamental was `0.192259794`. This is a defined fixture, not a universal modulation or dynamic-DC guarantee.
- Raw source crest reached **5.9365872** in the edge matrix. There is deliberately no hidden source limiter or normalization. Rotation can concentrate peaks and interact strongly with Drive; Grit does not promise equal perceived loudness. Existing core output protection remains in place.
- Parent QA verified all 589,824 bytes of the 18-case legacy fixture unchanged with Bass disabled (Legacy/Studio × Count 1/3/7 × three filters, including live detune and release): SHA-256 `4aad2203998cabde8e9a60b0852cd9ac6894f8cf67a24f581e5221646b7fe614`.
- Skipping unused classic-source calculation after Bass reaches fully On was separately checked: all three audition WAVs were byte-identical before/after the optimization. No phases or output samples changed.

Local evidence is under `work/osc-bass-evidence` beside the repository: final core log, source/clip manifest and fixed-gain `bass-off.wav`, `bass-default.wav`, `bass-edge.wav`. Each six-second clip uses the same C1/C2/C3 motif, Studio Saw, oscillator level 0.7, gain 0.25 and velocity 0.7, with filter mix and colour effects disabled. Clips are not individually normalized; output peaks are respectively 0.0288331583, 0.0677743405 and 0.113273889. These are listening material, not a listening verdict.

Regenerate tables with `python packages/synth-core/tools/generate_osc_bass.py`. Build the CMake `blocks_synth_osc_bass_tests` and `blocks_synth_osc_bass_audition` targets, or use the existing Emscripten toolchain with C++17/O2, the core source and corresponding test source. The audition executable accepts its output directory as the first argument. The normal `scripts/test-synth-core.mjs` runner also includes the six focused groups; this change did not trigger a new broad CPU benchmark.
