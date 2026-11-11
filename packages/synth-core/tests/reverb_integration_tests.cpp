#include "blocks_synth.h"
#include "blocks_reverb.h"
#include "blocks_bass_support.h"
#include "../src/stereo_reverb.h"
#include <vector>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <new>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(void*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL%d %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));}~Synth(){bs_destroy(p);}};
static void setup(bs_synth*s){for(auto p:{std::pair<unsigned,float>{BS_OSC1_WAVE,BS_SAW},{BS_OSC1_LEVEL,.8f},{BS_OSC2_LEVEL,0},{BS_GAIN,.3f},{BS_FILTER_MIX,0},{BS_DRIFT_CENTS,0},{BS_SETTLING_CENTS,0},{BS_ATTACK,.002f},{BS_DECAY,.1f},{BS_SUSTAIN_LEVEL,0},{BS_RELEASE,.05f}})CHECK(bs_set_parameter(s,p.first,p.second));bs_reset(s);}
static std::vector<float> render(bs_synth*s,unsigned n,unsigned block=127){std::vector<float>a(n*2);for(unsigned i=0;i<n;i+=block){watch=true;CHECK(bs_render(s,a.data()+i,a.data()+n+i,std::min(block,n-i),nullptr,0)==0);watch=false;}for(auto x:a)CHECK(std::isfinite(x)&&std::abs(x)<=.980001f);return a;}
static double energy(const std::vector<float>&a){double e=0;for(auto x:a)e+=double(x)*x;return e/a.size();}
int main(){
 {Synth s;bs_reverb_config c{},before{},after{};bs_default_reverb(&c);CHECK(sizeof(c)==68&&offsetof(bs_reverb_config,ducking)==64&&offsetof(bs_reverb_config,shimmer_semitones)==56&&offsetof(bs_reverb_config,wet_width)==60);CHECK(!c.enabled&&c.mode==0&&c.shimmer_semitones==12);CHECK(bs_get_reverb(s.p,&before));CHECK(!bs_set_reverb(nullptr,&c)&&!bs_set_reverb(s.p,nullptr)&&!bs_get_reverb(nullptr,&c));for(unsigned i=0;i<8;++i){auto bad=c;if(i==0)bad.version=0;if(i==1)bad.enabled=2;if(i==2)bad.mode=3;if(i==3)bad.decay_seconds=NAN;if(i==4)bad.wet=1.01f;if(i==5)bad.shimmer_semitones=13;if(i==6)bad.ducking=1.01f;if(i==7)bad.version=1;CHECK(!bs_set_reverb(s.p,&bad));CHECK(bs_get_reverb(s.p,&after)&&!std::memcmp(&before,&after,sizeof before));}c.enabled=1;c.mode=2;c.shimmer_semitones=-7;c.wet_width=.7f;CHECK(bs_set_reverb(s.p,&c));bs_panic(s.p);bs_reset(s.p);CHECK(bs_prepare(s.p,96000));CHECK(bs_get_reverb(s.p,&after)&&!std::memcmp(&c,&after,sizeof c));CHECK(bs_output_latency(s.p)==120);}
 std::puts("PASS Reverb68 v2 ABI/atomic validation/prepare-reset retention and rate-dependent output latency");
 {Synth a,b,c;for(auto*s:{a.p,b.p,c.p})setup(s);bs_reverb_config cfg{};bs_default_reverb(&cfg);cfg.enabled=1;cfg.wet=0;CHECK(bs_set_reverb(b.p,&cfg));cfg.enabled=0;cfg.wet=.9f;CHECK(bs_set_reverb(c.p,&cfg));for(auto*s:{a.p,b.p,c.p}){bs_reset(s);bs_note_on(s,0,60,.8f);}const auto dry=render(a.p,14000);CHECK(dry==render(b.p,14000)&&dry==render(c.p,14000));}
 std::puts("PASS Reverb Mix0/Off preserve actual dry synth exactly");
 for(unsigned mode=0;mode<3;++mode){Synth a,b;bs_reverb_config c{};bs_default_reverb(&c);c.enabled=1;c.mode=mode;c.decay_seconds=3;c.wet=.4f;for(auto*s:{a.p,b.p}){setup(s);CHECK(bs_set_reverb(s,&c));bs_reset(s);bs_note_on(s,0,48,.8f);}CHECK(render(a.p,12000,1)==render(b.p,12000,256));for(auto*s:{a.p,b.p})bs_note_off(s,0,48);render(a.p,10000);CHECK(bs_active_voices(a.p)==0);CHECK(energy(render(a.p,12000))>1e-12);bs_panic(a.p);CHECK(energy(render(a.p,4096))==0);CHECK(allocations==0);}
 std::puts("PASS Plate/Hall/Shimmer real tails survive notes, block-exact and allocation-free, Panic clears immediately");
 {Synth a,b;for(auto*s:{a.p,b.p}){setup(s);bs_set_parameter(s,BS_OSC1_LEVEL,0);bs_sub_config sub{};bs_default_sub(&sub);sub.enabled=1;sub.level=.5f;CHECK(bs_set_sub(s,&sub));}bs_reverb_config c{};bs_default_reverb(&c);c.enabled=1;c.mode=2;c.wet=1;CHECK(bs_set_reverb(b.p,&c));for(auto*s:{a.p,b.p}){bs_reset(s);bs_note_on(s,0,48,.8f);}CHECK(render(a.p,18000)==render(b.p,18000));}
 std::puts("PASS Clean Sub stays dry and aligned outside the reverb send");
 {Synth s;setup(s.p);CHECK(bs_output_latency(nullptr)==0&&bs_output_latency(s.p)==72);bs_output_meters m{};CHECK(!bs_get_output_meters(nullptr,&m)&&!bs_get_output_meters(s.p,nullptr));bs_note_on(s.p,0,60,.8f);render(s.p,4096);CHECK(bs_get_output_meters(s.p,&m)&&m.input_peak>0&&m.output_peak>0&&m.gain_reduction_db==0);bs_panic(s.p);CHECK(bs_get_output_meters(s.p,&m)&&m.input_peak==0&&m.output_peak==0);}
 std::puts("PASS output headroom telemetry and exact total output latency");
 {blocks_detail::StereoReverb reverb;auto c=blocks_detail::StereoReverb::defaults();c.enabled=1;c.wet=1;CHECK(reverb.configure(c)&&reverb.prepare(48000));double energyL=0,energyR=0;for(unsigned i=0;i<48000;++i){double l=i==0?1:0,r=-l;reverb.process(l,r);energyL+=l*l;energyR+=r*r;}CHECK(energyL>1e-3&&energyR>1e-3);std::printf("METRIC antiphase-input wet energies L=%.8g R=%.8g\n",energyL,energyR);}
 std::puts("PASS stereo reverb preserves antiphase input energy rather than collapsing to mono injection");
 {Synth a,b;for(auto*s:{a.p,b.p})setup(s);bs_reverb_config c{};bs_default_reverb(&c);c.enabled=1;c.wet=.5f;for(auto*s:{a.p,b.p}){CHECK(bs_set_reverb(s,&c));bs_reset(s);bs_note_on(s,0,60,.8f);}CHECK(render(a.p,24000)==render(b.p,24000));float scope[129]{};scope[128]=123;watch=true;CHECK(bs_get_reverb_scope(a.p,scope,128)==128);watch=false;CHECK(scope[128]==123);double e=0;for(unsigned i=0;i<128;++i){CHECK(std::isfinite(scope[i]));e+=double(scope[i])*scope[i];}CHECK(e>1e-14);CHECK(render(a.p,4096)==render(b.p,4096));CHECK(!bs_get_reverb_scope(nullptr,scope,128)&&!bs_get_reverb_scope(a.p,nullptr,128)&&!bs_get_reverb_scope(a.p,scope,127));bs_panic(a.p);CHECK(bs_get_reverb_scope(a.p,scope,128)==128);for(unsigned i=0;i<128;++i)CHECK(scope[i]==0);CHECK(allocations==0);}
 std::puts("PASS actual wet waveform telemetry, bounded read-only copies, unchanged audio and immediate panic-clear");
 {Synth a,b;for(auto*s:{a.p,b.p})setup(s);bs_reverb_config c{};bs_default_reverb(&c);c.enabled=1;c.wet=1;c.decay_seconds=3;CHECK(bs_set_reverb(a.p,&c));c.ducking=1;CHECK(bs_set_reverb(b.p,&c));for(auto*s:{a.p,b.p}){bs_reset(s);bs_note_on(s,0,48,.8f);}render(a.p,24000);render(b.p,24000);for(auto*s:{a.p,b.p})bs_note_on(s,0,60,.8f);const auto plain=render(a.p,8192),duck=render(b.p,8192);double earlyA=0,earlyB=0;for(unsigned i=0;i<480;++i){earlyA+=double(plain[i])*plain[i];earlyB+=double(duck[i])*duck[i];}CHECK(earlyA>1e-12);const auto tailA=render(a.p,40000),tailB=render(b.p,40000);double recoveredA=0,recoveredB=0;for(unsigned i=36000;i<40000;++i){recoveredA+=double(tailA[i])*tailA[i];recoveredB+=double(tailB[i])*tailB[i];}std::printf("METRIC actual pluck repeat duck early_energy_ratio=%.8g recovered_energy_ratio=%.8g\n",earlyB/earlyA,recoveredB/recoveredA);CHECK(earlyB/earlyA<.5&&recoveredB/recoveredA>.9&&recoveredB/recoveredA<1.01);CHECK(allocations==0);}
 std::puts("PASS actual next-note pluck ducks the existing tail and recovers without deleting tank history");
}
