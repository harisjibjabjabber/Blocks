#ifndef BLOCKS_OUTPUT_H
#define BLOCKS_OUTPUT_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
/* Global master gain precedes stereo-linked protection. When gain reduction is
 * inactive the output is an exact delayed copy, with no waveshaping. Hot peaks
 * engage attenuation at a .98 sample ceiling, followed by recovery. Gain
 * reduction uses ~1ms lookahead and 80ms recovery. This is sample-peak
 * protection, NOT a certified true-peak limiter. Meter peaks decay over300ms.
 * Latency includes the24-sample Suite alignment plus rate-dependent output
 * lookahead; it excludes oscillator/filter frequency-dependent group delay. */
typedef struct bs_output_meters {float input_peak,output_peak,gain_reduction_db;} bs_output_meters;
uint32_t bs_output_latency(const bs_synth *synth);
int bs_get_output_meters(const bs_synth *synth,bs_output_meters *meters);
#ifdef __cplusplus
}
#endif
#endif
