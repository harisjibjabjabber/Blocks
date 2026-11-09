#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <vector>

// Offline host timing only: excludes device/AudioWorklet/UI overhead.
namespace {
constexpr unsigned rate=48000,block=128,frames=rate;
using Clock=std::chrono::steady_clock;
struct Result { double sum=0,peak=0;std::vector<double> blocks; };
double quantile(std::vector<double> values,double fraction) {
 std::sort(values.begin(),values.end());return values[size_t(std::ceil(fraction*(values.size()-1)))];
}
bool run(bs_synth*s,unsigned voices,bool dense,bool measured,Result&result) {
 std::array<float,block> left{},right{};
 const unsigned period=4800;
 for(unsigned start=0;start<frames;start+=block) {
  std::array<bs_event,64> events{};unsigned count=0;
  if(dense)for(unsigned offset=0;offset<block&&start+offset<frames;++offset)if((start+offset)%period==0){
   // More attacks than note slots; paired releases exercise stolen ownership.
   for(unsigned key=0;key<24;++key)events[count++]={offset,BS_NOTE_OFF,0,48+key,0,0};
   for(unsigned key=0;key<24;++key)events[count++]={offset,BS_NOTE_ON,0,48+key,0,.65f};
  }
  const unsigned n=std::min(block,frames-start);
  const auto begin=Clock::now();const int rejected=bs_render(s,left.data(),right.data(),n,events.data(),count);const auto end=Clock::now();
  if(rejected)return false;
  if(measured){const double ms=std::chrono::duration<double,std::milli>(end-begin).count();result.sum+=ms;result.blocks.push_back(ms);}
  for(unsigned i=0;i<n;++i)for(float value:{left[i],right[i]}){
   if(!std::isfinite(value)||std::abs(value)>1)return false;
   result.peak=std::max(result.peak,std::abs(double(value)));
  }
 }
 (void)voices;return true;
}
}
int main(int argc,char**argv) {
 if(argc!=2||bs_abi_version()!=4||bs_parameter_count()!=35){std::cerr<<"Usage: benchmark_core output.json (ABI4 required)\n";return 1;}
 std::ofstream out(argv[1]);if(!out)return 2;
 out<<std::setprecision(10)<<"{\n\"kind\":\"Offline core timing, not a phone or audio-device benchmark\",\n\"abiVersion\":"<<bs_abi_version()<<",\n\"sampleRate\":"<<rate<<",\n\"blockFrames\":"<<block<<",\n\"audioBlockBudgetMs\":"<<1000.0*block/rate<<",\n\"cases\":[\n";
 bool first=true;
 for(unsigned feature=0;feature<2;++feature)for(unsigned pair=0;pair<3;++pair)for(float fullness:{0.f,.5f,1.f})for(unsigned voices:{1u,8u,16u})for(bool dense:{false,true}) {
  if(dense&&voices!=16)continue;
  if(feature&&(voices!=16||fullness!=.5f))continue;
  bs_synth*s=bs_create();if(!s||!bs_prepare(s,rate))return 3;
  bs_set_parameter(s,BS_FULLNESS,fullness);bs_set_parameter(s,BS_ATTACK,.003f);bs_set_parameter(s,BS_RELEASE,.5f);
  bs_set_parameter(s,BS_OSC1_WAVE,pair==0?BS_SAW:pair==1?BS_SINE:BS_SQUARE);bs_set_parameter(s,BS_OSC2_WAVE,pair==1?BS_TRIANGLE:BS_PULSE);
  if(feature){bs_set_parameter(s,BS_FILTER_AMOUNT,36);bs_set_parameter(s,BS_FILTER_MIX,.7f);bs_set_parameter(s,BS_FILTER_SUSTAIN,.4f);bs_set_parameter(s,BS_SETTLING_CENTS,8);bs_set_parameter(s,BS_VELOCITY_MOVEMENT,.7f);bs_set_parameter(s,BS_DRIFT_CENTS,40);}bs_reset(s);
  for(unsigned key=0;key<voices;++key)bs_note_on(s,0,48+key,.65f);
  Result result;if(!run(s,voices,dense,false,result)){bs_destroy(s);return 4;}
  for(unsigned repeat=0;repeat<3;++repeat)if(!run(s,voices,dense,true,result)){bs_destroy(s);return 4;}
  bs_panic(s);bs_destroy(s);
  const double p50=quantile(result.blocks,.5),p95=quantile(result.blocks,.95),p99=quantile(result.blocks,.99),maximum=*std::max_element(result.blocks.begin(),result.blocks.end());
  if(!first)out<<",\n";first=false;
  out<<"{\"wavePair\":\""<<(pair==0?"saw-pulse":pair==1?"sine-triangle":"square-pulse")<<"\",\"voices\":"<<voices<<",\"fullness\":"<<fullness<<",\"denseRetriggers\":"<<(dense?"true":"false")<<",\"filterEnvelopeAndMovement\":"<<(feature?"true":"false")<<",\"measuredAudioSeconds\":3,\"renderMsPerAudioSecond\":"<<result.sum/3<<",\"blockMsP50\":"<<p50<<",\"blockMsP95\":"<<p95<<",\"blockMsP99\":"<<p99<<",\"blockMsMax\":"<<maximum<<",\"peak\":"<<result.peak<<'}';
 }
 out<<"\n],\n\"limits\":\"One warmed desktop/Node run; no hard CI timing threshold. Includes bs_render event handling and bounded steal tails, excludes host messaging/copies, device latency, UI, and thermal effects. Fixed 128-frame blocks; OS scheduling can affect maxima.\"\n}\n";
 return out?0:5;
}
