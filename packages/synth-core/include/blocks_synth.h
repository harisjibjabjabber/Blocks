#ifndef BLOCKS_SYNTH_H
#define BLOCKS_SYNTH_H
#include <stdint.h>
#include "blocks_sauce.h"
#include "blocks_modulation.h"
#include "blocks_voicing.h"
#include "blocks_delay.h"
#ifdef __cplusplus
extern "C" {
#endif
/* Original Blocks DSP spike. ABI 7. Physical-unit parameters, not MIDI CCs. */
#define BS_ABI_VERSION 7u
#define BS_MAX_VOICES 16u
typedef struct bs_synth bs_synth;
typedef enum bs_parameter_id {
  BS_GAIN=0, BS_OSC_MIX=1, BS_OSC2_DETUNE=2, BS_PULSE_WIDTH=3,
  BS_ATTACK=4, BS_DECAY=5, BS_SUSTAIN_LEVEL=6, BS_RELEASE=7,
  BS_ATTACK_BEND=8, BS_DECAY_BEND=9, BS_RELEASE_BEND=10,
  BS_CUTOFF=11, BS_DRIVE=12, BS_DRIFT_CENTS=13, BS_DRIFT_HZ=14,
  BS_PITCH_DROP_CENTS=15, BS_PITCH_DROP_TIME=16, BS_PITCH_DROP_BEND=17,
  BS_FULLNESS=18, BS_OSC1_WAVE=19, BS_OSC2_WAVE=20,
  BS_OSC1_LEVEL=21, BS_OSC2_LEVEL=22, BS_FILTER_MIX=23, BS_FILTER_AMOUNT=24,
  BS_FILTER_ATTACK=25, BS_FILTER_DECAY=26, BS_FILTER_SUSTAIN=27, BS_FILTER_RELEASE=28,
  BS_FILTER_ATTACK_BEND=29, BS_FILTER_DECAY_BEND=30, BS_FILTER_RELEASE_BEND=31,
  BS_SETTLING_CENTS=32, BS_SETTLING_TIME=33, BS_VELOCITY_MOVEMENT=34,
  BS_ENVELOPE_RESPONSE=35, BS_DRIVE_ENABLED=36, BS_PITCH_DROP_ENABLED=37,
  BS_SAUCE_ORDER=38, BS_FULLNESS_ENABLED=39,
  BS_GLIDE_ENABLED=40, BS_GLIDE_TIME=41, BS_FILTER_RESONANCE=42, BS_FILTER_MODE=43, BS_PARAMETER_COUNT=44
} bs_parameter_id;
typedef enum bs_mapping { BS_LINEAR=0, BS_LOGARITHMIC=1, BS_DISCRETE=2 } bs_mapping;
typedef enum bs_waveform { BS_SINE=0, BS_TRIANGLE=1, BS_SAW=2, BS_PULSE=3, BS_SQUARE=4 } bs_waveform;
typedef struct bs_parameter_descriptor {
  uint32_t id; const char *name; const char *unit;
  float minimum, maximum, default_value; uint32_t mapping;
} bs_parameter_descriptor;
typedef enum bs_event_type { BS_NOTE_ON=0, BS_NOTE_OFF=1, BS_PARAMETER=2, BS_PANIC=3, BS_PEDAL=4, BS_STEREO_WIDTH=5 } bs_event_type;
/* Exactly 24 bytes: six 32-bit fields at offsets 0,4,8,12,16,20.
 * NoteOn value=velocity [0,1]; NoteOff consumes oldest channel/key NoteOn ordinal, including stolen notes (FIFO).
 * Pedal value>=.5 holds released notes on that channel. Panic silences immediately.
 * Parameter events use parameter_id/value in physical units.
 * Events must be sorted, offsets < frames. Equal offsets preserve caller order. */
typedef struct bs_event {
  uint32_t sample_offset, type, channel, key, parameter_id; float value;
} bs_event;
typedef struct bs_patch { uint32_t version; float values[BS_PARAMETER_COUNT]; } bs_patch;
/* Optional performance state is separate from the44-parameter tone patch.
 * 48bytes: seven uint32 fields then five floats. No host clock/timer required.
 * Divisions4/8/16 allow triplets;32/64 are straight only.
 * Arp chord edits restart immediately, then group further edits for20ms
 * from that first restart. Empty-to-new always restarts. Pending settings apply
 * at an actual restart or the next bar seam.
 * Same-sample input events precede the first generated attack. */
#define BS_PERFORMANCE_VERSION 1u
typedef enum bs_performance_mode { BS_PERFORMANCE_OFF=0, BS_ARP=1, BS_STRUM=2 } bs_performance_mode;
typedef enum bs_note_order { BS_ORDER_UP=0, BS_ORDER_DOWN=1, BS_ORDER_AS_PLAYED=2, BS_ORDER_RANDOM=3 } bs_note_order;
typedef struct bs_performance_config {
 uint32_t version,mode,order,division,triplet,seed,mono;
 float bpm,curl,gate,strum_ms,randomness;
} bs_performance_config;
#include "blocks_notes.h"
void bs_default_performance(bs_performance_config *config);
int bs_set_performance(bs_synth *synth,const bs_performance_config *config);
int bs_get_performance(const bs_synth *synth,bs_performance_config *config);
uint32_t bs_performance_pending(const bs_synth *synth);
uint32_t bs_abi_version(void);
uint32_t bs_parameter_count(void);
const bs_parameter_descriptor *bs_parameter_info(uint32_t id);
float bs_normalized_to_physical(uint32_t id, float normalized);
float bs_physical_to_normalized(uint32_t id, float physical);
bs_synth *bs_create(void); /* Allocates engine and delay memory. Starts prepared at48kHz. */
void bs_destroy(bs_synth *synth);
/* prepare/reset/patch calls are host-control operations: never concurrently render.
 * prepare accepts8k..384kHz, allocates delay memory, resets voices/tails, retains settings. Invalid rates/allocation fail atomically. */
int bs_prepare(bs_synth *synth, double sample_rate);
void bs_reset(bs_synth *synth); /* reset voices, pedal and deterministic RNG sequence */
/* Setting Mix sets levels to1-Mix/Mix. Setting either level updates
 * canonical Mix, without changing the other level. Levels need not sum to1. */
/* Glide is Mono-only across connected notes. First notes after an empty pool
 * and gated Arp gaps start immediately. Time is smoothed then captured on each
 * transition; exact zero or disabled bypasses new transitions. Existing glides
 * complete with their captured time. Amp/filter envelopes still retrigger. */
int bs_set_parameter(bs_synth *synth, uint32_t id, float physical);
float bs_get_parameter(const bs_synth *synth, uint32_t id);
/* Separate stereo bus state, not part of the tone patch. Range[0,2], default1.
 * Rejects nonfinite/out-of-range values atomically. Getter is requested target.
 * 5ms time-constant smoothing; reset/prepare snap to retained target, panic
 * preserves it. Event BS_STEREO_WIDTH uses value for sample-offset automation.
 * Width1 is exact bypass; width0 mono, width2 doubles existing Side BEFORE
 * unchanged final tanh/gain protection. No stereo information is generated. */
int bs_set_stereo_width(bs_synth *synth,float width);
float bs_get_stereo_width(const bs_synth *synth); /* null returns neutral1 */
int bs_get_patch(const bs_synth *synth, bs_patch *patch);
/* Current version7 writes/reads44 finite values. Other versions reject atomically.
 * Resonance42 defaults0; FilterMode43 defaults0 (one-pole),1 selects LP12.
 * Oscillator levels are authoritative; Mix is exported as level2/(level1+level2),
 * or .5 when both are zero. */
int bs_set_patch(bs_synth *synth, const bs_patch *patch);
void bs_note_on(bs_synth *synth, uint32_t channel, uint32_t key, float velocity);
void bs_note_off(bs_synth *synth, uint32_t channel, uint32_t key);
void bs_sustain(bs_synth *synth, uint32_t channel, float down);
void bs_panic(bs_synth *synth);
uint32_t bs_active_voices(const bs_synth *synth);
/* Outputs replace (not add). Distinct nonnull buffers, arbitrary block size.
 * No allocation, locks, IO, or host calls. Returns invalid event count, or -1
 * for invalid buffers/order/offsets (whole block rejected and output zeroed).
 * Voice stealing prefers quiet released, then pedal-held, then oldest held.
 * 16 additional fixed 3ms fade tails; overflow replaces quietest tail.
 * active_voices counts primary voices, not these bounded tails. No unison. */
int bs_render(bs_synth *synth, float *left, float *right, uint32_t frames,
              const bs_event *events, uint32_t event_count);
#ifdef __cplusplus
}
#endif
#endif
