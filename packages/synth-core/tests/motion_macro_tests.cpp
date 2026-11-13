#include "blocks_synth.h"
#include "blocks_envelopes.h"
#include "../src/motion_macro.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));for(auto kv:{std::pair<unsigned,float>{BS_GAIN,.1f},{BS_ATTACK,.001f},{BS_DECAY,.001f},{BS_SUSTAIN_LEVEL,1},{BS_OSC1_LEVEL,.5f},{BS_OSC2_LEVEL,0},{BS_OSC1_WAVE,0},{BS_FILTER_MIX,0},{BS_DRIFT_CENTS,0},{BS_SETTLING_CENTS,0},{BS_FULLNESS,0},{BS_ENVELOPE_RESPONSE,0}})CHECK(bs_set_parameter(p,kv.first,kv.second));bs_reset(p);}~Synth(){bs_destroy(p);}};
static std::vector<float>render(bs_synth*s,unsigned n,unsigned block=127){std::vector<float>a(n),b(n);for(unsigned i=0;i<n;i+=block)CHECK(!bs_render(s,a.data()+i,b.data()+i,std::min(block,n-i),nullptr,0));return a;}
static auto lfo(float depth){bs_modulation_config_v4 c{};bs_default_modulation_v4(&c);auto&s=c.sources[0];s.enabled=1;s.intensity=1;s.waveform=5;s.point_count=2;s.points[0]={0,1,0};s.points[1]={1,1,0};s.route_count=1;s.routes[0]={4,50,0,depth,2};return c;}
int main(){auto*d=bs_modulation_target_info(4,50,0);CHECK(d&&d->minimum==0&&d->maximum==1&&d->scope==1&&!bs_modulation_target_info(4,50,1));for(double n:{0.,.2,.6,.75,.85,1.})CHECK(std::abs(blocks_detail::motionInverse(blocks_detail::motionCurve(n,false))-n)<1e-15);std::puts("PASS Character Pitch physical recipe and inverse descriptor");
 {Synth a,b;auto c=lfo(0);CHECK(bs_set_modulation_v4(b.p,&c));for(auto*s:{a.p,b.p}){bs_set_parameter(s,13,17);bs_set_parameter(s,32,9);bs_note_on(s,0,60,.7f);}CHECK(render(a.p,8192)==render(b.p,8192));CHECK(bs_get_parameter(b.p,13)==17&&bs_get_parameter(b.p,32)==9&&bs_get_parameter(b.p,35)==0);}std::puts("PASS zero macro depth preserves custom component settings and exact PCM");
 {Synth a,b;auto c=lfo(.2f);bs_envelopes_config e{};bs_default_envelopes(&e);e.sources[2].attack=.001f;e.sources[2].decay=.001f;e.sources[2].sustain=1;e.sources[2].route_count=1;e.sources[2].routes[0]={4,50,0,.3f,1};for(auto*s:{a.p,b.p}){CHECK(bs_set_modulation_v4(s,&c)&&bs_set_envelopes(s,&e));bs_note_on(s,0,60,.7f);}const auto modulated=render(a.p,24000,1);CHECK(modulated==render(b.p,24000,256));double n=bs_get_modulated_target_value(a.p,4,50,0);CHECK(std::abs(n-.5)<1e-5);CHECK(std::abs(bs_get_modulated_target_value(a.p,0,0,13)-4)<1e-3);CHECK(std::abs(bs_get_modulated_target_value(a.p,0,0,32)-1)<1e-3);CHECK(bs_get_parameter(a.p,13)==0&&bs_get_parameter(a.p,32)==0);Synth plain;bs_note_on(plain.p,0,60,.7f);auto x=render(plain.p,24000);const auto&y=modulated;double diff=0;for(unsigned i=0;i<x.size();++i)diff+=std::abs(x[i]-y[i]);CHECK(diff>.1);c.sources[0].route_count=0;e.sources[2].route_count=0;CHECK(bs_set_modulation_v4(a.p,&c)&&bs_set_envelopes(a.p,&e));render(a.p,8192);CHECK(std::abs(bs_get_modulated_target_value(a.p,4,50,0))<1e-8);bs_panic(a.p);CHECK(bs_get_modulated_target_value(a.p,4,50,0)==0);}std::puts("PASS simultaneous LFO and per-voice ENV macro moves both physical components, audible/block-exact and removable");
}
