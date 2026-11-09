#include <blocks_notes.h>
#include <blocks_sauce.h>
#include <blocks_modulation.h>
#include <blocks_synth.h>
int main() {
  bs_synth* synth=bs_create();
  if(!synth) return 1;
  bs_sauce_config sauce{},sauceRead{};
  bs_notes_config notes{},notesRead{};
  bs_modulation_config modulation{},modulationRead{};
  bs_performance_config performance{},performanceRead{};
  bs_default_sauce(&sauce);bs_default_notes(&notes);
  bs_default_modulation(&modulation);bs_default_performance(&performance);
  const bool configured=bs_set_sauce(synth,&sauce)&&bs_get_sauce(synth,&sauceRead)
    &&bs_set_notes(synth,&notes)&&bs_get_notes(synth,&notesRead)
    &&bs_set_modulation(synth,&modulation)&&bs_get_modulation(synth,&modulationRead)
    &&bs_set_performance(synth,&performance)&&bs_get_performance(synth,&performanceRead);
  if(!configured||sauceRead.version!=BS_SAUCE_VERSION||notesRead.version!=BS_NOTES_VERSION
    ||modulationRead.version!=BS_MODULATION_VERSION||performanceRead.version!=BS_PERFORMANCE_VERSION
    ||bs_notes_pending_mask(synth)!=0){bs_destroy(synth);return 2;}
  float left[128]{},right[128]{};
  bs_note_on(synth,0,60,.7f);
  int result=bs_render(synth,left,right,128,nullptr,0);
  bs_destroy(synth);
  return result;
}
