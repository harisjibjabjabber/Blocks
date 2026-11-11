#ifndef BLOCKS_MODULATION_H
#define BLOCKS_MODULATION_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
#define BS_MAX_LFOS 4u
#define BS_MAX_LFO_ROUTES 8u
#define BS_MODULATION_V3_VERSION 3u
#define BS_MAX_LFO_POINTS_V3 32u
typedef enum bs_lfo_waveform { BS_LFO_SINE=0, BS_LFO_TRIANGLE=1, BS_LFO_SAW=2, BS_LFO_SQUARE=3, BS_LFO_SMOOTH_RANDOM=4, BS_LFO_CUSTOM=5 } bs_lfo_waveform;
typedef struct bs_lfo_point {float x,y,bend;} bs_lfo_point;
/* Current2232-byte config: stable source IDs,32 points,8 routes/source.
 * target_kind0tone/1Sauceamount/2LFOrate-intensity/3MovingSpace movement.
 * Kind3 uses stable effect ID, parameter0 and signed normalized depth; unknown
 * effect IDs are inert. Contributions sum in source-ID order before DSP bounds.
 * Canonical ID reduction,
 * previous-sample crossmod feedback; clock phase persists on config edits. */
typedef struct bs_lfo_route_v3 { uint32_t target_kind,target_id,parameter_id;float depth; } bs_lfo_route_v3;
typedef struct bs_lfo_source_v3 {
 uint32_t id,enabled,waveform,synced,division,triplet;
 float rate_hz,intensity;
 uint32_t route_count;
 bs_lfo_route_v3 routes[BS_MAX_LFO_ROUTES];
 uint32_t retrigger,point_count;
 bs_lfo_point points[BS_MAX_LFO_POINTS_V3];
} bs_lfo_source_v3;
typedef struct bs_modulation_config_v3 {
 uint32_t version,source_count;
 bs_lfo_source_v3 sources[BS_MAX_LFOS];
} bs_modulation_config_v3;
void bs_default_modulation_v3(bs_modulation_config_v3 *config);
int bs_set_modulation_v3(bs_synth *synth,const bs_modulation_config_v3 *config);
int bs_get_modulation_v3(const bs_synth *synth,bs_modulation_config_v3 *config);
/* Phase used at the last rendered sample, [0,1); -1 for null/unknown ID.
 * Disabled sources still advance. Before first render/reset, phase is0. */
double bs_get_modulation_phase(const bs_synth *synth,uint32_t source_id);

#ifdef __cplusplus
}
#endif
#endif
