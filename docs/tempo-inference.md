# MIDI tempo candidate integration

This change replaces the old fixed-lag search in `src/domain/inference.ts` with the pinned `music-tempo@1.0.3` TempoInduction and BeatTracking modules. It does **not** change automatic phrase selection, capture bounds, note timing, quantisation, meter, or downbeat placement. It bypasses the package's audio FFT/onset detector and supplies MIDI onset times directly.

Sources: [music-tempo source and documentation](https://github.com/killercrush/music-tempo), [Simon Dixon's BeatRoot paper](https://webspace.eecs.qmul.ac.uk/s.e.dixon/pub/2001/jnmr.pdf). The dependency describes its algorithm as BeatRoot-derived. Package version and integrity are pinned in `package-lock.json`.

## Why the old search was replaced

The old binary `scoreLag` accepted attacks within a broad tolerance and resolved ties toward the shortest lag. Sixteen perfect 500 ms attacks therefore selected 465 ms / 129.032 BPM. The old regression accepted any period between 450 and 550 ms, hiding this bias. The new tests require 500 ms / 120 BPM and 600 ms / 100 BPM tightly. `scoreLag` remains only for legacy half/double comparison fields; it no longer chooses the primary tempo.

## Candidate wrapper and limits

`midi-tempo.ts` normalises a copied onset window relative to its first onset, preserving absolute phase in returned evidence. This matters because the upstream tracker seeds competing phases in its first five seconds; passing raw session times would skip that stage. It analyses at most the latest 512 distinct onset groups. Existing 40 ms MIDI chord grouping, gap/false-start analysis, swing reporting and source event immutability remain in `inferPulse`.

The wrapper requires four distinct groups, at least four accepted observations, a minimum observation-support fraction, and bounded residual error for a useful constant grid. These are engineering rejection thresholds, **not calibrated probabilities**. It returns no estimate if candidate extraction fails or the supported candidates are too unsettled. Agent score, accepted counts, and the legacy `primaryScore` are not confidence percentages.

Upstream's initial beat-interval range of 0.3–1.0 seconds folds candidates into a **60–200 BPM octave prior**. Adaptation can subsequently change an agent's interval. This range is not proof that a sparse chord interval means a particular beat unit. Competing tempo levels and phases remain ambiguous; no candidate proves a downbeat or meter.

## Unmodified-library benchmark

The original package was downloaded with `npm pack music-tempo@1.0.3`, extracted unchanged outside the repository in `work/tempo-research`, and tested using its four TempoInduction steps and BeatTracking. Uniform onset salience was used except the explicitly accented eighth-note case. No four-bar truth was imposed.

| MIDI onset fixture | Old primary BPM | Unmodified library result | Interpretation |
| --- | ---: | --- | --- |
| Perfect 500 ms, 16 attacks | 129.032 | 120; slower alternatives | Correct interval centre; metrical level still a choice |
| Sparse attacks at 0, 2, 4, 6 s | 32.432 | 60 only under its octave prior | Does not establish 120 BPM or four bars |
| Unaccented 250 ms eighths | 255.319 | Two equally scored 120 candidates, phases 0 and 0.25 s | Beat phase is ambiguous |
| 250 ms pickup then 500 ms attacks | 129.032 | 120, phase 0.25 s | Pickup survives; no bar inference |
| Every attack shifted 250 ms | 129.032 | 120, phase 0.25 s | Cannot know whether these are downbeats or offbeats |
| 2:1 swing at 120 | 120 | Equal-score 120 phases and 180 candidate | Do not promote one score to certainty |
| Syncopated fixture with missing downbeats | 37.037 | 120 ranked first | Better candidate, not universal syncopation proof |
| Internal short rest | 129.032 | 120 | Useful across this rest |
| Internal 12 s rest | 129.032 | No surviving agents | Gap segmentation remains necessary |
| Chords rolled by 0/60/120 ms, 2 s apart | 32.432 | Near-60 candidates, additional 113–125 hypotheses | Current 40 ms grouping does not resolve wide rolls |
| 120→140 tempo change | 129.032 | Approximately 138.3, competing ~124.5 | A changing performance does not define one exact grid |
| Gradual 500→450 ms intervals | 129.032 | Approximately 125.5 | Summary only; no tempo map |
| Three irregular attacks | none | 200 ranked first | Wrapper must retain the minimum-four guard |

Reproducible scripts/results: `work/tempo-research/benchmark.mjs`, `benchmark-results.json`, `benchmark-current.ts`, `benchmark-current-results.json`. These are local research artifacts, not runtime dependencies.

## Bounded runtime measurement

Node 22.23.4 on the current Windows development computer; 12 calls per case, first call reported separately, 11 subsequent calls measured. This is **not phone hardware proof**. The adapter runs on Capture, not every live MIDI event.

| Input | Analysed groups | First call | Warm median | Warm maximum |
| --- | ---: | ---: | ---: | ---: |
| 512 regular groups | 512 | 11.73 ms | 2.43 ms | 5.09 ms |
| 512 mildly jittered groups | 512 | 2.27 ms | 1.95 ms | 2.29 ms |
| 512 dense groups | 512 | 9.92 ms | 3.82 ms | 4.23 ms |
| 4096 dense groups | 512 | 3.93 ms | 3.96 ms | 4.51 ms |

Actual low-end phone timing remains to be measured. The cap bounds the candidate search; it is not a guarantee about every device or adversarial onset pattern.

## Four-bar prior versus manual fit

Automatic Capture can offer a BPM **estimate** from attack evidence. A default four-bar operation target is a product prior, not a detected phrase length. Four chords can represent four beats, four bars, two bars, or a longer pattern. Their spacing alone cannot identify the interpretation.

Manual first Cut explicitly asserts that the chosen interval represents the selected bar count: `BPM = 60 × beatsPerBar × bars / durationSeconds`. Its exact selected bounds and bar-count assumption are the evidence for that operation. It must not be described as the detector recognising four bars. Free range carries no such inference. Later layers retain the established master tempo; selection and tempo changes remain reversible independently of immutable performance events.

## Remaining design gaps and next bounded matrix

There is no `loop-period.ts` implementation: `loop-period.test.ts` tests `measuredPeriod`/`nominalLoop` inside `recent-phrase.ts`. Its measured chord-slot spacing is different from quarter-note pulse and from bar length.

| Case | Existing evidence / concrete gap | Next regression requirement |
| --- | --- | --- |
| Pickups and missing first beat | Short-leading-interval flag exists; first onset is not necessarily beat one | Quarter/eighth pickups, missing downbeat, same notes with shifted origin; retain notes and admit phase ambiguity |
| Leading rests | Record/Stop knows its start; free capture cannot reconstruct an unobserved start | Explicit recording preserves rest; inferred capture must not invent a confident bar start |
| Block and rolled chords | Tight 40 ms groups work; phrase cutter has a different hold-based chord model | Rolls of 20/60/120/190 ms versus genuine fast melodic/arpeggio notes; prevent extra tempo votes without merging distinct melody |
| Offbeat and syncopation | Candidate phases can tie; no absent-downbeat reasoning | Compare shifted/clipped copies, accents, missing beats, repeated syncopated patterns; do not equate first accepted beat with downbeat |
| Sustain and articulation | Phrase logic includes pedal/held notes; pulse uses attacks | Same attacks with short/long releases, per-channel pedal, repeated same pitch; pulse independent of release while phrase context stays intact |
| Tails and internal rests | Existing final-slot tests preserve short/long articulation; gap analysis can choose the first substantive segment | Full final-bar silence, tied final note, internal whole-bar rest, two different-tempo segments; distinguish no-pulse from unsupported phase |
| Repetition | No pitch/rhythm motif-repeat model | Two/four/eight repetitions and repeated noodling before the intended phrase; bound the retained prefix without pretending repeat count proves bars |
| Half/double and sparse playing | Candidate prior and half/double metadata exist | Assert plausible candidate families/ambiguity, not arbitrary 120 truth for four sparse chords |
| Tempo drift | No tempo map; one constant editing-grid candidate only | Small jitter versus gradual accelerando and abrupt change; abstain or label uncertainty rather than retime notes |
| Meter | Pulse detector does not infer meter; legacy locked-grid phrase path uses four beats | Explicit 3/4, 4/4 and compound-meter expectations before expanding bar detection; never silently claim inferred 4/4 |

Next bounded detector work should add an onset-evidence adapter shared with the phrase cutter and a small, inspectable list of beat/phase/window candidates. Rank only among retained-history candidates, keep the four-bar preference separate, and test each ambiguity before changing capture-boundary behaviour. No uncalibrated confidence percentage or automatic downbeat claim is warranted by the current synthetic suite. Existing holdout files are synthetic regression holdouts, not recordings from the user or a representative external evaluation corpus.

## Dependency attribution

`music-tempo` 1.0.3, Copyright (c) 2017 killercrush, MIT License. Its unmodified compiled TempoInduction, BeatTracking and Agent modules are bundled through the dependency. No FFT/audio decoder module is required by this adapter. The package's `LICENCE` contains the applicable permission and warranty text; attribution and that license must accompany redistributed copies. The upstream implementation attributes the BeatRoot algorithm to Simon Dixon. No dependency source is vendored or modified here.

```text
MIT License

Copyright (c) 2017 killercrush

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```


## Soft capture-length preference

Automatic Capture now uses the selected 4/8-bar target as a soft prior after phrase and tempo analysis. It preserves the existing proposed end, including the final rhythmic slot, and shortens an overlong prefix only when there are at least 8 attacks and a real attack within half a beat of the expected start. The earliest attack in that tolerance retains a nearby pickup. Free, explicit Record and manual ranges bypass this preference; unsupported candidates keep the existing proposal. This is not proof of intent, meter or drum phrasing. All earlier source notes remain recoverable. A detected rest also constrains subsequent chord-pattern recognition, which previously could pull an abandoned prefix back into the selection.
