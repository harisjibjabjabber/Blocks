#ifndef BLOCKS_NOTES_API_H
#define BLOCKS_NOTES_API_H
#include "blocks_synth.h"
#ifdef __cplusplus
extern "C" {
#endif
#define BS_NOTES_VERSION 1u
#define BS_NOTES_CAPACITY 16u
typedef enum bs_note_block_type {BS_NOTE_ARP=0,BS_NOTE_STRUM=1,BS_NOTE_DROP=2} bs_note_block_type;
/*76bytes: four32-bit fields,48-byte performance config, three floats.
 * Generator blocks use local perf with mono0 and mode matching type.
 * Drop blocks may bind existing primary Pitch Drop controls (max one primary).
 * Independent Drop amount0..2400cents,time.001..4seconds,bend-2..2. */
typedef struct bs_note_block {uint32_t id,type,primary,enabled;bs_performance_config perf;float drop_amount,drop_time,drop_bend;} bs_note_block;
typedef struct bs_notes_config {uint32_t version,count;bs_note_block blocks[BS_NOTES_CAPACITY];} bs_notes_config;
/* Empty defaults pass notes through. Enabled generators are cascaded in order;
 * Drop recipes are additive per-note snapshots, separate from the audio rack. */
void bs_default_notes(bs_notes_config *config);
int bs_set_notes(bs_synth *synth,const bs_notes_config *config);
int bs_get_notes(const bs_synth *synth,bs_notes_config *config);
uint32_t bs_notes_pending_mask(const bs_synth *synth);
#ifdef __cplusplus
}
#endif
#endif
