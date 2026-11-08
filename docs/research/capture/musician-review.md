# Ambiguous examples for Haris to review later (plain language)

These are **SYNTHETIC** situations where more than one answer is musically reasonable. For each one I list what Blocks would pick by default (the current design proposal) and what would be one tap away. **They don't block early regression tests.** The fixtures keep their provisional labels (D9) until you've listened. Nothing here is a claim about accuracy.

How to review: listen to the default, then the alternative, and say which you'd want by default, or "either is fine". Fixture ids are in brackets.

| # | What you played | Blocks would default to | One tap away | Question for you |
|---|---|---|---|---|
| M-01 | A phrase, then a pedalled chord left ringing for about 2.7 s with no new notes, then a second phrase [J04] | Only the second phrase (the ringing chord counts as a pause) | Both phrases | When a chord rings out between ideas, is that the end of the first idea? |
| M-02 | One line with a chord in the middle that you let ring for 2 s before carrying on [H06] | The whole line, ringing chord included | Only the part after the chord | Same as M-01, but here the ringing chord feels mid-sentence. Does Blocks need to tell these apart? |
| M-03 | A slow melody in long notes: it could be 120 (half notes) or 60 (quarter notes) [J08] | 120 BPM, 8 bars (16 s) | 60 BPM, 4 bars: the same 16 s, so the loop sounds identical | Which tempo should the bass and drums lock to? |
| M-04 | A ballad at about 66 BPM [H03] | Proposal: 66 BPM, 4 bars (14.5 s). Note that a rule preferring 80-160 BPM would pick 132 | 132 BPM, 8 bars, the same 14.5 s | For ballads, do you think in the slow pulse or the doubled one? |
| M-05 | A jazz waltz, bass on 1 and chords on 2 and 3 [J09] | 3/4, 8 bars | 6/4, 4 bars (same length) | Does 3/4 vs 6/4 matter to you for layering? |
| M-06 | On bass, a 2-bar riff played twice in a row [L02, LH2] | Loop the last complete statement (2 bars) | Both statements (4 bars) | If the riff varies slightly the second time, which one do you want looped? |
| M-07 | A bass or melody that starts with a pickup note just before bar 1 [J05, H04, L01] | The pickup plays before the first loop only (staged proposal) | The pickup on every repeat, where there is room at the end of the loop | Should a pickup come back on every repeat? |
| M-08 | A pedalled chord at the end of the loop that would ring past the loop point [L02] | Let it ring over the start of the next repeat (staged proposal) | Cut it at the loop point | Does a tail over the loop point sound right or muddy? |
| M-09 | A long stretch of pedal-down playing with no gaps, ending in a new vamp [J02, H02] | The last 4 bars (a bounded fallback, labelled as such) | 8 bars, or step back one candidate | How far back should Blocks look when you never stop? |
| M-10 | A few notes, a 1.7 s pause, then the real phrase [J10, H04] | The real phrase only | Include the first few notes | Are false starts ever part of the idea? |
| M-11 | Drums: a 1-bar groove played 4 times with a fill in the 4th bar, still playing when you press Capture [LH1] | The 4 complete bars (fill included); the unfinished bar is left out | 1 bar without the fill, or 2 bars ending with the fill | Is the fill part of the loop, or a one-off? |

Your answers become real labels, kept separate from the synthetic ones and used only with your consent (evaluation-plan §4).
