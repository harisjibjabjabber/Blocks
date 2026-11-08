# STAGED / DRAFT: harmony and role analysis (paused 8 Nov 2026, 19:37 London; not polished, not reviewed)

> Paused by a priority change to core phrase capture. Everything here is an unreviewed draft. All results are SYNTHETIC with provisional labels and are not accuracy claims.

**Hard rules (from Haris's requirement):**
- Outputs are ranked hypotheses, never truth. The sounding pitch set is not the chord, and the lowest note is not the root.
- Analysis runs async after capture. It never blocks Capture or the loop.
- No forms and no confidence percentages. Use ranked alternatives, plain reasons and abstention.
- Labels are optional. Current UI chord labels are mockups.
- Harmony may inform ranking only as a later staged option.

**Schema sketch:**
- Raw data is immutable.
- `HarmonyAnnotation{ analyzer{id,version}, inputLayers[], rawHash, context{key?,tempo?,gridVersion?}, spans[{startTick,endTick, alternatives[{label(Harte), rootless, reasons[]}], abstain{reason,text}|null, flags[], evidence[]}], roles[{noteId, role: melody|bass|comp|ambiguous}] }`.
- `UserCorrection{targetAnnotation, span, label|role, at}` is stored separately and overrides without mutating.
- An annotation is invalidated when rawHash, inputLayers, analyzer version or context change.

**Stages:**
- Stage 0: store only, no labels.
- Stage 1: deterministic. Pressed-key plus pedal segmentation, rolled-onset clustering, jazz templates, rootless readings as alternatives, register/skyline roles, abstention.
- Stage 2: context (key, ii-V, HMM/Viterbi).
- Later: learned models.

**Artefacts:**
- `fixtures/generate-harmony.mjs` produces `fixtures/data-harmony/{tuning,holdout}` (10 tuning, 5 holdout). Harte labels were validated with mir_eval.
- `fixtures/evaluate-harmony.mjs` is the Stage-1 reference, frozen at sha256 prefix c0c218202ab0da62 before one holdout run.
- `fixtures/score-harmony-mireval.py` uses mir_eval 0.8.2, MIT.
- Results are in `evaluation-harmony-results.txt/json`.
- Tuning (in-sample): truth in top-3 25/29, acceptable label in top-3 26/29, abstention appropriate 30/30, roles 123/127.
- Holdout: truth in top-3 10/11, acceptable 11/11, abstention 11/11, roles 54/56. Holdout is structurally close to tuning (same generator), so these numbers are optimistic.
- mir_eval top-1 root is about 0.63. That is low by design: literal readings rank above rootless ones.

**Licences verified (8 Nov 2026):**

| Licence | Sources |
|---|---|
| Permissive | music21 BSD-3; mir_eval MIT; Tonal MIT; AugmentedNet MIT; partitura Apache-2.0; POP909 MIT; iRealPro corpus (Zenodo 3546040) CC BY 4.0; madmom code BSD |
| Evaluation only / non-commercial | Jazz Harmony Treebank CC BY-NC-SA 4.0; JAAH CC BY-NC-SA 4.0; PiJAMA CC BY-NC; madmom models CC BY-NC-SA |
| Share-alike | Weimar Jazz Database ODbL |
| Conflict | FiloBass: site says restricted, Zenodo says CC BY. Don't use it until clarified. |

Open decisions were added to `capture-spec.md` §10, items 7-14.
