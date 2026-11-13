#ifndef BLOCKS_ENVELOPES_H
#define BLOCKS_ENVELOPES_H
#include "blocks_modulation.h"
#ifdef __cplusplus
extern "C" {
#endif
#define BS_ENVELOPES_VERSION 2u
#define BS_ENVELOPE_COUNT 3u
/*2036bytes. Env1 is the actual per-voice amplitude envelope; Env2 and3 are
 * independently triggered per-voice modulators. Values are unipolar0..1.
 * No routes by default. Env1 shape aliases tone4..10; Env2 aliases25..31.
 * Attack.001..5/Decay.001..8/Release.001..10seconds, Sustain0..1,
 * bends-2..2. IDs exactly1,2,3.
 * Shared-bus destinations use maximum active-voice envelope value. Voice
 * lifetime remains owned by Env1; modulators do not resurrect silent voices. */
typedef struct bs_envelope_source {
 uint32_t id;
 float attack,decay,sustain,release,attack_bend,decay_bend,release_bend;
 uint32_t route_count;
 bs_lfo_route_v4 routes[BS_MAX_LFO_ROUTES];
} bs_envelope_source;
typedef struct bs_envelopes_config {uint32_t version,count;bs_envelope_source sources[BS_ENVELOPE_COUNT];} bs_envelopes_config;
void bs_default_envelopes(bs_envelopes_config*);
int bs_set_envelopes(bs_synth*,const bs_envelopes_config*);
int bs_get_envelopes(const bs_synth*,bs_envelopes_config*);
double bs_get_envelope_value(const bs_synth*,uint32_t id);
#ifdef __cplusplus
}
#endif
#endif
