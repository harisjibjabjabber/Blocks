# Synth product plan

Date: 9 November 2026. Status: product/design direction with a portable engine and first touch UI prototype; physical-device and listening acceptance are still outstanding.

## Product direction and current evidence

Blocks is a phone/Fold instrument played from a real piano or its touch keyboard, with capture and editable layers. The experience takes inspiration from the OP-1's immediacy and common instrument structure. The existing Blocks storyboard, quiet graphite surfaces, serif titles and real keys remain the visual reference. Desktop gets a wider composition of the same instrument.

Synth is the first product priority. Sampler, sample recording and a curated high-quality instrument library remain later work. A full synth can deliver the core product without the sampler.

An isolated, visual-only interaction study exists outside the app source. It demonstrates phone Perform/Shape and desktop layouts, filter/EQ points, bendable amplitude-envelope segments, hidden precision sliders, drift amount/speed, voice spread and drive. It does not demonstrate audible DSP, device latency or measured synthesis quality. No runtime feature is implied by this document.

## Expandable instrument surface

### Current listening direction and bounded calibration

The user's core brief is **“Sounds are most beautiful when taken to the edge of being broken”**: organic, raw and continually alive, with stable fundamentals, useful harmony and musical middle settings. Preserve that direction across bass and chords; motion and roughness are intentional, while unusable intermediate settings are defects to investigate. The latest listening feedback prefers Drive at its extremes but hears the middle as thin or phasy; mid-register body is more convincing than bass. This is a listening observation, not proof that the memoryless Drive transfer function introduces a phase shift. The original Fullness colour was attractive, but its volume loss was rejected. Do not recover that apparent body merely by increasing output or conceal oscillator cancellation with a bass boost.

The current ABI5 core retains the per-note filter envelope, Square, independent oscillator levels and velocity-sensitive settling introduced in ABI4, and adds envelope-aware movement plus enabled, ordered Drive/Fullness audio stages. The current scoped automated and independent UI checks pass; listening and physical-device acceptance remain separate. Settling returns toward the played pitch; ongoing voice movement should remain subtle and independent. This expressive system works while playing, without requiring recorded manual automation. It does not authorize the deferred distortion catalogue or an untested ladder substitution.

Keep curated Character distinct from **experimental Motion calibration**. The user now explicitly rejects coupling pitch to Character: Character must change tone colour only, while Motion owns pitch behaviour. The accepted 20-cent movement example is a useful reference, not the user's final upper limit. The user explicitly wants the upper end capable of sounding excessive so they can find their own sweet spot. Motion's expanded mapping therefore supersedes the initial 40-cent/8-cent experiment with maxima of 120 cents drift and 60 cents settling, while preserving the gentle first 60%. It holds Drive, drift speed and the other colour parameters constant. Settling time starts at 180ms and velocity sensitivity ranges up to .85 in the macro; the separately authorized core descriptor limits are 120 cents drift and 80 cents settling. This widens available controls without changing existing physical settings or the pitch mechanism. These technical and experimental limits are not musical recommendations or an accepted sound. Do not cap every advanced movement control at the earlier reference's 20 cents.

Before another colour redesign, the independent offline Drive diagnostic uses the actual portable core at Drive 1/2/4/8/12. It compares single Saw, Square and Pulse (duty .5/.6592), then two-oscillator Saw plus Square/Pulse at 0/4.8/20-cent detune, for a held bass and chord. Output, input velocity, amplitude envelope, cutoff and filter mix stay fixed; Fullness, drift, settling and filter-envelope amount are neutral. Record DC separately from AC energy, harmonic-band power and short-window energy movement; retain exact parameters, events and source hashes. Two fixed-gain comparison recordings are listening evidence, not per-step-normalized demonstrations. Harmonic overlap in chords and oscillator beating limit causal conclusions; measured energy variation alone is not a perceptual phasiness verdict.

The official [Subsequent 37 signal path](https://cdn.inmusicbrands.com/Moog/Subsequent37/Subsequent_37_Manual_0.pdf) distinguishes mixer overload, resonant filtering, a separate filter envelope and post-filter MultiDrive. Use those distinctions to formulate a later controlled experiment, not to label this original synth a Moog emulation. Any subsequent bass tilt, saturation or filter candidate must pass fixed-level listening, fundamental/DC/aliasing checks and measured CPU limits before inclusion. Physical-phone listening remains a separate gate.

The first 130-case ABI4 diagnostic completed with no clipping or uncleared voices; Square matched Pulse at .5 within the analyzer's numerical tolerance. In the controlled Saw/Pulse .6592, 4.8-cent bass fixture, 250ms-window AC variation was 6.29dB at Drive1, 2.72dB at Drive4 and .71dB at Drive12; the zero-detune counterpart varied only about .13–.17dB. Non-.5 Pulse also retained measurable output DC (about .0092 to .0121 for the single-oscillator fixture). These observations support investigating source beating and the nonlinear operating point. They do not prove that the player's perceived thinness is explained, reproduce every setting of the complaint patch, or establish listening approval. The fixed-patch measurements and two unnormalized recordings are reproducible with `scripts/diagnose-synth-drive.mjs`; their manifests record the exact source and parameters.

### Curl timing hypothesis for the authorized spike

User explicitly confirms that curled patterns must retain the exact bar/span length. One candidate for N intervals across span T is `t(i) = T * (1 - exp(-c*i/N)) / (1 - exp(-c))`, i=0..N, with the c=0 limit `T*i/N`. Positive c accelerates, negative c decelerates. Compute with `expm1` and a near-zero branch for numerical stability; derive intervals from adjacent timestamps, not repeated rounded delays. At c=.2, four intervals over two seconds are approximately 538, 512, 487 and 463ms: early slower notes balance the later faster notes. This guarantees fixed endpoints and ordered timestamps for finite c; it does not establish musical acceptability. Bound local rates and displacement through audition, preserve fractional sample timing, and resolve the repeat-seam/reset policy before implementation. This is a proposal, not implemented arp code.

### Future Sauce idea: multiband compression

The user's idea dump includes **OTT-style multiband upward/downward compression**, citing Serum/Xfer as an inspiration. Log this as future Sauce work, not part of the current build and not an exact replica claim. The initial musical surface should be simple Depth and Mix; advanced band and timing controls can follow only after a useful, predictable processor exists. Before shipping, explicitly test crossover reconstruction, dry/wet phase or latency alignment, per-band gain bounds, gain matching, release behaviour and measured phone CPU. Upward compression can expose the noise floor, so test it together with any future internal Air/texture source and avoid idle hiss or an apparently impressive result caused merely by output gain. This needs an actual bounded dynamics processor; a macro over current Drive/Fullness cannot truthfully stand in for multiband compression.

Use three durable destinations within Sound, rather than a new top-level tab for every effect:

| Destination | Contents | Default presentation |
|---|---|---|
| Synth | Oscillator/tone, amplitude/filter envelopes, voicing, character/drift | One central editing surface with a few named controls |
| Sauce | Named recipes and effects built from shared processing/modulation | A small active recipe list; tap one to open its controls |
| Movement | LFOs, custom repeating shapes and recorded/drawn automation | Later: one selected lane on a musical timeline |

These Sound destinations do not replace Play/Capture or Edit MIDI. Returning to Play and opening Edit MIDI must remain obvious. Phone shows one working surface at a time. Desktop can place the selected canvas and its control panel side by side. Fold may use the wider composition when space allows.

The mockup's flat Tone/Envelope/EQ/Drift tabs are interaction studies. In the expandable design, Tone and Envelope belong to Synth, Drift is under independent Motion, and EQ/insert processors are available through Sauce. These categories share parameter controls; they do not require different underlying engines.

Envelope stage handles edit time/level. Dragging the connecting attack/decay/release segments changes curvature without moving stage endpoints. Precision controls remain collapsed by default and retain keyboard/accessibility access. One completed edit produces one Undo entry; cancellation restores the exact starting state. A second editing pointer must not steal the owning gesture. Holding notes while editing remains supported.

## Sauce: reusable parameter recipes

The user's intent is many small, understandable tools which replace fiddly manual automation on a phone. A recipe is a named configuration of existing modulation generators, parameter mappings and, where needed, shared audio processors. It is not automatically a new DSP implementation.

Each recipe has:

- Stable recipe ID, schema version and instance ID.
- A useful name and one main Amount control, with one or two meaningful secondary controls.
- Target parameter IDs, units, value mapping and bounds.
- Scope: individual voice/note, instrument layer, or insert bus.
- Trigger: note-on, free-running time, or host musical transport.
- A generator shape and interpolation/curvature rules where it creates movement.
- Enabled state, editable settings and preset serialization.
- A graph/curve showing what the recipe changes; advanced access to the underlying mapping.

Examples are design proposals, not bundled processors:

| Recipe | Controls | Shared mechanism | Scope |
|---|---|---|---|
| Pitch Drop | Amount, Fall Time; advanced curve | Note-triggered pitch envelope, returning to the original pitch | Per voice |
| Filter Pluck | Amount, Decay; advanced curve | Note-triggered filter envelope | Per voice |
| Drift | Amount, Speed; advanced voice spread | Smooth, independently evolving pitch offsets plus persistent voice differences | Per voice/oscillator |
| Warmth | Drive, Tone, Mix | Shared saturation processor and tone shaping | Layer insert |
| Pump | Amount, rhythmic Rate, Shape | Transport-synced gain modulation | Layer |
| Echo | Mix, rhythmic Time, Feedback | Shared delay processor | Layer insert |
| Space | Amount, Size, Tone | Shared reverb processor | Layer insert |

For Pitch Drop, Amount determines the initial pitch offset and Fall Time returns that offset smoothly to zero. The played MIDI note stays unchanged. Every newly triggered note gets its own envelope, so overlapping notes do not pull the entire layer's pitch together. The recipe must work while playing live and during sequenced playback through the same parameter path.

Warmth, Echo and Space still require real saturation, delay and reverb DSP. A recipe can configure those processors once they exist; an automation curve alone does not create the processing. Distortion/drive is available as a detailed processor within Sauce, with Warmth as an approachable recipe. Drift can likewise be surfaced as a Sauce shortcut to Synth's Motion controls without duplicating parameter ownership.

Begin with a curated small selection. Expand the recipe library as shared building blocks become proven. A large library is compatible with a quiet interface; a large permanent bank of knobs is not the goal.

## Signature sound: Character and Fullness

User direction: an instrument that feels alive, with an edge that is slightly broken but stays harmonic. A distinctive, lightweight character should be present in the starting sound, not depend on adding a stack of effects. Aim for small changes in harmonic density, attack texture and persistent voice differences; keep pitch drift gentle enough that chords remain in tune. More character must not simply mean louder, noisier or more detuned.

Keep three purposes separate within Synth:

- **Character** controls tone colour and wear, never pitch or drift speed. The current authorized recipe controls Drive only; richer colour needs separately implemented processors. Editing an underlying mapped value marks the macro **Custom**, and returning to a macro is an explicit, undoable gesture.
- **Motion** controls pitch movement and note attack settling, independently of Character. Detail edits must remain visible as **Custom** rather than being silently overwritten. Drift remains independently evolving per voice, while both oscillators within one voice share that moving pitch. Do not advertise independent oscillator wander.
- **Fullness** controls tonal body: the sense of depth and weight in bass, but also solidity in chords and upper-register notes. It is distinct from wear, pitch drift and output volume. Do not implement it as hidden unison, an extra octave, or an unexplained gain boost. The control earns its place only if a level-matched comparison demonstrates a useful tonal change across registers.

The initial core already has soft tanh drive and seeded pitch drift. Those can shape the first factory patches; the broader character ideas below are not claims about current DSP. Gentle default settings are a listening target, not a requirement to enable every proposed process. Keep a clean, reproducible setting available and serialize the exact values and macro version.

### Fullness prototype, not accepted sound

The current stronger prototype preserves the dry signal and adds `0.20*x*x + 0.25*x*x*x`, processed with first-order antiderivative antialiasing (ADAA) and residual DC rejection, plus a separate linear low-band body component. Body is `.5 * (LP180 - LP10)` using warmed one-pole states at approximately 180Hz and 10Hz. This difference rejects DC and has a nonnegative real response, so the linear body addition cannot cancel the dry foundation. The full nonlinear rack still requires actual-signal tests; that mathematical property is not a universal sound-quality claim. The old negative linear residual term was removed because it could subtract low-level fundamentals.

The whole Fullness stage now sits in the generic per-voice mono audio Sauce rack after Tone. Default order is **Drive → Fullness**, preserving the body effect at high Drive; the alternative **Fullness → Drive** lets Drive compress the added body. Both stateful paths remain warm, and order changes crossfade. This is not a dark-filter replacement, automatic gain compensation, resonance or transistor model. The earlier four-pole/phase-trim path remains removed; the subsequent small pre-Drive residual was too subtle at high Drive and is also superseded. Fullness remains parameter 18, with separate component bypass and audio-order state. With other processing held equal, Fullness zero retains the dry output; no unchanged-audio claim applies to earlier nonzero fixtures.

Fullness was introduced in ABI/patch version 2; version 3 added waveform choices and version 4 added independent levels, filter mix/envelope and note-life movement. Current ABI/patch version 5 has 40 parameters, retaining existing IDs and adding envelope response, Drive/Pitch Drop/Fullness bypass and audio order. Older patch migration and current measurements are described in the [core README](../packages/synth-core/README.md). Core/WASM checks do not establish listening quality. Fullness before strong Drive can still be compressed; default post-Drive placement remains distinct. Whether the stronger colour is musically desirable remains a listening decision.

The new comparison rendered 180 eight-second cases across bass, detuned chords, Sine controls, Drive 1/4/12, both orders and five Fullness amounts, against 90 cases from the earlier verified core. At Drive12, default-order detuned bass changed +4.51dB AC, +4.82dB low-band and +1.84dB high-band; detuned chords changed +2.91/+3.70/+1.68dB respectively. The old path changed those AC levels by only about -.044/-.00024dB. The alternative pre-Drive order produced much less AC growth at Drive12, as expected from subsequent saturation. Fullness0 float-output fingerprints matched the earlier baseline for every comparison fixture/order. The largest measured gain was4.75dB; the smallest change was a -.00062dB high-Sine/pre-Drive RMS difference, not the former large cancellation loss. Fullness intentionally adds low-band energy and can raise overall level; it is not a broadband output-gain knob or a promise of constant loudness. Audition both fixed-gain and listener-level-matched comparisons.

The existing 375 waveform/intermediate-amount cases found no RMS/fundamental dip below the quieter endpoint. Updated regression bounds retain a stricter -.15dB attenuation guard while allowing up to +6dB intentional body growth; the old symmetric ±1.5dB requirement no longer described the requested behaviour. The added body response/DC tests cover 8–384kHz. Current-residual ADAA reduced the isolated folded-alias ratio by25.2dB versus the same polynomial without ADAA; this is not a whole-synth alias-free or universal no-regression claim. One local 16-voice run took about100.7ms bypassed and106.3ms at Fullness1 per second of audio, excluding host/UI/device costs. `scripts/compare-synth-fullness.mjs` writes exact manifests, hashes, spectral measurements and unnormalized comparison WAVs beside the repo; no listening or physical-phone approval is implied.

The broader signal-path inspiration remains the oscillator, mixer, ladder-filter and MultiDrive sections of the [official Moog Subsequent 37 manual](https://cdn.inmusicbrands.com/Moog/Subsequent37/Subsequent_37_Manual_0.pdf). The current correction is original harmonic-enrichment DSP, not a Moog emulation, ladder-circuit model or claim of equivalent sound. The separate ladder/drive study below remains a future decision.

### Later character experiments

Log these as candidates, not additional requirements for the current slice:

- A light **Heater** drive flavour for gentle harmonic density and rounded attacks, with compensated output.
- Controlled asymmetric saturation for a different even/odd harmonic balance; retain DC rejection and stable silence.
- Persistent per-voice differences in attack, filter response or saturation, using bounded seeded variation rather than unrelated random changes on every audio block.
- A small stateful/hysteresis experiment for history-dependent response, only if it adds an audible musical benefit beyond the cheaper static curve. Do not imply physical circuit accuracy.

Expose successful experiments through a few named recipes or advanced drive flavours, not another permanent bank of controls. Character and Fullness must remain understandable when both are active.

### Acceptance before default use

Compare bypass, gentle default and extremes at matched perceived level, including quiet/loud notes, low bass, upper notes and dense sustained chords. Measure DC offset, output peaks, silence/release tails, aliasing at high pitches and across supported sample rates, parameter-sweep clicks and worst-case phone CPU/thermal load. ADAA is a technique to test, not proof that aliasing is eliminated. Retain native/WASM parity and block-size invariance; variation must stay deterministic under the declared reset/seed policy. No allocations or hidden quality changes in rendering, no changes to captured MIDI, and no claim of a signature sound until listening supports it.

These notes preserve the broader instrument vision. Current authorized work includes the Fullness correction and ABI4 oscillator, filter-envelope and note-movement controls described above. Future processor ideas below do not independently authorize implementation or additional permanent UI.

### Latest listening direction and movement reference

The user wants Character to be a curated selection of the best distortion, warmth and fatness behaviours, not a generic dark low-pass effect. Study the audible differences between soft/hard clipping, asymmetry, stateful saturation and filter drive before choosing a flavour. Longer term, the user wants a broader suite with both parallel blends and serial stacks. That requires explicit signal order, bypass/tail behaviour, gain staging and independent processor state; it is a future architecture goal, not an instruction to build a distortion stack in the current UI pass.

**Fullness has not passed listening acceptance.** The user reported that increasing the earlier implementation became quieter and sounded like filtering rather than the desired warm, substantial analogue character. Initial source-level diagnosis included its steeper wet-path filtering, the shift of spectral energy toward lower frequencies, and note-dependent level trim; subsequent measurements also identified dry/wet cancellation with detuned oscillators. The same-phase correction removes that separate path rather than increasing output. Earlier fixture-specific level checks do not invalidate the original report or establish universal compensation. Preserve the complaint as a regression case and audition the correction without changing the player's envelope.

The earlier live patch read had Sustain=0. A later screenshot has Sustain=1 and is saved as the rounded version-2 [user movement reference](audio-references/user-movement-20ct.json). These are different historical observations, not contradictory readings to overwrite. The accepted aspect of the later screenshot is pitch movement: approximately **20 cents drift, 0.58 Hz speed and 4.8 cents oscillator-2 detune**. Its Drive/Fullness sound is still under review; the file is not an exact exported patch or blanket sound-quality approval.

The current host contract is **Character recipe 5: Drive parameter 12 only**, and **Motion recipe 4: drift depth 13, attack settling 32, settling time 33, velocity movement 34 and Envelope response 35 fixed to 1**. Character must not alter pitch or speed14. Motion's first60% remains conservative: drift reaches4.8 cents and settling1.2 cents at60%, then40/12 cents at85%, and experimental maxima120/60 cents at100%. The macro does not change speed14. Its detail surface exposes Speed, Attack settling, Settle time and Velocity. Owned target edits that no longer match the recipe show Custom; independent Speed does not mark the depth macro Custom or require extra flag state. Advanced response0 is a manual override and also differs from the Motion recipe. Character/Motion/Fullness remain the primary controls. Presets explicitly seed Motion and speed separately; preserving these physical settings is not a claim of unchanged audio through new Fullness/envelope-response DSP. Historical recipe ceilings are not current limits. The extended range is calibration, not a recommendation or a combined drift-plus-settling clamp. Scoped UI approval does not establish musical acceptance.

Configured movement is a bound, not a guaranteed audible excursion. Settling begins at a signed random fraction of its maximum, is multiplied by the velocity response, and reaches 10% of that offset after half the selected settling time (1% after the full time). With sensitivity .85, movement scales by `.15 + .85*velocity`; soft notes are deliberately less mobile. Drift starts at zero toward an immediately generated random target, smoothing with time constant `1/(2*pi*speed*perNoteRateScale)`; at nominal .1Hz this is about 1.59 seconds before the per-note rate variation. Both oscillators share their voice's moving frequency. Measure the rendered pitch and audition real attack envelopes before deciding whether stronger initial settling, a persistent per-note offset or independent oscillator motion is useful; do not represent wider control maxima as an engine bug fix or silently add those distinct mechanisms.

The actual-output Sine probe compared 90 cases on an immutable core snapshot after the range-only change. It measured MIDI60/69/72 at velocities .25/.72/1, including drift-only, settling-only and combined profiles; neutral controls were within .03 cents. For MIDI69 at velocity .72 and speed .58Hz, old40/8 settings reached 15.83 cents maximum measured deviation, versus 47.50 cents at new120/60; mean deviation during 10–30ms was 4.54 versus 29.72 cents. The new setting's same-note peaks at velocities .25/.72/1 were 22.60/47.50/62.33 cents. Other note seeds differ: the hard MIDI60 example reached about115 cents. These are measured fixtures, not universal excursions or listening acceptance. A slow amplitude attack can mask settling before it is loud enough to hear. Touch velocity currently uses vertical key position, computer keys use a fixed .75, and MIDI uses incoming velocity; forceful tapping alone does not increase touch velocity. Prioritize listening with those input semantics and explicit settling time before introducing another movement mechanism. The reproducible host is `packages/synth-core/tests/pitch_motion_probe.cpp`, invoked by `scripts/probe-synth-pitch.mjs`; its report, exact physical parameters/events and SHA256 source/build/measurement manifest are written to `work/synth-pitch-probe` beside the repository. The recorded snapshot predates the new performance scheduler, so its evidence concerns the unchanged pitch mechanism, not Mono/Arp/Strum correctness.

### Latest adaptive Motion request — implementation under review

The user's latest sustained-tone calibration is around **29.8 cents drift and 8.9 cents attack settling**; short plucks tolerate the high Motion setting more readily. These are reported nominal control values and an individual musical boundary, not measured universal pitch limits. The requested direction is stronger per-note attack character for short sounds and restrained tuning on long sounds. Do not interpret Sustain zero by itself as a pluck: zero Sustain with an eight-second Decay remains a long audible sound.

The subsequently authorized implementation uses **Envelope response**, sound parameter 35, as an advanced strength control. New patches default to response1; migrated older patches receive0 for exact manual behaviour. Manual drift and attack-settling amounts remain upper bounds: response attenuates them without rewriting stored knobs. Keep configured values distinct from effective per-note amounts in explanations/readouts. Character remains independent, and response belongs to the sound patch rather than Arp/Strum configuration. This is not an additional visible feature button or a claim of listening acceptance.

The implemented shortness heuristic evaluates the actual curved decay's energy and residual over 350ms after attack, weights the time to reach90% attack level, sustain and release-tail energy, and remains continuous. The earlier 500ms horizon was a proposal, not the implemented constant. Low early energy alone would misclassify long slow attacks, so the explicit attack factor prevents that. A fast, quickly decaying, near-zero-sustain envelope permits more of the requested attack-settling amount; a slow attack, long decay or sustained body stays nearer the restrained8.9-cent settling reference. The per-note shape result snapshots at note-on. Extra early drift allowance decays rapidly toward the29.8-cent held-tone budget rather than raising ongoing drift indefinitely. All budgets remain bounded by requested amounts, and response0 retains deliberately extreme manual sounds. These numbers remain user-calibrated starting points, not universal definitions of musical tuning.

Acceptance compares fast pluck, rounded attack, long zero-sustain decay, low-but-nonzero sustain, sustained pad, soft/hard velocity and repeated chords at identical manual bounds. Test both positive and negative seeded pitch offsets, amplitude-curve bends, per-note isolation, unchanged raw notes, deterministic reset/block rendering, no abrupt classifier threshold and exact manual bypass. Measure rendered pitch over attack and held portions, then listen with the actual amplitude envelope: a pitch excursion that occurs before an audible attack is not a successful expressive result. Analytical/core response tests pass; actual-audio regression and listening remain separately recorded gates, not implied by implementing the heuristic.

### Proposed internal texture source

The user's white-noise idea is a subtle internal noise/texture oscillator behind Character, **not a third pitched oscillator panel**. This is not implemented. If prototyped later, give it a separate deterministic random stream from pitch drift, shape it by each note's envelope and velocity, and audition its interaction with filter and drive. No notes should mean no idle hiss; release and panic must clear it. Start with a restrained default contribution and leave room for an advanced amount/colour control only when the sound earns it. Adding texture must not change drift sequences or masquerade as another pitched voice.

### Next Fullness study, before more effects

The working [official Subsequent 37 manual](https://cdn.inmusicbrands.com/Moog/Subsequent37/Subsequent_37_Manual_0.pdf), pages 27–30, separates mixer overload into the filter, resonant ladder behaviour, post-filter MultiDrive and a dedicated filter envelope. This is useful signal-path evidence, not evidence that the current prototype sounds like that instrument. Do not claim a genuine Moog implementation.

Compare only two bounded candidates before choosing a new path: an original topology-preserving-transform ladder with analytically solved linear feedback plus controlled saturation, and the D'Angelo/Välimäki nonlinear model as a reference. The former is a lower-complexity approximation, not a transistor-circuit equivalent; [Faust's documented TPT ladder](https://faustlibraries.grame.fr/libs/vaeffects/#lowpassladder4) describes the filter topology. The [D'Angelo/Välimäki research](https://research.spa.aalto.fi/publications/papers/icassp13-moog/) provides the nonlinear-model rationale. Its reusable [ImprovedModel.h implementation](https://github.com/ddiakopoulos/MoogLadders/blob/main/src/ImprovedModel.h) carries an individual ISC copyright/permission notice; preserve that notice if code is reused. Do not infer every model's licence from the repository-wide licence: its Huovilainen variant is CSound/LGPL-derived.

First compare the user's exact high-drive, zero-sustain complaint patch, then the later movement reference, bass/chords, velocities, waveform pairs and intermediate Fullness values. Keep cutoff, output and envelope fixed between comparisons. Measure transient energy as well as sustained RMS/fundamental balance; verify bounded gain and DC, aliasing, automation discontinuities, release tails, deterministic native/WASM behaviour and actual CPU cost. Prefer a useful level-preserving body change over a louder demo. Listening and physical-phone checks remain mandatory acceptance gates; generated WAVs and desktop timing results cannot stand in for them. This plan records the next study decision: no additional DSP or distortion-stack implementation is approved merely by finishing the current UI corrections.

## Voicing

- **Mono/Poly:** one note or simultaneous notes.
- **Polyphony:** maximum concurrent note voices, including release tails. It is a resource limit, not a loudness control.
- **Unison/Stack:** multiple detuned oscillator/voice copies for each played note; expose Count, Detune and Width.
- **Motion:** drift amount/speed, note-on settling and stable differences between voices. Preserve tuning on average; do not make every voice follow one identical periodic pitch wobble. Character does not own pitch.
- **Glide/Legato:** specify note-trigger and envelope-retrigger behaviour explicitly.

Offer clear controls rather than one ambiguous Voices value. Initial counts and quality modes are benchmark decisions. For illustration, eight simultaneous notes with four-way unison means 32 stacked voices before counting oscillators, release overlap and other layers. Do not promise unlimited counts on phones, and do not silently change another layer's patch to meet a budget.

The current core's 16-note polyphony is not a unison count. Two oscillator waveform choices and levels are independent; oscillator 2 already has relative detune. Broader independent tuning controls remain future work. Keep these distinct from future unison Count/Detune/Width and from the proposed unpitched texture source.

## Focused sound-development roadmap

The current continuation adds performance robustness, selectable oscillator waveforms/levels, a per-note filter ADSR and movement, and reproducible actual-core diagnostics. The table distinguishes implemented primitives awaiting host/listening acceptance from future designs; it is not a shipped-feature list. Preserve one portable sound core and a small parameter/recipe vocabulary across browser, future plugin and Blocks hosts.

| Candidate | Musical purpose and bounded first experiment | What requires real engineering |
|---|---|---|
| Resonance | Give the filter an expressive peak and more articulation; first define useful gain-compensated behaviour with the existing waveform/Fullness range | A stable resonant filter, parameter smoothing, overload behaviour and high-frequency/aliasing tests. A resonance knob cannot be a macro around the current nonresonant poles. Self-oscillation is a separate decision, not an assumed requirement. |
| Filter envelope / Filter Pluck | The current core retains the independent per-note curved ADSR, bipolar Amount and dry/wet mix introduced in ABI4; listening remains a gate | Cutoff moves in semitones around its bounded baseline. Notes own their envelope/release. A simplified named Sauce recipe remains optional later presentation, not another processor already shipped. |
| Legato and glide, after current Mono | Mono last-note priority is implemented; glide and advanced legato-only behaviour remain future work | Preserve held-note restoration and sustain ownership while defining retriggers and constant-time versus constant-rate glide. Glide changes generated pitch, not captured note values. Poly remains unchanged. |
| Velocity and aftertouch | Let touch/MIDI playing shape brightness or expression without more permanent controls | Velocity is already an attack input; additional mappings need explicit depth and response. Channel pressure affects a channel, while polyphonic key pressure needs note ownership. Add host/core expression events and bounded smoothing deliberately; do not advertise aftertouch or MPE merely because a browser receives MIDI bytes. |
| Heater and focused effects | Start with a subtle level-matched drive flavour and one useful Amount control; add further effects only after listening shows a need | A Heater recipe can configure existing drive/Fullness once its mapping is useful. A distinct asymmetric or hysteretic flavour needs its own tested DSP. Delay, chorus or reverb need actual processors, memory/tail/bypass policies and CPU measurements; they are not made real by drawing an automation curve. |

The distinction between amplitude and filter envelopes, legato retrigger policy, and glide modes is informed by the [official Subsequent 37 envelope documentation](https://cdn.inmusicbrands.com/Moog/Subsequent37/Subsequent_37_Manual_0.pdf) and [u-he's Diva instrument description](https://u-he.com/products/diva/diva.html). These are references for musical semantics, not promises of matching their circuits or sound. MIDI expression meanings follow the [MIDI Association message summary](https://midi.org/summary-of-midi-1-0-messages).

Choose one experiment at a time after auditioning the current factory patches. A successful addition must be distinguishable and useful at matched level, keep the stable harmonic character, preserve voice ownership and patch migration, pass native/WASM timing and numerical checks, and fit a measured phone budget. Show it first as a small extension of the existing Synth/Sauce surface; do not create a new permanent destination for each feature. Offline WAVs are deterministic listening material, not evidence that somebody listened or that a physical phone performed well.

## Curl design background

Originally deferred, Curl is now explicitly authorized together with Mono, inline oscillator Mix dials and Strum. **Authorization is not a delivery or acceptance claim.** The implementation plan below supersedes the earlier deferral. Turn held notes into an arpeggio on a chosen musical subdivision of the host BPM, then let a signed Curl control smoothly accelerate or decelerate the spacing across a held-note cycle or an explicit span such as one bar. The user wants progressively changing differences with a curved feel, not simply a linear rate ramp. Zero should retain the straight underlying rhythm.

Anchor phrase/bar endpoints to musical time and bound internal displacement so the pattern retains its groove rather than accumulating tempo drift. One candidate is a normalized monotone time warp over a fixed musical span, with pinned endpoints and bounded derivatives; this is a design hypothesis, not the final formula. Audition subtle values, both Curl directions and the join between spans before selecting the mapping. Pulse repetition rate and musical note spacing are timing concepts; the user's quarter-note/100Hz analogy is conceptual, not an instruction to treat oscillator pitch Hz as an arpeggiator rate.

The repeat seam is an explicit open design choice: continuous acceleration across every span requires a rate reset when that span repeats. Compare a deliberate beat-aligned reset with smoothly alternating/ping-pong Curl. Do not promise equal endpoint derivatives while also promising strictly increasing rate throughout each repeated span. Pinned musical endpoints alone do not resolve that tradeoff; the later spike must audition the alternatives before selecting its mathematics.

Begin with clear Rhythm, signed Curl, Span and Order controls plus a rhythm preview; reserve detailed curve controls for an advanced view. Note order may include Up, Down and Random. Optional seeded octave/upward-pitch variation must stay inside a defined musical pitch pool, with bounded range and reproducible results. Do not turn a small expressive recipe into an uncontrolled random pitch generator.

The host scheduler must produce deterministic note events with bounded real-time work, follow transport start/stop/seek and tempo changes, and define interaction with existing swing. Track held keys, pedal, retriggers and generated-note releases explicitly: releasing the source chord, stopping transport, bypassing Curl or panicking must not leave notes stuck or steal another source's voices. Preserve raw input notes separately from generated arpeggio output.

Before implementation acceptance, test pinned endpoints, strictly monotone event times and minimum spacing, bounded displacement, continuity at subtle control values, span seams, tempo/transport changes, swing interactions, chord changes and sustain/release ownership. Listening and physical-phone timing/interaction checks remain required; deterministic event tests alone cannot establish groove. Final mathematics, defaults and pitch variation are decisions for that later auditioned slice.

## Current implementation acceptance plan: Mono, Mix, Curl and Strum

This bounded slice is implemented and has passed the current scoped automated/independent UI gates. The contract below describes that prototype; it does not establish musical or physical-device acceptance. Future variants are labelled explicitly. No sampler, unison, glide or general automation editor is included.

**Inline oscillator Mix.** Replace the level popover with one miniature **round** level dial beside each oscillator's waveform control, as the latest user feedback explicitly requests. Each dial writes its own level only, including zero for mute; it must not rewrite the other oscillator's level through the legacy Mix alias. Keep the visual footprint small while retaining a usable touch target, readable level, keyboard adjustment, exact pointer cancellation and one Undo entry per gesture. Waveform selection can retain its separate selector. Two dials do not imply two equal-power panning laws or automatic gain compensation.

**Mono.** Default to Poly; a clearly labelled Mono toggle activates global last-note priority for that instrument instance. New physical presses take priority; releasing the current note restores the most recently pressed note still physically held. The implementation retriggers amplitude/filter envelopes on a newly selected priority note; legato and glide remain separate later decisions. Its bounded source ledger tracks channel/key counts and press order so duplicate presses and the same pitch on another channel do not release the wrong priority note. Sustain gives physical keys priority, then the most recent pedal-latched eligible note only when no physical key remains; pedal-up removes that channel's latched eligibility. The first implementation deliberately panics and clears held/generated state when switching mode or toggling Mono: keys must be released and pressed again. It does not reconstruct held notes automatically. Panic, disconnect and page hide clear both ledger and sound. A brief bounded stolen-voice fade does not imply extra sustained Mono notes.

**Curl clock and shape.** The current build uses separate Off, Arp and Strum modes; Mono is independent. Default is120BPM, 4/4, a one-bar span, eighth notes and Curl0. BPM spans40–240; straight subdivisions include32nd/64th, while triplets remain quarter/eighth/sixteenth. A physical count transition from zero to one, including pedal-latched rehit, or removal from the eligible chord triggers the new chord-restart policy. The first change restarts immediately; subsequent changes inside a fixed, non-sliding20ms group update the pool without another restart. Same-sample events precede tick, so the completed simultaneous chord gets one attack. Duplicate same-key presses while count stays positive do not restart; pedal-held release preserves membership. Restart applies pending timing and resets order/RNG. Parameter-only edits wait for the next bar unless a chord restart applies them first. This replaces the original phase-preserving chord-edit behaviour and avoids repeated restarts inside a rolled chord group. No external MIDI-clock synchronization is claimed.

For span T and N intervals, evaluate absolute positions `t(i)=T*(-expm1(-c*i/N))/(-expm1(-c))`, with the near-zero limit `T*i/N`. Positive c accelerates; negative c decelerates. The confirmed first bound is c in [-.8,.8], not a settled musical default. Emit slots i=0..N-1; i=N is the next bar's first slot, never an extra duplicate. Derive integer sample positions from the common musical origin and full fractional positions, not by repeatedly adding rounded intervals. Require strictly increasing timestamps, exact shared endpoints within one sample, bounded displacement and positive gate intervals shorter than the next onset. The earlier proposed 15ms floor does not fit the newly requested density: 64th notes at 240BPM with Curl .8 approach 10ms spacing. Preserve that exact grid without silent event dropping; verify the smallest spacing, event queue and CPU at the true maximum density. The selected repeat policy is a deliberate beat-aligned rate reset for repeated same-sign Curl. Smooth alternating/ping-pong Curl remains a later option; equal endpoint derivatives are not promised.

**Order and pitch.** Offer Up, Down and deterministic seeded Random over eligible held-note identities, with stable tie-breaking for equal pitches. Update the pool at a documented step boundary. Releasing a source removes its future eligibility; already generated notes receive their owned release. Octave expansion and generated pitch randomization are explicitly excluded from this slice. Curl changes timing, not oscillator pitch Hz. Preserve raw incoming notes separately from generated output.

**Strum.** Strum is a separate one-shot mode, not a timer that repeatedly retriggers held notes. Set amount zero to immediate unmodified playing. Reliable Up/Down sorting uses the confirmed 20ms chord-onset collection window only when spread is nonzero, followed by an ordered or seeded-random sequence over the implemented 0–100ms spread. That intentional latency is a tradeoff to audition, not hidden scheduling overhead. A note released before its scheduled attack must never sound later, including with sustain held. Additional notes arriving outside the collection window form a new gesture. Random flutter alters bounded interval weights, normalized to the selected total span, so neither negative intervals nor indefinite drift are possible. A single-note group needs no stagger beyond the collection window. There is no Arp+Strum combination in this slice. Generated notes must receive their owned release even if source notes or settings change.

**Touch surface and release gates.** Keep Mono and the two inline Mix dials immediately discoverable. Put Arp/Strum controls together in one compact optional surface: On, BPM/Rhythm, signed Curl, Order and Strum amount; a small rhythm preview shows event spacing against the unchanged bar. Keep span fixed at one bar initially instead of adding a weakly specified Span menu. Preserve 44–48px touch hit targets even if the dial graphics are smaller, accessible values and coherent Undo/cancel. Do not let a second control pointer steal a held keyboard gesture.

Acceptance requires deterministic event-sequence tests for both Curl signs and the zero limit; exact bar endpoints, positive/minimum spacing, long-run phase stability and changes at boundaries; ordered/random chords, equal pitches across channels, repeated note-ons, pedal-up, priority restoration, note release before a delayed attack, mode toggles, disconnect and panic. Define swing order before enabling a swing combination; independent timing transforms must not invalidate spacing or endpoints. Test bounded queue capacity and real-time work, cancellation with pending events and absence of stuck notes. Independent browser/phone interaction review and listening must assess musical middle values, the repeat seam and Strum latency; desktop tests cannot declare those accepted.

## Future Voicing, Space and Sauce catalogue — recorded, not current scope

These are the user's requested next modules after the current rack, envelope response and stronger Fullness work. They are **not implemented by adding names to the UI**, and no inactive Space/effect buttons should appear in the current build. Product names below are the user's musical references, not copied implementations, feature-equivalence claims or permission to reuse proprietary code.

**Synth Voicing** should eventually expose unison Count, Detune and Spread, with a voice/CPU budget distinct from the16-note polyphony limit. Glide is a later Mono-adjacent On/Off and Time/Amount control, with explicit advanced legato-only behaviour and return/retrigger rules. Vibrato needs its own depth/rate, distinct from random Motion drift; modulation-wheel control is a later mapping. None of these expands the current tone ABI merely by being logged here.

**Sauce Space** is a future ordered, stereo audio processor on the whole mix **after voice panning**, not a rename of per-voice detune. Distinguish changing existing stereo width from creating stereo information from mono. Begin with a useful simple width/body control; advanced low/mid/high width needs real crossovers, reconstruction and latency/phase policies. Keep a mono/foundation option for low frequencies, and use correlation/vectorscope feedback to show the resulting signal rather than a decorative animation. The official [Ozone Imager manual](https://s3.amazonaws.com/izotopedownloads/docs/ozone9/en/imager/index.html) distinguishes side-channel width from Stereoize and documents multiband/correlation displays; the [official product page](https://www.izotope.com/products/ozone-imager) is the user's reference. These inform semantics, not a claim to reproduce its DSP.

The current `SauceRack` accepts generic mono audio but is instantiated per voice before panning. It is independent of oscillator generation and can later be reused per channel. A true Space stage still needs a separate two-channel bus after the voice sum, its own state/latency/mono-compatibility tests and a measured phone budget. Do not present the current per-voice mono rack as an already implemented stereo effects host.

| Future module | User intent and bounded front surface | Required work before it can be offered |
|---|---|---|
| OTT-style multiband compression | Upward/downward dynamics, simple Depth/Mix first | Crossovers, gain/time bounds, dry/wet alignment, noise-floor lift including future Air, output matching and CPU checks |
| Regular compressor | Straightforward dynamics control separate from OTT | Detector/attack/release behaviour, sidechain policy, gain reduction feedback and predictable makeup gain |
| Plate and hall reverb | Valhalla as a sound-quality reference; usable space and tails | Real stereo processors, decay/damping/mix, tail/bypass/state/memory and phone-quality budget |
| Regular delay | Normal and ping-pong echo with appropriate timing/feedback/mix controls | Stereo routing, tempo sync, interpolation/feedback bounds, tails and order changes |
| Creative echo | Soundtoys Crystallizer-inspired musical exploration | A deliberately scoped creative algorithm, pitch/time behaviour and independent licensing/performance review; no replica claim |
| Lo-fi reduction | D16 Decimort-style downsampling and bit-depth character | Actual resampling/quantization stages, controlled alias/noise choices, gain and mix semantics |
| Additional filters | Selectable dB/octave slopes with clear tonal differences | Implemented filter topologies, stability, resonance/drive interaction and smooth switching; labels alone are insufficient |
| EQ | A useful simple front with deeper editing available | Real band/filter processing, readable curves, parameter bounds and channel/bus placement |
| Pluck Refiner | Percussion/pluck dynamics, Ableton Drum Buss as a reference | A scoped transient/body/dynamics process with attack preservation and bounded gain, not an ADSR graphic pretending to be a processor |
| Saturation and multishaping | Tape, warm, sine-fold, sine-crush and other distinct colour flavours; Trash-like synth-focused multishaping and Softube Harmonics-like dynamic colour are references | Auditioned original or licensed processors, explicit ordering/blend, dynamics where promised, DC/alias/level/CPU gates; the present Drive is not already this catalogue |
| LFO and modulation links | Optional tempo sync and direct Filter/Volume/Amount links first, then an extended modulation matrix | Defined units/depth/rate/phase/retrigger, safe target mapping, shared ownership with automation and deterministic scheduling; do not confuse the user's LFO shorthand with a new lo-fi processor |

Expansion should keep the simple-first/advanced-later touch hierarchy and ordered audio blocks. Select one bounded module based on actual musical need and listening, then measure mono compatibility where relevant, gain, aliasing, automation transitions, tails and real device cost. No current quality claim or third-party code copying is implied by this catalogue.

## Future movement recording and drawing

This is a user-requested future capability, not an immediate implementation task:

1. Select a parameter or recipe control and choose **Record movement**. Keep this distinct from note Record and Capture.
2. Play the existing loop and move the control. Record timestamped parameter gestures for that layer; do not fabricate or rewrite MIDI notes.
3. Open an editable lane: horizontal axis is bars/beats, vertical axis is the parameter's value. Reuse the piano roll's ruler, zoom and chosen rhythmic divisions, including triplets. Default snap is 1/4; recording retains expressive timing unless the user explicitly snaps it.
4. Support points, free drawing, bendable segments, clear start/end, looping, bypass, clear and Undo. Show which parameter is being edited.
5. Provide free-running and tempo-synced LFOs, depth, phase and trigger choices; add custom repeating modulation shapes using the same curve editor.
6. Keep recorded absolute automation distinct from relative modulation. Touching an automated control must have a clear temporary-override and resume policy; starting automation recording must not happen merely because the user adjusts a sound.

All eligible sound parameters should be addressable. Continuous values such as cutoff use continuous interpolation; discrete values such as oscillator mode or unison count use meaningful stepped events. Browser actions, preset file operations and Undo are commands, not continuously modulatable sound parameters. Do not interpolate voice counts or allocate processors inside the real-time callback.

Use stable parameter IDs and a shared descriptor registry from the first engine version, even before movement UI is built. Descriptors define units, range, perceptual mapping (for example pitch cents and logarithmic cutoff), default, smoothing, voice/layer scope, automation type and application policy. Unknown IDs and invalid values must be handled explicitly during preset migration.

## Reusable engine foundation

Separate these responsibilities:

1. **Parameter registry and patch state:** one source of truth for UI, recipes, controller input, presets and future automation.
2. **Modulation generators:** reusable one-shot envelopes, looping shapes, LFOs and smooth random drift, driven by note or host transport events.
3. **Recipe mappings:** named data/configurations connecting generators/macros to parameters. Reusing the editor's curves is possible without sharing UI components with DSP.
4. **DSP processors:** oscillators, filters, amplifiers, saturation, EQ, delay and reverb. Allocate/prepare outside rendering; process bounded buffers without UI calls, IO or runtime allocation.
5. **Instrument host/adapters:** own devices, transport, scheduling, layer routing, loading and persistence. Browser and native adapters share the portable core's contract.
6. **UI and telemetry:** control and visualize the engine without owning its audio clock. Animation must not block sound.

Evaluate automation as the parameter baseline, apply allowed modulation/expression contributions in documented units, then bound/smooth and deliver to DSP. Avoid multiple unsynchronized writers changing a knob independently. Record the player's intentional gesture rather than blindly recording every LFO-generated update. Independent recipe instances must have independent generator state and per-note state where required.

Store recipes and movement separately from immutable captured performances. Layer patch copies must not mutate other layers or factory presets. Define preset switching and state migration, note/pedal ownership, quality limits and reproducibility before promising export parity.

## Sequence and gates

| Stage | Concrete result | Gate |
|---|---|---|
| Product, current next step | This feature map and the Synth/Sauce/Movement contract | Synth first; automation and sampler explicitly later; no ambiguous voicing or record controls |
| UI/UX | Refine the phone/desktop study into an expandable shell, including Voicing and the first Sauce recipe | Primary actions reachable; curve editing discoverable; no nested modal chains; independent UX can reject |
| Engine spike | One sound core plus Pitch Drop/Filter Pluck built on shared parameter/envelope primitives | Audible change, musical bounds, voice isolation, consistent live/playback, phone measurements |
| First instrument | Proven oscillators/filter/envelopes/voicing and a small useful Sauce set | Listening acceptance, sustainable CPU/memory, pedal/release correctness and untouched raw capture |
| Effects expansion | Distortion/EQ followed by chorus/delay/reverb as measured | Safe gain, no editing clicks, clear tails/bypass/order, no effects hidden behind misleading controls |
| Movement, later | Record/draw automation, LFO/custom-shape lanes | Musical phase, loop seams, Undo, override/resume and deterministic replay |
| Sampler, later | Sample import/recording and curated instrument packs | Rights, loading/memory, quality and device acceptance |

The initial scope above was research and mockup work. Subsequent instructions authorize the independent instrument and its Character/Fullness direction for online and future VST hosts. The implementation is [the portable C++ core](../packages/synth-core/README.md) and [separate browser instrument](../packages/synth-web/README.md). Current ABI5/40 includes the earlier waveform/level/filter-envelope/movement work plus envelope response, component enables and real ordered Drive/Fullness stages. The current scoped UI gates pass, while physical-phone and listening acceptance remain outstanding. This does not replace Blocks production audio or constitute a shipped VST. Resonance, unison, sampler, the broader effects catalogue and recorded/drawn Movement remain future work.

## Research references

- [Ableton: Automation](https://www.ableton.com/en/live-manual/12/automation/) documents recorded gestures and drawn breakpoint/shape editing; reference for interaction semantics, not copied UI.
- [Ableton: Wavetable CPU load](https://help.ableton.com/hc/en-us/articles/360000036930-Managing-CPU-load-when-using-Wavetable) distinguishes note polyphony and unison processing costs.
- [Diva manual](https://u-he.com/downloads/manuals/plugins/diva/Diva-user-guide.pdf) separates slow drift, per-voice offsets and other variance controls.

These references inform the proposal. They do not establish the performance, licensing or sound quality of any future Blocks implementation.

## Current performance integration checkpoint

Current runtime freeze: **ABI5/40 tone parameters**, separate performance state, Character5 and Motion4. Drive36, Pitch Drop37 and Fullness39 enables preserve their stored amounts; Audio order38 selects real Drive→Fullness or Fullness→Drive processing. Motion4 includes Envelope response35. The UI has round Mix dials, independent Mono, straight32nd/64th Arp choices and grouped20ms chord restarts, one-shot Strum, component power and ordered Sauce blocks. **31 core groups,24 Node tests and32 browser checks pass**, alongside independent scoped phone/desktop UX review. Earlier ABI4/35 counts and pre-rack source checkpoints are historical, not the current build. Reproducible audition, comparison and timing artifacts remain evidence of the tested scope, not listening or physical-phone approval. Remaining gates include musical Curl/Strum response, actual hardware MIDI/phone performance and broader character quality. The future catalogue remains deferred.
