#include <blocks_envelopes.h>
#include <blocks_tuning.h>
#include <blocks_filter_bank.h>
#include <blocks_notes.h>
#include <blocks_sauce.h>
#include <blocks_modulation.h>
#include <blocks_synth.h>
#include <blocks_voicing.h>
#include <blocks_osc_bass.h>
#include <blocks_bass_support.h>
#include <blocks_filter_routing.h>
#include <blocks_delay.h>
#include <blocks_sound.h>
#include <blocks_harmonics_suite.h>
#include <blocks_reverb.h>
#include <blocks_output.h>
int main() {
  bs_synth* synth=bs_create();
  if(!synth) return 1;
  bs_envelopes_config envelopes{};bs_default_envelopes(&envelopes);
  bs_tuning_config tuning{};bs_default_tuning(&tuning);
  bs_filter_bank_config filters{};bs_default_filter_bank(&filters);
  bs_sauce_config sauce{},sauceRead{};
  bs_sound_config sound{},soundRead{};bs_harmonics_suite_config harmonics{},harmonicsRead{};
  bs_default_sound(&sound);bs_default_harmonics_suite(&harmonics);
  bs_delay_config delay{},delayRead{};
  bs_default_delay(&delay);
  bs_reverb_config reverb{},reverbRead{};bs_default_reverb(&reverb);bs_output_meters output{};
  bs_creative_fx_config creative{},creativeRead{};bs_default_creative_fx(&creative);
  bs_osc_bass_config_v2 bassV2{};bs_default_osc_bass_v2(&bassV2);bs_clock_config clock{};bs_default_clock(&clock);bs_sub_config sub{};bs_default_sub(&sub);
  bs_voicing_config_v2 voicingV2{},voicingV2Read{};bs_filter_routing_config routing{},routingRead{};
  bs_default_voicing_v2(&voicingV2);bs_default_filter_routing(&routing);
  bs_notes_config notes{},notesRead{};
  bs_modulation_config_v4 modulationV4{},modulationV4Read{};
  bs_performance_config performance{},performanceRead{};
  bs_default_modulation_v4(&modulationV4);bs_default_sauce(&sauce);bs_default_notes(&notes);
  bs_default_performance(&performance);
  const bool configured=bs_set_envelopes(synth,&envelopes)&&bs_get_envelopes(synth,&envelopes)
    &&bs_set_tuning(synth,&tuning)&&bs_get_tuning(synth,&tuning)
    &&bs_set_filter_bank(synth,&filters)&&bs_get_filter_bank(synth,&filters)
    &&bs_modulation_target_info(4,11,0)&&bs_get_envelope_value(synth,1)==0
    &&bs_set_clock(synth,&clock)&&bs_get_clock(synth,&clock)&&bs_set_sub(synth,&sub)&&bs_get_sub(synth,&sub)&&bs_set_osc_bass_v2(synth,&bassV2)&&bs_get_osc_bass_v2(synth,&bassV2)
    &&bs_set_reverb(synth,&reverb)&&bs_get_reverb(synth,&reverbRead)&&bs_get_output_meters(synth,&output)&&bs_output_latency(synth)==72
    &&bs_set_creative_fx(synth,&creative)&&bs_get_creative_fx(synth,&creativeRead)&&creativeRead.count==0
    &&bs_set_voicing_v2(synth,&voicingV2)&&bs_get_voicing_v2(synth,&voicingV2Read)
    &&bs_set_filter_routing(synth,&routing)&&bs_get_filter_routing(synth,&routingRead)
    &&bs_get_osc_bass_phase(synth,0)==0
    &&bs_set_sound(synth,&sound)&&bs_get_sound(synth,&soundRead)
    &&bs_set_harmonics_suite(synth,&harmonics)&&bs_get_harmonics_suite(synth,&harmonicsRead)
    &&bs_set_delay(synth,&delay)&&bs_get_delay(synth,&delayRead)&&bs_set_sauce(synth,&sauce)&&bs_get_sauce(synth,&sauceRead)
    &&bs_set_notes(synth,&notes)&&bs_get_notes(synth,&notesRead)
    &&bs_set_modulation_v4(synth,&modulationV4)&&bs_get_modulation_v4(synth,&modulationV4Read)
    &&bs_set_stereo_width(synth,1)&&bs_get_stereo_width(synth)==1
    &&bs_set_performance(synth,&performance)&&bs_get_performance(synth,&performanceRead);
  if(!configured||soundRead.version!=BS_SOUND_VERSION||harmonicsRead.version!=BS_HARMONICS_SUITE_VERSION||sauceRead.version!=BS_SAUCE_VERSION||notesRead.version!=BS_NOTES_VERSION
    ||modulationV4Read.version!=BS_MODULATION_V4_VERSION||performanceRead.version!=BS_PERFORMANCE_VERSION
    ||bs_notes_pending_mask(synth)!=0){bs_destroy(synth);return 2;}
  float preview[16]{};
  if(!bs_osc_bass_preview_v2(2,1,.5f,&bassV2.oscillators[0],.25,65,48000,120,1,1,preview,16)){bs_destroy(synth);return 3;}
  if(!bs_sub_preview(4,.5f,65,48000,preview,16)){bs_destroy(synth);return 4;}
  float left[128]{},right[128]{};
  bs_note_on(synth,0,60,.7f);
  int result=bs_render(synth,left,right,128,nullptr,0);
  bs_destroy(synth);
  return result;
}

