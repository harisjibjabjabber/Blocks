# page/ — archived copy of the review Page (rev 3.2.1, exported 8 Nov 2026)
`blocks-design.canvas.tsx` is the full source of the shareable review Page ("Blocks — UI/UX & Interaction Design (PROPOSED)"), exported so the archive has no Page-only dependency. It is a React/TSX module written for the Grok canvas kit (`import … from "grok/canvas"`); it does **not** build outside that host. Read it as content: every string, table and mock in it is plain text in the file.

## Where each Page section lives in the package
| Page section | Files |
|---|---|
| Status callout, changelog | `README.md`, `CHANGELOG.md`, `LIMITATIONS.md` |
| Hi-fi directions A vs B, adopted hybrid | `spec.md` §0a, `hifi/README.md`, `hifi/directions/*.png`, `hifi/hybrid/hybrid-dark-vs-light.png` |
| Storyboard (interactive) | `hifi/hybrid/{dark,light}/01…07-*.png`, `hifi/prototype/index.html` |
| Take history & capture range (interactive mock) | `spec.md` §0b, `gestures.md` §9, `state-machines.md`, `acceptance-criteria.md` (AC-RNG/HAR), `hifi/hybrid/{dark,light}/09…16-*.png`, prototype frames 09–16 |
| Settings · Appearance (interactive mock) | `spec.md` §0b.8, AC-SET-01–03, `hifi/hybrid/{dark,light}/08-settings-appearance.png`, prototype frame 08 |
| Visual north star, vocabulary, research, navigation, layouts, screens, edge states, walkthrough, state machines, equivalents, components, handoff, QA, contract decisions, sources | `spec.md`, `research.md`, `gestures.md`, `state-machines.md`, `components.md`, `acceptance-criteria.md`, `qa-review.md`, `usability-test-script.md`, `sources.md`/`sources.tsv`/`link-check.tsv`, `wireframes/*.svg` (Page wireframe data: `wireframes/src/wire.json`) |

## Text that appeared only on the Page (copied here)
**Direction A · Graphite Studio (recommended, now the hybrid's structure)**
- A dark instrument: graphite stage with a warm ember accent used only for Capture, the playhead and the next slot.
- Layers stay on screen as lanes with live mini piano rolls, each with a hue, a glyph and a number.
- The thumb zone holds the actions: a Capture capsule, Undo, the sound, and an optional Stop.
- Chord names in italic give the sketch a voice.

**Direction B · Paper Score (alternative, now the hybrid's character)**
- A light, editorial look: warm paper, ink staves numbered I–IV, and one vermilion mark.
- It reads like a lead sheet: calm and literate, good in daylight, and it prints well.
- Capture is a single ink disc with Undo and an optional Stop beside it.
- Trade-off: the page is bright at night, faint layers have lower contrast, and it feels less like an instrument.

**Original recommendation (folded into the hybrid): A, Graphite Studio.** Haris plays in dim rooms and on stage, and graphite keeps four layers legible at arm's length. It feels like hardware, the accent keeps its meaning (Capture, time, next slot), and the dark stage suits OLED phones and a Fold on a stand. From B, A keeps the serif chord names and the calmer copy. Keep B for a later light theme and for the review, export and share sheet. Both directions keep 48 dp targets, WCAG AA text (`hifi/contrast.tsv`), cues that never rely on colour alone, and the same layout logic.

**Interactive mocks.** The Page's StoryPlayer, RangeLab (draggable handles, labels and snap toggles) and SettingsMock are simplified SVG re-drawings of the PNG frames; the same behaviour is simulated in `hifi/prototype/index.html`. The Page draws text in the host's system font; the PNGs and prototype use the packaged fonts.
