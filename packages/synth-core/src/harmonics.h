#ifndef BLOCKS_HARMONICS_ENGINE_H
#define BLOCKS_HARMONICS_ENGINE_H
#include "blocks_harmonics.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
namespace blocks_detail {
inline bs_harmonics_config defaultHarmonics(){bs_harmonics_config c{};c.version=BS_HARMONICS_VERSION;return c;}
inline bs_harmonics_entry defaultHarmonicsEntry(uint32_t id){return {id,BS_HARMONICS_ROUND,0,0,1,0};}
inline bool validHarmonics(const bs_harmonics_config&c){
 if(c.version!=BS_HARMONICS_VERSION||c.count>BS_HARMONICS_CAPACITY)return false;
 for(unsigned i=0;i<c.count;++i){const auto&e=c.entries[i];if(!e.id||e.model>BS_HARMONICS_FOLD||!std::isfinite(e.tone)||e.tone< -1||e.tone>1||!std::isfinite(e.dynamics)||e.dynamics<0||e.dynamics>1||!std::isfinite(e.mix)||e.mix<0||e.mix>1||!std::isfinite(e.output_db)||e.output_db< -12||e.output_db>12)return false;for(unsigned j=0;j<i;++j)if(c.entries[j].id==e.id)return false;}return true;
}
inline bs_harmonics_entry harmonicsEntry(const bs_harmonics_config&c,uint32_t id){for(unsigned i=0;i<c.count;++i)if(c.entries[i].id==id)return c.entries[i];return defaultHarmonicsEntry(id);}

// Original analytic profiles, not circuit or commercial-product emulations.
inline double harmonicRound(double x){if(x>=1)return 8./15;if(x<=-1)return -8./15;const double q=x*x;return x*(1-q*(2./3-q/5));}
inline double harmonicRoundPrimitive(double x){const double a=std::abs(x);if(a>=1)return (8./15)*a-1./6;const double q=x*x;return q*(.5-q*(1./6-q/30));}
inline double harmonicCurve(double x,unsigned model){
 if(model==BS_HARMONICS_ROUND)return harmonicRound(x);
 if(model==BS_HARMONICS_TUBE){constexpr double b=.25,q=b*b,s=(1-q)*(1-q),v=b*(1-q*(2./3-q/5));return (harmonicRound(x+b)-v)/s;}
 const double u=x-4*std::floor((x+2)/4);return u*(1-std::abs(u)*.5);
}
inline double harmonicCurvePrimitive(double x,unsigned model){
 if(model==BS_HARMONICS_ROUND)return harmonicRoundPrimitive(x);
 if(model==BS_HARMONICS_TUBE){constexpr double b=.25,q=b*b,s=(1-q)*(1-q),v=b*(1-q*(2./3-q/5));return (harmonicRoundPrimitive(x+b)-harmonicRoundPrimitive(b)-v*x)/s;}
 const double u=x-4*std::floor((x+2)/4);return u*u*(.5-std::abs(u)/6);
}
struct HarmonicADAA {
 double previous=0,primitive=0;
 void reset(unsigned model){previous=0;primitive=harmonicCurvePrimitive(0,model);}
 double process(double x,unsigned model){const double delta=x-previous,current=harmonicCurvePrimitive(x,model);const double value=std::abs(delta)>1e-6?(current-primitive)/delta:harmonicCurve((x+previous)*.5,model);previous=x;primitive=current;return value;}
};
struct HarmonicsFIR {
 std::array<double,31> history{};unsigned at=0;
 double process(double input,const std::array<double,31>&coefficients,bool emit=true){history[at]=input;double sum=0;if(emit)for(unsigned i=0;i<31;++i)sum+=coefficients[i]*history[(at+31-i)%31];at=(at+1)%31;return sum;}
};
// Zero-stuffed interpolation split into two phases. Preserve nonzero tiny
// odd coefficients and accumulation order; downsample phase1 only stores.
struct HarmonicsInterpolator {
 std::array<double,16> history{};unsigned at=15;
 double process(double input,unsigned phase,const std::array<double,31>&coefficients){if(!phase){at=(at+1)%16;history[at]=2*input;}double sum=0;for(unsigned i=phase;i<31;i+=2)sum+=coefficients[i]*history[(at+16-i/2)%16];return sum;}
};
class Harmonics {
 bs_harmonics_entry requested_=defaultHarmonicsEntry(1);
 double smooth_=0,dynamics_=0,mix_=1,output_=1,outputTarget_=1;
 double postLow_=0,toneAlpha_=0,lowGain_=1,highGain_=1,lowTarget_=1,highTarget_=1,previousDriven_=0;
 double fast_=0,slow_=0,fastAttack_=0,fastRelease_=0,slowAlpha_=0;
 double wetDCInput_=0,wetDCOutput_=0,dryDCInput_=0,dryDCOutput_=0,dcPole_=0,previousLinear_=0;
 std::array<double,3> weights_{{1,0,0}};std::array<HarmonicADAA,3> colours_{};
 inline static constexpr std::array<double,31> coefficients_{{2.9449853528236676e-19,7.8155878394335589e-20,.00041032287080936366,-7.8379050640788443e-19,-.0022302855185240434,2.5338351921943237e-18,.0071008571320414328,-5.6423434323296102e-18,-.017917030421899405,9.9362814605681011e-18,.040107417651266825,-1.4544272985382546e-17,-.090106922079616888,1.8132576385607494e-17,.31263332162053092,.5000046374907835,.31263332162053092,1.8132576385607491e-17,-.090106922079616888,-1.4544272985382555e-17,.040107417651266845,9.9362814605681026e-18,-.017917030421899429,-5.6423434323296141e-18,.0071008571320414372,2.5338351921943237e-18,-.0022302855185240417,-7.8379050640788481e-19,.00041032287080936246,7.8155878394336131e-20,2.9449853528236676e-19}};
 HarmonicsInterpolator up_;HarmonicsFIR downWet_,downDry_;
 static double toward(double value,double target,double smoothing){const double next=value+smoothing*(target-value);return std::abs(next-target)<1e-12?target:next;}
 double dc(double input,double&previous,double&output){const double y=(1+dcPole_)*.5*(input-previous)+dcPole_*output;previous=input;output=std::abs(y)<1e-20?0:y;return output;}
public:
 static constexpr double filterLatencySamples=15.25;
 Harmonics()=default; // prepare before rendering; unused nodes do no DSP work
 void prepare(double rate){smooth_=1-std::exp(-1/(.005*rate));toneAlpha_=1-std::exp(-6.283185307179586*700/rate);dcPole_=std::exp(-6.283185307179586*5/rate);fastAttack_=1-std::exp(-1/(.001*rate));fastRelease_=1-std::exp(-1/(.05*rate));slowAlpha_=1-std::exp(-1/(.035*rate));reset();}
 void configure(const bs_harmonics_entry&entry,bool immediate=false){
  requested_=entry;outputTarget_=std::pow(10.,entry.output_db/20.);lowTarget_=std::pow(10.,-entry.tone*12/20.);highTarget_=1/lowTarget_;
  if(immediate){dynamics_=entry.dynamics;mix_=entry.mix;output_=outputTarget_;lowGain_=lowTarget_;highGain_=highTarget_;for(unsigned i=0;i<3;++i){if(weights_[i]==0&&entry.model==i){colours_[i].previous=previousDriven_;colours_[i].primitive=harmonicCurvePrimitive(previousDriven_,i);}weights_[i]=entry.model==i?1:0;}}
 }
 void reset(){up_={};downWet_={};downDry_={};for(unsigned i=0;i<3;++i)colours_[i].reset(i);fast_=slow_=wetDCInput_=wetDCOutput_=dryDCInput_=dryDCOutput_=previousLinear_=postLow_=previousDriven_=0;configure(requested_,true);}
 // The fourth argument is the magnitude after voice amplitude/velocity, for
 // a rack placed before its final envelope. Never divide audio by an envelope.
 double process(double input,double drive,double linkedMagnitude=-1,double expressionMagnitude=-1){
  dynamics_=toward(dynamics_,requested_.dynamics,smooth_);mix_=toward(mix_,requested_.mix,smooth_);output_=toward(output_,outputTarget_,smooth_);lowGain_=toward(lowGain_,lowTarget_,smooth_);highGain_=toward(highGain_,highTarget_,smooth_);
  for(unsigned i=0;i<3;++i){if(weights_[i]==0&&requested_.model==i){colours_[i].previous=previousDriven_;colours_[i].primitive=harmonicCurvePrimitive(previousDriven_,i);}weights_[i]=toward(weights_[i],requested_.model==i?1:0,smooth_);}
  const double magnitude=expressionMagnitude>=0?expressionMagnitude:linkedMagnitude>=0?linkedMagnitude:std::abs(input);
  fast_+=(magnitude>fast_?fastAttack_:fastRelease_)*(magnitude-fast_);slow_+=slowAlpha_*(fast_-slow_);
  // A smoothed copy of the SAME peak envelope avoids steady carrier inflation.
  //12% deadband rejects ripple; the floor prevents quiet-signal pumping.
  const double transient=std::max(0.,std::min(1.,((fast_-slow_)/(slow_+.005)-.12)*1.25));
  const double effectiveDrive=1+(std::max(1.,std::min(12.,drive))-1)*(1-.5*dynamics_*transient);
  double wet=0,dry=0;
  for(unsigned half=0;half<2;++half){const double sample=up_.process(input,half,coefficients_),driven=sample*effectiveDrive,linear=.5*(sample+previousLinear_);previousLinear_=sample;
   double shaped=0;for(unsigned i=0;i<3;++i)if(weights_[i]>0)shaped+=weights_[i]*colours_[i].process(driven,i);previousDriven_=driven;
   const double w=downWet_.process(shaped,coefficients_,half==0),d=downDry_.process(linear,coefficients_,half==0);if(half==0){wet=w;dry=d;}}
  postLow_+=toneAlpha_*(wet-postLow_);if(lowGain_!=1||highGain_!=1)wet=postLow_*lowGain_+(wet-postLow_)*highGain_;
  wet*=1+2*dynamics_*transient;wet=dc(wet,wetDCInput_,wetDCOutput_);dry=dc(dry,dryDCInput_,dryDCOutput_);
  return (dry+mix_*(wet-dry))*output_;
 }
};
static_assert(sizeof(bs_harmonics_entry)==24&&offsetof(bs_harmonics_entry,tone)==8,"Harmonics entry ABI");
static_assert(sizeof(bs_harmonics_config)==392&&offsetof(bs_harmonics_config,entries)==8,"Harmonics config ABI");
}
#endif
