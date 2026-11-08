# Blocks design package — handover (updated 8 Nov 2026, 22:10 Europe/London)

Owner: Blocks · UI/UX & Interaction Design. Status: design docs/prototypes only; everything is PROPOSED unless integrated and tested in the app.

## Start here
1. README.md, then spec.md (§0 north star, §0a Graphite/Paper hybrid, §0b range view, §0c editor, §0d ribbon).
2. acceptance-criteria.md — AC-ED-01–15 (editor), AC-RIB-01–13 (ribbon), Rev 3.5 amendments (AC-KEY, AC-PH, AC-ALN, AC-EVD).
3. Visual reference: hifi/hybrid/{dark,light}/ PNGs (frames 17–27 editor, 28a–d ribbon), hifi/prototype/index.html. Design Page: https://cursor.com/canvas/store-f35d3766-9730-49fd-bfb8-f933d5a99d43/b3414639-7db0-4009-a052-52d067358bc9
4. ribbon-contract.md, gestures.md §9–11, state-machines.md, tokens.json, LIMITATIONS.md.

## Current state
- Build 7ef7982 NOT accepted (crowded controls, bare roll, no moving playhead, missing browser checks). Correction brief owned by Blocks · Piano Roll; integration via the one existing coding project through Daw Bot.
- UX sign-off requires real deployed-build interaction evidence against the criteria above.
- Open: engine playback-position and sounding-pitch contracts (Backend); real-device touch validation; OQ-1 repeating pickup.

## Review principles (Haris)
Sleek, premium, minimal, never at the cost of usability or accessibility. Departures from mockups must be clear improvements. Preserve original timing, raw MIDI/CC64 and silent tails; quantise explicit and reversible.

## Team handover files (piano-roll correction, 8 Nov 2026)
- piano-roll-correction-brief.md (rev C.3) and piano-roll-handover.md (Blocks · Piano Roll; consolidated index)
- frontend-handover-20261108.md (Blocks · Frontend Engineering)
- backend-core-handoff.md (Blocks · Backend Engineering)
All saved locally; none implemented or tested. Commit pending via Daw Bot's integration checkpoint.
