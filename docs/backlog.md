# Backlog

Not built. The proposed UI spec's later milestones stay later: a touch piano roll, autosave of the ribbon, export, a fixed four-layer layout, and full controller learn. That proposal was not user-tested.

The first slice is one grid and one loop. A second layer is only a new capture, not a four-slot mixer.

## Layers

Four layers, including drums. The drum proposal, if it is ever built, is the 12-slot electronic FreePats subset `blocks.drums.electro.v1` described in the contracts. It is not an acoustic jazz kit. Bass and pad stay the procedural proposals `blocks.bass.pluck.v1` and `blocks.pad.soft.v1` until someone actually implements them.

## Editing

A touch piano roll. Optional quantise already exists as a derived overlay with strength 0 by default. A roll would be a different editor and is not on this screen.

## Persistence

The current slice writes the project JSON when a phrase is captured or the sustain controller is learned. It does not autosave the rolling history. Autosave of that buffer, crash recovery, and a file the player can name are later.

## Files

MIDI parts and WAV stems rendered from the same preserved events and the same preset version. No native Ableton export. No claim that a stem already exists.

## Explicitly not planned

Accounts, cloud sync, plugin hosting, mastering, and a marketplace. An iOS build. Shipping jRhodes3d or any of the held libraries without a new decision. A public release of this slice.
