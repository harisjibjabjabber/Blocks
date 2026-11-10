#include "../src/ladder_filter.h"
#include <cstdio>
#include <cstdlib>
#include <cmath>
#include <array>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(0)
using blocks_detail::LadderFilter;using blocks_detail::LadderCoefficients;
// Deliberately unoptimized zero-stuff/reference FIR implementation. This
// tests sample indexing/phase/history equivalence, not independent ladder math.
struct Reference {
 LadderFilter nonlinear;
 std::array<double,127>up{},wet{},dry{};unsigned upAt=0,wetAt=0,dryAt=0;
 double fir(std::array<double,127>&history,unsigned&at,double input){history[at]=input;double sum=0;for(unsigned i=0;i<127;++i)sum+=LadderFilter::taps()[i]*history[(at+127-i)%127];at=(at+1)%127;return sum;}
 double process(double input,const LadderCoefficients&c,double drive,double mix){double wetOut=0,dryOut=0;for(unsigned phase=0;phase<8;++phase){double x=8*fir(up,upAt,phase?0:input),y=nonlinear.step(x*drive*c.gain,c)/drive;double w=fir(wet,wetAt,y),d=fir(dry,dryAt,x);if(phase==0){wetOut=w;dryOut=d;}}return mix==1?wetOut:dryOut+(wetOut-dryOut)*mix;}
};
int main(){
 // The polyphase sum omits zero-valued products and unused decimator sums.
 // These are algebraically identical, but native compiler contraction/codegen
 // may round differently through the recursive nonlinear solve. Keep a strict
 // WASM null, and a native1e-12 full-scale/relative bound (-240dB at unit scale).
 // This is a regression tolerance, not an assumed diagnosis of the CI failure.
 for(double rate:{8000.,44100.,48000.,96000.,192000.,384000.}){LadderFilter optimized;Reference reference;LadderCoefficients c;
  double maxAbsolute=0,maxRelative=0,maxScaled=0,worstA=0,worstB=0;unsigned worstSample=0,different=0;
  for(unsigned i=0;i<10000;++i){const double input=.7*std::sin(.137*i)+(i%503==0?.3:0),cutoff=i%509<253?200:20000,resonance=i%719<359?.1:.9,drive=i%809<401?1:12,mix=i%997<333?1:i%997<666?0:.37;c.set(cutoff,resonance,rate);double a=optimized.process(input,c,drive,mix),b=reference.process(input,c,drive,mix);CHECK(std::isfinite(a)&&std::isfinite(b));const double error=std::abs(a-b),magnitude=std::max(std::abs(a),std::abs(b));different+=a!=b;maxRelative=std::max(maxRelative,error/std::max(1e-30,magnitude));maxScaled=std::max(maxScaled,error/std::max(1.,magnitude));if(error>maxAbsolute){maxAbsolute=error;worstSample=i;worstA=a;worstB=b;}}
  std::printf("METRIC polyphase rate=%.0f different=%u max_abs=%.17g max_relative=%.17g max_scaled=%.17g worst_sample=%u optimized=%a reference=%a\n",rate,different,maxAbsolute,maxRelative,maxScaled,worstSample,worstA,worstB);std::fflush(stdout);
  CHECK(maxScaled<=1e-12);
#ifdef __EMSCRIPTEN__
  CHECK(maxAbsolute==0);
#endif
 }
 std::puts("PASS optimized8x polyphase agrees with zero-stuff reference: WASM exact/native scaled1e-12 bound");
 {LadderFilter filter;LadderCoefficients c;c.set(2000,.5,48000);for(unsigned i=0;i<1000;++i)filter.process(.5,c,4,1);filter.clear();for(unsigned i=0;i<300;++i)CHECK(filter.process(0,c,4,double(i%3)*.5)==0);CHECK(LadderFilter::latency==15.75&&LadderFilter::oversampling==8&&LadderFilter::filterTaps==127);}
 std::puts("PASS8x FIR histories clear exactly; dry stays available after fully wet processing");
}
