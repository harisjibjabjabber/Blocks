#ifndef BLOCKS_REVERB_H
#define BLOCKS_REVERB_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
#define BS_REVERB_VERSION 1u
typedef enum bs_reverb_mode { BS_REVERB_PLATE=0, BS_REVERB_HALL=1, BS_REVERB_SHIMMER=2 } bs_reverb_mode;
/* Original stereo feedback reverberator, not a physical plate/circuit model.
 * 64 bytes: three uint32 followed by thirteen floats. Stored Mix is useful but
 * master defaults Off. Mix is a linear dry/wet crossfade; trim and width affect
 * wet only. Off ramps send/wet down while the tail advances; re-enabling can
 * recover that tail. Panic/reset discard histories without allocating.
 * Prepare may allocate and discards the tail, preserving configuration.
 * Decay is nominal midband RT60: damping, modulation and pitch recirculation
 * change the measured frequency-dependent decay. Shimmer performs real audio
 * pitch shifting; it is not a generated oscillator. Zero semitones is unshifted.
 * Settings changes are smoothed/crossfaded, not guaranteed phase-neutral.
 */
typedef struct bs_reverb_config {
 uint32_t version,enabled,mode;
 float predelay_seconds,decay_seconds,size,diffusion,lowcut_hz,damping_hz;
 float mod_rate_hz,mod_depth,shimmer,wet,output_db,shimmer_semitones,wet_width;
} bs_reverb_config;
void bs_default_reverb(bs_reverb_config *config);
int bs_set_reverb(bs_synth *synth,const bs_reverb_config *config);
int bs_get_reverb(const bs_synth *synth,bs_reverb_config *config);
/* Read-only wet-left display trace, scaled by master gain before protection.
 * 128 chronological samples, one per4 rendered frames. Not analysis audio.
 * Returns128 on success,0 for null arguments/capacity<128. Panic clears it. */
#define BS_REVERB_SCOPE_SAMPLES 128u
uint32_t bs_get_reverb_scope(const bs_synth *synth,float *output,uint32_t capacity);
#ifdef __cplusplus
}
#endif
#endif
