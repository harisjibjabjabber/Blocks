#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <fstream>
#include <iostream>
#include <iomanip>
#include <string>
#include <vector>
// Compile this IDENTICAL host against baseline and candidate core sources.
// Compare the little-endian stereo float files exactly on the same backend;
// compare case metadata first. This is an offline correctness fixture, not timing.
static void writeFloat(std::ostream&out,float value){uint32_t bits=0;std::memcpy(&bits,&value,4);for(unsigned i=0;i<4;++i)out.put(char(bits>>(8*i)));}
static bs_sauce_config mixed(){bs_sauce_config c{};bs_default_sauce(&c);c.count=16;for(unsigned i=0;i<16;++i)c.blocks[i]={i+1,i%2?BS_SAUCE_FULLNESS:BS_SAUCE_DRIVE,0,1,i%2?.63f:3.7f};return c;}
int main(int argc,char**argv){
 if(argc!=2||bs_abi_version()!=7||bs_parameter_count()!=44)return 1;
 std::ofstream audio(argv[1],std::ios::binary),manifest(std::string(argv[1])+".json");if(!audio||!manifest)return 2;
 manifest<<std::setprecision(17)<<"{\"abiVersion\":7,\"encoding\":\"little-endian interleaved stereo float32\",\"cases\":[";bool first=true;uint64_t offset=0;
 const char*names[]={"reverse16-mixed","shared-prefix-and-pending-edits","primary-mask-add-remove","disabled-fullness-warm-history"};
 for(unsigned rate:{8000u,48000u,96000u})for(unsigned scenario=0;scenario<4;++scenario)for(unsigned mode=0;mode<2;++mode){
  bs_synth*s=bs_create();if(!s||!bs_prepare(s,rate))return 3;
  bs_set_parameter(s,BS_ATTACK,.001f);bs_set_parameter(s,BS_SUSTAIN_LEVEL,.8f);bs_set_parameter(s,BS_RELEASE,.05f);bs_set_parameter(s,BS_DRIVE,4.3f);bs_set_parameter(s,BS_FULLNESS,.7f);bs_set_parameter(s,BS_DRIFT_CENTS,7);bs_set_parameter(s,BS_FILTER_MODE,float(mode));bs_set_parameter(s,BS_FILTER_RESONANCE,.5f);
  auto config=mixed();if(scenario==2){config.count=2;config.blocks[0]={101,BS_SAUCE_DRIVE,1,1,1};config.blocks[1]={102,BS_SAUCE_FULLNESS,1,1,0};}if(scenario==3)for(auto&b:config.blocks)b={b.id,BS_SAUCE_FULLNESS,0,0,.75f};
  if(!bs_set_sauce(s,&config))return 4;
  // Exercise continuously moving shared base controls, not only stepped edits.
  const bool lfoEnabled=rate==48000;bs_modulation_config modulation{};bs_default_modulation(&modulation);
  if(lfoEnabled){auto&source=modulation.sources[0];source.enabled=1;source.waveform=BS_LFO_TRIANGLE;source.rate_hz=3.7f;source.intensity=.6f;source.route_count=4;source.routes[0]={BS_DRIVE,.15f};source.routes[1]={BS_FULLNESS,-.25f};source.routes[2]={BS_CUTOFF,.2f};source.routes[3]={BS_FILTER_RESONANCE,.3f};}
  if(!bs_set_modulation(s,&modulation))return 11;bs_reset(s);
  std::vector<bs_event>events;for(unsigned key=48;key<64;++key){events.push_back({0,BS_NOTE_ON,0,key,0,.65f});events.push_back({rate*8/100,BS_NOTE_ON,0,key,0,.72f});events.push_back({rate/5,BS_NOTE_OFF,0,key,0,0});events.push_back({rate*7/10,BS_NOTE_OFF,0,key,0,0});}events.push_back({rate*69/100,BS_PEDAL,0,0,0,1});events.push_back({rate*4/5,BS_PEDAL,0,0,0,0});
  for(unsigned i=1;i<18;++i){const unsigned at=i*rate/25;events.push_back({at,BS_PARAMETER,0,0,BS_DRIVE,float(1+i%11)});events.push_back({at,BS_PARAMETER,0,0,BS_FULLNESS,float(i%5)/4});events.push_back({at,BS_PARAMETER,0,0,BS_SAUCE_ORDER,float(i%2)});events.push_back({at,BS_PARAMETER,0,0,BS_DRIVE_ENABLED,float(i%3!=0)});events.push_back({at,BS_PARAMETER,0,0,BS_FULLNESS_ENABLED,float(i%4!=0)});events.push_back({at,BS_PARAMETER,0,0,BS_PULSE_WIDTH,.1f+.1f*float(i%8)});}
  std::stable_sort(events.begin(),events.end(),[](const bs_event&a,const bs_event&b){return a.sample_offset<b.sample_offset;});
  // Near-adjacent changes exercise latest pending target and fade completion;
  // the remaining10-100ms intervals expose warmth after bypass and reordering.
  const unsigned milliseconds[]={20,21,22,40,100,101,102,160,230,300,400,500,600,650};std::vector<unsigned>actions;for(unsigned ms:milliseconds)actions.push_back(ms*rate/1000);
  double casePeak=0,caseEnergy=0;
  unsigned action=0,event=0;std::array<float,128>l{},r{};
  for(unsigned at=0;at<rate;){
   if(action<actions.size()&&actions[action]==at){
    if(scenario==0)std::reverse(config.blocks,config.blocks+config.count);
    if(scenario==1){if(action%4==3)std::swap(config.blocks[13],config.blocks[15]);else{auto&b=config.blocks[15];b.amount=b.type==BS_SAUCE_DRIVE?float(1+action%11):float(action%7)/6;b.enabled=action%3!=0;}}
    if(scenario==2){switch(action%5){case 0:config=mixed();break;case 1:config.blocks[0]={101,BS_SAUCE_DRIVE,1,1,1};break;case 2:config.blocks[1]={102,BS_SAUCE_FULLNESS,1,1,0};break;case 3:std::swap(config.blocks[0],config.blocks[1]);break;default:config.count=0;break;}}
    if(scenario==3){config.blocks[action%16].enabled=1;config.blocks[(action+5)%16].enabled=action%2;std::rotate(config.blocks+8,config.blocks+9,config.blocks+16);}
    if(!bs_set_sauce(s,&config))return 5;++action;
   }
   unsigned n=std::min(128u,rate-at);if(action<actions.size())n=std::min(n,actions[action]-at);if(!n)return 6;
   std::array<bs_event,80>local{};unsigned count=0;while(event<events.size()&&events[event].sample_offset<at+n){auto e=events[event++];e.sample_offset-=at;local[count++]=e;}
   if(bs_render(s,l.data(),r.data(),n,local.data(),count))return 7;for(unsigned i=0;i<n;++i)for(float x:{l[i],r[i]}){if(!std::isfinite(x)||std::abs(x)>1)return 8;casePeak=std::max(casePeak,std::abs(double(x)));caseEnergy+=double(x)*double(x);writeFloat(audio,x);}at+=n;
  }
  if(!(casePeak>1e-6&&caseEnergy>1e-9))return 12;
  if(bs_active_voices(s)!=0)return 9;bs_destroy(s);
  if(!first)manifest<<',';first=false;manifest<<"{\"scenario\":\""<<names[scenario]<<"\",\"filterMode\":"<<mode<<",\"lfoEnabled\":"<<(lfoEnabled?"true":"false")<<",\"sampleRate\":"<<rate<<",\"frameOffset\":"<<offset<<",\"frames\":"<<rate<<",\"peak\":"<<casePeak<<",\"energy\":"<<caseEnergy<<",\"finalVoices\":0}";offset+=rate;
 }
 manifest<<"],\"totalFrames\":"<<offset<<"}\n";if(!audio||!manifest)return 10;std::cout<<"Rendered24 differential rack cases, "<<offset<<" stereo frames.\n";
}
