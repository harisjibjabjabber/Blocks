#include "blocks_synth.h"
#include "blocks_sound.h"
#include "blocks_voicing.h"
#include <array>
#include <algorithm>
#include <chrono>
#include <cstdio>
#include <cmath>
int main(){
 for(unsigned trial=0;trial<3;++trial)for(unsigned mode=0;mode<5;++mode){
  bs_synth*s=bs_create();if(!s||!bs_prepare(s,48000))return 1;
  bs_sound_config sound{1,1,1,12};bs_voicing_config_v2 voices{2,0,{{7,12,.6f},{7,12,.6f}}};bs_creative_fx_config fx{};bs_default_creative_fx(&fx);fx.count=mode==0?0:mode==3?2:mode==4?16:1;for(unsigned i=0;i<fx.count;++i){unsigned type=mode==2||(mode==3&&i==0)?BS_CREATIVE_IMPACT:BS_CREATIVE_MOVING_SPACE;bs_default_creative_fx_block(type,&fx.blocks[i]);fx.blocks[i].id=i+1;}
  if(!bs_set_sound(s,&sound)||!bs_set_voicing_v2(s,&voices)||!bs_set_creative_fx(s,&fx))return 2;
  for(auto p:{std::pair<unsigned,float>{BS_OSC1_LEVEL,1},{BS_OSC2_LEVEL,.3f},{BS_CUTOFF,2000},{BS_FILTER_RESONANCE,.6f},{BS_SUSTAIN_LEVEL,1},{BS_FULLNESS_ENABLED,0},{BS_GAIN,.3f}})bs_set_parameter(s,p.first,p.second);
  bs_reset(s);for(unsigned key:{36u,43u,48u,55u})bs_note_on(s,0,key,.6f);
  std::array<float,128>l{},r{};for(unsigned i=0;i<64;++i)bs_render(s,l.data(),r.data(),128,nullptr,0);
  std::array<double,192>timings{};double total=0,energy=0;for(auto&t:timings){auto start=std::chrono::steady_clock::now();if(bs_render(s,l.data(),r.data(),128,nullptr,0))return 3;t=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();total+=t;for(unsigned i=0;i<128;++i)energy+=double(l[i])*l[i]+double(r[i])*r[i];}
  if(!std::isfinite(energy)||energy<1e-10)return 4;std::sort(timings.begin(),timings.end());std::printf("trial=%u mode=%u 4notes7copies ladder12 ms_per_audio_second=%.6f p99_ms=%.6f worst_ms=%.6f\n",trial,mode,total/(192.*128/48000),timings[189],timings.back());bs_destroy(s);
 }
}
