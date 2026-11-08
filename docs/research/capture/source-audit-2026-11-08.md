# Source audit addendum, 8 Nov 2026 (evening, London)

This audits a search-AI summary that Haris supplied and the extra source leads, against primary sources. It is not legal advice and gives no legal clearance. Nothing here is evidence of how Ableton works internally. Haris's last-chord bug is **unresolved by this research alone**.

## 1. Ableton primary text (both manual versions read in full)

- **Live 12 manual** (https://www.ableton.com/en/manual/recording-new-clips/, §19.10). **Live 11 manual** (https://www.ableton.com/en/live-manual/11/recording-new-clips/, §17.10). The wording is identical in both.
  - §x.10.1 "Starting a New Live Set" (no other clips, transport stopped):
    - "Capture MIDI will detect and adjust the song tempo, set appropriate loop boundaries and place the played notes on the grid."
    - "Capture MIDI's tempo detection will set the tempo in the 80-160 BPM range."
    - "To help Capture MIDI detect a phrase correctly, it is recommended to end playing on the first beat (or "downbeat") of the next bar."
    - "All of your played material will be saved in the clip, and any notes that you played before the detected phrase will appear prior to the clip start marker. This enables you to adjust the start/end or loop markers to set a different loop."
    - One-note case: "resulting in a one, two, four, or eight bar loop."
  - §x.10.2 "Adding Material to an Existing Live Set" (transport running, other clips, or automated tempo): "Capture MIDI will not detect or adjust the song tempo. Instead, Capture MIDI will use the existing tempo to detect a meaningful musical phrase from your played material and create a loop."
- **Help Center** (https://help.ableton.com/hc/en-us/articles/360000776450-Capture-MIDI, undated):
  - "analyzes the average tempo of the captured MIDI";
  - "If playback is already running, or if clips already exist in the set, the tempo does not get adjusted";
  - "Whenever 16384 events are reached, the oldest 1024 events are discarded."
- **MusicTech video** (https://www.youtube.com/watch?v=t-B2aUO1T-c):
  - Title: "Ableton Live Tutorials: Creating Ideas with Capture MIDI". Channel MusicTech, published 2020-09-16. The description names Liam O'Mullane and lists chapters including "Best practice" and "Manually setting the loop brace".
  - **Transcript not reviewed** (the caption fetch returned HTTP 429).
- **Bax-shop blog** (https://www.bax-shop.co.uk/blog/studio-recording/tools-for-discovering-chords-in-ableton-live/): **not reviewed**. The page returned a script-required shell to both WebFetch and curl.
- Third-party, not primary: Sound On Sound "MIDI Capture & Multi-clip Editing In Live" says "Most often you'll get a four-bar loop". That's a demonstration-level observation (search snippet).

## 2. Claim-by-claim audit of the supplied summary

| # | Claim | Verdict | Primary quote / source | Implication for Blocks |
|---|---|---|---|---|
| a | The player plays the next downbeat; the final burst anchors the END; trailing silence is ignored | **Partly documented.** The *recommendation* is documented; "anchors the END" and "trailing silence ignored" are **plausible hypothesis** | "it is recommended to end playing on the first beat (or "downbeat") of the next bar" (Live 11 §17.10.1 = Live 12 §19.10.1) | Test the final attack as a loop-END candidate kept as a tail (done: anchor kind `final-attack-as-next-downbeat`). It is compared against alternatives, never forced. |
| b | Works backwards testing 1/2/4/8-bar spans | **Unsupported internal-algorithm assertion.** 1/2/4/8 bars is documented **only for the one-note case** | "resulting in a one, two, four, or eight bar loop" (one-note note, §x.10.1) | We use 1/2/4/8 as our own candidate set with a mild 4-bar prior. This is OURS. |
| c | IOI / chord-density clustering and earliest-attack fitting | **Unsupported internal-algorithm assertion.** Ableton documents only "analyzes the average tempo" | Help Center | We use IOI histograms (public idea, Dixon 2001) **without** density weighting. Note count must not drive the beat. |
| d | Rolled chords grouped in a tiny window | **Plausible hypothesis** (not documented) | none | Attack-onset grouping relative to local IOIs, with sounding overlap necessary but not sufficient and monotonic stepwise lines excluded (UNVALIDATED values; the former 130/400 ms proposal is superseded). Blocks' 40 ms fails non-overlapping rolls of 60-120 ms; 3412f61's overlap stacks fix overlapping rolls but merge pedalled runs into one stack (handoff §6.3). |
| e | Tempo bounds 80-160 with half/double | **The 80-160 range is documented** (for a new Set). Half/double is **demonstration-level** (Sound On Sound: "if you play eighth notes at 48 bpm you may wind up with quarter notes at 96 bpm") | "will set the tempo in the 80-160 BPM range" | Soft prior only, with half/double kept as alternatives. Don't clamp. |
| f | 16,384-event FIFO buffer | **Documented**, but it is "oldest 1024 discarded" in blocks, not a strict FIFO | Help Center | Don't copy it. Blocks keeps D8 (120 s / 4096 events / 256 KiB). |
| g | Patents and developer interviews | **Unsupported.** None were named, and I found no Ableton Capture patent (ledger A6). The Zya patent below is not Ableton's | — | Ignore as evidence. |
| h | Arithmetic: "2 s chord spacing ⇒ 120 BPM"; "4 chords ⇒ 4 bars" | **False/misleading arithmetic.** 2 s spacing is 120 BPM only if a chord lasts 4 beats; at 2 beats per chord it is 60 BPM, at 8 beats 240. Four chords can be 2, 4 or 8 bars (fixture PH02 has 8 chords in 4 bars) | — | Tempo needs a beats-per-event hypothesis tested jointly with phase and range. |
| i | "Perfect loop" | **No source** proves it. Ableton itself says the user can move the loop markers | §x.10.1 | Keep the alternatives and range handles. |

## 3. Extra leads (exempt reads)

| Lead | Verified facts | Status / licence | Relevance to free-played, unaligned, role-agnostic MIDI |
|---|---|---|---|
| Zya patent **US20180268792A1** (https://patents.google.com/patent/US20180268792A1/en) | "System and method for automatically generating musical output". Assignee Zya Inc. Application US15/986,589, filed 2018-05-22, published 2018-09-20, priority claimed to 2014-08-22. **Claim 1** covers lyrics plus musical input feeding a voice synthesiser. The repetition/boundary material is in the **description**, not claim 1: "identify a sequence representing a series of pitches or pitchclasses, a series of pitch intervals or pitchclass intervals, or a series of inter-onset intervals"; "Notes with higher boundary strengths may be the most likely places that a phrase boundary may occur"; "combined with another algorithm … based on the concepts of Gestalt perception". FIGS. 14-16 are described as "exemplary graphical user interface", **not** MIDI figures as claimed | Google Patents lists **Abandoned** (its own caveat: "not a legal conclusion"). No legal clearance is asserted | Generic repetition plus boundary ideas, aimed at melody. It assumes a melody input and a 4/4 metric-level table. Not Ableton. Its own claims are about vocal generation. |
| Dai, Zhang, Dannenberg, "The Interconnections of Music Structure, Harmony, Melody, Rhythm, and Predictivity", *Music & Science*, 2024, doi:10.1177/20592043241234758 | Crossref abstract: "novel algorithms based on repetition to extract music structure hierarchy from a MIDI data set of popular music". The full text wasn't fetched, so the specific methods Haris listed (pitch-class harmony similarity, timing-tolerant onset comparison, contour DTW, compact description) are **unverified** | **CC BY-NC 4.0** (Crossref licence field) | Repetition-based structure on POP909-style material. Useful as a **supporting repetition feature** for long takes. Not usable for a first take with no repetition. |
| https://github.com/Dsqvival/hierarchical-structure-analysis | Created 2020-10-09, last push 2022-10-05. Files: LICENSE, POP909, README.txt, preprocessing, seg.cpp. The README is for the **earlier** MuMe/CSMC 2021 paper (dai-mume2020.pdf), not the 2024 article | **MIT** (GitHub API licence field) | The README shows **prepared, aligned input**: "melody notes quantized in 16th note", chords as "duration" in beats, one tempo per song. It **assumes beat-aligned bars**, the opposite of our input. Not downloaded or copied. |

**Haris's suggestion** was to combine repetition, beat/bar fit and local boundaries, with resolution only as support, and to keep 2-3 internal candidate cuts. I agree, with an order:
- **Beat/bar fit and local boundaries are primary.**
- **Repetition is a bonus only**, so the first good take never needs repeating.
- Keep 2-3 internal alternatives. Candidate alternatives carry **no new UI commitment**.
- Cost: repetition over a 40 s window is O(bars²) at most, small next to the grid search.
- Ambiguity: repetition favours 1-2-bar motifs over 4-bar phrases (PH09), so its weight must stay small.

## 4. Commit labels used anywhere in my files

- **534279f** (17:03 London): spec v2.1/v2.2 code references and `repro-four-chords-results.txt` (that repro ran the recent-phrase.ts copy that is byte-identical at 534279f and fadfdcf).
- **fdba348** (19:31): `phrase-results.txt` "main-fdba348".
- **497894e** (19:43): historical comparison rows (formerly labelled "main-497894e"; it is **not** current main) and the retest checkpoint.
- **3412f61** (19:50): **current main for this review**; `checkpoints/2026-11-08-baseline-3412f61.md`.
- Deployed bundles **index-DGbe1J8t.js**, **index-CqMoO9xx.js** and **index-CsEdtvjV.js** were **not inspected**.

## 5. Evaluation recommendations

- Add Haris's real event log as a private, non-redistributed fixture once he can share it. Until then, don't claim a reproduction.
- PH01-15 have influenced design discussion: they are now the **regression/development set**, not a holdout. The fresh check is the independent validation set V01-13 (frozen 19:57:01 GMT, sha256 c06e8caa…). Don't tune on it; build a further fresh set before any accuracy claim.
- Report the coverage categories (GOOD / PARTIAL / FINAL_TRAP / WHOLE_TRAP) and period match separately.
