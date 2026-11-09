#include <blocks_synth.h>
int main() {
  bs_synth* synth=bs_create();
  if(!synth) return 1;
  float left[128]{},right[128]{};
  bs_note_on(synth,0,60,.7f);
  int result=bs_render(synth,left,right,128,nullptr,0);
  bs_destroy(synth);
  return result;
}
