#include "blocks_synth.h"
#include "blocks_osc_bass.h"
#include "../src/numeric_divisions.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth{bs_synth*s=bs_create();Synth(){CHECK(s&&bs_prepare(s,48000));for(auto p:{std::pair<unsigned,float>{BS_GAIN,.12f},{BS_OSC1_LEVEL,.5f},{BS_OSC2_LEVEL,0},{BS_FILTER_MIX,0},{BS_FULLNESS_ENABLED,0},{BS_DRIFT_CENTS,0},{BS_SETTLING_CENTS,0},{BS_ATTACK,.001f},{BS_SUSTAIN_LEVEL,1},{BS_RELEASE,.01f}})CHECK(bs_set_parameter(s,p.first,p.second));bs_reset(s);}~Synth(){bs_destroy(s);}};
static std::vector<float> render(bs_synth*s,unsigned n,unsigned block=127){std::vector<float>a(n*2);for(unsigned i=0;i<n;i+=block)CHECK(!bs_render(s,a.data()+i,a.data()+n+i,std::min(block,n-i),nullptr,0));for(float v:a)CHECK(std::isfinite(v)&&std::abs(v)<1);return a;}
static bs_modulation_config_v4 constant(unsigned kind,unsigned id,unsigned parameter,float depth){bs_modulation_config_v4 c{};bs_default_modulation_v4(&c);for(auto&l:c.sources)l.route_count=0;auto&l=c.sources[0];l.enabled=1;l.synced=0;l.waveform=BS_LFO_CUSTOM;l.point_count=2;l.points[0]={0,1,0};l.points[1]={1,1,0};l.route_count=1;l.routes[0]={kind,id,parameter,depth};return c;}
static unsigned onset(const std::vector<float>&x){unsigned n=x.size()/2;for(unsigned i=0;i<n;i++)if(std::abs(x[i])>1e-5)return i;return n;}
int main(){
 for(auto key:{std::array<unsigned,3>{4,26,2},{4,27,2},{4,21,10},{4,24,9},{4,25,9},{2,2,2}}){const auto*p=bs_modulation_target_info(key[0],key[1],key[2]);CHECK(p&&p->mapping==BS_DISCRETE&&p->scope==0);}
 std::puts("PASS numeric metadata exposes only actual bounded count/division destinations");
 {Synth a,b;bs_voicing_config_v2 v{};bs_default_voicing_v2(&v);v.oscillators[0].detune_cents=12;v.oscillators[0].spread=.6f;CHECK(bs_set_voicing_v2(a.s,&v)&&bs_set_voicing_v2(b.s,&v));bs_note_on(a.s,0,48,.8f);bs_note_on(b.s,0,48,.8f);CHECK(render(a.s,5000)==render(b.s,5000));auto c=constant(4,26,2,.5f);CHECK(bs_set_modulation_v4(b.s,&c));CHECK(render(a.s,6000)==render(b.s,6000));CHECK(bs_get_modulated_target_value(b.s,4,26,2)==4);CHECK(bs_active_voices(a.s)==bs_active_voices(b.s));bs_voicing_config_v2 got{};CHECK(bs_get_voicing_v2(b.s,&got)&&!std::memcmp(&v,&got,sizeof v));bs_note_on(a.s,0,60,.8f);bs_note_on(b.s,0,60,.8f);CHECK(render(a.s,12000)!=render(b.s,12000));CHECK(bs_active_voices(a.s)==bs_active_voices(b.s));}
 std::puts("PASS unison count modulation changes subsequent attacks, leaves held PCM and saved count unchanged");
 {Synth s;auto c=constant(2,2,2,2.f/9);c.source_count=2;c.sources[1]=c.sources[0];c.sources[1].id=2;c.sources[1].route_count=0;c.sources[1].synced=1;c.sources[1].division=4;c.sources[1].triplet=0;CHECK(bs_set_modulation_v4(s.s,&c));render(s.s,6000);CHECK(std::abs(bs_get_modulated_target_value(s.s,2,2,0)-4)<.001);CHECK(bs_get_modulated_target_value(s.s,2,2,2)==4);auto phase=bs_get_modulation_phase(s.s,2);c.sources[0].routes[0].depth=0;CHECK(bs_set_modulation_v4(s.s,&c));CHECK(bs_get_modulation_phase(s.s,2)==phase);render(s.s,4800);CHECK(std::abs(bs_get_modulated_target_value(s.s,2,2,0)-2)<.001);bs_modulation_config_v4 got{};CHECK(bs_get_modulation_v4(s.s,&got)&&got.sources[1].division==4);}
 std::puts("PASS synced LFO division changes actual clock rate without phase restart or saved-clock mutation");
 {Synth a,b;bs_delay_config d{};bs_default_delay(&d);d.enabled=1;d.synced=1;d.division=4;d.triplet=0;d.wet=1;d.feedback=0;CHECK(bs_set_delay(a.s,&d)&&bs_set_delay(b.s,&d));auto c=constant(4,21,10,2.f/7);CHECK(bs_set_modulation_v4(b.s,&c));render(a.s,10000);render(b.s,10000);bs_note_on(a.s,0,60,.7f);bs_note_on(b.s,0,60,.7f);auto x=render(a.s,30000),y=render(b.s,30000);unsigned old=onset(x),now=onset(y);std::printf("METRIC Delay first echo %u -> %u samples\n",old,now);CHECK(old>23900&&old<24300&&now>11900&&now<12300);bs_delay_config got{};CHECK(bs_get_delay(b.s,&got)&&!std::memcmp(&got,&d,sizeof d));}
 std::puts("PASS Delay division changes actual first-echo time while retaining requested sync setting");
 {Synth s;bs_osc_bass_config_v2 b{};bs_default_osc_bass_v2(&b);auto&e=b.oscillators[0];e.enabled=1;e.synced=1;e.cycle_beats=1;CHECK(bs_set_osc_bass_v2(s.s,&b));const auto list=blocks_detail::bassDivisions(4);unsigned old=blocks_detail::bassDivisionIndex(list,1),next=blocks_detail::bassDivisionIndex(list,.5);auto c=constant(4,24,9,float(next-old)/(list.count-1));CHECK(bs_set_modulation_v4(s.s,&c));render(s.s,12000);CHECK(std::abs(bs_get_osc_bass_rate(s.s,0)-4)<.001);auto phase=bs_get_osc_bass_raw_phase(s.s,0);c.sources[0].routes[0].depth=0;CHECK(bs_set_modulation_v4(s.s,&c));CHECK(bs_get_osc_bass_raw_phase(s.s,0)==phase);render(s.s,12000);CHECK(std::abs(bs_get_osc_bass_rate(s.s,0)-2)<.001);bs_osc_bass_config_v2 got{};CHECK(bs_get_osc_bass_v2(s.s,&got)&&!std::memcmp(&b,&got,sizeof b));e.synced=0;e.spin_hz=3;CHECK(bs_set_osc_bass_v2(s.s,&b));c.sources[0].routes[0].depth=1;CHECK(bs_set_modulation_v4(s.s,&c));render(s.s,12000);CHECK(std::abs(bs_get_osc_bass_rate(s.s,0)-3)<.001);}
 std::puts("PASS Bass division changes actual synced spin, keeps phase and requested duration, ignores Free clocks");
 {Synth a,b;auto c=constant(4,26,2,1);CHECK(bs_set_modulation_v4(a.s,&c)&&bs_set_modulation_v4(b.s,&c));render(a.s,512,1);render(b.s,512,256);bs_note_on(a.s,0,48,.8f);bs_note_on(b.s,0,48,.8f);CHECK(render(a.s,12000,1)==render(b.s,12000,256));bs_panic(a.s);render(a.s,5000);CHECK(bs_active_voices(a.s)==0);}
 std::puts("PASS numeric modulation remains block-exact and panic retains no voices");
}

