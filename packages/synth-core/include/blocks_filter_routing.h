#ifndef BLOCKS_FILTER_ROUTING_H
#define BLOCKS_FILTER_ROUTING_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
#define BS_FILTER_ROUTING_VERSION 1u
/* Mask bit0(value1)=Osc1, bit1(value2)=Osc2; zero bypasses both, default3 routes both.
 * Route weights are smoothed over a5ms time constant without changing notes.
 * Bypassed sources still pass Sauce and amplitude. With Ladder selected their
 * bypass uses the same linear reconstruction FIR pair as filtered dry; this
 * retains its15.75-sample FIR latency/response even when both sources bypass.
 * State is additive, retained by prepare/reset, separate from tone ABI. */
typedef struct bs_filter_routing_config {uint32_t version,mask;} bs_filter_routing_config;
void bs_default_filter_routing(bs_filter_routing_config *config);
int bs_set_filter_routing(bs_synth *synth,const bs_filter_routing_config *config);
int bs_get_filter_routing(const bs_synth *synth,bs_filter_routing_config *config);
#ifdef __cplusplus
}
#endif
#endif
