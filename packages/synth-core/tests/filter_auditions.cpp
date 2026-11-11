#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>
static void little(std::ostream&o,uint32_t value,unsigned bytes){for(unsigned i=0;i<bytes;++i)o.put(char(value>>(i*8)));}
int main(int argc,char**argv){
 if(argc!=2||bs_abi_version()!=7||bs_parameter_count()!=44)return 1;
 constexpr unsigned rate=48000,n=4*rate;
 std::ofstream manifest(std::string(argv[1])+"/filter-auditions.json");if(!manifest)return 2;
 manifest<<std::setprecision(10)<<"{\"abiVersion\":7,\"sampleRate\":48000,\"frames\":192000,\"format\":\"PCM16 stereo\",\"normalized\":false,\"listeningVerdict\":\"not assessed\",\"clips\":[";
 bool first=true;
 for(unsigned phrase=0;phrase<2;++phrase)for(unsigned mode=0;mode<2;++mode){
  bs_synth*s=bs_create();if(!s||!bs_prepare(s,rate))return 3;
  bs_set_parameter(s,BS_GAIN,.2f);bs_set_parameter(s,BS_OSC1_LEVEL,.45f);bs_set_parameter(s,BS_OSC2_LEVEL,.25f);bs_set_parameter(s,BS_OSC2_DETUNE,4.8f);
  bs_set_parameter(s,BS_DRIVE,1);bs_set_parameter(s,BS_FULLNESS,0);bs_set_parameter(s,BS_FILTER_MODE,float(mode));bs_set_parameter(s,BS_FILTER_RESONANCE,.75f);
  bs_set_parameter(s,BS_CUTOFF,phrase?200:500);bs_set_parameter(s,BS_FILTER_AMOUNT,phrase?36:0);
  bs_set_parameter(s,BS_FILTER_ATTACK,.005f);bs_set_parameter(s,BS_FILTER_DECAY,.4f);bs_set_parameter(s,BS_FILTER_SUSTAIN,0);bs_set_parameter(s,BS_FILTER_RELEASE,.15f);
  bs_set_parameter(s,BS_ATTACK,.003f);bs_set_parameter(s,BS_DECAY,.35f);bs_set_parameter(s,BS_SUSTAIN_LEVEL,phrase?.1f:.7f);bs_set_parameter(s,BS_RELEASE,.3f);bs_reset(s);
  bs_patch patch{};bs_get_patch(s,&patch);std::vector<bs_event> events;
  if(phrase){unsigned i=0;for(unsigned key:{57u,64u,69u,76u}){unsigned at=i++*36000;events.push_back({at,BS_NOTE_ON,0,key,0,.75f});events.push_back({at+14400,BS_NOTE_OFF,0,key,0,0});}}
  else{for(unsigned key:{57u,64u,69u})events.push_back({0,BS_NOTE_ON,0,key,0,.75f});for(unsigned key:{57u,64u,69u})events.push_back({144000,BS_NOTE_OFF,0,key,0,0});}
  std::vector<float>l(n),r(n);double energy=0,peak=0;
  for(unsigned at=0;at<n;at+=128){const unsigned frames=std::min(128u,n-at);std::array<bs_event,8>local{};unsigned count=0;for(auto e:events)if(e.sample_offset>=at&&e.sample_offset<at+frames){e.sample_offset-=at;local[count++]=e;}if(bs_render(s,l.data()+at,r.data()+at,frames,local.data(),count))return 4;}
  if(bs_active_voices(s)!=0)return 5;bs_destroy(s);
  for(unsigned i=0;i<n;++i)for(float x:{l[i],r[i]}){if(!std::isfinite(x)||std::abs(x)>=1)return 6;peak=std::max(peak,std::abs(double(x)));energy+=double(x)*x;}
  const std::string name=std::string(phrase?"pluck":"held-chord")+(mode?"-resonant":"-soft"),file=name+".wav";
  std::ofstream out(std::string(argv[1])+"/"+file,std::ios::binary);if(!out)return 7;
  out.write("RIFF",4);little(out,36+n*4,4);out.write("WAVEfmt ",8);little(out,16,4);little(out,1,2);little(out,2,2);little(out,rate,4);little(out,rate*4,4);little(out,4,2);little(out,16,2);out.write("data",4);little(out,n*4,4);
  for(unsigned i=0;i<n;++i)for(float x:{l[i],r[i]})little(out,uint16_t(int16_t(std::lround(x*32767))),2);if(!out)return 8;
  if(!first)manifest<<',';first=false;manifest<<"{\"id\":\""<<name<<"\",\"file\":\""<<file<<"\",\"filterMode\":"<<mode<<",\"resonance\":0.75,\"peak\":"<<peak<<",\"rms\":"<<std::sqrt(energy/(2*n))<<",\"finalActiveVoices\":0,\"patch\":{\"version\":7,\"values\":[";
  for(unsigned i=0;i<BS_PARAMETER_COUNT;++i){if(i)manifest<<',';manifest<<patch.values[i];}manifest<<"]},\"events\":[";
  for(unsigned i=0;i<events.size();++i){if(i)manifest<<',';const auto&e=events[i];manifest<<"{\"frame\":"<<e.sample_offset<<",\"type\":"<<e.type<<",\"channel\":"<<e.channel<<",\"key\":"<<e.key<<",\"value\":"<<e.value<<'}';}manifest<<"]}";
 }
 manifest<<"]}\n";if(!manifest)return 9;std::cout<<"Rendered4 fixed-gain filter comparisons; no listening verdict.\n";
}
