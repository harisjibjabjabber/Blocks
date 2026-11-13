#include "blocks_synth.h"
#include "../src/creative_fx_rack.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <vector>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
using blocks_detail::CreativeFXRack;
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));for(auto kv:{std::pair<unsigned,float>{BS_GAIN,.1f},{BS_ATTACK,.001f},{BS_DECAY,.001f},{BS_SUSTAIN_LEVEL,1},{BS_OSC1_LEVEL,.5f},{BS_OSC2_LEVEL,0},{BS_FILTER_MIX,0},{BS_DRIFT_CENTS,0},{BS_SETTLING_CENTS,0},{BS_FULLNESS,0}})CHECK(bs_set_parameter(p,kv.first,kv.second));bs_reset(p);}~Synth(){bs_destroy(p);}};
static std::vector<float> render(bs_synth*s,unsigned n,unsigned block=127){std::vector<float>v(2*n);for(unsigned i=0;i<n;i+=block)CHECK(!bs_render(s,v.data()+i,v.data()+n+i,std::min(block,n-i),nullptr,0));return v;}
int main(){
 {auto a=std::make_unique<CreativeFXRack>(),b=std::make_unique<CreativeFXRack>();CHECK(a->prepare(48000)&&b->prepare(48000));for(unsigned i=0;i<128;++i){double l=.1,r=.07;a->process(l,r);l=.1;r=.07;b->process(l,r);}auto c=CreativeFXRack::defaults();c.count=1;c.blocks[0]=CreativeFXRack::blockDefaults(1);CHECK(a->configure(c)&&b->configure(c));double error=0;for(unsigned i=0;i<5000;++i){if(i%64==0)CHECK(b->configure(c));double l=.2*std::sin(i*.08),r=l*.7,x=l,y=r;a->process(l,r);b->process(x,y);error=std::max({error,std::abs(l-x),std::abs(r-y)});}std::printf("METRIC repeated configure topology maximum error %.12g\n",error);CHECK(error==0);}
 std::puts("PASS repeated control-bus configure calls cannot restart a topology fade-in");
 {Synth a,b;bs_modulation_config_v4 m{};bs_default_modulation_v4(&m);m.sources[0].enabled=1;m.sources[0].route_count=1;m.sources[0].routes[0]={4,23,0,0,2};CHECK(bs_set_modulation_v4(b.p,&m));for(auto*s:{a.p,b.p})bs_note_on(s,0,60,.7f);CHECK(render(a.p,2048)==render(b.p,2048));bs_creative_fx_config c{};bs_default_creative_fx(&c);c.count=1;CHECK(bs_default_creative_fx_block(1,&c.blocks[0]));for(auto*s:{a.p,b.p})CHECK(bs_set_creative_fx(s,&c));auto x=render(a.p,6000,1),y=render(b.p,6000,256);double error=0;for(unsigned i=0;i<x.size();++i)error=std::max(error,std::abs(double(x[i])-y[i]));std::printf("METRIC held synth with unrelated workspace route error %.12g\n",error);CHECK(error==0);c.blocks[0].mix=.2f;c.blocks[0].click=.9f;for(auto*s:{a.p,b.p})CHECK(bs_set_creative_fx(s,&c));CHECK(render(a.p,3000,1)==render(b.p,3000,127));CHECK(bs_active_voices(a.p)==1&&bs_active_voices(b.p)==1);}
 std::puts("PASS actual held-note effects and live numeric edits update identically with unrelated modulation active");
}
