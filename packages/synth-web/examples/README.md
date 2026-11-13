# Studio audition patches

Open **Patch → Import** in the standalone instrument and select either JSON file. Export your current patch first if you want to keep it. These are audition starting points, not loudness-matched references or listening-approved factory presets.

- **studio-warm-bass.json** — Studio saw/triangle blend, a restrained Ladder filter envelope, and Amp colour. Try the lower keyboard octaves. One unison voice; modest pitch drift and attack settling.
- **studio-animated-pluck.json** — Studio saw/square blend, short amplitude and filter envelopes, two lightly detuned voices, and Clip colour. A synced sine LFO gently moves cutoff.

Both use 18% output gain, additional negative Harmonics output trim, and disabled legacy Drive/Fullness/Pitch Drop. Delay is off. Neither uses sustained pitch drift above 3.2 cents or attack settling above 6.4 cents; the pluck's unison detune is 4 cents. Global tempos are saved with each patch.

Filter movement is an explicit Env 2 → Filter A assignment in Matrix; octave/fine tuning, all three envelopes, both filters and four LFOs are stored. Harmonics **Dynamics** shapes attacks/body using audio-domain compression and expansion. **Mix 0%** retains the enabled processor's aligned filtering; use the block's power switch for bypass. Ladder and Harmonics are original processors, not claims of a particular hardware or Softube model. Their audible result may change as the experimental DSP is refined; the JSON retains all explicit control settings.
