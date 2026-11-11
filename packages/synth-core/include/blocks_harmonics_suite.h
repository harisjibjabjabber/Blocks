#ifndef BLOCKS_HARMONICS_SUITE_API_H
#define BLOCKS_HARMONICS_SUITE_API_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
#define BS_HARMONICS_SUITE_VERSION 2u
#define BS_HARMONICS_SUITE_LATENCY 24u
typedef struct bs_synth bs_synth;
typedef struct bs_suite_ott_band {float threshold_db,gain_db,up,down;} bs_suite_ott_band;
typedef struct bs_harmonics_suite_config {
 uint32_t version,enabled,comp_enabled,colour_enabled,colour_style,crush_enabled,ott_enabled,reserved;
 float drive_db,tone,dynamics,mix,output_db;
 float comp_threshold_db,comp_ratio,comp_attack_ms,comp_release_ms,comp_knee_db,comp_makeup_db;
 float crush_amount,crush_recovery,crush_crunch_db;
 float ott_amount,ott_time,ott_up,ott_down;
 float colour_mix;
 uint32_t colour2_enabled,colour2_style;
 float colour2_drive_db,colour2_tone,colour2_mix;
 float ott_low_hz,ott_high_hz;
 bs_suite_ott_band bands[3];
 uint32_t comp_auto_makeup;
 float colour_output_db,colour2_output_db,crush_output_db,ott_output_db;
} bs_harmonics_suite_config;
typedef struct bs_harmonics_suite_meters {
 float input_peak,output_peak,comp_reduction_db,crush_reduction_db;
 float ott_input_db[3],ott_gain_db[3];
 float dynamics_gain_db;
} bs_harmonics_suite_meters;
void bs_default_harmonics_suite(bs_harmonics_suite_config*);
int bs_set_harmonics_suite(bs_synth*,const bs_harmonics_suite_config*);
int bs_get_harmonics_suite(const bs_synth*,bs_harmonics_suite_config*);
int bs_get_harmonics_suite_meters(const bs_synth*,bs_harmonics_suite_meters*);
/* Fixed bus latency, including disabled/Mix0. Clean Sub is aligned separately. */
uint32_t bs_harmonics_suite_latency(void);
int bs_suite_dynamics_preview(const bs_harmonics_suite_config*,float sample_rate,float* dry,float* wet,uint32_t samples);
int bs_suite_colour_preview(const bs_harmonics_suite_config*,float frequency,float sample_rate,float* output,uint32_t samples);
#ifdef __cplusplus
}
#endif
#endif
