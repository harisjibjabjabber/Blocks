#ifndef BLOCKS_VOICING_H
#define BLOCKS_VOICING_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct bs_synth bs_synth;
#define BS_VOICING_VERSION 1u
#define BS_MAX_UNISON 7u
/* Additive16-byte state, separate from tone ABI7/count44.
 * Count1..7 is captured on each accepted NoteOn (including generated notes).
 * Detune0..50 cents is the symmetric maximum offset; spread0..1 pans copies.
 * Detune/spread are live5ms-smoothed. Count1 follows the original mono path
 * exactly, ignoring detune/spread. Defaults1/0/0. Invalid inputs reject whole.
 * Center lane starts at zero phase; outer lanes use deterministic seeded
 * starts, independent of the existing pitch-motion RNG. At >=2ct copies use
 * weight1/count. Below2ct smoothed body weighting protects zero-detune notes.
 * No extra MIDI ownership. Two filter/effects paths share note envelopes.
 * Getter returns requested settings; reset/prepare preserve and snap targets. */
typedef struct bs_voicing_config {uint32_t version,count;float detune_cents,spread;} bs_voicing_config;
#define BS_VOICING_VERSION_V2 2u
/* Independent per-oscillator settings. Both entries use the same bounds and
 * NoteOn Count/live Detune/Spread semantics as v1. Atomic whole-config updates.
 * v1 setter assigns both entries. v1 getter refuses without writing if their
 * requested values differ; use v2 to export independent state losslessly. */
typedef struct bs_osc_voicing_config {uint32_t count;float detune_cents,spread;} bs_osc_voicing_config;
typedef struct bs_voicing_config_v2 {uint32_t version,reserved;bs_osc_voicing_config oscillators[2];} bs_voicing_config_v2;
void bs_default_voicing_v2(bs_voicing_config_v2 *config);
int bs_set_voicing_v2(bs_synth *synth,const bs_voicing_config_v2 *config);
int bs_get_voicing_v2(const bs_synth *synth,bs_voicing_config_v2 *config);
void bs_default_voicing(bs_voicing_config *config);
int bs_set_voicing(bs_synth *synth,const bs_voicing_config *config);
int bs_get_voicing(const bs_synth *synth,bs_voicing_config *config);
#ifdef __cplusplus
}
#endif
#endif
