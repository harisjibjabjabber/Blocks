#include "blocks_synth.h"
#include "blocks_envelopes.h"
#include "../src/modulation.h"
#include <array>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <new>
#include <vector>
static bool watch=false;static unsigned allocations=0;
void* operator new(std::size_t n){if(watch)++allocations;if(void*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
static void near(double a,double b,double e=1e-6){if(std::abs(a-b)>e){std::printf("actual %.17g expected %.17g\n",a,b);CHECK(false);}}
static auto config(float wave,unsigned polarity,float depth=.5f){auto c=blocks_detail::defaultModulationV4();auto&s=c.sources[0];s.enabled=1;s.waveform=BS_LFO_CUSTOM;s.intensity=.25f;s.point_count=2;s.points[0]={0,wave,0};s.points[1]={1,wave,0};s.route_count=1;s.routes[0]={0,0,BS_GAIN,depth,polarity};return c;}
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));bs_set_parameter(p,BS_ATTACK,.001f);bs_set_parameter(p,BS_DECAY,.001f);bs_set_parameter(p,BS_RELEASE,.001f);bs_set_parameter(p,BS_SUSTAIN_LEVEL,1);bs_set_parameter(p,BS_FILTER_MIX,0);bs_set_parameter(p,BS_DRIFT_CENTS,0);bs_set_parameter(p,BS_SETTLING_CENTS,0);}~Synth(){bs_destroy(p);}};
static std::vector<float> render(bs_synth*s,unsigned n,unsigned block=127){std::vector<float>a(n),r(n);for(unsigned i=0;i<n;i+=block){watch=true;CHECK(bs_render(s,a.data()+i,r.data()+i,std::min(block,n-i),nullptr,0)==0);watch=false;}for(float v:a)CHECK(std::isfinite(v)&&std::abs(v)<=1);return a;}
int main(){
 static_assert(sizeof(bs_lfo_route_v4)==20&&sizeof(bs_modulation_config_v4)==4280&&sizeof(bs_envelopes_config)==2036);
 for(float wave:{-1.f,0.f,1.f})for(unsigned polarity:{0u,1u,2u})for(float depth:{-.5f,.5f}){blocks_detail::Modulation m;auto c=config(wave,polarity,depth);CHECK(m.configure(c));near(m.tick(48000,120)[BS_GAIN],(polarity==1?(wave+1)*.5:wave)*.25*depth);near(m.value(1),wave*.25);c.sources[0].intensity=0;CHECK(m.configure(c));near(m.tick(48000,120)[BS_GAIN],0);c.sources[0].intensity=1;c.sources[0].enabled=0;CHECK(m.configure(c));near(m.tick(48000,120)[BS_GAIN],0);}
 std::puts("PASS LFO polarity precedes intensity; signed depth, zero intensity and power-off are exact");
 {auto c=config(0,1);c.sources[0].route_count=4;c.sources[0].routes[0]={1,9,0,-.5f,1};c.sources[0].routes[1]={3,10,0,.5f,1};c.sources[0].routes[2]={4,23,0,.5f,1};c.sources[0].routes[3]={2,1,1,-.5f,1};blocks_detail::Modulation m;CHECK(m.configure(c));m.tick(48000,120);near(m.sauceOffset(9),-.0625);near(m.effectOffset(10),.0625);CHECK(m.targetOffset(4,23,0)>0&&m.targetOffset(4,23,0)<.0625);const double before=m.control(1,1);m.tick(48000,120);CHECK(m.control(1,1)<before);}
 std::puts("PASS unified Sauce/effect/config and prior-sample feedback use the same polarity conversion");
 {Synth s;auto c=config(0,1);c.sources[0].route_count=32;for(unsigned i=0;i<32;++i)c.sources[0].routes[i]={1,i+1,0,.1f,i%3};watch=true;CHECK(bs_set_modulation_v4(s.p,&c));watch=false;bs_modulation_config_v4 got{};CHECK(bs_get_modulation_v4(s.p,&got)&&!std::memcmp(&c,&got,sizeof c));auto bad=c;bad.sources[0].routes[31].polarity=3;CHECK(!bs_set_modulation_v4(s.p,&bad));bad=c;bad.sources[0].route_count=33;CHECK(!bs_set_modulation_v4(s.p,&bad));CHECK(bs_get_modulation_v4(s.p,&got)&&!std::memcmp(&c,&got,sizeof c));bs_envelopes_config e{};bs_default_envelopes(&e);e.sources[2].route_count=32;for(unsigned i=0;i<32;++i)e.sources[2].routes[i]=c.sources[0].routes[i];CHECK(bs_set_envelopes(s.p,&e));auto eb=e;eb.sources[2].routes[31].polarity=3;CHECK(!bs_set_envelopes(s.p,&eb));bs_envelopes_config eg{};CHECK(bs_get_envelopes(s.p,&eg)&&!std::memcmp(&e,&eg,sizeof e));}
 std::puts("PASS 32-route native roundtrip and invalid mode/capacity reject atomically");
 for(unsigned polarity:{0u,1u,2u})for(float depth:{-.2f,.2f}){Synth s;bs_envelopes_config e{};bs_default_envelopes(&e);e.sources[0].release=.001f;e.sources[2].attack=.001f;e.sources[2].decay=.001f;e.sources[2].sustain=.25f;e.sources[2].route_count=2;e.sources[2].routes[0]={4,30,0,depth,polarity};e.sources[2].routes[1]={4,23,0,depth,polarity};CHECK(bs_set_envelopes(s.p,&e));render(s.p,4096);near(bs_get_modulated_target_value(s.p,4,23,0),1);bs_note_on(s.p,0,60,.5f);render(s.p,8192);const double signal=polarity==2?-.5:.25;near(bs_get_modulated_target_value(s.p,4,30,0),signal*depth*200,1e-4);near(bs_get_modulated_target_value(s.p,4,23,0),1+signal*depth*2,1e-4);bs_note_off(s.p,0,60);render(s.p,8192);CHECK(bs_active_voices(s.p)==0);near(bs_get_modulated_target_value(s.p,4,23,0),1,1e-4);bs_panic(s.p);render(s.p,512);near(bs_get_modulated_target_value(s.p,4,23,0),1,1e-4);}
 std::puts("PASS ENV native/uni/bipolar effective pitch and bus telemetry, idle/release/panic return to base");
 {Synth a,b;auto c=config(.3f,1,-.3f);c.sources[0].routes[0]={4,30,0,-.3f,1};for(auto*s:{a.p,b.p}){CHECK(bs_set_modulation_v4(s,&c));bs_envelopes_config e{};bs_default_envelopes(&e);e.sources[2].route_count=1;e.sources[2].routes[0]={4,11,0,.2f,2};CHECK(bs_set_envelopes(s,&e));bs_note_on(s,0,60,.7f);}auto x=render(a.p,4096,1),y=render(b.p,4096,256);CHECK(x==y);c.sources[0].routes[0].polarity=2;CHECK(bs_set_modulation_v4(a.p,&c)&&bs_set_modulation_v4(b.p,&c));CHECK(render(a.p,4096,17)==render(b.p,4096,127));bs_note_off(a.p,0,60);bs_note_off(b.p,0,60);CHECK(render(a.p,4096,1)==render(b.p,4096,256));}
 {auto c=config(.3f,1);c.source_count=4;for(unsigned i=0;i<4;++i){c.sources[i]=c.sources[0];auto&s=c.sources[i];s.id=i+1;s.routes[0]={0,0,BS_GAIN,i%2?-.2f:.3f,i%3};s.route_count=2;s.routes[1]={2,(i+1)%4+1,1,.1f,(i+1)%3};}std::array<unsigned,4> order{{0,1,2,3}};do{blocks_detail::Modulation a,b;auto permuted=c;for(unsigned i=0;i<4;++i)permuted.sources[i]=c.sources[order[i]];CHECK(a.configure(c)&&b.configure(permuted));for(unsigned frame=0;frame<256;++frame){CHECK(a.tick(48000,120)==b.tick(48000,120));for(unsigned id=1;id<=4;++id)CHECK(a.value(id)==b.value(id)&&a.phase(id)==b.phase(id));}}while(std::next_permutation(order.begin(),order.end()));}
 std::puts("PASS mixed-polarity canonical reduction and cyclic feedback are exact for24 source permutations");
 {Synth a,b;auto c=config(.3f,1);c.source_count=4;for(unsigned i=0;i<4;++i){c.sources[i]=c.sources[0];c.sources[i].id=i+1;c.sources[i].route_count=32;for(unsigned j=0;j<32;++j)c.sources[i].routes[j]={1,100+i*32+j,0,.3f,1};}CHECK(bs_set_modulation_v4(b.p,&c));for(auto*s:{a.p,b.p})bs_note_on(s,0,60,.7f);CHECK(render(a.p,2048)==render(b.p,2048));}
 std::puts("PASS all128 unique orphan Sauce routes remain inert and within bounded routing storage");
 CHECK(allocations==0);std::puts("PASS actual audio/live polarity edits/release are block invariant with zero render allocations");
}
