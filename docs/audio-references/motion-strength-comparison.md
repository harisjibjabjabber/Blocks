# Pitch strength: actual-output comparison

This diagnostic compares the previous hard-budget/restarting-drift core with the stronger adaptive response and continuous keyed drift clock. Both sides use the same physical settings: drift120 cents, Hit60 cents, settle180ms, Speed0.58Hz, MIDI84 and velocity0.72. It is a mechanism comparison, not a listening verdict or a universal excursion limit.

The standalone C++ fixture renders the actual core to measure interpolated output zero-crossing periods. Each side has120 cases: Mono/Poly, held/24 repeated80ms notes at120ms spacing, five amplitude shapes, sensitivity0/.272/.85 and manual/adaptive response. Attack windows cover4-16ms; late held windows cover1-3s. Exact parameters, events, output-window RMS and source hashes are retained in the generated manifests. No substitute oscillator or level normalization is used.

Selected adaptive Mono results, factory sensitivity0.272:

| Fixture | Previous peak | Revised peak | Previous mean absolute attack | Revised mean absolute attack |
|---|---:|---:|---:|---:|
| Repeated sustained envelope | 5.28 cents | 81.01 cents | 2.34 cents | 44.16 cents |
| Repeated short pluck | 46.21 cents | 124.61 cents | 24.90 cents | 63.57 cents |
| One held note, late window | 21.36 cents | 70.07 cents | n/a | n/a |

The revised repeated sustained-envelope peaks at sensitivity0/.272/.85 are87.69/81.01/66.81 cents. Short-pluck peaks are134.87/124.61/102.70 cents. The amount macro no longer changes sensitivity, so those are separate calibration choices. The total excursion can exceed either individual depth because drift and Hit add; there is no combined120-cent cap. On another key/phase they can cancel. The first revised pluck in this fixture moves less than its previous counterpart, even though the repeated-note peak is larger: a single random attack is not a valid general-strength comparison.

Slow Attack and zero Sustain with8-second Decay retain the restrained envelope classification. Their early output frequency still moves, but slow-attack RMS is low: numeric pitch movement before an audible attack does not prove expressive audibility. The same-key repeated fixture does not assess overlapping legato Glide; that has separate core tests. Physical-phone, listening and the player's final preferred upper setting remain unverified.

Provenance:

- Previous CPP SHA256: `ad511c3e6c9ea28e18b472fac2bf49a73da14fbb8e11930596a2b78c8f9fc299`.
- Revised CPP SHA256: `452756c3460b167430a29a9d6023e85d6834ef2e7bc125de4965a0fd9f2a4001`.
- Previous measurements SHA256: `10cb7694ac7bfbdd41c75cdbb32936909777918547f5e1f9d223d99702e39b02`.
- Revised measurements SHA256: `d07cc8b59a3d23f78a84a0924150d2161fc09b15a7445af345c6db4445438fd2`.
- Each `index.json` also hashes every private/public core source and the fixture, so the CPP hash alone is not the complete implementation identity.

To reproduce, supply coherent immutable `src`/`include` snapshots for each side; the script refuses source changes during rendering. The local evidence folders are `work/synth-motion-strength-before` and `work/synth-motion-strength-after`, alongside the repository. With the documented EMSDK/Python environment:

```sh
node scripts/probe-motion-strength.mjs --core=../synth-motion-before-core --out=../synth-motion-strength-before
node scripts/probe-motion-strength.mjs --core=../synth-motion-after-core --out=../synth-motion-strength-after
```
