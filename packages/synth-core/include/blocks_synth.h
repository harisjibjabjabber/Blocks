#ifndef BLOCKS_SYNTH_H
#define BLOCKS_SYNTH_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
/* Original Blocks DSP spike. ABI 1. Physical-unit parameters, not MIDI CCs. */
#define BS_ABI_VERSION 1u
#define BS_MAX_VOICES 16u
typedef struct bs_synth bs_synth;
typedef enum bs_parameter_id {
  BS_GAIN=0, BS_OSC_MIX=1, BS_OSC2_DETUNE=2, BS_PULSE_WIDTH=3,
  BS_ATTACK=4, BS_DECAY=5, BS_SUSTAIN_LEVEL=6, BS_RELEASE=7,
  BS_ATTACK_BEND=8, BS_DECAY_BEND=9, BS_RELEASE_BEND=10,
  BS_CUTOFF=11, BS_DRIVE=12, BS_DRIFT_CENTS=13, BS_DRIFT_HZ=14,
  BS_PITCH_DROP_CENTS=15, BS_PITCH_DROP_TIME=16, BS_PITCH_DROP_BEND=17,
  BS_PARAMETER_COUNT=18
} bs_parameter_id;
typedef enum bs_mapping { BS_LINEAR=0, BS_LOGARITHMIC=1 } bs_mapping;
typedef struct bs_parameter_descriptor {
  uint32_t id; const char *name; const char *unit;
  float minimum, maximum, default_value; uint32_t mapping;
} bs_parameter_descriptor;
typedef enum bs_event_type { BS_NOTE_ON=0, BS_NOTE_OFF=1, BS_PARAMETER=2, BS_PANIC=3, BS_PEDAL=4 } bs_event_type;
/* Exactly 24 bytes: six 32-bit fields at offsets 0,4,8,12,16,20.
 * NoteOn value=velocity [0,1]; NoteOff matches oldest held channel/key (FIFO).
 * Pedal value>=.5 holds released notes on that channel. Panic silences immediately.
 * Parameter events use parameter_id/value in physical units.
 * Events must be sorted, offsets < frames. Equal offsets preserve caller order. */
typedef struct bs_event {
  uint32_t sample_offset, type, channel, key, parameter_id; float value;
} bs_event;
typedef struct bs_patch { uint32_t version; float values[BS_PARAMETER_COUNT]; } bs_patch;
uint32_t bs_abi_version(void);
uint32_t bs_parameter_count(void);
const bs_parameter_descriptor *bs_parameter_info(uint32_t id);
float bs_normalized_to_physical(uint32_t id, float normalized);
float bs_physical_to_normalized(uint32_t id, float physical);
bs_synth *bs_create(void); /* Allocation only here. Starts prepared at 48kHz. */
void bs_destroy(bs_synth *synth);
/* prepare/reset/patch calls are host-control operations: never concurrently render.
 * prepare accepts 8k..384kHz, resets voices, retains parameters. Invalid rates fail. */
int bs_prepare(bs_synth *synth, double sample_rate);
void bs_reset(bs_synth *synth); /* reset voices, pedal and deterministic RNG sequence */
int bs_set_parameter(bs_synth *synth, uint32_t id, float physical);
float bs_get_parameter(const bs_synth *synth, uint32_t id);
int bs_get_patch(const bs_synth *synth, bs_patch *patch);
int bs_set_patch(bs_synth *synth, const bs_patch *patch); /* bad version/nonfinite: atomic reject */
void bs_note_on(bs_synth *synth, uint32_t channel, uint32_t key, float velocity);
void bs_note_off(bs_synth *synth, uint32_t channel, uint32_t key);
void bs_sustain(bs_synth *synth, uint32_t channel, float down);
void bs_panic(bs_synth *synth);
uint32_t bs_active_voices(const bs_synth *synth);
/* Outputs replace (not add). Distinct nonnull buffers, arbitrary block size.
 * No allocation, locks, IO, or host calls. Returns invalid event count, or -1
 * for invalid buffers/order/offsets (whole block rejected and output zeroed).
 * Voice stealing: oldest of the fixed 16 voices. No unison implemented. */
int bs_render(bs_synth *synth, float *left, float *right, uint32_t frames,
              const bs_event *events, uint32_t event_count);
#ifdef __cplusplus
}
#endif
#endif
