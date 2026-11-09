#ifndef BLOCKS_MODULATION_H
#define BLOCKS_MODULATION_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
#define BS_MODULATION_VERSION 1u
#define BS_MAX_LFOS 4u
#define BS_MAX_LFO_ROUTES 8u
typedef enum bs_lfo_waveform { BS_LFO_SINE=0, BS_LFO_TRIANGLE=1, BS_LFO_SAW=2, BS_LFO_SQUARE=3, BS_LFO_SMOOTH_RANDOM=4 } bs_lfo_waveform;
/* Physical tone values remain saved independently. Depth is bipolar normalized
 * range displacement; the host/core applies the target's linear/log mapping. */
typedef struct bs_lfo_route { uint32_t parameter_id; float depth; } bs_lfo_route;
typedef struct bs_lfo_source {
 uint32_t id,enabled,waveform,synced,division,triplet;
 float rate_hz,intensity;
 uint32_t route_count;
 bs_lfo_route routes[BS_MAX_LFO_ROUTES];
} bs_lfo_source;
typedef struct bs_modulation_config {
 uint32_t version,source_count;
 bs_lfo_source sources[BS_MAX_LFOS];
} bs_modulation_config;
/* Sizes: route8, source100, config408. Unique source IDs preserve phase across
 * edits/reordering. Duplicate target IDs within a source are rejected. Sync
 * division1/2/4/8/16/32/64; triplets only through16. Atomic rejection on invalid
 * config. No NoteOn/panic reset; explicit engine reset resets all LFO clocks. */
void bs_default_modulation(bs_modulation_config *config);
int bs_set_modulation(bs_synth *synth,const bs_modulation_config *config);
int bs_get_modulation(const bs_synth *synth,bs_modulation_config *config);
#ifdef __cplusplus
}
#endif
#endif
