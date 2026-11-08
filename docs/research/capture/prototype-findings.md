# Prototype findings: what Capture does today, and where to change it

> **Staleness notice (8 Nov 2026, 17:0x London).** §1-§4 were written against `f62b2a5`. Since then `main` moved to **`534279f`** (2f26897 "Cut a recent phrase, release stuck notes…" at 17:02 London, then 534279f at 17:03 London). §5 records my own read-only re-check at `534279f`. The **implementation project is re-verifying these findings independently**, so treat §1-§4 as historical and §5 as my reading, not as verified status.

Read-only review, 8 Nov 2026. Repo `harisjibjabjabber/Blocks` cloned at `main` = `f62b2a5` (committed 2026-11-08 16:29 UTC, 16:29 Europe/London). I made no edits, pushes or PRs.
The live site https://harisjibjabjabber.github.io/Blocks/ serves `assets/index-Ck4Rr643.js` (Last-Modified 16:30 GMT). That bundle contains the same capture strings as this commit (`"One reading, not a set of candidates"`, `"Nothing to capture yet"`, `"The ribbon keeps about 120 seconds"`, `"joins at the next loop boundary"`, `"Refusing to mix"`). That's a string match, not a byte-for-byte build check.

## 1. What happens today when you press Capture (web and native share this TS path)

| # | Where | What it does | Why it fails the intent |
|---|---|---|---|
| P1 | `src/ui/App.tsx` `capture()` L201-232: `const events = history.snapshot()` | It takes every event in the ribbon. | The ribbon is up to 120 s, 4096 events or 256 KiB (`App.tsx` L59, `EVENT_CAP`/`BYTE_CAP` L26-27), so the capture is "the whole session so far", not the phrase. |
| P2 | `src/domain/phrase.ts` `defaultOverlay()` L28 | `selectionStart = events[0]`, `selectionEnd = events[last]` | This sets the selection to the entire history. It's the main cause of the reported bug. |
| P3 | `src/domain/inference.ts` `inferPulse()` L83, L121-140 | Splits onsets at gaps > max(4× median IOI, 2 s), then uses `segments[0]` (the oldest segment). With a false start it uses the longest segment. Onsets only; pedal and held notes are ignored. | Tempo is read from the oldest material, not the phrase you want. A sounding rest under the pedal counts as a gap. |
| P4 | `App.tsx` L215 `history.clear()` | Empties the ribbon after every capture. | You can't do "capture previous" or "capture again with a different range". The next capture is "everything since the last capture", which includes all the experimenting before a bass riff. |
| P5 | `src/domain/project.ts` `proposeGrid()` L59-68 | The first non-null BPM, rounded to an integer and clamped to 40-240, becomes `gridLocked: true` straight away. | The tempo is accepted silently, with no confidence or ambiguity shown. Later captures never use the grid to choose a range. |
| P6 | `App.tsx` `playTake()` L158-187 | Loop length = time from the first selected event to the last (`span`, L168), clamped to 0.4-120 s, restarted by `setTimeout` (L173). | The loop isn't bar-based. The seam lands on the last event, usually a note-off or CC. Restarting on a UI timer drifts against the audio clock. |
| P7 | `src/adapters/engine.web.ts` `replay()` L214-215 calls `stopReplay()` first; `App.tsx` L227 `pending.current = created` | A new capture replaces the playing loop at the next boundary. | Layers never play together, so the piano → bass → drums journey can't happen yet. |
| P8 | `phrase.ts` `deriveSchedule()` L65 and `App.tsx` L159 | Selection filters events by time, not by notes. | A note-on inside the range whose note-off falls outside becomes a stuck or truncated note, and a note-off without its note-on is an orphan. Pedal, bend and mod values from before the range are lost, because there's no initial state. |
| P9 | `phrase.ts` `loopShorter/loopLonger/nudgeBoundary` L118-160 | Moves the end by ±4 beats or the start by 1 beat. `loopLonger` won't go past the last event. | These are useful seeds for range correction, but they work on the whole-history selection and only within the frozen take. |
| P10 | `App.tsx` L94-96 | Every MIDI event calls `history.snapshot()`, copying the whole ribbon (up to 4096 objects) into React state. `RollingHistory.push` also runs `findIndex` and `filter` over the array, and `rawBytes()` reduces over it on every trim. | This is a likely main-thread cost during dense playing. I haven't measured it, so treat it as a risk, not a finding. |

What's already right and should be kept: the raw events are frozen (`capturePerformance`, `Object.freeze`), there's a per-domain clock with a mixing guard (`RollingHistory.push` throws), sequence tie-breaks, origins that mark synthetic events, quantise defaults to 0 and only changes a derived copy, half/double is an overlay, and undo restores the ribbon.

## 2. Minimal M0 fix (smallest change that captures the recent phrase, not the whole history)

The aim is to change selection only. Keep the stored take (`capturePerformance`) and replay, because the raw data is already safe.

1. **Add a pure function** `src/domain/select.ts` → `selectRecent(events, captureAt, opts): Selection` (contract in `capture-spec.md` §4.3, M0 subset):
   - Pair notes per `(sourceId, portId, channel, pitch)` with **retrigger**, the policy both engines use (§6). Repeated note-ons close the earlier note, and a note-on with velocity 0 counts as a note-off. Flag `CROSS_STREAM_SAME_KEY` where playback would merge streams.
   - Sound-off follows CC64 (≥64 means down) and CC66 (latches only the notes held when it goes down).
   - Find the latest true silence ≥ `gap` before the last sounding material. `gap = max(1.5 s, 2 beats if a project grid exists)` is a starting parameter that hasn't been validated.
   - The phrase runs from the first onset after that silence to the last sound-off, or to `captureAt` if notes or the pedal are still held. Those notes are marked open and never closed with an invented note-off.
   - **Bounded:** if there's no silence within `maxLookback` (proposal: 30 s free, 16 bars with a grid), or the cluster reaches the ribbon's oldest event, the function doesn't expand outward. It falls back to the latest onset gap ≥ 1 s (a sounding rest). Failing that, it returns a bounded fallback with `reason: "BOUNDED_FALLBACK"`, which the UI shows as "No clear phrase start: showing the last N bars or seconds, adjust?"
   - It returns the alternatives too: the previous silence boundary, the sounding-rest boundary, and with a grid, half, double and previous same-length ranges.
2. **In `App.tsx capture()`**, replace `defaultOverlay(events)` with an overlay built from `selectRecent(...)` (`selectionStart/End` = the chosen range). Run `inferPulse` on the selected events only.
3. **Don't call `history.clear()`** (L215). Keep the ribbon and add a `capturedRanges` marker, so "capture previous" and "capture again" work and later layers can see the experimenting. Undo then only removes the take.
4. **Freeze the selected raw interval into the take** with its start state (D5, D8), and **build replay from notes in range plus an initial state**: notes whose onset is in range, with their real ends, or open notes played by the explicit derived rule `hold-to-seam-then-release` (later real releases stay in raw history; adoption is staged for M2), plus the last CC64/66/1/11, bend and pressure values before the start, emitted as derived state at loop start. Never add notes from before the range.
5. **Make the loop length the selection range** (or the bar range when there's a grid), not the event span. Schedule the restart on the audio clock (`AudioContext` time) rather than `setTimeout`, so the seam stays put.
6. **Don't auto-lock the grid** (`proposeGrid`). Store `proposed` with the reading and lock it when the user accepts, or implicitly when they **capture the second layer** (D1; shown and undoable). Switching instrument alone doesn't accept it.

The reference implementation of this rule is `fixtures/evaluate.mjs` → `m0Predict()` (about 90 lines, research-only, unoptimised). On the TUNING fixtures it gets 19/22 default selections (in-sample: its parameters were tuned there), against 6/22 for the f62b2a5 behaviour and 14/22 for the real `recentPhraseCut()` at 534279f. On the separately generated HOLDOUT set it gets 11/14, against 2/14 and 7/14. All of this is designer-labelled synthetic data with provisional labels (D9), so it isn't an accuracy claim. Its job is to show the harness catches the regression.

## 3. After M0 (by file)

- `inference.ts`: run on the chosen candidate. Return several readings with scores, including half/double and 3/4 vs 6/8 alternatives and an explicit `abstain` reason. The current `docs/contracts.md` rules out candidates and confidence ("does not invent a set of three candidates or a confidence score"). Lead decision D2 (8 Nov) now allows real computed alternatives and abstention reasons. Scores stay internal and are never shown as a confidence. The contract's owner still needs to update its wording.
- `project.ts`: add a `ProjectClock { bpm|null, beatsPerBar, originNs, freeCycleNs|null, state: "none"|"proposed"|"accepted" }` and per-layer `{ lengthBars|lengthCycles, startBar }`.
- `engine.web.ts` / `engine.native.ts`: let several takes play at once on one transport, each scheduled by bar index against the project clock (P7). This is the biggest blocker for the journey.
- `App.tsx`: wire controller ops for previous candidate, shift ±1 bar and halve/double length (`capture-spec.md` §6), reusing the CC-learn path in `learn.ts`.

## 4. Discrepancies with my contract v1
- The repo uses `web-performance-us` (integer µs) for web and ns for Android, each with its own `ticksPerSecond`. My v1 asked for session-relative ns everywhere. **Revision:** I accept the repo's per-domain integer ticks. The core only needs `ticksPerSecond` per session, and BigInt ticks are already safe from the 2^53 limit.
- The repo's `scheduleElapsed` = source timestamp if present, else receipt timestamp, relative to the first of each kind. That matches v1's intent. Keep it.


## 5. Re-check at `534279f` (read-only, 8 Nov 2026; implementation is re-verifying)

| # | Status at 534279f | Evidence (file:line at 534279f) |
|---|---|---|
| P1/P2 whole-ribbon selection | **Partly fixed.** `capture()` now calls `recentPhraseCut()` and uses its selection | `App.tsx` L236-259; `recent-phrase.ts` L186-304 |
| — residual | With no rest above the gap and no locked grid, the cut still returns **the whole ribbon** (status `ambiguous`, honestly labelled) | `recent-phrase.ts` L219-223, L281-283 |
| — residual | The "silence" is an **onset-to-onset gap between 40 ms chord clusters**, not a sound-off gap. A pedalled chord ringing through a 2 s pause counts as a break (J04), and a long held note followed by a new onset can too | `recent-phrase.ts` L55-68, L211-217 |
| — residual | The selection end is the last event of any kind (note-off, CC), not the musical end | `recent-phrase.ts` L206, L228 |
| — residual | The grid fallback (the last bar) assumes 4/4 (`beat * 4n`) | `recent-phrase.ts` L235, L257 |
| P3 tempo from oldest segment | **Fixed in intent:** `inferPulse` runs on the selected events | `App.tsx` L258-259 |
| P4 `history.clear()` | **Still present** | `App.tsx` L266 |
| P5 grid auto-lock | **Still auto-locks**, but only when the cut is `recent` | `App.tsx` L269; `project.ts` L59-71 |
| P6 loop by event span + `setTimeout` | **Still present** | `App.tsx` L203-208 |
| P7 layers replace each other | **Still present** (`replay` → `stopReplay`; `App.playTake` → `engine.stopReplay`) | `engine.web.ts` L219-221; `App.tsx` L180 |
| P8 no initial state | **Partly fixed:** a controller seed (latest CC per channel before the start) and held notes are emitted at loop start | `recent-phrase.ts` L98-129; `App.tsx` L185-196 |
| — new divergence | Held notes are emitted as a **copy of their note-on at loop start** (`id + ":hold"`), i.e. a derived re-attack. Our spec carries them as state, without a new attack. Flagged for the audio and integration owners | `App.tsx` L191 |
| — new | Stuck notes: replay voices are released at the end of the plan and on stop | `engine.web.ts` L140-147, L260-263 |
| Take raw ownership (D8) | The take stores `capturePerformance(events)`, the **whole ribbon at capture**, frozen. Eviction can't break it, but it holds more than the interval (fine for D8; heavier than needed) | `App.tsx` L250 |

**So for M0 the remaining gap at 534279f is:**
1. Measure silence by **sound-off**: the union of key-down and CC64 (and later CC66) sounding intervals, not onset gaps.
2. A **bounded free-time fallback** instead of the whole ribbon.
3. Remove `history.clear()`.
4. Loop length from the range, on the audio clock (the transport itself is owned by the audio workstream, D3).
5. Don't auto-lock; D1 implicit accept on the second-layer capture.
6. Freeze only the selected interval plus start state (or keep the current whole-ribbon freeze and record the interval).
7. Make the held-note behaviour explicit (re-attack vs. carried state).

## 6. Note-pairing audit: retrigger vs FIFO (latest main `534279f`)

| Path | Repeated note-on on a held (channel, note) | Note-off | Key | Voices |
|---|---|---|---|---|
| Web `WebElectricPiano` | `noteOn` finds the existing voice and releases it in 20 ms, then starts a new voice → **retrigger** | `noteOff` releases the single matching voice (pedal-held if CC64 is down) | `(channel, note)`; the `source` tag isn't used for matching | 12, steals a released voice first, else the oldest |
| | `src/audio/web/instrument.ts` L78-82 | L135-146; pedal L148-155 | L79, L136 | L83-87 |
| Native `Instrument` (Oboe) | `findVoice(channel,note)` → restarts the **same voice** (`startAttack`) → **retrigger** | releases it (pedal-held if the sustain CC is down) | `(channel, note)` | 16; steals Release first, then the lowest amplitude, then the oldest |
| | `native/src/instrument.cpp` L111-124 | L126-140; sustain L152-163 | L49-56 | L58-77; `events.hpp` L12 |
| Capture seed `heldNotes()` | `Map.set(channel:note)` → last note-on wins | `delete` | `channel:note` (no port/source) | – |
| | `src/domain/recent-phrase.ts` L98-113 | | | |

**Outcome:** the engine policy is **retrigger (last-note-on wins, one voice per channel+note)** on both platforms. **FIFO is not used anywhere.** The spec's derived policy is now retrigger too (capture-spec §4.2), and FIFO was dropped.

**Flagged mismatch:** the spec pairs per `sourceId|portId|channel`, while the engines (and `recent-phrase.ts`) key by `(channel, note)` only. Two devices, or replay plus live input, on the same channel and pitch share a voice in playback. The derived view keeps them apart and raises `CROSS_STREAM_SAME_KEY`. `recent-phrase.ts` L278-280 already tells the user that "a later note-on replaces the earlier one". Also, **neither engine renders CC66**: only one learnable sustain CC is honoured (web `instrument.ts` L32-34, L60-62; native `instrument.cpp` L152). So the derived CC66 latch is MIDI semantics and may differ from what is heard (`ENGINE_NO_SOSTENUTO`).
