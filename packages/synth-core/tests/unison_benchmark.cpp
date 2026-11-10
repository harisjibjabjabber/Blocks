#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <vector>
int main(){
 constexpr unsigned frames=128,blocks=750;constexpr double rate=48000;
 for(unsigned trial=0;trial<3;++trial)for(unsigned regime=0;regime<3;++regime)for(unsigned count:{1u,4u}){
  bs_synth*s=bs_create();if(!s||!bs_prepare(s,rate))return 1;
  bs_voicing_config v{1,count,25,.8f};if(!bs_set_voicing(s,&v))return 2;
  if(regime){bs_set_parameter(s,BS_DRIVE,2);bs_set_parameter(s,BS_FULLNESS,.3f);bs_set_parameter(s,BS_FILTER_MODE,regime==2?1:0);bs_set_parameter(s,BS_FILTER_RESONANCE,.5f);bs_set_parameter(s,BS_FILTER_AMOUNT,12);}
  bs_set_parameter(s,BS_SUSTAIN_LEVEL,.7f);bs_reset(s);for(unsigned key=48;key<64;++key)bs_note_on(s,0,key,.6f);
  std::array<float,frames>l{},r{};for(unsigned i=0;i<100;++i)if(bs_render(s,l.data(),r.data(),frames,nullptr,0))return 3;
  std::vector<double>times;times.reserve(blocks);double peak=0,sum=0;
  for(unsigned i=0;i<blocks;++i){auto before=std::chrono::steady_clock::now();if(bs_render(s,l.data(),r.data(),frames,nullptr,0))return 4;auto after=std::chrono::steady_clock::now();double ms=std::chrono::duration<double,std::milli>(after-before).count();times.push_back(ms);sum+=ms;for(unsigned j=0;j<frames;++j){if(!std::isfinite(l[j])||!std::isfinite(r[j]))return 5;peak=std::max(peak,std::max(std::abs(double(l[j])),std::abs(double(r[j]))));}}
  if(bs_active_voices(s)!=16||peak==0)return 6;std::sort(times.begin(),times.end());
  std::printf("trial=%u regime=%s copies=%u voices=16 ms_per_audio_second=%.6f p99_ms=%.6f max_ms=%.6f peak=%.7f\n",trial,regime==0?"legacy-neutral":regime==1?"soft-moderate":"lp12-moderate",count,sum/(blocks*frames/rate),times[unsigned(std::ceil(blocks*.99))-1],times.back(),peak);bs_destroy(s);
 }
 return 0;
}
