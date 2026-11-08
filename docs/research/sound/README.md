# Sound research and licence evidence

This directory is research. It is not a sample library and not a set of integrated presets.

`blocks.ep.fm.v1` (Warm EP) is the only sound implemented in the app. It is procedural. It is not in this directory. Bass, pad, the 12-slot electronic drum map, and the optional upright are proposals. None of them are in the APK or the web bundle, and none have been auditioned in the app.

Candidate manifests and `research/inspected-audio.json` describe samples that were measured on an inspection machine and then excluded from this snapshot. Those WAV, FLAC, SFZ, and archive files are not in this repository. Do not treat a manifest row as a file you can play from this checkout.

Licence evidence that was kept:

- FreePats synthesizer percussion 2022-07-18, CC0, archive sha256 `dbb2e5bb8268022fffa6dcc3d11a93368316038bf3ae81a965c58e9d490ed23b`. Electronic, not an acoustic jazz kit. Text: `licences/synth-drums-CC0-1.0.txt` and `licences/synth-drums-readme.txt`.
- Upright Piano KW small 2019-07-03, CC0, one recorded velocity layer, archive sha256 `e346ef198fcda0694fc66ddb80c2db2a1c700e96e3a1801930e3cebfed37047f`. Optional, not bundled. Text: `licences/piano-kw-small-flac-CC0-1.0.txt` and `licences/piano-kw-small-flac-readme.txt`.
- jRhodes3d was rejected for commercial bundling because the samples are CC BY-NC. No audio was imported.
- Salamander, VSCO, Karoryfer, Muldjord, and the TinySoundFont example stay held. See `licences/verification-notes.md` and `LEDGER.md`.

`research/build_manifest.py` and `research/assemble_ledger.py` resolve their directory from the file location. They still expect sample trees that are not here. They were not run for this import.

Absolute `/workspace/blocks-sound-library/` strings inside the JSON and the ledger body are the inspection machine. They were left in place so they are not mistaken for paths in this repo.
