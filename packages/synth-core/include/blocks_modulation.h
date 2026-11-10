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
#define BS_MODULATION_V2_VERSION 2u
#define BS_MAX_LFO_POINTS 16u
typedef enum bs_lfo_waveform { BS_LFO_SINE=0, BS_LFO_TRIANGLE=1, BS_LFO_SAW=2, BS_LFO_SQUARE=3, BS_LFO_SMOOTH_RANDOM=4, BS_LFO_CUSTOM=5 } bs_lfo_waveform;
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
/* Additive v2 API: v1 functions still read/write exactly408 bytes. The v1
 * setter imports built-in/free-running state; its getter rejects Custom, retrigger or nondefault remembered shape
 * state atomically, without writing a lossy/oversized result. */
typedef struct bs_lfo_point { float x,y,bend; } bs_lfo_point;
typedef struct bs_lfo_source_v2 {
 uint32_t id,enabled,waveform,synced,division,triplet;
 float rate_hz,intensity;
 uint32_t route_count;
 bs_lfo_route routes[BS_MAX_LFO_ROUTES];
 uint32_t retrigger,point_count;
 bs_lfo_point points[BS_MAX_LFO_POINTS];
} bs_lfo_source_v2;
typedef struct bs_modulation_config_v2 {
 uint32_t version,source_count;
 bs_lfo_source_v2 sources[BS_MAX_LFOS];
} bs_modulation_config_v2;
/* Point12/source300/config1208 bytes. Source prefix0..99 is the v1 source;
 * retrigger100, point_count104, points108. Config sources begin8.
 *2..16 points, x0=0/xlast=1, minimum x separation1/1024; y/bend in[-1,1].
 * Endpoint y values may differ: wrapping then deliberately jumps to the first.
 * Outgoing segment easing q=t+bend*t*(1-t) has exact endpoints/no overshoot.
 * Shapes persist with built-in waveforms selected; edits preserve ID clocks.
 * Retrigger is whole-instrument: each final accepted NoteOn requests phase0
 * once per sample before evaluation, including generated/Mono-return attacks.
 * Free-running sources, panic and NoteOff do not reset phase. */
void bs_default_modulation_v2(bs_modulation_config_v2 *config);
int bs_set_modulation_v2(bs_synth *synth,const bs_modulation_config_v2 *config);
int bs_get_modulation_v2(const bs_synth *synth,bs_modulation_config_v2 *config);
/* Phase used at the last rendered sample, [0,1); -1 for null/unknown ID.
 * Disabled sources still advance. Before first render/reset, phase is0. */
double bs_get_modulation_phase(const bs_synth *synth,uint32_t source_id);

#ifdef __cplusplus
}
#endif
#endif
