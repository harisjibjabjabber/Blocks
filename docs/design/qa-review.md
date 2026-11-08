# Blocks — independent QA review points (PROPOSED rev 2; item 18 added rev 3.2.1)
For a reviewer who did not write this design. Each item: what to check, how, and what counts as a fail.

1. **Grid vs timing integrity** — Export "Original take" MIDI before and after every review correction and quantise/undo cycle; diff note-on/off times. Fail: any change. (AC-REV-02)
2. **Honest readiness** — Connect a device but send nothing; deny permission; use Safari/Firefox Android; serve over http. Fail: any "receiving"/"connected" claim not backed by a message, or a generic error message.
3. **Touch keys honesty** — Confirm on-screen keys never appear as an Input device and the label always says "this device".
4. **Mode slips** — In Draw, tap existing notes 20×: none deleted. Switch tools rapidly: indicator always matches behaviour (≥ 2 indicators).
5. **Gesture conflicts** — Two-finger pinch starting on a note: no note moves. Second finger mid-drag: edit reverted, no undo entry. Ruler drag never edits.
6. **Target size audit** — Measure hit areas at 320/360/412 widths and 200 % font. Fail: < 48dp (except expanded note hit regions) or < 8dp gap.
7. **Colour independence** — Review grayscale screenshots of every state in `wireframes/` and the build. Fail: selection/mute/target/error only distinguishable by colour.
8. **Screen reader pass** — TalkBack + NVDA/Chrome: complete walkthrough steps 1–9 without sight; note list order and custom actions work; captures announced.
9. **Fold & rotation** — Fold/unfold/rotate during review, drag, export. Fail: audio stops, review closes, selection cleared, or controls overlap hinge.
10. **Failure injection** — Force save errors, storage full, kill during save, disconnect during held notes, audio interruption (call/alarm). Fail: lost edits, stuck notes, silent failure.
11. **Auto-play reversibility** — After Capture, verify Stop, Discard, Undo, and "Stay silent" setting each work and persist correctly.
12. **Copy audit** — Grid controls never use the words "tempo change"/"speed"; playback tempo never claims to fix timing.
13. **Latency feel** (subjective, with Haris) — Ribbon and audition responsiveness; note any perceptible lag. Not a measured claim.
14. **PROPOSED labelling** — Until built and tested, every wireframe and doc keeps the PROPOSED label; no doc claims user-test results.
15. **Lead decisions (rev 2):**
    - Tempo stays locked after the first capture.
    - No fabricated alternatives or confidence percentages.
    - The no-pulse state is reachable.
    - Capture while playing never includes future notes; held notes get playback-only synthetic releases, absent from the raw take and from MIDI export.
    - Queued join happens at the boundary.
    - Full slots prompt an explicit choice.
    - No default takeover of CC 64 or playable keys.
    - Hidden/background never claims continuous capture.
    - Overload gaps are flagged.
16. **Copy hygiene:**
    - No unsourced sound-asset names; use placeholders only.
    - No unchecked browser recommendations.
    - Every number is labelled as a proposal.
17. **Visual north star:** Review the dark theme in a dim room and in sunlight. Check AC-VIS-01…04. Polish must never cost a target, contrast, or a non-colour cue.
18. **Repeating pickup (unresolved, spec §0b.9 OQ-1):** the pickup replaying before every repeat is PROPOSED behaviour, not an engine contract. Audition both variants (replays every repeat vs first pass only) on 3+ phrases with pickups; record which musicians expect, and any double-attack or flam at the loop seam. Fail: the raw take's pickup time changes in either variant. Do not add a user control; this is a decision to make from evidence.
19. **Provisional gesture numbers (OQ-3):** measure edge auto-scroll (32 dp), magnifier offset (72 dp), slide-up override (40 dp), Undo toast (≥ 6 s) and zoom limits on phone, Fold and desktop; record proposed vs chosen values.
