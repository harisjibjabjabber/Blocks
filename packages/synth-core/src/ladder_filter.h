#ifndef BLOCKS_LADDER_FILTER_H
#define BLOCKS_LADDER_FILTER_H
#include <array>
#include <algorithm>
#include <cmath>
namespace blocks_detail {
// Original implementation: four nonlinear trapezoidal stages in an implicit
// feedback loop. Each stage obeys y=s+g*(tanh(previous)-tanh(y)). Newton's
// Jacobian is bidiagonal with one feedback corner; affine elimination solves
// all four simultaneous updates without a delayed feedback sample.
struct LadderCoefficients {
 double g=0,feedback=0,gain=1,cutoff=-1,rate=-1,resonance=-1;
 void set(double hz,double res,double sampleRate){
  hz=std::clamp(hz,20.,sampleRate*.45);res=std::clamp(res,0.,1.);
  if(hz==cutoff&&res==resonance&&sampleRate==rate)return;
  cutoff=hz;resonance=res;rate=sampleRate;
  g=std::tan(3.14159265358979323846*hz/(8*sampleRate));
  feedback=3.8*res;gain=1+feedback;
 }
};
struct LadderFilter {
 static constexpr unsigned oversampling=8,filterTaps=127;
 static constexpr double latency=15.75;
 std::array<double,4> state{},previous{};
 std::array<double,16> up{};std::array<double,filterTaps> down{},dryDown{};
 unsigned upPosition=0,downPosition=0,dryDownPosition=0;
 double worstResidual=0;
 struct Shape{double value,derivative;};
 // [7/6] Pade approximation of tanh, with its analytical derivative in the
 // solver. Over[-4,4], max absolute error<1.50e-5. Exact tails avoid the
 // rational function's unbounded far-field behavior. No lookup clipping.
 static Shape shape(double x){
  if(std::abs(x)>4){const double y=std::tanh(x);return{y,1-y*y};}
  const double z=x*x,n=135135+z*(17325+z*(378+z)),d=135135+z*(62370+z*(3150+28*z));
  const double numerator=x*n;
  const double derivative=((n+2*z*(17325+z*(756+3*z)))*d-numerator*2*x*(62370+z*(6300+84*z)))/(d*d);
  const double value=numerator/d;
  if(std::abs(x)<=3)return{value,derivative};
  const double exact=std::tanh(x),t=std::abs(x)-3,weight=t*t*(3-2*t),slope=6*t*(1-t)*(x<0?-1:1);
  return{value+(exact-value)*weight,derivative+(1-exact*exact-derivative)*weight+(exact-value)*slope};
 }
 //127-tap Kaiser8.6 lowpass, scipy.signal.firwin(127,.125).
 // Polyphase interpolation evaluates only the nonzero native-input terms.
 // Both decimators retain all high-rate history but evaluate phase0 only.
 static const std::array<double,filterTaps>&taps(){static constexpr std::array<double,filterTaps> h{{-2.5764162331204167e-06,-8.0919255460225807e-06,-1.6285435570700094e-05,-2.5555922127601096e-05,-3.2828244139013806e-05,-3.3865978152409515e-05,-2.4111564086217372e-05,6.967314723542369e-20,3.9469369865887284e-05,9.1269283542041378e-05,0.00014744965783276809,0.00019526674356301637,0.000218660714175279,0.00020114906653622704,0.00012985338866414642,-2.9536370802611096e-19,-0.00018108044694121683,-0.00039158806753488069,-0.00059558037036118352,-0.00074669494980413682,-0.00079536253669960965,-0.00069881934984447657,-0.0004324096865038417,7.8807823677287434e-19,0.00055901020964707311,0.0011684490925340971,0.0017215740072062796,0.0020951689356177631,0.0021704212055534489,0.0018577975690007261,0.0011217190256044506,-1.5983125114918944e-18,-0.0013869471061145333,-0.0028410853698513021,-0.0041078053223418363,-0.0049121647710469929,-0.0050063141674441302,-0.0042212316896537072,-0.0025138532622962918,2.6530774944364456e-18,0.00303548669918681,0.0061572367277085843,0.0088280667515548937,0.010484376558923671,0.010629458041887483,0.0089315705688710195,0.0053109906652855261,-3.7393132911653696e-18,-0.0064377559141934153,-0.013137064819286653,-0.019011618967020888,-0.022878707242243633,-0.023613995862531014,-0.020316185944662914,-0.012457989320653968,4.5640966400938463e-18,0.016552127917821624,0.036159643491069975,0.05733475970643593,0.078289319946926478,0.097130784083888727,0.1120806749889787,0.12168653457068952,0.12499856332862704,0.12168653457068952,0.1120806749889787,0.097130784083888727,0.078289319946926478,0.05733475970643593,0.036159643491069975,0.016552127917821624,4.5640966400938463e-18,-0.012457989320653968,-0.020316185944662914,-0.023613995862531014,-0.022878707242243633,-0.019011618967020888,-0.013137064819286653,-0.0064377559141934153,-3.7393132911653696e-18,0.0053109906652855261,0.0089315705688710195,0.010629458041887483,0.010484376558923671,0.0088280667515548937,0.0061572367277085843,0.00303548669918681,2.6530774944364456e-18,-0.0025138532622962918,-0.0042212316896537072,-0.0050063141674441302,-0.0049121647710469929,-0.0041078053223418363,-0.0028410853698513021,-0.0013869471061145333,-1.5983125114918944e-18,0.0011217190256044506,0.0018577975690007261,0.0021704212055534489,0.0020951689356177631,0.0017215740072062796,0.0011684490925340971,0.00055901020964707311,7.8807823677287434e-19,-0.0004324096865038417,-0.00069881934984447657,-0.00079536253669960965,-0.00074669494980413682,-0.00059558037036118352,-0.00039158806753488069,-0.00018108044694121683,-2.9536370802611096e-19,0.00012985338866414642,0.00020114906653622704,0.000218660714175279,0.00019526674356301637,0.00014744965783276809,9.1269283542041378e-05,3.9469369865887284e-05,6.967314723542369e-20,-2.4111564086217372e-05,-3.3865978152409515e-05,-3.2828244139013806e-05,-2.5555922127601096e-05,-1.6285435570700094e-05,-8.0919255460225807e-06,-2.5764162331204167e-06}};return h;}
 double interpolate(unsigned phase)const{
  const auto&h=taps();double sum=0;unsigned j=upPosition;
  for(unsigned tap=phase;tap<filterTaps;tap+=oversampling){sum+=h[tap]*up[j];j=j?j-1:15;}
  return oversampling*sum;
 }
 double decimate(std::array<double,filterTaps>&history,unsigned&position,double x,bool evaluate){
  history[position]=x;double sum=0;
  if(evaluate){unsigned j=position;const auto&h=taps();for(unsigned i=0;i<filterTaps;++i){sum+=h[i]*history[j];j=j?j-1:filterTaps-1;}}
  position=position+1==filterTaps?0:position+1;return sum;
 }
 double step(double input,const LadderCoefficients&c){
  auto y=previous;
  for(unsigned iteration=0;iteration<8;++iteration){
   std::array<double,4>a{},b{};double p=input-c.feedback*y[3];auto prior=shape(p);
   for(unsigned i=0;i<4;++i){const auto current=shape(y[i]);const double t=current.value,tp=prior.value,d=current.derivative,dp=prior.derivative;
    const double denominator=1+c.g*d;
    a[i]=(state[i]+c.g*(tp-dp*p-t+d*y[i]))/denominator;
    b[i]=c.g*dp/denominator;p=y[i];prior=current;
   }
   double sum=a[3],product=b[3];for(int i=2;i>=0;--i){sum+=product*a[unsigned(i)];product*=b[unsigned(i)];}
   double pnew=(input-c.feedback*sum)/(1+c.feedback*product);
   std::array<double,4>next{};double delta=0;
   for(unsigned i=0;i<4;++i){next[i]=a[i]+b[i]*pnew;delta=std::max(delta,std::abs(next[i]-y[i]));pnew=next[i];}
   // A bounded update prevents Newton overshoot under large input/fast sweeps.
   const double scale=delta>1?1/delta:1;
   for(unsigned i=0;i<4;++i)y[i]+=(next[i]-y[i])*scale;
   if(delta<1e-11)break;
  }
  double prior=shape(input-c.feedback*y[3]).value;
  for(unsigned i=0;i<4;++i){const double current=shape(y[i]).value;worstResidual=std::max(worstResidual,std::abs(y[i]-state[i]-c.g*(prior-current)));prior=current;state[i]=2*y[i]-state[i];if(std::abs(state[i])<1e-20)state[i]=0;}
  previous=y;return y[3];
 }
 double process(double input,const LadderCoefficients&c,double drive,double mix){
  // Genuine8x interpolation/nonlinear solve/decimation. The dry reference
  // shares both FIRs, so Mix changes have matched phase and linear response.
  // Mix0 is filtered dry, not an exact undelayed bypass. Model0 stays legacy.
  up[upPosition]=input;double wet=0,aligned=0;
  for(unsigned phase=0;phase<oversampling;++phase){const double x=interpolate(phase);
   const double y=step(x*drive*c.gain,c)/drive;
   const double w=decimate(down,downPosition,y,phase==0);
   const double d=decimate(dryDown,dryDownPosition,x,phase==0&&mix!=1);
   if(phase==0){wet=w;aligned=d;}
  }
  upPosition=(upPosition+1)&15u;
  return mix==1?wet:aligned+(wet-aligned)*mix;
 }
 void clear(){*this=LadderFilter{};}
};
}
#endif
