# Blocks handover

This page is the place to continue from the public repository alone. The documents on `handover/status` were branched from `497894e170ac150f06e5a8bea34d0d4e7f34e2fd` and do not include later Capture code. `git fetch origin main` on 8 Nov 2026 shows `origin/main` is `91291d80a3c6bb5e91cc6635243f00bf218672f0`. That commit is not merged here. `957480eda2de13005613d27cc875d2853c9fbde4` was the previous tip and is not merged here either. This branch does not deploy a UI. The Pages workflow runs on push to `main` and on `workflow_dispatch`. Take application code from the latest `main`. Take these documents from `handover/status`. This branch is not a substitute for `main`.

Roles and the portable path: [ways-of-working.md](ways-of-working.md). Milestone form: [checkpoint-template.md](checkpoint-template.md).

Live site: https://harisjibjabjabber.github.io/Blocks/

Base path: `/Blocks/`

Live script: `/Blocks/assets/index-CPO7bfKa.js`, for verified `main` tip `91291d80a3c6bb5e91cc6635243f00bf218672f0`. Pages run: https://github.com/harisjibjabjabber/Blocks/actions/runs/42520085001. The earlier script `/Blocks/assets/index-DGlo7_W4.js` belonged to `957480e` and has been overtaken. Fetch agreed with the reported tip before this was written.

The design proposal on this branch is rev 3.3. It is proposed example data. It is not implemented UI, not the live site, and not approval to build the production screen. A thumbs-up on the delivery acknowledges the prototype caveats. Capture research is separate: its current baseline remains `3412f612fe5f5f8d818ec50ad62ab9cd2a3cab3e`, and last-chord Capture is still unresolved. Neither is shipped.

## Last-chord Capture is not fixed

Haris refreshed onto `/Blocks/assets/index-DGbe1J8t.js`, the Pages build of `fdba348124d4cefe6fbeba2a7c187e47de705528`, and still heard only the last chord. That failure is open. It is his playing. Every result below is synthetic. None of them is his take.

`3412f612fe5f5f8d818ec50ad62ab9cd2a3cab3e` is not in this branch. When it was the main tip, the live script was `/Blocks/assets/index-CsEdtvjV.js` (checked at 19:52 GMT). It groups notes that are still sounding, or still held by the pedal, as one chord. The 40 ms cluster and the 1.5 s rest were not widened. On synthetic traces the tight chords and the 60–120 ms roll stored all 12 chord notes. A real pause still splits, and a long run without a rest stays a short window, according to that commit's message. It failed the frozen fixtures in the recorded ways: the pedalled scalar run stored 8 of 32, and the bass, pickup, and postlude kept the noodle. Specialist evidence, designer-labelled and synthetic, is in `docs/research/capture/checkpoints/2026-11-08-3412f61-note.md`. On 13 cases the score there is 6 good, 3 partial, 1 last-part, and 3 whole-session. Bass, pickup melody, and postlude fail. `overlapStacks` collapses a pedal scalar run. The fixture event files are in the repository. Frozen validation is `docs/research/capture/fixtures/phrase/data-validation/validation/`, including `V01-single-note-take.json`, which is already in commit `f3c1435e474171a433dba3950e526db2d37fc5dd`. The unscored diagnostic is `docs/research/capture/fixtures/phrase/data-validation/diagnostic-post-freeze/`.

`957480eda2de13005613d27cc875d2853c9fbde4` was a behavior commit and, at the time, the `main` tip verified by `git fetch`. The live script then was `/Blocks/assets/index-DGlo7_W4.js`. Pages run: https://github.com/harisjibjabjabber/Blocks/actions/runs/42519227139. On the designer's labels, V01–V13 are 11 good and 2 partial. The pickup still drops its first note. The rubato chords still include two noodle attacks. Two good cases still include one earlier noodle note. D01 stays unscored. This is synthetic. It does not close Haris's last-chord report, and it is not bar-aligned inference. No 130 ms rule was added. That commit and that script are not listening confirmation. This commit is not merged into `handover/status`.

On a synthetic four-chord line, `957480e` took the median of every attack gap, including the 12 ms gaps inside a chord, so the loop ended at 4836 ms and the releases sat outside it. `91291d80a3c6bb5e91cc6635243f00bf218672f0` uses the repeated spacing between chords, 1600 ms on that line. Both a short release and a held chord end the loop at 6400 ms. Note-offs stay at 4980 ms and 6200 ms. The ribbon draws the last attack at 75.4% of the width. An irregular line is not padded. A hold past the slot does not move the period. This is not Haris's take and not sign-off. `git fetch` confirms that commit is `origin/main`. The live script is `/Blocks/assets/index-CPO7bfKa.js`. Pages run: https://github.com/harisjibjabjabber/Blocks/actions/runs/42520085001. It is not merged into `handover/status`.

At 20:20 GMT on 8 Nov 2026 Haris played the live build and said it is nearly perfect, except the last chord is sliced quickly and the loop returns to the start. He asked if that ending should include the space of a bar. At 20:21 GMT he said the space should also appear on the ribbon when he stops, because a short final chord leaves the ribbon short. The intended loop includes trailing empty time. That empty time is not new MIDI, and an early release must not lengthen the notes. At 20:30 GMT he said the ending problem has gone in that test, and that garbage or older playing at the front is sometimes still captured with the chords. The ending is user-reported resolved for that hearing, not a universal sign-off. Prefix contamination is the open selection miss. His exact take is not available. This is not a shipped fix and not an editor redesign, and it is not a decision to append one bar to every take. No later code change is recorded here as already deployed. `git fetch` still shows `origin/main` at `91291d80a3c6bb5e91cc6635243f00bf218672f0`.

The phrase-capture research comparison baseline is now `3412f612fe5f5f8d818ec50ad62ab9cd2a3cab3e`. `fdba348124d4cefe6fbeba2a7c187e47de705528` and `497894e170ac150f06e5a8bea34d0d4e7f34e2fd` stay historical. On the earlier research predictor's synthetic labels the right default loop length was 3 of 15, with 2 further acceptable alternatives. That predictor, and any 130 ms grouping proposal, is not the app and was not evaluated as a ship. Keep baseline metrics distinct from candidate metrics. Proposed adaptive thresholds and the fallback have not been evaluated. The saved results were not rerun for this import. `phrase-results-holdout.json` is a supersession note. The old bytes are `phrase-results-holdout-SUPERSEDED.json`. PH01–15 are regression cases, not fresh holdout evidence.

`fdba348` changed a spacing cut. `FREE_GAP_MS` stayed 1500. Sounding silence and an outlier test (more than 2.5 times the median of the other gaps) replaced a cut on every attack gap over 1.5 s. The note that recorded it says 58 tests stayed green, including `src/domain/four-chord.synthetic.test.ts` and the existing recent-phrase, holdout, engine, host, keys, and Warm EP measure files. Those 58 checks are synthetic. They are not his take. Pages run: https://github.com/harisjibjabjabber/Blocks/actions/runs/42515484777

On one later synthetic history, that same `fdba348` cut stored only F and G, or the whole line when a pedal lift was ignored. It did not reproduce a single final G chord on that constructed history. The stage that dropped notes was the cut, not the scheduler.

`497894e170ac150f06e5a8bea34d0d4e7f34e2fd` is the parent of this documentation branch. On one synthetic tight-chord trace (notes inside a chord 16 ms apart) it schedules all 12 chord note-ons. Pages run for that build: https://github.com/harisjibjabjabber/Blocks/actions/runs/42516460709, script `/Blocks/assets/index-CqMoO9xx.js`. He has not confirmed it. A separate synthetic 60–120 ms roll on that same commit stored only F and G when the rests were counted (14850–17340 ms, loop 2.49 s, 6 note-ons), or the whole line (16.58 s) when the pedal hid the rests and the tempo was not locked. `3412f61` is the later synthetic report for those two traces. It does not turn them into his playing.

Whole-session selection was an earlier bug. At `f62b2a5` the capture took the ribbon. Later commits select a recent window and keep the raw history. That earlier bug is not the open failure.

An end-to-end trace through capture, the stored range, the loop duration, and scheduled replay is the check that still matters. Do not ask Haris to play it again until that trace fails the way he heard.

## Implemented

The application source in this branch is `497894e`. `3412f61` is Capture work on `main` and is not merged here. What follows is the slice at the branch point:

- Warm EP, `blocks.ep.fm.v1`. Procedural FM electric piano. Velocity changes loudness and brightness. Sustain is CC 64. The label is not a brand and not a sampled piano. Android and web are separate renders. They have not been auditioned as a sign-off.
- Web MIDI (`sysex: false`) and Android `android.media.midi`. Enable resumes audio before the MIDI prompt.
- A ribbon of about 120 seconds, plus an event cap and a byte cap. 120 is the history window, not a tempo. Age and overload are different losses.
- Capture writes a new layer and keeps the raw history. One undo puts the ribbon back. The default after capture is to loop unless stay-silent is set. Input timestamps are not rewritten.
- No automatic quantise. Quantise is a derived copy. Strength 0 is the start. Recover clears it. Half, double, phase, and loop length move a 4/4 overlay. They do not invent events past the last recorded one.
- The first grid is proposed, not accepted. A second layer accepts that proposal, and undo restores the proposal. A proposed tempo is not passed into the phrase cut. Switching instrument alone does not accept the grid. `docs/contracts.md` still has an older sentence that the first reading may lock the grid. The code in `src/domain/project.ts` (`proposeTempo`, `beatForCut`) and decision D1 in `docs/research/capture/capture-spec.md` are the later contract.
- Capture and Play/Stop can be learned from a CC other than 64. Playing keys are refused. CC 64 stays sustain.
- Android audio uses vendored Oboe 1.11.0 (Apache-2.0, `third_party/oboe/LICENSE`). The callback does not allocate, lock, or do I/O.
- Static web build with base exactly `/Blocks/`.

The journey people are aiming at is: improvise, capture a phrase into a synced loop, then do the same for bass and drums, with quantise optional and no arm-record-stop cycle. The app does not do that whole path yet. One grid and one loop are the shared model. A second layer is a new capture, not a four-slot mixer.

## Proposed

Not in the app binary. Not user-tested.

- UI rev 3.3 hybrid, dark and light: `docs/design/hifi/hybrid/`. Rev 3.3 wins where it overlaps rev 3.2.1. Frames 17–27 are the new editor storyboard in both themes. Only frame 18 has Fold and desktop adaptations. Fold sizes are provisional. Mock data. See `docs/design/hifi/hybrid/CURRENT-PROPOSAL.md`. Original storyboard PNGs and the A/B comparison remain history. The user asked for draw, move, resize, erase, velocity, and maybe Quantise on the main screen. The designer recommends Quantise only inside the editor. Haris has not agreed to remove a main-screen shortcut. That choice is open. Undo is pictured and the prototype has none. Pinch is not simulated. This is not approval to build the production screen.
- A piano roll corrects a miss. It does not replace one-action phrase capture. No production UI until Haris reviews the storyboard. Tests, audio, and Capture behaviour can continue. Layout work waits.
- Capture research in `docs/research/capture/`: phrase selection, a proposed grid or an honest abstain, layered loops, reversible corrections. Decisions D1–D9 are in `capture-spec.md` §0. Numeric gaps, including 1.5 s, are unvalidated starting values. The current research baseline is `3412f61`. The evening handoff's comparisons to `fdba348` and `497894e` are historical. Ableton material in `source-audit-2026-11-08.md` and `source-ledger.md` is public behaviour, not Ableton's private algorithm. Zya figures 14–16 are UI, not MIDI. The earlier MIT repository quantised and bar-aligned. The 2024 paper was reviewed as an abstract only. Those licence caveats stay. Validation V01–V13 was frozen independent of predictor tuning, by the same designer. V10's title says the pedal runs through the noodle, but CC64 starts at the progression; that frozen file stays unchanged. D01 is an unscored diagnostic.
- Sounds that are not Warm EP. See `docs/research/sound/README.md`. Procedural bass `blocks.bass.pluck.v1` and pad `blocks.pad.soft.v1` have no code. Drums `blocks.drums.electro.v1` and optional piano `blocks.piano.kw-small.v1` are candidates with licence evidence and no samples in this repo.
- Later product work already written down in `docs/backlog.md`: four layers, autosave of the ribbon, MIDI parts, WAV stems, a fixed layer limit, controller learn beyond Capture and Play/Stop. No accounts, cloud, plugin hosting, mastering, marketplace, iOS build, or Ableton session export.

## Tested, and what the tests are

Keep these apart.

| Kind | What was recorded | What it is not |
|---|---|---|
| Synthetic app tests | Commands below. They pass on fixtures and mocks. | Not Haris playing. Not a keyboard, Fold, pedal, or latency measurement. |
| Synthetic research harness | Smoke and holdout outputs already in `docs/research/capture/`. Designer-labelled. Tuning and holdout are separate. The historical `534279f` predictor is a third column when the file is present. | Not rerun for this import. Not evidence against `fdba348`, `497894e`, or `3412f61`. Not an accuracy claim. |
| Holdout | `recent-phrase.holdout.test.ts` in the app suite, and `fixtures/data-holdout/` plus `evaluation-holdout-results.*` in the research set. The research holdout was not used to tune `m0Predict`. | Not hardware. Labels are provisional (decision D9). |
| Hardware, listening, Fold, pedal, latency | Not run. | Do not upgrade a synthetic pass into any of these. |

Commands that were actually recorded, with the pass they belong to:

Host slice, before the later Capture cuts (`docs/verification-report.md` in this tree, an earlier pass):

```text
npx vitest run
Test Files  4 passed (4)
Tests  35 passed (35)

npm run test:native
native host tests passed

npm run build:web
dist/index.html script src="/Blocks/assets/index-Ck4Rr643.js"
```

Standalone debug APK, commit `e4fefc54c33426e70d3e14c94a6673b902f8e5df`. The report says the emulator was not booted and the APK was not installed or launched.

```text
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64 --no-daemon
BUILD SUCCESSFUL in 17s

npx vitest run
Tests  22 passed (22)
```

Recorded sha256, files not in this repository: Metro debug APK `c4aa0796756b67a64026fefa360b62155ee1bb9bfeecf6f3c178a00dcf809e0c`, standalone debug APK `3395360529263bfa6782c22a827e323ec9062ac94bd422443ebd1f6bea4c5ac3`. Do not commit APKs.

Later web pass, commit `fadfdcf63c103e3b451be56c78782ad7263374bd`, script `/Blocks/assets/index-BZdOKcoi.js`, Actions https://github.com/harisjibjabjabber/Blocks/actions/runs/42504065576 :

```text
npx vitest run src/domain/recent-phrase.test.ts src/domain/recent-phrase.holdout.test.ts src/adapters/engine.web.test.ts src/domain/host.test.ts src/ui/keys.test.ts src/audio/web/warm-ep.measure.test.ts
```

Recorded result: 6 files, 54 tests passed. `node scripts/measure-warm-ep.mjs` rendered Warm EP with Chrome `OfflineAudioContext` and reported signal RMS for attack, release, sustain hold, and stop. That is not listening.

`fdba348` then recorded 58 synthetic tests green. The four-chord file is `src/domain/four-chord.synthetic.test.ts`. Its header says the fixtures are not Haris's take.

Research harness, already scored, not rerun here. From `docs/research/capture/fixtures`:

```text
node --experimental-strip-types generate.mjs
node --experimental-strip-types generate-holdout.mjs
node --experimental-strip-types evaluate.mjs --data data
node --experimental-strip-types evaluate.mjs --data data-holdout
node --experimental-strip-types check-arithmetic.mjs
node --experimental-strip-types repro-four-chords.mjs
```

`generate.mjs` and `evaluate.mjs` are the commands the fixture README names. The `--experimental-strip-types` flag was added in this import because the historical cut is TypeScript. Those commands were not executed for this commit. Saved outputs: `evaluation-smoke-results.txt`, `evaluation-holdout-results.txt`, `evaluation-harmony-results.txt`, `repro-four-chords-results.txt`. The smoke note says prototype-f62b2a5 scored 6/22 and the M0 reference 19/22 on synthetic tuning data, raw checksums unchanged, and that the author designed both the fixtures and the parameters. Harmony results are a paused draft (`harmony-analysis-STAGED-DRAFT.md`).

`npm test` in the app runs Vitest and `npm run test:native` (`g++` on the native host tests). They do not open a device.

## Broken

- Last-chord Capture, as above. The verified live script is `/Blocks/assets/index-CPO7bfKa.js`. At 20:20 GMT Haris heard the last chord sliced quickly, with the loop returning to the start. At 20:21 GMT he said that space should also appear on the ribbon when he stops, because a short final chord leaves the ribbon short. The intended loop includes trailing empty time. That empty time is not new MIDI, and an early release must not lengthen the notes. At 20:30 GMT he said the ending problem has gone in that test, and that garbage or older playing at the front is sometimes still captured with the chords. The ending is user-reported resolved for that hearing, not a universal sign-off. Prefix contamination is the open selection miss. His exact take is not available. This is not a shipped fix and not an editor redesign. `957480e` and `/Blocks/assets/index-DGlo7_W4.js` are not listening confirmation. The synthetic four-chord trace on `91291d8` is not his take and not sign-off. No later code change is recorded here as already deployed.
- Hardware MIDI, a Samsung Fold, a sustain pedal on hardware, listening, and keyboard-to-speaker latency. Unverified. No latency number is claimed.
- Bass, pad, drums, and the KW piano. Not in the build.
- The proposed UI. Not implemented. `docs/web-pages.md` and `docs/verification-report.md` still contain earlier sentences ("dispatch only", "no hosted URL"). The banners on those files point here.
- `capture-contract-v1.md` is cited by the capture spec and was not in the snapshot or the durable notes. It is not reconstructed here.
- `prototype-findings.md` in this import ends at section 6. The spec's references to sections 7 and 8 are not in the file.
- The historical repro file was missing from the snapshot. It is restored from git, for `534279f` / `fadfdcf` only. See below.

## Decisions

- Browser-first. Keep the Android code. Do not spend routine iteration on APK size or emulator installs. Do not commit APKs.
- This repository is public. Do not change its visibility. Publish Pages from the `/Blocks/` base. A docs commit must not ship a UI change.
- No automatic quantise. Raw history is kept. The first grid is proposed. A later layer accepts it, with undo. Ableton is a behaviour reference only.
- No production UI until Haris reviews the storyboard. The storyboard to review is rev 3.3, including frames 17–27. A piano roll corrects a miss and does not replace one-action phrase capture. The rev 3.2.1 changelog line that said nothing visual changed is still wrong for that older revision. The correction is in `docs/handover/import-record.md`.
- Preserve input timestamps. Do not rewrite them to a heard time. There is no measured latency compensation.
- CC 64 is sustain, never the Capture button.
- Inference may return no reading or one reading. Do not invent a confidence score for the screen. Research decision D2 allows real alternatives and abstention reasons, and forbids displaying invented confidence percentages. That research contract is not what the current screen does.
- Sound candidates stay proposals until someone implements them and a licence review covers the exact files that would ship. CC0 evidence is version-specific. jRhodes samples are noncommercial.

## How to build, run, and test the web app

```bash
npm install
npm run web
```

The dev server binds to `0.0.0.0:41713` with base `/`. Open `http://localhost:41713` or `http://127.0.0.1:41713` and tap Enable. That click resumes the `AudioContext` before `navigator.requestMIDIAccess({ sysex: false })`. Localhost is the only secure context this build has been checked on.

```bash
npm run build:web
```

`BLOCKS_BASE=/Blocks/` and the output is `dist/`. Serve it under `/Blocks/`. See `docs/web-pages.md`. Do not treat a local `dist/` as a deploy. Pushing this branch does not run Pages.

```bash
npm test
npm run test:js
npm run test:native
```

Web MIDI, from the MDN record used for the implementation: desktop Chrome and Edge, and Chrome on Android, expose the API. Desktop Firefox exposes it from version 108 only behind a site-permission extension, a secure context, and the `midi` permission policy. Firefox for Android, Safari, and Safari on iOS do not expose it. An exposed API is not proof a keyboard worked.

## Android

The Android and native code stays in `android/`, `native/`, and `third_party/oboe/`. A standalone debug APK was built (`assembleDebug`, arm64-v8a and x86_64, Hermes bundle, `useDevSupport` off so it does not probe Metro) and was never installed or launched. No emulator was booted. Browser-first from here. Do not commit APKs. iOS is not a supported build.

When you choose to build:

```bash
export ANDROID_HOME="$HOME/android-sdk"
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64
```

JDK 17 or 21, Android SDK platform 36 or 37, build-tools 37.0.0, NDK `27.1.12297006`, CMake 3.22.1, `minSdk` 29. `local.properties` is gitignored.

## Design, research, and sound

| Path | What it is |
|---|---|
| `docs/design/` | Proposed UI package, rev 3.2. Spec, gestures, tokens, wireframes, prototype. |
| `docs/design/hifi/hybrid/` | Current proposal, rev 3.3, dark and light, including editor frames 17–27. Mock data. Wins over rev 3.2.1 where they overlap. |
| `docs/design/hifi/storyboard/` and `docs/design/hifi/directions/` | History. Not the current decision. |
| `docs/design/hifi/prototype/index.html` | Clickable simulation of the hybrid. Not working MIDI or audio. |
| `docs/research/capture/` | Capture research, synthetic fixtures, saved harness output. "Today" in those files means `534279f` unless a line says otherwise. |
| `docs/research/capture/historical/534279f/` | The `534279f` / `fadfdcf` cut only. |
| `docs/research/sound/` | Licence and provenance. No audio binaries. |
| `docs/handover/import-record.md` | Checksums, the 362-file inventory, and every path edit. |
| `docs/handover/snapshot/` | Packaging note, manifest, and source inventory, unchanged. |
| `docs/architecture.md`, `docs/contracts.md`, `docs/product-brief.md`, `docs/slice-record.md`, `docs/backlog.md`, `docs/verification-matrix.md` | Slice documents already on `main`. Read them with the corrections on this page. |

Rebuild the pictures only if you mean to regenerate proposed mockups. From `docs/design/hifi`: `python3 src/build.py` then `python3 src/hybrid.py`. That needs a headless Chrome and was not run for this import. `ROOT` in `build.py` is the `hifi` directory of this checkout.

## Licences and provenance

- App code: this repository. It does not add its own licence file.
- Oboe 1.11.0: Apache-2.0, `third_party/oboe/LICENSE` and https://www.apache.org/licenses/LICENSE-2.0
- React Native, React, and the other npm packages: the licences in `package-lock.json`.
- No sample set is bundled, so no sample licence is in the binary.
- Research sources, with URLs, versions, and evidence class (`DOC-ABL`, `CODE`, `PAPER`, `HYP`, `OURS`): `docs/research/capture/source-ledger.md`. Ableton quotes there are documented behaviour, not a claim about Ableton's code.
- UI sources S1–S36: `docs/design/sources.md` and `docs/design/research.md`.
- Sound licences and hashes: `docs/research/sound/LEDGER.md` and `docs/research/sound/licences/`.

## Limitations

One meter, 4/4, in the current screen. One undo. Stay silent persists in the project JSON. Native MIDI is foreground-first. Ribbon caps are slice limits, not a phone measurement. The FM voice was not auditioned. Firefox MIDI is a site-permission add-on, not a denial. The research parameters were tuned on the same synthetic fixtures the smoke test scores. Real playing will contain cases those fixtures do not. Pickup wrap, CC 66 as its own hold, same-pitch polyphony across devices, and release adoption into the take are later. The 1.5 s gap remains a hypothesis.

## Next steps

1. Keep prefix contamination open. Do not describe `fdba348`, `497894e`, `3412f61`, `957480e`, or `91291d8` as a universal fix. The verified live script is `/Blocks/assets/index-CPO7bfKa.js`. The synthetic four-chord trace is not his take. The ending is user-reported resolved for the 20:30 GMT hearing only. His exact take is not available. Do not describe a later code change as already deployed.
2. `3412f61` is Capture work on `main` and is not in this branch. Read it there. It groups notes that are still sounding, or still held by the pedal, as one chord, without widening the 40 ms cluster or the 1.5 s rest. On the synthetic tight-chord trace and the synthetic 60–120 ms roll, the stored range now has all 12 chord notes. A real pause still splits.
3. Do not ask Haris to retest until that kind of trace fails the way he heard it. The 58 synthetic checks are not that test.
4. Leave production UI until he reviews `docs/design/hifi/hybrid/` rev 3.3, including editor frames 17–27. The roll corrects a miss. It does not replace one-action capture. A thumbs-up on the prototype is not permission to build the screen. Whether Quantise stays on the main screen is still open.
5. Stay on the web app for routine iteration. Android code stays. Do not commit an APK, and do not treat the old standalone build as installed or launched.
6. If you run a research script, say which predictor and which fixture set. Do not rerun them and then call the saved files new. Git extracts for the harness are `fdba348124d4cefe6fbeba2a7c187e47de705528`, `497894e170ac150f06e5a8bea34d0d4e7f34e2fd`, and the current research baseline `3412f612fe5f5f8d818ec50ad62ab9cd2a3cab3e`. Those copies were not in the research archive. The first two comparisons are historical. None of those scripts were rerun here.
7. Do not download sample audio into this repo. A later sound import has to name the exact files, hashes, and licence texts, and it is still not an integrated preset.
