#ifndef BLOCKS_VOICING_H
#define BLOCKS_VOICING_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
#define BS_VOICING_VERSION 1u
/* Additive16-byte state, separate from tone ABI7/count44.
 * Count1..4 is captured on each accepted NoteOn (including generated notes).
 * Detune0..50 cents is the symmetric maximum offset; spread0..1 pans copies.
 * Detune/spread are live5ms-smoothed. Count1 follows the original mono path
 * exactly, ignoring detune/spread. Defaults1/0/0. Invalid inputs reject whole.
 * Copies start at equal phase, weight1/count; no random seed or extra note
 * ownership. Two filter/effects paths per multi-copy note, shared envelopes.
 * Getter returns requested settings; reset/prepare preserve and snap targets. */
typedef struct bs_voicing_config {uint32_t version,count;float detune_cents,spread;} bs_voicing_config;
void bs_default_voicing(bs_voicing_config *config);
int bs_set_voicing(bs_synth *synth,const bs_voicing_config *config);
int bs_get_voicing(const bs_synth *synth,bs_voicing_config *config);
#ifdef __cplusplus
}
#endif
#endif
