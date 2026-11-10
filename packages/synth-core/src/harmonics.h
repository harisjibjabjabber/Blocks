#ifndef BLOCKS_HARMONICS_ENGINE_H
#define BLOCKS_HARMONICS_ENGINE_H
#include "blocks_harmonics.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
namespace blocks_detail {
inline bs_harmonics_config defaultHarmonics(){bs_harmonics_config c{};c.version=BS_HARMONICS_VERSION;return c;}
inline bs_harmonics_entry defaultHarmonicsEntry(uint32_t id){return {id,0,0,0,1,0};}
inline bool validHarmonics(const bs_harmonics_config&c){
 if(c.version!=BS_HARMONICS_VERSION||c.count>BS_HARMONICS_CAPACITY)return false;
 for(unsigned i=0;i<c.count;++i){const auto&e=c.entries[i];if(!e.id||e.model>1||!std::isfinite(e.tone)||e.tone< -1||e.tone>1||!std::isfinite(e.dynamics)||e.dynamics<0||e.dynamics>1||!std::isfinite(e.mix)||e.mix<0||e.mix>1||!std::isfinite(e.output_db)||e.output_db< -12||e.output_db>12)return false;for(unsigned j=0;j<i;++j)if(c.entries[j].id==e.id)return false;}return true;
}
inline bs_harmonics_entry harmonicsEntry(const bs_harmonics_config&c,uint32_t id){for(unsigned i=0;i<c.count;++i)if(c.entries[i].id==id)return c.entries[i];return defaultHarmonicsEntry(id);}

// Original C1 continuous soft clip and its exact primitive. No copied circuit.
inline double harmonicSoft(double x){return x>1?2./3:x< -1?-2./3:x-x*x*x/3;}
// Primitive at |x|=1 is5/12, not the transfer's endpoint2/3.
inline double harmonicPrimitiveSoft(double x){const double a=std::abs(x);return a>1?5./12+(a-1)*2./3:x*x*.5-x*x*x*x/12;}
inline double harmonicCurve(double x,unsigned model){constexpr double bias=.3,base=bias-bias*bias*bias/3,slope=1-bias*bias;return model?(harmonicSoft(x+bias)-base)/slope:harmonicSoft(x);}
inline double harmonicCurvePrimitive(double x,unsigned model){constexpr double bias=.3,base=bias-bias*bias*bias/3,slope=1-bias*bias;return model?(harmonicPrimitiveSoft(x+bias)-harmonicPrimitiveSoft(bias)-base*x)/slope:harmonicPrimitiveSoft(x);}
struct HarmonicADAA {
 double previous=0,primitive=0;
 void reset(unsigned model){previous=0;primitive=harmonicCurvePrimitive(0,model);}
 double process(double x,unsigned model){const double delta=x-previous,current=harmonicCurvePrimitive(x,model);const double value=std::abs(delta)>1e-6?(current-primitive)/delta:harmonicCurve((x+previous)*.5,model);previous=x;primitive=current;return value;}
};
//31-tap Blackman half-band FIR. Same coefficients on reconstruction and both
//downsampled paths; no phase-mismatched immediate dry is mixed while enabled.
struct HarmonicsFIR {
 std::array<double,31> history{};unsigned at=0;
 double process(double input,const std::array<double,31>&coefficients){history[at]=input;double sum=0;for(unsigned i=0;i<31;++i)sum+=coefficients[i]*history[(at+31-i)%31];at=(at+1)%31;return sum;}
};
class Harmonics {
 bs_harmonics_entry requested_=defaultHarmonicsEntry(1);
 double rate_=48000,smooth_=0,tone_=0,dynamics_=0,mix_=1,output_=1,outputTarget_=1,model_=0;
 double toneLow_=0,toneAlpha_=0,fast_=0,slow_=0,fastAttack_=0,fastRelease_=0,slowAttack_=0,slowRelease_=0;
 double wetDCInput_=0,wetDCOutput_=0,dryDCInput_=0,dryDCOutput_=0,dcPole_=0,previousLinear_=0;
 // Offline-generated normalized31-tap Blackman half-band coefficients.
 // Shared immutable data: constructing an unused rack state performs no DSP
 // preparation, trig calls or per-state coefficient storage.
 inline static constexpr std::array<double,31> coefficients_{{2.9449853528236676e-19,7.8155878394335589e-20,.00041032287080936366,-7.8379050640788443e-19,-.0022302855185240434,2.5338351921943237e-18,.0071008571320414328,-5.6423434323296102e-18,-.017917030421899405,9.9362814605681011e-18,.040107417651266825,-1.4544272985382546e-17,-.090106922079616888,1.8132576385607494e-17,.31263332162053092,.5000046374907835,.31263332162053092,1.8132576385607491e-17,-.090106922079616888,-1.4544272985382555e-17,.040107417651266845,9.9362814605681026e-18,-.017917030421899429,-5.6423434323296141e-18,.0071008571320414372,2.5338351921943237e-18,-.0022302855185240417,-7.8379050640788481e-19,.00041032287080936246,7.8155878394336131e-20,2.9449853528236676e-19}};
 HarmonicsFIR up_,downWet_,downDry_;HarmonicADAA soft_,asymmetric_;
 static double toward(double value,double target,double smoothing){const double next=value+smoothing*(target-value);return std::abs(next-target)<1e-12?target:next;}
 double dc(double input,double&previous,double&output){const double y=(1+dcPole_)*.5*(input-previous)+dcPole_*output;previous=input;output=std::abs(y)<1e-20?0:y;return output;}
public:
 // Linear FIR group delay15 native samples + ADAA quarter sample. DC filter
 // has additional frequency-dependent phase and is shared by dry/wet paths.
 static constexpr double filterLatencySamples=15.25;
 Harmonics()=default; // prepare(rate) before first use; no work for unused nodes
 void prepare(double rate){rate_=rate;smooth_=1-std::exp(-1/(.005*rate));toneAlpha_=1-std::exp(-6.283185307179586*700/rate);dcPole_=std::exp(-6.283185307179586*5/rate);
  fastAttack_=1-std::exp(-1/(.001*rate));fastRelease_=1-std::exp(-1/(.05*rate));slowAttack_=1-std::exp(-1/(.025*rate));slowRelease_=1-std::exp(-1/(.15*rate));
  reset();}
 void configure(const bs_harmonics_entry&entry,bool immediate=false){requested_=entry;outputTarget_=std::pow(10.,entry.output_db/20.);if(immediate){tone_=entry.tone;dynamics_=entry.dynamics;mix_=entry.mix;output_=outputTarget_;model_=entry.model;}}
 void reset(){up_={};downWet_={};downDry_={};soft_.reset(0);asymmetric_.reset(1);toneLow_=fast_=slow_=wetDCInput_=wetDCOutput_=dryDCInput_=dryDCOutput_=previousLinear_=0;configure(requested_,true);}
 double process(double input,double drive,double linkedMagnitude=-1){
  tone_=toward(tone_,requested_.tone,smooth_);dynamics_=toward(dynamics_,requested_.dynamics,smooth_);mix_=toward(mix_,requested_.mix,smooth_);model_=toward(model_,requested_.model,smooth_);output_=toward(output_,outputTarget_,smooth_);
  toneLow_+=toneAlpha_*(input-toneLow_);const double emphasized=tone_>=0?input+tone_*(input-toneLow_):input-tone_*toneLow_;
  const double magnitude=linkedMagnitude>=0?linkedMagnitude:std::abs(input);fast_+=(magnitude>fast_?fastAttack_:fastRelease_)*(magnitude-fast_);slow_+=(magnitude>slow_?slowAttack_:slowRelease_)*(magnitude-slow_);
  const double transient=std::max(0.,std::min(1.,(fast_-slow_)/(slow_+.02)));const double effectiveDrive=1+(std::max(1.,std::min(12.,drive))-1)*(1-.75*dynamics_*transient);
  double wet=0,dry=0;for(unsigned half=0;half<2;++half){const double sample=up_.process(half==0?2*emphasized:0,coefficients_);const double driven=sample*effectiveDrive;const double a=soft_.process(driven,0),b=asymmetric_.process(driven,1);const double linear=.5*(sample+previousLinear_);previousLinear_=sample;
   const double w=downWet_.process(a+model_*(b-a),coefficients_),d=downDry_.process(linear,coefficients_);if(half==0){wet=w;dry=d;}}
  wet=dc(wet,wetDCInput_,wetDCOutput_);dry=dc(dry,dryDCInput_,dryDCOutput_);return (dry+mix_*(wet-dry))*output_;
 }
};
static_assert(sizeof(bs_harmonics_entry)==24&&offsetof(bs_harmonics_entry,tone)==8,"Harmonics entry ABI");
static_assert(sizeof(bs_harmonics_config)==392&&offsetof(bs_harmonics_config,entries)==8,"Harmonics config ABI");
}
#endif
