# Space, creative inserts and punch refinement

11 November 2026. Follow-up to [Phase13](phase13-reverb-results.md), implementing the user's Space-tab, self-ducking, punch and weird-sound requests. Runtime remains a portable C++ core with a separate browser host. Listening preference remains open; measurements do not establish parity with commercial effects or identify Flume's production method.

## Space and self-ducking

Width, Delay and Plate/Hall/Shimmer now live in a dedicated **Space** tab. Delay/Reverb have larger main controls and balanced desktop panels; phone controls stack. Sauce and Space retain independent keyboard visibility. Navigation does not change the patch, history, held notes or routing. The horizontally scrollable module strip reveals the selected tab on selection and resize without moving the document or overriding an ordinary manual swipe.

Reverb v2 is68 bytes: appended Ducking at offset64, default0, range0..1. The ducker follows the actual stereo input to Reverb, including upstream Delay. One linked gain attenuates only wet audio after width/trim; the dry signal and tank remain untouched. Master Volume is downstream. It reacts to incoming audio, not MIDI or predicted future notes; it does not truncate the stored tail. Peak detection time constants are1.5ms attack/50ms release, reduction3ms attack/180ms recovery, with a broad−60..−24dBFS soft level knee and maximum24dB reduction. It is distinct from SuperPlate-style Auto-Decay, which changes decay rather than just wet level.

At maximum Duck, input amplitudes.003/.02/.1 measured−3.78/−19.08/−24dB wet attenuation. A prior-tail test measured−.260dB before the next note,−24dB during it and−.112dB after recovery. Actual synth plucks reduced the first10ms of the existing tail to.12894 of its unducked energy and recovered to.93097 later. Mix0/dry and stereo proportions are preserved; Duck0 returns exactly to the unducked processor after settling. The native wet waveform is post-duck.

## Tight attack repair and matching

The user's missing-punch report exposed a real repeated-note defect. Tight could retain deep body attenuation through a gap, then use a15ms gain recovery that removed the following attack. An isolated-note attack/body ratio missed this: reducing body energy can improve that ratio while still erasing the leading hit.

Tight now recovers toward higher gain in.35ms, caps intentional onset lift at6dB instead of18, and releases negative body attenuation near silence. Bloom's gain law is unchanged; neither note ADSR nor note ownership is modified. The128-case actual CAPI matrix covers Sine/Saw,1ms/15ms attack, C2/G2/C3/G3, Tight−.25/−.5/−1 and Bloom, solo or moderate Compressor+Amp. Windows are aligned to `bs_output_latency`.

The old Tight path lost up to15.21dB in the first1–8ms. In the corrected Tight cases, leading-window change is at least+.5749dB and the following8–30ms at least+.3151dB; body does not grow, peak change stays under8.5dB and final limiter reduction is0. This establishes preserved attacks in those cases, not universal tonal approval. Before/after CSVs are in workspace `work/dynamics-punch-before.csv` and `work/dynamics-punch-after.csv`; the permanent gate is `dynamics_punch_tests.cpp`.

Manual compressor makeup trim already operated on top of Auto Makeup. Its existing−24..+24dB control is now clearly paired beside Auto as **Makeup trim**. It has the same state, default0, reset and Undo, with no duplicate gain stage. The actual browser/native test measured−24.00036dB for the requested−24dB change with Auto on and final limiter inactive.

## Reusable creative Sauce blocks

| Block | Actual DSP | Controls |
|---|---|---|
| Moving Space | Four-line orthogonal short tank, two input diffusers, envelope-driven bounded moving taps and genuine stereo dual-head pitched feedback;63-tap pre-shift bandlimit and an explicit shifted-wet blend | Mix/Motion/Space; Shimmer/Pitch/Trim in Details |
| Impact | Audio-derived onset/body followers, faster recovery from body reduction, hard-knee stereo compression, transient accent on the upper band and independent low foundation | Mix/Tight/Click/Body; Trim in Details |

Moving Space deliberately stays shorter than the main Hall/Shimmer reverb: nominal decay.08.. .8s. At default Space.35, impulse energy fell30dB in.0869s without Shimmer/.1626s at maximum Shimmer; the tested maximum-size variants stayed below.4s to that energy point. Maximum Shimmer measured its octave band+2.822dB relative to the retained fundamental; the direct shifted-wet branch avoids a merely measurable but buried pitch effect. Motion produced a1.746 matched-waveform difference in its fixture. These describe controlled test inputs, not every played sound.

Impact is a more aggressive percussive shaper than regular Harmonics Dynamics. It shapes incoming audio; it does not generate a kick oscillator or rewrite MIDI envelopes. Default repeated leading hits measured roughly+3.43/+3.25dB; the harder test increased attack/body contrast12.28dB while keeping the leading hit. Combine it with a bass source and the existing Pitch Drop for kick-like synthesis.

Both blocks are repeatable independent instances in the Add menu, with power, deletion, Details, reset, Undo and saved fields. A new typed **effects** subsequence supports16 prepared bus instances. Empty is neutral; adding one is explicit. The48-byte native node has stable ID/type/enable and nine floats; the776-byte config validates atomically. Buffers allocate during prepare, with no render/configure allocation. Moving Space is compact (~71KB/instance at48kHz), not16 copies of the full global reverb.

Signal order is note processors → voices/per-voice Fullness → creative bus effects in their subsequence order → Harmonics → Width → Delay → Space Reverb → master/protection. Clean Sub bypasses the creative bus. Existing mixed visual layout retains typed subsequences; the Bus tag explains the current fixed placement. Full cross-group routing and new LFO destinations remain later work. Structural creative edits fade to dry10ms, apply the latest pending topology and fade in10ms; retained IDs/types keep processor memory. Reorders do not panic held notes. Panic clears histories.

## Verification and cost

- All33 functional WASM targets pass, including the new128-case punch gate,7 creative processor groups,6 creative integration groups and updated Reverb12 helper/8 integration groups.
- All89 frontend Node tests pass.
- Browser Creative10/10, Trim/Space7/7 and final navigation5/5 pass with no exceptions. Earlier Space/Reverb16 groups and standalone/gesture checks pass. Independent UI review inspected320/390/1440 layouts, paired Trim and resize behavior.
- Four phrases render48 five-second fixed/matched Creative WAVs in workspace `work/creative-auditions`. All matched files use the same−42dBFS RMS target; no per-file peak normalization or additional limiter. Source patch/events and modes are in `creative_fx_audition.cpp`, with metrics beside the files.

Final local benchmark: Windows/Node22.23.4/WASM,48kHz/128-frame, four held notes, seven copies per oscillator, LadderDrive12/resonance.6/cutoff2kHz; Harmonics/Delay/main Reverb off. Three trials,64 warmup/192 measured blocks, no test browsers running. Medians except the final column:

| Creative chain | ms/audio second | p99 block ms | Worst observed ms |
|---|---:|---:|---:|
| Empty | 548.09 | 1.666 | 2.257 |
| Moving Space | 560.36 | 1.610 | 2.027 |
| Impact | 554.36 | 1.674 | 2.183 |
| Impact → Moving Space | 569.81 | 1.799 | 1.950 |
|16 Moving Space | 738.18 | 2.380 | 2.536 |

The deadline is2.667ms. These measured cases fit; the16-instance margin is small, timings vary, and adding other processors/voices can exceed it. No universal phone/desktop guarantee or hidden quality downgrade. Raw timing: workspace `work/phase13-review/creative-benchmark.txt`.
