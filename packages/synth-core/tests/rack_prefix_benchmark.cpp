#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <vector>

// Focused, additive benchmark. Does not replace or alter the standard57 cases.
namespace {
constexpr unsigned rate=48000,block=128,frames=rate;
using Clock=std::chrono::steady_clock;
struct Result {double sum=0,peak=0,configMs=0;unsigned edits=0,voices=0;std::vector<double> blocks,transitions;};
double quantile(std::vector<double> values,double fraction){std::sort(values.begin(),values.end());return values[size_t(std::ceil(fraction*(values.size()-1)))];}
bool run(bs_synth*s,bs_sauce_config&rack,unsigned prefix,bool measured,Result&result){
 std::array<float,block>left{},right{};unsigned fadeFrames=0;
 for(unsigned at=0;at<frames;at+=block){
  // Identical public configuration changes at deterministic block boundaries.
  if(at&&at%4864==0){
   if(prefix==15)rack.blocks[15].amount=rack.blocks[15].amount==.75f?.35f:.75f;
   else std::reverse(rack.blocks+prefix,rack.blocks+rack.count);
   const auto begin=Clock::now();const int ok=bs_set_sauce(s,&rack);const auto end=Clock::now();if(!ok)return false;
   fadeFrames=240;
   if(measured){result.configMs+=std::chrono::duration<double,std::milli>(end-begin).count();++result.edits;}
  }
  std::array<bs_event,64>events{};unsigned count=0;
  for(unsigned offset=0;offset<block;++offset)if((at+offset)%4800==0){
   for(unsigned key=0;key<24;++key)events[count++]={offset,BS_NOTE_OFF,0,48+key,0,0};
   for(unsigned key=0;key<24;++key)events[count++]={offset,BS_NOTE_ON,0,48+key,0,.65f};
  }
  const auto begin=Clock::now();const int bad=bs_render(s,left.data(),right.data(),block,events.data(),count);const auto end=Clock::now();if(bad)return false;
  if(measured){const double ms=std::chrono::duration<double,std::milli>(end-begin).count();result.sum+=ms;result.blocks.push_back(ms);if(fadeFrames)result.transitions.push_back(ms);}
  fadeFrames=fadeFrames>block?fadeFrames-block:0;
  result.voices=std::max(result.voices,bs_active_voices(s));
  for(unsigned i=0;i<block;++i)for(float x:{left[i],right[i]}){if(!std::isfinite(x)||std::abs(x)>1)return false;result.peak=std::max(result.peak,std::abs(double(x)));}
 }
 return true;
}
}
int main(int argc,char**argv){
 if(argc!=2||bs_abi_version()!=7||bs_parameter_count()!=44)return 1;
 std::ofstream out(argv[1]);out<<std::setprecision(12)<<"{\"fixtureVersion\":1,\"kind\":\"Focused unchanged-prefix rack timing, not device validation\",\"sampleRate\":48000,\"blockFrames\":128,\"audioBlockBudgetMs\":"<<1000.*block/rate<<",\"cases\":[";bool first=true;
 for(unsigned wave=0;wave<2;++wave)for(unsigned mode=0;mode<2;++mode)for(unsigned prefix:{0u,8u,15u}){
  auto*s=bs_create();if(!s||!bs_prepare(s,rate))return 2;
  bs_set_parameter(s,BS_ATTACK,.003f);bs_set_parameter(s,BS_RELEASE,.1f);bs_set_parameter(s,BS_SUSTAIN_LEVEL,.65f);
  bs_set_parameter(s,BS_FILTER_MODE,float(mode));bs_set_parameter(s,BS_FILTER_RESONANCE,.75f);bs_set_parameter(s,BS_CUTOFF,1200);
  bs_set_parameter(s,BS_OSC1_WAVE,float(wave?4:2));bs_set_parameter(s,BS_OSC2_WAVE,3);
  bs_sauce_config rack{};bs_default_sauce(&rack);rack.count=16;for(unsigned i=0;i<16;++i)rack.blocks[i]={i+1,i%2?BS_SAUCE_FULLNESS:BS_SAUCE_DRIVE,0,1,i%2?.5f:2.f};
  if(!bs_set_sauce(s,&rack))return 3;bs_reset(s);for(unsigned key=48;key<64;++key)bs_note_on(s,0,key,.65f);
  Result result;if(!run(s,rack,prefix,false,result))return 4;for(unsigned repeat=0;repeat<3;++repeat)if(!run(s,rack,prefix,true,result))return 4;
  bs_panic(s);bs_destroy(s);if(result.peak<1e-6||result.voices<16)return 5;
  if(!first)out<<',';first=false;
  out<<"{\"wavePair\":\""<<(wave?"square-pulse":"saw-pulse")<<"\",\"filterMode\":"<<mode<<",\"prefixRetained\":"<<prefix<<",\"edit\":\""<<(prefix==15?"last-amount":"suffix-reverse")<<"\",\"audioBlocks\":16,\"editIntervalFrames\":4864,\"fadeFrames\":240,\"denseRetriggers\":true,\"observedBlockEndVoices\":"<<result.voices<<",\"measuredAudioSeconds\":3,\"renderMsPerAudioSecond\":"<<result.sum/3<<",\"blockMsP50\":"<<quantile(result.blocks,.5)<<",\"blockMsP95\":"<<quantile(result.blocks,.95)<<",\"blockMsP99\":"<<quantile(result.blocks,.99)<<",\"blockMsMax\":"<<*std::max_element(result.blocks.begin(),result.blocks.end())<<",\"configurationMsTotal\":"<<result.configMs<<",\"configurationChanges\":"<<result.edits<<",\"transitionBlockCount\":"<<result.transitions.size()<<",\"transitionBlockMsP50\":"<<quantile(result.transitions,.5)<<",\"transitionBlockMsP95\":"<<quantile(result.transitions,.95)<<",\"transitionBlockMsP99\":"<<quantile(result.transitions,.99)<<",\"transitionBlockMsMax\":"<<*std::max_element(result.transitions.begin(),result.transitions.end())<<",\"peak\":"<<result.peak<<'}';
 }
 out<<"],\"limits\":\"One warmup audio second and three measured seconds per case. Offline core only, no messaging/device/UI costs; OS scheduling can affect maxima. Full reverse retains zero custom stages, suffix reverse retains eight, last-amount edits retain fifteen. Same16-node rack and dense note schedule across variants.\"}\n";
 return out?0:6;
}
