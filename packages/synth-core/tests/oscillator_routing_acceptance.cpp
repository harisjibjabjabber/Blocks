#include "blocks_synth.h"
#include "blocks_sound.h"
#include "blocks_voicing.h"
#include "blocks_filter_routing.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <new>
#include <vector>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(void*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL acceptance %d %s\n",__LINE__,#x);std::exit(1);}}while(0)
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));}~Synth(){bs_destroy(p);}};
struct Audio{std::vector<float>l,r;explicit Audio(unsigned n):l(n),r(n){}};
static Audio render(bs_synth*s,unsigned n,unsigned block=127){Audio a(n);for(unsigned at=0;at<n;at+=block){watch=true;const int result=bs_render(s,a.l.data()+at,a.r.data()+at,std::min(block,n-at),nullptr,0);watch=false;CHECK(result==0);}for(unsigned i=0;i<n;++i)CHECK(std::isfinite(a.l[i])&&std::isfinite(a.r[i])&&std::abs(a.l[i])<=1&&std::abs(a.r[i])<=1);return a;}
static bool exact(const Audio&a,const Audio&b){return a.l==b.l&&a.r==b.r;}
static double energy(const Audio&a){double e=0;for(unsigned i=0;i<a.l.size();++i)e+=a.l[i]*a.l[i]+a.r[i]*a.r[i];return e;}
static double difference(const Audio&a,const Audio&b){double peak=0;for(unsigned i=0;i<a.l.size();++i)peak=std::max({peak,std::abs(double(a.l[i])-b.l[i]),std::abs(double(a.r[i])-b.r[i])});return peak;}
static bs_voicing_config_v2 voices(unsigned a=1,unsigned b=1){return {2,0,{{a,10,.6f},{b,10,.6f}}};}
static void route(bs_synth*s,unsigned mask){bs_filter_routing_config r{1,mask};CHECK(bs_set_filter_routing(s,&r));}
static void setup(bs_synth*s,unsigned model=0){bs_sound_config sound{1,1,model,4};CHECK(bs_set_sound(s,&sound));for(auto pair:std::vector<std::pair<unsigned,float>>{{BS_OSC1_LEVEL,.6f},{BS_OSC2_LEVEL,.4f},{BS_DRIFT_CENTS,0},{BS_SETTLING_CENTS,0},{BS_VELOCITY_MOVEMENT,0},{BS_DRIVE_ENABLED,0},{BS_FULLNESS_ENABLED,0},{BS_SUSTAIN_LEVEL,1},{BS_ATTACK,.005f},{BS_RELEASE,.01f},{BS_CUTOFF,1200},{BS_FILTER_MIX,1},{BS_GAIN,.3f}})CHECK(bs_set_parameter(s,pair.first,pair.second));}
int main(){
 {Synth s;auto c=voices(3,7);CHECK(bs_set_voicing_v2(s.p,&c));route(s.p,1);for(unsigned kind=0;kind<4;++kind){auto bad=c;if(kind==0)bad.reserved=1;if(kind==1)bad.oscillators[1].count=0;if(kind==2)bad.oscillators[1].spread=std::numeric_limits<float>::quiet_NaN();if(kind==3)bad.version=1;CHECK(!bs_set_voicing_v2(s.p,&bad));bs_voicing_config_v2 after{};CHECK(bs_get_voicing_v2(s.p,&after)&&std::memcmp(&after,&c,sizeof c)==0);}bs_filter_routing_config bad{1,4},after{};CHECK(!bs_set_filter_routing(s.p,&bad)&&bs_get_filter_routing(s.p,&after)&&after.mask==1);bs_voicing_config old{1,3,11,.4f};CHECK(bs_set_voicing(s.p,&old));CHECK(bs_get_voicing_v2(s.p,&c));for(const auto&o:c.oscillators)CHECK(o.count==3&&o.detune_cents==11&&o.spread==.4f);}
 std::puts("PASS independent acceptance: invalid whole configs atomic and legacy setter maps both oscillators");
 {for(unsigned audible:{0u,1u}){Synth a,b;for(auto*s:{a.p,b.p}){setup(s);bs_set_parameter(s,audible?BS_OSC1_LEVEL:BS_OSC2_LEVEL,0);bs_set_parameter(s,audible?BS_OSC2_LEVEL:BS_OSC1_LEVEL,1);}auto x=voices(7,7),y=x;y.oscillators[1-audible]={3,43,1};CHECK(bs_set_voicing_v2(a.p,&x)&&bs_set_voicing_v2(b.p,&y));for(auto*s:{a.p,b.p}){bs_reset(s);bs_note_on(s,0,59,.7f);}auto aa=render(a.p,3000),bb=render(b.p,3000);CHECK(exact(aa,bb)&&energy(aa)>1e-7);y.oscillators[1-audible]={1,0,0};CHECK(bs_set_voicing_v2(b.p,&y));CHECK(exact(render(a.p,2000),render(b.p,2000)));}}
 std::puts("PASS independent acceptance: changing muted oscillator count/detune/spread cannot alter audible oscillator phase or gain");
 {Synth a,b;for(auto*s:{a.p,b.p}){setup(s);bs_reset(s);bs_note_on(s,0,60,.7f);}CHECK(exact(render(a.p,1000),render(b.p,1000)));auto c=voices(7,3);CHECK(bs_set_voicing_v2(a.p,&c));CHECK(exact(render(a.p,2000),render(b.p,2000))&&bs_active_voices(a.p)==1);for(auto*s:{a.p,b.p}){bs_panic(s);bs_note_on(s,0,60,.7f);}CHECK(!exact(render(a.p,2000),render(b.p,2000))&&bs_active_voices(a.p)==1);}
 std::puts("PASS independent acceptance: count is next-attack state without changing held-note ownership");
 {for(unsigned model:{0u,1u}){Synth reference;setup(reference.p,model);bs_set_parameter(reference.p,BS_FILTER_MIX,0);auto c=voices(3,7);CHECK(bs_set_voicing_v2(reference.p,&c));bs_reset(reference.p);bs_note_on(reference.p,0,60,.7f);auto expected=render(reference.p,4096);CHECK(energy(expected)>1e-7);for(unsigned mask:{0u,1u,2u}){Synth s;setup(s.p,model);bs_set_parameter(s.p,BS_FILTER_MIX,0);CHECK(bs_set_voicing_v2(s.p,&c));route(s.p,mask);bs_reset(s.p);bs_note_on(s.p,0,60,.7f);auto actual=render(s.p,4096);CHECK(difference(actual,expected)<1e-7);}}}
 std::puts("PASS independent acceptance: all routing masks have matched full-core dry transfer including fractional Ladder FIR alignment");
 {Synth a,b,colour;for(auto*s:{a.p,b.p,colour.p}){setup(s);route(s,0);bs_set_parameter(s,BS_OSC2_LEVEL,0);}bs_set_parameter(a.p,BS_CUTOFF,40);bs_set_parameter(b.p,BS_CUTOFF,18000);bs_set_parameter(colour.p,BS_DRIVE_ENABLED,1);bs_set_parameter(colour.p,BS_DRIVE,12);for(auto*s:{a.p,b.p,colour.p}){bs_reset(s);bs_note_on(s,0,60,.7f);}auto dry=render(a.p,3000),bypass=render(b.p,3000),wet=render(colour.p,3000);CHECK(exact(dry,bypass)&&!exact(dry,wet)&&energy(wet)>1e-7);for(auto*s:{a.p,b.p,colour.p}){bs_note_off(s,0,60);render(s,3000);CHECK(bs_active_voices(s)==0);}for(unsigned oscillator:{0u,1u}){Synth routed,both;for(auto*s:{routed.p,both.p}){setup(s);bs_set_parameter(s,oscillator?BS_OSC1_LEVEL:BS_OSC2_LEVEL,0);}route(routed.p,1u<<oscillator);for(auto*s:{routed.p,both.p}){bs_reset(s);bs_note_on(s,0,60,.7f);}CHECK(exact(render(routed.p,3000),render(both.p,3000)));}}
 std::puts("PASS independent acceptance: bypass excludes only filter, retains Sauce and amp release, and masks select correct oscillator");
 {Synth a,b;auto c=voices(1,7);for(auto*s:{a.p,b.p}){setup(s,1);CHECK(bs_set_voicing_v2(s,&c));bs_reset(s);for(unsigned key=48;key<66;++key)bs_note_on(s,0,key,.4f);}for(unsigned mask:{1u,2u,0u,3u}){for(auto*s:{a.p,b.p})route(s,mask);CHECK(exact(render(a.p,512,1),render(b.p,512,127)));CHECK(bs_active_voices(a.p)==16&&bs_active_voices(b.p)==16);}for(auto*s:{a.p,b.p}){bs_sustain(s,0,1);for(unsigned key=48;key<66;++key)bs_note_off(s,0,key);}route(a.p,1);route(b.p,1);CHECK(exact(render(a.p,512,1),render(b.p,512,256))&&bs_active_voices(a.p)==16);for(auto*s:{a.p,b.p})bs_sustain(s,0,0);CHECK(exact(render(a.p,3000,1),render(b.p,3000,127))&&bs_active_voices(a.p)==0);for(auto*s:{a.p,b.p}){bs_note_on(s,0,60,.5f);bs_panic(s);}CHECK(energy(render(a.p,512))==0&&energy(render(b.p,512))==0&&allocations==0);}
 std::puts("PASS independent acceptance: routing changes preserve steals/pedal/releases, block exactness and zero render allocation");
}
