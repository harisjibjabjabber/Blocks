# Blocks starter sound palette — research ledger & engineer handoff

Checkout note, added when this ledger was imported: the text in this directory lives at `docs/research/sound/` in the Blocks repository. Paths below that start with `/workspace/blocks-sound-library/` are the inspection machine. Sample archives, WAV, FLAC, SFZ, and saved web pages named on those paths were not imported. The manifests describe those excluded samples. They are not integrated presets, and none of them play in the app. `research/assemble_ledger.py` and `research/build_manifest.py` now resolve their root from `__file__`. They still cannot rebuild the missing samples. They were not run for this import.

As of 8 November 2026, Europe/London. Recommendation only. No engine, sampler format, footprint, DSP design or sound quality approved. No production code changed; no repository checkout, messages, signups, purchases or app integration.

## Decision

Start with original procedural **EP, pluck bass and soft pad**, plus **FreePats synthesizer percussion 2022-07-18**. It has explicit versioned CC0 raw redistribution permission and supplies a small complete electronic drum-kit skeleton. Propose 12 fixed samples mapped to GM slots, omitting random cymbal alternatives. This is a compact electronic palette, **not an acoustic jazz kit**. No brushes, true pedal-hat, authentic ride/bell, rim articulation or recorded velocity realism is verified.

Offer **Upright Piano KW small 2019-07-03** as a small optional CC0 acoustic piano. It is mono and **one recorded velocity layer**, not the current 2022 two-layer stereo version; gain-scaled velocity will not reproduce sampled timbral dynamics. For a jazz pianist this is a sketching tradeoff, not a quality recommendation based on audition. Prefer a procedural EP as the gate-1 keyboard while evaluating the full KW two-layer piano or a separately inspected larger piano later.

Procedural here means a proposal with **no external audio**. No synth code supplied; implementation is pending and not assigned by this research. Later DSP/code dependencies require their own review. Never infer “free to download” or “royalty-free output” permits shipping raw samples.

## Selected external sources — verified and downloaded

| Asset | Exact inspected version | Permission evidence | Recommendation |
|---|---|---|---|
| FreePats synthesizer percussion | 2022-07-18 SFZ/WAV | Archive readme + full LICENSE: CC0 1.0 | Default-source candidate; approve GM subset/choke design first |
| FreePats Upright Piano KW small | 2019-07-03 SFZ/FLAC | Archive readme + full cc0.txt: CC0 1.0 | Optional small piano, one recorded layer |

Primary pages: https://freepats.zenvoid.org/Percussion/electric-percussion.html and https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html . Exact public archive links and full provenance are in `asset-manifest.json` and `research/downloads.json`.

CC0 explicitly grants reuse, modification and redistribution in any medium for any purpose, including commercial purposes, with a fallback licence where waiver fails. **Commercial Android bundling, publicly accessible raw browser files, trimming, repacking and format conversion are covered for the affirmer's copyright/related rights.** Attribution/share-alike/source release not required. Preserve credits and licence evidence voluntarily. CC0 is not a warranty, patent/trademark licence or clearance of unknown third-party rights. Exclude photos, logos and third-party player executables. Full evidence and pertinent quotations: `licences/verification-notes.md`.

### Measured footprint, not an approved memory budget

All sizes below are bytes. Source-derived PCM sizes exclude headers. Float32 bytes were verified by fully decoding all 47 inspected samples with ffmpeg at source rate/channels; this is file validation, **not audition or Android/Web Audio testing**. Working memory, voices, resampling caches and app/DSP code are extra and unknown.

| Source / proposed subset | Archive download | Audio files | Decoded float32 | Regions / samples |
|---|---:|---:|---:|---:|
| Full synth percussion source | 1,853,650 | 2,447,354 WAV | 3,296,132 | 21 / 21 |
| Proposed fixed 12-sample drum subset | null: no new archive built | 1,294,882 source WAV | 1,725,804 | 12 / 12 proposed |
| KW small selected FLAC source | 3,092,715 | 2,346,097 FLAC | 18,903,700 | 26 / 26 |

The subset is a list, **not a converted/bundled pack**. Its counts/byte sum derive from the selected original files. All-source drums+piano is 4,946,365 downloaded archive bytes and 22,199,832 decoded float32 bytes; proposed subset+piano is 20,629,504 decoded float32 bytes, before voices/engine overhead. No transport-compressed subset size measured. Do not label archive or FLAC size “RAM”.

- Synth drums: 48,000 Hz, mono, mixed 16-/24-bit WAV; one layer per key; source keys 48–66 are **not GM**. Two extra source regions randomly select Cymbal 1 alternatives. No sample loops. Source `ampeg_release=100` is not a sensible mandatory voice lifetime for a one-shot renderer.
- KW small: 44,100 Hz, 16-bit mono FLAC, 26 regions cover MIDI 21–108. Source `ampeg_release=0.6` seconds; 12 bass/lower-mid regions use `loop_continuous`, 14 use `no_loop`. No release samples, pedal resonance or multi-layer samples found. Source loop positions retained verbatim in JSON; converter must normalize frame-end convention.
- Downloaded WAV piano alternative: 4,551,289 bytes, SHA256 recorded; metadata licence/SFZ extracted, but PCM extraction failed due this inspection library's unsupported LZMA options. Partial output quarantined under `assets/partial-unusable/`, **not inspected-valid audio**. The FLAC equivalent was subsequently fully extracted, probed and decoded. No huge downloads.

### Download integrity

- Drums `SynthesizerPercussion-SFZ-20220718.7z`: `dbb2e5bb8268022fffa6dcc3d11a93368316038bf3ae81a965c58e9d490ed23b`
- Piano `UprightPianoKW-small-SFZ+FLAC-20190703.7z`: `e346ef198fcda0694fc66ddb80c2db2a1c700e96e3a1801930e3cebfed37047f`
- Piano WAV alternative `UprightPianoKW-small-SFZ-20190703.7z`: `ffb547fceb91eeb93d78cf8d220d1d5f726dcac891afc15e517805ac48abb39d`

Per-file hashes (samples, SFZ, archive readmes/licences and source-page captures) are in `research/SHA256SUMS`; audio inventory repeats each validated sample's SHA256.

## Considered alternatives — do not silently promote to selected

| Candidate | Primary evidence observed | Disposition |
|---|---|---|
| KW full 2022-02-21 | FreePats CC0; source reports stereo, 2 layers; WAV 69 MiB download / 83 MiB unpacked; FLAC 32 / 32 MiB | Optional quality upgrade; archive, exact ranges and decoded RAM not inspected |
| Salamander Grand Piano | Author now declares public domain; FreePats V3+2020-06-02 still CC BY 3.0; source 16 layers, release sounds; FLAC 707 MiB | Hold: large and exact derivative rights need care; do not call all versions CC0 |
| Salamander Drumkit | Author declares public domain from 4.3.2022; older mirrors CC BY-SA | Hold: no version/archive inspection; author flags normalization clicks; no unofficial fixes bundled |
| VSCO 2 CE | Official raw WAV CC0; tag 1.1.0 LICENSE verified CC0 through GitHub; official source reports 3 GB | Legally promising later subsets; site 2.1.1 and SFZ tag 1.1.0 are distinct labels; no archive downloaded |
| Karoryfer Meatbass | Primary current blanket CC0 relicensing explicitly includes old free libraries; official 434 samples / 242 MB | Later jazz bass option; exact version/regions/archive licence not yet inspected; not falsely rejected as CC-BY |
| jRhodes3d | Primary LICENSE explicitly CC BY-NC 4.0 for raw sample/app redistribution; CC0 controls and musical output only | Reject for commercial bundling without separately obtained permission; no contact sent |
| TinySoundFont Florestan example | API reports 531,786-byte SF2; engine README says MIT, recording permission chain unverified | Hold; do not inherit engine MIT as audio licence |
| FreePats MuldjordKit 2020-10-18 | Primary CC BY 4.0, stereo velocity/random layers; WAV 223 MiB download / 380 MiB unpacked | Possible future acoustic kit, not default; archive/mapping/attribution/anti-DRM assessment pending |

Full author/source/download/version/licence fields and unknowns (`null`) are machine-readable in `asset-manifest.json`. No unverified third-party velocity-layer counts or sound-quality claims adopted. FreePats CC0 world percussion was also researched but is not a complete kick/snare/hat kit and was not downloaded/selected; source page captured in `research/freepats-world-percussion.html`.

## Integration handoff — proposals pending Audio & MIDI approval

Audio & MIDI steering: **Oboe Android app-owned renderer and separate Web Audio**, raw MIDI timing/velocity/pedal/expression preserved independently. No sample format, footprint or engine requirements approved.

### Minimal dependency decision

Approve or revise **flattened PCM + a Blocks-owned preset/region manifest** as the import/runtime boundary; treat SFZ/SF2 as source/import formats, not a requirement to ship a full SFZ/SF2 engine. This handoff's source-opcode inventory is **research metadata, not a ready runtime manifest**. No production converter or engine was implemented.

Proposed per-region fields: sample ID/hash, root/key/velocity bounds, source sample rate and channels, start/end frame, optional loop points/mode, gain, tuning and note-off release. Unknown absent source facts remain null in research. Converter must make any default interpretation explicit and tested, especially SFZ inclusive loop/end semantics versus proposed exclusive runtime ends.

- Nonoverlapping velocity regions first; no gate-1 round robin or random cymbal choice. One-layer samples use continuous gain response, not invented timbral layers.
- Pitched per-voice note-off release; CC64 defers note-off until pedal release. Release samples optional. Preserve raw controls for later reinterpretation; half-pedal/sostenuto policy unapproved.
- Click-free, sample-accurate loops; verify pitch-shifted loops, envelope tails, retrigger and stealing. No untested loop interpolation/crossfade policy specified.
- Decode and load off the audio thread; renderer must avoid file I/O and allocation. Bound voices and define voice stealing; numbers require device measurement, no approved budget.
- Browser: preconvert FLAC to PCM/WAV at build time or use a deliberately supported decoder. SFZ/SF2 do not play directly in Web Audio. Use same-origin files or correct CORS, audio-context unlock, bounded cache and loading state. Actual Android/browser decode and latency tests pending.

### Proposed drum alignment

`research/drum-map-proposal.json` records all 19 source key destinations and the proposed 12-slot subset. **Remap keys and roots together to avoid transposing drum playback.** Proposed default notes: 36 kick, 38 snare, 40 alternative snare, 42 closed hat, 44 pedal-hat surrogate, 46 open hat, 41 low tom, 45 mid tom, 48 high tom, 49 Cymbal 1 fixed sample, 51 Cymbal 2 ride-slot surrogate, 39 clap. Source cymbal labels do not prove acoustic ride/crash articulation.

Closed/pedal hats should choke open hats using a short click-free envelope; precise choke groups and duplicate-open-hat handling need approval. Drum one-shots should not obey sustain pedal. No real brush/rim/ride bell sound promised. Preserve raw incoming MIDI notes independently of playback mapping.

### Stable preset IDs and render alignment

Proposed IDs, not registered in either app:

- `blocks.ep.fm.v1` — procedural EP
- `blocks.bass.pluck.v1` — procedural bass
- `blocks.pad.soft.v1` — procedural pad
- `blocks.drums.electro.v1` — proposed fixed GM subset
- `blocks.piano.kw-small.v1` — optional piano

Versioned descriptors should carry source and derived-file checksums, public parameter values, tuning, gain, envelope/choke semantics and explicit seed/generator version where random/noise synthesis is used. Suggested parameter *names* are in the JSON, values and seed deliberately null. No DSP internals prescribed. Shared IDs/seed alone do not ensure identical sound or deterministic cross-platform floating-point output.

For eventual stem render, agree event timebase, event ordering at equal timestamps, tempo map, note-off/pedal semantics, latency compensation, source resampling policy and tail duration. Render the same preserved event stream from the same preset version/parameters/hashes. Validate sample-aligned onset with impulse fixtures and musical pedal passages; choose whether exact or tolerance-based waveform comparison is required. **No stem renderer integrated and no native Ableton export claimed.**

## Validation checklist and open decisions

Recorded status as of 8 November 2026, Europe/London:

- [x] Selected external sources reachable; direct versioned archive readme + full CC0 text retained.
- [x] Download/sample/SFZ/licence/source-page checksums retained; unsafe paths/symlinks and archive size checked before extraction.
- [x] Selected FLAC piano and WAV drums: 47 sample metadata probes and full file decodes passed.
- [x] Source versus proposed counts, file/compressed versus decoded memory, full versus small version separated.
- [x] jRhodes NC/raw-output distinction documented; Salamander/Karoryfer relicense changes recorded.
- [ ] Product/Audio approve the electronic-default tradeoff, optional single-layer piano and future acoustic jazz pack priorities.
- [ ] Approve engine/import boundary, footprint targets, voices/stealing, regions, sustain/choke and loop conventions.
- [ ] Convert/build derived files and final runtime manifest; hash outputs and record every trim/downmix/resample/gain change. No conversion pack exists now.
- [ ] Licence review of final exact derivative pack, player/DSP/decoder dependencies, platform terms and voluntary in-app notices; no sample/code licence conflation.
- [ ] Audition velocities, chords, sustain and repeated notes on headphones/speakers with the jazz pianist. No audition performed.
- [ ] Android/browser support, first-load/download/decoded RAM and CPU/latency/underrun/voice-stress tests on target hardware.
- [ ] Test GM note identity/root remap, hat choke, sample tails, no dangling CC64 voices; retain raw MIDI separate from playback.
- [ ] Cross-platform/offline render fixtures for timing, velocity boundaries, pedal, sample rates, tempo changes and tails. Define tolerance and seed/parameter contract.
- [ ] If larger optional pack selected, pin version, inspect archive licence/attribution/regions and remeasure subset; do not reuse current unknowns as facts.

Open legal questions: verify any later derivative additions and third-party rights; CC0 disclaims warranty. Original Salamander public-domain declaration versus distinct derivative contributions must not be conflated. CC-BY alternative packs require exact attribution/change-notice and platform anti-DRM review. No legal contact or permission request sent.

## Durable files and Page status

Root: `/workspace/blocks-sound-library/`

- `/workspace/blocks-sound-library/asset-manifest.json` — complete machine-readable research/licence manifest with source inventories embedded.
- `/workspace/blocks-sound-library/LEDGER.md` — this decision record and engineer handoff.
- `/workspace/blocks-sound-library/licences/verification-notes.md` — quoted evidence, selected licence interpretation, held/rejected detail.
- `/workspace/blocks-sound-library/licences/piano-kw-small-flac-CC0-1.0.txt` and `piano-kw-small-flac-readme.txt`.
- `/workspace/blocks-sound-library/licences/synth-drums-CC0-1.0.txt` and `synth-drums-readme.txt`.
- `/workspace/blocks-sound-library/research/inspected-audio.json` — measured metadata, decode results and source SFZ opcodes.
- `/workspace/blocks-sound-library/research/drum-map-proposal.json` — explicit source/full and proposed gate-1 mapping.
- `/workspace/blocks-sound-library/research/provenance.json`, `downloads.json`, `SHA256SUMS` — URLs, captures, sizes/hashes.
- `assets/inspected/` — two fully validated source packages; `assets/partial-unusable/` — quarantined failed WAV extraction; `assets/*.7z` — original downloads.
- `research/tools/` — local archive-inspection dependency only, **not sound assets or a proposed shipped dependency**.

Page not published: canvas skill and kit reference were read in full. Executor has no direct `WriteCanvas` tool; the skill explicitly forbids `GetDynamicTools`/`CallDynamicTool` invocation for it. No fake Page URL or staged canvas source created. Parent should publish the concise iterated Page using its direct WriteCanvas, based on this ledger. Page URL remains null in the manifest.
