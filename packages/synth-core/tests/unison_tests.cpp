#include "blocks_synth.h"
#include "../src/unison.h"
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
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth{bs_synth*p=bs_create();explicit Synth(double rate=48000){CHECK(p&&bs_prepare(p,rate));}~Synth(){bs_destroy(p);}};
struct Audio{std::vector<float>l,r;explicit Audio(unsigned n):l(n),r(n){}};
static Audio render(bs_synth*s,unsigned n,unsigned block=127){Audio a(n);for(unsigned start=0;start<n;start+=block){watch=true;int result=bs_render(s,a.l.data()+start,a.r.data()+start,std::min(block,n-start),nullptr,0);watch=false;CHECK(result==0);}for(unsigned i=0;i<n;++i)CHECK(std::isfinite(a.l[i])&&std::isfinite(a.r[i])&&std::abs(a.l[i])<=1&&std::abs(a.r[i])<=1);return a;}
static void configure(bs_synth*s,unsigned count,float detune,float spread){bs_voicing_config c{1,count,detune,spread};CHECK(bs_set_voicing(s,&c));}
static void sine(bs_synth*s){bs_set_parameter(s,BS_OSC1_WAVE,BS_SINE);bs_set_parameter(s,BS_OSC1_LEVEL,1);bs_set_parameter(s,BS_OSC2_LEVEL,0);bs_set_parameter(s,BS_FILTER_MIX,0);bs_set_parameter(s,BS_SUSTAIN_LEVEL,1);bs_set_parameter(s,BS_RELEASE,.05f);bs_reset(s);}
static double energy(const std::vector<float>&v){double sum=0;for(float x:v)sum+=double(x)*x;return sum;}
static double amplitude(const std::vector<float>&v,double frequency){double re=0,im=0;const unsigned begin=12000;for(unsigned i=begin;i<v.size();++i){double w=.5-.5*std::cos(6.283185307179586*(i-begin)/(v.size()-begin-1));double phase=6.283185307179586*frequency*i/48000;re+=v[i]*w*std::cos(phase);im+=v[i]*w*std::sin(phase);}return std::hypot(re,im)/(v.size()-begin);}
int main(){
 {CHECK(sizeof(bs_voicing_config)==16);Synth s;bs_voicing_config c{};bs_default_voicing(&c);CHECK(c.version==1&&c.count==1&&c.detune_cents==0&&c.spread==0);CHECK(bs_get_voicing(s.p,&c));auto before=c;for(unsigned i=0;i<7;++i){auto bad=c;switch(i){case 0:bad.version=2;break;case 1:bad.count=0;break;case 2:bad.count=5;break;case 3:bad.detune_cents=50.01f;break;case 4:bad.detune_cents=-1;break;case 5:bad.spread=1.1f;break;case 6:bad.spread=std::numeric_limits<float>::quiet_NaN();break;}CHECK(!bs_set_voicing(s.p,&bad));CHECK(bs_get_voicing(s.p,&c)&&std::memcmp(&c,&before,sizeof c)==0);}CHECK(!bs_set_voicing(nullptr,&c)&&!bs_get_voicing(nullptr,&c));configure(s.p,4,30,.7f);bs_patch patch{};CHECK(bs_get_patch(s.p,&patch)&&bs_set_patch(s.p,&patch));bs_reset(s.p);CHECK(bs_get_voicing(s.p,&c)&&c.count==4&&c.detune_cents==30&&c.spread==.7f);}
 std::puts("PASS additive16-byte Voicing schema, neutral defaults, atomic bounds and independent tone patch");
 {Synth a,b;configure(b.p,1,50,1);bs_reset(b.p);bs_note_on(a.p,0,60,.8f);bs_note_on(b.p,0,60,.8f);auto x=render(a.p,12000),y=render(b.p,12000);CHECK(x.l==y.l&&x.r==y.r);configure(b.p,4,0,0);configure(a.p,1,0,0);x=render(a.p,12000);y=render(b.p,12000);CHECK(x.l==y.l&&x.r==y.r);CHECK(bs_active_voices(a.p)==1&&bs_active_voices(b.p)==1);}
 std::puts("PASS Count1 exact original signal and held-note count snapshot without ownership multiplication");
 {blocks_detail::Unison u;for(unsigned n=2;n<=4;++n){CHECK(u.configure({1,n,50,1}));u.reset();for(unsigned i=0;i<n;++i){const auto&a=u.copies[n][i];const auto&b=u.copies[n][n-1-i];CHECK(std::abs(a.ratio*b.ratio-1)<1e-15);CHECK(a.left==b.right);CHECK(std::abs(a.left*a.left+a.right*a.right-2./(n*n))<1e-15);}Synth a,b;configure(a.p,1,0,0);configure(b.p,n,0,0);sine(a.p);sine(b.p);bs_note_on(a.p,0,59,.5f);bs_note_on(b.p,0,59,.5f);auto x=render(a.p,6000),y=render(b.p,6000);CHECK(y.l==y.r);for(unsigned i=0;i<x.l.size();++i)CHECK(std::abs(x.l[i]-y.l[i])<2e-8);}}
 std::puts("PASS symmetric cents/pan, fixed1/N coherent gain and zero-spread genuine mono across counts");
 {Synth a,b;sine(a.p);sine(b.p);configure(a.p,4,50,0);configure(b.p,4,50,1);bs_reset(a.p);bs_reset(b.p);bs_note_on(a.p,0,59,.7f);bs_note_on(b.p,0,59,.7f);auto mono=render(a.p,48000),stereo=render(b.p,48000);CHECK(mono.l==mono.r&&stereo.l!=stereo.r);double side=0;for(unsigned i=0;i<stereo.l.size();++i)side+=std::pow(double(stereo.l[i])-stereo.r[i],2);CHECK(side/energy(stereo.l)>.1);double center=440*std::exp2((59.-69)/12);for(double cents:{-50.,-50./3,50./3,50.}){double amp=amplitude(mono.l,center*std::exp2(cents/1200));CHECK(amp>.001);std::printf("METRIC Unison4 frequency=%.6f amplitude=%.8f\n",center*std::exp2(cents/1200),amp);}bs_set_stereo_width(b.p,0);render(b.p,12000);stereo=render(b.p,1000);CHECK(stereo.l==stereo.r);}
 std::puts("PASS actual four-frequency detuning, independent stereo spread and output-width mono compatibility");
 {for(unsigned mode:{0u,1u}){Synth a,b;configure(a.p,4,35,1);configure(b.p,4,35,1);for(auto*s:{a.p,b.p}){bs_set_parameter(s,BS_FILTER_MODE,float(mode));bs_set_parameter(s,BS_FILTER_RESONANCE,.7f);bs_set_parameter(s,BS_FILTER_AMOUNT,24);bs_set_parameter(s,BS_FULLNESS,.4f);bs_set_parameter(s,BS_RELEASE,.02f);bs_reset(s);for(unsigned key=48;key<68;++key)bs_note_on(s,0,key,.6f);}auto x=render(a.p,3000,1),y=render(b.p,3000,256);CHECK(x.l==y.l&&x.r==y.r&&bs_active_voices(a.p)==16);configure(a.p,2,50,.2f);configure(b.p,2,50,.2f);bs_sauce_config rack{};bs_default_sauce(&rack);rack.count=1;rack.blocks[0]={77,BS_SAUCE_FULLNESS,0,1,.2f};for(auto*s:{a.p,b.p}){CHECK(bs_set_sauce(s,&rack));bs_sustain(s,0,1);for(unsigned key=48;key<68;++key)bs_note_off(s,0,key);}x=render(a.p,5000,1);y=render(b.p,5000,128);CHECK(x.l==y.l&&x.r==y.r);for(auto*s:{a.p,b.p})bs_sustain(s,0,0);x=render(a.p,3000,1);y=render(b.p,3000,127);CHECK(x.l==y.l&&x.r==y.r&&bs_active_voices(a.p)==0);bs_note_on(a.p,0,70,.7f);bs_panic(a.p);x=render(a.p,1000);CHECK(energy(x.l)==0&&energy(x.r)==0);}}
 std::puts("PASS both filters, live retarget/rack edits, stealing/pedal/release/panic, block invariance and zero allocations");
 CHECK(allocations==0);return 0;
}
