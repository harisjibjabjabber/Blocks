#ifndef BLOCKS_CREATIVE_FX_H
#define BLOCKS_CREATIVE_FX_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
#define BS_CREATIVE_FX_VERSION 1u
#define BS_CREATIVE_FX_CAPACITY 16u
typedef enum bs_creative_fx_type {BS_CREATIVE_MOVING_SPACE=0,BS_CREATIVE_IMPACT=1} bs_creative_fx_type;
/* 48bytes. Independent stereo bus processors follow summed voices/FX Sub and
 * precede Harmonics, Width, Delay and Space reverb. Clean Sub bypasses this bus.
 * Moving Space: mix,motion,space,shimmer,pitch,output_db. Impact: mix,tight,
 * click,body,output_db. All normalized fields0..1; pitch-12..12 semitones and
 * output_db-24..12. Other fields retain their validated stored values.
 * Defaults are useful when explicitly adding a block; default rack is empty. */
typedef struct bs_creative_fx_block {
 uint32_t id,type,enabled;
 float mix,motion,space,shimmer,pitch,tight,click,body,output_db;
} bs_creative_fx_block;
typedef struct bs_creative_fx_config {uint32_t version,count;bs_creative_fx_block blocks[BS_CREATIVE_FX_CAPACITY];} bs_creative_fx_config;
void bs_default_creative_fx(bs_creative_fx_config *config);
int bs_default_creative_fx_block(uint32_t type,bs_creative_fx_block *block);
/* Atomic validation, IDs unique/nonzero, no render/configure allocation.
 * Structural edits fade the bus to dry10ms, apply the latest queued topology,
 * then fade in10ms. Retained IDs keep processor memory. Parameter changes
 * smooth within processors. Reordering affects this bus subsequence only;
 * full cross-group routing remains separate work. Panic clears histories. */
int bs_set_creative_fx(bs_synth *synth,const bs_creative_fx_config *config);
int bs_get_creative_fx(const bs_synth *synth,bs_creative_fx_config *config);
#ifdef __cplusplus
}
#endif
#endif
