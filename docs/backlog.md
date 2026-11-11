# Backlog

## Synth-first product direction - 9 November 2026

The user has approved an interactive design study, not a new synth implementation. The current synth-first scope, expandable panel architecture and future movement recording are tracked in [Synth product plan](synth-product-plan.md). This dated direction supplements the historical first-slice backlog below; those older descriptions are not a current implementation inventory.

- Synth first; sampler and higher-quality sampled instruments later.
- Touch-first phone/Fold and desktop layouts; direct ADSR point/curve editing with precision controls hidden by default.
- Voicing distinguishes simultaneous notes (polyphony) from stacked copies per note (unison).
- **Sauce** is the working name for a collection of small, useful sound recipes. Pitch Drop is the initial example: Amount and Fall Time drive a note-triggered pitch envelope. Recipes reuse shared modulation and DSP rather than each becoming a separate synth implementation.
- Future: record hand movement of any eligible synth/effect control, show the resulting editable curve on a bars/beats grid, draw and bend curves, and use synced/free LFOs and custom repeating shapes. Keep this separate from raw MIDI note capture and explicit note recording. Save these capabilities for a later stage, but reserve stable parameter IDs and timing/scope metadata now.
- Effects, modulation and recipe collections must expand without adding an endless row of top-level tabs. Details and stage gates are in the linked plan.

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
