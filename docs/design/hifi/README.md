# Blocks — high-fidelity pass (rev 3) — PROPOSED, not implemented

Every frame shows design/example data (chords, notes, BPM, device names). The prototype is a **simulation, not working MIDI/audio**. Interaction counts are estimates, not test results.

## Adopted: the hybrid (rev 3.1, takes precedence)
**Precedence (rev 3.1, Haris via lead): the hybrid.** Graphite Studio's main UI is the structural base, and it takes precedence. Its information architecture, its explicit separate instrument/layer cards, its controls and the discoverability of its features all stay. From Paper Score the hybrid borrows character only: editorial serif headings (sketch title, capture-sheet headlines such as "Four bars, at ninety-two."), italic chord and sound names, and stave hairlines inside layer cards. It never replaces the structure with a score sheet and never hides instruments. The same hybrid comes in **dark** (the default for playing) and **light** (daylight, review, export). Assets are in `hifi/hybrid/{dark,light}/`, and the tokens are in `tokens.json` → `hifiDirections.hybrid`.

Key files: `hybrid/hybrid-dark-vs-light.png`, `hybrid/{dark,light}/storyboard-overview.png`, `hybrid/{dark,light}/01…07-*.png`, `fold-05-bass-captured.png`, `desktop-07-edit-quantise.png`, and editable `hybrid/{dark,light}/src/*.html`. Rebuild with `python3 src/build.py && python3 src/hybrid.py` (in that order, because hybrid.py writes the hybrid prototype).

## Original recommendation (rev 3, now an input to the hybrid)
**Direction A, Graphite Studio** (dark instrument). Haris plays in dim rooms and on stage, and four layers stay legible at arm's length (each has a hue, a glyph and a number). It feels like hardware, the accent keeps one meaning (Capture, time, next slot), and the dark stage suits OLED phones and a Fold on a stand. A borrows B's serif chord names. Keep **B, Paper Score**, for a later light theme and for the review, export and share sheet.

## Files
| Path | What |
|---|---|
| `directions/direction-A-graphite-studio.png` / `.html` | Direction A board: hero frame (bass over loop) + Capture proposal, palette, type, layer key, rationale |
| `directions/direction-B-paper-score.png` / `.html` | Direction B board (same two states) |
| `directions/A-vs-B-recommendation.png` / `.html` | Side-by-side with the recommendation |
| `directions/B-*.html`, `B-*@2x.png` | Direction B phone frames as standalone sources |
| `storyboard/01-free-play.png … 07-edit-quantise.png` | Seven captioned phone frames (2x) |
| `storyboard/fold-05-bass-captured.png` | Frame 05 on a Fold, expanded (about 840×1000 dp, proposed), two panes clear of the hinge |
| `storyboard/desktop-07-edit-quantise.png` | Frame 07 in a desktop browser (1440×900), with keyboard hints |
| `storyboard/storyboard-overview.png` / `.html` | All frames on one sheet |
| `storyboard/src/*.html`, `*@2x.png` | Editable HTML/CSS source for every frame, plus raw 2x renders |
| `prototype/index.html` | Self-contained clickable prototype of the **hybrid** with a Dark / Light toggle: embedded font subsets (OFL), hotspots (Capture, Undo, Done), ← → keys, Phone / Fold / Desktop views |
| `prototype/prototype-preview.png` | Screenshot of the prototype |
| `contrast.tsv` | WCAG contrast for every palette pair, in both directions |
| `src/*.py` | Generator: `python3 src/build.py` rebuilds everything (headless Chrome, `--force-device-scale-factor=2`) |

## Storyboard (Direction A)
1. **Play freely.** Nothing to arm. Rolling history (proposed 120 s target) and a bracket on the last phrase. 0 touches.
2. **Capture, then the loop starts at once.** Already kept. A nonblocking proposal: 92 BPM, 4 bars, 4/4, with ½ / ×2 / Set always shown, and loop length and beat-one nudges. 1 touch.
3. **No steady pulse.** A free-time loop exactly as played, with no guessed tempo and no confidence score. Tap and Set are offered, and ½ / ×2 act on whatever tempo is tapped or set (A4). 0–1 touches.
4. **Bass over the looping piano.** Change the sound for Layer 2. Tempo stays locked at 92 (A2). The bracket shows what a capture would keep. 1 touch.
5. **Capture bass, in sync.** It lands on the locked grid: phase OK, joins at the next bar 1 (queued join). Beat nudges and Undo are in the thumb zone. 1 touch (+1).
6. **Drums.** On-screen pads, whose touch events are source-tagged "screen" (A7), or a MIDI pad controller. Every layer stays visible. Pads + 1 touch.
7. **Optional edit and quantise.** 1/8 at 50%. Dashed outlines show where the notes were played and solid notes show the result. The original take is kept, and Revert is available. About 4 touches.

## Invariants kept
A1–A12 hold. The Capture icon is a reach-back glyph, not a record dot, and no step needs arm, record or stop. Sound names are placeholders (Warm EP, Bass (placeholder), Kit (placeholder)). Device-ready chips are example data, and the app shows MIDI as ready only when it is. All targets are at least 48 dp (empty slots collapse to one 48 dp row). Text meets WCAG AA (see `contrast.tsv`). Layers carry a glyph, a number and a label, not colour alone. Timing is never shifted automatically: grid alignment is shown, and the original take is preserved.

## Limitations
- None of this is implemented or user-tested. Sizes are proposals.
- The Page versions are a simplified SVG port that uses the host's system font. The PNGs and the prototype are the reference.
- The Fold size is approximate (about 840×1000 dp). Hinge-aware layout still has to be checked against FoldingFeature on a device.
- Drum pad note numbers (C1, D1…) are example labels only, not a GM-mapping decision.
- Chord names are display mock-ups. Chord detection is not specified or promised.

## Rev 3.2 additions (PROPOSED)
- `hybrid/{dark,light}/08-settings-appearance.png` — Settings → Appearance (System default / Light / Dark), reached from the Blocks ⌄ menu.
- `hybrid/{dark,light}/09…16-range-*.png` — take history as the main Play view with the capture range: 09 one-action success, 10 auto too short, 11 drag start (end fixed), 12 fixed + Undo, 13a Boundaries (length changes), 13b Slide (length kept, phase shifts), 14 pickups and held notes at loop edges, 15 free time (seconds, onset snap), 16 zoom/pan/snap with Back to live.
- `hybrid/{dark,light}/fold-11-range-drag.png`, `desktop-11-range-drag.png` — Fold and desktop variants.
- `hybrid/{dark,light}/range-overview.png` — one-board overview of 08–16.
- Editable source: `hybrid/{dark,light}/src/<name>.html`; 2× bare-screen PNGs: `src/<name>@2x.png`. Generator: `src/rangeview.py` (+ `hybrid.py`).
- Chord names and role tags are MOCK DATA; harmony recognition is a proposed capability under research.
- Contrast for rev 3.2 text pairings: `contrast-rev32.tsv` (all ≥ 4.5:1).

## Rev 3.2.1 (doc-only)
No visual changes. Fonts used by the generators are now in `fonts/` (OFL). Repeating-pickup is PROPOSED behaviour (open question OQ-1); gesture numbers are provisional; harmony labels are optional and research-gated (arpeggio/bass tags deliberately not drawn). Rebuild steps: top-level `README.md`.
