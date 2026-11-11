#ifndef BLOCKS_OSC_BASS_H
#define BLOCKS_OSC_BASS_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
#define BS_OSC_BASS_VERSION 2u
/* Current80-byte state. voice0Rotor1Growl2Throat3Fray; Spin.1..20Hz;
 * Motion/Grit0..1; cycle_beats.03125..64; Curl-.8...8. enabled/synced/
 * retrigger0/1. No older state decoding. Controls smooth without note reset. */
typedef struct bs_osc_bass_entry_v2 {uint32_t enabled,voice,synced,retrigger;float spin_hz,motion,grit,cycle_beats,curl;} bs_osc_bass_entry_v2;
typedef struct bs_osc_bass_config_v2 {uint32_t version,reserved;bs_osc_bass_entry_v2 oscillators[2];} bs_osc_bass_config_v2;
void bs_default_osc_bass_v2(bs_osc_bass_config_v2*);
int bs_set_osc_bass_v2(bs_synth*,const bs_osc_bass_config_v2*);
int bs_get_osc_bass_v2(const bs_synth*,bs_osc_bass_config_v2*);
/* Pure current Studio source preview; source_quality must1. */
int bs_osc_bass_preview_v2(uint32_t wave,uint32_t source_quality,float pulse_width,const bs_osc_bass_entry_v2*,double rotation_phase,double frequency_hz,double sample_rate,double bpm,float envelope,float velocity,float* output,uint32_t samples);
double bs_get_osc_bass_phase(const bs_synth*,uint32_t oscillator);
double bs_get_osc_bass_raw_phase(const bs_synth*,uint32_t oscillator);
double bs_get_osc_bass_rate(const bs_synth*,uint32_t oscillator);
double bs_osc_bass_warp_phase(double phase,float curl);
#ifdef __cplusplus
}
#endif
#endif
