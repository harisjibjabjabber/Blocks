#ifndef BLOCKS_SAUCE_API_H
#define BLOCKS_SAUCE_API_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
#define BS_SAUCE_VERSION 1u
#define BS_SAUCE_CAPACITY 16u
typedef struct bs_synth bs_synth;
typedef enum bs_sauce_type {BS_SAUCE_DRIVE=0,BS_SAUCE_FULLNESS=1} bs_sauce_type;
/*20bytes, five32-bit fields. IDs must be unique/nonzero. Primary binds the
 * existing tone amount/enable parameters; at most one primary of each type.
 * Independent Drive amount1..12; Fullness0..1. Enable is0/1. */
typedef struct bs_sauce_block {uint32_t id,type,primary,enabled;float amount;} bs_sauce_block;
/*328bytes. Empty bypasses this custom rack; the synth keeps its base colour controls. Unused array entries are ignored. */
typedef struct bs_sauce_config {uint32_t version,count;bs_sauce_block blocks[BS_SAUCE_CAPACITY];} bs_sauce_config;
/* Public defaults are empty. Adding blocks is explicit. */
void bs_default_sauce(bs_sauce_config *config);
/* Atomic validation; fixed storage, no allocation. Active voices crossfade5ms.
 * A retarget during a fade queues only the latest config until that fade ends. */
int bs_set_sauce(bs_synth *synth,const bs_sauce_config *config);
/* Returns the latest requested configuration, including a queued retarget. */
int bs_get_sauce(const bs_synth *synth,bs_sauce_config *config);
#ifdef __cplusplus
}
#endif
#endif
