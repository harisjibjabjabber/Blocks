#include "blocks_synth.h"
#include "blocks_bass_support.h"
#include <vector>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <algorithm>
#include <new>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(void*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL%d %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));}~Synth(){bs_destroy(p);}};
static void setup(bs_synth*s){for(auto p:{std::pair<unsigned,float>{BS_OSC1_WAVE,BS_SAW},{BS_OSC1_LEVEL,.7f},{BS_OSC2_LEVEL,0},{BS_GAIN,.15f},{BS_FILTER_MIX,0},{BS_DRIFT_CENTS,0},{BS_SETTLING_CENTS,0},{BS_FULLNESS_ENABLED,0},{BS_ATTACK,.002f},{BS_DECAY,.1f},{BS_SUSTAIN_LEVEL,.6f},{BS_RELEASE,.05f}})bs_set_parameter(s,p.first,p.second);bs_reset(s);}
static std::vector<float> render(bs_synth*s,unsigned n,unsigned block=127){std::vector<float>a(n*2);for(unsigned i=0;i<n;i+=block){watch=true;CHECK(!bs_render(s,a.data()+i,a.data()+n+i,std::min(block,n-i),nullptr,0));watch=false;}for(auto x:a)CHECK(std::isfinite(x)&&std::abs(x)<=.980001f);return a;}
static double energy(const std::vector<float>&a){double e=0;for(auto x:a)e+=double(x)*x;return e/a.size();}
static bs_creative_fx_config config(unsigned count=2){bs_creative_fx_config c{};bs_default_creative_fx(&c);c.count=count;for(unsigned i=0;i<count;++i){CHECK(bs_default_creative_fx_block(i%2,&c.blocks[i]));c.blocks[i].id=i+1;}return c;}
int main(){
 {Synth s;CHECK(sizeof(bs_creative_fx_config)==776&&sizeof(bs_creative_fx_block)==48);bs_creative_fx_config before{},after{};CHECK(bs_get_creative_fx(s.p,&before)&&before.count==0);CHECK(!bs_get_creative_fx(nullptr,&before)&&!bs_set_creative_fx(s.p,nullptr));auto c=config();CHECK(bs_set_creative_fx(s.p,&c));for(unsigned i=0;i<7;++i){auto bad=c;if(i==0)bad.version=2;if(i==1)bad.count=17;if(i==2)bad.blocks[1].id=1;if(i==3)bad.blocks[0].mix=NAN;if(i==4)bad.blocks[0].type=2;if(i==5)bad.blocks[0].pitch=13;if(i==6)bad.blocks[0].output_db=13;watch=true;CHECK(!bs_set_creative_fx(s.p,&bad));watch=false;CHECK(bs_get_creative_fx(s.p,&after)&&!std::memcmp(&c,&after,sizeof c));}CHECK(bs_prepare(s.p,96000));CHECK(bs_get_creative_fx(s.p,&after)&&!std::memcmp(&c,&after,sizeof c));}
 std::puts("PASS CreativeFX776 ABI, atomic validation, unique IDs and prepare retention");
 {Synth a,b;for(auto*s:{a.p,b.p})setup(s);auto c=config();for(unsigned i=0;i<c.count;++i)c.blocks[i].mix=0;CHECK(bs_set_creative_fx(b.p,&c));for(auto*s:{a.p,b.p}){bs_reset(s);bs_note_on(s,0,48,.8f);}CHECK(render(a.p,12000)==render(b.p,12000));}
 std::puts("PASS empty bus and explicit Mix0 preserve actual dry synth exactly");
 {Synth a,b,c;for(auto*s:{a.p,b.p,c.p})setup(s);auto chain=config();CHECK(bs_set_creative_fx(a.p,&chain)&&bs_set_creative_fx(b.p,&chain));std::swap(chain.blocks[0],chain.blocks[1]);CHECK(bs_set_creative_fx(c.p,&chain));for(auto*s:{a.p,b.p,c.p}){bs_reset(s);bs_note_on(s,0,48,.8f);}auto x=render(a.p,12000,1),y=render(b.p,12000,256),z=render(c.p,12000);CHECK(x==y&&x!=z&&energy(x)>1e-7);double difference=0;for(unsigned i=0;i<x.size();++i)difference+=std::pow(double(x[i])-z[i],2);CHECK(difference>1e-7);std::printf("METRIC CreativeFX actual order difference energy %.9g\n",difference);}
 std::puts("PASS real MovingSpace/Impact audio, block invariance and measured processing-order distinction");
 {Synth a,b;for(auto*s:{a.p,b.p}){setup(s);auto c=config(3);c.blocks[2].pitch=-12;CHECK(bs_set_creative_fx(s,&c));bs_reset(s);bs_note_on(s,0,48,.8f);}CHECK(render(a.p,3000,1)==render(b.p,3000,127));auto c=config(3);std::swap(c.blocks[0],c.blocks[2]);for(auto*s:{a.p,b.p}){watch=true;CHECK(bs_set_creative_fx(s,&c));watch=false;}CHECK(render(a.p,3000,1)==render(b.p,3000,256));c.count=0;for(auto*s:{a.p,b.p}){watch=true;CHECK(bs_set_creative_fx(s,&c));watch=false;}CHECK(render(a.p,3000,1)==render(b.p,3000,127));CHECK(bs_active_voices(a.p)==1&&bs_active_voices(b.p)==1);for(auto*s:{a.p,b.p})bs_panic(s);CHECK(energy(render(a.p,4096))==0&&energy(render(b.p,4096))==0);CHECK(allocations==0);}
 std::puts("PASS duplicate nodes, live reorders/deletes retain notes and allocation-free deterministic transitions/panic");
 {Synth a,b;for(auto*s:{a.p,b.p}){setup(s);bs_set_parameter(s,BS_OSC1_LEVEL,0);bs_sub_config sub{};bs_default_sub(&sub);sub.enabled=1;sub.level=.5f;CHECK(bs_set_sub(s,&sub));}auto c=config();CHECK(bs_set_creative_fx(b.p,&c));for(auto*s:{a.p,b.p}){bs_reset(s);bs_note_on(s,0,48,.8f);}CHECK(render(a.p,12000)==render(b.p,12000));}
 std::puts("PASS Clean Sub bypasses creative audio bus with unchanged timing");
 {Synth s;setup(s.p);auto c=config(16);for(auto&b:c.blocks){b.type=1;b.mix=0;}CHECK(bs_set_creative_fx(s.p,&c));bs_reset(s.p);bs_note_on(s.p,0,60,.8f);CHECK(energy(render(s.p,3000))>0);CHECK(allocations==0);}
 std::puts("PASS all16 prepared instances remain finite and render without allocation");
}
