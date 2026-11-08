# Design rev 3.3 cumulative overlay

Immutable staged copy window: 2026-11-08 20:08:31–20:08:32 Europe/London (GMT).
Compared by SHA256 to original 20261108-194317/MANIFEST.json, base SHA256 `a00cc68081b1299b543dc1bb24b88e83f922c956164f77ca98625a7ab3a89491`. No mtime-based inclusion. Later edits outside this bounded copy are excluded; individual copies were byte-rechecked, not an atomic filesystem snapshot.

## Precedence and scope
Apply `blocks-design/` paths over original base and rev3.2.1 delta; current rev3.3 contents take precedence on overlaps. This is cumulative against original base, so earlier changed doc/source/font/frame14 files remain included. Six OFL font binaries already archived at rev3.2.1 are intentionally repeated for cumulative completeness, byte-checked against previous local licence/provenance records. Five packaging provenance JSON records retained. No dependency chain between ZIP volumes; each is a regular independent ZIP with descriptive relative roots. Together they form an overlay, not a standalone copy of every unchanged base asset.

161 current source files differ from original base (including PNGs), plus five retained font-provenance files. Manifest maps every payload file to its ZIP, with original/current hashes and sizes. checks/rev33-changed-files.txt is specialist's historical touch-list, NOT packaging inclusion authority. Full rebuild touched earlier frames but byte-identical files are omitted. No noncache base file deletions detected.

Includes docs/spec/gestures/state/acceptance/tokens, generators (editor.py, updated hybrid/build), checks and original evidence logs, exported Canvas source/mapping, self-contained simulation prototype, new editor frames17–27, editor overviews, Fold/desktop18 for both themes, and actually changed older visual artifacts. Editable HTML/CSS/Python and source docs are separated from dark/light/other PNG previews.

## Status / limitations
EVERY rev3.3 editor design is PROPOSED, example data, not implemented or user-tested and NOT production UI approval. Parent reports inspecting dark/editor-overview and light/fold-18-editor and sharing Page/visuals with Haris; that does not establish acceptance. Main-screen Quick Quantise removal/recommendation is designer advice, not a user-confirmed decision.
Prototype fakes interaction and does not edit real MIDI or play audio. Pictured Undo is not implemented as prototype Undo; pinch/zoom is not simulated. Editor Fold/desktop variants exist only for frame18 (older key frames remain). Targets, hit zones, loupe dimensions, counts and timing are provisional. Swing may be cut for P0. Optional harmonic labels are mock/research-gated. See LIMITATIONS.md and current spec/CHANGELOG for all qualifications.

## Build and safety
No generators, browser checks, tests, new Page, repository clone/inspection/write or upload performed by packaging. checks/check-log.txt remains specialist evidence, not tests independently rerun here. Standalone frame HTML needs fonts installed; prototype embeds subsets. Builds require documented Python/fontTools/Chrome/Node environment; Chrome version can shift rendering. Exported Canvas TSX builds only in its host, not as a standalone web app. Existing source build fallback paths remain as documented.
Fonts retain full corresponding OFL.txt, copyright and previous embedded-metadata provenance; binaries match previous verified versions. No new font release/legal claims. No cache/node_modules/browser data/.env/credentials/samples/third-party unverified binaries included. Text credential-signature screening passed (not a guarantee). Paths, CRC and extracted byte hashes checked. No claims GitHub is updated; parent must inspect, commit through existing cloud project, and verify tree and precedence.
