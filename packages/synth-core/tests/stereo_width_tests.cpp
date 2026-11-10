#include "blocks_synth.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <new>
#include <vector>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(void*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth{bs_synth*p=bs_create();Synth(double rate=48000){CHECK(p&&bs_prepare(p,rate));}~Synth(){bs_destroy(p);}};
struct Audio{std::vector<float>l,r;explicit Audio(unsigned n):l(n),r(n){}};
static Audio render(bs_synth*s,unsigned n,unsigned block=127,const std::vector<bs_event>&events={}){Audio a(n);std::vector<bs_event>local;local.reserve(events.size());for(unsigned start=0;start<n;start+=block){unsigned count=std::min(block,n-start);local.clear();for(auto e:events)if(e.sample_offset>=start&&e.sample_offset<start+count){e.sample_offset-=start;local.push_back(e);}watch=true;int result=bs_render(s,a.l.data()+start,a.r.data()+start,count,local.data(),unsigned(local.size()));watch=false;CHECK(result==0);}for(unsigned i=0;i<n;++i)CHECK(std::isfinite(a.l[i])&&std::isfinite(a.r[i])&&std::abs(a.l[i])<=1&&std::abs(a.r[i])<=1);return a;}
static void fixture(bs_synth*s,float width,unsigned key=60){CHECK(bs_set_stereo_width(s,width));bs_set_parameter(s,BS_OSC1_WAVE,BS_SINE);bs_set_parameter(s,BS_OSC2_LEVEL,0);bs_set_parameter(s,BS_SUSTAIN_LEVEL,1);bs_set_parameter(s,BS_GAIN,.5f);bs_reset(s);bs_note_on(s,0,key,.3f);}
static double input(float x){return std::atanh(double(x)/.5);}
int main(){
 {Synth s;CHECK(bs_get_stereo_width(nullptr)==1&&bs_get_stereo_width(s.p)==1);CHECK(!bs_set_stereo_width(nullptr,1));CHECK(bs_set_stereo_width(s.p,.75f));for(float v:{-1.f,2.001f,std::numeric_limits<float>::infinity(),std::numeric_limits<float>::quiet_NaN()})CHECK(!bs_set_stereo_width(s.p,v)&&bs_get_stereo_width(s.p)==.75f);bs_patch patch{};CHECK(bs_get_patch(s.p,&patch));CHECK(bs_set_patch(s.p,&patch)&&bs_get_stereo_width(s.p)==.75f);bs_panic(s.p);CHECK(bs_get_stereo_width(s.p)==.75f);bs_reset(s.p);CHECK(bs_get_stereo_width(s.p)==.75f&&bs_prepare(s.p,96000)&&bs_get_stereo_width(s.p)==.75f);}
 std::puts("PASS additive width validation, independent tone patch, reset/prepare/panic target retention");
 {Synth a,b;bs_note_on(a.p,0,60,.7f);bs_note_on(b.p,0,60,.7f);CHECK(bs_set_stereo_width(b.p,1));auto x=render(a.p,12000),y=render(b.p,12000);CHECK(x.l==y.l&&x.r==y.r);for(float width:{0.f,.5f,1.f,2.f}){Synth c;fixture(c.p,width,59);auto z=render(c.p,4000);CHECK(z.l==z.r);}}
 std::puts("PASS neutral exact path and centered mono remains mono at all widths");
 {Synth dry,mono,wide;fixture(dry.p,1);fixture(mono.p,0);fixture(wide.p,2);auto d=render(dry.p,8000),m=render(mono.p,8000),w=render(wide.p,8000);CHECK(m.l==m.r);double side=0,wideSide=0;for(unsigned i=0;i<8000;++i){double dl=input(d.l[i]),dr=input(d.r[i]),wl=input(w.l[i]),wr=input(w.r[i]),mm=input(m.l[i]);CHECK(std::abs((dl+dr)-(wl+wr))<2e-8);CHECK(std::abs((dl+dr)*.5-mm)<1e-8);CHECK(std::abs((wl-wr)-2*(dl-dr))<2e-8);side+=(dl-dr)*(dl-dr);wideSide+=(wl-wr)*(wl-wr);}CHECK(side>0&&std::abs(wideSide/side-4)<1e-5);}
 std::puts("PASS actual audio existing Side doubles, mono collapse and pre-protection Mid preservation");
 {std::vector<bs_event>events{{0,BS_NOTE_ON,0,60,0,.8f},{301,BS_STEREO_WIDTH,999,999,999,0},{400,BS_STEREO_WIDTH,0,0,0,2},{1057,BS_STEREO_WIDTH,0,0,0,.3f},{1200,BS_PEDAL,0,0,0,1},{1300,BS_NOTE_OFF,0,60,0,0},{8000,BS_PEDAL,0,0,0,0},{9000,BS_STEREO_WIDTH,0,0,0,1},{30000,BS_PANIC,0,0,0,0}};Synth a,b;auto x=render(a.p,32000,1,events),y=render(b.p,32000,256,events);CHECK(x.l==y.l&&x.r==y.r&&bs_active_voices(a.p)==0&&bs_active_voices(b.p)==0);float l{},r{};bs_event bad{0,BS_STEREO_WIDTH,0,0,0,-1};CHECK(bs_render(a.p,&l,&r,1,&bad,1)==1&&bs_get_stereo_width(a.p)==1);CHECK(allocations==0);}
 std::puts("PASS sample-offset automation, retarget/pedal/panic, block invariance and zero render allocations");
 {for(double rate:{8000.,48000.,384000.}){Synth a(rate),b(rate);fixture(a.p,1);fixture(b.p,1);render(a.p,2000);render(b.p,2000);CHECK(bs_set_stereo_width(b.p,0));auto x=render(a.p,unsigned(rate*.2)),y=render(b.p,unsigned(rate*.2));for(unsigned i=0;i<y.l.size();++i){const double width=std::exp(-double(i+1)/(.005*rate));double expectedMid=(input(x.l[i])+input(x.r[i]))*.5,expectedSide=(input(x.l[i])-input(x.r[i]))*.5*width;CHECK(std::abs(input(y.l[i])-(expectedMid+expectedSide))<2e-8);CHECK(std::abs(input(y.r[i])-(expectedMid-expectedSide))<2e-8);}CHECK(y.l.back()==y.r.back());bs_set_stereo_width(b.p,1);render(a.p,unsigned(rate*.2));render(b.p,unsigned(rate*.2));x=render(a.p,500);y=render(b.p,500);CHECK(x.l==y.l&&x.r==y.r);}}
 std::puts("PASS exact 5ms smoothing across rates, settled mono and bit-exact neutral return");
 return 0;
}
