# Blocks handover snapshot

Prepared locally on 2026-11-08, copy started 19:43:17 Europe/London (GMT).
Snapshot preparation completed: 2026-11-08 19:44:12 Europe/London (GMT).
Preparation only: no repository clone, repository writes, uploads or Page creation were performed. This is NOT a claim of a GitHub backup. Parent must attach packages to the existing cloud project, inspect, commit and verify the resulting tree.

## Current known state (conversation record, not a fresh deployment check)
- Repository: https://github.com/harisjibjabjabber/Blocks
- Live browser app: https://harisjibjabjabber.github.io/Blocks/
- Basic retrospective Capture and simultaneous layers are reported implemented. The last-chord-only Capture failure persists in Haris's real playing after `fdba348`, despite synthetic passing tests. This is an open release-blocking workflow failure, not a cache assumption. No fix is claimed here.
- Graphite Studio structure, separate instruments/layer cards and controls + Paper Score typography/character, in light and dark modes, is PROPOSED and review-gated. Local docs now say rev 3.2 and include settings plus range/piano-roll selection previews. Mockups and clickable prototype simulate example data; no working MIDI/audio or validated chord recognition is implied.
- Preserve immutable raw MIDI. Tempo/loop inference must fit human timing, pickups, drift and note tails; never force quantise. Quantise is optional, derived and undoable.
- Phrase selection must handle chords, melodies, basslines and mixed playing. A tempo-aligned four-bar candidate is a hypothesis, not proof of Ableton internals or a mandatory crop. Chord analysis, including ambiguous/rootless jazz interpretations, stays secondary and editable.
- Real hardware, Fold/hinge layouts and end-to-end performance remain unverified. Automated/synthetic evidence is not musician or device validation.

## Start here / evidence boundaries
- `blocks-design/README.md`, `CHANGELOG.md`, `spec.md`, `gestures.md`, `state-machines.md`, `acceptance-criteria.md`: decisions/contracts and PROPOSED status. `hifi/README.md`: visual references and limitations. `hifi/prototype/index.html` is self-contained simulation. PNGs are polished references; SVG wireframes also retained.
- `blocks-capture-product/README.md`, `capture-spec.md` (version caveat and D1–D9), `prototype-findings.md`, `source-ledger.md`, `evaluation-plan.md`, `musician-review.md`: research and historical code observations. Preserve their dates; do not equate “today/current” there with current deployment.
- Historical inspected commits: `f62b2a5`, `534279f`; `fadfdcf` quick review in findings §7. `fixtures/repro-four-chords.mjs` explicitly targets the copied real function at `534279f` (stated byte-identical at `fadfdcf`), NOT `fdba348`. Synthetic tuning/holdout outputs remain attached to their original provenance; no tests rerun for this packaging task and no missing full SHAs invented.
- `fixtures/README.md`, generators/scorers, fixture JSON, evaluation smoke/holdout/harmony outputs and repro output retained. M0/harmony references are research-only. `harmony-analysis-STAGED-DRAFT.md` is paused/unreviewed. Synthetic labels are provisional, not accuracy claims.
- `blocks-sound-library/LEDGER.md`, `asset-manifest.json`, `licences/verification-notes.md`, exact licence/readme evidence and research provenance/hash records retained. These manifests describe excluded local samples and are NOT inventories of binaries inside this snapshot.

## Packaging / exclusions / security
- Scoped files were copied into staging first; all hashes and archives derive from those copies. No included file changed size/mtime during its individual copy. This is a bounded copy window, not an atomic filesystem snapshot; later source edits are not included. SOURCE-INVENTORY.json records every observed file, included sizes/hashes, excluded paths/reasons and copy-time changes.
- Include all scoped design Markdown, tokens, SVG/HTML/Python sources, previews/storyboards and simulation prototype; capture specs/fixtures/scorers/results; sound ledgers, local research scripts and licence evidence.
- Exclude caches/pyc; all sound assets (audio, sample archives, SFZ/mappings and associated images); installed third-party research/tools code and binaries; full third-party webpage/image captures (redistribution not assessed). Source URLs and quoted licence evidence remain in ledgers. No node_modules, browser data, .env, credentials, APKs or chat transcripts included.
- No credential signatures found in scoped retained text using conservative token/private-key/password-value checks. This is screening, not a guarantee or legal clearance. Sound candidates have differing rights: CC0 evidence is version-specific; jRhodes samples are noncommercial; other candidates are held/unverified. Do not infer rights to excluded samples or provider photos from this snapshot.
- Existing docs may contain older recommendation text alongside later hybrid precedence; retained unchanged rather than silently reconciled. Follow latest explicit precedence and review with Haris.

## Reproducibility gaps / next steps
- `fixtures/evaluate.mjs` and `repro-four-chords.mjs` refer to `/workspace/research/blocks-534279f/recent-phrase.ts` outside these source roots; that file is NOT bundled. Obtain exact historical Blocks code through the existing cloud project and adapt paths there before rerunning. No clone was made for this task.
- Design `hifi/src/build.py` and sound research scripts contain original absolute workspace paths. Preserved as source evidence; adjust ROOT/B in a future repository change. Sound scripts intentionally cannot rebuild absent samples.
- No app source, git history, deployments, actual user MIDI trace, APK, package-manager environment or third-party dependencies are included. Confirm current main/deployment SHA and reproduce the real failure before claiming a fix.
- ZIPs are ordinary independent archives, not split-volume chains. Extract into the same destination to restore descriptive relative roots. Each preview ZIP is directly viewable; the complete source/prototype ZIP carries editable non-PNG sources. No absolute/traversal paths, symlinks or special members are allowed; extraction and hashes were verified.
- Update GitHub at meaningful milestones and keep known failures/decision/test provenance current. Verify commit and archive/tree hashes before telling Haris backup is complete.
