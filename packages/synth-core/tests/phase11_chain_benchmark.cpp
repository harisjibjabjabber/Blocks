#include "blocks_synth.h"
#include "blocks_sound.h"
#include "blocks_voicing.h"
#include "blocks_sauce.h"
#include "blocks_harmonics.h"
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>

// Bounded relative CPU fixture, not a capacity guarantee for arbitrary patches.
int main(int argc,char**argv){
 const unsigned model=argc>1?unsigned(std::strtoul(argv[1],nullptr,10)):0;
 const unsigned copies=argc>2?std::clamp(unsigned(std::strtoul(argv[2],nullptr,10)),1u,7u):7;
 const std::array<unsigned,9>keys{{36,40,43,47,48,52,55,59,60}};
 for(unsigned trial=0;trial<3;++trial)for(unsigned notes:{4u,9u})for(unsigned enabled:{0u,1u}){
  auto*s=bs_create();if(!s||!bs_prepare(s,48000))return 1;
  const bs_sound_config sound{1,1,1,12};const bs_voicing_config_v2 voices{2,0,{{copies,12,.6f},{copies,12,.6f}}};
  bs_sauce_config rack{};bs_default_sauce(&rack);rack.count=1;rack.blocks[0]={77,BS_SAUCE_HARMONICS,0,enabled,4};
  bs_harmonics_config harmonic{};bs_default_harmonics(&harmonic);harmonic.count=1;harmonic.entries[0]={77,model,.25f,.6f,1,0};
  if(!bs_set_sound(s,&sound)||!bs_set_voicing_v2(s,&voices)||!bs_set_sauce(s,&rack)||!bs_set_harmonics(s,&harmonic))return 2;
  for(auto p:{std::pair<unsigned,float>{BS_OSC1_LEVEL,1},{BS_OSC2_LEVEL,.3f},{BS_CUTOFF,2000},{BS_FILTER_RESONANCE,.6f},{BS_SUSTAIN_LEVEL,1},{BS_DRIVE_ENABLED,0},{BS_FULLNESS_ENABLED,0},{BS_GAIN,.3f}})if(!bs_set_parameter(s,p.first,p.second))return 3;
  bs_reset(s);for(unsigned i=0;i<notes;++i)bs_note_on(s,0,keys[i],.6f);
  std::array<float,128>left{},right{};for(unsigned i=0;i<64;++i)if(bs_render(s,left.data(),right.data(),128,nullptr,0))return 4;
  std::array<double,192>timings{};double total=0,energy=0,peak=0;
  for(auto&time:timings){const auto start=std::chrono::steady_clock::now();if(bs_render(s,left.data(),right.data(),128,nullptr,0))return 5;time=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();total+=time;for(unsigned i=0;i<128;++i){if(!std::isfinite(left[i])||!std::isfinite(right[i]))return 6;energy+=double(left[i])*left[i]+double(right[i])*right[i];peak=std::max({peak,std::abs(double(left[i])),std::abs(double(right[i]))});}}
  if(energy<1e-10)return 7;std::sort(timings.begin(),timings.end());
  std::printf("trial=%u notes=%u unison=%u ladder_drive=12 harmonics=%u model=%u ms_per_audio_second=%.6f p99_ms=%.6f max_ms=%.6f peak=%.7f\n",trial,notes,copies,enabled,model,total/(192.*128/48000),timings[189],timings.back(),peak);std::fflush(stdout);bs_destroy(s);
 }
}
