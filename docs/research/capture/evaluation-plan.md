# Blocks Capture: musical evaluation plan

Status: proposal, revised 8 Nov 2026 after lead review. Every fixture below is **SYNTHETIC**: generated from a seeded PRNG and hand-written musical intent. They are not user data. The "default" and "acceptable" labels are **provisional** (lead decision D9). **There is no musical accuracy gate**: the harness is a regression check, and labels change only when Haris reviews them (`musician-review.md`). No accuracy claims are made.

There are two sets:
- **TUNING** (`fixtures/data/`, 18 fixtures, 22 steps, `generate.mjs`). `m0Predict` was developed and tuned on this set, so its results are **in-sample**.
- **HOLDOUT** (`fixtures/data-holdout/`, 10 fixtures, 14 steps, `generate-holdout.mjs`). These use new seeds, tempos (66, 92, 104, 112, 138, 150, 184) and situations. I wrote them **after** `m0Predict` was frozen (hash `50c2c3c16c5d3077`, printed by the evaluator), with labels written before any predictor ran on them. They are **never used to tune**. I wrote both sets myself, so the holdout is independent of the tuning, not of the designer.

## 1. What is scored
Each fixture is a session (raw events) plus one or more **capture steps**. Journey fixtures have piano, bass and drums steps against an evolving project clock. For every step the predictor returns a ranked candidate list, a mode (grid / free / bar-range / cycle-range / abstain) and flags.

| Metric | Definition | Notes |
|---|---|---|
| **Default correct** | Top candidate matches the labelled default. Bar ranges must match exactly (startBar, lengthBars). Free-time ranges must start within 150 ms and end within max(0.5 s, 1 beat). | The main musical metric. Tolerances are proposals. |
| Acceptable-not-default | Top candidate matches a labelled acceptable alternative | Counts as "usable after one tap" |
| Unacceptable hit | Top candidate matches a labelled unacceptable range, e.g. the whole session | Treated as a release blocker |
| **Rank of default** | 1-based position of the default in the candidate list (null if absent) | Matters for the "previous/next" controller flow; target ≤ 2 |
| Boundary error | \|start − label\|, \|end − label\| in ms, and in bars for grid steps | Reported as a distribution, not a mean only |
| Mode correct | Mode equals the labelled mode | |
| **Abstention appropriateness** | Abstains (free time / no grid) exactly where labelled. False confidence (a grid where `TEMPO_UNSTABLE`) and false abstention are counted separately | Over-abstention is a UX failure too |
| Flags | Expected flags (OPEN_NOTES_AT_CAPTURE, PICKUP, HISTORY_TRUNCATED…) raised | |
| Derived pairing | Per-stream note counts, retrigger closures and orphans equal the fixture's declared values (retrigger policy, matching the engine; capture-spec §4.2) | J12 |
| Arithmetic | Every labelled loop satisfies bars × beatsPerBar × 60 / BPM = seconds; alternatives that claim "same duration" really are | `check-arithmetic.mjs` |
| Tempo Acc1 / Acc2 | Within ±4% of the label / also allowing ×2, ×½, ×3, ×⅓ | Same definitions as v1. mir_eval `tempo.detection` (tol 0.08) and beat `continuity` (AMLt) as offline cross-checks [C5] |
| **Synced** (layer steps) | Project tempo unchanged; take aligned to the project bar grid with zero retiming; phase = as played | Journey metric |
| **Raw preservation** | SHA-256 of the canonical event list is unchanged after the predictor runs (events are deep-frozen) | Must be 100% |
| Derived checks | Pairing counts per stream (J12), latched pitches (J11), watermark snapshot (J13), initial state (J14) | Unit-level |

## 2. Fixture matrix (SYNTHETIC; labels pending pianist confirmation)

| ID | Musical situation | Default (designer intent) | Acceptable alternatives | Stresses |
|---|---|---|---|---|
| J01 | 75 s noodling, 2.6 s silence, 4-bar swing idea at 132 ending on the bar-5 downbeat | the 4-bar idea, grid 132 | same range in free time; 66 | recency, swing |
| J02 | 58 s continuous comping, **pedal down the whole time**, new motif in the last 8 bars, final chord held | **last 4 bars (latest motif statement)** | 8 bars; 4 bars + held tail | no silence, bounded, no collapse |
| J03 | ballad at 72, Capture pressed while the final chord's keys and pedal are down | phrase to captureAt; 5 open notes; loop to bar-5 downbeat | free-time loop | open notes, nothing invented |
| J04 | phrase A, pedalled chord rings 2.7 s, then phrase B | phrase B (**label uncertain**) | A + B | sounding rest vs pause |
| J05 | swing at 160, 3-note pickup | bars 1-4 at 160, pickup as anacrusis | 80 BPM, 2 bars | pickup, downbeat |
| J06 | rubato ballad, ritardando, legato pedal changes | **free time, no grid** (last phrase) | last two phrases free | abstention |
| J07 | Charleston comping, rolled 4-note voicings | 4 bars at 120 | 60, 2 bars | chord clustering |
| J08 | sparse half-note melody | 120, 8 bars, **flag half/double** | 60, 4 bars | ambiguity |
| J09 | jazz waltz | 3/4 at 150, 8 bars | 6/4 grouping; bar pulse | meter |
| J10 | 4-note false start, 1.65 s gap, 8-bar phrase | phrase only | include fragment; last 4 bars | false start |
| J11 | CC64 phrase, silence, then **CC66** latch phrase | latch phrase; end = CC66 up | – | sostenuto semantics |
| J12 | repeated and overlapping E4 across two devices and two channels; orphan note-off | phrase; per-stream counts | – | pairing |
| J13 | 30 s buffer evicts a held low note's onset | last phrase; snapshot note not an orphan | – | watermark |
| J14 | bend, mod, pressure and expression set before the phrase | phrase; initial state carried | – | initial state |
| J15 | phrase, then 25 s silence, then Capture | the phrase | – | delayed capture |
| L01 | **Journey**: noodle → piano 4 bars (sets the 120 grid) → bass experiments + 2-bar riff with pickup → drum noodling + 8-bar groove with a landing crash, captured 10 bars late | piano 4 bars; bass bars 8-9; drums bars 16-23 | bass without pickup; drums last 4 bars | layered, LCM 8, delayed |
| L02 | **Journey**: pedalled piano tail across the seam; bass riff ×2 then a 3rd partial; Capture mid-bar | piano 4 bars (no 5-bar loop); bass rep B (bars 8-11) + correction ops | rep A; A + B | seam tail, capture previous |
| L03 | **Journey**: rubato piano → free loop; bass locked to cycle 1 | free loop; bass cycle 1 | cycles 0-1 | cycle-lock, no invented BPM |

Generator: `node fixtures/generate.mjs` → `fixtures/data/*.json` (deterministic). Harness: `node fixtures/evaluate.mjs`.

### 2b. HOLDOUT matrix (SYNTHETIC; provisional labels; never used for tuning)

| ID | Situation | Default (designer intent) | Acceptable | Stresses |
|---|---|---|---|---|
| H01 | 60 s unpedalled noodle, 2.0 s silence, 8-bar straight-8ths idea at 104 landing on bar 9 | the idea, 8 bars (18.5 s) | last 4 bars | recency, 8-bar idea |
| H02 | 70 s pedal-down comping at 138, no silence, new vamp in the last 4 bars, final chord held | last 4 bars (the vamp) | last 8 bars | no silence, open notes |
| H03 | ballad at 66, pedal changed every bar, captured 12 s late | the phrase at 66, 4 bars (14.5 s) | 132, 8 bars (same 14.5 s) | delayed capture, tempo band |
| H04 | 3-note false start, 1.7 s pause, bebop line at 184 with a 1-beat pickup | line incl. pickup, 4 bars | 92, 2 bars | false start, pickup |
| H05 | two rubato phrases, 2.4 s silence, ritardando | second phrase, free time | both phrases, free | abstention |
| H06 | one line with a 2.0 s ringing pedalled chord inside, at 112 | the whole line | only after the chord | sounding rest ≠ silence |
| H07 | two keyboards on the same channel, overlapping C3, a retrigger, an orphan off | the phrase | – | streams, CROSS_STREAM_SAME_KEY |
| LH1 | journey at 92: piano 2-bar vamp → bass 4-bar walk captured 1.5 bars late → drums 4 bars, Capture mid-bar while playing, a drum noodle one beat before the groove | piano 2 bars; bass bars 6-9; drums bars 14-17 | bass bars 8-9; drums bar 16 or 16-17 | delayed, incomplete bar, LCM 4 |
| LH2 | journey at 150: bass noodles with no silence straight into a 2-bar riff played twice | bass bars 10-11 (last statement) | bars 8-11 | layer without silence, repetition |
| LH3 | free loop (9.3 s cycle): bass line across two cycles | bass cycles 0-1 | cycle 1 | free cycles, no BPM |

## 3. Harness results (run 8 Nov 2026, synthetic data only; not accuracy claims; main results are AS OF 534279f; for fdba348/497894e see phrase-results.txt)

There are three predictors:
- **prototype-f62b2a5**: models the old whole-ribbon selection, cleared after each capture.
- **m0-reference**: the proposed M0 rule, frozen at hash `50c2c3c16c5d3077`.
- **main-534279f**: the **real** `recentPhraseCut()` from Blocks main `534279f`, run from a read-only copy inside my model of `App.capture()`: history cleared after each capture, 120 s ribbon, and the fixture's grid passed in as the locked grid.

| Predictor | TUNING (22 steps) default / acceptable / unacceptable | HOLDOUT (14 steps) default / acceptable / unacceptable | Raw unchanged |
|---|---|---|---|
| prototype-f62b2a5 | 6 / 2 / 3 | 2 / 1 / 6 | 22/22, 14/14 |
| **m0-reference** | **19 / 1 / 0** (in-sample) | **11 / 0 / 0** | 22/22, 14/14 |
| main-534279f | 14 / 0 / 0 | 7 / 1 / 0 | 22/22, 14/14 |

How to read this:
- **In-sample disclaimer:** m0's 19/22 is on the set it was tuned on. The holdout 11/14 is the more honest number, and it's still synthetic, designer-labelled and small.
- **m0 fails on holdout:**
  - H02 (no silence, the same weakness as J02: needs M4 novelty or repetition);
  - LH1 drums (a drum noodle one beat before the groove merges with it; the default is ranked 2nd);
  - LH2 bass (no silence before the riff: needs repetition-aware ranking).
  All three are "no clean silence" cases. That's the main structural gap, and it shows up in both sets.
- **m0 mode correct:** 10/22 tuning, 7/14 holdout. M0 has no pulse estimator, so every first capture is free time.
- **main-534279f:**
  - It gets the clean-silence first captures right.
  - On J02 and H02 (pedal down, no silence) it returns **the whole ribbon**, which the app labels as `ambiguous`.
  - On J04 and H06 its onset-gap rule splits at a ringing chord. That matches the J04 label but not H06.
  - It can't score on layer steps because it returns free-time ranges, not bar ranges. Its start error there is sometimes small (L01 drums 3 ms, LH1 bass 11 ms) and sometimes large.
  - This is my wrapper around the real function, not the app itself. The implementation project is re-verifying.
- The derived pairing check (J12) passes with the retrigger policy.
- `check-arithmetic.mjs` checks every labelled loop on both sets: 21 + 14 checks, 0 issues.

Outputs:
- `evaluation-smoke-results.txt|json` (tuning)
- `evaluation-holdout-results.txt|json` (holdout)

## 4. Human evaluation protocol (Haris, jazz piano, real app; later)
Purpose: label real defaults, judge musical rightness, and test the journey flow. The protocol only records what was run, on which build and device. Nothing counts as hardware-verified unless it was actually played on that hardware.

**Setup record:** build commit + APK hash or site bundle hash; browser/OS; keyboard model and connection (USB/BLE); pedal(s) (CC64, CC66 if present); audio output (speaker/headphones/interface); Blocks settings. QA owns this form.

**Session A, single captures (about 25 min)**, prompted scenarios, each repeated 3×:
1. Free improvisation for at least 90 s, then Capture after a phrase you like (J01-like). The ribbon is session-only and limited to the existing 120 s / 4096 events / 256 KiB (D8), so longer sessions test eviction.
2. Keep the pedal down and play continuously, then Capture (J02-like).
3. Capture while still holding the last chord (J03).
4. Ballad rubato phrase (J06). Swing line with a pickup (J05). A waltz phrase (J09).
5. A deliberate false start, then the real phrase (J10).
6. Sostenuto passage, if the pedal exists (J11).

**Session B, journey (about 25 min)**, 3 runs with different tempos and feels:
piano phrase → Capture → switch to bass → experiment ≥ 2 cycles → riff → Capture (sometimes late, sometimes mid-bar) → switch to drums → Capture an 8-bar part → use at least one correction op.

**For every capture**, record automatically (app log) and by rating:
- Did the default range feel right? (5-point: wrong / usable after edits / usable after 1 tap / right / exactly what I meant)
- Did it loop **in sync** with existing layers? (yes / drifted / wrong phase / wrong bar). Latency is uncompensated until calibrated (D7), so note any constant lateness rather than correcting it.
- Tempo proposal right? (right / half-double / wrong / should have stayed free)
- Number of taps or controller presses to reach the wanted result, and time from Capture to "happy"
- Was the abstention or fallback message honest and useful? (yes / no / confusing)
- Free comment (one line)

**Labelling:** after each session, Haris marks the intended start, end and bars on the captured history (a simple labelling view or screen recording plus timestamps). Those become **real labelled examples**, kept in a separate private dataset, never mixed with synthetic data, and used only with his consent.

**Listening test (blind, optional):** for 10 real captures, play the default vs the best alternative vs the whole-history prototype selection in random order. Haris ranks them. Report the counts only.

**No musical accuracy gate (D9).** Report the counts descriptively, per device and browser. Nothing generalises to untested devices. The only hard regressions are structural:
- a whole-session collapse;
- a raw checksum change;
- the project tempo changing on a layer capture;
- an invented confidence percentage or count appearing in the UI (D2).

## 5. Evidence levels (aligned with QA)
implemented → automated-tested (Node/Jest on synthetic fixtures) → emulator/browser-tested → physically-tested (named device, keyboard, pedal) → human-musically-evaluated. A result is never upgraded from a lower level.


## 6. Musician review (non-blocking)
`musician-review.md` lists 11 ambiguous situations in plain language, each with Blocks' default and the one-tap alternatives. Haris's answers relabel fixtures later. They don't block regression tests.
