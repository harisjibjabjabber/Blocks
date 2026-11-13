#ifndef BLOCKS_FILTER_BANK_H
#define BLOCKS_FILTER_BANK_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
/* Two parallel filters. Model0Soft/1LP12/2Ladder. Maskbits1Osc1/2Osc2.
 * Each oscillator splits equally between its enabled selected filters; no
 * selection bypasses both. Thus selecting both does not double dry level.
 * A aliases existing Tone/sound/routing controls; B defaults disabled.
 * cutoff20..20000Hz,resonance/mix0..1,drive1..12. Reserved fields must0. */
typedef struct bs_filter_entry {uint32_t enabled,model,mask;float cutoff,resonance,mix,drive;uint32_t reserved;} bs_filter_entry;
typedef struct bs_filter_bank_config {uint32_t version,reserved;bs_filter_entry filters[2];} bs_filter_bank_config;
void bs_default_filter_bank(bs_filter_bank_config*);
int bs_set_filter_bank(bs_synth*,const bs_filter_bank_config*);
int bs_get_filter_bank(const bs_synth*,bs_filter_bank_config*);
#ifdef __cplusplus
}
#endif
#endif
