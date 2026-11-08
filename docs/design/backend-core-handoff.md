# Piano-roll core engineering handover

Updated 2026-11-08 22:09 Europe/London (UTC). Owner: Blocks · Backend Engineering.

## Status and integration boundary

Design review and interface guidance only. No production code, repository checkout, commits, pushes, or engine/browser verification performed by Backend. Piano Roll owns consolidated scope/acceptance in `piano-roll-correction-brief.md`; do not treat this note as a competing brief. Daw Bot owns integration through the one existing coding project only. Backend means application core/data/playback, not a new server. Audio/Capture specialists retain scheduler, pedal and capture ownership.

PM reports current `7ef7982` has no engine loop-position API. This has not been independently checked against source. No moving or estimated playhead until authoritative position is available. No guessed numerical progress or paste-at-playhead. No acceptance claim for the current build.

## Existing design references

- `spec.md` lines 62–104: rev3.3 editor precedence, explicit tools, cancel/revert, quantise preview, read-only loop and history.
- `spec.md` lines 173–177 and 491–516: immutable take, monotonic timestamps, separate synthetic releases, grid vs quantise, IDs, preserved CC64/expression.
- `state-machines.md` lines 151–185: one release/commit, second-finger cancellation, quantise Cancel/Apply.
- `ribbon-contract.md` lines 40–66 and 90–92: ruler/range metadata, silent tails, playback-only clipping.
- Cite existing `acceptance-criteria.md` AC-ED-01–15 and AC-RIB-01–13 unchanged. UX now reports rev3.5 amendment IDs AC-KEY-01–05, AC-PH-01, AC-ALN-01 and AC-EVD-01 in that file; use those as canonical acceptance rather than creating duplicate criteria. The engineering scenarios below are supporting fixtures, not replacement IDs. See also `HANDOVER.md` and `frontend-handover-20261108.md` for continuation.
- `LIMITATIONS.md` lines 3–16: proposed design is not evidence of implemented APIs. Static playhead examples are not measured playback.

## Proposed minimal shared interface, pending source verification

1. Stable note/layer IDs; MIDI pitch 0–127, positive duration, velocity 1–127. Retain raw source bytes/timestamps separately and immutably. Do not migrate storage based on design assumptions.
2. Recommend adapter-facing seconds relative to a declared take/sketch origin, retaining engine precision. Verify actual engine units/origin/precision before implementation. Grid quarter-note beats = `(seconds - beatOneSeconds) * BPM / 60`; meter groups bars. Free-time uses seconds without invented beats.
3. Compact and expanded roll use identical musical IDs, state and coordinate conversions; only viewport changes. Grid, tempo interpretation, meter, snap settings and viewport changes alone do not rewrite stored note times or quantise a performance.
4. Begin records baseline/revision; Update computes preview from baseline, never accumulated rounded deltas; Commit applies one labelled reversible patch; Cancel/no-op adds no history. Undo/redo restores exact values and IDs. Second finger cancels before navigation; pointercancel/Escape equivalent cancellation is proposed.
5. Snap affects only targeted gesture preview/commit, preserving group offsets. Explicit quantise remains scoped Preview/Cancel/Apply. Working-note edits do not alter source MIDI, CC64, bend or pressure. Synthetic playback releases never enter raw take.
6. Proposed loop interval `[start,end)`, same unit/origin, end > start. Onset exactly at end must not double-trigger. Start/end handles affect their own endpoint; Slide preserves length; note edits do not change loop metadata. Never derive loop length from last note or auto-trim musical silence. Held-duration clipping is playback-only.
7. Future engine-owned playback snapshot proposal: `{availability: unavailable|available, state: playing|paused|stopped, positionSeconds: number|null, revision}`. Origin/units must be declared; unavailable means null, not zero. Render authoritative snapshots without advancing a frontend clock. Pause freezes confirmed position; Stop-at-loop-start is a proposal requiring agreement. Seek display changes only after engine confirmation; wrap publishes start with new revision. Existing audio scheduler remains authoritative.

## Keyboard amendment recorded from team discussion

UX decision in room: C4 is MIDI 60 (middle C) throughout the app, with a small middle-C marker. Use one mapping for keyboard and notes.

Full editor uses true black/white key shapes and C-with-octave labels; shared pitch-row transform scrolls/zooms with notes. UX dimensions: at least 40 dp wide, about 28 dp permitted on phone. Live strip is about 16–20 dp wide and display-only: no audition.

Full-editor audition is enabled only when pitch rows are at least 24 dp tall. Hit area is the entire pitch row across keyboard width, not just painted black-key shape. Smaller row zoom is display-only. Confirm phone touch usability rather than assuming these dimensions suffice.

Audition uses a separate audio path, never an edit or capture event and never an undo entry. Sounding-key highlights require authoritative selected-layer playback state including pedal-held notes, with non-colour-only feedback; leave lighting off when unavailable. Do not infer sound from note rectangles/playhead. Audio owner must agree release/cancellation behavior to avoid stuck auditions.

## Deterministic supplemental checks

- Many preview updates then Commit yields one undo entry; Undo restores exact baseline, Redo exact result. Cancel/second finger yields no entry. Identical preview input yields identical values without drift.
- Grid/BPM/meter/snap/viewport setting changes leave working-note times and source byte-identical. Off-beat pickup and rolled chord remain off-grid at every zoom, absent an explicit edit/quantise.
- Scoped 50% quantise moves selected starts halfway toward agreed targets; untouched notes/source remain unchanged; Cancel restores baseline and Apply is one history transaction.
- Compact→expanded→compact retains IDs, selection, notes and loop. Notes, ruler, boundary lines and future playhead use one time transform; keyboard and pitch rows use one pitch transform.
- End-onset loop case never double-triggers; silent tail and original held duration survive boundary edits. Pedal and synthetic-release behavior needs Audio/Capture fixtures.
- Unavailable position shows no playhead/progress. Future play/pause/confirmed seek/wrap must match engine state and continue through musical silent tails. UX proposed timing check: within a 16th note at 90/140 BPM; not yet measured or accepted.
- Keyboard-to-row alignment within 1 px at three zoom levels; MIDI 60 visibly labelled C4. Audition never changes source, working notes, capture or undo history. Selected-layer sustain lighting only when supported.

## Open decisions / next actions

Integration must inspect actual engine contracts, not assume these proposals exist. Resolve snap tie-breaking/group anchor, quantise duration/swing/collision policy, loop minimum, pickup/start-crossing behavior, pedal state reconstruction, Stop/seek-outside-loop behavior and audition lifecycle with component/audio/capture owners.

Piano Roll consolidates this input with Frontend/UX into the single correction brief. Existing Project implements; Backend must not make competing repository writes. Required evidence remains populated real-browser interaction checks at phone/desktop widths and separate real-touch evidence; screenshots/unit tests alone are insufficient. No such verification was performed in this review.

## Continuation and usage-aware handover

User reports 90% usage and requests documentation as work proceeds, with pushing/documentation prioritized by 97%. Those percentages are user-reported, not a live usage measurement. Keep this handover and the owner brief current after actual changes. Lead/integration owner must preserve production changes through the existing Project and record commit/deployment/evidence locations; this local design note is not a pushed repository artifact.

Backend guidance already delivered to Piano Roll and Frontend. No backend implementation is running. Continue from open decisions above; do not repeat broad research or create another Project.
