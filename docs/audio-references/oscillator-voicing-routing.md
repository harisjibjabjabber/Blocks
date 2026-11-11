# Independent oscillator unison and shared-filter routing

11 November 2026. Each oscillator now owns Count1–7, Detune0–50ct and Spread0–1. Count is captured on the next accepted note; Detune/Spread remain live5ms-smoothed. Defaults are1/0/0 independently. Quality remains a shared source-generation choice. The filter's Affects buttons select Osc1/Osc2 independently, with both selected by default.

## Signal flow and timing

Each logical note generates two independent oscillator copy pools. The chosen fractions are summed before the existing shared stereo filter, preserving nonlinear cross-saturation of routed signals. Complementary bypass fractions rejoin after the filter and before Sauce, the amplitude envelope and note panning. Disabling both routing buttons bypasses the filter for both oscillators, while Sauce and amplitude still apply. Routing does not mute an oscillator, create notes or restart phases.

There are still16 logical notes and a single filter/Sauce pair for each note's stereo channels. Two oscillators at7copies each have the same maximum oscillator capacity as the former shared7-copy setting. The engine does not create separate full filter/effects chains for every oscillator or unison copy.

Routing partition weights smooth toward their mask over5ms. In Ladder mode the bypass uses a lightweight linear copy of the same127-tap8x reconstruction/decimation, retaining15.75samples of FIR delay and its frequency response. Rounding to16samples or mixing an immediate dry oscillator against the delayed wet signal would create avoidable interference. The bypass is intentionally aligned filtered dry while Ladder is selected; it is not a zero-latency bypass. During a model change its aligned/immediate blend follows the existing model fade. Filter phase response remains legitimate and is not cancelled.

## Saved state and API compatibility

Tone ABI7/44 and the old16-byte `bs_voicing_config` API remain unchanged. Its setter assigns both oscillators. Its getter refuses without writing if the requested settings cannot be represented by one shared configuration. Equal old settings use the original paired summation order and C phase RNG draws. When the two live smoothed states differ, the independent path stays active even if targets have just become equal. Phases continue across path changes.

New `bs_voicing_config_v2` is32bytes: version2/reserved0, followed by two12-byte `{uint32 count;float detune_cents,spread;}` entries at offsets8 and20. New8-byte `bs_filter_routing_config` is `{uint32 version=1,mask}`; value1 selects Osc1, value2 Osc2,0 bypasses both and3 selects both. Whole configurations validate atomically; reset/prepare retain targets and initialize histories. Public headers install with the native package.

Browser patches save `voicing:{version:2,oscillators:[{count,detune,spread},...]}` and `filterRouting:{version:1,osc1,osc2}`. Missing routing defaults to both selected. A legacy v1 voicing object migrates to two separate copies with identical values. Import validates all extended state before mutation; reset, gesture cancellation, double-click/tap, Undo and save/load include both new states.

## Verification

The core suite has165 passing groups including five implementation groups and six independent acceptance groups. Tests cover mixed1/7 and7/1 counts, silent opposite-oscillator isolation, live edits, held-count snapshots, correct mask selection, filter-only bypass, Sauce retention, all-mask dry transfer, fractional FIR alignment, pedal/steal/release ownership, exact sample-block invariance, invalid atomicity and no render allocation. A separate installed-consumer smoke test exercises the new headers/APIs.

An independent predecessor comparison against5c5bc9b covers18 Legacy/Studio × Count1/3/7 × Soft/LP12/Ladder cases, including live Detune/Spread and release:589,824 output PCM bytes remain exactly identical, SHA256 `4aad2203998cabde8e9a60b0852cd9ac6894f8cf67a24f581e5221646b7fe614`. This establishes the tested compatibility, not every arbitrary patch combination.

The browser proof checks actual native v2/routing getter readback, independent controls, held routing and Undo, reset/cancellation, invalid import atomicity and legacy migration. Seven widths from320 through1920 pixels keep controls contained. An independent visual/source review found no P1/P2 blocker. Scope containment and a pixel-level zero-wave preview check prevent the previous short-strip overflow. Isolated Chrome tests mute device output while still measuring the audio graph, keeping test tones out of the user's preview session.

The48-run Windows Node22/WASM-O2 benchmark uses four held notes, Studio, Ladder Drive4/Cutoff2k/Resonance.6, oscillator levels1/.3, no additional Sauce,48kHz/128frames. It covers1/7,7/1,equal7/7 and different-tuning7/7 banks with all masks and three trials. In the different-tuning7/7 case, median processing cost spans396–475ms per audio second; worst observed block across masks is1.795ms against a2.667ms block budget. This is a bounded fixture; high polyphony and longer effects chains remain separate capacity limits. No voice cap or quality downgrade was introduced.

Reproduce with `node scripts/test-synth-core.mjs`, the native CMake/consumer workflow, `node scripts/synth-oscillator-proof.mjs` and the `oscillator_routing_benchmark.cpp` executable. Browser regression results and native timing are retained by CI. Physical-device and musical acceptance still require real use.
