# Snapshot import record

Imported on the `handover/status` branch. The six zip archives were verified and then left out of the commit. No sample audio was committed. Application source, native code, tests, and the Pages workflow were not edited. `main` was not merged.

## Original manifest result

Checked before any path was rewritten.

| Record | Result |
|---|---|
| Source inventory included | 362 files. `changed_during_copy`: 0 |
| Source inventory excluded | 567 files |
| Manifest file entries | 364. The 362 included files, plus `blocks-handover-snapshot/HANDOVER-SNAPSHOT.md` and `blocks-handover-snapshot/SOURCE-INVENTORY.json` |
| Unique zip members | 365. The 364 manifest paths, plus `blocks-handover-snapshot/MANIFEST.json`, which the manifest hash scope excludes |
| Payload hash mismatches | 0 |
| Unsafe paths, symlinks, audio, or secret signatures in the text members | none found |

Each zip repeats the three snapshot wrapper files. Those copies are byte-identical. Package file counts exclude that wrapper and sum to 362: capture 71, hybrid dark 44, hybrid light 44, original and comparison 26, design sources 162, sound evidence 15. Zip member counts including the wrapper: 74, 47, 47, 29, 165, 18.

Zip sha256, matched to the package manifest:

| Archive | Bytes | sha256 |
|---|---:|---|
| `capture-research-fixtures-results_bc18.zip` | 297989 | `4ccbc0cd6d01281d6672bec36658a031c9e0aa20cbdd7d8a4a95d7b820a577a4` |
| `design-previews-hybrid-dark_7307.zip` | 14286879 | `46e90f10b1b1095729a407ae871bb48b32ec37bb1f7e531eb7dd76f6f2733d29` |
| `design-previews-hybrid-light_ade4.zip` | 15968892 | `6f585d50eff85f52bad887f778920abf8dfb0d5106172d908c022b8b5d3598a2` |
| `design-previews-original-and-comparison_752c.zip` | 12198713 | `ba469d9704ebb27bc03325ac1bcb0122adfb487bada1ba9db711d2871251c3f8` |
| `design-sources-prototype_7233.zip` | 1185571 | `e6bec7f31666eae88970b2446eb736d6aad72b6fa0f93a857c3961161c2b267b` |
| `sound-research-licence-evidence_7dff.zip` | 102149 | `ed94306bd7b9d6930dc613a424b7745748062b18952ddf44a6a915b88eae9613` |

The copies of the manifest, source inventory, and handover note in the snapshot folder match those hashes: manifest `a00cc68081b1299b543dc1bb24b88e83f922c956164f77ca98625a7ab3a89491`, inventory `b324225099204c1c86aeb6e9f894ba6431b0bb14f7d48a43c99e3498952b40ae`, note `c2e6210224cfe2414e0b9cc518267ed97fa5042da0a89509bf6ae1d5bd55eafe`.

Exclusion reasons recorded by the inventory:

| Count | Reason |
|---:|---|
| 483 | third-party installed dependencies; redistribution not assessed |
| 63 | sound binaries, mappings, and source archives; ledger and licence evidence only |
| 11 | build cache |
| 10 | third-party full webpage or image captures; URLs stay in the ledger |

## Mapping

| Snapshot path | Repository path |
|---|---|
| `blocks-design/` | `docs/design/` |
| `blocks-capture-product/` | `docs/research/capture/` |
| `blocks-sound-library/` | `docs/research/sound/` |
| `blocks-handover-snapshot/HANDOVER-SNAPSHOT.md` | `docs/handover/snapshot/HANDOVER-SNAPSHOT.md` |
| `blocks-handover-snapshot/SOURCE-INVENTORY.json` | `docs/handover/snapshot/SOURCE-INVENTORY.json` |
| `blocks-handover-snapshot/MANIFEST.json` | `docs/handover/snapshot/MANIFEST.json` |

Relative links inside each tree were kept by preserving that tree. The snapshot note, inventory, and manifest were not edited, so their hashes still match.

## Path changes

| File | Change |
|---|---|
| `docs/design/hifi/src/build.py` | `ROOT` was `/workspace/blocks-design/hifi`. It is now the directory that contains `src/` (`docs/design/hifi`). |
| `docs/research/sound/research/build_manifest.py` | Root was `/workspace/blocks-sound-library`. It is now the parent of `research/`. `assets/inspected` is still the sample tree, and that tree is not in the repo. |
| `docs/research/sound/research/assemble_ledger.py` | Same root change. |
| `docs/research/capture/fixtures/evaluate.mjs` | `MAIN_CUT_PATH` was `/workspace/research/blocks-534279f/recent-phrase.ts`. It is now `../historical/534279f/recent-phrase.ts`. The run comment names `node --experimental-strip-types`. |
| `docs/research/capture/fixtures/repro-four-chords.mjs` | The import uses that same relative file. The comment says this cut is not `fdba348` or `497894e`. |
| `docs/research/capture/fixtures/README.md` | The evaluate command points at the historical file and says it was not rerun. |
| `docs/research/capture/README.md` | Checkout notes for the historical file, the missing contract v1, and findings sections 7 and 8. |
| `docs/research/sound/LEDGER.md` | A checkout note at the top. Inspection-machine paths in the body were left as provenance. |
| `docs/design/README.md` | A checkout note pointing at the hybrid as the current proposal. |

JSON provenance paths that name `/workspace/blocks-sound-library/assets/...` and saved web pages were not rewritten. Those files were excluded. Rewriting them to repository paths would make absent archives look present.

## Added so a checkout can load the historical harness

`docs/research/capture/historical/534279f/recent-phrase.ts` was not in the 362. It is git blob `93292fe449865871f63df08766b7f57ec823e2c7` from `534279f`, confirmed byte-identical at `fadfdcf`, and different from `fdba348` and `497894e`. File sha256 `545abaac8f59fd275ba97d2f32fcb074c3d38938c25a5c56979227abb487e295`. The harness was not run.

Labels added so old pictures are not read as the decision: `docs/design/hifi/hybrid/CURRENT-PROPOSAL.md`, `docs/design/hifi/storyboard/HISTORY.md`, `docs/design/hifi/directions/HISTORY.md`, and `docs/research/sound/README.md`.

## Rev 3.2.1 delta

Applied after the base snapshot hashes above were recorded. The delta zip was not committed.

| Check | Result |
|---|---|
| Zip | `blocks-design-rev3.2.1-delta_de3e.zip` |
| Bytes | 4894005 |
| sha256 | `988cb692e330fdca2fe2e1e33f2722bcb8de0ebe19c76a1fe877e358f8971814` |
| Package manifest | 46 changed or new files, 5 added font-provenance records |
| Delta manifest `actual_delta` | 46 (25 modified, 21 new). Every extracted hash matched |
| Font provenance JSON | 5, present in the zip and not listed inside `actual_delta` |
| Zip members | 53: the 46, the 5 provenance files, plus `DELTA-MANIFEST.json` and `DELTA-NOTE.md` |
| Unsafe paths, symlinks, secret signatures | none |
| Base manifest named by the delta | `a00cc68081b1299b543dc1bb24b88e83f922c956164f77ca98625a7ab3a89491` |
| Files in the checkout whose bytes already differed from that base before the overlay | `docs/design/README.md` and `docs/design/hifi/src/build.py`, because this import had already annotated them. The delta replaced both. Their `base_sha256` values in the delta manifest are the original snapshot hashes. |

`contrast-rev32.tsv` is unchanged from the base and is not in the delta. Existing SVGs are unchanged. No files were deleted. Excluded list in the delta manifest is empty.

Rev 3.2.1 wins over the earlier hybrid files where both exist. The current proposal is still mock data.

### The changelog sentence is wrong

`docs/design/CHANGELOG.md` keeps the author's text, including the heading "doc-only; no visual changes" and the sentence "No PNG, HTML frame or prototype change." That sentence does not match the files in the delta. These existing artifacts differ from the rev 3.2 snapshot and were imported:

- `hifi/hybrid/dark/14-range-loop-edges.png`, `src/14-range-loop-edges.html`, `src/14-range-loop-edges.board.html`, `src/14-range-loop-edges@2x.png`, and the same four under `hifi/hybrid/light/`
- `hifi/hybrid/dark/range-overview.html`, `hifi/hybrid/dark/range-overview.png`, and the light pair
- `hifi/src/rangeview.py` (background, padding, border radius, and z-index behind the PICKUP and HELD ACROSS END labels on frame 14)
- `hifi/prototype/index.html` (embedded font bytes and the existing frame content)

This delta is not docs-only. Importing those pictures is not approval to implement the UI. No new full-editor frames are included. The upcoming editor storyboard is separate and was not in the zip.

### Fonts

Six TTF files, each family kept with its `OFL.txt`: Geist Mono, IBM Plex Mono, Instrument Sans, Instrument Serif (regular and italic), Inter Tight. Five `HANDOVER-FONT-PROVENANCE.json` records sit beside them. They say the binaries were copied unmodified, the name tables match SIL OFL 1.1, and upstream download commit or release pins were not available and were not invented. `hifi/src/build.py` reads the fonts from `hifi/fonts/` (package-relative `ROOT`). A missing fonts directory would fall back to `/usr/share/fonts/truetype/sand-box/google/`, which this checkout does not need. The checks were not rerun.

`page/blocks-design.canvas.tsx` and `checks/check-log.txt` still name `/workspace/blocks-design/` paths. Those strings are the exported review page and the specialist log. They were left as delivered. The font provenance `source_directory` fields are the same kind of inspection path. The files themselves are under `docs/design/`.

After the overlay, `docs/design/README.md` gained one paragraph that points at this note and at `docs/handover/README.md`. Its bytes no longer match the delta hash `cc2c4fab478a203e73a6acce208a560a0d7c6ef43825875b3d6231a7753c8849`. `docs/design/hifi/hybrid/CURRENT-PROPOSAL.md` was not in the delta; it was updated in place so rev 3.2.1 is named as the current proposal.
