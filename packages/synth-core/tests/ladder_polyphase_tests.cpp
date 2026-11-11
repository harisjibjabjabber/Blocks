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
 {double residual=0;for(double rate:{8000.,48000.,384000.}){LadderFilter fast,measured;LadderCoefficients c;
  for(unsigned i=0;i<12000;++i){c.set(i%251<123?20:20000,i%127<61?0:1,rate);const double x=1.7*std::sin(.329*i),drive=i%173<87?1:12,mix=double(i%99)/98;const double a=fast.process(x,c,drive,mix),b=measured.process<true>(x,c,drive,mix);CHECK(a==b);CHECK(fast.state==measured.state&&fast.previous==measured.previous);}
  CHECK(fast.worstResidual==0);CHECK(measured.worstResidual<1e-12);residual=std::max(residual,measured.worstResidual);}
 CHECK(residual>0);std::printf("PASS diagnostic-on/off audio and recursive states exact; measured residual %.9g\n",residual);}
 {LadderFilter neutral,boosted,dry,boostDry;LadderCoefficients c;c.set(3000,.6,48000);for(unsigned i=0;i<4000;++i){const double x=.6*std::sin(.071*i);CHECK(boosted.process(x,c,8,1,2)==neutral.process(x,c,8,1)*2);CHECK(boostDry.process(x,c,8,0,2)==dry.process(x,c,8,0));}}
 std::puts("PASS optional wet makeup scales decimated wet only and leaves Mix0 dry exact");
 {double error=0;for(double drive:{1.,4.,12.}){LadderFilter normalized,raw;LadderCoefficients c;c.set(6000,.65,48000);for(unsigned i=0;i<4000;++i){double x=.7*std::sin(.219*i);double a=normalized.process(x,c,drive,1)*drive,b=raw.processRaw(x,c,drive,1);error=std::max(error,std::abs(a-b));CHECK(normalized.state==raw.state);}}CHECK(error<1e-12);std::printf("PASS constant-Drive raw vs normalized times Drive max error %.9g\n",error);}
 {LadderFilter raw,dry;LadderCoefficients c;c.set(20000,.9,48000);double peak=0;for(unsigned i=0;i<12000;++i){double drive=1+11*double(i%2000)/1999,x=.7*std::sin(.219*i),y=raw.processRaw<true>(x,c,drive,1);CHECK(std::isfinite(y)&&std::abs(y)<2);peak=std::max(peak,std::abs(y));}CHECK(raw.worstResidual<1e-12);std::printf("PASS live raw Drive sweep bounded peak %.9g residual %.9g\n",peak,raw.worstResidual);}


}
