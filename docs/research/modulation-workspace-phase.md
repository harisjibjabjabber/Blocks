# Modulation workspace phase

Status: implemented and locally verified, 11 November 2026. Preview revision `52eda8cc0e5061c01095`. Independent scoped UX and technical gates pass; listening approval and remote CI remain open.

The user requests a coherent instrument workspace, with four drawable LFOs and three envelopes available below every sound page. Env 1 remains the existing per-voice amplitude envelope; Env 2 and Env 3 are assignable. Each main oscillator and the mono Sub needs an octave selector from -3 through +3 and independent fine tuning. The Sub should visually belong to the oscillator family. Tone gains two independent filters, A and B, with visible routing and a neutral second-filter default.

## Interaction contract

A clearly marked source handle is separate from the source-selection tab. Dragging it to an eligible dial creates one typed assignment. Touch and keyboard users can select Assign, then select a target without a precision drag. A drop opens signed depth adjustment. An intentional new assignment starts at +10% depth, with a visible source power action; it does not silently enable a shared LFO or change an existing route. Init remains neutral and depth double-tap returns to zero. Modulation depth has a source-coloured arc, distinct from the dial base value, with a live marker from engine source telemetry. Matrix is a compact optional view of the same assignments, not a second routing state. Deleting an assignment and Undo must preserve source shape, phase and unrelated assignments.

The dock follows the active sound page. Desktop can pin the editor; on narrow screens the source strip remains reachable and the editor stays in page flow rather than covering the instrument. Existing drawable LFO shapes, sync/free rates, retrigger and double-tap reset remain available. Discrete switches, oscillator model/wave selection, counts and routing switches are not advertised as continuous modulation destinations. Unsupported targets must never receive decorative modulation indicators.

## Reference and boundaries

The interaction reference is Xfer's official [Serum 2 knob and slider guide](https://xferrecords.com/web-manual/serum-2/using-knobs-and-sliders), [pitch controls](https://xferrecords.com/web-manual/serum-2/using-pitch-controls), [oscillator/filter routing](https://xferrecords.com/web-manual/serum-2/routing-an-oscillator-or-filter), and [modulation documentation](https://xferrecords.com/manual/serum-2/docs). These document source assignment, route removal and depth editing. Blocks will use its own visual design and keep the user's double-tap-to-default behaviour. This is not a claim to reproduce Serum DSP or proprietary code.

Worn Media and resampling/grain remain backlog. This phase provides a shared modulation foundation for those later blocks.

## Acceptance gates

- Audio: independent pitch changes, distinct filter states, correct per-note envelope lifecycle, no-route neutral sound, working typed modulation and nonfinite/rejected-state safety.
- State: one canonical assignment registry, strict import before mutation, export/reload, Undo and target cleanup.
- Interaction: source drag/drop, touch assign, signed depth, route removal, source switching and consistent dials across pages.
- Visual: 320/390px and desktop review, no clipped controls, no dock obstruction, no mojibake, real moving indicators.
- Independent QA/UX can reject before the preview is presented as complete.

## Delivered and verified

Four fixed drawable LFOs and three live per-voice envelopes share the bottom dock. Env 1 owns amplitude; Env 2/3 are assignable. Graph nodes and curvature remain directly editable. Matrix replaces the graph while open, and source selection returns to the graph. New assignments start at +10% with explicit shared-source power. Source state, routes, target cleanup and Undo use one canonical model. Dial arcs show signed assignment depth; moving markers read actual native physical values. Bus envelope modulation aggregates the maximum active voice, while voice destinations retain independent note envelopes.

Tone has a matching Sub card, independent octave −3…+3 / fine controls on all three sources, and independent A/B parallel filters. Each source splits equally between its selected enabled filters. B starts off. Sub offers five waves and a native generator preview. All pages use the same 1440px maximum shell; 700–899px uses two oscillator columns with a full-width Sub. Power icons, touch targets, footer space and scroll padding are consistent.

Current files require envelopes/tuning/filterBank and all four LFO sources. Factory Osc 2 offsets appear in its Fine dial; the raw relative-offset control is retired from the browser format. The old implicit filter-envelope amount is also retired: current movement uses explicit Env routes. Native physical APIs remain independent of the browser's save format. Bound-primary Drop controls/targets appear only when the actual bound processor exists; deleting it prunes both source families. Free Delay Time and free Bass Spin cannot be newly assigned in Sync; saved inactive routes remain visible/removable. Synced LFO clock-speed modulation remains audible, distinct from the discrete Division selector.

Local validation:

- 103 frontend Node tests pass, including strict current-file validation and worklet ABI encoding.
- All 36 functional WASM targets pass across the sweep and focused reruns. The sweep found a real explicit-rack/global pitch-drop duplication in its last target; the implementation was corrected and all eight rack-host groups reran successfully. No assertion was relaxed for that regression.
- Ten focused DSP/C-API groups cover atomic configs, measured independent tuning, actual Filter B audio, per-voice Env 3, Gain/Sauce/LFO routes, live envelope progress, base-state retention, block invariance, panic, allocation checks and five-wave Sub previews. The envelope-to-clock ratio measured 4.47213428 against the descriptor-derived 4.47213595.
- The eight modulation-focused browser suites pass 165 checks, followed by nine final guard/layout checks on revision 444bff. Standalone interaction/audio, Suite, filter shape, nine-width Tone layout and oscillator-routing regressions also pass. Existing source, Reverb and Creative browser checks remain in the CI workflow.
- A/B renders against the preceding build are bit-exact for three 96,000-float default/Ladder/seven-copy reference signals, with new features inactive.
- Independent visual checks cover 320/390px and desktop; nine-width layout checks include 760px. The source assignment, route removal and footer scroll paths use real pointer events.

Evidence is in the local workspace sibling directories: `phase13-review/workspace-node-final.log`, `workspace-integration-final.log`, `workspace-proof-evidence`, `workspace-spots-evidence`, and individual browser reports. Browser sessions are isolated, muted and closed after tests. No subjective listening approval is inferred.

## Budget measurement and limits

An offline 48kHz/128-frame fixture with four held voices, seven copies on each oscillator, Ladder Drive 8 and one Harmonics Colour stage measured mean/p99 blocks 1.472/1.786 ms without routes. With eight LFO routes and two envelope routes, mean/p99 were 2.084/2.423 ms against a 2.667 ms deadline. One measured block reached 2.815 ms. This is a device-specific diagnostic, not real-time or arbitrary-polyphony certification; the CPU display remains an estimated render-budget meter. Optimization and heavier routing stress remain later work.

Discrete model/routing/count controls and composite recipes are not continuous destinations. Independent note generators keep their own scheduling controls; full note-processor modulation and cross-group audio routing remain future work. The current matrix exposes only implemented meaningful targets, including mode-dependent timing guards. Worn Media and resampling/grain are still backlog, not implemented effects.

Final visual validation adds centered overlays across Tone/Character/Harmonics/Space and zero-offset marker alignment for square-root Drive, piecewise envelope time and Glide. Depth spans retain native physical meaning before conversion to each dial's visual scale. Arming a source preserves the open editor; cancellation cannot redirect later edits to a different source. All 21 workspace checks, including the nine final guards, pass with zero browser exceptions on the final revision.
