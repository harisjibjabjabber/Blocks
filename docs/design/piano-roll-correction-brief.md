# Piano-roll component correction brief: consolidated contract (rev C.3)
Date: 8 Nov 2026. Design/spec extraction plus a candidate contract. **This brief performed no browser, engine or device testing.**
- Design files are marked **PROPOSED**. They are the fidelity reference, not evidence of implementation.
- Integration owner: the one existing coding project. Component product owner: Blocks · Piano Roll; overall product/integration lead: Daw Bot · Product Manager. FE/BE engineers implement.
- **Canonical acceptance text is `acceptance-criteria.md`; it wins over anything here.** This brief cites IDs and does not reword or require rewriting them.

Labels:
| Label | Meaning |
|---|---|
| [R] | Reviewed design requirement |
| [UX-A] | UX amendment now documented canonically in Rev 3.5; see acceptance IDs, not duplicate criteria here. |
| [FE] / [BE] | Input supplied directly by frontend/backend engineers. Proposed interfaces, not verified implementation. |
| [C] | Candidate contract from this brief |
| [M] | Invented measurement threshold |
| [I] | Inspect existing behaviour at integration before claiming |

> **Rev 3.5 is canonical:** `acceptance-criteria.md` AC-KEY-01..05, AC-PH-01, AC-ALN-01 and AC-EVD-01 supersede older keyboard/playhead/alignment/evidence language. Package entry point: `HANDOVER.md`.

## Implementation summary
1. **One `PianoRoll`, two hosts** (Play ribbon: handles editable, notes locked; full editor: notes editable, loop 🔒). One view transform drives keys, ruler, grid, notes, loop and playhead.
2. **Grid**:
   - [R] Black-key rows are shaded and bar/beat/sub lines are aligned.
   - [UX-A] A real piano keyboard sits left of the notes.
   - Octave convention: **MIDI 60 = C4 everywhere** [BE]. If the engine differs, declare an adapter.
3. **Timing integrity**:
   - Expressive notes keep their exact off-grid positions.
   - Grid, snap, BPM, meter and view changes never move notes.
   - No automatic quantise. Quantise only through explicit preview → Apply.
   - A move keeps the original offset and moves by grid deltas; Alt = unsnapped.
4. **Data**: the raw take is immutable (notes, CC64, bend, pressure). Editor commands change only the working notes. Commands go begin(baseline) → preview → one commit; cancel leaves no history.
5. **Playhead**:
   - Driven only by authoritative engine snapshots.
   - **Hidden entirely when the position is unavailable** [UX-A].
   - Pause, seek, wrap and stop follow §2.5.
   - **Acceptance blocker until the engine exposes the position.**
6. **Layout**: frame 18 (top bar, layer strip, info bar, ruler, dominant grid, velocity lane, context bar, one-row Draw/Select/Erase + Capture). Silent tail is display only; Trim excluded.
7. **Dependencies on the engine** (each item is disabled until provided):
   - authoritative position snapshot
   - authoritative selected-layer sounding-pitch state (incl. sustain/release)
   - audition channel isolated from the take and the capture buffer

## Rev 3.5 integration references
Use canonical AC-KEY-01..05 for keyboard geometry, octave convention, display-only ribbon, editor audition gating and engine lighting; AC-PH-01, AC-ALN-01 and AC-EVD-01 for playhead, timing fidelity and evidence. Do not implement older key-column tap-selection behavior where it conflicts with AC-KEY-04.

Additional implementation safeguards (not replacement criteria): keyboard pointer events must not bubble into Draw/Erase; audition must stay out of the take and retrospective capture buffer; release audition voices on pointerup/cancel, lost capture, blur/visibility change, host/device switch. Never enlarge key hit regions into the editable note area. Real-touch validation remains outstanding.

## 0. Sources (under /workspace/blocks-design)
| Topic | Lines / file |
|---|---|
| Editor | `spec.md` §0c (62–104) |
| Ribbon | `spec.md` §0d; `ribbon-contract.md` (rows/hit §1–2; ruler §3; viewport §4; tail §5; undo §7; AC-RIB) |
| Gestures, keys, screen reader | `gestures.md` §10 (editor ownership, keys) and §5 (screen reader) |
| Acceptance | `acceptance-criteria.md` AC-PR-01..12, AC-ED-01..15 |
| Frames | `hifi/hybrid/{dark,light}/17–27-editor-*.png`, `fold-18-editor.png`, `desktop-18-editor.png`; ribbon `28a–d`, `fold-28`, `desktop-28` |
| Geometry reference | `hifi/src/editor.py` (`geo`, `grid`, `ruler`, `toolbar`, `vel_lane`) |
| Backend's cited sources | `spec.md` 62–104, 173–177, 491–516; `state-machines.md` 151–185; `ribbon-contract.md` 40–66, 90–92; `acceptance-criteria.md` 74–81, 125–138, 153–154; `LIMITATIONS.md` 3–16 (proposed API) |

[FE] has confirmed the following, so they are not open:
- The editor loop is locked (🔒) and the Play ribbon has the handles.
- §0c supersedes §3.11.

## 1. Live 7ef7982 vs reference
The faults are as the lead reported them. The only evidence I looked at is the one phone screenshot.

| Observation | Reviewed reference [R] |
|---|---|
| Screenshot: 13 equal buttons wrapping onto 4 rows | Frame 18 / §0c.3: one row with **Draw · Select · Erase** + Capture, active tool filled with ✓. Context bar holds Velocity, Quantise… and ⋯. ⋯ holds Duplicate, Copy, Paste at playhead, Select all, Delete. Pan and zoom are gestures; tap alternatives such as zoom ± are required by AC-PR-07, and their placement (e.g. in ⋯) is a [C] choice. |
| Screenshot: seconds ruler while the text says "Tempo 160 proposed" | ribbon §3: proposed grid = dashed ticks, italic bar labels and the chip "~BPM? · tap to set". Seconds only in free time. |
| Screenshot: grey dashes, no row shading, no semitone lines | §0c.2 / `editor.py grid()`: black-key rows shaded across the grid, key column with C labels, sub/beat/bar vertical lines at increasing strength. |
| Screenshot: a **static vertical line at the left of the grid**. A single image cannot show motion. The **lack of a moving playhead is the lead's report**. | §0c.1 / frame 18: accent playhead with a ▼ cap through the ruler and grid; info bar "▶ looping · pos / len". |
| Screenshot: no loop markers | §0c.7: read-only bracket with 🔒 and the chip "🔒 Loop · on Play". The ribbon has slim handles (ribbon §1). |
| Screenshot: small grid under the controls | Frame 18 order: top bar → layer strip → info bar → ruler → grid → velocity lane → context bar → tool row. The grid is the dominant region. |

## 2. Shared component
[R] There are two hosts of the same roll:
- **Play ribbon:** notes are never editable; loop handles are editable.
- **Full editor:** notes are editable; loop is read-only.
- **Fold/desktop:** add the side pane (§0c.9).

[C] Build one `PianoRoll` (renderer + view transform + hit test) with `mode: 'ribbon'|'editor'`.
- Switching hosts must keep note IDs, selection, notes and loop state (§5 case D5).

### 2.1 Units and origin
- [BE] **Inspect the existing engine units and origin during integration.** Do not migrate storage to match the design.
- [BE] The adapter exposes **seconds relative to a declared origin**, which preserves precision.
- [C] Beat unit = **quarter-note beat**:
  - `beat(sec) = (sec − beatOneSec) · bpm / 60`
  - In 4/4, 1 bar = 4 beats and snap 1/16 = **0.25 beat** (1/8 = 0.5, 1/4 = 1, 1/8T = 1/3).
  - Other meters: bar length = numerator × (4 / denominator) beats. [I] whether the engine supports non-4/4.
- [BE] Note invariants:
  - stable note ID and layer ID
  - pitch 0..127 integer
  - duration > 0
  - velocity 1..127

### 2.2 Canonical view transform [C]
```
view = {t0, t1 (seconds re origin), pHi, pLo, gx (key column right edge), gw, gridTop, row}
X(t) = gx + (t − t0)/(t1 − t0)·gw        T(x) = t0 + (x − gx)/gw·(t1 − t0)
Y(p) = gridTop + (pHi − p)·row  (top edge of pitch p's row)   P(y) = pHi − floor((y − gridTop)/row)
```
- **Everything uses this single X():** ruler, grid lines, notes, playhead, loop bracket, ghosts, velocity bars.
- Snap to device pixels only when drawing.
- **Row shading** (reference `editor.py`): black key when `p % 12 ∈ {1,3,6,8,10}`.
- **C labels:** centred on the C row (`p % 12 == 0`, label `C{p/12 − 1}`; **MIDI 60 = C4 everywhere** [BE], adapter if the engine differs). With [UX-A] A1 they sit on the C keys of the real keyboard.
- **Octave boundary:** higher pitch is drawn higher, so B(n−1) sits directly below C(n). The octave boundary is therefore the **bottom edge of the C row**, `y = Y(p) + row`.
  - The reference draws no extra octave line; it marks octave position only with the C label and key shading.
  - A per-row semitone line plus a slightly stronger line at that bottom edge is a [C] legibility choice.
- **Vertical lines** (reference): sub-lines every 0.25 beat (faint), beat lines (medium), bar lines (strong).
  - Ruler labels: bar numbers; ".2 .3 .4" when there are at least 14 dp per beat; labels at least 28 dp apart (ribbon §3).
  - Hiding sub-lines below a pixel spacing is [M] (suggest 6 px).
- **Viewport:**
  - [R ribbon §4]: default frame `[s − 0.1L, e + 0.1L]` around the loop/range, clamped to 2–16 bars or 4–40 s.
  - The editor's entry framing and any expansion beyond that (pan or pinch limits) are an **engineer choice, not a blocker**. They must not contradict ribbon §4 in the ribbon host.
- **Pitch range** [R]: auto-fit to the played notes, with C labels. The minimum visible range and row height are [M].

### 2.3 Source vs working notes
- [R A1/A8, §0c.5, ribbon §7] **The raw take is immutable:** notes, CC64, pitch bend and pressure.
- Loop boundaries are metadata.
- A note held across the loop end is clipped **for playback only** (synthetic release kept separate).
- Original/as-played stays derivable, and quantise ghosts show it.
- [C] Editable working notes are separate from raw. Editor commands change only working notes.
- Pedal, pitch bend and pressure pass through untouched and are not editable here. A sustain display strip is **out of scope** for this correction.
- [BE] Pickup handling, pedal reconstruction and minimum range follow the **existing Audio/Capture policy**. This correction adds no new policy.
  - **No decision is made here on whether a pickup repeats or plays on the first pass only** (spec OQ-1 stays as it is).

### 2.4 Grid never changes timing (coordinate alignment ≠ quantise)
- Coordinate alignment means the grid is drawn under notes at their exact raw/working positions. **Expressive off-grid notes stay off-grid; nothing is ever auto-quantised or display-snapped.**
- [R §0c.5, AC-ED-09] Changing grid, snap, BPM confirmation, meter or view changes **only the display and the snap targets**. Every note stays byte-identical.
- Quantise happens only through explicit Quantise… → preview → Apply.
- [FE] **Move:** keep the note's original offset and move by discrete grid deltas: `newStart = start + round(Δ/step)·step`.
  - **Alt = unsnapped.** Reference: `gestures.md` §10 mouse "Alt-drag = no snap", keys "Alt no snap", and the `editor.py` tooltip.
  - The **Ctrl/Cmd no-snap variant belongs to ribbon handle drags** (ribbon §2.5, §0b), **not** the editor. Do not claim Ctrl for the editor.
- [R] **Draw:** new note at last length, snapped (offset 0).
- [R] **Resize:** start fixed, end snapped.
- [I] Tie-breaking, the group anchor for multi-note snap, minimum length, and quantise duration/swing/collision handling.

### 2.5 Transport and playhead
- [BE] **The backend owns the authoritative transport position.** The frontend does no independent wall-clock timing or extrapolation.
- [BE] Proposed snapshot:
  `{availability:'unavailable'|'available', state:'playing'|'paused'|'stopped', positionSeconds:number|null, revision}`
  - The origin and units are declared.
  - `positionSeconds` is `null` when unavailable.
- **Render behaviour:**
  - Draw only authoritative engine snapshots. [UX-A] When unavailable, hide the line entirely (A2).
  - When unavailable: no playhead number or progress, and **Paste at playhead disabled**.
- **Required behaviour, pending the backend's exact contract:**
  - **Play:** the playhead advances from engine snapshots.
  - **Pause:** the playhead freezes in place.
  - **Seek:** the playhead moves only after the engine confirms (new revision); no optimistic jump.
  - **Wrap:** at loop end the position returns to loop start with a new revision.
  - **Stop:** reset-to-loop-start is a **proposal needing integration agreement**, not a verified policy.
  - **Seek or stop outside the loop:** [I].
- **Loop semantics** [BE, R]:
  - The loop is `[s, e)`. A note whose onset is exactly at e does not trigger twice at the wrap.
  - Slide keeps the loop length.
  - Note edits never change the loop.
  - Do **not** infer the loop end from the last note.
- Entering or leaving the editor never restarts transport [R §0c.1].
- **The moving playhead remains an acceptance blocker until the engine exposes an authoritative position.** Do not defer it silently.

### 2.6 Commands: preview / commit / undo
- [R A10, AC-PR-04/09, AC-ED-08/09/12] One completed gesture or applied action = one labelled undo step. A second touch mid-edit aborts and reverts with no step.
- [BE] proposal:
  - `begin` captures `{baseline, revision}`.
  - Each preview is computed **from the baseline**, never cumulatively, so there is no rounding drift.
  - `commit` = one reversible patch.
  - `cancel` or no-op = no history entry.
  - Undo/redo restore exact IDs and values.
- Erase swipe = one stroke = one step.

### 2.7 Silent tail
- [R ribbon §5]: hatch, dim and label are **purely informational**. They **never truncate or rewrite audio or MIDI.**
- **"Trim silence?" is excluded** from this correction.
- Shading from the last note-off or last event is not an audio end: pedal (CC64) and the instrument's own release can extend sound. Do **not** claim an audible end from CC64 alone.

## 3. Bounded changes (order)
1. Shared transform + grid renderer (§2.2), ruler modes.
2. Playhead from engine snapshots (§2.5); loop bracket (editor, 🔒) / slim handles (ribbon §1).
3. Frame-18 layout; replace the 13-button wrap (§1).
4. Pointer engine per `gestures.md` §10:
   - one finger = tool; two fingers = pan/zoom
   - slop 8 dp, long-press 500 ms, double-tap 300 ms
   - end handle 48 dp; 8 dp ambiguity picker
   - loupe ≈196×96 with text readout
   - these are design values, provisional per OQ-3
5. Working notes vs source + command boundaries (§2.3, §2.6). Quantise preview with dashed originals.
6. Silent-tail display only (§2.7).

## 4. Test appendix: canonical criteria run matrix (procedures only; criteria text = `acceptance-criteria.md`)
**Fixtures:**
| ID | Content |
|---|---|
| F-A | 4 bars, 92 BPM established, 4/4, voicings C3–A5 incl. black keys. Starts 10–40 ms off-grid. **Pickup 30 ms early** before bar 1. A **rolled chord** (onsets spread ~15–60 ms). Raw CC64. One note held across the loop end. |
| F-B | The screenshot's C4–C5 line, 160 BPM proposed |
| F-C | Rubato, free time |

Run every case in a populated browser at 390×844 and 1440×900; Fold at 840×1000 where cited.

**Editor (`acceptance-criteria.md` lines 125–139):**
| Run | IDs | Procedure |
|---|---|---|
| E1 | AC-ED-01, AC-ED-12 | Play F-A. Tap the Piano mini-roll. Make 3 edits. Return via ‹ Play and via Back. Record transport before and after; loopback audio recording. |
| E2 | AC-ED-02, AC-ED-06, AC-ED-14 | F-A in both themes and greyscale. Inspect keys, labels, ruler, layer strip, ghosts, selection cues, contrast. Run the screen reader over the note list. |
| E3 | AC-ED-03, AC-ED-04 | Cycle D/S/E. In each tool do a one-finger drag, a two-finger pan/pinch, and a second touch mid-move and mid-erase stroke. Check the undo stack. |
| E4 | AC-ED-05, AC-ED-07 | F-A Select: tap, long-press add, double-tap the rolled chord, marquee, move +2 st / +1 beat, Alt-move, resize. Observe the loupe. |
| E5 | AC-ED-08 | Select 4 notes, drag the velocity group bar, Done, undo. |
| E6 | AC-ED-09 | Quantise 1/16 50 % on the selection, then on the whole layer. Cancel → diff; Apply → diff + undo. |
| E7 | AC-ED-10, AC-ED-13 | ⋯ actions. Full desktop key and mouse map. Fold side pane. |
| E8 | AC-ED-11 | Attempt every editor gesture on the ruler and bracket. Loop start/length/phase must stay unchanged. |
| E9 | AC-ED-15 | Inspect Play for any Quantise control. Count taps to Quantise. |

**Ribbon (`acceptance-criteria.md` lines 144–156):**
| Run | IDs | Procedure |
|---|---|---|
| R1 | AC-RIB-01..04 | Handle visuals; touch/mouse hit zones; overlap tie/picker on F-A. |
| R2 | AC-RIB-05 | F-A, F-B, F-C ruler modes and label spacing. |
| R3 | AC-RIB-06..08 | 90 s history + 4-bar phrase. Framing; Earlier, minimap, pan, Refocus; edge auto-scroll. |
| R4 | AC-RIB-09, AC-RIB-10 | Drag while playing; release audition; raw diff after edits; undo. |
| R5 | AC-RIB-11 | Tail ≥ 1 beat shows hatch and label. **Trim excluded by lead.** Check no Trim control and no audio/MIDI shortening; this deviation is noted against the canonical criterion. |
| R6 | AC-RIB-12, AC-RIB-13 | Screen reader/keys; contrast in both themes. |

**Timing integrity (from reviewed §0c.5 + A1/A8):**
| Run | Procedure | Fails if |
|---|---|---|
| T1 | F-A at 3 zooms: change snap 1/16→1/8→off, confirm BPM, change view. Diff working + raw. | Any byte change. Any visible snap of the 30 ms pickup or rolled-chord onsets without explicit Quantise. |
| T2 | Move one rolled-chord note +1 beat. | Its sub-grid offset is lost (FE offset rule). |

**Rev 3.5 canonical runs (procedures only; criteria = AC-KEY-01..05, AC-PH-01, AC-ALN-01, AC-EVD-01):** K1→AC-KEY-01/02, K2→AC-KEY-05, K3→AC-KEY-03/04, K4→AC-KEY-04 real touch, P1/P2→AC-PH-01, T1→AC-ALN-01, evidence→AC-EVD-01.
| Run | Procedure |
|---|---|
| K1 | At 3 zooms and both hosts: key/row alignment ±1 px [M]. C4 label on MIDI 60. Keys scroll and zoom with notes. Both themes. |
| K2 | Play F-A: selected-layer sounding keys light with a non-colour cue, including sustain/release tails. With engine state unavailable, highlight is disabled. |
| K3 | Editor at row ≥ 24 dp: tap anywhere in the pitch row of the keyboard → audition. At < 24 dp: display-only state shown and no sound. Ribbon keys: never sound. Tap, drag, cancel on keys in Draw and Erase. Expect audition only. Then diff notes, history, selection, loop, take and capture buffer; all must be unchanged. Force pointercancel, blur and device unplug: no stuck note. |
| K4 | Touch-target validation of phone keys, white and black. **Prerequisite for accepting phone audition.** |
| P1 | Both hosts at 90 and 140 BPM: playhead within 1/16 note of audio, across wrap and silent tail. **Evidence:** deployed phone + desktop screen recordings with audio, plus a separate real-touch recording. |
| P2 | Position unavailable: no line at all; ruler and range visible. |

## 5. Backend deterministic tests [BE] (proposed, separate from canonical; to run)
- **D1:** 200 repeated preview updates and then cancel → state byte-identical; preview positions show no drift against a single-step computation from the baseline.
- **D2:** many preview updates → one commit → undo → redo; IDs and values exact at each step.
- **D3:** changing grid, snap, BPM confirmation, meter or view → working notes and raw bytes unchanged.
- **D4:** quantise scoped to the selection moves starts halfway; unselected notes and the source are unchanged.
- **D5:** switching ribbon ↔ editor host keeps note IDs, selection, notes and loop.

**Transport**
- **D6:** snapshot `unavailable` → no playhead number or progress; Paste at playhead disabled.
- **D7:** pause → playhead frozen across snapshots.
- **D8:** seek → playhead unchanged until the confirming revision arrives, then at the confirmed position.
- **D9:** wrap → position returns to loop start with a new revision; a note at e is not double-triggered.
- **D10:** stop → behaviour as agreed at integration; record it, do not assume.

## 6. Proposed measurement choices [M] (not canonical)
- Grid region at least ~55 % of a 390×844 viewport.
- Ruler/grid/key alignment ±1 px at 3 zooms.
- Playhead drawn at the latest snapshot position (no interpolation unless the backend sanctions it).
- No toolbar wrap at 360 px.
- 6 px sub-line visibility cutoff.
- UX-A P1 tolerance: 1/16 note.

## 7. Open items
- **Resolved precedence:** Rev 3.5 AC-KEY-04 supersedes the older key-column tap-selection behavior; do not implement both on one tap.
- **Engine dependencies:** authoritative position (P1/P2 blocker); sounding-pitch state (K2); audition isolation from take and capture buffer (K3). Integration must raise these if no existing policy.
- **Phone key touch-target validation (K4).**
- **AC-RIB-11 vs the Trim exclusion:** recorded as a lead-directed deviation. The canonical file is not edited.
- **Backend exact transport contract:** stop policy, seek outside the loop, snapshot cadence. This blocks the moving-playhead acceptance.
- **[I] items:** snap tie/group anchor; quantise duration/swing/collision; non-4/4 support; existing engine units/origin.
- **Editor viewport expansion limits:** engineer choice, not a blocker.
- **Settled elsewhere / out of scope:** pickup repeat vs first pass (OQ-1) and provisional dp values (OQ-3). Not decided here.
