#include "blocks_synth.h"
#include "blocks_output.h"
#include "blocks_harmonics_suite.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Metrics{double front=0,hit=0,body=0,peak=0,gr=0;};
static std::array<Metrics,4> render(unsigned wave,double attack,double dynamics,bool chain){
 auto*s=bs_create();CHECK(s&&bs_prepare(s,48000));
 for(auto p:{std::pair<unsigned,float>{BS_OSC1_WAVE,float(wave)},{BS_OSC1_LEVEL,.8f},{BS_OSC2_LEVEL,0},{BS_GAIN,.35f},{BS_DRIFT_CENTS,0},{BS_SETTLING_CENTS,0},{BS_PITCH_DROP_ENABLED,0},{BS_FULLNESS_ENABLED,0},{BS_FILTER_MIX,0},{BS_ATTACK,float(attack)},{BS_DECAY,.24f},{BS_SUSTAIN_LEVEL,0},{BS_RELEASE,.05f}})CHECK(bs_set_parameter(s,p.first,p.second));
 bs_harmonics_suite_config c{};bs_default_harmonics_suite(&c);c.enabled=1;c.dynamics=float(dynamics);c.colour_enabled=chain;c.comp_enabled=chain;c.drive_db=12;c.colour_output_db=-9;c.comp_threshold_db=-28;c.comp_attack_ms=8;CHECK(bs_set_harmonics_suite(s,&c));bs_reset(s);
 std::array<Metrics,4> result{};const unsigned keys[]={36,43,48,55},latency=bs_output_latency(s);constexpr unsigned length=16320;std::vector<float>l(length),r(length);
 for(unsigned note=0;note<4;++note){bs_note_on(s,0,keys[note],note%2?.6f:.9f);for(unsigned at=0;at<length;){if(at==10560)bs_note_off(s,0,keys[note]);unsigned n=std::min(128u,length-at);if(at<10560)n=std::min(n,10560-at);CHECK(!bs_render(s,l.data()+at,r.data()+at,n,nullptr,0));bs_output_meters m{};CHECK(bs_get_output_meters(s,&m));result[note].gr=std::max(result[note].gr,double(m.gain_reduction_db));at+=n;}
  for(unsigned i=latency;i<length;++i){double e=(double(l[i])*l[i]+double(r[i])*r[i])*.5,t=double(i-latency)/48000;auto&m=result[note];CHECK(std::isfinite(e));if(t>=.001&&t<.008)m.front+=e/(.007*48000);if(t>=.008&&t<.030)m.hit+=e/(.022*48000);if(t>=.060&&t<.200)m.body+=e/(.140*48000);m.peak=std::max(m.peak,std::max(std::abs(double(l[i])),std::abs(double(r[i]))));}
 }bs_destroy(s);return result;
}
int main(int argc,char**){const bool reportOnly=argc>1;unsigned checked=0;double leastFront=100,leastHit=100,largestPeak=-100;if(reportOnly)std::puts("wave,attack,chain,amount,note,front_db,hit_db,body_db,peak_db,limiter_gr");
 for(unsigned wave:{unsigned(BS_SINE),unsigned(BS_SAW)})for(double attack:{.001,.015})for(bool chain:{false,true}){
  const auto base=render(wave,attack,0,chain);for(double amount:{-.25,-.5,-1.,1.}){const auto altered=render(wave,attack,amount,chain);for(unsigned i=0;i<4;++i){const auto&a=altered[i];const auto&b=base[i];CHECK(b.front>1e-12&&b.hit>1e-12&&b.body>1e-12);double front=10*std::log10(a.front/b.front),hit=10*std::log10(a.hit/b.hit),body=10*std::log10(a.body/b.body),peak=20*std::log10(a.peak/b.peak);if(reportOnly)std::printf("%u,%.3f,%u,%.2f,%u,%.6f,%.6f,%.6f,%.6f,%.6f\n",wave,attack,unsigned(chain),amount,i,front,hit,body,peak,a.gr);if(amount<0){leastFront=std::min(leastFront,front);leastHit=std::min(leastHit,hit);largestPeak=std::max(largestPeak,peak);if(!reportOnly){CHECK(front>=0);CHECK(hit>=0);CHECK(body<=.05);CHECK(peak<8.5);CHECK(a.gr<.1);}}++checked;}}
 }std::printf("Tight minimum front%.4fdB /hit%.4fdB,maximum peakchange%.4fdB\n",leastFront,leastHit,largestPeak);std::printf("%s actual repeated-bass/pluck %u note-window cases, latency compensated\n",reportOnly?"REPORT":"PASS",checked);return 0;
}
