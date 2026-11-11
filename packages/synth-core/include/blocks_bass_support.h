#ifndef BLOCKS_BASS_SUPPORT_H
#define BLOCKS_BASS_SUPPORT_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
typedef struct bs_clock_config {uint32_t version;float bpm;uint32_t beats_per_bar;} bs_clock_config;
/* A shared explicit clock:40..240 BPM,1..16 beats/bar. Clients that do not
 * use the current default120BPM. Note sequencers apply tempo
 * under their existing seam policy; continuous modulators preserve phase. */
void bs_default_clock(bs_clock_config*);
int bs_set_clock(bs_synth*,const bs_clock_config*);
int bs_get_clock(const bs_synth*,bs_clock_config*);
/* One centred voice follows the final note stream. priority0lowest/1last,
 * waveform0sine/1triangle,octave-2..0,routing0Clean/1FX,level0..1.
 * Clean rejoins AFTER main tanh, before common master and final safety clamp.
 * FX traverses Tone/colour/rack and common Width/Delay/output stages. */
typedef struct bs_sub_config {uint32_t version,enabled,waveform;int32_t octave;uint32_t priority,routing;float level;uint32_t reserved;} bs_sub_config;
void bs_default_sub(bs_sub_config*);
int bs_set_sub(bs_synth*,const bs_sub_config*);
int bs_get_sub(const bs_synth*,bs_sub_config*);
/* Current logical Sub note, -1 if silent; one voice independent of main count. */
int bs_get_sub_note(const bs_synth*);
#ifdef __cplusplus
}
#endif
#endif
