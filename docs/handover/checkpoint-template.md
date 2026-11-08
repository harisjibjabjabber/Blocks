# Checkpoint template

Copy this at a milestone. Fill the blanks from the repository and from checks that were actually run. Delete nothing that is unknown: write unknown. Do not promote a synthetic result into hardware proof, and do not treat a design picture as a shipped screen.

## Owner

Role or person responsible for this checkpoint. Optional role labels are in [ways-of-working.md](ways-of-working.md). A bot name is not required.

## Scope

What this checkpoint covers, and what it does not. Name the product question in one sentence.

## Current commit

Application code comes from latest `main`. Documentation comes from `handover/status`. Record both SHAs from `git rev-parse` after `git fetch`. Do not copy an old SHA forward without checking.

| Ref | SHA | What it is |
|---|---|---|
| `origin/main` | | App code to reproduce |
| `handover/status` | | Docs only. Not a substitute for `main` |
| Merge-base | | |

If this checkpoint is about Capture, also record the live script URL and the commit it was built from, or write unknown.

## Files

List the paths a reader must open. Mark each as app source, research, design proposal, or evidence. Say which older file is superseded.

## Decisions

What was decided, by whom, and what is still open. If the authority for an earlier decision is not in the repo, write unknown.

## Tests and evidence class

Keep these apart. Name the command or the saved file. Say whether it was rerun for this checkpoint.

| Class | Result | Rerun? |
|---|---|---|
| Synthetic or unit | | |
| Research fixture (tuning, regression, or frozen validation) | | |
| Rendered audio or listening | | |
| Hardware, latency, or device | | |

A user failure outranks a green synthetic suite. Frozen validation is not tuning and is not regression. Keep known fixture defects, including the V10 pedal wording and unscored D01, if this checkpoint touches those fixtures.

## Limitations and open failures

What is still broken, provisional, or not approved. Last-chord Capture stays open until an end-to-end trace of the musician's failure is recorded. Rev 3.3 visual praise is not approval to implement speculative functionality. Main-screen Quantise is open until Haris decides it. Independent device or latency approval has not been recorded.

## Review gates

- Design: look at the storyboard before building new UI. Graphite structure and Paper character, light and dark. A piano roll corrects a miss and does not replace one-action Capture.
- Release: do not ask Haris to refresh or retest without a stronger trace from input to selection, stored range, loop period, and scheduled replay.
- Deploy: a documentation commit on `handover/status` does not publish the site.

## Next executable step

One concrete action, with the repo and the SHA it should start from. If the step is only a suggestion, label it as a recommendation.
