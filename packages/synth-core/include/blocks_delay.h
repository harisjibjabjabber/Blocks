#ifndef BLOCKS_DELAY_H
#define BLOCKS_DELAY_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
#define BS_DELAY_VERSION 1u
typedef enum bs_delay_mode { BS_DELAY_STEREO=0, BS_DELAY_PINGPONG=1 } bs_delay_mode;
/* Additive40-byte state, separate from the tone patch. Six uint32 fields then
 * four floats. Sync divisions4/8/16/32/64; triplets through16. Global tempo
 *40..240 BPM keeps every supported division inside the prepared2-second line.
 * Stereo repeats stay on their input channel; Pingpong crosses feedback only.
 * Wet0 is exact dry once smoothing settles. Enabled wet0 continues recording;
 * disabling ramps input send and wet to0 while existing tail memory advances.
 * Panic/reset clear old memory in O(1), retaining configuration. No freeze.
 * Time changes crossfade taps over20ms; wet/feedback/mode smooth over5ms.
 * This stage precedes output protection; unprotected feedback can exceed1.
 */
typedef struct bs_delay_config {
 uint32_t version,enabled,mode,synced,division,triplet;
 float time_seconds,feedback,wet,damping_hz;
} bs_delay_config;
void bs_default_delay(bs_delay_config *config);
int bs_set_delay(bs_synth *synth,const bs_delay_config *config);
int bs_get_delay(const bs_synth *synth,bs_delay_config *config);
#ifdef __cplusplus
}
#endif
#endif
