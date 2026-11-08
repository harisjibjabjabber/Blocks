# Blocks — usability test script (PROPOSED rev 2; not yet run)
Add probe (rev 2): play a rubato phrase with no steady pulse, then ask "What did Blocks do with that?" to check that the no-pulse state is understood.
**Participants:** Haris + 4–5 keyboard players (mix: jazz/improvisers, producers fluent in a DAW, one touch-first beginner). **Setup:** Android phone + USB keyboard; Fold if available; Chrome desktop with keyboard; sustain pedal plus any spare pad/button the participant already has (no spare pedal required). Record screen + hands (consent). **Duration:** 45 min. **Moderator** reads tasks verbatim, does not demo.

## Intro (3 min)
"We're testing the app, not you. Think aloud. You can stop any time."

## Tasks
| # | Task (read aloud) | Success | Measures |
|---|---|---|---|
| 1 | "Get the app ready to play your keyboard." (web: first visit) | Plays a note heard through Blocks | Time, touches, confusion about permission/sound |
| 2 | "Noodle for a minute. When you play something you like, keep it." | Captures without being told the word "Capture"? | Discoverability, touches, did they look for Record? |
| 3 | "Does the loop sound right? If not, fix where the bar starts." | Beat one correct | Which control used; did they confuse with tempo? |
| 4 | "It's counting it at double speed. Fix that without changing how fast it plays." | Uses ½ control | Grid vs tempo understanding |
| 5 | "Hear exactly what you originally played." | Uses Original take | Time to find |
| 6 | (Multi-part build only) "Add a bass part on another layer with a different sound." | Second capture in layer 2 | Target understanding; join-at-boundary surprise? |
| 7 | "One note in the bass is wrong. Fix it." | Correct pitch/time | Touch accuracy (first-try select rate → AC-PR-05), loupe use, mis-edits |
| 8 | "Make these three notes shorter and quieter." | All three changed | Multi-select method, velocity control |
| 9 | "Tighten the timing a bit, but keep the feel." | Quantise < 100 % | Strength understanding |
| 10 | "Undo everything you did in the editor." | Back to pre-edit | Undo labels |
| 11 | (Optional) "If your keyboard has a spare button or pad, set it up so you can keep an idea without touching the screen." | Spare control mapped to Capture; sustain/keys untouched | Conflict-warning comprehension; did they expect it to take over keys? |
| 12 | "Send this to your laptop as MIDI and as audio parts." | Export completed | Option comprehension |
| 13 | (Fold) "Unfold the phone and keep working." | Continues without loss | Layout trust |
| 14 | (Moderator unplugs keyboard mid-phrase) "What happened? Carry on." | Recovers | Stuck notes, comprehension |
| R4 | (Rev 3.2.1, audition — unresolved OQ-1) Play a phrase with a pickup into bar 1, Capture, and listen to the loop twice: once with the pickup replaying before every repeat, once with it on the first pass only (moderator switches; no control in the UI). "Which sounds like what you played?" | Preference recorded with reason | Expectation of pickup behaviour; seam artefacts |

## Post-task questions
- After Capture, did the immediate loop help or annoy? Would you change the setting?
- What do "Count it as" and "Beat one" mean to you, in your own words?
- Did you ever do something you didn't intend in the editor? What?
- (R4) Did the pickup replaying before each repeat sound right, or should it play only the first time? (Unresolved question; record, don't lead.)
- SEQ (1–7) after tasks 2, 3, 7, 12.

## Analysis
Report observed counts vs the spec's estimated walkthrough (spec §5); list mode slips, mis-taps, and vocabulary misunderstandings; mark each finding with severity (blocker / major / minor). Results must be labelled with n and conditions; do not generalise.
