# Blocks Capture: product and algorithm specification (v2.2 proposal)

**Revision 8 Nov 2026 (after lead review).** Lead decisions are recorded in §0 and applied throughout. This is still research and design only: no repo edits.

> **Version caveat (v2.2, 8 Nov 2026 evening).** Every code reference, line number and "today" statement about Blocks in this document is **as of `534279f`** (2026-11-08 17:03 London). They describe that commit, **not current deployed behaviour**. The implementation team reports deployments at `69cac94` and then `fadfdcf` (17:15 London) with retained history, concurrent layers, a proposed grid and audio-clock joins. My quick read-only check of `fadfdcf` is in `prototype-findings.md` §7. Those claims **appear** addressed in the code; that isn't verified on a device. Two hypotheses that the deployment claims don't cover stay open: **CROSS_STREAM_SAME_KEY** (web voices are still keyed by channel and note at `fadfdcf`) and the **attack-gap vs sounding-gap** phrase split (`recent-phrase.ts` is byte-identical at `fadfdcf`). A user report that "Capture takes only the final chord of a four-chord progression" is under investigation by the implementation team. My hypotheses for it are in `prototype-findings.md` §8, and they are hypotheses, not a diagnosis. `main` has since moved on to `b19bda9`, which I haven't checked. All synthetic results remain **provisional**: Haris can't review musician cases right now. The new §11 adds harmony and role analysis.

Status: a research and design proposal from Blocks · Capture & Timing, 8 Nov 2026. No app code has been written or changed. This builds on `capture-contract-v1.md` (raw layer, pairing, interpretation and corrections, Web MIDI adapter) and revises it where marked **[rev]**. Evidence classes used here: **DOC-ABL** (documented Ableton behaviour), **CODE** (public code), **PAPER**, **HYP** (hypothesis) and **OURS** (our design). See `source-ledger.md`.

Every numeric parameter in this document is an **unvalidated starting value** to be tuned on fixtures and real playing. None of them is an acceptance threshold. That includes `gap = max(1.5 s, 2 beats)`.

---

## 0. Lead decisions (8 Nov 2026)

| # | Decision | Where it applies |
|---|---|---|
| D1 | Capturing the **second layer implicitly accepts** the first proposed grid. The accept is visible ("Tempo 120 kept · undo") and undoable. **Switching instrument alone does NOT accept it.** | §4.6 ProjectClock, §5.3, §6 |
| D2 | Real computed alternatives and abstention reasons are allowed. **Never show invented confidence percentages or counts.** Internal scores rank candidates and are never displayed as a confidence. | §4.4, §4.7, §6, the Page |
| D3 | The common multi-layer audio-clock transport is **owned by the existing implementation project / audio workstream**. Capture consumes it and doesn't build it. | §4.8, §8 M2 |
| D4 | Suggested lengths are **1/2/4/8/16 bars**. Other meters and custom lengths are **staged**. The scene LCM cap is **deferred**. **No silent truncation.** | §4.5, §4.6, §5.7 |
| D5 | **M0 freezes the selected raw interval.** Open-note playback handling is derived and explicit. Later real releases stay in raw history; **adopting them into the take is staged for M2**, with deterministic versioning/undo and stream/voice linkage. | §4.2, §4.8, §5.1, §8 |
| D6 | Optional voice activity from the engine is **non-blocking**. | §4.2 |
| D7 | **No automatic latency shift** until latency is measured and calibrated. Unknown stays unknown. | §5.9, §6 |
| D8 | Rolling history is **session-only** for now, with the **existing bounded capacity** (as of `534279f`: 120 s, 4096 events, 256 KiB; `App.tsx` L29-30, L63). The earlier "10 min / 200k events" is a **former proposal, not approved**. Saved takes own or pin the raw events and state they need, so ring eviction can't break them. | §4.1, §4.8, §9 |
| D9 | Fixture labels are **provisional**. There is **no musical accuracy gate**. Fixtures are regression checks. | §8, evaluation-plan |

---

## 1. The journey (Haris's product vision; this describes the target, not what is built)

| Step | Musician | Blocks (target behaviour) | Core components |
|---|---|---|---|
| J1 | Improvises freely on piano for minutes, with no transport, metronome or Record button | Keeps a bounded rolling history (raw, immutable). No grid exists yet. | RawHistory |
| J2 | A good phrase happens. He stops and presses **Capture** (pedal, pad or screen) | Picks the **recent phrase**, not the whole history. Proposes BPM, downbeat, meter and loop length, or **abstains** and offers a free-time loop. Starts looping the phrase in sync straight away. Shows alternatives one tap away. | NotePairer → PhraseSegmenter → PulseEstimator → GridFitter → CandidateRanker → LoopAssembler |
| J3 | Optionally quantises, nudges the range, or leaves it natural | Corrections are stored as parameters and are reversible. Raw data is never edited. | RangeCorrection, Corrections |
| J4 | Switches to bass. The piano keeps looping. He experiments, false-starts, finds a riff | History keeps recording live input only (loop playback isn't fed back). The instrument switch is logged as an app event. | RawHistory (+ app-event lane) |
| J5 | Presses Capture after the good riff, maybe several cycles later | Selects **bar-aligned** candidate ranges on the **established project clock**. Retimes nothing. The new layer loops in phase with the piano and joins at the seam. | LayerRangeSelector → CandidateRanker → LoopAssembler |
| J6 | Repeats with drums, which may be a different length (for example 8 bars) | Layers of different lengths loop on one bar grid, under the length policy (§5.7). | LoopAssembler, LayerStore |
| J7 | "Not that one": presses *previous*, *shift a bar*, or *half/double length* on the controller | Pure range operations on the stored candidates, with instant audition and no menus. | RangeCorrection |

What we take from Ableton (DOC-ABL): with an empty Set and the transport stopped, Capture infers and sets tempo (80-160 BPM band), sets the loop and starts the transport straight away. With the transport running or clips present, it "will use the existing tempo to detect a meaningful musical phrase". It keeps the notes played before the loop as material before the clip start. It advises ending "on the first beat … of the next bar" [A1, A2]. Our journey keeps that two-mode split. The differences are OURS: abstention, visible alternatives, cycle-locked free loops, and no tempo change without the user.

---

## 2. Three things that must never be confused (OURS)

| | (a) **Alignment** | (b) **Quantise** | (c) **Tempo change** |
|---|---|---|---|
| What it is | Where the raw take sits on the project timeline: its phase/offset and which bar is bar 1 | A per-note correction toward a grid | Changing the project BPM |
| Changes note timing relative to each other? | **No**. It is a translation only (plus the documented latency offset, §5.9) | Yes, in a derived view only, with strength 0 to 1 | All layers stretch together in the beat domain; raw data is untouched |
| Default | Always on (needed to loop in sync) | **Off (strength 0)** | **Never automatic** after the grid is accepted |
| Reversible | Shift ±1 bar or beat; candidate swap | Strength back to 0 means exactly as played | Undo restores the previous BPM |
| UI wording | "Placed at bar 9" | "Quantise 40%" (a strength the user set, not a confidence) | "Tempo 132 → 120 (all layers)" |

The first capture is special. Its *interpretation* (BPM, downbeat, meter, swing) is a mapping from raw time to beats, proposed and shown as "Tempo 132 · 4 bars (proposed)". The performance plays **as played**. The loop window is N bars at the proposed BPM, so any drift appears at the seam rather than being hidden.

---

## 3. Ranges: selection ≠ loop window ≠ tail ≠ seam (OURS)

```
raw history  ··········[=== noodling ===]·····[pickup][====== phrase ======][held chord~~~~|tail~~]·····
selection                                     |<---------- selected events ---------->|
loop window                                         |bar1 ........................ bar5|  (N bars on the grid)
anacrusis                                     |<-->|  before bar 1, policy-controlled
tail                                                                                   |~~~ voices release past the seam
seam                                                                                   ^ loop end = next loop start
```
- **Selection range** `[selStartNs, selEndNs]` is the raw events that belong to the take. It is bounded and never grows outward to swallow history. A note that started before `selStartNs` is not included. Its effect is carried by the **initial state** (for example, pedal down).
- **Loop window** `[loopStartNs, loopEndNs)` is the scheduled repeat, defined in bars (grid), cycles (free loop) or as-played duration (free, first capture). It may extend past the last event and past `captureAt` (J03).
- **Anacrusis**: events in the selection before `loopStartNs`. **Staged proposal, not a validated default:** play them before the first cycle. On later cycles, wrap them to the end of the loop only if that region is free of this layer's own notes; otherwise first pass only, with a toggle. Notes are never moved. Until it's validated by listening, M0/M2 use the simplest explicit behaviour (first pass only, flagged `PICKUP`).
- **Tail**: sound after `loopEndNs` from notes or pedal that ran past the seam. **Staged proposal (late-release policy), not a validated default:** let the voices release naturally over the next cycle start (overlap). We never lengthen the loop to fit a tail, and never cut a voice abruptly (unacceptable in L02).
- **Seam**: the instant `loopEndNs ≡ loopStartNs`. Seam checks: a final "landing" hit within ±80 ms of the bar line belongs to the next cycle and is offered as an "include downbeat hit" toggle (DOC-ABL advice to end on the next downbeat; DOC-ABL 11.1 "first played note is considered the start of the loop"). Held notes crossing the seam are clipped or tied **in the derived view only**.

---

## 4. Components and data contracts (TypeScript-style, platform-neutral core)

All components are pure functions or small classes with no DOM, Android or audio dependency, so each can be tested on its own on Node. Time is `Ticks = bigint` in the session's domain units with `ticksPerSecond` per session. **[rev]** v1 required ns everywhere; the repo's per-domain integer ticks (`android-monotonic-ns`, `web-performance-us`) are accepted.

### 4.1 RawHistory (bounded ring + watermark + app-event lane)
```ts
type StreamKey = `${string}|${string}|${number}`;          // sourceId|portId|channel
interface RawEvent { seq: bigint; t: Ticks; rx: Ticks; stream: StreamKey; bytes: Uint8Array | number[];
  origin: "raw-midi" | "touch" | "synthetic-disconnect" | "synthetic-overflow" | "synthetic-lifecycle";
  flags: number /* CLOCK_SUSPECT, BUFFER_GAP … */ }
interface AppEvent { seq: bigint; t: Ticks; kind: "capture" | "instrument-switch" | "transport" | "undo" | "correction"; target?: string; data?: unknown }
interface WatermarkSnapshot { t: Ticks; perStream: Record<StreamKey, { held: { pitch: number; vel: number; onT: Ticks | null /* null = onset already evicted */ }[];
  cc: Record<number, number>; bend14: number; chanPressure: number; polyPressure: Record<number, number>; program: number | null }> }
interface RawHistory {
  push(e: RawEvent): void;                       // O(1) amortised; never mutates stored events
  pushApp(e: AppEvent): void;
  view(from: Ticks, to: Ticks): { events: readonly RawEvent[]; startState: WatermarkSnapshot; truncated: boolean };
  watermark(): WatermarkSnapshot;                // state at the oldest retained event
  capturedRanges(): readonly { takeId: string; from: Ticks; to: Ticks }[];
}
```
- Bounds **(D8)**: the existing bounded capacity, session-only: 120 s, 4096 events and 256 KiB as of `534279f` (`App.tsx` L29-30, L63, `RollingHistory`). "10 min / 200k events" was a **former proposal of mine and is not approved**. For comparison, Ableton documents 16384 events with the oldest 1024 discarded [A2]. Eviction is whole events, oldest first, and updates `WatermarkSnapshot` incrementally.
- **Saved takes own or pin their raw data (D8).** At capture, the take copies (or reference-pins) the frozen raw events of its selected interval **plus** the `WatermarkSnapshot` state at `selStart` (held notes, CC, bend, pressure). Ring eviction afterwards can't change or break a take.
- **Capture never clears history [rev of prototype P4].** It records a `capturedRanges` marker, and history keeps only live input. Replayed loop events never enter it.
- The app-event lane records `instrument-switch` (the bass/drum target change). It is a strong boundary hint: the wanted layer phrase starts after the switch.
- Persistence **(D8)**: none for the rolling history for now, which is session-only. A journal (IndexedDB / file) is deferred to M5 and needs a new decision. Saved takes persist through the existing project save path.

**Eviction semantics (requirement 4).** When a note-on has been evicted but its key is still held, the snapshot lists it with `onT: null`. When its note-off arrives, the NotePairer closes the snapshot note. That is **not** an orphan. Derived notes with `onT: null` are flagged `ONSET_EVICTED`. A candidate cannot start before the watermark, and if a phrase cluster reaches the watermark the segmenter treats "phrase start unknown" as `NO_SILENCE_IN_HISTORY` (§4.3), not as a boundary. Real orphans (a note-off with no note-on in either history or snapshot) are kept raw, ignored in derived notes and counted.

### 4.2 NotePairer + SoundingModel (logical state)
```ts
interface DerivedNote { id: string; stream: StreamKey; pitch: number; vel: number; relVel: number | null;
  onT: Ticks | null; keyOffT: Ticks | null; soundOffT: Ticks | null;      // null = still open (never invented)
  latchedBy66: boolean; endReason: "KEY_OFF" | "RETRIGGER" | "ALL_NOTES_OFF" | "DISCONNECT" | "OPEN_AT_CAPTURE" | "EVICTED_ONSET";
  rawSeqs: bigint[] }
interface SoundingInterval { from: Ticks; to: Ticks | null; reasons: ("key" | "cc64" | "cc66" | "voice")[] }
function pairNotes(view: RawHistoryView): { notes: DerivedNote[]; diag: { orphanOffs: number; retriggers: number } };
function soundingIntervals(notes: DerivedNote[], ccStreams, voice?: VoiceActivity[]): SoundingInterval[];
```
- **Streams (requirement 6):** pairing key = `(stream, pitch)` where `stream = sourceId|portId|channel`. Two devices or two channels never pair with each other. A pad controller E4 and a keyboard E4 overlapping are two notes (J12).
- **Repeated same pitch: retrigger, consistent with the Blocks engine (audited as of `534279f`, see `prototype-findings.md` §6; `instrument.ts`/`instrument.cpp` voice logic unchanged at `fadfdcf` apart from a wider source type).** A new note-on on a held key closes the earlier note at the new onset (`RETRIGGER`). The next note-off ends the sounding note, and any further note-off for that key is an orphan (kept raw, counted). A note-on with velocity 0 counts as a note-off. That matches what both engines play:
  - web `WebElectricPiano.noteOn` (`src/audio/web/instrument.ts` L78-82) releases an existing voice with the same `(channel, note)` in 20 ms before starting the new one, and `noteOff` (L135-146) ends the single matching voice;
  - native `Instrument::noteOn` (`native/src/instrument.cpp` L111-124) restarts the same voice found by `findVoice(channel, note)`, and `noteOff` (L126-140) releases it;
  - the app's held-note seed, `heldNotes()` in `src/domain/recent-phrase.ts` L98-113, also uses last-note-on-wins on `channel:note`.
  FIFO overlap pairing is **dropped** as a derived policy (it would describe notes the engine never plays).
- **Known mismatch (flagged, not resolved):** derived pairing keys by `sourceId|portId|channel`. Both engines and `recent-phrase.ts` key voices by `(channel, note)` only. The web `VoiceSource` tag (`touch | midi | replay`) is used for `releaseSource` (L68-72) but not for matching. So two devices, or a loop replay and live input, on the same channel and pitch share one voice in playback, and one can cut the other. The derived view keeps them separate (J12) and raises `CROSS_STREAM_SAME_KEY` so the difference is visible. Fixing playback (per-source keys, or per-layer channel remap at replay) belongs to the audio workstream (D3).
- **CC64 sustain:** a note whose key is released while CC64 ≥ 64 sounds until the next CC64 < 64. Half-pedal values are preserved raw; the threshold is only for the logical model.
- **CC66 sostenuto (requirement 5):** neither engine renders sostenuto as of `534279f` (no CC66 handling added at `fadfdcf` in the files I diffed). Each honours one learnable sustain CC (default 64): web `setSustainController`/`setPedal` (instrument.ts L32-34, L148-155), native `Instrument::control` (instrument.cpp L152-163). `recent-phrase.ts` L275-277 says so too. The CC66 latch below is the **MIDI-semantics derived model** used for boundaries, and it's flagged `ENGINE_NO_SOSTENUTO` where it differs from what is heard. At the CC66 down edge, **only notes whose keys are held at that instant** are latched. Notes struck afterwards are not latched (J11: LH C+G latched, RH staccato is not). A latched note sounds until max(key-off, CC66 up), and CC64 still applies independently. This contrasts with CC64, which sustains every key released while it is down.
- **Open notes (requirement 3, D5):** at capture time, keys still down or sustained give `soundOffT = null` and `endReason = OPEN_AT_CAPTURE`. **No note-off is invented and raw data is not touched.**
  - **M0:** the take freezes the selected raw interval as it was at `captureAt`. Open-note playback is a **derived, explicit** rule written on the take (`openNotePolicy: "hold-to-seam-then-release"`). The note is drawn hollow, sounds until the loop seam, and is released there by the scheduler. The UI says "held at capture: released at loop end". The release is a scheduler action, not an event in the take.
  - **Later real releases** (note-off or pedal-up after `captureAt`) stay in raw history only. **Adopting them into the take is staged for M2** as a new take version (`version + 1`, deterministic and undoable), linked by stream and the voice/note id they close. Until then, they never change a saved take.
- **Logical vs audible (requirement 7):** logical silence (no key, no CC64/66 sustain) is not acoustic silence. Releases, reverb and long piano decays continue. CC state alone can't tell us when the sound actually stops. An optional `VoiceActivity` stream from the engine:
  ```ts
  interface VoiceActivity { t: Ticks; stream?: StreamKey; activeVoices: number; peakDbfs: number }  // sampled ≤ 50 ms, from the audio thread via lock-free counter → UI thread
  ```
  It's **non-blocking (D6)**: nothing waits for it and no milestone depends on it. It's used only as (i) a **tie-breaker** for silence (logical silence AND peak < −60 dBFS for ≥ 300 ms, both proposals) and (ii) a **tail-length estimate** at the seam. It's never written to raw, and it's never needed for correctness. When it's unavailable or the backend is suspended, the logical model is used and flagged `AUDIBLE_STATE_UNKNOWN`. This is owned by Audio & MIDI. The interface is my request, not something documented.

### 4.3 PhraseSegmenter → boundary candidates
```ts
interface Boundary { t: Ticks; kind: "SILENCE" | "SOUNDING_REST" | "NOVELTY" | "INSTRUMENT_SWITCH" | "WATERMARK" | "DENSITY"; strength: number; evidence: string }
function segment(notes: DerivedNote[], sounding: SoundingInterval[], app: AppEvent[], opts: { gapTicks: Ticks; restTicks: Ticks; maxLookback: Ticks; grid?: ProjectClock }): Boundary[];
```
- **SILENCE**: a gap in the union of sounding intervals of at least `gap = max(1.5 s, 2 beats)`. This is an **unvalidated proposal**. Ableton's release notes only say a "slightly longer gap" is needed when stopped [A4], which suggests a gap rule (HYP), but no value is documented.
- **SOUNDING_REST**: an onset gap of at least `rest` (proposal: 1.0 s or 1 beat) while something is still sounding, for example a pedalled chord (J04). It's a weaker candidate than SILENCE. For J04 the label is uncertain and a human decides.
- **NOVELTY**: an LBDM-style boundary strength [R1] over chord-clustered onsets, using IOI, pitch interval, rest and register/velocity profiles, plus a self-similarity drop (a repetition ends or begins). This is used when there's no silence (J02).
- **DENSITY**: a change in onsets per beat or register over a sliding window. It's a weak feature for the fallback.
- **INSTRUMENT_SWITCH**: from the app lane, and strong for layer captures.
- **No silence anywhere (requirement 2):** the segmenter **never expands outward** past `maxLookback` (proposal: 16 bars with a grid, 30 s without). When no SILENCE boundary exists in that window, or the cluster reaches the watermark, it emits ranked NOVELTY, SOUNDING_REST and DENSITY boundaries inside the window. If none passes a minimum strength, it emits a **bounded fallback** (with a grid, the last 4 or 8 bars ending at the last complete bar; without one, free-time `[end − 20 s, end]`) with `reason: "BOUNDED_FALLBACK"`, flagged and shown as such. This fallback is labelled as a fallback and never presented as intelligence.

### 4.4 PulseEstimator (first capture only, no project clock yet)
```ts
interface PulseReading { bpm: number; periodTicks: Ticks; score: number /* internal ranking only; never shown as confidence (D2) */; relation: "primary" | "half" | "double" | "triple" | "third" }
type PulseResult = { kind: "readings"; readings: PulseReading[]; ambiguity: null | "HALF_DOUBLE" | "TRIPLE" }
                 | { kind: "abstain"; reason: "TOO_FEW_ONSETS" | "NO_STABLE_PULSE" | "TEMPO_UNSTABLE" | "CLOCK_SUSPECT" };
function estimatePulse(notes: DerivedNote[], range: [Ticks, Ticks]): PulseResult;
```
- Input: chord-clustered onsets in the **selected candidate only** **[rev of P3]**. The cluster window is a proposal of 40 ms, rolled chords up to 70 ms (J07). Each cluster is weighted by summed velocity, bass presence and duration (long-note accent, as in Melisma's documented preference [R3]).
- Method (from papers; no GPL code): IOI histogram clustered at 25 ms, with clusters scored by integer-ratio support (Dixon/BeatRoot idea [R2, C6]). Autocorrelation of the onset strength over 40-240 BPM. Swing-aware pairing (long-short 8ths) so that 132 swung isn't read as 264 or 198.
- **Ambiguity**: if the half or double reading scores ≥ 0.85 × the primary (internal proposal; never displayed), set `HALF_DOUBLE`. The default goes to the reading inside a **preferred band of 80-160 BPM**. Ableton documents this band as its observable range [A1]; adopting it is OURS, and it is changeable.
- **Half/double arithmetic (corrected):** loop duration = bars × beatsPerBar × 60 / BPM. The `tempoAlt` op keeps the **duration** and rescales the **bar count**, so playback doesn't change:
  - J08: 8 bars × 4 × 60/120 = **16 s** = 4 bars × 4 × 60/60.
  - J05: 4 bars at 160 = **6 s** = 2 bars at 80.
  - J07: 4 bars at 120 = **8 s** = 2 bars at 60.
  Keeping the bar count while switching tempo would **double or halve** the duration (8 bars at 60 = 32 s). That is a length change and needs the explicit `lengthDouble`/`lengthHalve` op. If halving gives a non-integer bar count (1 bar at 120 → ½ bar at 60), no half reading is offered for that length; we suggest 1 bar at 60 (= 2× duration) only as an explicit length change. What changes for later layers is the bar grid they lock to (2 s bars at 120 vs 4 s bars at 60), which is why the alternative stays one tap away until D1 accepts the grid.
- **Abstain** when tempo drifts more than ±8% across the candidate (proposal), when there are fewer than 6 onset clusters, or when no reading reaches the minimum score. The result is a free-time capture (§4.8).

### 4.5 GridFitter (first capture)
```ts
interface GridFit { bpm: number; beatsPerBar: 3 | 4 | 6; downbeatT: Ticks; swing: { subdivision: 8 | 16; ratio: number } | null;
  loopBars: 1 | 2 | 4 | 8 | 16; anacrusisTicks: Ticks; phaseFit: number; seamErrTicks: Ticks; alternatives: GridFit[] }
function fitGrid(onsets, reading: PulseReading, candidate: [Ticks, Ticks]): GridFit;
```
- Downbeat scoring uses accent (velocity and bass), long notes, phrase start, harmonic change if available (it isn't yet), and the **landing downbeat**: a final hit near a bar line, which matches Ableton's documented advice to end on the next downbeat [A1].
- **Pickup**: material only in the last ≤ 1 beat (proposal) before the first strong downbeat, followed by material in that bar, becomes the anacrusis. It isn't trimmed. Live 11.1 documents "the first played note is considered the start of the loop" for loops of ≤ 8 bars [A4]. We **differ** on purpose: our default downbeat is scored, the first note is offered as an alternative, and J05 labels the pickup case.
- Meter: 4/4 by default. 3/4 when the accent periodicity of 3 clearly beats 2 or 4 (J09). 6/4 two-bar grouping is offered as an alternative.
- Loop bars: from the suggested set {1, 2, 4, 8, 16} (D4), the smallest length that contains the candidate with acceptable seam error. Other lengths (3, 5, 6…), other meters beyond 4/4 and 3/4, and custom lengths are **staged** (D4). If the phrase is longer than 16 bars, it's never silently truncated: the take keeps the whole selection and the UI says "phrase is 20 bars: loop 16 or choose length".

### 4.6 LayerRangeSelector (an established project clock exists)
```ts
interface ProjectClock { state: "none" | "proposed" | "accepted";   // proposed→accepted only by explicit accept or by capturing the 2nd layer (D1); an instrument switch alone never accepts
  bpm: number | null; beatsPerBar: number;
  originT: Ticks;                    // session time of project bar 0 (first loop start)
  freeCycleTicks: Ticks | null;      // set when the first capture abstained (free loop)
  outputLatency: { ticks: Ticks; calibrated: true; source: string } | null }  // null = unknown; applied only when calibrated (D7)
interface BarRange { startBar: number; lengthBars: number } | { startCycle: number; lengthCycles: number }
function layerCandidates(notes, boundaries, clock: ProjectClock, captureAt: Ticks, layers: LayerInfo[]): RangeCandidate[];
```
- The player performed **against the running loop on the same session clock**. Alignment is therefore the identity: `projectTime = rawT − originT`. A latency offset is subtracted **only when a measured and calibrated value exists (D7, §5.9)**. **No tempo or note retiming.**
- Candidates are **bar-aligned** ranges `[startBar, startBar + L)` with L in the suggested set {1, 2, 4, 8, 16} (D4), built from:
  1. **End bar**: the bar line after the last onset of the phrase. A **landing hit** within ±80 ms of a bar line, followed by silence, belongs to the next cycle (L01 drums crash). If Capture is pressed **mid-bar while still playing**, the incomplete current bar is excluded (L02), flagged `INCOMPLETE_CURRENT_BAR_EXCLUDED`.
  2. **Start bar**: from the strongest boundary (SILENCE, INSTRUMENT_SWITCH, NOVELTY) mapped to a bar. An onset ≤ 60 ms (proposal; the early-margin idea comes from Retro Rec [C2]) before a bar line belongs to that bar **without being moved**. Material only in the last ≤ 1 beat before the bar becomes the anacrusis (L01 bass pickup). The ≤ 1 beat rule and its wrap behaviour are **staged proposals** (§3).
  3. **Repetition**: if the last 2L bars contain two similar statements, prefer the **last complete statement** of length L (L02 default: rep B, 4 bars). Ableton documents choosing "the loop iteration with a significant amount of new material" when overdubbing [A3]; our repetition rule is OURS and distinct from that.
  4. **Length compatibility**: prefer L that divides, or is a multiple of, the longest playing layer (a 2-bar bass under a 4-bar piano). Other lengths only by explicit correction.
- **Delayed capture**: candidates are drawn from history no matter how long ago they were. Trailing silence is ignored, so the phrase still ends where the music ended (L01 drums captured 10 bars later, J15). Bar indices stay relative to `originT`.
- **Free-loop project** (the first capture abstained): the same logic with *cycles* instead of bars: `unit = freeCycleTicks`, L in {1, 2, 4} cycles. **No BPM is invented** (L03).

### 4.7 CandidateRanker
```ts
interface RangeCandidate { id: string; sel: [Ticks, Ticks]; loop: BarRange | { freeTicks: Ticks }; grid?: GridFit;
  features: Record<string, number>; score: number /* internal only (D2) */; reasons: string[] /* real computed reasons, shown */; flags: string[] }
interface Ranking { default: RangeCandidate | null; alternatives: RangeCandidate[]; abstain?: { reason: string; uiHint: string } }
function rank(cands: RangeCandidate[], ctx): Ranking;   // deterministic; stable ordering for controller "previous/next"
```
- Features: boundary strength, recency (weak decay, so delayed capture still works), completeness (does it end on a phrase end or landing?), repetition score, onset-grid fit (only if a grid exists), seam error, length prior ({4 > 2 = 8 > 1 > 16}, a proposal), fragment penalty (false-start rule: < 2 s and ≤ 4 onsets before a gap; J10), and overlap with already-captured ranges (penalised, so repeated captures move on).
- The weights are a linear model to start with, tuned on labelled fixtures. **We aren't proposing ML before labelled real data exists.**
- Abstention and fallback are explicit outcomes (§6), never a silent default.
- **Display rule (D2):** the UI shows the default, the real alternatives that were computed (as ghosts or prev/next), and plain reasons ("after a 2.6 s silence", "no steady pulse"). It never shows a confidence percentage, a score, or an invented count such as "3 candidates" unless that many really were computed.

### 4.8 LoopAssembler (what gets scheduled)
```ts
interface Take { id: string; layerTarget: string;
  raw: { events: readonly RawEvent[]; from: Ticks; to: Ticks; checksum: string };   // owned/pinned frozen copy (D5, D8): ring eviction can't break it
  startState: WatermarkSnapshot["perStream"];                                        // state at selStart, copied at capture
  selection: [Ticks, Ticks]; loop: { kind: "bars"; startBar: number; lengthBars: number } | { kind: "cycles"; startCycle: number; lengthCycles: number } | { kind: "free"; durationTicks: Ticks };
  initialState: WatermarkSnapshot["perStream"][StreamKey];   // CC64/66/1/11, bend, pressure, program at selection start
  anacrusis: { policy: "first-pass" | "wrap-if-free" | "off" }; tail: { policy: "release-over-seam" | "cut-at-seam" };
  openNotes: string[]; openNotePolicy: "hold-to-seam-then-release";                 // derived and explicit (D5)
  adoptedReleases?: { rawSeq: bigint; closes: string /* note id */; stream: StreamKey }[];   // staged M2; each adoption = version+1
  corrections: Corrections; interpretation: GridFit | null; version: number }
function schedule(take: Take, clock: ProjectClock, cycleIndex: number): ScheduledEvent[];  // derived only
```
- **Initial state (§3)**: at each loop start, emit derived state events (pedal, mod, expression, bend, pressure) as the values were at `selStart`. This prevents J14 bend and mod loss and the prototype's P8 stuck or truncated notes.
- **Clip or tie at boundaries (requirement 8)**: a note crossing the loop end is clipped at the seam in the derived view (default for notes still held at the seam with pedal up), or tied over the seam as a tail. Raw data is unchanged. Range correction re-derives these; it never expands the selection to swallow history.
- **Forced outward expansion is limited** to closing notes already inside the selection (their note-offs may lie after `selEnd`). It never extends the start backwards to include earlier onsets.
- Scheduling is on the **audio clock**, by bar index against `ProjectClock`, with no UI-timer loop restarts **[rev of P6]**. **The common multi-layer transport is owned by the implementation project / audio workstream (D3).** Capture hands it a `Take` plus `ProjectClock` and consumes its `now()`/bar-position API. Capture doesn't build a transport.

### 4.9 RangeCorrection ops (pure, reversible, controller-mappable)
```ts
type Op = { op: "previousCandidate" } | { op: "nextCandidate" } | { op: "shiftBars"; by: -1 | 1 } | { op: "shiftBeats"; by: -1 | 1 }
        | { op: "lengthHalve" } | { op: "lengthDouble" } | { op: "toggleAnacrusis" } | { op: "toggleLandingHit" }
        | { op: "tempoAlt"; to: "half" | "double" } | { op: "meterAlt" } | { op: "asPlayed" } | { op: "undo" };
function apply(take: Take, ranking: Ranking, op: Op): { take: Take; note: string };   // never touches raw
```
- Halve keeps the **end** anchored (the recent material stays). Double extends **backwards**, bounded by history and `maxLookback` (L02 corrections).
- Every op re-derives `initialState`, clipping and tails from raw, and is undoable with a single step.

### 4.10 Evaluation harness
`fixtures/evaluate.mjs` validates fixtures (SYNTHETIC label, ordering, checksum) and scores predictors per capture step (§ evaluation-plan). Its reference `m0Predict()` implements the M0 subset of §4.2, §4.3 and §4.6 for the harness smoke test only.

---

## 5. Policies

### 5.1 Capture while notes or pedal are held (requirement 3)
The capture is immediate, `selEnd = captureAt`, and open notes stay open and tentative (J03). The loop window can end in the future, for example at the bar-5 downbeat. M0 freezes the interval and plays open notes with the explicit `hold-to-seam-then-release` rule (D5). Adopting real later releases is staged for M2 (§4.2). Nothing is invented.

### 5.2 Continuous playing with the pedal held throughout (requirement 2)
There is no SILENCE boundary, so the window is bounded by `maxLookback`. The ranked candidates are NOVELTY or repetition (J02: the most recent complete 4-bar statement of the new motif), then the 8-bar double, then the bounded fallback with a reason. Collapsing to the whole session is **unacceptable** and tested (J02 `unacceptable`).

### 5.3 First capture vs established grid
| | First capture (no project clock) | Layer capture (clock accepted or proposed) | Free-loop project (first capture abstained) |
|---|---|---|---|
| Tempo | proposed from the candidate, or abstain | **project tempo, never changed** | none |
| Range | phrase boundary → loop bars by GridFitter | bar-aligned candidates (§4.6) | cycle-aligned candidates |
| Playback start | straight after capture (a ≥ 50 ms scheduling lead, a proposal; DOC-ABL: transport "will immediately begin to run") | joins at the next bar or cycle boundary of the running transport | next cycle |
| Mismatch | seam error shown | a phrase that fits a different tempo better is *offered* ("sounds like 3/4 against 4/4?"), never applied | – |

**Implicit accept (D1, decided):** capturing the **second layer** accepts the proposed grid, shown as "Tempo 132 kept · undo". Undo returns the clock to `proposed` and keeps both takes. **Switching instrument alone does not accept it.** Until it's accepted, the half/double and meter alternatives of the first capture stay one tap away.

### 5.4 Swing and pickups relative to an established grid
Swing is an *interpretation* (ratio, subdivision) used for quantise and for the grid fit. Layer captures don't need to know the swing to align. A pushed 8th before a bar line is either inside the early margin (counted as part of the bar, not moved) or an anacrusis.

### 5.5 Repeated captures
Each capture writes a new take and never overwrites. "Capture again" moves to the next-best candidate that doesn't overlap an earlier captured range, and "capture previous" goes to the earlier statement (L02). Ableton documents that capture results are no longer biased by the previous capture's tempo [A4]. Similarly, our first-capture estimator ignores earlier abandoned readings.

### 5.6 Capture while live layers play
History stores only live input. The engine's own scheduled playback is excluded, and touch input is tagged. Which layer target is active comes from `instrument-switch` app events. The layer capture only considers events of the current target (bass channel or instrument), with the others offered as an alternative.

### 5.7 Layers of different lengths (requirement: LCM or policy)
- The suggested length set is {1, 2, 4, 8, 16} bars (D4), so the project cycle = LCM = the longest layer (2 under 4 under 8 gives an 8-bar cycle, as in L01: 8 bars × 4 × 60/120 = 16 s).
- Each layer keeps the **phase it was played at**: it plays its bar `(projectBar − startBar) mod L`. Nothing is shifted to bar 0.
- Lengths outside the suggested set (3, 5, 6, 7 bars) and custom lengths are **staged** (D4). When they arrive, they show "realigns every N bars" (the LCM). The scene LCM cap is **deferred** (D4). **No layer or scene is ever silently truncated** to fit a cap.
- Free-loop projects use cycles in the same way.

### 5.8 Tails across the seam
**Staged proposal (late-release policy), not a validated default:** `release-over-seam`. Voices started in cycle k finish naturally while cycle k+1 begins (L02 pedalled chord). CC64 state at the seam: the initial state of the next cycle re-asserts the pedal value as it was at `selStart`. If that's "up" while the previous cycle's pedal is still down, the engine releases the pedal at the seam, and the tail continues only for voices already decaying. Audio & MIDI should confirm this is safe for the voice engine.

### 5.9 Latency (alignment only)
A player in sync with what they *hear* is late against the scheduled audio clock by roughly the output latency. **D7: there is no automatic latency shift until latency is measured and calibrated.** Browser- or OS-reported values (`AudioContext.outputLatency`/`getOutputTimestamp`, Oboe) are recorded as diagnostics but **not applied** by themselves. Once a calibrated value exists (owned by the audio workstream, physically checked by QA), alignment may subtract it as a constant, versioned, visible offset, never written into raw. Ableton documents compensating latency for Capture [A4]. **Nothing here is measured.** Unknown stays unknown: alignment is uncompensated, flagged `LATENCY_UNKNOWN`, and the shift-by-beat correction remains.

---

## 6. Abstention and needs-correction cases (requirement 10)

| Case | Detection | Outcome | UI (minimal interaction) |
|---|---|---|---|
| Nothing played since the last capture or ever | no onsets in the window | no take | Capture button disabled or greyed (as Ableton documents [A2]); a pad press gives a short "nothing to capture" |
| No stable pulse (rubato, J06, L03) | `PulseResult.abstain` | **free-time loop**, no grid, reason shown | Chip: "Free time · no tempo". The [Try tempo] button shows the best reading as a proposal |
| Half/double ambiguous (J08) | `HALF_DOUBLE` | default inside 80-160, alternative ready (same 16 s loop: 8 bars at 120 ↔ 4 bars at 60) | Chip "120 or 60?" (no percentages); the controller tempoAlt toggles |
| Meter ambiguous (J09) | accent margin is low | 4/4 or 3/4 by score, alternative ready | "3/4 · tap for 4/4" |
| No silence in the bounded window (J02) | no SILENCE boundary | novelty or repetition candidate; else bounded fallback | "No clear phrase start: showing last 4 bars" with prev/next and length ops |
| History truncated (J13) | the cluster reaches the watermark | candidate starts at the strongest boundary inside the window; flag `HISTORY_TRUNCATED` | small "earlier playing no longer kept" note |
| Open notes or pedal at capture (J03) | open notes | open and tentative; release adoption | Tentative notes drawn hollow until released |
| False start (J10) | fragment rule | fragment excluded, alternative includes it | "+ include start" toggle |
| Sounding rest vs pause (J04) | competing SILENCE and SOUNDING_REST | ranked, flagged uncertain | prev/next candidate |
| Incomplete bar at capture (L02) | capture mid-bar while playing | last complete bars | – |
| Disconnect mid-phrase | DISCONNECT, CLOCK_SUSPECT | take kept; synthetic offs flagged (v1) | "device disconnected during take" |
| Output latency unknown or uncalibrated | `outputLatency == null` | alignment uncompensated (D7) | shift-by-beat op; later calibration |
| Phrase longer than 16 bars | candidate span > 16 bars | whole selection kept; no silent truncation (D4) | "phrase is N bars: loop 16 or choose length" |
| Two streams on the same channel and pitch | `CROSS_STREAM_SAME_KEY` | derived notes kept separate; playback may merge them (engine keys by channel+note) | small note; audio workstream fix |
| Grid still proposed (one layer only) | `clock.state == proposed` | instrument switch doesn't accept it (D1) | "120 proposed · keeps on next capture" |
| Tempo would fit better (layer) | the take's estimated BPM differs from the project's by more than 4% (proposal) | **offer only** | "Bass feels like 126 · keep 120" |

---

## 7. Controller and screen mapping (minimal interaction)
- One learned **Capture** control (already in the prototype's `learn.ts`). A long press means "previous candidate" and a double press means "undo".
- Optional learned controls for shift ±1 bar, halve/double length and as-played/quantise toggle. Pads or knobs suit these, but the CC64 and CC66 pedals are never used for Capture (the prototype rule stays).
- The screen shows the chosen range on a mini-roll with ghosted alternatives. Tapping a ghost selects it. No modal dialogs while playing.

---

## 8. Milestones (each one independently testable)

No milestone has a musical accuracy gate (D9). "Regression check" means the harness result on provisional synthetic labels must not get worse unless the label itself is changed.

| M | Outcome | Components | Regression checks (synthetic; provisional labels) | Verification |
|---|---|---|---|---|
| **M0** | Capture takes the **recent phrase**, not the whole history; history isn't cleared; **the selected raw interval is frozen into the take** with its start state (D5, D8); open notes played by an explicit derived rule; note-based replay with initial state | `selectRecent` (retrigger pairing per §4.2, CC64/66, latest true silence by sound-off, bounded fallback, bar snap if a grid exists), no `history.clear()`, take owns raw + start state | Tuning set: J01, J03, J05-J15, L01 (all steps), L02 piano and L03 keep their default; J02 never collapses to the whole session; raw checksum unchanged on all. Holdout set reported separately, never tuned on | `node fixtures/evaluate.mjs`, Jest port, plus a manual Edge check by Haris (not hardware-certified) |
| **M1** | First capture proposes a grid or abstains honestly; candidates plus one-tap alternatives | PulseEstimator, GridFitter, CandidateRanker v1, proposed/accepted clock | Tempo Acc1/Acc2 and mode on J01-J10 and J15; abstain on J06 and L03 step 1; ambiguity flag on J08 | harness plus mir_eval offline (tempo/beat metrics) |
| **M2** | Layered journey: several layers loop together on the audio workstream's transport (D3); bar-aligned layer captures; implicit accept (D1) | ProjectClock, LayerRangeSelector, LoopAssembler, length policy, **staged:** release adoption with versioning (D5), pickup wrap and late-release policies | L01 and L02 every step default correct; project tempo unchanged on all layer steps | harness plus QA emulator/browser check; physical check pending |
| **M3** | Correction without breaking flow | RangeCorrection ops plus controller mapping | L02 `corrections` all match; every op undoable | harness plus human session protocol (evaluation-plan §4) |
| **M4** | Robust boundaries without silence; repetition-aware | NOVELTY/LBDM, repetition, optional non-blocking voice-activity tie-breaker (D6) | J02 default; J04 once Haris has labelled it | human listening notes (not a gate) |
| **M5** | Longer history and persistence (needs a new decision; D8 is session-only for now) | journal, watermark across reload, disconnect recovery | J13 plus reload fixtures; W1-W4 from v1 | QA lifecycle tests |

---

## 9. Parameters (all unvalidated starting values)
| Name | Start | Where | Tune with |
|---|---|---|---|
| gap | max(1.5 s, 2 beats) | silence boundary | J01, J10, J15, L01; human labels |
| rest (sounding rest) | 1.0 s or 1 beat | SOUNDING_REST | J04, J13 |
| maxLookback | 16 bars / 30 s | bound | J02 |
| bounded fallback | 4-8 bars / 20 s | fallback | J02 |
| chord window | 40 ms (rolls ≤ 70 ms) | onset clustering | J07 |
| early margin | 60 ms | bar membership | L01 |
| anacrusis max | 1 beat | pickup | J05, L01 |
| landing margin | ±80 ms | seam | L01 drums, J01 |
| half/double margin | 0.85 (internal, never shown) | ambiguity | J08 |
| preferred band | 80-160 BPM | default reading (Ableton documents this band [A1]) | J05, J08 |
| tempo stability | ±8% | abstain | J06 |
| silence audible floor | −60 dBFS for 300 ms | voice tie-breaker | needs the engine |
| buffer | **existing** 120 s / 4096 events / 256 KiB, session-only (D8). "10 min / 200k" = former proposal, not approved | RawHistory | QA long sessions |

## 10. Decided and still open

Decided on 8 Nov 2026: D1-D9 (§0). The earlier open items 1-9 are resolved by them, as follows. Implicit accept → D1. Alternatives and no confidence display → D2; `docs/contracts.md` still needs that wording change by its owner. Transport ownership → D3. Lengths and LCM → D4. Release adoption → D5 (staged M2). Voice activity → D6. Latency → D7. Persistence → D8. Labels → D9.

Still open:
1. Playback voice key: per-source keys, or per-layer channel remap, so that layers and devices on the same channel and pitch don't cut each other (§4.2 mismatch; audio workstream).
2. Whether Blocks should render CC66 sostenuto at all (both engines ignore it today).
3. Pickup-wrap and late-release (tail) policies: staged proposals awaiting listening tests.
4. Which ambiguous examples (`musician-review.md`) Haris wants to hear first. This doesn't block regression tests.
5. The free-time bounded fallback length (20 s proposal), because `recent-phrase.ts` (as of `534279f`, unchanged at `fadfdcf`) still falls back to the whole ribbon when there's no rest and no grid.

6. **Attack-gap vs sounding-gap split, and the four-chord report.** Should the phrase split use silence (nothing sounding, pedal included), with onset gaps only as a weak cue? This is still a hypothesis. The synthetic check in `prototype-findings.md` §8 shows the cut can keep only the last chord when chords are ≥1.5 s apart, or when a grid is passed and the last-bar fallback applies. Owner: the implementation team, who are investigating the real report.
7. **Harmony label display default (§11).** Labels off by default, or shown on tap? Should the first alternative be shown or the top 2? I propose off by default, with a tap to see up to 3 alternatives.
8. **Key context source (§11.6).** Should Stage 2 take the key only from the user (optional), or also infer it? I propose inferring it, shown as one more alternative, never as a fact.
9. **Whether harmony may inform capture ranking (§11.7), and when.** I propose not before Stage 2 and a listening test, behind a flag, and as a tie-break only.
10. **Corpora for evaluation only.** Which non-commercial (NC) or restricted corpora may we use for internal evaluation, and must they never be shipped or used to train a shipped model? Candidates are JHT, JAAH, PiJAMA, FiloBass and the madmom models. A licence or legal owner should confirm.
11. **FiloBass licence conflict.** The project site states restricted research terms, while the Zenodo metadata says CC BY 4.0. Don't use it until the owner clarifies.
12. **Chord-symbol spelling style.** Harte stays internal. Display could use jazz lead-sheet symbols ("Dm9", "G13", "C/E"), a flats-first default, and key-aware spelling at Stage 2.
13. **Storage.** Should annotations be kept per take, and is there a cap (they're small, but versions accumulate)? I propose keeping the latest valid annotation per analyzer, plus user corrections forever.
14. **Default view for layered takes.** Per-layer labels or the combined label? I propose per-layer by default with a "together" toggle, because a rootless piano part only becomes D:min9 with the bass.

*Superseded:* `capture-contract-v1.md` still mentions "confidence" and "10 min / 200k". Those lines are superseded by D2 and D8.
