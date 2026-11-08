# Phrase capture handoff: pulse-first, end-anchored range selection (research proposal, 8 Nov 2026)

From Blocks · Capture & Timing (research only: no repo edits, no deploys). For the coding project. This complements the implementation team's own trace (selection, then stored take, then loop duration, then replay) and does not replace it.

> **Status.** Haris's last-chord bug is **not resolved by this research**. His MIDI was not available. Every result below is from SYNTHETIC fixtures with provisional labels.
>
> **Baseline (revised 8 Nov 2026, ~20:00 London).** Current main for this review is **3412f61** "Treat overlapping notes as one chord" (19:50). Results are labelled **per commit**. fdba348 and 497894e rows are historical comparisons, **not** current main. The former "holdout" (PH01-15) has influenced design discussion and is now called the **regression/development set**. A new **independent validation set** (V01-13, new generator, seed 20261108) was frozen at 19:57:01 GMT before any predictor ran (see §6 and `fixtures/phrase/data-validation/FREEZE.txt`).

## 0. Recommendation (concrete)

1. **Stop choosing the range from gaps alone.**
   - Choose it as a joint fit of tempo, phase and range against **onset groups**. One group is any set of near-simultaneous attacks: a chord, a roll, a bass note or a melody note. A single note is just a group of size 1.
   - Walk backwards bar by bar from an END anchor at the capture press. Stop when the beat grid stops explaining the playing.
   - Default to the largest of 1, 2, 4 or 8 bars that fits, with a mild 4-bar preference. Never force it.
2. **Group onsets by attack, with sounding overlap as a necessary but never sufficient cue. Don't just widen thresholds.** (Revised candidate; see §6.4.)
   - Note *j* joins the open group only if **all** hold: (a) its attack follows the previous attack by ≤ min(ABS_MAX, REL × the shorter of the IOIs that bound the would-be group), i.e. the attacks are tight *relative to the local IOI context*; (b) the previous note is still sounding (key down or CC64) at *j*'s attack; (c) the group would not become a **monotonic stepwise line** (≥ 3 notes, one direction, every step ≤ 2 semitones).
   - Raw times and role-independence are kept. The group is an analysis object only; nothing is moved.
   - ABS_MAX = 130 ms and REL = 0.4 are **UNVALIDATED proposals**, chosen a priori, not fitted. The earlier "130 ms step / 400 ms spread" proposal is **superseded and UNVALIDATED**.
   - Why not overlap alone: 3412f61's `overlapStacks` (L157-206) joins any attack while something is still sounding. Under a held pedal, legato lines and scalar runs become **one stack** (V05: 32 notes → 1 stack; post-freeze diagnostic D01: noodling + progression under one pedal → 1 stack of 28). See §6.3.
   - The 40 ms `CHORD_MS` (recent-phrase.ts L48 at fdba348, 497894e and 3412f61) splits rolls with 60-120 ms between notes when nothing overlaps.
3. **Score END-anchor candidates, then keep the best plus 2-3 alternatives.** There are two anchor kinds:
   - the last attack read as the **next downbeat** (the loop ends at that attack, and the attack is kept as a tail);
   - the end of the last sounding notes, on the beat grid.
   The alternatives are the 2-bar and 8-bar readings, half/double tempo, and free time. **Candidate alternatives carry no new UI commitment**: they are internal ranked candidates. Whether and how any is exposed is a separate product decision.
4. **Abstain to free time when the fit is poor.** The free-time window starts at the strongest recent boundary (a sounding silence, or a change in spacing or register) and ends at the last sounding note. The 3-20 s bound is an **UNVALIDATED proposal**. Give reasons, not percentages.
   - **Correctness is conditional.** A whole-session or single-event selection is wrong **only when** earlier unrelated material, or a longer intended phrase, exists. When the whole session *is* the phrase (V02, V03) or a single note *is* the take (V01), selecting it is correct.
5. **Keep three things separate:**
   - **(a) nominal loop period:** bars × beat period;
   - **(b) selection coverage:** which raw notes are included, e.g. a pickup before bar 1 or a late attack just after the downbeat;
   - **(c) tails and the seam:** notes sounding past the loop end, and how the loop wraps.
   Raw note times are never moved. Quantise is explicit opt-in, derived and reversible. Tail crossfade and pickup wrapping are **STAGED** and not implemented anywhere today.
6. **Never treat a *proposed* tempo as a locked bar grid** when cutting. Since 497894e (and unchanged at 3412f61) App does this via `beatForCut` (project.ts L66-71; App.tsx L19, L221), which agrees with my root-cause finding. Keep it, and add a regression test for it.

## 1. Root cause evidence (read-only, via the GitHub API; blob hashes verified)

| Commit (London time) | Path | Lines | What happens on "4 chords after improvising" |
|---|---|---|---|
| **fdba348** "Keep a four-chord progression as one phrase" (19:31) | `src/ui/App.tsx` | L223, L226 | `tempoForCut = gridLocked ? tempoBpm : proposedTempoBpm` passes a proposed tempo as `gridPeriodTicks`. L249-250 sets a proposed tempo after a "recent" capture and saves the project. Whether reload restores it was **not verified**. |
| fdba348 | `src/domain/recent-phrase.ts` | L348-364 | With a beat and no break, the cut becomes "the last bar of the locked grid", measured back from `last` (the last event) with origin = the first event. That is usually **the final chord only**. Regression/development set, fdba348: 14/15 FINAL_TRAP when a tempo is passed. |
| fdba348 | `recent-phrase.ts` | L333-337 | With no tempo and no break, the selection is the whole ribbon (fdba348: 13/15 WHOLE_TRAP on the regression/development set). |
| fdba348 | `recent-phrase.ts` | L80-125, L134-147 | `silenceBeforeNext` only looks at the keys of the previous 40 ms cluster. With no release inside the gap (legato overlap), it returns the **attack gap** (L124-125). `isPhraseBreak` needs > 1.5 s and > 2.5 × the median of the *other* gaps. After noodling the median is small, so a long chord can become a break, and the last break wins (L339-347). |
| **497894e** "Keep a four-chord run after an improvisation" (19:43) | `src/ui/App.tsx` L221 and `project.ts` | | `beatForCut(project)`: a proposed tempo is not a beat until accepted. **This removes the L348-364 trap for first layers.** |
| 497894e | `recent-phrase.ts` | L48, L157-172, L353-375 | New **chord-run special case**: the trailing clusters with `count >= 2` (40 ms clustering) form a run, and if there are ≥ 3 of them the run is selected. It depends on 40 ms grouping and on multi-note clusters. Rolls of 60-120 ms between notes, a bass line, a melody, two chords or a postlude fall through to the old gap/whole-ribbon logic (497894e on the regression/development set: 9 WHOLE_TRAP and 3 FINAL_TRAP of 15). |
| 497894e retest report (`/workspace/blocks-handover/evidence/implementation-report-497894e-rolled-chord-retest.md`, now readable) | | | Reported: tight attacks after improvisation are kept; rolls of 60-120 ms keep only F/G or the whole prefix. **Reproduced** by executing 497894e's `recentPhraseCut` on my reconstruction of their history (`fixtures/phrase/verify-retest-3412f61.mjs`): 800-17380 (whole) or 12800/14850-173x0 ms (6/12 chord notes). Scheduler claims not verified. |
| **3412f61** "Treat overlapping notes as one chord" (19:50) = **current main** | compare 497894e→3412f61: only `src/domain/recent-phrase.ts` (+81/−2) and `four-chord.synthetic.test.ts` (+41). App.tsx and project.ts blobs identical. | L157-206 `overlapStacks` (L158 def, L197 new-stack test); L405-421; L438-446 | A new stack starts only when **no note is alive** (L197); notes stay alive while held or while released under CC64. If the trailing run of stacks with `count ≥ 2` has ≥ 3 stacks (L411), the cut is the last `isPhraseBreak` among their sounding gaps (L417-421) and selection = that stack → last (L438-440). Otherwise the 497894e chord-run and older paths run unchanged. Fixes rolls whose notes overlap (PH13, PH15, and the report's 18-row matrix, which I reproduced exactly). Risks: legato/pedalled material collapses into one stack and falls back to old logic; overlapping trailing noodle notes join the run (PT01 2/26, PT03 5/22, PH02 6/44 noodle notes included); PH11 rubato now WHOLE_TRAP (20/20). |

Haris's exact last-G failure is still **unexplained**. Candidate mechanisms that fit the code are the roll split, legato attack gaps, a locked or persisted grid, and the last-bar fallback. These are hypotheses until the implementation team replays his real event log.

## 2. Pipeline (pseudocode)

```
input: raw events (immutable), pressTime, lockedGrid? (from accepted project clock only)
groups = adaptiveOnsetGroups(notes)              # role-agnostic; group weight = 1, accent = long sounding duration (not note count)
sounding = keyDown OR CC64-held                  # for boundaries & tail, never for moving notes
recent = groups within 40 s of press
tempi  = lockedGrid ? [lockedGrid.beat] : IOIhistogram(recent last 18 s, pairs ≤ 6 s, folded by 1/8..4) top 14   # Dixon-style idea, own code
for T in tempi:
  for E in endAnchors(T):                        # last attack as next downbeat (tail) | end of sounding on beat grid | locked bar line
    bars = walkBack(E, T): per bar choose small local phase shift (±5% of bar; slow drift),
           robust fit = mean over groups of max_level(w_level · (1 − (r/σ)²)₊), σ = 40 ms + 5% T, levels beat/half/quarter
           bar ok if fit ≥ 0.6 and ≤ 25% groups off-grid; ≤1 empty bar allowed unless notes are sounding
           stop at first bad bar  → run length
    for N in {1,2,4,8} ≤ run: score = fit − 0.6·offgrid + 0.3·downbeatSupport + startOnsetBonus + endAnchorBonus
                                      + 0.15·repetition(half vs half) + 0.25·[N is the largest power of two ≤ run]
                                      + barPrior(N; 4 bars +0.08) − tempoPrior(|log2(bpm/110)|) ; min content: ≥3 groups and ≥2 s
best = argmax; alternatives = next 3 distinct (start,end)
if best.fit < 0.6 → FREE TIME: window from strongest recent boundary (sounding silence + IOI ratio change + register jump), 3–20 s
output: { period (a), coverage incl. pickups (b), tails at E (c), alternatives, reasons[] }
```

## 3. Interfaces (TypeScript)

```ts
interface OnsetGroup { id: string; t: bigint; noteIds: string[]; soundEnd: bigint; accent: 1 | 1.5 }
interface LoopPeriod { start: bigint; end: bigint; bars: 1 | 2 | 4 | 8; beatTicks: bigint; phaseDrift: number; tempoReading: "proposed" | "locked" } // (a)
interface Coverage { from: bigint; to: bigint; includedNoteIds: string[]; pickupNoteIds: string[]; lateAttackNoteIds: string[] }      // (b)
interface SeamPlan { tailNoteIds: string[]; policy: "play-tail-past-seam" /* M0 */ | "crossfade" /* STAGED */ | "wrap-pickup" /* STAGED */ } // (c)
interface CaptureCandidate { mode: "proposed-grid" | "locked-grid" | "free"; period: LoopPeriod | null; coverage: Coverage; seam: SeamPlan; reasons: string[] }
interface CaptureChoice { best: CaptureCandidate; alternatives: CaptureCandidate[] /* 2–3 */; rawUnchanged: true }
```

## 4. Parameters (unvalidated starting values)

| Name | Value | Rationale |
|---|---|---|
| onset grouping | **Candidate** attack-onset rule (§0.2): ABS_MAX 130 ms, REL 0.4 — **UNVALIDATED**. Former 130 ms step / 400 ms spread — **superseded, UNVALIDATED**. Frozen reference: 70 / 160 ms. | Attack tightness relative to local IOIs + sounding overlap + not a monotonic stepwise line. Not a widened window. |
| σ | 40 ms + 5% of the beat | Tolerates expressive early or late playing. The bounded residual means one wild note costs at most 1 (robust). |
| per-bar phase shift | ±5% of a bar | Slow tempo drift. Raw times are untouched. |
| min content | ≥ 3 groups and ≥ 2 s — **UNVALIDATED** | Role-agnostic. Replaces "≥ 2 harmonic events". Must not reject a legitimately short complete take (V01-V03): below the minimum, select the whole recent take when nothing unrelated precedes it. |
| bar prior | 4 bars +0.08, 1 bar −0.2, 2 bars −0.06, 8 bars −0.04 | Haris's observed 4-bar experience is a *preference*, not a rule. |
| tempo prior | 0.12·\|log2(bpm/110)\|, −0.3 outside 60-180 | Ableton documents 80-160 BPM for new-Set detection. We use a soft prior, not a clamp. |
| free-time window | 3-20 s — **UNVALIDATED** | A single group or the whole session is wrong only when earlier unrelated material or a longer intended phrase exists. |

## 5. Acceptance examples (synthetic; regression/development set, `fixtures/phrase/data/holdout`)

| Fixture | Expected default (seconds, fixture time) | Alternatives |
|---|---|---|
| PH01 uneven 6+2+4+4 after 22 s noodling, plays the next downbeat | 4 bars, 23.37-33.81 s; the final Dm7 is a tail | 2 or 8 bars |
| PH02 2+2+3+1 twice (8 chords = 4 bars), final chord held through the press | 4 bars, 16.79-25.52 s | 2 bars (one cycle), 8 bars |
| PH04 1-beat melody pickup | period 12.35-20.35 s; the pickup is in **coverage**, not the period | 2 or 8 bars |
| PH06 locked grid, syncopated bass starting off the beat | 4 bars on the locked bar lines, 7.86-17.86 s | 2 bars |
| PH11 free rubato ballad | free time covering all 4 chords | 4-bar grid reading |
| PH13-15 rolls with 60-120 ms between notes (no pedal / pedal / locked grid) | 4 bars, and all chords covered | 2 or 8 bars |

## 6. Results, per commit (SYNTHETIC; provisional labels; not Haris's MIDI)

Coverage categories (revised to be conditional): GOOD = ≥ 90 % of intended-phrase groups and ≤ 1 unrelated earlier group; FINAL_TRAP = ≤ 25 % of a *longer* (≥ 3-group) intended phrase; WHOLE_TRAP = > 50 % of *unrelated earlier* material. A single-event or whole-session selection scores GOOD when that **is** the intended take. Each Blocks commit is called as its App calls it: fdba348 free/with tempo; 497894e and 3412f61 via `beatForCut` (a tempo only when the fixture has a locked grid).

### 6.1 Regression/development set (PH01-15; formerly "holdout", no longer fresh) — `phrase-results-regression.{txt,json}`

| Predictor | GOOD | PARTIAL | FINAL_TRAP | WHOLE_TRAP |
|---|---|---|---|---|
| fdba348, free time (historical) | 0 | 1 | 1 | 13 |
| fdba348, tempo passed (historical) | 0 | 1 | 14 | 0 |
| 497894e, as App calls it (historical) | 2 | 1 | 3 | 9 |
| **3412f61, as App calls it (current main)** | **4** | **3** | **1** | **7** |
| Reference, 70/160 ms grouping | 7 | 8 | 0 | 0 |
| Reference + candidate attack-onset grouping | 7 | 8 | 0 | 0 |

3412f61 vs 497894e: better on PH04, PH13, PH15 (→ GOOD), PH14 (→ PARTIAL, 3/32 noodle notes); worse on PH02 (GOOD → PARTIAL, 6/44 noodle notes join the overlap run) and PH11 (FINAL_TRAP → WHOLE_TRAP, 20/20). Still WHOLE_TRAP: PH03, PH05, PH07, PH08, PH09, PH12 (bass/melody/arpeggio/motif material falls to the old logic); PH06 locked-grid bass still FINAL_TRAP. Tuning set (PT01-06, in-sample for the reference): 3412f61 1/4/0/1 vs 497894e 3/2/0/1 (PT01, PT03 lose GOOD because 2 and 5 trailing noodle notes overlap into the run).

Candidate grouping inside the reference: coverage unchanged, but the roll cases now get a beat instead of abstaining (period DEFAULT 6/15 vs 3/15; PH13-15 all GOOD and DEFAULT). PH11 changes from a wrong 8-bar GOOD to a wrong 4-bar PARTIAL; neither abstains as it should.

### 6.2 Independent validation set (V01-13) — frozen 19:57:01 GMT 8 Nov 2026, sha256 `c06e8caa9a758d16051dca501dbf5a3928738300c6bb7290242ecaa25554d0d3`; scored once; not tuned on — `phrase-results-validation.{txt,json}`

| Case | What it tests | 3412f61 (current main) | Reference |
|---|---|---|---|
| V01 single long bass note = whole take | single event is correct | GOOD | PARTIAL (abstains, no period) |
| V02 3-note motif, nothing else | whole session is the phrase | GOOD | GOOD (1 bar, DEFAULT) |
| V03 2-chord, 2-bar session, nothing else | whole session is the phrase | GOOD | PARTIAL (abstains, no period) |
| V04 legato melody after noodling | legato voices | PARTIAL | GOOD (4 bars, DEFAULT) |
| V05 16th scalar runs, pedal held throughout | pedal-connected run | FINAL_TRAP | GOOD (free, acceptable) |
| V06 syncopated bass after noodling | bass | WHOLE_TRAP | PARTIAL (2 bars, wrong tempo) |
| V07 melody with pickup | pickup | WHOLE_TRAP | GOOD (4 bars, DEFAULT) |
| V08 mixed hands | mixed | GOOD | PARTIAL (2 bars) |
| V09 strong-rubato chords | rubato / free | PARTIAL | PARTIAL (no abstention) |
| V10 noodling → pedalled progression | noodle → progression | GOOD | GOOD (4 bars, DEFAULT) |
| V11 two 2-bar chords after noodling | few events | GOOD | PARTIAL (wrong tempo) |
| V12 progression + one postlude note | postlude hides run | WHOLE_TRAP | PARTIAL (wrong tempo) |
| V13 sparse melody after noodling | sparse melody | PARTIAL | GOOD (4 bars, DEFAULT) |
| **Total** | | **6 GOOD / 3 PARTIAL / 1 FINAL / 3 WHOLE** | **6 GOOD / 7 PARTIAL / 0 / 0** |

Historical, same frozen set: 497894e 5/2/2/4; fdba348 free 3/2/2/6. Reference + candidate grouping: identical coverage to the reference (6/7/0/0). Neither predictor is ready: the reference avoids traps but is PARTIAL on 7/13, including the two short complete takes it should simply return (a real defect of its ≥ 3 groups / ≥ 2 s minimum, which is UNVALIDATED).

Generator defect, found after freezing and **not fixed in the frozen set**: V10's title says the pedal is held through the noodling, but the generator only presses CC64 at the progression. A post-freeze **diagnostic** D01 (V10 with CC64 moved to 0.75 s) is kept separately in `data-validation/diagnostic-post-freeze/` and is not part of any score.

### 6.3 Legato / run collapse check — `grouping-results.{txt,json}`, `fixtures/phrase/grouping-check.mjs`

Truth groups come from the generators. Columns: groups produced, truth groups recovered exactly, produced groups that merge ≥ 2 truth groups (largest merge).

| Fixture | Truth | 3412f61 `overlapStacks` | Reference 70/160 ms | Candidate attack-onset |
|---|---|---|---|---|
| V04 legato melody | 30 | 14 groups, 8 exact, 6 merged (max 8) | 30, 30 exact | 29, 28 exact, 1 merged (2 noodle notes) |
| V05 pedalled scalar runs | 32 | **1 group (all 32 merged)** | 32, 32 exact | 32, 32 exact |
| PH10 continuous scalar runs | 32 | 31, 1 merged (2) | 32 exact | 32 exact |
| D01 pedal through noodle + progression (diagnostic) | 28 | **1 group (all 28 merged)** | 28 exact | 24, 21 exact, 3 merged (noodle only) |
| PH13-15 rolls 60-120 ms | 42/36/19 | 14/20/13 exact; 8/5/2 merged | splits 4 rolls each | all exact |
| All 29 fixtures | 993 | 475 exact, 181 merged | 971 exact, 14 split | 969 exact, 11 merged (7 noodle-only; 4 in PH04, the same 4 the reference merges) |

Yes: 3412f61 collapses pedal-connected runs and pedal-through-session material into a single stack. Its selection then falls back to the older paths (V05 FINAL_TRAP; D01 happens to score GOOD via the 497894e chord-run path), so the collapse does not show in selection on every case, but `overlapStacks` cannot be the grouping primitive for timing or seam work.

### 6.4 Revised candidate assessment

- **Keep** raw timing, immutable events and role-independent onset groups.
- **Group by attack first.** Sounding overlap is necessary, never sufficient. Tightness is measured against the local IOI context. Monotonic stepwise lines are never one group. This is not a widened window: on fast pedalled 16ths (156 ms IOI) the window shrinks to ≤ 62 ms.
- Evidence: on 993 truth groups it recovers 969 exactly and splits none. Inside the reference it fixes the roll abstentions on the regression set. On the frozen validation set it changes **no** coverage outcome, so it is necessary but does not fix range selection on its own.
- **UNVALIDATED:** ABS_MAX 130 ms, REL 0.4, the former 130/400 ms proposal, the ≥ 3 groups / ≥ 2 s minimum, the free-time 3-20 s bound, σ, priors.
- **Conditional correctness:** a whole-session or single-event selection is wrong only when earlier unrelated material or a longer intended phrase exists.
- **Candidate alternatives carry no new UI commitment.**
- Known gaps: short complete takes (V01, V03) are PARTIAL in the reference; tempo errors on bass/mixed/few-event material (V06, V08, V11, V12); no free-time abstention on rubato (V09, PH11).

## 7. Test list (port into vitest with synthetic data; never claim it's Haris's take)

1. Proposed tempo is never a grid for the cut (regression for fdba348 L223/L348).
2. Rolls with 60-120 ms between notes form one group, with and without pedal and grid; legato lines and pedalled scalar runs do **not** collapse into one group (V04, V05, D01).
3. An uneven 6+2+4+4 and a 2+2+3+1 ×2 progression after ≥ 15 s noodling with a < 1.5 s rest select all chords and no noodling.
4. A final next-downbeat is a tail, not inside the period; notes are not moved.
5. A held final chord at the press is covered, with no invented note-off.
6. A pickup is covered, outside the period.
7. A locked grid gives the period on bar lines; off-beat starts are still covered.
8. After earlier unrelated material, bass, legato melody, sparse melody, arpeggios, a repeated motif and scalar runs select neither a single group (when the intended phrase is longer) nor the earlier material. When the whole session is the phrase (V02, V03) or a single note is the take (V01), selecting it is correct.
9. Free rubato abstains to free time with reasons (3-20 s bound UNVALIDATED).
10. Raw checksum is unchanged after capture.
11. Alternatives include the 2-bar and 8-bar readings and half/double tempo where they fit.
12. Cost: one capture on a 4096-event ribbon is O(tempi × anchors × 8 bars × groups per bar). The reference runs in milliseconds in Node on these fixtures. On-device latency was not measured.
