# Rack transition optimization and evidence

10 November 2026. This is a targeted reduction in rack-edit processing cost, not a universal synth speedup or a larger supported phone workload. ABI7/44, effect capacity, sound settings, five-millisecond crossfades and note ownership are unchanged.

## Implementation

AudioRack caches each graph's primary-binding flags. During a crossfade it evaluates an identical base and common prefix once, then runs the differing suffixes separately. The active prefix state advances once per sample; the discarded old prefix is not subsequently read. Pending edits still begin from the active graph, and primary-mask changes prevent sharing when the inputs differ.

Fullness lazily caches its previous antiderivative value. Small-difference fallback samples do not calculate a primitive; a changed small input invalidates the cache and the next divided-difference evaluation recomputes the missing value. Reset and copied-invalid state are tested. No polynomial, antialiasing threshold, filter, amplitude mapping or fade duration was changed. The first eager-cache candidate was rejected after a repeatable Square/Pulse slowdown; its reports remain separate. One no-cache ablation did not dominate the final candidate, so the measured tradeoff is retained rather than hidden.

## Exactness and interaction gates

- 79 C++/WASM groups and39 Node tests pass. The new cache test includes40,000 exact comparisons with the uncached formula, tiny/constant inputs, invalid-cache copies and seeded resets.
- An identical public-API fixture compiled against frozen `dceb0d25f1f185061f1d6ab0721ddab0c3fa2586` and the candidate produces24 matching cases and9,728,000 identical float-output bytes, SHA256 `1a66985d6df13fc88b67ac5b26a75a4f12193b7f2a0bda782bd24184befb6d53`.
- The fixture covers Soft/LP12 at8/48/96kHz, continuous LFO controls at48kHz, complete reversal, shared prefixes, rapid pending edits, primary suppression, disabled Fullness warmth, repeated notes/steal tails, pedal and releases. Every case must contain nonzero energy, finite bounded output and end with zero voices.
- Five factory WAVs and four fixed-gain filter WAVs remain byte-identical to the preceding build. Legacy PCM also matches. These supplement the differential Saw/Pulse-derived cases with factory and Sine/Triangle coverage.
- The scoped browser review passes24 functional checks: preview/drop separation, cancellation, Undo, preserved values/power/Details/focus/DOM order, held-note audio and clean release. A separate six-check visual review repaired corrupted Sauce glyphs using explicit Unicode escapes; no layout or interaction redesign was bundled.

CI separately compiles and compares native C++17-O3 and WebAssembly-O2 against the pinned baseline. Inspect the current draft PR checks for native approval; the local WASM result alone does not establish native equivalence.

## Timing method

The unchanged57-case suite was run baseline/candidate/candidate/baseline. A separate12-case suite used the same balanced order, with16 audio nodes, dense16-voice input, two waveform pairs, both filters and edits retaining0/8/15 custom stages. Every case has one warmup audio second and three measured seconds. Configuration calls are timed separately. Source hashes, case settings, observed voice counts, output peaks and configuration counts are checked; all runs and their ranges are retained.

The focused suite edits every4,864 frames at48kHz (101.333ms). Each case records54 blocks overlapping the240-frame crossfade. Its nominal transition p99 therefore equals that run's maximum; it is not a well-sampled reliability percentile. The table uses transition P95, reporting two-run medians and candidate ranges. It does not represent whole-render throughput.

| Wave pair | Filter mode | Retained custom stages | Before P95 ms | After P95 ms | After run range ms |
|---|---:|---:|---:|---:|---|
| saw-pulse | 0 | 0 | 3.386 | 3.264 | 3.242–3.285 |
| saw-pulse | 0 | 8 | 3.370 | 2.550 | 2.542–2.558 |
| saw-pulse | 0 | 15 | 3.407 | 1.994 | 1.992–1.996 |
| saw-pulse | 1 | 0 | 3.451 | 3.300 | 3.300–3.300 |
| saw-pulse | 1 | 8 | 3.419 | 2.573 | 2.565–2.582 |
| saw-pulse | 1 | 15 | 3.473 | 2.024 | 2.017–2.031 |
| square-pulse | 0 | 0 | 3.500 | 3.333 | 3.330–3.336 |
| square-pulse | 0 | 8 | 3.468 | 2.621 | 2.619–2.622 |
| square-pulse | 0 | 15 | 3.519 | 2.067 | 2.060–2.073 |
| square-pulse | 1 | 0 | 3.521 | 3.343 | 3.339–3.348 |
| square-pulse | 1 | 8 | 3.512 | 2.632 | 2.622–2.643 |
| square-pulse | 1 | 15 | 3.534 | 2.072 | 2.064–2.080 |

Retaining eight stages reduces transition-block costs substantially; retaining fifteen gives the strongest reduction. Full reversal still exceeds the2.667ms reference block budget. Some partial-edit maxima also exceed it, so these results do not establish a new supported load.

The standard57-case results are mixed:22 cases have slower median throughput. Simple held Square/Pulse shows measurable costs; for16 voices at Fullness0.5,103.15–103.69 becomes104.84–106.17ms per audio second (about2.0% median increase), and8 voices increases about2.6%. Some single-voice cases are3–6% slower while remaining small absolute loads. These are disclosed tradeoffs, not dismissed as noise. Full-reversal p99 improves only about4–5% and remains over budget; transitions are sparse, so their larger savings must not be advertised as overall throughput gains.

All timings are one Windows x64/Node22.23.4/Emscripten7.0.0 environment. They exclude host copies/messages, devices, UI and thermal effects. Physical-phone testing, USB MIDI and listening remain separate gates.

## Reproduce and inspect

Local evidence directories beside the repository:

- `synth-headroom-candidate2-evidence` and `synth-headroom-candidate2-audio`: final core log and exact differential artifacts.
- `synth-headroom-timing-v2` and `synth-headroom-prefix-timing-v2`: final baseline comparisons, all four runs and source hashes.
- `synth-headroom-cache-ablation` and `synth-headroom-cache-prefix-ablation`: final cache/no-cache comparison, separate from baseline claims.
- `synth-headroom-factory-auditions`, `synth-headroom-filter-auditions` and `standalone-touch-evidence`: audio nulls and browser/visual proofs.

With Node22, Python and Emscripten7.0.0 in `EMSDK`, supply an immutable baseline core containing `src`/`include`:

```sh
node scripts/compare-rack-audio.mjs --before=/path/to/baseline/core --backend=wasm
node scripts/compare-rack-audio.mjs --before=/path/to/baseline/core --backend=native
node scripts/compare-rack-performance.mjs --before=/path/to/baseline/core --out=/path/to/standard-results
node scripts/compare-rack-performance.mjs --before=/path/to/baseline/core --suite=prefix --out=/path/to/prefix-results
```

Run comparisons sequentially without competing browser/build workloads. Repeated desktop results are engineering evidence, not phone latency guarantees.
