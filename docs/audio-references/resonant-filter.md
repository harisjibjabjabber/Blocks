# Resonant LP12 implementation and evidence

10 November 2026. This optional Tone filter is an original linear trapezoidal state-variable low-pass, based on [Andrew Simper/Cytomic's mathematical derivation](https://www.cytomic.com/files/dsp/SvfLinearTrapOptimised.pdf). No third-party implementation was copied. It is not a nonlinear ladder or hardware emulation; the separate Fullness study remains deferred.

ABI7 appends Resonance42 and Filter mode43 to the42-value ABI6 prefix. Mode0 is the existing Soft one-pole, mode1 Resonant LP12. Legacy imports and factory presets retain Soft. Resonance0–1 maps exponentially from Q=1/sqrt(2) to8. DC gain is unity, while the cutoff peak can approach18dB: this is intentional resonance, without automatic loudness compensation. Existing Output and peak telemetry remain available.

Cutoff and Resonance smooth; mode changes crossfade over10ms. The legacy pole continues running underneath so returning to Soft retains its filter history. That is not a claim that downstream stateful Fullness has the same history after a resonant excursion. Filter ADSR and Cutoff LFO still apply; Resonance is a new continuous LFO destination, while discrete mode is not. Filter mix0 returns dry audio. The UI graph shows the selected filter's baseline complex dry/wet response at the actual sample rate, excluding note envelopes and LFO movement; graph gestures retain Cutoff horizontally and Mix vertically.

## Verification

- 77 C++/WASM groups pass, including7 focused filter groups:162 complex-response measurements had maximum relative error1.32e-12; Q8 low-cutoff impulse late/early energy was7.07e-11; a low-level440Hz fixture measured cutoff gain7.973. Fast modulation across six sample rates remained finite, peak0.2663, without render allocations.
- 39 Node tests pass, including five independent response-model tests;37 integrated browser checks and28 scoped UI/UX checks pass with zero observed runtime exceptions. Mode/Resonance changes, retained disabled values, saved patches, LFO routing, Undo, cancellation, held notes and release are covered.
- The legacy3-second WAV is byte-identical to the immutable7691e66 baseline, SHA256 `713e2a56e6a5efbded6e9554e01e75326b9f1838d80dec503c606f6f388d9eee`. All five factory audition WAVs also match their ABI6 predecessors byte-for-byte.
- Four new fixed-gain comparison WAVs cover Soft and Resonant held chords and plucks. They are not normalized, and each ends with zero active voices. The manifest records exact patches, events, source hashes and audio hashes. These files are for later listening, not listening approval.

Local evidence folders beside the repository are `synth-filter-evidence`, `synth-filter-browser`, `standalone-touch-evidence`, `synth-filter-factory-auditions`, `synth-filter-auditions` and `synth-filter-benchmark`. CI uploads current filter/factory audio manifests and browser evidence.

## Processing cost

One Windows x64/Node22.23.4/Emscripten7.0.0 run at48kHz and128-frame blocks measured57 cases:51 retained workloads plus six paired Soft/Resonant filter cases. All paired cases observed16 voices. This is offline core timing; it excludes host copies/messages, UI, devices and thermal effects.

| Paired16-voice workload | Soft p99 block | Resonant p99 block | Soft / Resonant milliseconds per audio second |
|---|---:|---:|---:|
| Held notes without filter envelope |0.2807ms|0.2889ms|97.07 /104.37|
| Dense retriggers with active envelope |0.8847ms|1.0273ms|177.03 /204.33|
|16 mixed effects with live reorder |3.3751ms|3.4413ms|Both exceed the2.6667ms block budget|

The heaviest topology can glitch in either mode. Other measured workloads fitting this desktop budget do not establish a supported phone budget. Keep this limit visible before expanding unison and costly effects. The benchmark retains exact source hashes and reports configuration costs separately from render percentiles.

## Reproduce

With Node22, Python and the official activated Emscripten7.0.0 SDK in `EMSDK`:

```sh
node --test packages/synth-web/*.test.mjs
node scripts/test-synth-core.mjs
node scripts/build-synth.mjs
node scripts/render-synth-auditions.mjs
node scripts/render-filter-auditions.mjs
node scripts/benchmark-synth.mjs
```

Serve `packages/synth-web/build` on127.0.0.1:41821 before `node scripts/synth-standalone-proof.mjs`. Physical-phone interaction/CPU, USB MIDI and subjective sound approval remain open.
