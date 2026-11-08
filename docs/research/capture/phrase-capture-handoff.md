# Phrase capture handoff: pulse-first, end-anchored range selection (research proposal, 8 Nov 2026)

From Blocks · Capture & Timing (research only: no repo edits, no deploys). For the coding project. This complements the implementation team's own trace (selection, then stored take, then loop duration, then replay) and does not replace it.

> **Status.** Haris's last-chord bug is **not resolved by this research**. His MIDI was not available. Every result below is from SYNTHETIC fixtures with provisional labels.

## 0. Recommendation (concrete)

1. **Stop choosing the range from gaps alone.**
   - Choose it as a joint fit of tempo, phase and range against **onset groups**. One group is any set of near-simultaneous attacks: a chord, a roll, a bass note or a melody note. A single note is just a group of size 1.
   - Walk backwards bar by bar from an END anchor at the capture press. Stop when the beat grid stops explaining the playing.
   - Default to the largest of 1, 2, 4 or 8 bars that fits, with a mild 4-bar preference. Never force it.
2. **Group onsets adaptively, not with a fixed 40 ms.**
   - A note joins a group while the step from the previous note is up to about 130 ms, the total spread is up to about 400 ms, and the earlier keys in the group are still down. Pitch-monotone order is a supporting cue.
   - The 40 ms `CHORD_MS` (recent-phrase.ts L48 at fdba348 and 497894e) splits rolls with 60-120 ms between notes into singletons.
3. **Score END-anchor candidates, then keep the best plus 2-3 alternatives.** There are two anchor kinds:
   - the last attack read as the **next downbeat** (the loop ends at that attack, and the attack is kept as a tail);
   - the end of the last sounding notes, on the beat grid.
   The alternatives are the 2-bar and 8-bar readings, half/double tempo, and free time. Ship the alternatives as the existing range handles and "Prior phrase" buttons. **No new UI.**
4. **Abstain to free time when the fit is poor.** The free-time window starts at the strongest recent boundary (a sounding silence, or a change in spacing or register) and ends at the last sounding note. It is bounded to 3-20 s. It is never a single group and never the whole session. Give reasons, not percentages.
5. **Keep three things separate:**
   - **(a) nominal loop period:** bars × beat period;
   - **(b) selection coverage:** which raw notes are included, e.g. a pickup before bar 1 or a late attack just after the downbeat;
   - **(c) tails and the seam:** notes sounding past the loop end, and how the loop wraps.
   Raw note times are never moved. Quantise is explicit opt-in, derived and reversible. Tail crossfade and pickup wrapping are **STAGED** and not implemented anywhere today.
6. **Never treat a *proposed* tempo as a locked bar grid** when cutting. 497894e now does this via `beatForCut`, which agrees with my root-cause finding. Keep it, and add a regression test for it.

## 1. Root cause evidence (read-only, via the GitHub API; blob hashes verified)

| Commit (London time) | Path | Lines | What happens on "4 chords after improvising" |
|---|---|---|---|
| **fdba348** "Keep a four-chord progression as one phrase" (19:31) | `src/ui/App.tsx` | L223, L226 | `tempoForCut = gridLocked ? tempoBpm : proposedTempoBpm` passes a proposed tempo as `gridPeriodTicks`. L249-250 sets a proposed tempo after a "recent" capture and saves the project. Whether reload restores it was **not verified**. |
| fdba348 | `src/domain/recent-phrase.ts` | L348-364 | With a beat and no break, the cut becomes "the last bar of the locked grid", measured back from `last` (the last event) with origin = the first event. That is usually **the final chord only**. Synthetic holdout: 14/15 FINAL_TRAP when a tempo is passed. |
| fdba348 | `recent-phrase.ts` | L333-337 | With no tempo and no break, the selection is the whole ribbon (13/15 WHOLE_TRAP). |
| fdba348 | `recent-phrase.ts` | L80-125, L134-147 | `silenceBeforeNext` only looks at the keys of the previous 40 ms cluster. With no release inside the gap (legato overlap), it returns the **attack gap** (L124-125). `isPhraseBreak` needs > 1.5 s and > 2.5 × the median of the *other* gaps. After noodling the median is small, so a long chord can become a break, and the last break wins (L339-347). |
| **497894e** "Keep a four-chord run after an improvisation" (19:43) | `src/ui/App.tsx` L221 and `project.ts` | | `beatForCut(project)`: a proposed tempo is not a beat until accepted. **This removes the L348-364 trap for first layers.** |
| 497894e | `recent-phrase.ts` | L48, L157-172, L353-375 | New **chord-run special case**: the trailing clusters with `count >= 2` (40 ms clustering) form a run, and if there are ≥ 3 of them the run is selected. It depends on 40 ms grouping and on multi-note clusters. Rolls of 60-120 ms between notes, a bass line, a melody, two chords or a postlude fall through to the old gap/whole-ribbon logic (synthetic holdout: 9 WHOLE_TRAP and 3 FINAL_TRAP of 15). |
| 497894e (retest report from Daw Bot, **not readable by me**; see `checkpoints/`) | | | Reported: tight attacks after improvisation are kept; rolls of 60-120 ms keep only F/G or the whole prefix; not the user's exact last-G failure; the scheduler plays all stored notes, so the loss is at stored-range selection. My synthetic PH13-15 agree on the roll behaviour: WHOLE_TRAP without a grid, FINAL_TRAP with the locked grid. |

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
| group step / total spread | 130 ms / 400 ms (**recommended**). The frozen reference used 70 / 160 ms. | Covers rolls with 60-120 ms between notes. "Earlier keys still down" stops a fast run becoming one "chord". |
| σ | 40 ms + 5% of the beat | Tolerates expressive early or late playing. The bounded residual means one wild note costs at most 1 (robust). |
| per-bar phase shift | ±5% of a bar | Slow tempo drift. Raw times are untouched. |
| min content | ≥ 3 groups and ≥ 2 s | Role-agnostic. Replaces "≥ 2 harmonic events". |
| bar prior | 4 bars +0.08, 1 bar −0.2, 2 bars −0.06, 8 bars −0.04 | Haris's observed 4-bar experience is a *preference*, not a rule. |
| tempo prior | 0.12·\|log2(bpm/110)\|, −0.3 outside 60-180 | Ableton documents 80-160 BPM for new-Set detection. We use a soft prior, not a clamp. |
| free-time window | 3-20 s | Never one group, never the whole session. |

## 5. Acceptance examples (synthetic; `fixtures/phrase/data/holdout`)

| Fixture | Expected default (seconds, fixture time) | Alternatives |
|---|---|---|
| PH01 uneven 6+2+4+4 after 22 s noodling, plays the next downbeat | 4 bars, 23.37-33.81 s; the final Dm7 is a tail | 2 or 8 bars |
| PH02 2+2+3+1 twice (8 chords = 4 bars), final chord held through the press | 4 bars, 16.79-25.52 s | 2 bars (one cycle), 8 bars |
| PH04 1-beat melody pickup | period 12.35-20.35 s; the pickup is in **coverage**, not the period | 2 or 8 bars |
| PH06 locked grid, syncopated bass starting off the beat | 4 bars on the locked bar lines, 7.86-17.86 s | 2 bars |
| PH11 free rubato ballad | free time covering all 4 chords | 4-bar grid reading |
| PH13-15 rolls with 60-120 ms between notes (no pedal / pedal / locked grid) | 4 bars, and all chords covered | 2 or 8 bars |

## 6. Results (holdout, 15 fixtures; tuning is in `phrase-results.txt`)

| Predictor | GOOD coverage | PARTIAL | FINAL_TRAP | WHOLE_TRAP |
|---|---|---|---|---|
| Reference (this proposal; frozen before holdout) | 7 | 8 | **0** | **0** |
| main-fdba348, free time | 0 | 1 | 1 | 13 |
| main-fdba348, tempo passed (proposed or locked) | 0 | 1 | 14 | 0 |
| main-497894e, as App calls it | 2 | 1 | 3 | 9 |

Reference loop period: correct default 3/15 and acceptable alternative 2/15. Three cases abstained to free time; PH13 and PH15 still got GOOD coverage that way. Its weaknesses, honestly:
- half/double errors on legato or sparse material (PH03 158 vs 80 BPM, PH07 175 vs 88);
- short windows on dense or arpeggiated material (PH08, PH09);
- no abstention on the rubato ballad (PH11);
- splitting 60-120 ms rolls, because it uses the old 160 ms total spread. That's the next fix.

It is **not ready to ship as-is**. It shows that the structure avoids both traps.

## 7. Test list (port into vitest with synthetic data; never claim it's Haris's take)

1. Proposed tempo is never a grid for the cut (regression for fdba348 L223/L348).
2. Rolls with 60-120 ms between notes form one group, with and without pedal and grid.
3. An uneven 6+2+4+4 and a 2+2+3+1 ×2 progression after ≥ 15 s noodling with a < 1.5 s rest select all chords and no noodling.
4. A final next-downbeat is a tail, not inside the period; notes are not moved.
5. A held final chord at the press is covered, with no invented note-off.
6. A pickup is covered, outside the period.
7. A locked grid gives the period on bar lines; off-beat starts are still covered.
8. Bass, legato melody, sparse melody, arpeggios, a repeated motif and scalar runs never select a single group or the whole session.
9. Free rubato abstains to free time, bounded to 3-20 s, with reasons.
10. Raw checksum is unchanged after capture.
11. Alternatives include the 2-bar and 8-bar readings and half/double tempo where they fit.
12. Cost: one capture on a 4096-event ribbon is O(tempi × anchors × 8 bars × groups per bar). The reference runs in milliseconds in Node on these fixtures. On-device latency was not measured.
