# Blocks frontend handover — 8 November 2026, 22:09 Europe/London

## State and ownership
Frontend constraints delivered to Piano Roll component owner for one consolidated handoff to Daw Bot / existing integration Project. No repository edits, commits, pushes, app tests or deployment were performed by Frontend. Current app failures are lead-reported, not independently verified here. Source design files label themselves PROPOSED; team uses rev3.3/3.4 as the correction reference, not proof of implementation.

## Source of truth
- spec.md §0c, gestures.md §§10–11, state-machines.md.
- acceptance-criteria.md AC-ED-01–15 and AC-RIB-01–13: preserve IDs; rev3.5 additions AC-KEY-01–05, AC-PH-01, AC-ALN-01 and AC-EVD-01 are the canonical amendments; keyboard replaces the plain pitch strip of AC-ED-02. See HANDOVER.md for the package entry point.
- rev3.3 editor frames17–27 and rev3.4 ribbon-contract.md.

## Keyboard amendment — team decisions recorded 22:07–22:09
- UX specified C4 = MIDI60 (middle C), with a small middle-C marker. Use this convention everywhere; no pitch-data change.
- Full editor uses true black/white piano shapes at left; team proposal width >=40dp, about28dp on phone. Live strip uses16–20dp. Same pitch-row mapping as notes; vertical scroll/zoom must stay aligned within1px at three zoom levels. Labels C3/C4 etc.
- Live-strip keyboard is display-only: no audition.
- Full-editor audition hit test uses full keyboard width for each pitch row, not painted black-key shape. Audition enabled only when pitch rows >=24dp; below that keyboard is display-only. These dimensions still require real-touch validation, not a claim of accessibility compliance.
- Audition routes separately to audio, never note edits, capture events or undo history. Define note-off/cancel lifecycle with audio owner before acceptance.
- Playback highlights require authoritative selected-layer sounding pitches, including pedal-held notes. No guessed highlights from playhead/note rectangles. If unavailable, playback lighting stays off. Non-colour cue required in both themes.

## Frontend implementation constraints
- Shared renderer/time-pitch transform across ribbon/editor: notes, ruler, grid, loop bounds, playhead and inverse pointer conversion. Fixed keyboard aligns to vertically scrolled rows.
- Accurate coordinates do NOT mean snap: pickups, rolled chords and expressive timing remain off-grid as recorded. Grid visibility/density changes never mutate notes. Quantise only explicit, previewed, reversible.
- Compact Draw/Select/Erase toolbar plus specified Capture; secondary actions in overflow, undo/redo always visible; grid gets primary area, velocity lane retained. Fold/desktop adapt panes without dropping tools.
- One finger edits; two pan/zoom. Second touch cancels pending edit before navigation. Preview from baseline; commit one labelled history patch; cancel/no-op makes none. Draw on existing note selects, never deletes; erase stroke one undo; Alt bypasses snap.
- Loop modes differ: editor locked read-only bracket (AC-ED-11); Play ribbon handles per ribbon-contract. Do not add loop handles to editor.
- Keep immutable raw MIDI, pedal events, original timing/ghosts and musical silent tails unchanged.

## Core proposals — not verified APIs
Backend proposed adapter seconds from declared origin, preserving existing storage precision; grid beats=(seconds-beatOneSeconds)*BPM/60. Engine snapshot availability/state/positionSeconds/revision; unavailable position=null. No frontend wall-clock extrapolation. Pause holds engine position, seek awaits confirmation. Stop-at-start and loop [start,end) require owner/audio confirmation. Playback-only clipping must not shorten stored notes/tails. Sounding-pitch interface is still required.

## Acceptance and evidence still outstanding
Use existing acceptance IDs; do not substitute this summary for them. Run populated-take browser checks on phone/Fold/desktop, both themes: pointer/touch move, resize, draw, erase; exact commit and undo/redo; cancellation; pan/zoom alignment; keyboard commands/ARIA; editor loop lock versus Play handle edits; raw-event identity and silent-tail preservation. Fixture should include early pickup, rolled chord, overlaps and sustain.
Keyboard amendment: row alignment within1px at three zoom levels, MIDI60 labelled C4, correct display-only/active zoom boundaries, no wrong-pitch audition or edit/capture side effects.
Canonical AC-PH-01 (rev3.5): engine-synchronised play/pause/seek/wrap and silent tail, audiovisual error <=one16th at90/140BPM. Requires recordings, not screenshot proof; definition is documented, execution remains unverified. Hide playhead entirely while position unavailable. Phone+desktop deployed recordings and real-touch recording requested; none collected here.
Real-device audio continuity, TalkBack, Samsung/Fold and small-key usability remain unverified. No claim of done/accepted build.

## Next integration steps
Piano Roll owner consolidates with Backend/UX; lead alone coordinates existing coding Project and repository push. Resolve exact existing engine units, sounding-note/audition lifecycle and stop semantics there. Implement, then collect actual populated-browser and device evidence. Append new outcomes with date, build URL/commit, evidence paths, failures and remaining blockers; keep proposed versus implemented versus verified explicit.

## 22:10 Europe/London documentation reconciliation
Verified rev3.5 acceptance IDs directly in acceptance-criteria.md. That file is authoritative; descriptive checks above are engineering notes, not a competing acceptance specification. AC-KEY-01–05 cover keyboard/audition/lighting, AC-PH-01 playhead, AC-ALN-01 faithful transforms, AC-EVD-01 deployed interaction evidence. Lead owns repository checkpoint; no push verified here.
