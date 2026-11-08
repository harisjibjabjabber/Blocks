# Blocks design rev 3.2.1 bounded delta

Copy window: 2026-11-08 19:50:56–19:50:56 Europe/London (GMT).
Base: blocks-handover/20261108-194317/MANIFEST.json SHA256 a00cc68081b1299b543dc1bb24b88e83f922c956164f77ca98625a7ab3a89491.
Apply relative `blocks-design/` paths over the original snapshot. This ZIP is a delta, not a standalone full design backup. No repository writes, uploads, new Page, browser tests or generators were run.

## Completed doc/reproducibility checkpoint
Retains PROPOSED/review-gated status. Repeating pickup is proposed, first-pass-only unresolved; gesture numbers provisional; harmony tags optional/research-gated. Adds limitations, checks scripts and existing dated log, bundled OFL fonts, package-relative build root, wireframe generator/input, exported review Canvas source and mapping. Existing check log is specialist evidence, not tests rerun by packaging.

## Actual hashes versus specialist summary
46 existing/new source files differ from the base; five local font-provenance records are added by packaging. `hifi/contrast-rev32.tsv` is byte-identical to the base and therefore absent from the delta. Existing SVGs are also unchanged. No new editor PNG/HTML frames were detected or accepted.
Contrary to CHANGELOG's “No PNG, HTML frame or prototype change” statement, the following existing artifacts differ and ARE INCLUDED to avoid silently producing an inconsistent snapshot:
- `blocks-design/hifi/hybrid/dark/14-range-loop-edges.png`
- `blocks-design/hifi/hybrid/dark/range-overview.html`
- `blocks-design/hifi/hybrid/dark/range-overview.png`
- `blocks-design/hifi/hybrid/dark/src/14-range-loop-edges.board.html`
- `blocks-design/hifi/hybrid/dark/src/14-range-loop-edges.html`
- `blocks-design/hifi/hybrid/dark/src/14-range-loop-edges@2x.png`
- `blocks-design/hifi/hybrid/light/14-range-loop-edges.png`
- `blocks-design/hifi/hybrid/light/range-overview.html`
- `blocks-design/hifi/hybrid/light/range-overview.png`
- `blocks-design/hifi/hybrid/light/src/14-range-loop-edges.board.html`
- `blocks-design/hifi/hybrid/light/src/14-range-loop-edges.html`
- `blocks-design/hifi/hybrid/light/src/14-range-loop-edges@2x.png`
- `blocks-design/hifi/prototype/index.html`
- `blocks-design/hifi/src/rangeview.py`

Inspected rangeview source differences add background/padding/border-radius/z-index behind PICKUP and HELD ACROSS END labels on existing frame 14. Matching frame HTML/PNGs and range overviews differ. Prototype differs in embedded font bytes plus existing frame content. These are observed extra changes, NOT a newly approved visual revision or completed full-editor work. The original changelog is preserved unedited; parent should reconcile the no-visual-change statement before describing the checkpoint externally. No unfinished new editor frames were found in this copy window.

## Font redistribution
Six TTF binaries across Geist Mono, IBM Plex Mono, Instrument Sans, Instrument Serif (regular/italic), Inter Tight retained with full corresponding OFL.txt. Local embedded family/manufacturer/designer/licence metadata matches expected families and SIL OFL 1.1. Each family directory has HANDOVER-FONT-PROVENANCE.json with exact binary/licence hashes and name-table evidence. Bundled redistribution is supported by the local OFL text; upstream download commit/release pins are not supplied and are not invented. Keep notices, no standalone font sale, respect reserved names for future modified fonts. No font binary transformations performed.

## Safety and limitations
No credential signature matches in retained text screening. No cache, browser state, .env, samples, unrelated transcripts or third-party tools included. Deleted __pycache__ files are irrelevant because the base excluded them. No deletions are requested by this delta. All included originals copied without editing local sources. Individual file bytes re-read matched copy bytes; bounded copy is not atomic and later work is excluded.
Only packaging/path/hash verification performed; app, device, browser and rebuild success not independently verified. Prior Capture last-chord failure, raw-MIDI immutability, optional quantise and hardware limitations remain as in the base HANDOVER-SNAPSHOT.md.
