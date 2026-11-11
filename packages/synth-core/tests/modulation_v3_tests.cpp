#include "blocks_synth.h"
#include "../src/modulation.h"
#include <algorithm>
#include <array>
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
using blocks_detail::Modulation;
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));}~Synth(){bs_destroy(p);}};
struct Audio{std::vector<float>l,r;explicit Audio(unsigned n):l(n),r(n){}};
static Audio render(bs_synth*s,unsigned n,unsigned block=127){Audio a(n);for(unsigned start=0;start<n;start+=block){watch=true;int result=bs_render(s,a.l.data()+start,a.r.data()+start,std::min(block,n-start),nullptr,0);watch=false;CHECK(result==0);}for(unsigned i=0;i<n;++i)CHECK(std::isfinite(a.l[i])&&std::isfinite(a.r[i])&&std::abs(a.l[i])<=1&&std::abs(a.r[i])<=1);return a;}
static auto shape(unsigned points=30){auto c=blocks_detail::defaultModulationV3();auto&s=c.sources[0];s.enabled=1;s.waveform=BS_LFO_CUSTOM;s.rate_hz=8;s.point_count=points;s.route_count=1;s.routes[0]={0,0,BS_GAIN,.3f};for(unsigned i=0;i<points;++i)s.points[i]={float(i)/(points-1),i%2?1.f:-1.f,i%3?1.f:-1.f};return c;}
static double expected(const bs_lfo_source_v3&s,double phase){unsigned i=0;while(i+1<s.point_count-1&&phase>=s.points[i+1].x)++i;double t=(phase-s.points[i].x)/(double(s.points[i+1].x)-s.points[i].x);return s.points[i].y+(double(s.points[i+1].y)-s.points[i].y)*(t+s.points[i].bend*t*(1-t));}
static void near(double a,double b,double tolerance=1e-11){CHECK(std::abs(a-b)<tolerance);}
int main(){
 {CHECK(sizeof(bs_modulation_config_v3)==2232&&sizeof(bs_lfo_source_v3)==556);Synth s;auto c=shape(32);CHECK(bs_set_modulation_v3(s.p,&c));bs_modulation_config_v3 got{};CHECK(bs_get_modulation_v3(s.p,&got)&&!std::memcmp(&c,&got,sizeof c));}
 std::puts("PASS current32point schema and exact roundtrip");
 {Synth s;auto c=shape(32);CHECK(bs_set_modulation_v3(s.p,&c));render(s.p,100);bs_modulation_config_v3 before{},after{};CHECK(bs_get_modulation_v3(s.p,&before));auto phase=bs_get_modulation_phase(s.p,1);for(unsigned test=0;test<13;++test){auto bad=c;auto&v=bad.sources[0];switch(test){case 0:bad.version=2;break;case 1:v.point_count=33;break;case 2:v.point_count=1;break;case 3:v.points[1].x=1.f/2048;break;case 4:v.points[31].x=.99f;break;case 5:v.points[29].bend=2;break;case 6:v.points[30].y=std::numeric_limits<float>::quiet_NaN();break;case 7:v.routes[0].target_kind=3;break;case 8:v.routes[0].target_id=1;break;case 9:v.routes[0]={1,1,1,.5f};break;case 10:v.routes[0]={2,1,2,.5f};break;case 11:v.routes[0].depth=std::numeric_limits<float>::infinity();break;case 12:v.route_count=2;v.routes[1]=v.routes[0];break;}CHECK(!bs_set_modulation_v3(s.p,&bad));CHECK(bs_get_modulation_v3(s.p,&after)&&std::memcmp(&before,&after,sizeof before)==0&&phase==bs_get_modulation_phase(s.p,1));}}
 std::puts("PASS 32-point and unified-route invalid inputs reject without changing state or clocks");
 {for(unsigned points:{30u,32u}){Modulation m;auto c=shape(points);CHECK(m.configure(c));for(unsigned i=0;i<2048;++i){auto offsets=m.tick(8192,120);double phase=double(i%1024)/1024;near(offsets[BS_GAIN],expected(c.sources[0],phase)*double(c.sources[0].routes[0].depth));CHECK(offsets[BS_GAIN]>=-.301&&offsets[BS_GAIN]<=.301);}auto phase=m.phase(1);c.sources[0].points[29].bend=.2f;CHECK(m.configure(c)&&m.phase(1)==phase);}}
 std::puts("PASS 30/32-point exact interpolation, independent wrap and clock-preserving edits");
 {auto c=shape(9);c.source_count=2;c.sources[0].waveform=BS_LFO_SQUARE;c.sources[0].intensity=.5f;c.sources[0].routes[0]={2,2,0,1};c.sources[1]=c.sources[0];c.sources[1].id=2;c.sources[1].rate_hz=1;c.sources[1].routes[0]={0,0,BS_GAIN,1};Modulation m;CHECK(m.configure(c));m.tick(48000,120);CHECK(m.phase(2)==0);m.tick(48000,120);near(m.phase(2),1./48000);m.tick(48000,120);const double sm=1-std::exp(-1./240);near(m.phase(2),(1+std::exp2(4*.5*sm))/48000);c.sources[0].routes[0]={2,2,1,-1};CHECK(m.configure(c));m.reset();auto first=m.tick(48000,120)[BS_GAIN],second=m.tick(48000,120)[BS_GAIN];near(first,.5);near(second,.5-.5*sm);c.sources[0].routes[0]={2,2,0,1};c.sources[1].synced=1;c.sources[1].division=16;CHECK(m.configure(c));m.reset();m.tick(48000,120);m.tick(48000,120);near(m.phase(2),8./48000);m.tick(48000,120);near(m.phase(2),(8+8*std::exp2(4*.5*sm))/48000);}
 std::puts("PASS prior-sample LFO feedback, exact smoothed rate multiplier and intensity displacement");
 {auto c=shape(32);c.source_count=4;for(unsigned i=0;i<4;++i){c.sources[i]=c.sources[0];auto&s=c.sources[i];s.id=i+1;s.rate_hz=1+i;s.route_count=4;s.routes[0]={0,0,BS_CUTOFF,i%2?-.4f:.3f};s.routes[1]={2,(i+1)%4+1,0,.7f};s.routes[2]={2,i+1,1,-.4f};s.routes[3]={1,77,0,i%2?.6f:-.5f};}std::array<unsigned,4>order{0,1,2,3};do{Modulation a,b;auto reversed=c;for(unsigned i=0;i<4;++i)reversed.sources[i]=c.sources[order[i]];CHECK(a.configure(c)&&b.configure(reversed));for(unsigned i=0;i<3000;++i){CHECK(a.tick(8000,240)==b.tick(8000,240));CHECK(a.sauceOffset(77)==b.sauceOffset(77));for(unsigned id=1;id<=4;++id)CHECK(a.phase(id)==b.phase(id)&&a.phase(id)>=0&&a.phase(id)<1);}auto phase=b.phase(1);CHECK(b.configure(c)&&b.phase(1)==phase);}while(std::next_permutation(order.begin(),order.end()));}
 std::puts("PASS all24 source permutations, self/cyclic feedback and canonical Sauce sums");
 {Synth plain,mod,other,chunk;bs_sauce_config rack{};bs_default_sauce(&rack);rack.count=2;rack.blocks[0]={77,BS_SAUCE_DRIVE,0,1,2};rack.blocks[1]={88,BS_SAUCE_FULLNESS,0,1,.3f};auto c=shape();c.sources[0].waveform=BS_LFO_SINE;c.sources[0].route_count=2;c.sources[0].routes[0]={1,77,0,.5f};c.sources[0].routes[1]={1,88,0,.4f};for(auto*s:{plain.p,mod.p,other.p,chunk.p}){CHECK(bs_set_sauce(s,&rack));bs_note_on(s,0,60,.7f);}watch=true;CHECK(bs_set_modulation_v3(mod.p,&c)&&bs_set_modulation_v3(chunk.p,&c));watch=false;auto orphan=c;orphan.sources[0].routes[0].target_id=999;orphan.sources[0].routes[1].target_id=998;CHECK(bs_set_modulation_v3(other.p,&orphan));auto a=render(plain.p,12000),b=render(mod.p,12000,1),d=render(other.p,12000),e=render(chunk.p,12000,256);CHECK(a.l==d.l&&a.r==d.r&&a.l!=b.l&&b.l==e.l&&b.r==e.r);CHECK(bs_get_sauce(mod.p,&rack)&&rack.blocks[0].amount==2&&rack.blocks[1].amount==.3f);std::swap(rack.blocks[0],rack.blocks[1]);CHECK(bs_set_sauce(mod.p,&rack)&&bs_set_sauce(chunk.p,&rack));b=render(mod.p,5000,1);e=render(chunk.p,5000,128);CHECK(b.l==e.l&&b.r==e.r);bs_panic(mod.p);CHECK(bs_active_voices(mod.p)==0);CHECK(allocations==0);
  Synth primary,global;bs_default_sauce(&rack);rack.count=1;rack.blocks[0]={77,BS_SAUCE_DRIVE,1,1,1};CHECK(bs_set_sauce(primary.p,&rack)&&bs_set_sauce(global.p,&rack));bs_set_parameter(primary.p,BS_DRIVE,2);bs_set_parameter(global.p,BS_DRIVE,2);bs_reset(primary.p);bs_reset(global.p);c.sources[0].route_count=1;c.sources[0].routes[0]={1,77,0,.5f};CHECK(bs_set_modulation_v3(primary.p,&c));c.sources[0].routes[0]={0,0,BS_DRIVE,.5f};CHECK(bs_set_modulation_v3(global.p,&c));bs_note_on(primary.p,0,60,.7f);bs_note_on(global.p,0,60,.7f);auto pa=render(primary.p,4000),ga=render(global.p,4000);CHECK(pa.l==ga.l&&pa.r==ga.r);
 }
 std::puts("PASS real per-block Drive/Fullness audio, orphan inertness, saved-value isolation, reorders and no-allocation block invariance");
 return 0;
}
