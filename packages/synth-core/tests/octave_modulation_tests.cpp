#include "blocks_synth.h"
#include "blocks_tuning.h"
#include "blocks_bass_support.h"
#include "blocks_envelopes.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth {
 bs_synth*s=bs_create();
 explicit Synth(unsigned oscillator){CHECK(s&&bs_prepare(s,48000));
  for(auto setting:{std::pair<unsigned,float>{BS_GAIN,.15f},{BS_OSC1_LEVEL,oscillator==0?.5f:0.f},{BS_OSC2_LEVEL,oscillator==1?.5f:0.f},{BS_OSC1_WAVE,BS_SINE},{BS_OSC2_WAVE,BS_SINE},{BS_FILTER_MIX,0},{BS_FULLNESS_ENABLED,0},{BS_DRIFT_CENTS,0},{BS_SETTLING_CENTS,0},{BS_ATTACK,.001f},{BS_SUSTAIN_LEVEL,1},{BS_RELEASE,.02f}})CHECK(bs_set_parameter(s,setting.first,setting.second));
  bs_tuning_config tuning{};bs_default_tuning(&tuning);tuning.oscillators[2].octave=0;CHECK(bs_set_tuning(s,&tuning));
  if(oscillator==2){bs_sub_config sub{};bs_default_sub(&sub);sub.enabled=1;sub.octave=0;sub.level=.5f;CHECK(bs_set_sub(s,&sub));}bs_reset(s);
 }
 ~Synth(){bs_destroy(s);}
};
static std::vector<float> render(bs_synth*s,unsigned n=12000,unsigned block=127){std::vector<float>a(n*2);for(unsigned i=0;i<n;i+=block)CHECK(bs_render(s,a.data()+i,a.data()+n+i,std::min(block,n-i),nullptr,0)==0);for(float v:a)CHECK(std::isfinite(v)&&std::abs(v)<=.981f);return a;}
static double frequency(const std::vector<float>&a){const unsigned n=a.size()/2;std::vector<double>cross;for(unsigned i=1;i<n;i++)if(a[i-1]<=0&&a[i]>0)cross.push_back(i-1-double(a[i-1])/(a[i]-a[i-1]));CHECK(cross.size()>8);return 48000*(cross.size()-1)/(cross.back()-cross.front());}
static unsigned target(unsigned osc){return osc==2?28:30+osc;}
static unsigned parameter(unsigned osc){return osc==2?2:1;}
static bs_modulation_config_v4 constant(unsigned osc,float depth){bs_modulation_config_v4 c{};bs_default_modulation_v4(&c);for(auto&l:c.sources)l.route_count=0;auto&l=c.sources[0];l.enabled=1;l.synced=0;l.waveform=BS_LFO_CUSTOM;l.point_count=2;l.points[0]={0,1,0};l.points[1]={1,1,0};l.route_count=1;l.routes[0]={4,target(osc),parameter(osc),depth};return c;}
int main(){
 for(unsigned osc=0;osc<3;osc++){const auto*d=bs_modulation_target_info(4,target(osc),parameter(osc));CHECK(d&&d->minimum==-3&&d->maximum==3&&d->mapping==BS_DISCRETE&&d->scope==1);}
 CHECK(!bs_modulation_target_info(4,30,2));CHECK(!bs_modulation_target_info(4,28,3));
 std::puts("PASS octave destination metadata is bounded, stepped and per-voice for Osc1/Osc2/Sub");
 for(unsigned osc=0;osc<3;osc++){
  Synth a(osc),b(osc);auto c=constant(osc,1.f/6);CHECK(bs_set_modulation_v4(b.s,&c));bs_tuning_config requested{};CHECK(bs_get_tuning(b.s,&requested));
  bs_note_on(a.s,0,57,.8f);bs_note_on(b.s,0,57,.8f);render(a.s,6000);render(b.s,6000);const double base=frequency(render(a.s)),shift=frequency(render(b.s));CHECK(std::abs(shift/base-2)<.002);CHECK(std::abs(bs_get_modulated_target_value(b.s,4,target(osc),parameter(osc))-1)<.002);
  bs_tuning_config got{};CHECK(bs_get_tuning(b.s,&got)&&!std::memcmp(&got,&requested,sizeof got));const auto voices=bs_active_voices(b.s);
  c.sources[0].route_count=0;CHECK(bs_set_modulation_v4(b.s,&c));render(b.s,6000);CHECK(std::abs(frequency(render(b.s))/base-1)<.002);CHECK(bs_active_voices(b.s)==voices);
  std::printf("METRIC oscillator %u octave frequencies %.6f -> %.6f; removal restores without voice changes\n",osc,base,shift);
 }
 std::puts("PASS three actual LFO octave destinations double pitch, preserve requested tuning and recover held notes");
 for(unsigned osc=0;osc<3;osc++){
  Synth a(osc),b(osc);bs_envelopes_config env{};CHECK(bs_get_envelopes(b.s,&env));auto&e=env.sources[2];e.attack=.001f;e.decay=.001f;e.sustain=1;e.release=.02f;e.route_count=1;e.routes[0]={4,target(osc),parameter(osc),-1.f/6};CHECK(bs_set_envelopes(b.s,&env));
  bs_note_on(a.s,0,57,.8f);bs_note_on(b.s,0,57,.8f);render(a.s,6000);render(b.s,6000);CHECK(std::abs(frequency(render(b.s))/frequency(render(a.s))-.5)<.002);CHECK(std::abs(bs_get_modulated_target_value(b.s,4,target(osc),parameter(osc))+1)<.002);
 }
 std::puts("PASS Env3 negative octave routing lowers each actual source one octave");
 {Synth a(0),b(0);auto c=constant(0,1);CHECK(bs_set_modulation_v4(a.s,&c)&&bs_set_modulation_v4(b.s,&c));bs_note_on(a.s,0,45,.8f);bs_note_on(b.s,0,45,.8f);CHECK(render(a.s,16000,1)==render(b.s,16000,256));CHECK(bs_get_modulated_target_value(a.s,4,30,1)<=3);bs_panic(a.s);render(a.s,6000);CHECK(bs_active_voices(a.s)==0);}
 std::puts("PASS octave limits, block-exact rendering and panic ownership");
}
