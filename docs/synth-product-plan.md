# Synth product plan

Date: 9 November 2026. Status: product/design direction with a portable engine and first touch UI prototype; physical-device and listening acceptance are still outstanding.

## Product direction and current evidence

Blocks is a phone/Fold instrument played from a real piano or its touch keyboard, with capture and editable layers. The experience takes inspiration from the OP-1's immediacy and common instrument structure. The existing Blocks storyboard, quiet graphite surfaces, serif titles and real keys remain the visual reference. Desktop gets a wider composition of the same instrument.

Synth is the first product priority. Sampler, sample recording and a curated high-quality instrument library remain later work. A full synth can deliver the core product without the sampler.

An isolated, visual-only interaction study exists outside the app source. It demonstrates phone Perform/Shape and desktop layouts, filter/EQ points, bendable amplitude-envelope segments, hidden precision sliders, drift amount/speed, voice spread and drive. It does not demonstrate audible DSP, device latency or measured synthesis quality. No runtime feature is implied by this document.

## Expandable instrument surface

Use three durable destinations within Sound, rather than a new top-level tab for every effect:

| Destination | Contents | Default presentation |
|---|---|---|
| Synth | Oscillator/tone, amplitude/filter envelopes, voicing, character/drift | One central editing surface with a few named controls |
| Sauce | Named recipes and effects built from shared processing/modulation | A small active recipe list; tap one to open its controls |
| Movement | LFOs, custom repeating shapes and recorded/drawn automation | Later: one selected lane on a musical timeline |

These Sound destinations do not replace Play/Capture or Edit MIDI. Returning to Play and opening Edit MIDI must remain obvious. Phone shows one working surface at a time. Desktop can place the selected canvas and its control panel side by side. Fold may use the wider composition when space allows.

The mockup's flat Tone/Envelope/EQ/Drift tabs are interaction studies. In the expandable design, Tone and Envelope belong to Synth, Drift is under Character, and EQ/insert processors are available through Sauce. These categories share parameter controls; they do not require different underlying engines.

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

Warmth, Echo and Space still require real saturation, delay and reverb DSP. A recipe can configure those processors once they exist; an automation curve alone does not create the processing. Distortion/drive is available as a detailed processor within Sauce, with Warmth as an approachable recipe. Drift can likewise be surfaced as a Sauce shortcut to Synth's Character controls without duplicating parameter ownership.

Begin with a curated small selection. Expand the recipe library as shared building blocks become proven. A large library is compatible with a quiet interface; a large permanent bank of knobs is not the goal.

## Signature sound: Character and Fullness

User direction: an instrument that feels alive, with an edge that is slightly broken but stays harmonic. A distinctive, lightweight character should be present in the starting sound, not depend on adding a stack of effects. Aim for small changes in harmonic density, attack texture and persistent voice differences; keep pitch drift gentle enough that chords remain in tune. More character must not simply mean louder, noisier or more detuned.

Keep two purposes separate within Synth's Character area:

- **Character** controls wear and motion: a curated overall macro over a small, versioned mapping of existing sound parameters. Advanced values remain collapsed. Editing an underlying mapped value independently marks the macro **Custom**; it must not silently overwrite that edit, create a second competing parameter owner, or pretend the patch still follows the macro. Returning to a macro setting is an explicit, undoable gesture. Drift remains independently evolving per voice rather than a shared pitch wobble.
- **Fullness** controls tonal body: the sense of depth and weight in bass, but also solidity in chords and upper-register notes. It is distinct from wear, pitch drift and output volume. Do not implement it as hidden unison, an extra octave, or an unexplained gain boost. The control earns its place only if a level-matched comparison demonstrates a useful tonal change across registers.

The initial core already has soft tanh drive and seeded pitch drift. Those can shape the first factory patches; the broader character ideas below are not claims about current DSP. Gentle default settings are a listening target, not a requirement to enable every proposed process. Keep a clean, reproducible setting available and serialize the exact values and macro version.

### Fullness prototype, not accepted sound

The corrected prototype adds a small same-phase harmonic residual to the actual oscillator mix, before the unchanged Tone and Drive stages. The residual is `0.12*x*x + 0.20*(x*x*x - 0.75*x)`, processed with first-order antiderivative antialiasing (ADAA) and a DC blocker. The former separately phased, four-pole wet path and note-dependent body trim have been removed. There is no additional dark filter, automatic gain pumping, resonance or transistor-circuit model. Fullness remains parameter ID 18. Fullness zero retains the original dry path; nonzero Fullness intentionally sounds different from the earlier prototype, including the old 0.55 fixture. No unchanged-audio claim applies to that former nonzero fixture.

Fullness was introduced in ABI/patch version 2. Current version 3 appends the two independent waveform choices while retaining IDs 0–18; older patch migration and current measurements are described in the [core README](../packages/synth-core/README.md). Core/WASM checks do not establish listening quality. High Drive may mask the subtle enrichment, and whether this correction provides the desired musical body remains a listening decision.

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

These notes preserve the broader instrument vision while the current slice binds the approved touch surface and useful patches. They do not authorize adding more processors or UI beyond the separately approved Fullness prototype.

### Latest listening direction and movement reference

The user wants Character to be a curated selection of the best distortion, warmth and fatness behaviours, not a generic dark low-pass effect. Study the audible differences between soft/hard clipping, asymmetry, stateful saturation and filter drive before choosing a flavour. Longer term, the user wants a broader suite with both parallel blends and serial stacks. That requires explicit signal order, bypass/tail behaviour, gain staging and independent processor state; it is a future architecture goal, not an instruction to build a distortion stack in the current UI pass.

**Fullness has not passed listening acceptance.** The user reported that increasing the earlier implementation became quieter and sounded like filtering rather than the desired warm, substantial analogue character. Initial source-level diagnosis included its steeper wet-path filtering, the shift of spectral energy toward lower frequencies, and note-dependent level trim; subsequent measurements also identified dry/wet cancellation with detuned oscillators. The same-phase correction removes that separate path rather than increasing output. Earlier fixture-specific level checks do not invalidate the original report or establish universal compensation. Preserve the complaint as a regression case and audition the correction without changing the player's envelope.

The earlier live patch read had Sustain=0. A later screenshot has Sustain=1 and is saved as the rounded version-2 [user movement reference](audio-references/user-movement-20ct.json). These are different historical observations, not contradictory readings to overwrite. The accepted aspect of the later screenshot is pitch movement: approximately **20 cents drift, 0.58 Hz speed and 4.8 cents oscillator-2 detune**. Its Drive/Fullness sound is still under review; the file is not an exact exported patch or blanket sound-quality approval.

Character recipe version 2 now extends the main macro to 20 cents while preserving the existing mapping throughout 0–60%, keeping the three factory patches' physical Character values unchanged. This is parameter compatibility, not unchanged audio across the separate Fullness correction. Keep direct advanced control independent: this does not impose a new hard cap on the core's existing 40-cent drift range. Store actual physical values and show Custom when they no longer fit the selected recipe version.

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
- **Character:** drift amount/speed and stable differences between voices. Preserve tuning on average; do not make every voice follow one identical periodic pitch wobble.
- **Glide/Legato:** specify note-trigger and envelope-retrigger behaviour explicitly.

Offer clear controls rather than one ambiguous Voices value. Initial counts and quality modes are benchmark decisions. For illustration, eight simultaneous notes with four-way unison means 32 stacked voices before counting oscillators, release overlap and other layers. Do not promise unlimited counts on phones, and do not silently change another layer's patch to meet a budget.

The current core's 16-note polyphony is not a unison count. Two oscillator waveform choices are already independent; separate per-oscillator level and tuning controls remain future work. Keep those distinct from future unison Count/Detune/Width and from the proposed unpitched texture source.

## Focused sound-development roadmap

The current continuation adds performance robustness, selectable oscillator waveforms and reproducible actual-core audition fixtures. The items below are future design work, not features shipped by that continuation. Preserve one portable sound core and a small parameter/recipe vocabulary across browser, future plugin and Blocks hosts.

| Candidate | Musical purpose and bounded first experiment | What requires real engineering |
|---|---|---|
| Resonance | Give the filter an expressive peak and more articulation; first define useful gain-compensated behaviour with the existing waveform/Fullness range | A stable resonant filter, parameter smoothing, overload behaviour and high-frequency/aliasing tests. A resonance knob cannot be a macro around the current nonresonant poles. Self-oscillation is a separate decision, not an assumed requirement. |
| Filter envelope / Filter Pluck | One per-note envelope with Amount and Decay; retain the amplitude envelope as a distinct control | Reuse envelope generators but add a real per-voice filter-modulation path. Define the cutoff baseline, modulation units and bounds; overlapping notes must not sweep the entire layer together. A recipe can simplify these controls only after the path exists. |
| Mono, legato and glide | An expressive bass/lead mode with a clear last-note-priority policy and optional glide on overlapping notes | A held-note stack, retrigger rules, return-to-previous-note behaviour, sustain interaction and a choice of constant-time versus constant-rate glide. Glide changes generated pitch, not captured note values. Poly remains unchanged. |
| Velocity and aftertouch | Let touch/MIDI playing shape brightness or expression without more permanent controls | Velocity is already an attack input; additional mappings need explicit depth and response. Channel pressure affects a channel, while polyphonic key pressure needs note ownership. Add host/core expression events and bounded smoothing deliberately; do not advertise aftertouch or MPE merely because a browser receives MIDI bytes. |
| Heater and focused effects | Start with a subtle level-matched drive flavour and one useful Amount control; add further effects only after listening shows a need | A Heater recipe can configure existing drive/Fullness once its mapping is useful. A distinct asymmetric or hysteretic flavour needs its own tested DSP. Delay, chorus or reverb need actual processors, memory/tail/bypass policies and CPU measurements; they are not made real by drawing an automation curve. |

The distinction between amplitude and filter envelopes, legato retrigger policy, and glide modes is informed by the [official Subsequent 37 envelope documentation](https://cdn.inmusicbrands.com/Moog/Subsequent37/Subsequent_37_Manual_0.pdf) and [u-he's Diva instrument description](https://u-he.com/products/diva/diva.html). These are references for musical semantics, not promises of matching their circuits or sound. MIDI expression meanings follow the [MIDI Association message summary](https://midi.org/summary-of-midi-1-0-messages).

Choose one experiment at a time after auditioning the current factory patches. A successful addition must be distinguishable and useful at matched level, keep the stable harmonic character, preserve voice ownership and patch migration, pass native/WASM timing and numerical checks, and fit a measured phone budget. Show it first as a small extension of the existing Synth/Sauce surface; do not create a new permanent destination for each feature. Offline WAVs are deterministic listening material, not evidence that somebody listened or that a physical phone performed well.

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

The initial scope above was research and mockup work. Subsequent user instructions authorize an independent instrument and its Character/Fullness sound direction, suitable for future online and VST hosts. The implementation is [the portable C++ core](../packages/synth-core/README.md) and [a separate browser instrument](../packages/synth-web/README.md). The first actual phone/desktop surface now includes tone/curved-envelope editing, a declarative Character macro, separate Fullness, Pitch Drop, three factory patches, gesture Undo/cancellation and playable octave selection. It does not replace Blocks production audio or constitute a shipped VST. Filter Pluck, resonance, unison, effects expansion and Movement remain future work. Physical phone performance and listening acceptance remain gates before production integration.

## Research references

- [Ableton: Automation](https://www.ableton.com/en/live-manual/12/automation/) documents recorded gestures and drawn breakpoint/shape editing; reference for interaction semantics, not copied UI.
- [Ableton: Wavetable CPU load](https://help.ableton.com/hc/en-us/articles/360000036930-Managing-CPU-load-when-using-Wavetable) distinguishes note polyphony and unison processing costs.
- [Diva manual](https://u-he.com/downloads/manuals/plugins/diva/Diva-user-guide.pdf) separates slow drift, per-voice offsets and other variance controls.

These references inform the proposal. They do not establish the performance, licensing or sound quality of any future Blocks implementation.
