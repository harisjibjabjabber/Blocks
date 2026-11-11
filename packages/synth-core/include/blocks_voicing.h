#ifndef BLOCKS_VOICING_H
#define BLOCKS_VOICING_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
#define BS_MAX_UNISON 7u
#define BS_VOICING_VERSION_V2 2u
/* Current independent per-oscillator state. Count1..7 snapshots at NoteOn;
 * detune0..50ct/spread0..1 smooth live. Fixed C phases and low-detune body guard. */
typedef struct bs_osc_voicing_config {uint32_t count;float detune_cents,spread;} bs_osc_voicing_config;
typedef struct bs_voicing_config_v2 {uint32_t version,reserved;bs_osc_voicing_config oscillators[2];} bs_voicing_config_v2;
void bs_default_voicing_v2(bs_voicing_config_v2 *config);
int bs_set_voicing_v2(bs_synth *synth,const bs_voicing_config_v2 *config);
int bs_get_voicing_v2(const bs_synth *synth,bs_voicing_config_v2 *config);
#ifdef __cplusplus
}
#endif
#endif
