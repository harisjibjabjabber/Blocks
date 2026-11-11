# Phase 13: space and output headroom

Initial implementation, now followed by [Space/Creative/punch refinement](space-creative-and-punch-followup.md). Implemented 11 November 2026 after the [research/review spike](phase13-quality-and-reverb-spike.md). Portable C++ processors serve the standalone browser host and future native hosts. These are original algorithms and voicings, not replicas of private Valhalla/Soundtoys code or physical plate circuits.

## What changed and why

| Feature | Actual implementation | Intended result |
|---|---|---|
| Output headroom | Master gain before a stereo-linked lookahead gain limiter; removed final native-rate tanh | Ordinary levels preserve the shaped sound; lowering Volume can prevent limiting |
| Plate | Eight-line orthogonal FDN with short delays, stereo input allpass diffusion and stronger early contribution | Immediate dense space around plucks |
| Hall | Same reusable network, longer line/diffuser lengths and reduced early contribution | More gradual, expansive space rather than merely a longer decay knob |
| Shimmer | Hall-scale tank, dual-read-head audio pitch shifting on two feedback axes, conservative energy debit and 63-tap pre-shift FIR | Growing harmonic texture inside the wet tail; ±12-semitone range, including downward shifts |
| Movement | Independently phased slow delay modulation | Subtle evolving tails, with a broader creative range |
| Wet control | Predelay, low cut, damping, size/diffusion, modulation, wet width/trim and linear dry/wet mix | Keep dry attack and bass clear while shaping space |
| Wet display | Native read-only 128-sample wet-left trace, sampled every4 frames and scaled by master before protection | Real moving waveform; Off/Stop/Panic settle or clear it rather than run a decorative animation |

The protection stage is transparent when no gain reduction is active; quiet audio following a hot peak still follows its recovery. Lookahead is48 samples at48kHz; total fixed output bus latency is72 samples including Suite alignment. The sample ceiling is.98, with80ms recovery and smoothed lookahead attenuation. It is **not certified true-peak protection**. New public output telemetry exposes input/output peaks and gain reduction; Volume's tooltip shows the pre-protection level and reduction.

Reverb is one global processor after Suite → Width → Delay, before common master/protection. Clean Sub bypasses the reverb send, keeps its24-sample alignment and joins the shared output protection. Mix0/Off preserve dry audio after smoothing. Off ramps wet/send down while internal tails advance and may be recovered by re-enabling; Panic/reset discard histories immediately. Reverb preparation allocates candidate storage atomically; render/configuration/panic do not allocate. Rapid delay changes finish the current50ms crossfade before using the latest queued target. Continuous gains and tone/movement settings smooth over20ms.

The Reverb Output card lives in Sauce with Plate/Hall/Shimmer, Decay/Tone/Mix and power. Shimmer reveals Amount/Interval; Space & tone reveals the advanced dials. Gestures, Undo, cancellation, double-tap defaults and current-file persistence use the existing instrument system. Default Reverb is off, with a useful stored25% mix. Scope is a display trace, not a spectral analysis or stereo meter.

## References and boundaries

- [ValhallaPlate controls](https://valhalladsp.com/2015/11/08/valhallaplate-the-controls/): tuned diffusion and restrained tail movement informed the goals.
- [VintageVerb modes](https://valhalladsp.com/2023/02/10/valhallavintageverb-the-modes/): distinct onset/modulation character informed Hall voicing; randomized and chaotic variants remain future refinements.
- [ValhallaShimmer controls](https://valhalladsp.com/2010/11/27/valhallashimmer-the-controls/): pitch-shifted audio feedback and diffusion inform the Shimmer topology. No proprietary algorithm/code is claimed.
- [SuperPlate manual](https://www.soundtoys.com/wp-content/uploads/SuperPlate-Manual.pdf): predelay, input filtering and frequency-dependent decay informed clarity controls. Its preamps/plate models and Auto-Decay are not implemented.
- [Dattorro](https://aes.org/publications/elibrary/elibrary-page/?id=10160) and [Signalsmith's public FDN implementation](https://github.com/Signalsmith-Audio/basics/blob/main/include/signalsmith-basics/reverb.h) were design references. The delivered code uses an original shared FDN rather than copying those implementations or shipping a Dattorro plate.

## Focused evidence

- Reverb helper:10 groups. ABI64, strict validation, exact predelay/Off/Mix0, stereo tails, width, lifecycle, decay, extreme settings, actual shifted spectral energy, high-band filtering and rapid retargeting.
- Integration:7 groups. Actual synth dry bypass, Clean Sub isolation, tails after voice release, block-size invariance, allocation-free rendering/configuration, atomic state retention, antiphase input and read-only live scope.
- Independent transition review:2 groups. Repeated12→0→−12 interval changes, neutral-pitch crossfade, queued size/predelay edits and panic.
- Output: basic limiter and3 independent safety groups. Randomized five-rate pre-clamp gain reconstruction error≤2.14e−7; linked stereo maintained. Hot16-note/Sub input9.01925 limited to.98; master.01 reduced input to.0901924 with zero reduction. Low-level actual synth master scaling is exactly linear.
- Existing functional WASM regressions pass. Timing-sensitive Glide, Width and Clean Sub tests now account explicitly for declared output lookahead; their behavioral criteria were preserved.
- Browser: compact Reverb controls, persistence and wet scope pass14 groups across320/390/760/1024/1440; root also inspected phone/desktop images. Existing standalone, sound/routing and cache-recovery checks pass. All86 frontend Node tests pass, including the wet-scope protocol.

At nominal2s decay, the measured broadband impulse EDC RT60 was1.8013s in the8kHz fixture. Decay is nominal midband RT60; filtering, modulation and pitch shifting change measured band decays. A30s/max-Shimmer/max-modulation test remained finite and decayed over16s; this is a bounded fixture, not proof over every time-varying signal.

At48kHz with maximum Shimmer,8s decay and7kHz damping, integrated octave/fundamental energy ratios were:

| Input | Sustained | First2s of released tail |
|---|---:|---:|
| C2 | −9.29dB | −6.99dB |
| C3 | −16.90dB | −14.20dB |
| C4 | −19.26dB | −11.87dB |

This measures bands around the fundamental/octave, including granular sidebands. A single exact octave bin understated the shifted energy. It establishes a meaningful processing range, not listening approval. A narrow5.5kHz-input/16kHz-sample-rate upshift test measured its unwanted5kHz folded band at−104.23dB relative to the retained fundamental; this is not universal alias-free certification.

Four actual-instrument phrases—bass pluck, arpeggio, sustained chord and bright lead—produce32 eight-second WAVs in workspace `work/phase13-auditions`: dry/Plate/Hall/Shimmer, each fixed gain and separately matched to−30dBFS RMS. No peak normalization or extra post-render limiter. Source patch/events are in `phase13_reverb_audition.cpp`; metrics accompany the files. These fixtures support listening; automated tests do not establish commercial sound-quality parity.

The older-named `phase12_suite_audition.cpp` now exports current Harmonics comparisons at one shared−36dBFS RMS target. Removing the output tanh exposed larger crest factors: the previous−30dBFS target would overrun full scale in three matched files (worst1.4264). Lowering the common target preserves relative transients and equal RMS without per-file peak normalization or another limiter. Current exports are separate from the historical Phase12 listening evidence.

Final local timing, including scope collection: Windows/Node22.23.4/WASM,48kHz/128 frames, four held notes, seven copies on each oscillator, Ladder drive12/resonance.6/cutoff2kHz, Suite and Delay off. Three trials of64 warmup/192 measured blocks, isolated from our browser tests. Values below are trial medians except the maximum column.

| Reverb | ms per audio second | p99 block ms | Worst observed ms |
|---|---:|---:|---:|
| Off | 542.91 | 1.548 | 2.269 |
| Plate | 563.01 | 1.603 | 1.631 |
| Hall | 564.64 | 1.639 | 1.876 |
| Shimmer | 571.65 | 1.634 | 1.972 |

The block deadline is2.667ms. These measured loads stayed within it; this is not a universal desktop/phone guarantee or a whole-machine CPU percentage. Trial noise affects maxima; do not infer Shimmer is faster from a lower p99. Raw evidence: workspace `work/phase13-review/benchmark-final.txt`.

## Moving Space and remaining work

The prepared delay lines, diffusion, stereo injection, damping and modulation form a reusable foundation for Moving Space. That future effect will need its own short reflection network, envelope follower/polarity, controlled continuous delay movement and tail suppression. Reusing this foundation does not mean the Flume-inspired effect is already delivered, or that his production method is known. MIDI Pitch Echo remains separate: it retriggers notes, whereas Shimmer processes audio.

Listening approval, physical-device performance and commercial-plugin parity remain open. Extreme wet trim/input can engage protective bounds; the tank has an emergency±32 write bound, not a modeled analog saturation stage. Existing high-polyphony/seven-copy workloads can exceed the audio deadline with reverb off. Further oscillator motion/filter-transition and unison-energy audits remain on the quality backlog. Freeze, Auto-Decay, preamp models and arbitrary reverb instances/routing are not in this pass.
