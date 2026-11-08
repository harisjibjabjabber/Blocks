# Blocks — UI/UX & Interaction Design package (PROPOSED)
Status: **PROPOSED rev 3.2.1 — not implemented, not user-tested.** 8 Nov 2026. Design docs and prototypes only; no app code. Lead decisions A1–A12 are RESOLVED and applied (`CHANGELOG.md`). All numeric limits, timings and UI dimensions are proposals pending measurement; rev 3.2 gesture values are provisional until device testing. Read `LIMITATIONS.md` first.

Rev 3.2.1 wins over the earlier hybrid files where both exist. `CHANGELOG.md` says this revision changed no PNG, HTML frame, or prototype. That sentence is wrong: frame 14, the range overviews, `hifi/src/rangeview.py`, and `hifi/prototype/index.html` did change. The correction is in `../handover/import-record.md`. These pictures are still proposed mock data, not the live site, and not approval to implement the UI. The product handover is `../handover/README.md`.

This folder is self-contained: every document, image, generator, font and check needed to read, rebuild and verify the design is inside it. The review Page that accompanied it is archived in `page/` (its content is duplicated in these files).

## File index
| Path | Contents |
|---|---|
| `README.md` | This file: index, rebuild steps, check evidence |
| `LIMITATIONS.md` | Dated limitations (8 Nov 2026) |
| `CHANGELOG.md` | Revision history, rev 2 → 3.2.1 |
| `spec.md` | Full spec. §0a hi-fi directions and hybrid precedence; §0b rev 3.2 take history + capture range, harmony labels, Settings, open questions (§0b.9); §0 visual north star; vocabulary, IA, every screen, edge states, walkthrough (estimates), responsive rules, timing state requirements, resolved contract decisions A1–A12 |
| `research.md` | Sourced findings → mechanism → decision; hypotheses marked |
| `sources.md`, `sources.tsv`, `link-check.tsv` | Sources S1–S36, how each was opened, HTTP re-check (8 Nov 2026) |
| `gestures.md` | Ownership rules, gesture tables (§9 = take history / range), equivalents, sizes |
| `state-machines.md` | Mermaid: readiness, capture, transport, piano-roll pointer, save/recovery, take-history follow/range, capture range, appearance |
| `acceptance-criteria.md` | P0/P1 criteria plus rev 3.2 AC-RNG-01–11, AC-HAR-01, AC-SET-01–03 |
| `components.md` | Component inventory |
| `qa-review.md`, `usability-test-script.md` | QA review points (18 = repeating pickup, 19 = provisional numbers); moderated test script (R4 = pickup audition) |
| `tokens.json` | Design tokens: sizes, colours, type, roles, hi-fi palettes, hybrid, rev 3.2 range/label/settings tokens (numbers provisional) |
| `wireframes/00…16-*.svg` | 17 low-fi wireframes (PROPOSED, annotated) |
| `wireframes/src/gen_wire.py`, `wireframes/src/wire.json` | Wireframe generator and the screen data it emits (also used by the Page) |
| `hifi/README.md` | Hi-fi pass: directions, hybrid, storyboard, range frames, rationale |
| `hifi/directions/` | Direction boards A (Graphite Studio) and B (Paper Score), A-vs-B recommendation; `.html` sources + `.png` |
| `hifi/storyboard/` | Rev 3 storyboard in direction A: `01…07-*.png`, Fold/desktop frames, overview; `src/*.html` |
| `hifi/hybrid/{dark,light}/` | **Adopted hybrid (takes precedence).** `01…07` storyboard, `08-settings-appearance`, `09…16` take-history/range frames (incl. `13a`, `13b`), `fold-05`, `desktop-07`, `fold-11`, `desktop-11`, `storyboard-overview.png`, `range-overview.png`. Captioned boards are `*.png`; bare 2x screens are `src/*@2x.png`; editable HTML is `src/*.html` |
| `hifi/hybrid/hybrid-dark-vs-light.png` | Dark vs light comparison board |
| `hifi/prototype/index.html`, `prototype-preview.png` | Self-contained clickable prototype (simulation; fonts embedded) |
| `hifi/contrast.tsv`, `hifi/contrast-rev32.tsv` | Computed WCAG contrast for all palettes / rev 3.2 pairings |
| `hifi/fonts/` | Inter Tight, Geist Mono, Instrument Serif (regular + italic), Instrument Sans, IBM Plex Mono; each folder has its `OFL.txt` (SIL Open Font License 1.1) |
| `hifi/src/` | Generators: `kit.py` (themes, CSS, helpers), `music.py` (example data), `phoneA.py`/`phoneB.py` (phone frames), `frames.py` (storyboard frames), `large.py` (Fold/desktop), `rangeview.py` (rev 3.2 frames 08–16), `build.py` (directions, storyboard, prototype, `contrast.tsv`), `hybrid.py` (hybrid frames, overviews, final prototype), `render.py` (headless Chrome screenshot), `contrast.py`, `contrast_rev32.py`; `test.py`, `testB.py`, `testR.py` are dev helpers that render single frames to `/tmp` |
| `checks/run_checks.sh`, `checks/prototype-test.js`, `checks/check-log.txt` | Re-runnable checks and the dated log of the last run |
| `page/blocks-design.canvas.tsx`, `page/README.md` | Archived source of the review Page; section → file map and Page-only text |

## Rebuild
Tested with: **Python 3.13.5**, **fontTools 4.65.0**, **Google Chrome 156.0.8078.47** (headless), **Node 24** (checks only), Linux. Pillow is not required by the generators.

```bash
cd blocks-design
python3 -m venv .venv && . .venv/bin/activate
pip install "fonttools==4.65.0"
# Fonts: the PNG renders need them installed system-wide (the frame HTML names them but does not embed them).
mkdir -p ~/.local/share/fonts/blocks && cp -r hifi/fonts/* ~/.local/share/fonts/blocks/ && fc-cache -f
# Chrome must be on PATH as `google-chrome` (hifi/src/render.py calls it). The exact screenshot command is:
#   google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
#     --window-size=W,H --screenshot=OUT.png --virtual-time-budget=2000 file:///ABS/PATH/frame.html

# 1) Low-fi wireframes (optional; output is byte-identical to the committed SVGs)
python3 wireframes/src/gen_wire.py

# 2) Hi-fi, in this order (run from hifi/src):
cd hifi/src
python3 build.py      # directions/, storyboard/, contrast.tsv, and a direction-A prototype (overwritten by step 3)
python3 hybrid.py     # hybrid/{dark,light}/ 01–16 + Fold/desktop + overviews + dark-vs-light board; final prototype/index.html.
                      # rangeview.py is imported by hybrid.py (frames 08–16); it is not run on its own.
python3 contrast_rev32.py   # contrast-rev32.tsv
# Partial rebuild of named frames only, e.g.:  python3 hybrid.py 14-range   (frame boards only, no overviews/prototype)
```
`build.py` embeds font subsets into the prototype from `hifi/fonts/` (falls back to `/usr/share/fonts/truetype/sand-box/google/`, the original build box). A full hi-fi rebuild takes about a minute and rewrites every PNG and HTML under `hifi/`.

## Open the prototype
Open `hifi/prototype/index.html` directly in a desktop browser (double-click or `google-chrome hifi/prototype/index.html`); no server or network is needed. Use ← → or the step list; click the dashed hotspots (Capture, Undo, Done, Blocks ⌄ → Settings, Back to live, Boundaries/Slide, appearance options); drag the ⟦ ⟧ handles on 09–12 and 15 (Shift = no snap; arrow keys when a handle is focused, Alt = beat, Shift = bar); switch Dark/Light and Phone/Fold/Desktop where offered. It is a **simulation, not working MIDI/audio**.

## Check evidence
Run `bash checks/run_checks.sh` from the package root; it rewrites `checks/check-log.txt`.

| Check | Evidence | Date |
|---|---|---|
| WCAG contrast, all palettes (A, B, hybrid C/D) | `hifi/contrast.tsv` (0 FAIL; ≥ 4.5 text, ≥ 3 non-text) | 8 Nov 2026 |
| WCAG contrast, rev 3.2 text pairings | `hifi/contrast-rev32.tsv` (all ≥ 4.5), reproducible with `hifi/src/contrast_rev32.py` | 8 Nov 2026 |
| Sources opened and HTTP re-checked | `sources.md`, `sources.tsv`, `link-check.tsv` (36 sources, all 200) | 8 Nov 2026 |
| 17 SVG wireframes parse (xml.etree) | `checks/check-log.txt` §1 | 8 Nov 2026 19:49 GMT, re-run at rev 3.2.1 |
| `tokens.json` parses | `checks/check-log.txt` §2 | 8 Nov 2026, rev 3.2.1 |
| Copy hygiene: no "Rhodes", no unqualified "Samsung Internet" | `checks/check-log.txt` §4 | 8 Nov 2026, rev 3.2.1 |
| Prototype script syntax (`node --check`) | `checks/check-log.txt` §5 | 8 Nov 2026, rev 3.2.1 |
| Prototype interactions in headless Chrome (handle drag 1 → 4 bars, keyboard nudge, menu → Settings, theme switch, Boundaries → Slide, Fold/desktop views) | `checks/check-log.txt` §6, `checks/prototype-test.js` | 8 Nov 2026, rev 3.2.1 |
| Package fonts load in the generator | `checks/check-log.txt` §7 | 8 Nov 2026, rev 3.2.1 |
| Packaged wireframe generator reproduces all 17 SVGs byte-for-byte; generator reproduces all 42 hybrid `src/*.html` exactly | run manually at rev 3.2.1 (see `CHANGELOG.md` rev 3.2.1) | 8 Nov 2026 |
| Visual inspection of every render at full size (layout, clipping, overlap) | manual, during rev 3–3.2; no visual changes in 3.2.1 | 8 Nov 2026 |
