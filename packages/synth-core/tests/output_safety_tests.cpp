#include "blocks_synth.h"
#include "blocks_harmonics_suite.h"
#include "blocks_bass_support.h"
#include "../src/output_limiter.h"
#include <vector>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <algorithm>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));}~Synth(){bs_destroy(p);}};
static void setup(bs_synth*s,float gain,bool hot){
 for(auto p:{std::pair<unsigned,float>{BS_GAIN,gain},{BS_OSC1_WAVE,BS_SINE},{BS_OSC2_WAVE,BS_SINE},{BS_OSC1_LEVEL,1},{BS_OSC2_LEVEL,1},{BS_OSC2_DETUNE,0},{BS_FILTER_MIX,0},{BS_FULLNESS_ENABLED,0},{BS_DRIFT_CENTS,0},{BS_SETTLING_CENTS,0},{BS_ATTACK,.001f},{BS_SUSTAIN_LEVEL,1}})CHECK(bs_set_parameter(s,p.first,p.second));
 bs_harmonics_suite_config c{};bs_default_harmonics_suite(&c);c.enabled=hot;c.colour_enabled=0;c.output_db=12;CHECK(bs_set_harmonics_suite(s,&c));
 bs_sub_config sub{};bs_default_sub(&sub);sub.enabled=1;sub.level=1;CHECK(bs_set_sub(s,&sub));bs_reset(s);
 for(unsigned key=48;key<64;++key)bs_note_on(s,0,key,1);
}
static std::vector<float> render(bs_synth*s,unsigned n,unsigned block){std::vector<float>out(n*2);for(unsigned i=0;i<n;i+=block)CHECK(bs_render(s,out.data()+i,out.data()+n+i,std::min(block,n-i),nullptr,0)==0);return out;}
int main(){
 {double worst=0;for(double rate:{8000.,44100.,48000.,96000.,384000.}){
  blocks_detail::OutputLimiter h;h.prepare(rate);std::vector<double>history(20000);uint32_t seed=1;
  for(unsigned i=0;i<history.size();++i){seed=seed*1664525u+1013904223u;double x=(double(seed)/4294967296.-.5)*(i%127==0?100:6),l=x,r=-.37*x;history[i]=x;h.process(l,r);const double delayed=i>=h.latency()?history[i-h.latency()]:0,g=std::pow(10.,-h.meters().gain_reduction_db/20.),predicted=delayed*g;
   worst=std::max(worst,std::abs(l-predicted));CHECK(std::abs(predicted)<=.980002);CHECK(std::abs(l-predicted)<2e-6);CHECK(std::abs(r+.37*l)<1e-11);
  }
 }std::printf("METRIC limiter raw gain reconstruction error %.9g (float dB meter)\n",worst);}
 std::puts("PASS declared gain bounds hot randomized peaks before safety clamp across five rates");
 {Synth hot,quiet,partition;setup(hot.p,1,true);setup(quiet.p,.01f,true);setup(partition.p,1,true);auto a=render(hot.p,24000,127),b=render(partition.p,24000,1),q=render(quiet.p,24000,256);CHECK(a==b);double peak=0,qp=0;for(float x:a){CHECK(std::isfinite(x)&&std::abs(x)<=.980001f);peak=std::max(peak,std::abs(double(x)));}for(float x:q)qp=std::max(qp,std::abs(double(x)));bs_output_meters hm{},qm{};CHECK(bs_get_output_meters(hot.p,&hm)&&bs_get_output_meters(quiet.p,&qm));CHECK(hm.input_peak>1&&hm.gain_reduction_db>1&&qm.gain_reduction_db==0&&peak>.9&&qp>0&&qp<.98);std::printf("METRIC hot16notes+CleanSub input %.6g peak %.6g GR %.6g; master.01 input %.6g GR %.6g\n",hm.input_peak,peak,hm.gain_reduction_db,qm.input_peak,qm.gain_reduction_db);bs_panic(hot.p);auto silent=render(hot.p,512,127);for(float x:silent)CHECK(x==0);}
 std::puts("PASS actual hot polyphony plus CleanSub shares ceiling; master attenuation prevents limiting; blocks exact and panic immediate");
 {Synth a,b;setup(a.p,.005f,false);setup(b.p,.01f,false);const auto x=render(a.p,5000,31),y=render(b.p,5000,128);for(unsigned i=0;i<x.size();++i)CHECK(y[i]==2*x[i]);bs_output_meters m{};CHECK(bs_get_output_meters(b.p,&m)&&m.gain_reduction_db==0);}
 std::puts("PASS below-ceiling actual synth and Sub preserve exact linear master scaling without hidden tanh");
}
