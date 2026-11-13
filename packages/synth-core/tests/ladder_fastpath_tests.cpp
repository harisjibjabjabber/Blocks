#include "../src/ladder_filter.h"
#include <array>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
using blocks_detail::LadderFilter;using blocks_detail::LadderCoefficients;
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
// Frozen pre-optimization Newton equations. FIR order/coefficients unchanged.
struct Reference:LadderFilter{
 double oldStep(double input,const LadderCoefficients&c){const double G=c.G,S=(1-G)*(state[3]+G*(state[2]+G*(state[1]+G*state[0]))),rhs=input-c.feedback*S,K=c.K;double u=rhs;for(unsigned iteration=0;iteration<4;++iteration){const auto shaped=shape(u);const double residual=u+K*shaped.value-rhs,delta=residual/(1+K*shaped.derivative);u-=delta;if(std::abs(delta)<1e-13)break;}double stage=shape(u).value;worstResidual=std::max(worstResidual,std::abs(u+K*stage-rhs));for(unsigned i=0;i<4;++i){const double y=G*stage+(1-G)*state[i];state[i]=2*y-state[i];if(std::abs(state[i])<1e-20)state[i]=0;previous[i]=y;stage=y;}return stage;}
 double oldProcess(double input,const LadderCoefficients&c,double drive,double mix){up[upPosition]=input;double wet=0,aligned=0;for(unsigned phase=0;phase<oversampling;++phase){const double x=interpolate(phase),y=oldStep(x*drive*c.gain,c);const double w=decimate(down,downPosition,y,phase==0),d=decimate(dryDown,dryDownPosition,x,phase==0&&mix!=1);if(phase==0){wet=w;aligned=d;}}upPosition=(upPosition+1)&15u;return mix==1?wet:aligned+(wet-aligned)*mix;}
};
static volatile double sink=0;
template<bool old>static double bench(double resonance,double drive){std::array<Reference,8> filters;LadderCoefficients c;c.set(20000,resonance,48000);auto start=std::chrono::steady_clock::now();double sum=0;for(unsigned i=0;i<48000;++i){double x=.8*std::sin(i*.073);for(auto&f:filters){if constexpr(old)sum+=f.oldProcess(x,c,drive,1);else sum+=f.processRaw<true>(x,c,drive,1);}}sink=sum;return std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();}
int main(int argc,char**){double maxError=0;unsigned count=0;
 for(double rate:{8000.,16000.,44100.,48000.,96000.,384000.})for(double cutoff:{80.,1200.,20000.})for(double drive:{1.,4.,12.})for(double resonance:{0.,.0001,.7}){LadderFilter a;Reference b;LadderCoefficients c;c.set(cutoff,resonance,rate);for(unsigned i=0;i<1024;++i){if(i==512)c.set(cutoff,resonance==0?.2:0,rate);double x=i<8?(i&1?-0.:0.):.9*std::sin(i*.17)+.13*std::cos(i*.049);double mix=(i/128)%3*.5;const double y=a.processRaw<true>(x,c,drive,mix),z=b.oldProcess(x,c,drive,mix);maxError=std::max(maxError,std::abs(y-z));if(std::memcmp(&y,&z,sizeof y)!=0)std::fprintf(stderr,"DIAGNOSTIC rate=%g cutoff=%g drive=%g resonance=%g frame=%u candidate=%a reference=%a abs=%.17g\n",rate,cutoff,drive,resonance,i,y,z,std::abs(y-z));CHECK(std::memcmp(&y,&z,sizeof y)==0);}CHECK(a.state==b.state&&a.previous==b.previous&&a.up==b.up&&a.down==b.down&&a.dryDown==b.dryDown&&a.worstResidual==b.worstResidual);++count;}
 std::printf("METRIC %u cases exact8x PCM/state max_error %.17g\n",count,maxError);std::puts("PASS feedback-zero optimization equals frozen Newton reference through resonance changes, six rates and matched dry/wet");
 if(argc>1)for(double resonance:{0.,.7})for(double drive:{1.,12.}){bench<true>(resonance,drive);bench<false>(resonance,drive);for(unsigned trial=0;trial<3;++trial){double a,b;if(trial&1){b=bench<false>(resonance,drive);a=bench<true>(resonance,drive);}else{a=bench<true>(resonance,drive);b=bench<false>(resonance,drive);}std::printf("TIMING res %.2f drive %.0f trial %u old_ms %.6f new_ms %.6f ratio %.6f\n",resonance,drive,trial,a,b,b/a);}}
}
