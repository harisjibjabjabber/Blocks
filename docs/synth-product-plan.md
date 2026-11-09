# Synth product plan

Date: 9 November 2026. Status: product/design specification, not an implemented engine or a performance claim.

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

## Voicing

- **Mono/Poly:** one note or simultaneous notes.
- **Polyphony:** maximum concurrent note voices, including release tails. It is a resource limit, not a loudness control.
- **Unison/Stack:** multiple detuned oscillator/voice copies for each played note; expose Count, Detune and Width.
- **Character:** drift amount/speed and stable differences between voices. Preserve tuning on average; do not make every voice follow one identical periodic pitch wobble.
- **Glide/Legato:** specify note-trigger and envelope-retrigger behaviour explicitly.

Offer clear controls rather than one ambiguous Voices value. Initial counts and quality modes are benchmark decisions. For illustration, eight simultaneous notes with four-way unison means 32 stacked voices before counting oscillators, release overlap and other layers. Do not promise unlimited counts on phones, and do not silently change another layer's patch to meet a budget.

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

The initial scope above was research and mockup work. The subsequent user instruction authorizes an independent instrument engineering spike, suitable for future online and VST hosts. The first implementation is now [the portable C++ core](../packages/synth-core/README.md) and [a separate browser reference host](../packages/synth-web/README.md). It does not replace Blocks production audio. The reference host proves real sound and state boundaries; it is not the finished touch UI or a shipped VST. Filter Pluck, unison, effects expansion and Movement remain future work. Physical phone performance and listening acceptance remain gates before production integration.

## Research references

- [Ableton: Automation](https://www.ableton.com/en/live-manual/12/automation/) documents recorded gestures and drawn breakpoint/shape editing; reference for interaction semantics, not copied UI.
- [Ableton: Wavetable CPU load](https://help.ableton.com/hc/en-us/articles/360000036930-Managing-CPU-load-when-using-Wavetable) distinguishes note polyphony and unison processing costs.
- [Diva manual](https://u-he.com/downloads/manuals/plugins/diva/Diva-user-guide.pdf) separates slow drift, per-voice offsets and other variance controls.

These references inform the proposal. They do not establish the performance, licensing or sound quality of any future Blocks implementation.
