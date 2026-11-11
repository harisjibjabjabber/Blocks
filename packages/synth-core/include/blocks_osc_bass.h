#ifndef BLOCKS_OSC_BASS_H
#define BLOCKS_OSC_BASS_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
#define BS_OSC_BASS_VERSION 1u
/* Opt-in phase-domain source flavour, independently per oscillator.
 * enabled0/1,Spin.1..20Hz,Motion/Grit0..1. Defaults off/4/.65/.35.
 * Fixed fundamental plus moving bandlimited overtones; no FIR latency.
 * Free-running clocks continue through idle/retrigger; reset starts at0.
 * Controls5ms-smoothed; normal oscillator/Unison phase ownership unchanged. */
typedef struct bs_osc_bass_entry {uint32_t enabled;float spin_hz,motion,grit;} bs_osc_bass_entry;
typedef struct bs_osc_bass_config {uint32_t version,reserved;bs_osc_bass_entry oscillators[2];} bs_osc_bass_config;
void bs_default_osc_bass(bs_osc_bass_config *config);
int bs_set_osc_bass(bs_synth *synth,const bs_osc_bass_config *config);
int bs_get_osc_bass(const bs_synth *synth,bs_osc_bass_config *config);
double bs_get_osc_bass_phase(const bs_synth *synth,uint32_t oscillator);
/* Pure shape preview from the actual source algorithm. No synth required.
 * wave0..4,quality0Legacy/1Studio,width.1..9,phase0..1,freq>0 belowNyquist,
 * rate8k..384k,samples1..2048. Writes nothing on invalid inputs. Each output
 * spans one waveform period; phase is the fixed rotation-clock pose. */
int bs_osc_bass_preview(uint32_t wave,uint32_t source_quality,float pulse_width,const bs_osc_bass_entry *settings,double rotation_phase,double frequency_hz,double sample_rate,float *output,uint32_t samples);
#ifdef __cplusplus
}
#endif
#endif
