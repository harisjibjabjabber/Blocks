# Take ribbon — implementation contract (rev 3.4, PROPOSED)
Date: 8 Nov 2026. For the existing Blocks coding project. **Design contract only; this package does not touch the code repo.** Every number below is **provisional** until device testing (spec OQ-3). Frames: `hifi/hybrid/{dark,light}/28a…28d-ribbon-*.png`, `fold-28-ribbon.png`, `desktop-28-ribbon.png`, `ribbon-overview.png`. Generator: `hifi/src/ribbon.py`.

## 0. Baseline: what UI 9b5f1ed shows vs what changes
Source: Haris's screenshot `/workspace/blocks-user-ribbon-review-20261108.png` (desktop browser, dark) plus the lead's note. Nothing more is claimed.

| Topic | 9b5f1ed (as seen / as reported) | Rev 3.4 contract |
|---|---|---|
| Range recovery | Reported by lead: real range recovery from history. Screenshot text: "Captured a recent phrase into layer-1 … Raw notes were not moved." | **Keep.** Raw notes never move (§7). |
| Undo | Reported by lead; not visible in the screenshot | **Keep**, as one step per boundary edit (§7). |
| Light/dark | Seen: Dark / Light / System buttons | **Keep** (Settings → Appearance in the design, rev 3.2) |
| Ruler | Seen: none | **Change:** three-mode ruler (§3) |
| Handles | Seen: a large filled "End" button over the notes; no Start button is visible in the capture, and from the screenshot alone we can't tell whether it is hidden, overlapping or off-view | **Change:** 1.5–2 dp lines + 13 dp ruler grips + invisible hit zones (§1–2) |
| Viewport | Seen: the whole retained history ("Buffer · 90.6s kept · 118 events") across the full width; the captured phrase squeezed into roughly the right-hand tenth | **Change:** focus the phrase + 10 % padding; history in a minimap / ‹ Earlier (§4) |
| Tempo | Seen: "Tempo 40 proposed" | **Change:** show proposed tempo as a dashed/italic ruler + tempo chip, never as a confirmed grid (§3) |
| Silent tail, tight handles, audition on release | Not visible in the screenshot | **New** (§5–6) |

## 1. Geometry (dp on touch, px on desktop; provisional)
| Item | Value |
|---|---|
| Boundary line | 1.5 dp idle, 2 dp while dragged/focused; colour = text token (not accent; accent stays playhead/Capture). Full height from ruler top to note-area bottom. |
| Grip | 13 dp right-angle triangle at the **top of the ruler**, pointing into the range (start ◣ on the inside-right of the start line, end ◢ on the inside-left). Grows to 16 dp while dragged. Never drawn over the note area. |
| Touch hit zone | **≥ 48 dp wide** centred on the line, from ruler top to note-area bottom, plus a 48 × 48 dp zone around each grip. **Invisible**: no fill, no outline; it never changes how notes render. |
| Mouse hit zone | ±8 px around the line, plus the grip; cursor `ew-resize` (↔) on hover; tooltip "End · bar 5.1 · drag, or ] then ← →". |
| Minimum visual gap | When the two lines are < 24 dp apart, grips **splay outward** (start grip moves left of its line, end grip right of its line) and **stack** (end grip 13 dp lower), so both stay visible. Lines may be as close as 1 px but are always both drawn. |
| Ribbon rows (phone) | Header 34 · minimap 26 · ruler 26 · notes (rest) · footer readout 50. |
| Minimap | 26 dp tall strip; whole retained history; viewport frame 1.5 dp; captured range tinted (text at 18 %). Whole strip is one 48 dp-tall target row (strip + gap). |
| ‹ Earlier control | 58 × 28 dp visible, 48 dp target, left of the minimap. |
| Out-of-range dim | Overlay well colour at 40 % (dark) / 32 % (light), so dimmed notes stay ≥ 3:1 (`hifi/contrast-rev33.tsv`). Never hide out-of-range notes. |

## 2. Hit testing and gesture precedence (touch-start decides; provisional thresholds)
1. On pointer-down, test in this order: **grip zones → line hit zones → picker (if open) → minimap / ‹ Earlier → ribbon pan**. The first hit owns the gesture until pointer-up.
2. **Overlap rule:** if the touch is inside both handles' zones, the handle whose **line is nearest** to the touch x wins. If the two distances are within **8 dp** of each other (a tie), or the user long-presses (**500 ms**) in the overlap, show the **Start / End picker** (two 48 dp buttons); the next tap chooses the handle, and then a drag or arrow keys move it.
3. **Slop:** a handle drag starts after **8 dp** of movement; below that a tap on a handle only focuses it (keyboard/screen-reader focus, readout shows its position). A pan starts after **10 dp** horizontal movement outside handle zones.
4. **Two fingers** anywhere = pinch-zoom / pan (never a handle). A second finger during a handle drag **cancels and reverts** that drag.
5. Vertical movement > 40 dp up during a handle drag = **no snap** for that drag (desktop: Ctrl/Cmd).
6. **Edge auto-scroll:** while dragging a handle within **32 dp** of the ribbon edge, the view scrolls at speed ∝ depth (max ≈ 1 view-width/s), into earlier history if needed.
7. Notes on Play are never edited by any ribbon gesture. A tap on a note does nothing; long-press opens Edit (rev 3.3).

## 3. Ruler formatting
| Grid state | Ruler | Labels |
|---|---|---|
| **Established** (tempo set or confirmed) | Solid ticks; bar ticks 16 dp, beat ticks 8 dp | Bar numbers bold mono ("1", "2" …); beats ".2 .3 .4" when ≥ 14 dp per beat; bars before bar 1 are "−1", "−2" (no bar 0) |
| **Proposed** (inferred, unconfirmed) | **Dashed** ticks | Bar numbers in **italic serif**; header chip "~92 BPM? · tap to set" (dashed border, italic). Tapping the chip opens tempo confirm. Never presents a proposed grid as fact. |
| **Free time** (no pulse) | Seconds ticks every 1 s, labels every 2 s ("0 s", "2 s" …); at > 30 s span labels every 10 s | No bars or beats drawn or invented; chip "free time · seconds" |
Label density: never closer than 28 dp between labels; drop beat labels first, then every other bar label.

## 4. Viewport framing and follow
- **Default frame** (after a capture proposal or capture): `view = [s − 0.1·L, e + 0.1·L]` where `[s, e]` is the proposed/captured range and `L = e − s`.
- **Zoom clamp:** grid: min span **2 bars**, max span **16 bars**; free time: min **4 s**, max **40 s**. If `L` exceeds the max, frame `[e − max, e + 0.1·max]` (end-anchored) and show the start via the minimap.
- **Whole history is never fitted** into the ribbon; it lives only in the minimap.
- **Auto-follow rule:** while no handle has been touched and the user hasn't panned, the frame tracks the *proposed* range; while playing past the frame, the view keeps the live edge at 90 % width. Pan, pinch, handle drag or ‹ Earlier **pause** following and show **Refocus ›**. Refocus (or `F`) re-applies the default frame. A new Capture re-applies it.
- **Earlier:** ‹ Earlier pans one view-width back per tap (announces "Showing 0:10 to 0:21 before now"); dragging the minimap viewport pans; dragging left on the ribbon pans. Showing earlier history never changes the range.

## 5. Edge cases
- **Tight / overlapping handles:** §1 minimum visual gap, §2 overlap rule and picker. The minimum range is one note onset to the next or **1/16 note** (free time: **0.1 s**); dragging past the other handle stops at that minimum (handles never swap).
- **Silent loop tail:** if the range extends ≥ **1 beat** (free: **1 s**) past the last note-off, hatch and dim that region, label "silent tail · 2.3 s", and offer **"Trim silence?" / "Keep"**. Never trim automatically; Trim is one undo step.
- **Pickups and held notes:** as rev 3.2 (§0b, OQ-1 open).
- **Short sessions / no history:** minimap and ‹ Earlier are hidden until there is history outside the frame.

## 6. Audition
While dragging, the loop keeps playing the **previous** range (no stutter). On release, the new range **restarts from the start line** (from the next downbeat if a grid is established, immediately in free time). The footer says "▶ on release: plays from the start line" during the drag.

## 7. Undo and non-destructiveness
- Each committed boundary edit (drag release, picker + move, keyboard nudge burst within 1 s, Trim silence) = **one undo step**: "Undo range: 6 bars → 4 bars". The undo toast shows for ≥ 6 s and ↶ is always available.
- Boundaries are metadata. **No raw event's time, pitch, velocity or duration changes**; a held note across the end is clipped for playback only.

## 8. Accessibility
- Each line is a `slider` ("Loop start", "Loop end"), value text "bar 1 beat 1, 4 bars, end fixed" (free: "0.0 seconds, length 12.1 seconds").
- Keys: `[` / `]` focus start/end; ← → by onset; Alt by beat; Shift by bar; Ctrl/Cmd+Z undo; `F` refocus; `E` earlier; Space audition.
- Screen-reader actions on each slider: "Move to previous onset / next onset / previous bar / next bar", "Snap off". ‹ Earlier is a button ("Show earlier history"); the minimap is a slider ("Ribbon view position").
- Live region (polite, ≤ 4 per second while dragging): "Start bar −2.1, 6 bars".
- Non-colour cues: grips have shape and direction; proposed ruler = dashed + italic + "?" chip; dim + hatch for the silent tail; the picker uses text labels.
- Contrast: lines, grips and labels ≥ 3:1 / 4.5:1; dimmed notes ≥ 3:1 (`hifi/contrast-rev33.tsv`, rev 3.4 rows).

## 9. States
`Focused` (default frame, following the proposal) → `Panned` (pan / Earlier / minimap; Refocus shown) → `HandleArmed` (pointer-down in a zone, < 8 dp) → `Dragging(start|end)` (follow paused, auto-scroll at edges, loupe) → `Committed` (audition from start, Undo toast) → `Focused`. `Picker` (tie or long-press in overlap) → `HandleArmed`. `SilentTail` is an overlay state on any of them. `Proposed` / `Established` / `Free` ruler is orthogonal.

## 10. Acceptance criteria
| ID | Criterion | Check |
|---|---|---|
| AC-RIB-01 | Boundary lines are ≤ 2 dp wide; grips are ≤ 16 dp and sit inside the ruler band; no handle element paints over the note area beyond its 2 dp line (screenshot diff against a notes-only render). | L/A |
| AC-RIB-02 | Each handle accepts touches anywhere in a ≥ 48 dp-wide zone (and 48 × 48 dp around the grip); the zone is invisible. | A/M |
| AC-RIB-03 | Hit-test order is grip → line → picker → minimap/Earlier → pan; a touch in a handle zone never pans; pan starts after 10 dp outside zones; handle drag after 8 dp. | A |
| AC-RIB-04 | With lines < 24 dp apart, both grips stay fully visible (splayed and stacked); nearest line wins; a tie within 8 dp or a 500 ms long-press shows the Start/End picker; handles never swap and stop at the minimum range. | A/U |
| AC-RIB-05 | The ruler shows bars + beats when the grid is established, dashed ticks + italic labels + "?" chip when only proposed, and seconds with no bars in free time; labels are never closer than 28 dp. | L |
| AC-RIB-06 | After a capture proposal the view frames the range + 10 % each side within the zoom clamp (2–16 bars / 4–40 s); the full history is never fitted to the ribbon width. With 90 s of history and a 4-bar phrase on a 390 dp phone, the phrase spans ≥ 75 % of the ribbon width. | A |
| AC-RIB-07 | Earlier history is reachable by ‹ Earlier, the minimap and left pan; each pauses follow and shows Refocus; Refocus restores the default frame. | A/U |
| AC-RIB-08 | Dragging a handle within 32 dp of the edge auto-scrolls; the start handle can reach any retained history in one continuous drag. | M |
| AC-RIB-09 | On release the new range plays from its start line (next downbeat if grid established); playback of the previous range continues uninterrupted during the drag. | M |
| AC-RIB-10 | Every committed boundary edit is one undo step; Undo restores the exact previous range; raw events are byte-identical before and after any number of boundary edits and Trim silence. | A |
| AC-RIB-11 | A silent tail ≥ 1 beat (free: ≥ 1 s) is dimmed + hatched and labelled; "Trim silence?" never applies without a tap; Trim is undoable. | A/L |
| AC-RIB-12 | Screen reader: both lines are sliders with value text; onset/beat/bar actions and Earlier/Refocus are reachable; keyboard map in §8 works on desktop. | SR/K |
| AC-RIB-13 | Dimmed out-of-range notes ≥ 3:1 against the ribbon background in both themes; lines, grips and ruler labels meet 3:1 / 4.5:1. | A |
