#include "../src/modulation.h"
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <vector>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d: %s\n",__LINE__,#x);std::exit(1);}}while(false)
using blocks_detail::Modulation;
static bs_modulation_config_v3 enabled(uint32_t wave=0){auto c=blocks_detail::defaultModulationV3();c.sources[0].enabled=1;c.sources[0].waveform=wave;c.sources[0].routes[0].depth=1;return c;}
static void exactOffsets(const std::array<double,BS_PARAMETER_COUNT>&expected,const std::array<double,BS_PARAMETER_COUNT>&actual,unsigned permutation,unsigned frame){
 for(unsigned id=0;id<BS_PARAMETER_COUNT;++id)if(expected[id]!=actual[id]){std::fprintf(stderr,"LFO reorder mismatch permutation=%u frame=%u target=%u expected=%a actual=%a delta=%.17g\n",permutation,frame,id,expected[id],actual[id],actual[id]-expected[id]);CHECK(expected[id]==actual[id]);}
}
static void advance(Modulation&m,int frames){for(int i=0;i<frames;++i)m.tick(48000,120);}
static std::vector<float> render(bs_synth*s,unsigned frames,unsigned block){std::vector<float>l(frames),r(frames);for(unsigned start=0;start<frames;start+=block){const unsigned n=std::min(block,frames-start);CHECK(bs_render(s,l.data()+start,r.data()+start,n,nullptr,0)==0);}for(float v:l)CHECK(std::isfinite(v)&&std::abs(v)<=1);return l;}
static bs_synth* synth(){auto*s=bs_create();CHECK(s);CHECK(bs_set_parameter(s,BS_GAIN,.4f));CHECK(bs_set_parameter(s,BS_SUSTAIN_LEVEL,1));bs_reset(s);return s;}
int main(){
 {
  Modulation m;CHECK(Modulation::valid(m.configV3()));CHECK(m.configV3().sources[0].enabled==0);for(double v:m.tick(48000,120))CHECK(v==0);
  auto c=enabled();CHECK(m.configure(c));const auto saved=m.configV3();
  const auto reject=[&](bs_modulation_config_v3 bad){CHECK(!m.configure(bad));CHECK(std::memcmp(&saved,&m.configV3(),sizeof(saved))==0);};
  auto b=c;b.version=2;reject(b);b=c;b.source_count=5;reject(b);b=c;b.sources[0].route_count=9;reject(b);b=c;b.sources[0].routes[1].parameter_id=11;reject(b);b=c;b.sources[0].routes[0].parameter_id=19;reject(b);b=c;b.sources[0].routes[0].depth=std::numeric_limits<float>::quiet_NaN();reject(b);b=c;b.sources[0].intensity=1.01f;reject(b);b=c;b.sources[0].rate_hz=0;reject(b);b=c;b.sources[0].waveform=6;reject(b);b=c;b.sources[0].division=64;b.sources[0].triplet=1;reject(b);b=c;b.source_count=2;b.sources[1]=b.sources[0];reject(b);
  for(uint32_t id=0;id<BS_PARAMETER_COUNT;++id){b=c;b.sources[0].route_count=1;b.sources[0].routes[0].parameter_id=id;CHECK(Modulation::valid(b)==blocks_detail::modulationTarget(id));}
 }
 std::puts("PASS LFO fixed ABI, disabled default, typed target whitelist and atomic rejection");
 {
  Modulation m;auto c=enabled();CHECK(m.configure(c));CHECK(m.targets()[11]&&m.targets()[0]);CHECK(m.tick(48000,120)[11]==0);advance(m,11999);CHECK(std::abs(m.tick(48000,120)[11]-1)<1e-9);
  m.reset();CHECK(m.tick(48000,120)[11]==0);c.sources[0].routes[0].depth=-1;c.sources[0].intensity=.5f;CHECK(m.configure(c));m.reset();advance(m,12000);CHECK(std::abs(m.tick(48000,120)[11]+.5)<1e-9);
  c.source_count=4;for(uint32_t i=1;i<4;++i){c.sources[i]=c.sources[0];c.sources[i].id=i+1;}CHECK(m.configure(c));m.reset();advance(m,12000);CHECK(std::abs(m.tick(48000,120)[11]+2)<1e-9);
 }
 std::puts("PASS LFO bipolar depth/intensity, exact zero-crossing target mask and unclamped source sums");
 {
  Modulation continuous,muted;auto c=enabled();CHECK(continuous.configure(c));auto off=c;off.sources[0].enabled=0;CHECK(muted.configure(off));advance(continuous,17003);advance(muted,17003);CHECK(muted.configure(c));for(int i=0;i<1000;++i)CHECK(continuous.tick(48000,120)==muted.tick(48000,120));
  // Changing rate uses existing phase; only subsequent phase increments differ.
  auto faster=c;faster.sources[0].rate_hz=20;CHECK(muted.configure(faster));CHECK(continuous.tick(48000,120)==muted.tick(48000,120));
  Modulation a,b;c.source_count=2;c.sources[1]=c.sources[0];c.sources[1].id=99;c.sources[1].rate_hz=3;CHECK(a.configure(c)&&b.configure(c));advance(a,3981);advance(b,3981);std::swap(c.sources[0],c.sources[1]);CHECK(b.configure(c));for(unsigned i=0;i<2000;++i)exactOffsets(a.tick(48000,120),b.tick(48000,120),0,i);
 }
 std::puts("PASS LFO free-running disabled clocks, rate edit phase continuity and stable ID reordering");
 {
  Modulation reference,reordered;auto base=enabled();base.source_count=4;
  const unsigned ids[]={101,0,77,8};const float rates[]={.35f,1.125f,3.75f,19.f},depths[]={.731f,-.973f,.213f,-.417f};
  for(unsigned i=0;i<4;++i){base.sources[i]=base.sources[0];auto&s=base.sources[i];s.id=ids[i];s.rate_hz=rates[i];s.waveform=i==3?BS_LFO_SMOOTH_RANDOM:i;s.intensity=.37f+float(i)*.19f;s.route_count=3;s.routes[0]={0,0,BS_CUTOFF,depths[i]};s.routes[1]={0,0,BS_GAIN,depths[3-i]};s.routes[2]={0,0,BS_FILTER_RESONANCE,depths[(i+1)%4]};}
  CHECK(reference.configure(base)&&reordered.configure(base));advance(reference,17003);advance(reordered,17003);
  std::array<unsigned,4> order{{0,1,2,3}};unsigned permutations=0;
  do{auto c=base;for(unsigned i=0;i<4;++i)c.sources[i]=base.sources[order[i]];CHECK(reordered.configure(c));CHECK(std::memcmp(&c,&reordered.configV3(),sizeof c)==0);for(unsigned frame=0;frame<1000;++frame)exactOffsets(reference.tick(48000,120),reordered.tick(48000,120),permutations,frame);++permutations;}while(std::next_permutation(order.begin(),order.end()));
  CHECK(permutations==24);
 }
 std::puts("PASS all24 LFO source permutations retain exact signed shared-target sums and UI order");
 {
  Modulation m;auto c=enabled();c.sources[0].synced=1;c.sources[0].division=8;c.sources[0].triplet=1;CHECK(m.configure(c));advance(m,2000);CHECK(std::abs(m.tick(48000,120)[11]-1)<1e-9); //6Hz at120BPM
  for(uint32_t wave=0;wave<=4;++wave){c=enabled(wave);c.sources[0].rate_hz=20;CHECK(m.configure(c));m.reset();double previous=m.tick(48000,120)[11];for(int i=0;i<96000;++i){const double v=m.tick(48000,120)[11];CHECK(std::isfinite(v)&&std::abs(v)<=1.0000000001);if(wave==4)CHECK(std::abs(v-previous)<.002);previous=v;}}
  c=enabled(4);CHECK(m.configure(c));m.reset();std::array<double,300> first{};for(auto&v:first)v=m.tick(48000,120)[11];m.reset();for(double v:first)CHECK(v==m.tick(48000,120)[11]);
 }
 std::puts("PASS LFO tempo division/triplets, all waveform bounds and smooth random deterministic reset");
 {
  auto*a=synth();auto*b=synth();bs_modulation_config_v3 c{};bs_default_modulation_v3(&c);bs_modulation_config_v3 saved{};CHECK(bs_get_modulation_v3(a,&saved));CHECK(std::memcmp(&c,&saved,sizeof c)==0);CHECK(bs_set_modulation_v3(b,&c));bs_note_on(a,0,60,1);bs_note_on(b,0,60,1);CHECK(render(a,24000,127)==render(b,24000,256));
  c.sources[0].enabled=1;c.sources[0].waveform=BS_LFO_SQUARE;c.sources[0].route_count=1;c.sources[0].routes[0]={0,0,BS_GAIN,.3f};bs_patch before{},after{};CHECK(bs_get_patch(b,&before));CHECK(bs_set_modulation_v3(b,&c));CHECK(render(a,4800,127)!=render(b,4800,256));CHECK(bs_get_patch(b,&after));CHECK(std::memcmp(&before,&after,sizeof before)==0);
  c.sources[0].enabled=0;CHECK(bs_set_modulation_v3(b,&c));render(a,12000,127);render(b,12000,256);CHECK(render(a,2400,127)==render(b,2400,256)); // exact settled baseline, no accumulating save mutation
  auto bad=c;bad.sources[0].routes[0].depth=2;CHECK(!bs_set_modulation_v3(b,&bad));CHECK(bs_get_modulation_v3(b,&saved));CHECK(std::memcmp(&c,&saved,sizeof c)==0);bs_destroy(a);bs_destroy(b);
 }
 std::puts("PASS actual LFO sound modulation, disabled/bypass exact audio, baseline preservation and public atomic validation");
 {
  auto*a=synth();auto*b=synth();auto c=enabled(4);c.sources[0].rate_hz=3;c.sources[0].route_count=2;c.sources[0].routes[0]={0,0,BS_CUTOFF,.3f};c.sources[0].routes[1]={0,0,BS_GAIN,.2f};CHECK(bs_set_modulation_v3(a,&c)&&bs_set_modulation_v3(b,&c));bs_note_on(a,0,60,.8f);bs_note_on(b,0,60,.8f);CHECK(render(a,48000,1)==render(b,48000,127));
  bs_reset(a);bs_reset(b);CHECK(bs_set_modulation_v3(a,&c));c.sources[0].enabled=0;CHECK(bs_set_modulation_v3(b,&c));render(a,13003,127);render(b,13003,256);c.sources[0].enabled=1;CHECK(bs_set_modulation_v3(b,&c)); // allow offset smoother to match, phases remain running
  render(a,12000,127);render(b,12000,256);bs_panic(a);bs_panic(b);bs_note_on(a,0,60,1);bs_note_on(b,0,60,1);const auto x=render(a,2400,127),y=render(b,2400,256);double maxError=0;for(unsigned i=0;i<x.size();++i)maxError=std::max(maxError,std::abs(double(x[i])-y[i]));CHECK(maxError<1e-7);bs_destroy(a);bs_destroy(b);
 }
 std::puts("PASS actual LFO block invariance, idle/disabled phase continuity and panic clock preservation");
}
