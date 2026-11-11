#ifndef BLOCKS_HARMONICS_API_H
#define BLOCKS_HARMONICS_API_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
#define BS_HARMONICS_VERSION 1u
#define BS_HARMONICS_CAPACITY 16u
typedef struct bs_synth bs_synth;
typedef enum bs_harmonics_model {BS_HARMONICS_ROUND=0,BS_HARMONICS_TUBE=1,BS_HARMONICS_FOLD=2} bs_harmonics_model;
/*24 bytes. Stable Sauce node ID; model0..2; tone[-1,1], dynamics[0,1],
 * mix[0,1], output_db[-12,12]. Default entry: {id,0,0,0,1,0}.
 * Tone is a wet-path dark/bright tilt; Dynamics restores
 * attack contrast with bounded envelope gain, not sustained loudness makeup.
 * Tube is an original asymmetric curve, not a circuit/hardware emulation.
 * Enabled processing has fixed oversampling/ADAA latency. Mix0 is filtered,
 * aligned dry, not exact bypass. Use node power for bypass. */
typedef struct bs_harmonics_entry {uint32_t id,model;float tone,dynamics,mix,output_db;} bs_harmonics_entry;
/*392 bytes. Unique nonzero IDs, count<=16. Missing entries use defaults.
 * Stale IDs do not process audio. Tone patch and Sauce v1 layouts unchanged. */
typedef struct bs_harmonics_config {uint32_t version,count;bs_harmonics_entry entries[BS_HARMONICS_CAPACITY];} bs_harmonics_config;
void bs_default_harmonics(bs_harmonics_config *config);
int bs_set_harmonics(bs_synth *synth,const bs_harmonics_config *config);
int bs_get_harmonics(const bs_synth *synth,bs_harmonics_config *config);
#ifdef __cplusplus
}
#endif
#endif
