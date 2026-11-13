#ifndef BLOCKS_BUS_ORDER_H
#define BLOCKS_BUS_ORDER_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
enum { BS_BUS_ORDER_VERSION=1, BS_BUS_CREATIVE=0, BS_BUS_HARMONICS=1, BS_BUS_SPACE=2 };
/* A permutation of Creative FX, Harmonics, and Space (Width/Delay/Reverb).
 * Tone, per-voice Fullness and note processors remain upstream. Clean Sub
 * bypasses these groups. Live changes fade the main bus out for 5 ms, switch
 * at zero, then fade in for 5 ms. Histories keep running and are not cleared;
 * existing tails enter the new downstream order. Latency remains constant. */
typedef struct bs_bus_order_config {uint32_t version;uint32_t order[3];} bs_bus_order_config;
void bs_default_bus_order(bs_bus_order_config *config);
int bs_set_bus_order(bs_synth *synth,const bs_bus_order_config *config);
int bs_get_bus_order(const bs_synth *synth,bs_bus_order_config *config);
#ifdef __cplusplus
}
#endif
#endif
