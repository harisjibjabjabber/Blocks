#include "../src/output_limiter.h"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL line%d: %s\n",__LINE__,#x);std::exit(1);}}while(0)
int main(){
 for(double rate:{8000.,44100.,48000.,96000.,384000.}){
  blocks_detail::OutputLimiter h;h.prepare(rate);const unsigned latency=h.latency();CHECK(latency>=8&&latency<=384);
  for(unsigned i=0;i<latency+1000;++i){double l=i==0?.7:0,r=i==0?-.3:0;h.process(l,r);CHECK(l==(i==latency?.7:0)&&r==(i==latency?-.3:0));}
  CHECK(h.meters().gain_reduction_db==0);
  h.clear();for(unsigned i=0;i<unsigned(rate*.2);++i){double l=i==10?20:0,r=i==10?-5:0;h.process(l,r);CHECK(std::abs(l)<=.9800000001&&std::abs(r)<=.9800000001);if(i==10+latency){CHECK(std::abs(l-.98)<1e-10);CHECK(std::abs(l/r+4)<1e-10);}}
  h.clear();for(unsigned i=0;i<unsigned(rate*.5);++i){double in=3*std::sin(i*.173)+2*std::sin(i*.37),l=in,r=in*.25;h.process(l,r);CHECK(std::isfinite(l)&&std::abs(l)<=.9800000001);if(std::abs(l)>1e-12)CHECK(std::abs(r/l-.25)<1e-10);}
  h.clear();for(unsigned i=0;i<1000;++i){double l=0,r=0;h.process(l,r);CHECK(l==0&&r==0);}CHECK(h.meters().input_peak==0&&h.meters().gain_reduction_db==0);
 }
 std::puts("PASS rate-dependent exact transparent latency, isolated hot peaks, linked stereo, sustained multitone ceiling and reset");
}
