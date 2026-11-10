#include <blocks_notes.h>
#include <blocks_sauce.h>
#include <blocks_modulation.h>
#include <blocks_synth.h>
#include <blocks_voicing.h>
#include <blocks_delay.h>
int main() {
  bs_synth* synth=bs_create();
  if(!synth) return 1;
  bs_sauce_config sauce{},sauceRead{};
  bs_voicing_config voicing{},voicingRead{};bs_delay_config delay{},delayRead{};
  bs_default_voicing(&voicing);bs_default_delay(&delay);
  bs_notes_config notes{},notesRead{};
  bs_modulation_config modulation{},modulationRead{};
  bs_modulation_config_v2 modulationV2{},modulationV2Read{};
  bs_modulation_config_v3 modulationV3{},modulationV3Read{};
  bs_performance_config performance{},performanceRead{};
  bs_default_modulation_v3(&modulationV3);bs_default_sauce(&sauce);bs_default_notes(&notes);
  bs_default_modulation(&modulation);bs_default_modulation_v2(&modulationV2);bs_default_performance(&performance);
  const bool configured=bs_set_voicing(synth,&voicing)&&bs_get_voicing(synth,&voicingRead)
    &&bs_set_delay(synth,&delay)&&bs_get_delay(synth,&delayRead)&&bs_set_sauce(synth,&sauce)&&bs_get_sauce(synth,&sauceRead)
    &&bs_set_notes(synth,&notes)&&bs_get_notes(synth,&notesRead)
    &&bs_set_modulation(synth,&modulation)&&bs_get_modulation(synth,&modulationRead)
    &&bs_set_modulation_v2(synth,&modulationV2)&&bs_get_modulation_v2(synth,&modulationV2Read)
    &&bs_get_modulation_phase(synth,modulationV2.sources[0].id)==0
    &&bs_set_modulation_v3(synth,&modulationV3)&&bs_get_modulation_v3(synth,&modulationV3Read)
    &&bs_set_stereo_width(synth,1)&&bs_get_stereo_width(synth)==1
    &&bs_set_performance(synth,&performance)&&bs_get_performance(synth,&performanceRead);
  if(!configured||sauceRead.version!=BS_SAUCE_VERSION||notesRead.version!=BS_NOTES_VERSION
    ||modulationV3Read.version!=BS_MODULATION_V3_VERSION||modulationRead.version!=BS_MODULATION_VERSION||modulationV2Read.version!=BS_MODULATION_V2_VERSION||performanceRead.version!=BS_PERFORMANCE_VERSION
    ||bs_notes_pending_mask(synth)!=0){bs_destroy(synth);return 2;}
  float left[128]{},right[128]{};
  bs_note_on(synth,0,60,.7f);
  int result=bs_render(synth,left,right,128,nullptr,0);
  bs_destroy(synth);
  return result;
}
