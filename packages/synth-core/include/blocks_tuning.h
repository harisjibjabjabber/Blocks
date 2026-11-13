#ifndef BLOCKS_TUNING_H
#define BLOCKS_TUNING_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
typedef struct bs_oscillator_tuning {int32_t octave;float fine_cents;} bs_oscillator_tuning;
/*28bytes, version1. Osc1/Osc2/Sub order. Octave-3..3, fine-100..100cents.
 * Sub octave aliases bs_sub_config.octave; it is not applied twice.
 * Main defaults0oct/0ct; Sub default-1oct/0ct. Tuning smooths on held notes. */
typedef struct bs_tuning_config {uint32_t version;bs_oscillator_tuning oscillators[3];} bs_tuning_config;
void bs_default_tuning(bs_tuning_config*);
int bs_set_tuning(bs_synth*,const bs_tuning_config*);
int bs_get_tuning(const bs_synth*,bs_tuning_config*);
#ifdef __cplusplus
}
#endif
#endif
