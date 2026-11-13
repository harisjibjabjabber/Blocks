#include "blocks_synth.h"
#include "blocks_sauce.h"
#include "blocks_modulation.h"
#include "blocks_notes.h"
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
struct Result { double sum=0,peak=0,configMs=0;unsigned configChanges=0,observedVoices=0;std::vector<double> blocks; };
double quantile(std::vector<double> values,double fraction) {
 std::sort(values.begin(),values.end());return values[size_t(std::ceil(fraction*(values.size()-1)))];
}
bool run(bs_synth*s,unsigned voices,bool dense,bool measured,Result&result,bs_sauce_config*rackEdits=nullptr) {
 std::array<float,block> left{},right{};
 const unsigned period=4800;unsigned nextEdit=0;
 for(unsigned start=0;start<frames;start+=block) {
  if(rackEdits&&start>=nextEdit){std::reverse(rackEdits->blocks,rackEdits->blocks+rackEdits->count);const auto begin=Clock::now();const int accepted=bs_set_sauce(s,rackEdits);const auto end=Clock::now();if(!accepted)return false;if(measured){result.configMs+=std::chrono::duration<double,std::milli>(end-begin).count();++result.configChanges;}nextEdit+=period;}
  std::array<bs_event,64> events{};unsigned count=0;
  if(dense)for(unsigned offset=0;offset<block&&start+offset<frames;++offset)if((start+offset)%period==0){
   // More attacks than note slots; paired releases exercise stolen ownership.
   for(unsigned key=0;key<24;++key)events[count++]={offset,BS_NOTE_OFF,0,48+key,0,0};
   for(unsigned key=0;key<24;++key)events[count++]={offset,BS_NOTE_ON,0,48+key,0,.65f};
  }
  const unsigned n=std::min(block,frames-start);
  const auto begin=Clock::now();const int rejected=bs_render(s,left.data(),right.data(),n,events.data(),count);const auto end=Clock::now();
  if(rejected)return false;result.observedVoices=std::max(result.observedVoices,bs_active_voices(s));
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
 if(argc!=2||bs_abi_version()!=7||bs_parameter_count()!=44){std::cerr<<"Usage: benchmark_core output.json (ABI7 required)\n";return 1;}
 std::ofstream out(argv[1]);if(!out)return 2;
 out<<std::setprecision(10)<<"{\n\"fixtureVersion\":4,\n\"kind\":\"Offline core timing, not a phone or audio-device benchmark\",\n\"abiVersion\":"<<bs_abi_version()<<",\n\"sampleRate\":"<<rate<<",\n\"blockFrames\":"<<block<<",\n\"audioBlockBudgetMs\":"<<1000.0*block/rate<<",\n\"cases\":[\n";
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

 // Saturated held-note pools exercise the new scheduler separately from tone.
 for(unsigned mode=0;mode<3;++mode){
  bs_synth*s=bs_create();if(!s||!bs_prepare(s,rate))return 6;
  bs_performance_config config{};bs_default_performance(&config);config.mode=mode==0?BS_PERFORMANCE_OFF:mode==1?BS_ARP:BS_STRUM;config.mono=mode==0;config.bpm=240;config.division=64;config.triplet=0;config.curl=.8f;config.strum_ms=100;config.randomness=1;
  if(!bs_set_performance(s,&config))return 7;
  for(unsigned key=0;key<128;++key)bs_note_on(s,0,key,.65f);
  Result result;if(!run(s,128,true,false,result))return 8;
  for(unsigned repeat=0;repeat<3;++repeat)if(!run(s,128,true,true,result))return 8;
  bs_panic(s);bs_destroy(s);
  const double maximum=*std::max_element(result.blocks.begin(),result.blocks.end());
  out<<",\n{\"performanceMode\":\""<<(mode==0?"mono":mode==1?"arp":"strum")<<"\",\"heldNotePool\":128,\"bpm\":240,\"division\":\"1/64\",\"curl\":0.8,\"denseRetriggers\":true,\"measuredAudioSeconds\":3,\"renderMsPerAudioSecond\":"<<result.sum/3<<",\"blockMsP50\":"<<quantile(result.blocks,.5)<<",\"blockMsP95\":"<<quantile(result.blocks,.95)<<",\"blockMsP99\":"<<quantile(result.blocks,.99)<<",\"blockMsMax\":"<<maximum<<",\"peak\":"<<result.peak<<'}';
 }

 // Current fixture4 uses Studio sources, a Fullness-only rack and SuiteOff.
 // Older mixed-Drive fixtures are not an identical-sound timing baseline.
 const char*stressNames[]={"audio16-fullness-held","audio16-fullness-live-reorder","lfo4-routes8-dense","notes16-arp-dense","notes4-strum-dense","combined-audio8-lfo4-notes4"};
 for(unsigned kind=0;kind<6;++kind){
  bs_synth*s=bs_create();if(!s||!bs_prepare(s,rate))return 9;
  bs_set_parameter(s,BS_ATTACK,.003f);bs_set_parameter(s,BS_RELEASE,.1f);bs_set_parameter(s,BS_SUSTAIN_LEVEL,.65f);
  const unsigned audioBlocks=kind<2?16:kind==5?8:0,lfoSources=(kind==2||kind==5)?4:0,noteBlocks=kind==3?16:(kind==4||kind==5)?4:0;
  const unsigned heldInputs=noteBlocks?128:16;const bool dense=kind!=0;
  bs_sauce_config rack{};bs_default_sauce(&rack);rack.count=audioBlocks;
  for(unsigned i=0;i<audioBlocks;++i){const bool fullness=kind==0||i%2;rack.blocks[i]={i+1,BS_SAUCE_FULLNESS,0,1,fullness?.5f:.2f};}
  if(!bs_set_sauce(s,&rack))return 10;
  bs_modulation_config_v4 modulation{};bs_default_modulation_v4(&modulation);modulation.source_count=lfoSources;const auto sourceDefaults=modulation.sources[0];
  const unsigned targets[]={0,2,3,11,14,13,18,24};
  for(unsigned i=0;i<lfoSources;++i){auto&source=modulation.sources[i];source=sourceDefaults;source.id=i+1;source.enabled=1;source.waveform=i==3?BS_LFO_SMOOTH_RANDOM:i;source.synced=0;source.division=4;source.triplet=0;source.rate_hz=float(i+1);source.intensity=.5f;source.route_count=8;for(unsigned j=0;j<8;++j)source.routes[j]={0,0,targets[j],.2f};}
  if(!bs_set_modulation_v4(s,&modulation))return 11;
  bs_notes_config notes{};bs_default_notes(&notes);notes.count=noteBlocks;
  for(unsigned i=0;i<noteBlocks;++i){auto&node=notes.blocks[i];node.id=i+1;node.type=kind==4?BS_NOTE_STRUM:BS_NOTE_ARP;node.enabled=1;bs_default_performance(&node.perf);node.perf.mode=kind==4?BS_STRUM:BS_ARP;node.perf.bpm=240;node.perf.division=64;node.perf.triplet=0;node.perf.curl=.8f;node.perf.gate=.95f;node.perf.strum_ms=100;node.perf.randomness=1;}
  if(!bs_set_notes(s,&notes))return 12;bs_reset(s);
  for(unsigned i=0;i<heldInputs;++i)bs_note_on(s,0,noteBlocks?i:48+i,.65f);
  Result result;auto*edits=kind==1?&rack:nullptr;if(!run(s,heldInputs,dense,false,result,edits))return 13;
  for(unsigned repeat=0;repeat<3;++repeat)if(!run(s,heldInputs,dense,true,result,edits))return 13;
  bs_panic(s);bs_destroy(s);
  out<<",\n{\"stressCase\":\""<<stressNames[kind]<<"\",\"audioBlocks\":"<<audioBlocks<<",\"lfoSources\":"<<lfoSources<<",\"routesPerLfo\":"<<(lfoSources?8:0)<<",\"noteBlocks\":"<<noteBlocks<<",\"heldInputNotes\":"<<heldInputs<<",\"observedBlockEndVoices\":"<<result.observedVoices<<",\"silentOutput\":"<<(result.peak<1e-12?"true":"false")<<",\"denseRetriggers\":"<<(dense?"true":"false")<<",\"liveRackEdits\":"<<(edits?"true":"false")<<",\"measuredAudioSeconds\":3,\"renderMsPerAudioSecond\":"<<result.sum/3<<",\"blockMsP50\":"<<quantile(result.blocks,.5)<<",\"blockMsP95\":"<<quantile(result.blocks,.95)<<",\"blockMsP99\":"<<quantile(result.blocks,.99)<<",\"blockMsMax\":"<<*std::max_element(result.blocks.begin(),result.blocks.end())<<",\"configurationMsTotal\":"<<result.configMs<<",\"configurationChanges\":"<<result.configChanges<<",\"peak\":"<<result.peak<<'}';
 }

 // Fixture3 adds paired identical16voice loads; only FilterMode differs.
 // Fixed resonance/cutoff, same initial state/events, no aggregate old/new mean.
 for(unsigned kind=0;kind<3;++kind)for(unsigned mode=0;mode<2;++mode){
  bs_synth*s=bs_create();if(!s||!bs_prepare(s,rate))return 14;
  bs_set_parameter(s,BS_FILTER_MODE,float(mode));bs_set_parameter(s,BS_FILTER_RESONANCE,.75f);bs_set_parameter(s,BS_CUTOFF,1200);
  bs_set_parameter(s,BS_ATTACK,.003f);bs_set_parameter(s,BS_RELEASE,.1f);bs_set_parameter(s,BS_SUSTAIN_LEVEL,.65f);
  if(kind==1){bs_set_parameter(s,BS_FILTER_AMOUNT,36);bs_set_parameter(s,BS_FILTER_ATTACK,.02f);bs_set_parameter(s,BS_FILTER_DECAY,.3f);bs_set_parameter(s,BS_FILTER_SUSTAIN,.4f);}
  bs_sauce_config rack{};bs_default_sauce(&rack);
  if(kind==2){rack.count=16;for(unsigned i=0;i<16;++i)rack.blocks[i]={i+1,BS_SAUCE_FULLNESS,0,1,i%2?.5f:.2f};if(!bs_set_sauce(s,&rack))return 15;}
  bs_reset(s);for(unsigned key=0;key<16;++key)bs_note_on(s,0,48+key,.65f);
  Result result;const bool dense=kind!=0;auto*edits=kind==2?&rack:nullptr;
  if(!run(s,16,dense,false,result,edits))return 16;
  for(unsigned repeat=0;repeat<3;++repeat)if(!run(s,16,dense,true,result,edits))return 16;
  bs_panic(s);bs_destroy(s);
  out<<",\n{\"filterComparison\":\""<<(kind==0?"held-eg0":kind==1?"dense-active-eg":"audio16-fullness-live-reorder")<<"\",\"filterMode\":"<<mode<<",\"resonance\":0.75,\"cutoffHz\":1200,\"voices\":16,\"observedBlockEndVoices\":"<<result.observedVoices<<",\"silentOutput\":"<<(result.peak<1e-12?"true":"false")<<",\"denseRetriggers\":"<<(dense?"true":"false")<<",\"measuredAudioSeconds\":3,\"renderMsPerAudioSecond\":"<<result.sum/3<<",\"blockMsP50\":"<<quantile(result.blocks,.5)<<",\"blockMsP95\":"<<quantile(result.blocks,.95)<<",\"blockMsP99\":"<<quantile(result.blocks,.99)<<",\"blockMsMax\":"<<*std::max_element(result.blocks.begin(),result.blocks.end())<<",\"configurationMsTotal\":"<<result.configMs<<",\"configurationChanges\":"<<result.configChanges<<",\"peak\":"<<result.peak<<'}';
 }
 out<<"\n],\n\"limits\":\"One warmed desktop/Node run; no hard CI timing threshold. Includes bs_render event handling and bounded steal tails, excludes host messaging/copies, device latency, UI, and thermal effects. Fixed 128-frame blocks; OS scheduling can affect maxima. Fixture3 retains51 existing cases and adds6 paired16voice filter cases; historical timings are comparable only for identical settings and runtime/source context. Configuration calls are timed separately, never folded into render percentiles. Live rack edits occur about every100ms at block boundaries; peaks/observed voices include warmup. Silent scheduler output is reported honestly through peak/observed voice fields, not treated as full-polyphony rendering.\"\n}\n";
 return out?0:5;
}
