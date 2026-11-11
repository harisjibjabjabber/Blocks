#include "blocks_synth.h"
#include "blocks_sound.h"
#include "blocks_voicing.h"
#include "blocks_filter_routing.h"
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <vector>
int main(){
 for(unsigned trial=0;trial<3;++trial)for(unsigned bank=0;bank<4;++bank)for(unsigned mask=0;mask<4;++mask){
  auto*s=bs_create();if(!s||!bs_prepare(s,48000))return 1;
  bs_voicing_config_v2 v{};bs_default_voicing_v2(&v);v.oscillators[0]={bank==0?1u:7u,10,.6f};v.oscillators[1]={bank==1?1u:7u,bank==3?17.f:10.f,bank==3?.3f:.6f};
  const bs_filter_routing_config route{1,mask};const bs_sound_config sound{1,1,1,4};
  if(!bs_set_voicing_v2(s,&v)||!bs_set_filter_routing(s,&route)||!bs_set_sound(s,&sound))return 2;
  for(auto p:{std::pair<unsigned,float>{BS_OSC1_LEVEL,1},{BS_OSC2_LEVEL,.3f},{BS_CUTOFF,2000},{BS_FILTER_RESONANCE,.6f},{BS_SUSTAIN_LEVEL,1},{BS_DRIVE_ENABLED,0},{BS_FULLNESS_ENABLED,0},{BS_GAIN,.3f}})if(!bs_set_parameter(s,p.first,p.second))return 3;
  bs_reset(s);for(unsigned key:{36u,40u,43u,47u})bs_note_on(s,0,key,.6f);
  std::array<float,128>l{},r{};for(unsigned n=0;n<40;++n)if(bs_render(s,l.data(),r.data(),128,nullptr,0))return 4;
  std::vector<double>times;times.reserve(96);double total=0,energy=0,peak=0;
  for(unsigned n=0;n<96;++n){const auto start=std::chrono::steady_clock::now();if(bs_render(s,l.data(),r.data(),128,nullptr,0))return 5;const double ms=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();total+=ms;times.push_back(ms);for(unsigned i=0;i<128;++i){if(!std::isfinite(l[i])||!std::isfinite(r[i]))return 6;energy+=double(l[i])*l[i]+double(r[i])*r[i];peak=std::max({peak,std::abs(double(l[i])),std::abs(double(r[i]))});}}
  if(energy<1e-10)return 7;std::sort(times.begin(),times.end());std::printf("trial=%u osc1=%u osc2=%u different_tuning=%u mask=%u ms_per_audio_second=%.6f p99_ms=%.6f max_ms=%.6f peak=%.7f\n",trial,v.oscillators[0].count,v.oscillators[1].count,bank==3,mask,total/(96.*128/48000),times[95],times.back(),peak);bs_destroy(s);
 }
}
