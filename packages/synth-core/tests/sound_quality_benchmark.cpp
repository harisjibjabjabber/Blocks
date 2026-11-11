#include "blocks_synth.h"
#include "blocks_sound.h"
#include "blocks_sauce.h"
#include "blocks_harmonics.h"
#include "blocks_voicing.h"
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <vector>
int main(){for(unsigned trial=0;trial<3;++trial)for(unsigned notes:{4u,16u})for(unsigned copies:{1u,7u})for(unsigned colour:{0u,1u}){
 auto*s=bs_create();if(!s||!bs_prepare(s,48000))return 1;bs_sound_config sound{1,1,colour,4};bs_voicing_config_v2 voicing{2,0,{{copies,10,.6f},{copies,10,.6f}}};
 if(!bs_set_sound(s,&sound)||!bs_set_voicing_v2(s,&voicing))return 2;
 bs_set_parameter(s,BS_OSC2_LEVEL,.3f);bs_set_parameter(s,BS_DRIVE_ENABLED,0);bs_set_parameter(s,BS_FULLNESS_ENABLED,0);bs_set_parameter(s,BS_FILTER_RESONANCE,.6f);bs_set_parameter(s,BS_CUTOFF,2000);bs_set_parameter(s,BS_SUSTAIN_LEVEL,1);bs_set_parameter(s,BS_GAIN,.3f);
 bs_sauce_config rack{1,0,{}};if(colour){rack.count=1;rack.blocks[0]={77,BS_SAUCE_HARMONICS,0,1,4};bs_harmonics_config h{1,1,{}};h.entries[0]={77,1,0,.4f,.6f,-2};if(!bs_set_harmonics(s,&h))return 3;}if(!bs_set_sauce(s,&rack))return 4;bs_reset(s);
 for(unsigned i=0;i<notes;++i)bs_note_on(s,0,36+i*2,.6f);
 std::array<float,128>l{},r{};for(unsigned i=0;i<40;++i)if(bs_render(s,l.data(),r.data(),128,nullptr,0))return 5;
 std::vector<double>times;times.reserve(188);double peak=0,energy=0;
 for(unsigned i=0;i<188;++i){auto start=std::chrono::steady_clock::now();if(bs_render(s,l.data(),r.data(),128,nullptr,0))return 6;const double ms=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();times.push_back(ms);for(unsigned j=0;j<128;++j){if(!std::isfinite(l[j])||!std::isfinite(r[j]))return 7;peak=std::max({peak,std::abs(double(l[j])),std::abs(double(r[j]))});energy+=double(l[j])*l[j]+double(r[j])*r[j];}}
 if(energy<1e-10)return 8;double total=0;for(auto t:times)total+=t;std::sort(times.begin(),times.end());std::printf("trial=%u notes=%u copies=%u chain=%s ms_per_audio_second=%.6f p99_ms=%.6f max_ms=%.6f peak=%.6f\n",trial,notes,copies,colour?"studio-ladder-harmonics":"studio-existing",total/(188.*128/48000),times[186],times.back(),peak);bs_destroy(s);
}}
