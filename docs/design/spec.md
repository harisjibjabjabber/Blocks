# Blocks — UI/UX & Interaction Design Spec
**Status: PROPOSED (rev 3.3, 8 Nov 2026 — see `CHANGELOG.md` and `LIMITATIONS.md`).** Nothing here is implemented or user-tested. **All numeric limits, timings and UI dimensions (dp, ms, s, counts) are proposals pending measurement on device.** Sound names such as "Warm EP" are placeholders until the sound set is chosen. Platforms: Android phone, Samsung Galaxy Z Fold (folded and open), desktop and Android web browsers (Web MIDI + Web Audio). Companion files: `CHANGELOG.md`, `research.md` (sourced findings), `sources.md`, `gestures.md`, `state-machines.md`, `acceptance-criteria.md`, `components.md`, `qa-review.md`, `usability-test-script.md`, `tokens.json`, `wireframes/*.svg`.

**Design principle:** more time playing, less time touching the screen. The success metric is touches between "I played something good" and "it's looping in a layer". The target is ≤ 1 touch, or 0 when Capture is mapped to a spare CC/button/pad (optional; no spare pedal is required).

---
## 0a. High-fidelity directions (rev 3) — PROPOSED
**Precedence (rev 3.1, Haris via lead): the hybrid.** Graphite Studio's main UI is the structural base, and it takes precedence. Its information architecture, its explicit separate instrument/layer cards, its controls and the discoverability of its features all stay. From Paper Score the hybrid borrows character only: editorial serif headings (sketch title, capture-sheet headlines such as "Four bars, at ninety-two."), italic chord and sound names, and stave hairlines inside layer cards. It never replaces the structure with a score sheet and never hides instruments. The same hybrid comes in **dark** (the default for playing) and **light** (daylight, review, export). Assets are in `hifi/hybrid/{dark,light}/`, and the tokens are in `tokens.json` → `hifiDirections.hybrid`.

Two directions are rendered in `hifi/`: **A Graphite Studio**, which is recommended, and **B Paper Score**, which is kept for a light theme and for the export and share view. The seven-frame storyboard, the Fold and desktop key frames and the clickable prototype all use A. `hifi/README.md` gives the rationale, the file list and the limitations. Where A differs from §0 below, A wins: accent `#FF7442`, a reach-back Capture glyph (never a record dot), serif italic chord names, empty slots collapsed into one 48 dp row, and dim text at AA. `tokens.json` → `hifiDirections` holds both palettes.

## 0b. Rev 3.2 — Take history + capture range, harmony labels, Settings (Haris via lead) — PROPOSED
Nothing here is implemented, and nothing claims the current build supports it. **All numeric gesture values in this section (dp, s, px, zoom limits) are provisional until device testing.** All notes and chord names in the frames are design/example data. Frames: `hifi/hybrid/{dark,light}/08-…16-*.png` (editable `src/*.html`, 2× PNGs `src/*@2x.png`), overview `hifi/hybrid/{dark,light}/range-overview.png`.

### 0b.1 Priority framing
The engine chooses the phrase. One Capture should normally take the whole musical phrase with no handles touched (frame 09: four chords plus the pickup into bar 1, one action). The handles are an effortless correction for when the guess is wrong (frame 10: only the last chord, A7alt, selected → frame 11: drag ⟦ back → frame 12: fixed, with Undo). The storyboard always shows the success case first.

### 0b.2 Take history is the main Play view (not a separate editor)
- The ribbon on Play becomes a real piano roll of the retained rolling history: notes plotted pitch against time, with durations, over a useful pitch range (auto-fitted to played notes, C labels on the key strip), a bar ruler when a grid is estimated or set, or a **seconds ruler in free time**. A thin overview strip above shows the whole retained history (target 120 s, A1) with the current viewport.
- The proposed capture range is a tinted wash with an accent band, bounded by **⟦ Start** and **⟧ End** handles. Each handle is a 48 × 48 dp tab under the roll plus a 48 dp-wide vertical grab zone over the full roll height. A chip in the roll header names the range ("auto ✓ 4 bars", "auto: 1 bar", "4 bars · end fixed").
- The live edge is a glowing accent line ("now"). Layer/instrument cards stay visible below the roll in every state (Graphite's separation is kept); Capture and the thumb row stay where they were.
- The view **auto-follows** live input at the right edge. Panning, zooming or holding a handle pauses following; a high-contrast **Back to live ›** pill appears and returns to following (also `L`). Following resumes on its own after Capture.

### 0b.3 Three different operations, kept apart
| | What it changes | Where | Destructive? |
|---|---|---|---|
| **(a) Loop-boundary adjustment** | Which part of the take is the loop. **Dragging ⟦ moves the start while the end stays fixed, so the loop length changes** (frame 11 before Capture; frame 13a on a captured loop: 4 → 5 bars). Dragging ⟧ moves the end with the start fixed. | Take history (Play) | **No.** Raw events and their times are untouched; one Undo step per drag. |
| **(c) Phase nudge / Slide** | Where beat one falls. **The dedicated Slide control keeps the loop length and shifts beat one** (frame 13b: 4 bars, beat one −1 beat). Both handles move together ("⟷ slide · length locked"); ‹ › steps by a beat. | Loop sheet, *Slide (phase)* segment | **No.** Grid/phase metadata only (A2: tempo stays locked). |
| **(b) Cutting and note edits** | Notes themselves: cut, delete, move, trim. | Edit tool only (frame 07) | **Yes**, so they need explicit intent (entering Edit, choosing the tool) and are undoable. Never reachable by dragging a range handle. |
Original timing is always preserved; quantise stays a separate, non-destructive Edit control (rev 2 decisions unchanged).

### 0b.4 Required states (each has a frame)
- **Free time vs established grid.** Before Capture the bars are *estimated* (dashed barlines, "bars est. 92 BPM · tentative"). After Capture the grid is *set* (solid barlines, tempo in the header). With no steady pulse (frame 15) there is a seconds ruler, "no bars invented", and handles snap to note onsets only.
- **Snap and override** (frames 11, 16). Snap targets: Note onsets, Beats, Bars, or Off. The default is onsets + bars when a grid exists and onsets only in free time. Override for one drag: slide the finger up away from the handle (fine mode, no snap) or hold Ctrl/Cmd (desktop) or Shift in the prototype. A magnifier (≈150 × 100 dp, offset ≈72 dp above the finger; both provisional) rides above the finger, offset so the finger never hides the boundary, and names the snap target ("Snap · bar 1 · onset").
- **Pan, zoom, auto-follow** (frame 16). One finger outside a handle zone pans; pinch zooms time (chip "2 bars visible"); the overview viewport moves; following pauses and Back to live appears. Dragging a handle within 32 dp (provisional) of the roll's edge auto-scrolls the view at a speed proportional to depth.
- **Notes across loop edges, pickups, anacrusis** (frames 09, 12, 14). A pickup just before bar 1 is kept and shown (dashed "pickup kept" bracket). **Repeating pickup (explicit PROPOSED behaviour, not an engine contract):** in loop playback the pickup is proposed to play in the last beat before each repeat (wraps); its raw time is unchanged. Whether it should instead play on the **first pass only** is an unresolved audition/test question (§0b.9); no control is added for it. A note held across the loop end is **clipped for playback only** with a synthetic release (kept separate from raw events, A1/A8); the raw note stays full length, drawn as a dashed tail past the end.
- **Easy Undo** (frame 12). Every range edit, slide or label toggle is one Undo step; a non-blocking toast ("All four chords. Range 4 bars (was 1).") carries an Undo button, and the persistent ↶ in the thumb row works too.

### 0b.5 Optional harmony labels and role tags — optional and research-gated (rev 3.2.1)
- Status: **optional, research-gated, no further visual work planned.** They ship only if harmony/role recognition research supports them; until then every chord name and role tag in the package is mock data and no recognition accuracy is claimed.
- Small italic chord labels above bars with jazz extensions, alterations and inversions (mock: *Dm9 · G13(♭9) · Cmaj9/E · A7alt*). Where recognition is uncertain, an honest alternative appears below at lower emphasis (*or Dm9/G*), never as a percentage and never as fabricated candidates (A4 spirit).
- Role tags per phrase or layer: chord, melody, arpeggio, bass. **Only chord and melody tags are drawn in the frames; arpeggio and bass tags are deliberately not drawn** (same treatment, no new visual needed).
- Raw pitch-vs-time notes remain the primary, legible layer. Labels are optional and toggled with the **Aa labels** chip (also in Settings → Capture). They are hidden while a handle is being dragged and are never bigger than 15 px (provisional).

### 0b.6 Gesture ownership on the roll
Handles own every touch that starts inside their 48 dp zone (handle beats pan). One finger elsewhere pans; two fingers pinch-zoom; a second finger during a handle drag cancels the drag and reverts it (consistent with the piano-roll pointer rules). Taps on notes do nothing on Play (no accidental edits); long-press opens Edit at that spot. Full table: `gestures.md` §9.

### 0b.7 Accessibility and keyboard
Each handle is a slider ("Loop start, bar 1 beat 1, 4 bars selected"). Screen-reader actions: *Move by note / by beat / by bar, earlier / later*, *Slide phase by a beat*, *Back to live*, *Toggle labels*. Desktop: `[` `]` focus start/end; `←/→` by note onset, `Alt+←/→` by beat, `Shift+←/→` by bar; `Ctrl/Cmd` during drag = no snap; `S` slide; `,` `.` beat one ±1; `L` back to live; `C` Capture; `Ctrl/Cmd+Z` undo. Range changes are announced politely.

### 0b.9 Open questions (unresolved, rev 3.2.1)
| # | Question | How to resolve | Status |
|---|---|---|---|
| OQ-1 | **Repeating pickup vs first pass only.** Should a kept pickup replay before every loop repeat (current PROPOSED behaviour) or sound on the first pass only? | Audition both with musicians (usability script task R4) and QA item 18; decide before any engine contract. No user-facing control is planned. | Unresolved |
| OQ-2 | Auto-proposal hit rate: how often does one Capture take the whole phrase? | Measure on scripted and free-played phrases (AC-RNG-02). | Unresolved |
| OQ-3 | Provisional gesture numbers (32 dp edge zone, ≥ 6 s Undo toast, 72 dp magnifier offset, zoom limits ≈1 bar/4 s to all history, 40 dp slide-up override, 15 px label cap). | Device testing on phone, Fold and desktop. | Provisional |
| OQ-4 | Harmony labels and role tags: ship at all? | Recognition research; optional and research-gated. | Research-gated |

### 0b.8 Settings → Appearance (frame 08)
Reached from the **Blocks ⌄** wordmark menu at the top-left of Play (on desktop the same menu in the top bar); never on the play surface. **Appearance: System (default) · Light · Dark**, with a small dark/light preview strip and the note "Switching applies instantly. Audio, playback and MIDI input keep running. The choice is saved on this device." The bottom bar shows the sketch still looping. A "More (proposed)" list holds MIDI devices and Capture (history target, snapping, labels).

## 0c. Rev 3.3 — Full-screen piano-roll editor (Haris via lead) — PROPOSED
Storyboarded **before implementation**. Nothing here is implemented, user-tested, or claimed to work in the current build; the editor edits a captured layer, and engine capture itself is not claimed to work today. All notes, velocities and counts in the frames are design/example data. **Every numeric value in this section (48 dp targets, loupe size and offset, slop, pinch limits, toast duration) is provisional until device testing** (OQ-3). Frames: `hifi/hybrid/{dark,light}/17-…27-editor-*.png`, `fold-18-editor.png`, `desktop-18-editor.png`; overview `editor-overview.png`; 2× screens `src/*@2x.png`; editable `src/*.html`; generator `hifi/src/editor.py`. Where this section differs from §3.11 (rev 2 piano roll), **this section wins**: tools are now Draw / Select / Erase (Select absorbs rev 2 "Edit" and "Range"), and loop boundaries are read-only inside the editor.

### 0c.1 Entry and return (17, 27)
- **Enter:** tap a layer's mini-roll on its Play card (17). One touch. The play screen gains **no new button**; long-press a note on the take history (§0b.6) also opens the editor at that time.
- The loop **keeps playing** throughout; the playhead, loop range and phase are preserved. The info bar says so ("▶ looping · 2.3 / 4").
- **Return:** ‹ Play (top-left, 48 dp) or system Back (27). Play shows the same sketch at the same playhead; a toast summarises the session ("Piano: 4 edits · loop kept playing") with Undo for the whole session.

### 0c.2 Legibility (18)
- Pitch key column (34 dp) with C labels; bar/beat ruler; grid shaded per beat, bar lines stronger.
- **Layer identity:** layer strip with number + glyph + name (◆ 1 Piano, ▬ 2 Bass, ● 3 Drums), the editing layer outlined and named in the title ("Edit · Piano · Layer 1 · Warm EP"). Glyph + text carry identity; colour is secondary.
- **Other layers stay visible:** "◐ Others shown" draws other layers as ghosts behind the grid (dimmed; off-screen ones as an edge chip, e.g. "▾ Bass · 8 notes below · ghost"). Switching layer is one tap on the strip.
- **Selection without colour:** selected notes get a 2 dp gap + 1.5 dp ring, an end handle, and a pitch label inside the note; the context bar states the count ("3 selected · 92 avg").

### 0c.3 Tools and gesture ownership (18–23)
The toolbar has three explicit tools — **Draw · Select · Erase** — plus Capture. The active tool is filled and carries a ✓ (non-colour). Rules (full table: `gestures.md` §10):
- **One finger always acts per the tool.** It never pans the grid.
- **Two fingers always navigate:** drag = pan, pinch = zoom (time or pitch by angle, as §3.11). A second finger arriving mid-edit **cancels and reverts** that edit (20).
- **Select:** tap a note = select it; tap another with the add-quasimode or long-press = add; double-tap = chord (same start ±1/32); **drag on empty grid = marquee** (20); drag a selected note's body = move in pitch and time (19); drag the end handle = resize (21). Shift-drag on the ruler = time range select.
- **Draw:** tap empty = add one note (last length, snapped); drag sets length (22). Draw never deletes; tapping a note selects it.
- **Erase:** tap or swipe across notes to erase (23). Erase stays on until another tool is chosen; each stroke is one undo step (toast "3 notes erased · Erase stays on · ↶ Undo").
- **Finger obscuration:** a loupe (≈196 × 96 dp, provisional) appears above the finger during move/resize/draw with a zoomed view and a text readout ("+2 semitones · +⅛ beat · F4→G4 · A4→B4 · snaps 1/16"); flipped/clamped near edges.

### 0c.4 Velocity (24)
- A velocity lane is always under the grid; bars for the selected notes are outlined and taller-contrast. "Velocity" in the context bar expands it into a panel **tied to the current selection**: bars, numeric readout per note (shown once per stacked chord), an average readout ("avg 78 → 66 · ×0.85"), a group bar to **drag-to-scale** the whole selection proportionally, −/+ steps, "Set all…" and Done. Previous values show as dashed ticks until Done.

### 0c.5 Quantise preview (25) — never automatic
- Opened from Quantise… in the context bar. **Scope is explicit**: "Selected · 6 notes" or "Whole layer · 20" (default = the selection if one exists; the Apply button names the count).
- Grid (1/4, 1/8, 1/16, 1/8T), **Strength** (default 50 %), **Swing** (default 0 %). Swing is included because the target user plays groove/jazz material where straight quantise flattens the feel; at 0 % it changes nothing and can be cut for P0 if testing shows it confuses.
- **Preview before apply:** the notes move live in the grid; the **as-played originals stay visible as dashed ghosts** and are kept (raw take preserved, A-decisions). Cancel restores; Apply is one undo step. Nothing is ever quantised automatically, on capture or on entry.

### 0c.6 Secondary actions (26)
"⋯" in the context bar: Duplicate after · Copy · Paste at playhead · Select all in layer · Delete. The toolbar stays at three tools. Desktop: Ctrl/Cmd + D / C / V / A, Delete.

### 0c.7 Loop boundary and phase stay separate
The editor shows the loop on the ruler as a **read-only** bracket with 🔒 and an info-bar chip "🔒 Loop · on Play". Boundaries and Slide/phase (rev 3.2 operations (a) and (c)) are changed only on Play. No editor gesture changes loop start, length or phase; note edits (operation (b)) never move the loop.

### 0c.8 Undo / Redo
↶ ↷ are always visible in the top bar (48 dp). Every gesture or applied action is one labelled step on the sketch's single history (A10). Leaving the editor offers a session-level Undo toast on Play.

### 0c.9 Fold expanded and desktop
- **Fold expanded** (≈840 × 1000 dp, assumed): editor on the left; right pane holds Selection actions, the Quantise card (scope, grid, preview/apply) and Layers (mute/solo). Same tools and ownership.
- **Desktop browser** (1440 × 900): layer rail and tools on the left (D / S / E), 4-bar grid, velocity lane, Quantise inspector and a keyboard map on the right. Mouse: drag empty = marquee, Shift-click add, double-click = chord, wheel = scroll, Ctrl/Cmd-wheel = zoom, Alt-drag = no snap; a cursor tooltip reads out pitch/position/velocity. Keys: ↑↓ pitch (Shift = octave), ←→ grid step, Alt = no snap, ⇧←→ length, ⌘/Ctrl Z / ⇧Z, Q quantise preview, V then ↑↓ velocity, Space play/stop, Esc back to Play.

### 0c.10 Quick Quantise on the play screen — evaluated, **recommended against**
Considered: a one-tap "Quantise" on Play. Recommendation: **do not add it** (revisit only if usability testing shows people look for it). Reasons: (1) scope is ambiguous on a multi-layer screen (which layer? which notes?), and a one-tap action could not name it; (2) quantise needs strength and a preview to be safe — a blind one-tap version invites destroying feel; (3) it adds a control to the screen we deliberately keep simple, and tempts "fixing" mid-performance; (4) capture review already offers grid correction at capture time (§3.7), and the editor's Quantise is two taps away (tap the layer → Quantise…) with explicit scope, preview and Undo. If it were ever added, it would have to name its scope ("Quantise Piano · 20 notes") and offer Undo in a toast.

## 0. Visual north star — sexy, sleek (owner direction, Haris)
Blocks should feel like a **premium, dark-first instrument**, not an app full of grey boxes. **Sexy never overrides usability or accessibility:** 48dp targets, WCAG contrast, non-colour cues and reduced-motion support always win over looks.

**The look:**
- **Dark-first instrument.** A deep graphite stage (`#0D0F13`), slightly lifted surfaces (`#14171C`, `#1B1F25`), and soft, quiet edges. A light theme exists later, but dark is the reference.
- **Restrained palette, one confident accent.** Neutrals carry the UI. One accent, **Signal** (`#FF6A3D`), is reserved for the thing that matters right now: Capture, the playhead/beat-one line, selected notes and the primary action. Never more than one accented control group per screen region. Status colours (warning amber, danger red) appear only in states, always with an icon and text.
- **Refined typography.** One family (Inter or the platform UI font). Tight tracking on large numerals and titles (−0.4 at ≥ 24sp), small uppercase section labels with +0.8 tracking, tabular numerals for tempo, bars and time. Scale 12 / 14 / 16 / 20 / 24 / 32sp, weights 400 / 500 / 650 / 750.
- **Generous negative space and minimal chrome.** No boxes around boxes. Panels separate by tone, not by lines. Hide secondary controls until context needs them. The ribbon and the music get the most space; chrome yields to playing.
- **Crisp, hardware-like finish.** A subtle top-down gradient on controls (2–3 % lift), a 1px top highlight that reads like a machined edge, 12dp radius on controls, 3dp on notes, and 28dp on the device frame. No skeuomorphic textures, no glassmorphism blur over music.
- **Tactile but subtle motion.** Capture press: 120 ms scale to 0.98, an accent glow pulse, and a haptic tick. Sheets: 220 ms ease-out. The new layer fades in at the boundary. Everything is ≤ 250 ms, never on the playhead's critical path. **With `prefers-reduced-motion` or the OS setting on:** no scale or glow, instant transitions, haptics stay optional.
- **Original identity.** The Signal accent, the history ribbon with its phrase bracket, the full-width Capture slab, and quiet graphite surfaces are Blocks' own. No imitation of any DAW, groovebox or app skin.

**Do:**
- Let Capture be the single brightest object on Play.
- Show the music (ribbon, notes) in high-contrast neutral light.
- Use tone steps to group.
- Keep labels short and confident.
- Pair every accent use with a shape or text cue.
- Test in a dim room and in sunlight.

**Don't:**
- Use more than one accent hue or rainbow layer colours as the only identity.
- Put thin grey text below 4.5:1.
- Draw outlines that are the only boundary of a control. Controls are identified by their text label; strokes are decorative.
- Use decorative animation while playing.
- Use tiny icon-only buttons.
- Use brand look-alikes.
- Hide the PROPOSED / placeholder status for style.

**Contrast check (computed, WCAG 2.x formula):**

| Pair | Ratio |
|---|---|
| Primary text `#ECEEF2` on bg `#0D0F13` | 16.5:1 |
| Muted text `#9AA3AF` on bg | 7.5:1 |
| Muted text on control `#1B1F25` | 6.5:1 |
| On-accent text `#120C0A` on Signal `#FF6A3D` | 6.8:1 |
| On-accent text on the gradient's darker end `#E2512A` | 5.0:1 |
| Signal on bg (playhead, beat one) | 6.7:1 |
| Selection outline `#FFFFFF` on bg | 19.2:1 |
| Note `#C9D1DC` on bg | 12.5:1 |
| Ghost outline `#6B7480` on bg | 4.1:1 |
| Warning `#E0A43A` | 8.7:1 |
| Danger `#E5484D` | 4.9:1 |

- Control strokes (`#2A3038`, 1.4:1) are decorative. The text label identifies each control.
- Selected versus unselected notes differ by a white 2dp outline plus handles, not by the accent alone. Accent against note is only 1.85:1.

**Restyled wireframes (visual north star style):** `00-play-portrait`, `03-fold-open`, `05-desktop`, `08-capture-review`, `11-piano-roll`, `16-capture-edge-states`. The others stay in the light schematic style for structure only.

---
## 1. Vocabulary
These terms are user-facing and must be used consistently in copy and code.

| Term | Meaning | Can the user change it? | What it never does |
|---|---|---|---|
| **Take** | Raw events exactly as played (notes, velocities, pedal, original timestamps). | No. It is immutable; it can be deleted only with its layer. | Never re-timed. |
| **Grid** | The interpretation of the take: tempo, meter, beat one, loop start and loop length. It is a per-sketch interpretation (see A5). | Yes, in Capture review → "Count it as", "Beat one", "Loop length". | Never moves notes relative to each other or to real time. |
| **Playback tempo** | A deliberate speed change for the whole sketch ("Play slower / faster"). | Yes, from the transport. | Never presented as a fix for a wrong grid. |
| **Quantise** | An explicit edit that moves selected notes toward the grid by a set strength. | Yes, in the piano roll. Each apply is one undo step. | Never automatic and never on by default. |
| **Original take** | Playback of the raw take with no loop and no edits. | Toggle in review and the layer menu. | Never lost. |

Copy rule: every grid correction shows the line **"Your timing is unchanged — only the grid moves."** Changes to playback tempo show **"Everything plays faster/slower."**

---
## 2. Information architecture and navigation
These are the proposed screens; see `wireframes/15-nav-map.svg`.

- **Play** is home. It contains:
  - the readiness strip (sound, input, audio);
  - the take ribbon, a live scrolling view of recent playing with a buffer meter;
  - the layer strip (4 slots, one marked Target);
  - the transport (Play/Stop, Undo);
  - the **Capture** button;
  - optional on-screen keys.
- **Sheets over Play** keep audio and MIDI live: Readiness, Sound browser, Capture review, Export, and the Sketch menu (save, versions, settings).
- **Full-screen:** the Piano roll for one layer, entered with "Edit" on a layer. Back returns to Play and keeps the loop playing.
- **Layers overview:** on compact width it is a toggle between the Play and Layers views. On medium and wider screens it is a permanent pane.
- **Maximum depth is 2.** For example: Play → Layers → Piano roll, or Play → Sketch menu → Controller learn.
- **Rule:** no navigation stops audio, cancels a running capture review, or clears selection. Leaving the piano roll keeps the selection for when you return.

Visual hierarchy, highest to lowest:
1. Capture, the largest and highest-contrast element, at bottom-centre.
2. Take ribbon: what you just played.
3. Layer strip: where it will go.
4. Transport.
5. Readiness: compact, and loud only when broken.
6. Secondary actions: sound and menu.

---
## 3. Screens
Each screen has a wireframe in `wireframes/`, and numbered annotations are listed in the SVG. Sizes are in dp, on an 8dp grid.

### 3.1 Play / Capture (phone portrait) — `00-play-portrait.svg`
This is the most important screen.

| Region | Size (dp) | Content and behaviour |
|---|---|---|
| Top bar | 56 | Sketch menu chip (library, rename, save state, export), **grid chip** "92 · 4/4 · grid inferred" (tap → re-open grid review; never changes playback speed), Undo (always visible), overflow. |
| Readiness strip | 40 visible / 48 hit | Three chips, icon + text: **Input** ("Keystation 61 · receiving" only after a real message; filled dot = live, ring = connected-silent, ✕ = none), **Sound** ("Sound on" / "Tap to start sound" / "Interrupted – tap to resume"), **History** ("1:58 kept"; shows "gap" after an overload drop). Tap → Readiness sheet. |
| Sound pill | 56 | "Layer 2 · Warm EP" (placeholder sound name) with ◀ ▶ (48×56) to step sounds while playing; centre opens the Sound browser sheet. Targets the Target layer. |
| Take ribbon | 236 | Live pitch/time strip of the last ~30 s, newest at right ("now" line). Dashed **likely-phrase bracket** previews what Capture will take. Horizontal drag scrolls the view only; it never edits. |
| Layer strip | 56 (4 × ~82 wide) | Each slot: number, sound/state text ("1 Bass ▶", "3 empty"). **Target** = ◎ + "next" + thick outline. Tap = retarget; long-press = layer actions. |
| Transport row | 56 | Play/Stop, Click (metronome, opt-in, default off), Layers view toggle. Capture never needs Play first. |
| Capture | 112 tall, full width (344) | "Capture" (26–32 sp) + sublabel ("last phrase → Layer 2" / "what you just played" / "Nothing to capture yet") + optional mapping hint ("optional mapping: CC 67"). Haptic tick + 600 ms fill on press. Bottom-centre, never in a scroll view. |
| Touch keys drawer | 56 closed; 160–200 open | Header **"Touch keys (on screen)"**, octave ◀▶, "Swipe: Play / Scroll", Sustain latch, 3 velocity zones by vertical touch position. Never listed as a MIDI input. |

Before Capture, pressing an empty layer slot does nothing destructive; it only sets the target.

**Capture press behaviour, by state (lead decisions A2, A4, A6 applied):**

| Sketch state | What Capture does | Playback after |
|---|---|---|
| Empty sketch, stopped (first capture) | Infer tempo, beat one and length from the likely phrase (meter 4/4 initially, A4). Create the first part and set the sketch tempo/meter. | Loops immediately from loop start (adopted default; persistent "Stay silent" option). Non-blocking review opens. |
| Layers playing (tempo exists) | Select **bounded history already played** on the existing transport: the last N bars ending at the most recent bar line that has **already passed**. Never waits for, or selects, future input or a bar line not yet reached. Notes still held (no note-off yet) are cut at the selection end with **synthetic releases for playback only**, stored separately; the raw take is unchanged. Tempo is locked (A2). | **Queued join:** the new layer starts at the next loop boundary. Review offers bar shift / length only. |
| Tempo exists, stopped | Tempo stays locked (A2). Only phase (beat one) and selection correction are offered. A deliberate playback-tempo change is a separate control. | Plays all layers from loop start. |
| History empty | No-op. Inline text "Nothing to capture yet — play something" plus an announcement. | — |
| No steady pulse (A4) | Still captures. Review shows "No steady pulse found": keep as a free-time loop of the whole phrase, or set BPM manually. ½ / ×2 apply once a tempo exists. | Loops the whole phrase. |
| One or zero sensible candidates (A4) | Show the inferred tempo (if any) plus explicit **½ / ×2 / Set BPM…** controls. Extra alternatives appear only when inference justifies them. Never fabricate three candidates or show confidence percentages. | Loops the inferred result. |
| History gap (overload) | Capture may be partial. The review and ribbon flag "Some notes dropped at 0:41"; the take records the gap. | As above, with the gap marked. |
| All slots full (A6) | Explicit choice: New layer (when supported) / Replace layer… (choose, undoable) / Keep as take only / Cancel. Never a silent replace or merge. | Per choice. |

### 3.2 Phone landscape — `01-play-landscape.svg`
The height is compact (< 480dp), so:
- The ribbon takes the full left width.
- Capture becomes a 192×236 right-hand rail; the thumb rests there.
- The layer strip becomes a 4-chip row under the ribbon.
- The transport sits on the left edge, with every target ≥ 56 at the edge.
- Sheets take at most 60 % of the height and dock to the right half.

### 3.3 Fold folded (narrow ≈ 320–360dp wide) — `02-fold-narrow.svg`
- Below 360dp the layer strip collapses to a single **"Target: Layer 2 ▾"** chip, which opens a 4-row picker.
- The ribbon keeps 236 tall (shrinks first if height is short) and Capture stays 112.
- The readiness strip is a single chip.
- These are assumptions to verify on a real device (no Fold dp measurements were sourced).

### 3.4 Fold open (≈ 700–840dp, medium) — `03-fold-open.svg`
- Two panes: Play (ribbon, transport, Capture) on the left and the Layers overview on the right.
- Capture review opens in the left pane. The piano roll opens in the right pane with the Play pane kept, so you can capture and edit side by side.
- Neither pane draws content across the hinge region (≥ 24dp keep-out), per [S26].
- **Tabletop** (half-opened, horizontal hinge), `04-fold-tabletop.svg`: the upper half shows the ribbon and layers (view only); the lower half has Capture, transport and keys. P1.

### 3.5 Desktop browser (≥ 1200 px) — `05-desktop.svg`
- Three regions: Layers (left, 280), Play/Edit (centre) and Inspector (right, 320: review, quantise, sound).
- The full keyboard shortcut set applies (gestures.md §5).
- Hover tooltips show shortcuts. Every hover-only element has a visible alternative.

### 3.6 First run and readiness — `06-first-run.svg`, `07-readiness-errors.svg`
**First run** is a single screen with three cards and one primary button.

1. **Sound.**
   - Native: Ready.
   - Web: one explicit **"Start (sound, then MIDI)"** gesture resumes the AudioContext [S28] and then requests MIDI access [S29, S31].
2. **MIDI keyboard.**
   - Web: shows the result of the MIDI request live. The browser's own permission prompt varies by browser and state, so it may add a step.
   - Native: lists detected devices.
   - The card says plainly: *"Connected doesn't mean working — play a note to confirm."* It reaches "receiving ✓" only after a real note-on or CC arrives.
3. **On-screen keys.** Optional. It reads "Play with on-screen keys (this device)" and explains that they are not a MIDI device.
4. Primary button: **"Start playing"**. It is enabled as soon as sound is ready, even with no MIDI.

On the web the count is **one Blocks gesture plus whatever prompt the browser shows**; it is not a fixed two touches.

**Readiness error states.** Each shows a text title, a one-line cause, one primary fix and, where needed, manual steps.

| State | Detection (state requirement) | Copy (title — fix) |
|---|---|---|
| Web MIDI unsupported | `navigator.requestMIDIAccess` absent, or NotSupportedError [S30, S31] | "This browser can't use MIDI keyboards" — "Use a browser that supports Web MIDI (caniuse lists desktop Chrome/Edge/Firefox and Chrome for Android [S30]), or play on-screen keys." Other browsers are not recommended until we have checked them. |
| MIDI blocked | NotAllowedError, or permission denied [S31] | "MIDI is blocked for this site" — numbered steps to re-allow it in site settings, then **Try again**. |
| Not secure context | `isSecureContext === false` [S31] | "MIDI needs a secure (https) page" — a link to the https version. |
| Sound paused | AudioContext state is `suspended` or `interrupted` [S35] | "Sound is paused" — **Tap to resume**. Capture continues while audio is suspended **only if MIDI delivery continues** (A1). |
| Audio output error / closed | state `closed`, or a native engine error | "Sound stopped working" — **Restart sound**. In-memory history is kept. |
| No keyboard | access granted, zero inputs | "No MIDI keyboard found" — "Plug in or pair one, or use on-screen keys". It updates live on statechange [S32] / DeviceCallback [S27]. |
| Connected, silent | port present, no message in 10 s after the prompt | "Connected, but no notes yet" — "Check the MIDI channel/cable, or press a key." |
| Disconnected mid-session | port removed | A banner reads "Keystation disconnected — held notes released. Your playing is kept." It auto-clears on reconnect. |

### 3.7 Capture review / corrections — `08-capture-review.svg`
The review is a **non-blocking bottom sheet** (adopted): the loop keeps playing and the keys keep sounding, so you correct by ear. Phone height is ≤ 60 %. Sections, top to bottom:

1. **Header:** "Captured → Layer 1" (first capture), a summary ("8 bars · 92 BPM · 4/4 · looping"), and **Discard** (secondary).
2. **Mini timeline:**
   - the take, with notes outside the loop drawn as dashed ghosts;
   - loop brace handles, 48dp hit areas;
   - a beat-one marker ◆ with a "1" label.
   - Dragging the loop edges changes the start and length, snapping to bars. Dragging ◆ sets beat one.
   - The caption under it reads "Your timing is unchanged — only the grid moves."
3. **Loop length:** chips ½ · 4 · **8 ✓** · 16 · ×2. The selected chip has ✓ and a thick outline.
4. **Beat one:**
   - ◀ beat / beat ▶ steppers;
   - "Tap a note to set '1'": tapping any ghost or real note makes its start the downbeat.
5. **Count it as** (first capture only; later captures show "Tempo locked to sketch (92)"): the inferred tempo **92 ✓** plus explicit **×2 (184)**, **½ (46)** and **Set BPM…**, which are always shown even with one or zero sensible candidates. Extra alternatives appear only when inference justifies them; no confidence percentages. Meter is 4/4 initially; manual meter change comes later unless the engine supports more. Choosing one re-maps bar lines only. "No steady pulse" is a designed state (`16-capture-edge-states.svg`, panel A).
6. **Hear:** **Loop ✓** / Original take. Original take plays the raw performance once, unlooped.
7. **Fine shift ±:**
   - nudges the grid by 1/16 or by 10 ms;
   - labelled "moves the grid, not your notes";
   - P1 adds "Tap the beat" (tap 4 times to set tempo and phase).
8. **Keep ✓** (primary). Dismissing the sheet, playing new notes for more than 2 bars, or pressing Capture again also **keeps** it. Discard is explicit and undoable ("Discarded take · Undo", 8 s snackbar; it stays in history afterwards).

The review is reopenable any time from the layer menu → "Re-review grid" (first layer) or "Loop & timing" (later layers).

### 3.8 Auto-play after Capture — evaluation

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Loop immediately** (Ableton-style [S1], Push [S5], Note [S6]) | Instant feedback. The ear judges inference faster than reading numbers. Keeps flow; 0 extra touches. | Can blare a wrong loop. Can surprise someone in a quiet room. On the web it needs a running AudioContext. | **Adopted default (lead)** |
| B. Stay silent, show review | Calm; no surprise. | Needs a Play touch; the user judges by eye; breaks flow. | Setting option |
| C. Play once, then stop | Confirms the take without committing to looping. | The loop point, which is what's being judged, is never heard; needs a re-trigger. | Rejected |
| D. Count-in, then loop | Lets the player get ready to overdub. | Adds latency to feedback; tempo may be wrong, so the count-in is wrong too. | P1 option "count-in 1 bar" for capture-while-stopped with a grid |
| E. Quiet preview loop (−12 dB) | Less blaring. | Misleading level; still needs a volume change later. | Rejected |

**Default A (adopted by the lead), reversible in 3 ways:**
1. The Stop (transport) and Discard buttons are visible in the review.
2. Undo reverts the capture as one step.
3. A persistent setting "After Capture: **Loop** / Stay silent", offered once in the review footer after the first discard ("Prefer silence after Capture?").

On the web, if audio is suspended at capture time, the sheet shows "**Tap to hear**". The capture is still made.

### 3.9 Sound browser — `09-sound-browser.svg`
- A sheet with search at the top and category chips (Keys, Bass, Pads, Leads, Drums, Favourites).
- Rows are 60 tall and show name, category and a 48dp ★ favourite.
- Tapping a row **auditions and selects it immediately** for the Target layer, so you can play your keyboard while browsing.
- "Back to <previous>" sits at the top.
- Changing the sound of a layer with notes is undoable.
- Next/Previous sound are learnable controller actions.

### 3.10 Four-layer overview — `10-layers.svg`
- **Milestone, not a maximum (A11):** at least four independent parts is a milestone. The **first slice ships one part**; the four-layer overview follows. Nothing in the UI hard-codes 4 as a limit.
- Rows are proposed at 142dp on phone, 112 in the Fold-open pane and 84 on desktop.
- Each row shows the number, the sound (placeholder names), a note thumbnail across the loop, its state in text, and **M** (mute), **S** (solo), **Edit**, **Sound**, ⋯.
- The ⋯ menu has: Original take, Loop & timing, Duplicate to empty layer, Clear (undoable), Export this layer.
- A muted row is dashed and labelled "MUTED". An empty row says "Empty — next Capture goes here" when it is the target.
- All layers share the sketch tempo/meter and, initially, a common loop (A5). Per-layer loop lengths come later and must never silently retime notes.
- Capture defaults to an empty or new layer. When every slot is full, the user chooses explicitly (A6).

### 3.11 Touch piano roll — `11-piano-roll.svg`, `12-piano-roll-states.svg`
**Staging:** full touch selection (Range, chord and pitch select, velocity-lane drag) is a **required later milestone** even where it is labelled P1; it is not optional polish. Note and event IDs stay stable across edits and re-inference (A12), so selections survive.

**Layout** (phone portrait):
- Top bar: Back, layer name, Undo, Redo, Hear edits ♪ toggle (on by default).
- Tool chips: **Edit** (default), **Draw**, **Range**. The active tool shows a pressed chip, a subtitle ("Edit: tap to select, drag to move"), and a faint grid hint.
- Overview strip (32): the whole loop, with a viewport window you can drag to pan.
- Time ruler (32), with loop brace handles.
- Key ruler on the left (48 wide). Tapping a key selects every note of that pitch in view and auditions it. Double-tap a note selects its chord (same start ±1/32).
- The note grid, with default lane height 32 and a zoom range of 16–64 per lane. Editing is disabled below 24, where a tap zooms to 32 first.
- Velocity lane (64, collapsible): stems with numbers when selected.
- Action bar (56), contextual to the selection: **Delete · Duplicate · Len − · Len + · Vel 84 ± · Quantise… · Chord · ⋯ (nudge, select all, invert, transpose ±1/±12)**.

**Tool behaviours:** the full table is in `gestures.md`. Summary:
- **Edit:**
  - tap a note to select it, tap empty space to deselect;
  - drag a note's body to move it (snaps with offset preserved);
  - drag a handle to resize;
  - drag on empty space to marquee-select;
  - long-press a note to add it to or remove it from the selection.
- **Draw:**
  - tap empty space to add a note (length = last used, default ⅛), or drag to set the length;
  - tapping a note selects it; Draw never deletes.
- **Range:** drag across time to select a span → Duplicate range, Delete range, Loop to range.
- **Two fingers always navigate**, in every tool: pinch to zoom, drag to pan. A second finger that lands during a one-finger edit **cancels and reverts** that edit.

**Precision aids:**
- Hit-testing expands each note to at least 48 tall and long. It picks the nearest note centre within 24. If two candidates are within 8 of each other, a **picker** appears listing pitch and position.
- Resize handles are 24 visible and 48 hit. They sit outside short notes as tabs, so short notes are still movable.
- **Loupe:** ×2.5, 120×80, shown 96 above the finger and flipped below near the top edge. Its readout reads "G3 · 1.1.1 · ⅛".
- Edge auto-scroll: a 32 zone, speed proportional to depth.
- Drag slop 8; long-press 500 ms.

**Selections:**
- marquee;
- key-ruler pitch select;
- **Chord**: select every note whose start overlaps the selected note's start (±1/32);
- Range;
- Select all (in ⋯).
- Selection is shown by a thick outline, handles and a count badge ("3 selected"). Colour is not required to read it.

**Velocity:**
- the stepper "Vel 84" with −/+ steps of ±1, or ±10 with long-press repeat;
- dragging the lane stems (P1);
- multi-select changes velocity relatively, and shows "+6" or "mixed" as text.

**Quantise panel:**
- grid value (¼, ⅛, ⅛T, 1/16, 1/16T);
- **strength** 25 / 50 / 75 / 100 chips plus a slider (default 50);
- "Starts only" / "Starts & ends";
- live preview with ghosts of the original positions;
- Apply / Cancel.
- It applies to the selection, or to all notes if nothing is selected (and says which).
- Swing is P1. Keeping the original take keeps this fully reversible.

**Loop handles:** drag the brace ends on the time ruler (48 hit), or use the steppers in ⋯ → "Loop start/length".

**Audition:**
- Hear edits ♪ plays a note on select, move (on pitch change) and add, with a 150 ms cap.
- During transport playback, selected notes are not re-triggered.

**Undo/Redo:**
- always visible;
- each gesture is one step, with labels ("Undo move 3 notes");
- history is shared with Play (one stack per sketch, A10).

### 3.12 Controller learn — `13-controller-learn.svg`
- Opened from the Sketch menu → Controls.
- **No spare pedal is required.** Capture can be mapped to any spare CC, button or pad, or simply tapped on screen.
- **No takeover by default:** sustain (CC 64) and playable keys are never mapped by default. An **optional command zone** (for example a key range the user gives up) exists only when the user explicitly enables it.
- Actions: Capture, Keep, Discard, Play/Stop, Undo/Redo, Next/Prev sound, Target / new layer.
- Tap an action, then move a button, pad, knob or pedal. A **Listening** panel shows the live incoming messages and the proposed mapping ("CC 67 on ch 1 → Capture"). Proposed 10 s timeout.
- **Conflict warnings:** CC 64 ("this is usually your sustain pedal; map anyway?"), a note number inside the playable range ("this key won't play a note any more"), an existing mapping ("replace Undo?").
- Mappings are per input device and can be cleared.
- **Staging:** the first gate offers Capture mapping. Play/Stop, Undo/Redo, sound stepping and target/new-layer mapping **grow alongside later gates**; they are deferred, not abandoned.

### 3.13 Save, recovery, export — `14-save-export.svg`
- **Autosave** runs on every committed edit (debounced 2 s) and on background/visibility change. The top bar shows "Saved" or "Saving…" as text.
- **Save failure:** a persistent banner, "Couldn't save — your sketch is still open. **Retry** · **Export now**". It is never auto-dismissed. Edits continue in memory.
- **Recovery** on relaunch after a crash: "We recovered unsaved changes from 14:02" with **Open recovered** / **Open last saved**. Both versions are kept until the user picks one.
- **Versions:** an automatic snapshot per capture, with names like "After capture 3".
- **Durability (A10):** session undo at first, plus durable takes, edits and version snapshots. Undo across relaunch comes later.
- **Export sheet:**
  - What: MIDI (all layers, one track per layer), MIDI (per layer), **aligned WAV stems** and a mixdown. Stems are a **required later milestone** even though they are not in the first slice.
  - Stems share one start and a common duration plus tail. The tail follows the actual preset's envelope/decay and the user's choice; there is no universal 2 s tail (A9). Rendering implementation and tests are pending.
  - Timing: **As edited** / Original take.
  - Length: the looped-performance export length is **visible and changeable** (proposed default Loop × 4).
  - Supported raw CC64, pitch bend and pressure/expression are preserved and exported (A8). Controller lanes are read-only at first. Synthetic panic/note-off events are **not** part of the musical export unless an explicit boundary-render policy says so.
  - Then Share or Save to files. Exported MIDI embeds tempo, meter and the beat-one offset as bar 1.

---
## 4. Edge states

| Edge case | UI behaviour |
|---|---|
| Capture during playback | Bounded history already played on the existing transport; never future input. Held notes get synthetic playback releases (kept apart from raw events). Queued join at the next boundary. |
| Capture while stopped | First capture: infer. Tempo exists: tempo locked; phase/selection correction only (A2). |
| Bad inference / no pulse | The ½ / ×2 / Set BPM controls are always there; extra alternatives only when justified; "No steady pulse" is a free-time loop; Original take is always available. |
| No MIDI | Offer on-screen keys. Touch events are source-tagged in the same capture pipeline (A7) and never shown as device readiness. |
| Denied permission / unsupported Web MIDI | Specific card with manual steps; no repeated prompting; touch keys stay available. |
| Audio suspended / interrupted | "Sound is paused — Tap to resume". Capture continues **only if MIDI delivery continues** (A1). |
| Hidden tab / app backgrounded | **No guaranteed delivery.** The initial native policy is foreground-only. In-memory history is retained through interruptions. On return, gaps are flagged ("Listening paused while hidden"). |
| Device disconnected | Banner. Held notes are stopped with **synthetic releases stored separately from raw events**. History is kept. |
| Ordinary age eviction | History is proposed at 120 s rolling plus a hard event/byte cap (integrator tunes it from the measured footprint). Older playing leaves normally; this is not an error. |
| Overload / dense input | A **different state** from eviction: drops and gaps are flagged in the ribbon, the review and the take. The UI never promises that every dense event is kept or that Capture cannot fail. |
| Relaunch after crash with uncaptured history | Recovery of uncaptured history is pending a separate implementation; the UI makes no promise yet. |
| All slots full | Explicit choice (A6); never a silent replace or merge. |
| Save failure / storage full | Persistent banner, Retry / Export now; edits kept in memory; MIDI-only fallback when there is no space for stems. |
| Fold / unfold / rotate mid-task | Audio, review and selection kept; the in-progress gesture is cancelled and reverted. |

## 5. End-to-end walkthrough (interaction counts are ESTIMATES)
Haris on an Android phone with a USB keyboard, then the same flow on Chrome.

| # | Step | Touches (native) | Web extra | Notes |
|---|---|---|---|---|
| 1 | Open app (first run: "Start playing") | 1 | +1 enable gesture, plus any browser prompt (varies) | Later launches: 0 beyond opening |
| 2 | Play freely for 1–2 min | 0 | | Ribbon shows the phrase bracket |
| 3 | Capture | 1 (0 with optional CC/button mapping) | | Loops immediately |
| 4 | Hear loop, judge by ear | 0 | | |
| 5 | Fix beat one (tap a note to set '1', or ◀ beat) | 1–2 | | Only if wrong |
| 6 | Keep (implicit by playing on) | 0 | | |
| 7 | Change sound for the next layer | 2 (Sound pill, row) | | Target auto-advanced to Layer 2 |
| 8 | Play over the loop, Capture | 1 (0 with optional mapping) | | Queued join at next boundary |
| 9 | Repair a wrong note (Layers → Edit, tap note, drag, Back) | 4 | | |
| 10 | Export MIDI + stems (menu, Export, defaults, Share) | 4–5 | | |
| | **Total** | **≈ 14–16** (≈ 12–14 with optional mapping) | +1 plus browser prompt(s) | Estimate; to be measured in usability tests. The four-layer steps (7–8) apply once multi-part ships (A11). |

---
## 6. Responsive rules
1. Width class (per [S25]):
   - compact < 600: single column;
   - medium 600–840: two panes (Play + Layers or Editor);
   - expanded ≥ 840: three regions when height ≥ 600; otherwise two panes.
2. Height compact < 480: Capture moves to a right rail of at least 192 wide; sheets take ≤ 60 % of the height; the on-screen keys header collapses.
3. Width < 360: the layer strip becomes the Target chip; action bar overflow comes after 4 actions.
4. Folding feature `isSeparating` (or HALF_OPENED): no interactive element within 24dp of the hinge bounds. Horizontal hinge → tabletop split; vertical hinge → book panes split at the hinge [S26].
5. Capture is always reachable within one thumb area: bottom-centre (portrait) or right rail (landscape). It is never inside a scroll container.
6. Class changes preserve state, cancel in-progress pointer gestures, and keep the transport running.
7. Text scales with system font up to 200 %. Layouts reflow; the ribbon height shrinks before Capture does.

---
## 7. Timing state requirements (not engine design)
The UI requires the engine/adapters to expose:
- `inputEvents[]`, each with a **stable event ID** (A12), a monotonic timestamp in one per-platform base (native ns [S27]; web performance clock with an audio-clock mapping [S34]), and `source` (device id or `onscreen`, A7). **Input-event time is preserved**; there is no automatic heard-time shift without a measured delay/model (A3).
- `syntheticEvents[]` (releases at disconnect, selection boundaries and panic) **kept separate from raw events**.
- `history`: `start`, `end`, `lastEventAt`, `evictedBefore` (ordinary age eviction) and `gaps[]` (overload drops, with time spans). These are distinct states.
- `deliveryState` ∈ {foreground, suspendedAudioMidiLive, hiddenOrBackground (not guaranteed)}.
- `audioState` ∈ {starting, running, suspended, interrupted, closed, error}; `midiAccess` ∈ {unsupported, insecure, prompt, denied, granted}; `ports[]` with `receiving` flags.
- `inference` = {tempo?, beatOneTime?, loopStart, loopLength, pulse: found | none, alternatives[] (only when justified; no confidence %)}.
- `sketchTempo` (locked once set, A2); `transportPosition`; `layerJoinAt` (the queued boundary).
The UI never infers tempo itself, and never shows "receiving" from a port's existence alone.

## 8. Contract decisions — RESOLVED (lead decision, 8 Nov 2026)
| ID | Status | Lead decision (verbatim intent) | Where applied |
|---|---|---|---|
| A1 | **RESOLVED (lead decision)** | The initial proposed target is 120 s of rolling history plus a hard event/byte cap; the integrator may tune it from the measured footprint. Ordinary age eviction and overload are different states. Never promise that Capture cannot fail or that every dense event is retained; flag gaps/drops in the UI. Synthetic releases are kept separate from raw events. Capture can continue while audio is suspended IF MIDI delivery continues. Hidden/background has no guaranteed delivery; the initial native policy is foreground-only. In-memory history is retained through interruptions. Recovery of uncaptured history after restart is pending a separate implementation. | §3.1, §3.6, §4, §7; wireframes 00, 07, 16 |
| A2 | **RESOLVED (lead decision)** | The existing sketch tempo stays locked whether stopped or playing; only phase/selection correction is offered. A deliberate playback-tempo change is separate. | §3.1, §3.7 |
| A3 | **RESOLVED (lead decision)** | Preserve input-event time. No automatic heard-time compensation without a measured delay/model, and no unmeasured latency shift. | §7; research.md |
| A4 | **RESOLVED (lead decision)** | Alternatives only when justified; never fabricate 3 candidates or confidence percentages. Always offer explicit half/double/manual controls, even with one or zero sensible candidates. "No pulse" is a valid result with its own designed state. 4/4 initial inference; manual meter change later unless the engine supports more. | §3.1, §3.7; wireframes 08, 16 |
| A5 | **RESOLVED (lead decision)** | Shared sketch tempo/meter and a common loop initially. Per-layer loop lengths later, without silently retiming notes. | §3.10 |
| A6 | **RESOLVED (lead decision)** | Capture into an empty/new layer by default; no silent destructive replacement or merge. When all slots are full, the user makes an explicit choice (or a new layer is created, when supported). | §3.1, §3.10; wireframe 16 |
| A7 | **RESOLVED (lead decision)** | Yes: source-tagged touch events go into the same capture pipeline, and never counterfeit device readiness. | §3.1, §4, §7 |
| A8 | **RESOLVED (lead decision)** | Preserve and export supported raw CC64, pitch bend and pressure/expression. Controller lanes are read-only at first. Don't promise unimplemented renderer support. Synthetic panic/note-offs are not part of the musical export unless there is an explicit boundary-render policy. | §3.13; wireframe 14 |
| A9 | **RESOLVED (lead decision)** | Stems share a start and a common duration plus tail. The tail follows the actual preset's envelope/decay and the user's choice; 2 s is not a universal guarantee. The looped-performance default export length is visible and configurable. Rendering implementation and tests are pending. | §3.13; wireframe 14 |
| A10 | **RESOLVED (lead decision)** | Session undo initially, plus durable takes/edits/version snapshots. Undo across relaunch later. | §3.13 |
| A11 | **RESOLVED (lead decision)** | At least four independent parts is a milestone, not a hard maximum. The first slice is one part; the four-layer overview comes after. | §3.10, §5 |
| A12 | **RESOLVED (lead decision)** | Yes: stable event/note IDs across derived edits and re-inference. | §7; gestures (selection persists) |

**Also adopted:** immediate loop-after-Capture with a persistent silent option; a non-blocking review plus undo; original take, grid, playback tempo and quantise kept separate; queued layer join at the next loop boundary.

**Other lead corrections applied:**
- No spare pedal is required; Capture can be mapped to a CC/button.
- No takeover of sustain or playing keys by default; an optional command zone only when explicitly enabled.
- Remaining controller actions grow with later gates rather than being abandoned.
- Stems and full touch selection are required later milestones.
- Capture while playing selects only history already played.
- The unsourced electric-piano sound name was replaced with the placeholder "Warm EP".
- The first-run touch count is no longer fixed.
- The unchecked browser recommendation was removed.
- All numbers are proposals pending measurement.
