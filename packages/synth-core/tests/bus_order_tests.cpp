#include "blocks_synth.h"
#include "blocks_bass_support.h"
#include "../src/bus_order.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <new>
#include <vector>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(auto*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));for(auto kv:{std::pair<unsigned,float>{BS_GAIN,.1f},{BS_ATTACK,.001f},{BS_DECAY,.001f},{BS_SUSTAIN_LEVEL,1},{BS_RELEASE,.001f},{BS_OSC1_LEVEL,.5f},{BS_OSC2_LEVEL,0},{BS_FILTER_MIX,0},{BS_DRIFT_CENTS,0},{BS_SETTLING_CENTS,0},{BS_FULLNESS,0}})CHECK(bs_set_parameter(p,kv.first,kv.second));bs_reset(p);}~Synth(){bs_destroy(p);}};
static std::vector<float> render(bs_synth*s,unsigned n,unsigned block=127){std::vector<float>v(2*n);for(unsigned i=0;i<n;i+=block){watch=true;CHECK(!bs_render(s,v.data()+i,v.data()+n+i,std::min(block,n-i),nullptr,0));watch=false;}for(auto x:v)CHECK(std::isfinite(x)&&std::abs(x)<=1);return v;}
static void effects(bs_synth*s){bs_creative_fx_config c{};bs_default_creative_fx(&c);c.count=1;CHECK(bs_default_creative_fx_block(1,&c.blocks[0]));c.blocks[0].mix=.8f;CHECK(bs_set_creative_fx(s,&c));bs_harmonics_suite_config h{};bs_default_harmonics_suite(&h);h.enabled=1;h.colour_enabled=1;h.drive_db=18;CHECK(bs_set_harmonics_suite(s,&h));bs_delay_config d{};bs_default_delay(&d);d.enabled=1;d.wet=.4f;d.time_seconds=.02f;d.feedback=.3f;CHECK(bs_set_delay(s,&d));}
int main(){static_assert(sizeof(bs_bus_order_config)==16);
 {blocks_detail::BusOrder b;b.prepare(48000);CHECK(b.tick()==1);CHECK(b.configure({1,{2,0,1}}));for(unsigned i=1;i<=240;++i){double g=b.tick();CHECK(std::abs(g-(240-i)/240.)<1e-15);if(i<240)CHECK(b.active().order[0]==0);}CHECK(b.active().order[0]==2);for(unsigned i=1;i<=240;++i)CHECK(b.tick()==i/240.);CHECK(b.configure({1,{1,0,2}}));for(unsigned i=0;i<60;++i)b.tick();double prior=b.tick();CHECK(b.configure({1,{2,0,1}}));CHECK(b.tick()>prior);CHECK(b.active().order[0]==2);b.reset();CHECK(b.tick()==1);}
 std::puts("PASS exact5ms fade boundaries, switch atzero and cancel reverse without history reset");
 {Synth s;bs_bus_order_config c{},got{};bs_default_bus_order(&c);CHECK(bs_set_bus_order(s.p,&c)&&bs_get_bus_order(s.p,&got)&&!std::memcmp(&c,&got,sizeof c));for(auto bad:{bs_bus_order_config{1,{0,0,2}},bs_bus_order_config{1,{0,1,3}},bs_bus_order_config{2,{0,1,2}}}){CHECK(!bs_set_bus_order(s.p,&bad));CHECK(bs_get_bus_order(s.p,&got)&&!std::memcmp(&c,&got,sizeof c));}CHECK(bs_output_latency(s.p)==72);}
 std::puts("PASS atomic permutation ABI and unchanged declared output latency");
 {std::array<unsigned,3>o{{0,1,2}};std::vector<float>reference;do{Synth s;bs_bus_order_config c{1,{o[0],o[1],o[2]}};CHECK(bs_set_bus_order(s.p,&c));bs_reset(s.p);bs_note_on(s.p,0,48,.8f);auto pcm=render(s.p,3072);if(reference.empty())reference=pcm;else CHECK(reference==pcm);}while(std::next_permutation(o.begin(),o.end()));}
 std::puts("PASS allsix neutral group orders preserve exact audio and common latency");
 {Synth a,b;effects(a.p);effects(b.p);bs_bus_order_config reverse{1,{2,1,0}};CHECK(bs_set_bus_order(b.p,&reverse));for(auto*s:{a.p,b.p}){bs_reset(s);bs_note_on(s,0,48,.8f);}auto x=render(a.p,6000),y=render(b.p,6000);double difference=0;for(unsigned i=0;i<x.size();++i)difference+=std::abs(x[i]-y[i]);std::printf("METRIC reordered nonlinear chain PCM difference %.9g\n",difference);CHECK(difference>.1);}
 std::puts("PASS actual nonlinearity/delay order changes audio rather than labels alone");
 {Synth a,b;effects(a.p);effects(b.p);for(auto*s:{a.p,b.p})bs_note_on(s,0,48,.7f);CHECK(render(a.p,2048,1)==render(b.p,2048,128));for(auto c:{bs_bus_order_config{1,{2,0,1}},bs_bus_order_config{1,{1,2,0}},bs_bus_order_config{1,{0,1,2}}}){for(auto*s:{a.p,b.p}){watch=true;CHECK(bs_set_bus_order(s,&c));watch=false;}CHECK(render(a.p,160,1)==render(b.p,160,127));}CHECK(render(a.p,4096,17)==render(b.p,4096,256));CHECK(bs_active_voices(a.p)==1&&bs_active_voices(b.p)==1);for(auto*s:{a.p,b.p})bs_note_off(s,0,48);CHECK(render(a.p,2048,1)==render(b.p,2048,128));for(auto*s:{a.p,b.p})bs_panic(s);for(float x:render(a.p,1024))CHECK(x==0);CHECK(allocations==0);}
 std::puts("PASS live latest-order retarget, release, panic and zero-allocation block invariance");
 {Synth s;bs_delay_config d{};bs_default_delay(&d);d.enabled=1;d.wet=1;d.time_seconds=.1f;d.feedback=.4f;CHECK(bs_set_delay(s.p,&d));bs_note_on(s.p,0,48,.8f);render(s.p,4096);bs_note_off(s.p,0,48);render(s.p,128);bs_bus_order_config order{1,{2,0,1}};CHECK(bs_set_bus_order(s.p,&order));auto tail=render(s.p,8192);double energy=0;for(auto x:tail)energy+=x*x;CHECK(energy>1e-6);}
 std::puts("PASS reorder preserves delayed history and released tails");
 {Synth a,b;for(auto*s:{a.p,b.p}){bs_set_parameter(s,BS_OSC1_LEVEL,0);bs_sub_config sub{};bs_default_sub(&sub);sub.enabled=1;sub.level=.4f;sub.routing=0;CHECK(bs_set_sub(s,&sub));bs_reset(s);bs_note_on(s,0,60,.7f);}CHECK(render(a.p,2048)==render(b.p,2048));bs_bus_order_config c{1,{2,1,0}};CHECK(bs_set_bus_order(b.p,&c));CHECK(render(a.p,4096,1)==render(b.p,4096,256));}
 std::puts("PASS Clean Sub remains aligned and bypasses main-bus reorder fades exactly");
}
