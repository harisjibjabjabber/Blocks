#ifndef BLOCKS_SOUND_API_H
#define BLOCKS_SOUND_API_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
#define BS_SOUND_VERSION 1u
typedef struct bs_synth bs_synth;
typedef enum bs_source_model {BS_SOURCE_LEGACY=0,BS_SOURCE_STUDIO=1} bs_source_model;
typedef enum bs_filter_model {BS_FILTER_EXISTING=0,BS_FILTER_LADDER=1} bs_filter_model;
/* Additive 16-byte state; tone ABI7/44 is unchanged. C defaults retain the
 * original signal path. Studio changes source generation only. Ladder is an
 * original nonlinear 24dB/oct model, not a calibrated hardware emulation.
 * Its matched dry/wet path has15.75 samples FIR delay at steady state. Source transitions
 * take5ms; filter model transitions10ms. No voice or note queue is reset. */
typedef struct bs_sound_config {uint32_t version,oscillator,filter_model;float filter_drive;} bs_sound_config;
void bs_default_sound(bs_sound_config *config);
int bs_set_sound(bs_synth *synth,const bs_sound_config *config);
int bs_get_sound(const bs_synth *synth,bs_sound_config *config);
#ifdef __cplusplus
}
#endif
#endif
