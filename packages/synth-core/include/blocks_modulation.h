#ifndef BLOCKS_MODULATION_H
#define BLOCKS_MODULATION_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
#define BS_MAX_LFOS 4u
#define BS_MAX_LFO_ROUTES 32u
#define BS_MODULATION_V4_VERSION 4u
#define BS_MAX_LFO_POINTS_V4 32u
typedef enum bs_lfo_waveform { BS_LFO_SINE=0, BS_LFO_TRIANGLE=1, BS_LFO_SAW=2, BS_LFO_SQUARE=3, BS_LFO_SMOOTH_RANDOM=4, BS_LFO_CUSTOM=5 } bs_lfo_waveform;
typedef struct bs_lfo_point {float x,y,bend;} bs_lfo_point;
/* Current4280-byte config: stable source IDs,32 points,32 routes/source.
 * target_kind0tone/1Sauceamount/2LFOrate-intensity/3MovingSpace movement.
 * Kind3 uses stable effect ID, parameter0 and signed normalized depth; unknown
 * effect IDs are inert. Contributions sum in source-ID order before DSP bounds.
 * Canonical ID reduction,
 * previous-sample crossmod feedback; clock phase persists on config edits. */
/* Polarity: 0 source-native (LFO bipolar, ENV unipolar), 1 unipolar, 2 bipolar.
 * Conversion precedes source intensity and signed depth. Inactive sources contribute zero. */
enum bs_route_polarity { BS_POLARITY_NATIVE=0, BS_POLARITY_UNIPOLAR=1, BS_POLARITY_BIPOLAR=2 };
typedef struct bs_lfo_route_v4 { uint32_t target_kind,target_id,parameter_id;float depth; uint32_t polarity; } bs_lfo_route_v4;
typedef struct bs_lfo_source_v4 {
 uint32_t id,enabled,waveform,synced,division,triplet;
 float rate_hz,intensity;
 uint32_t route_count;
 bs_lfo_route_v4 routes[BS_MAX_LFO_ROUTES];
 uint32_t retrigger,point_count;
 bs_lfo_point points[BS_MAX_LFO_POINTS_V4];
} bs_lfo_source_v4;
typedef struct bs_modulation_config_v4 {
 uint32_t version,source_count;
 bs_lfo_source_v4 sources[BS_MAX_LFOS];
} bs_modulation_config_v4;
void bs_default_modulation_v4(bs_modulation_config_v4 *config);
int bs_set_modulation_v4(bs_synth *synth,const bs_modulation_config_v4 *config);
int bs_get_modulation_v4(const bs_synth *synth,bs_modulation_config_v4 *config);
/* Phase used at the last rendered sample, [0,1); -1 for null/unknown ID.
 * Disabled sources still advance. Before first render/reset, phase is0. */
double bs_get_modulation_phase(const bs_synth *synth,uint32_t source_id);
/* Actual last-rendered signed waveform times intensity; disabled/unknown0. */
double bs_get_modulation_value(const bs_synth *synth,uint32_t source_id);
/* Continuous target registry. scope0shared bus/control,1per voice. Mapping
 *0linear/1logarithmic. Depth is normalized full-span, summed before bounds.
 * Kind4 fixed namespace; kind5 CreativeFX stable node ID. Unsupported/null
 * entries must not be advertised as drag destinations by a client. */
typedef struct bs_modulation_target_descriptor {
 float minimum,maximum,default_value;uint32_t mapping,scope;
 const char *name,*unit;
} bs_modulation_target_descriptor;
const bs_modulation_target_descriptor *bs_modulation_target_info(uint32_t kind,uint32_t target_id,uint32_t parameter_id);
/* Actual physical control; voice scope reports newest active main voice.
 * Unknown target returns NaN. Unmodulated/no-active voice returns base value. */
double bs_get_modulated_target_value(const bs_synth*,uint32_t kind,uint32_t target_id,uint32_t parameter_id);

#ifdef __cplusplus
}
#endif
#endif
