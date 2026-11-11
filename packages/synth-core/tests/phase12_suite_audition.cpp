#include "blocks_synth.h"
#include "blocks_sound.h"
#include "blocks_harmonics_suite.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <string>
#include <vector>

// Actual complete synth, common source/level/timing. Float WAVs preserve all
// peaks; matched versions use one shared-36dBFS RMS target, never per-file peak
// normalization or post-render limiting. Extra headroom preserves the crest
// factor now that the final always-on tanh is retired.
static void put(std::ostream&o,uint32_t v,unsigned n){for(unsigned i=0;i<n;++i)o.put(char(v>>(8*i)));}
static bool wav(const std::string&path,const std::vector<float>&data,double gain){
 std::ofstream o(path,std::ios::binary);if(!o)return false;
 o.write("RIFF",4);put(o,36+uint32_t(data.size()*4),4);o.write("WAVEfmt ",8);
 put(o,16,4);put(o,3,2);put(o,2,2);put(o,48000,4);put(o,384000,4);put(o,8,2);put(o,32,2);
 o.write("data",4);put(o,uint32_t(data.size()*4),4);
 for(float x:data){float sample=float(x*gain);o.write(reinterpret_cast<const char*>(&sample),4);}return bool(o);
}
int main(int argc,char**argv){
 if(argc!=2)return 1;constexpr unsigned frames=48000*4;
 const char*names[]={"dry","amp-warm","amp-extreme","clip","sine-crush","compressor","crush-memory","ott-density","full-chain","tight","bloom","tape","rectify","layered-colour"};
 for(unsigned mode=0;mode<14;++mode){
  auto*s=bs_create();if(!s||!bs_prepare(s,48000))return 2;
  for(auto p:{std::pair<unsigned,float>{BS_OSC1_WAVE,BS_SAW},{BS_OSC1_LEVEL,.8f},{BS_OSC2_LEVEL,0},{BS_GAIN,.3f},{BS_DRIFT_CENTS,0},{BS_SETTLING_CENTS,0},{BS_PITCH_DROP_ENABLED,0},{BS_FULLNESS_ENABLED,0},{BS_FILTER_MIX,0},{BS_ATTACK,.002f},{BS_DECAY,.24f},{BS_SUSTAIN_LEVEL,0},{BS_RELEASE,.15f}})if(!bs_set_parameter(s,p.first,p.second))return 3;
  bs_sound_config sound{1,1,1,1};if(!bs_set_sound(s,&sound))return 4;
  bs_harmonics_suite_config c{};bs_default_harmonics_suite(&c);c.enabled=mode!=0;c.colour_enabled=mode>=1&&mode<=4;c.drive_db=mode==2?36:18;c.tone=-.2f;
  if(mode==3)c.colour_style=1;if(mode==4)c.colour_style=2;
  if(mode>=11){c.colour_enabled=1;c.colour_style=mode==11?3:mode==12?4:0;}
  if(mode==13){c.drive_db=9;c.colour2_enabled=1;c.colour2_style=4;c.colour2_drive_db=6;c.colour2_mix=.3f;c.colour2_output_db=-6;}
  if(mode==5||mode==8){c.comp_enabled=1;c.comp_threshold_db=-30;c.comp_ratio=12;c.comp_attack_ms=3;c.comp_release_ms=180;c.comp_makeup_db=0;}
  if(mode==6||mode==8){c.crush_enabled=1;c.crush_amount=.85f;c.crush_recovery=.3f;c.crush_crunch_db=18;}
  if(mode==7||mode==8){c.ott_enabled=1;c.ott_amount=.8f;c.ott_up=1;c.ott_down=1;}
  if(mode==8){c.colour_enabled=1;c.drive_db=12;}
  if(mode==9)c.dynamics=-1;if(mode==10)c.dynamics=1;
  if(!bs_set_harmonics_suite(s,&c))return 5;bs_reset(s);
  std::vector<float>data;data.reserve(frames*2);std::array<float,128>l{},r{};
  const unsigned keys[]={36,43,48,55,60,64,67};
  double peak=0,squares=0,late=0,attackEnergy=0,bodyEnergy=0;unsigned lateN=0,attackN=0,bodyN=0;
  for(unsigned start=0;start<frames;start+=128){
   unsigned n=std::min(128u,frames-start);std::array<bs_event,14>events{};unsigned count=0;
   for(unsigned i=0;i<7;++i){unsigned on=i<4?i*18000:72000,off=on+(i<4?14000:30000);
    if(on>=start&&on<start+n)events[count++]={on-start,BS_NOTE_ON,0,keys[i],0,i%2?.6f:.9f};
    if(off>=start&&off<start+n)events[count++]={off-start,BS_NOTE_OFF,0,keys[i],0,0};}
   std::stable_sort(events.begin(),events.begin()+count,[](const auto&a,const auto&b){return a.sample_offset<b.sample_offset;});
   if(bs_render(s,l.data(),r.data(),n,events.data(),count))return 6;
   for(unsigned i=0;i<n;++i)for(float x:{l[i],r[i]}){if(!std::isfinite(x))return 7;data.push_back(x);peak=std::max(peak,std::abs(double(x)));squares+=double(x)*x;if(start+i>=120000){late+=double(x)*x;++lateN;}if(start+i<72000){const unsigned age=(start+i)%18000;if(age>=96&&age<1200){attackEnergy+=double(x)*x;++attackN;}if(age>=2880&&age<9600){bodyEnergy+=double(x)*x;++bodyN;}}}
  }
  double rms=std::sqrt(squares/data.size()),matched=std::pow(10.,-36./20.)/std::max(rms,1e-12);
  std::string stem=std::string(argv[1])+"/"+names[mode];
  if(peak*matched>=1){std::fprintf(stderr,"Matched audition %s exceeds full scale at shared-36dBFS target: %.9g\n",names[mode],peak*matched);return 9;}
  if(!wav(stem+"-fixed.wav",data,1)||!wav(stem+"-matched.wav",data,matched))return 8;
  std::printf("%s raw_peak=%.9g fixed_peak=%.9g rms=%.9g matched_gain=%.9g matched_peak=%.9g matched_target_dbfs=-36 late_rms=%.9g attack_rms=%.9g body_rms=%.9g latency=%u\n",names[mode],peak,peak,rms,matched,peak*matched,std::sqrt(late/std::max(1u,lateN)),std::sqrt(attackEnergy/std::max(1u,attackN)),std::sqrt(bodyEnergy/std::max(1u,bodyN)),bs_output_latency(s));std::fflush(stdout);bs_destroy(s);
 }
}
