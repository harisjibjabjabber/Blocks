# Blocks — component inventory (PROPOSED rev 2)
Shared between React Native (Android) and the web UI. Sizes in dp (= CSS px on web). Stage = first stage needed.

| Component | Variants / states | Key props (UI contract) | A11y role / label | Stage |
|---|---|---|---|---|
| ReadinessChip | sound, input, audio × ok / attention / error / pending | `kind`, `status`, `text`, `onPress` | button, "Input: Keystation, receiving" | P0 |
| ReadinessCard | 8 error types (spec §3.6) | `title`, `cause`, `primaryAction`, `steps[]` | alert region | P0 |
| TakeRibbon | live, paused, dense-thinned | `events`, `phraseBracket`, `bufferKept`, `lastEventAge` | image + text summary | P0 |
| HistoryChip (BufferMeter) | normal, age-evicted (no error), overload gap (flagged), delivery uncertain | `keptSeconds`, `gaps[]`, `deliveryState` | text | P0 |
| CaptureButton | ready, empty-buffer, capturing (600 ms), disabled-never | `sublabel`, `targetLayer`, `onCapture` | button, dynamic label | P0 |
| LayerSlot / LayerRow | empty, target, playing, muted, soloed, grid-owner | `index`, `sound`, `thumb`, `state` | radio (target) + buttons | P0 |
| TargetChip (narrow) | collapsed, open picker | `target`, `layers` | combobox | P0 |
| Transport | stopped, looping, original-take | `playing`, `position`, `playbackTempo` | toggle button | P0 |
| UndoRedo | enabled/disabled with label | `undoLabel`, `redoLabel` | button "Undo move 3 notes" | P0 |
| Sheet | peek, half, full; non-modal | `maxHeightPct`, `dismissKeeps` | dialog (non-modal) | P0 |
| ReviewTimeline | ghosts, loop brace, beat-one marker, gap marker, synthetic-release marker | `take`, `grid`, `gaps`, `synthetic` | adjustable sub-controls | P0 |
| TempoChoice | inferred + ½/×2/Set BPM; extra alternatives only if supplied; no-pulse; locked | `inferred?`, `alternatives[]`, `pulse`, `locked` | radio group | P0 |
| SlotsFullChooser | new (if supported) / replace… / take only / cancel | `options` | dialog | P0 |
| ChipGroup (single-select) | default, selected (✓ + thick outline) | `options`, `value` | radio group | P0 |
| Stepper | −/value/+; repeat on hold | `value`, `step`, `bigStep` | adjustable | P0 |
| Snackbar | info, undo | `text`, `action`, `durationMs` | status live region | P0 |
| Banner (persistent) | warning, error | `text`, `actions[]` | alert | P0 |
| SoundRow | normal, selected, favourite | `name`, `category`, `fav` | button + toggle | P0 |
| PianoRollCanvas | per tool; zoom 16–64 lanes | `notes`, `selection`, `tool`, `viewport`, `loop` | list of notes (SR) | P0 |
| NoteView | idle, selected, dragging, ghost, invalid | `pitch`, `start`, `len`, `vel` | listitem w/ custom actions | P0 |
| NoteHandle | L / R; outside-tab for short notes | `side` | (part of note actions) | P0 |
| Loupe | above / below; readout | `anchor`, `readout` | hidden (readout announced) | P0 |
| ToolChips | Edit, Draw, Range | `tool` | radio group | P0 (Range P1) |
| ActionBar | contextual, overflow | `actions[]` | toolbar | P0 |
| QuantisePanel | preview, applied | `grid`, `strength`, `mode` | dialog | P0 |
| AmbiguityPicker | 2–4 candidates | `candidates[]` | menu | P0 |
| Rulers (time, key) + Overview | with loop brace | `viewport` | scrollbar-ish buttons | P0 |
| VelocityLane | stems; drag | `notes`, `selection` | adjustable per note | P0 view / P1 drag |
| OnScreenKeys | swipe play/scroll, sustain latch, octave | `octave`, `swipeMode`, `latched` | "On-screen keys (this device)" group | P0 |
| ControllerLearnRow / ListeningPanel | idle, listening, conflict, mapped, timeout | `action`, `mapping`, `incoming` | button / status | P0-lite / P1 |
| SaveStatus | saved, saving, failed | `status`, `time` | status | P0 |
| RecoveryDialog | recovered vs last saved | `versions` | dialog | P0 |
| ExportSheet | MIDI all/per layer, stems, mixdown; timing; length | `options`, `progress` | dialog | P0 (MIDI) / P1 (stems) |
| HingeAwareLayout | flat, book, tabletop | `foldingFeature`, `sizeClass` | — | P0 (book) / P1 (tabletop) |
