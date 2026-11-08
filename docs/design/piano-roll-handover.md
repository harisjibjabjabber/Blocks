# Piano-roll component: handover supplement (8 Nov 2026, London time)
Supplement to **[HANDOVER.md](HANDOVER.md)**, which is the package handover; read that first. **We implemented and tested nothing.** This is documentation only.

## Links
| File | What it is |
|---|---|
| [piano-roll-correction-brief.md](piano-roll-correction-brief.md) | Rev C.3: component contract, coordinate math, bounded change order, test run matrix |
| [acceptance-criteria.md](acceptance-criteria.md) | Canonical acceptance: AC-ED-01..15, AC-RIB-01..13, Rev 3.5 AC-KEY-01..05, AC-PH-01, AC-ALN-01, AC-EVD-01 |
| [frontend-handover-20261108.md](frontend-handover-20261108.md) | Frontend handover |
| [backend-core-handoff.md](backend-core-handoff.md) | Backend core handoff |

Integration owner: the one existing coding project.

## Brief-only content (not canonical)
- Brief §2: candidate contracts (view transform, working notes vs immutable source, transport snapshot handling, preview/commit/undo), labelled [C]/[FE]/[BE].
- Brief §5: backend deterministic tests D1–D10.
- Brief §6: measurement thresholds.

## Blockers
1. Engine authoritative playback position (AC-PH-01).
2. Engine selected-layer sounding pitches (AC-KEY-05).
3. Audition isolated from the take and the capture buffer (AC-KEY-04). Raise at integration if no existing policy.
4. Real-device touch validation (AC-KEY-04, AC-EVD-01).
Rev 3.5 AC-KEY-04 supersedes older key-column tap-selection behavior; this is not an unresolved blocker.

## Next
- Integration follows brief §3 order, then runs brief §4 and AC-EVD-01 evidence on the deployed build.
