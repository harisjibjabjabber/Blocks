# Blocks — UI state machines (PROPOSED rev 2, mermaid)
Timers and limits are proposals pending measurement.

## Readiness (web; native skips Permission/Audio-gesture states)
```mermaid
stateDiagram-v2
  [*] --> CheckSupport
  CheckSupport --> Unsupported: no Web MIDI / NotSupportedError
  CheckSupport --> Insecure: not https
  CheckSupport --> AudioLocked: supported
  AudioLocked --> AudioRunning: one explicit enable gesture (resume audio)
  AudioRunning --> AudioPaused: suspended / interrupted
  AudioPaused --> AudioRunning: tap "Resume sound"
  AudioRunning --> MidiPrompt: same enable gesture continues to MIDI request (browser prompt varies)
  MidiPrompt --> Denied: NotAllowedError
  MidiPrompt --> NoDevice: granted, 0 inputs
  NoDevice --> ConnectedSilent: port added
  ConnectedSilent --> Receiving: first message
  Receiving --> Disconnected: port removed (synthetic releases, kept apart from raw)
  Disconnected --> ConnectedSilent: port re-added
  Denied --> MidiPrompt: user re-allows in site settings + Try again
  Unsupported --> TouchOnly
  NoDevice --> TouchOnly: "Use on-screen keys"
```

## Capture lifecycle (rev 2 — lead decisions A1, A2, A4, A6)
```mermaid
stateDiagram-v2
  [*] --> Listening
  Listening --> Listening: events appended (age eviction past ~120 s is normal)
  Listening --> Overloaded: event/byte cap hit
  Overloaded --> Listening: gap recorded + flagged
  Listening --> DeliveryUncertain: tab hidden / app background
  DeliveryUncertain --> Listening: foreground again (gap flagged if any)
  Listening --> NothingToCapture: Capture, empty history
  NothingToCapture --> Listening
  Listening --> SlotsFull: Capture, no empty layer
  SlotsFull --> Listening: Cancel
  SlotsFull --> Selecting: explicit choice (new / replace / take only)
  Listening --> Inferring: Capture, no sketch tempo yet
  Listening --> Selecting: Capture, tempo exists (locked)
  Inferring --> Reviewing: pulse found (auto-loop)
  Inferring --> NoPulse: no steady pulse
  NoPulse --> Reviewing: keep free-time loop / Set BPM
  Selecting --> QueuedJoin: bounded history already played; synthetic releases for held notes
  QueuedJoin --> Reviewing: next loop boundary
  Reviewing --> Reviewing: length / beat one / half-double-manual / original take
  Reviewing --> Kept: Keep / dismiss / play on / Capture again
  Reviewing --> Discarded: Discard
  Discarded --> Kept: Undo
  Kept --> Listening
  Discarded --> Listening
```

## Transport
```mermaid
stateDiagram-v2
  [*] --> Stopped
  Stopped --> Looping: Play / first Capture (auto-loop default)
  Stopped --> Stopped: first Capture with "Stay silent" set
  Looping --> Stopped: Stop
  Looping --> Looping: layer joins at boundary
  Looping --> OriginalTake: Hear original
  OriginalTake --> Looping: Hear loop / end of take
```

## Piano-roll pointer
```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Pending: 1 finger down
  Pending --> Tap: up within slop & < 500 ms
  Pending --> LongPress: 500 ms still
  Pending --> Dragging: moved > 8dp (move / resize / marquee / draw / range by tool+target)
  Pending --> Navigating: 2nd finger
  Dragging --> Navigating: 2nd finger (revert edit)
  Dragging --> Committed: finger up (1 undo step)
  Tap --> Picker: 2 candidates within 8dp
  Picker --> Idle: choose / dismiss
  Navigating --> Idle: all fingers up
  Committed --> Idle
  Tap --> Idle
  LongPress --> Idle
```

## Save / recovery
```mermaid
stateDiagram-v2
  [*] --> Saved
  Saved --> Dirty: edit committed
  Dirty --> Saving: 2 s debounce / background
  Saving --> Saved: ok
  Saving --> SaveFailed: error
  SaveFailed --> Saving: Retry
  SaveFailed --> Exporting: Export now
  [*] --> RecoveryOffer: relaunch after crash with newer journal
  RecoveryOffer --> Saved: Open recovered / Open last saved (other kept as version)
```

## Take history view: follow / pan / range (rev 3.2, PROPOSED)
```mermaid
stateDiagram-v2
  [*] --> Following
  Following --> Browsing: pan / pinch / overview drag
  Following --> HandleDrag: touch in ⟦ or ⟧ zone
  Browsing --> HandleDrag: touch in handle zone
  Browsing --> Following: Back to live / L / after Capture
  HandleDrag --> EdgeScroll: finger within 32 dp of edge
  EdgeScroll --> HandleDrag: finger leaves edge zone
  HandleDrag --> Browsing: finger up (range committed, 1 undo step)
  HandleDrag --> Browsing: 2nd finger (drag cancelled, range reverted)
  state HandleDrag {
    [*] --> Snapped
    Snapped --> Fine: finger slides up / Ctrl-Cmd held
    Fine --> Snapped: back down / released
  }
```

## Capture range proposal (rev 3.2)
```mermaid
stateDiagram-v2
  [*] --> AutoProposal: engine picks phrase (may include pickup)
  AutoProposal --> Captured: Capture (one action, no handles)
  AutoProposal --> UserRange: drag ⟦ or ⟧ (length changes, other end fixed)
  UserRange --> UserRange: further drags (each one undo step)
  UserRange --> AutoProposal: Undo to start
  UserRange --> Captured: Capture
  Captured --> BoundaryEdit: Boundaries mode drag (length changes, non-destructive)
  Captured --> PhaseSlide: Slide mode (length kept, beat one shifts)
  BoundaryEdit --> Captured: commit / Undo
  PhaseSlide --> Captured: commit / Undo
  Captured --> Edit: Edit tool (cut/delete/move notes, destructive, undoable)
  Edit --> Captured: Done
```
Free time: AutoProposal and UserRange snap to note onsets only and never create bars. Held notes across the end are clipped for playback only (synthetic release, raw kept); pickups wrap to the beat before each repeat (PROPOSED behaviour, not an engine contract; "first pass only" is open, spec OQ-1).

## Appearance (rev 3.2)
```mermaid
stateDiagram-v2
  [*] --> System: first run (default)
  System --> Light: choose Light
  System --> Dark: choose Dark
  Light --> System: choose System
  Dark --> System: choose System
  Light --> Dark
  Dark --> Light
  note right of System: follows OS/browser live; every change re-themes instantly without touching audio, transport or MIDI; choice persisted on device
```
