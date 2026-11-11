#include "blocks_synth.h"
#include "blocks_voicing.h"
#include "blocks_filter_routing.h"
#include "../src/filter_route.h"
#include <array>
#include <vector>
#include <cstdio>
#include <cstdlib>
#include <cmath>
#include <cstring>
#include <cstddef>
#include <limits>
#include <new>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(auto*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::printf("FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(0)
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));}~Synth(){bs_destroy(p);}};
static std::vector<float> render(bs_synth*p,unsigned frames){std::vector<float>out(frames*2);watch=true;for(unsigned i=0;i<frames;i+=128){const unsigned n=std::min(128u,frames-i);CHECK(bs_render(p,out.data()+i,out.data()+frames+i,n,nullptr,0)==0);}watch=false;return out;}
static void neutral(bs_synth*p){bs_set_parameter(p,BS_DRIVE_ENABLED,0);bs_set_parameter(p,BS_FULLNESS_ENABLED,0);bs_set_parameter(p,BS_DRIFT_CENTS,0);bs_set_parameter(p,BS_SETTLING_CENTS,0);bs_set_parameter(p,BS_PITCH_DROP_ENABLED,0);bs_set_parameter(p,BS_FILTER_MIX,0);bs_set_parameter(p,BS_SUSTAIN_LEVEL,1);}
int main(){
 {CHECK(sizeof(bs_voicing_config_v2)==32&&offsetof(bs_voicing_config_v2,oscillators)==8&&sizeof(bs_osc_voicing_config)==12);CHECK(sizeof(bs_filter_routing_config)==8);Synth s;bs_voicing_config_v2 c{},got{};bs_default_voicing_v2(&c);CHECK(c.version==2&&c.reserved==0&&c.oscillators[0].count==1&&c.oscillators[1].count==1);CHECK(bs_set_voicing_v2(s.p,&c));for(unsigned which=0;which<8;++which){auto invalid=c;if(which==0)invalid.version=1;if(which==1)invalid.reserved=1;if(which==2)invalid.oscillators[0].count=0;if(which==3)invalid.oscillators[1].count=8;if(which==4)invalid.oscillators[1].detune_cents=51;if(which==5)invalid.oscillators[0].spread=-.1f;if(which==6)invalid.oscillators[0].detune_cents=std::numeric_limits<float>::quiet_NaN();if(which==7)invalid.oscillators[1].spread=std::numeric_limits<float>::infinity();CHECK(!bs_set_voicing_v2(s.p,&invalid));CHECK(bs_get_voicing_v2(s.p,&got)&&std::memcmp(&got,&c,sizeof(c))==0);}c.oscillators[1]={7,12,.8f};CHECK(bs_set_voicing_v2(s.p,&c));bs_voicing_config sentinel{17,19,23,29},old=sentinel;CHECK(!bs_get_voicing(s.p,&sentinel)&&std::memcmp(&sentinel,&old,sizeof(old))==0);bs_voicing_config shared{1,3,10,.5f};CHECK(bs_set_voicing(s.p,&shared)&&bs_get_voicing_v2(s.p,&got)&&got.oscillators[0].count==3&&got.oscillators[1].count==3);bs_filter_routing_config route{},r{};bs_default_filter_routing(&route);CHECK(route.version==1&&route.mask==3);CHECK(bs_set_filter_routing(s.p,&route));route.mask=4;CHECK(!bs_set_filter_routing(s.p,&route));CHECK(bs_get_filter_routing(s.p,&r)&&r.mask==3);CHECK(!bs_get_voicing_v2(nullptr,&got)&&!bs_set_voicing_v2(s.p,nullptr)&&!bs_get_filter_routing(s.p,nullptr));}
 std::puts("PASS32/8byte additive layouts, defaults, atomic validation and lossless v1 refusal");
 // Algebraically identical FIRs can be compiled differently when one is
 // inlined beside a nonlinear solver. Keep the local WASM exact-null gate;
 // native roundoff must fit a1e-12 full-scale/relative bound. Diagnostics
 // distinguish interpolation-history error from final dot-product rounding.
 // No compiler-specific cause is inferred merely from a failed equality.
 for(double rate:{8000.,48000.,384000.}){
  blocks_detail::LadderFilter ladder;blocks_detail::FilterRouteAlignment route;blocks_detail::LadderCoefficients c;c.set(1000,.5,rate);
  double maximum=0,scaled=0,relative=0,upDelta=0,downDelta=0,firstA=0,firstB=0,worstA=0,worstB=0;unsigned first=0,worst=0,different=0;
  for(unsigned i=0;i<18000;++i){
   const double x=i%1500<500?.7*std::sin(.19*i):0,a=ladder.processRaw(x,c,7,0),b=route.process(x);
   CHECK(std::isfinite(a)&&std::isfinite(b));const double error=std::abs(a-b),magnitude=std::max(std::abs(a),std::abs(b));
   if(a!=b){if(!different){first=i;firstA=a;firstB=b;}++different;}
   if(error>maximum){maximum=error;worst=i;worstA=a;worstB=b;}
   scaled=std::max(scaled,error/std::max(1.,magnitude));relative=std::max(relative,error/std::max(1e-30,magnitude));
   for(unsigned age=0;age<16;++age)upDelta=std::max(upDelta,std::abs(ladder.up[(ladder.upPosition+15-age)%16]-route.up[(route.upPosition+15-age)%16]));
   for(unsigned age=0;age<127;++age)downDelta=std::max(downDelta,std::abs(ladder.dryDown[(ladder.dryDownPosition+126-age)%127]-route.down[(route.downPosition+126-age)%127]));
  }
  std::printf("METRIC route_fir rate=%.0f different=%u max_abs=%.17g max_scaled=%.17g max_relative=%.17g up_history_delta=%.17g down_history_delta=%.17g first=%u first_ladder=%a first_route=%a worst=%u worst_ladder=%a worst_route=%a\n",rate,different,maximum,scaled,relative,upDelta,downDelta,first,firstA,firstB,worst,worstA,worstB);std::fflush(stdout);
  CHECK(upDelta==0);CHECK(scaled<=1e-12);
#ifdef __EMSCRIPTEN__
  CHECK(maximum==0&&downDelta==0);
#endif
  route.clear();for(unsigned i=0;i<100;++i)CHECK(route.process(0)==0);
 }
 std::puts("PASS linear Ladder route alignment: WASM exact/native scaled1e-12, including silent-idle restart and exact clear");
 {double maximum=0;blocks_detail::LadderFilter full,part;blocks_detail::FilterRouteAlignment bypass;blocks_detail::LadderCoefficients c;c.set(1000,.7,48000);for(unsigned i=0;i<12000;++i){double x=.5*std::sin(.113*i)+.2*std::sin(.051*i),route=.5+.5*std::sin(.004*i);double all=full.processRaw(x,c,3,0),split=part.processRaw(x*route,c,3,0)+bypass.process(x*(1-route));maximum=std::max(maximum,std::abs(all-split));}CHECK(maximum<1e-12);std::printf("PASS moving route partition preserves Mix0 waveform maxdelta %.9g\n",maximum);}
 {for(unsigned muted:{0u,1u}){Synth a,b;bs_voicing_config_v2 v{2,0,{{1,0,0},{7,12,.8f}}};if(muted==0){v.oscillators[0]={7,12,.8f};v.oscillators[1]={1,0,0};}for(auto*p:{a.p,b.p}){neutral(p);bs_set_parameter(p,BS_OSC1_LEVEL,muted==0?0:.7f);bs_set_parameter(p,BS_OSC2_LEVEL,muted==1?0:.7f);CHECK(bs_set_voicing_v2(p,&v));bs_reset(p);bs_note_on(p,0,60,.7f);}CHECK(render(a.p,2048)==render(b.p,2048));v.oscillators[muted].detune_cents=50;v.oscillators[muted].spread=0;watch=true;CHECK(bs_set_voicing_v2(b.p,&v));watch=false;CHECK(render(a.p,8192)==render(b.p,8192));}}
 std::puts("PASS muted oscillator live detune/spread does not modulate the other oscillator");
 {Synth a,b;bs_voicing_config_v2 v{2,0,{{3,12,.5f},{7,9,.8f}}};for(auto*p:{a.p,b.p}){neutral(p);CHECK(bs_set_voicing_v2(p,&v));bs_reset(p);bs_note_on(p,0,60,.7f);}CHECK(render(a.p,2048)==render(b.p,2048));v.oscillators[0].count=1;CHECK(bs_set_voicing_v2(b.p,&v));CHECK(render(a.p,4096)==render(b.p,4096));for(auto*p:{a.p,b.p})bs_note_on(p,0,67,.7f);CHECK(render(a.p,4096)!=render(b.p,4096));CHECK(bs_active_voices(a.p)==2&&bs_active_voices(b.p)==2);CHECK(allocations==0);}
 std::puts("PASS independent Count snapshots only new notes; fixed logical ownership and no render/config allocation");
}
