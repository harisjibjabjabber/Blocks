#ifndef BLOCKS_HARMONICS_SUITE_ENGINE_H
#define BLOCKS_HARMONICS_SUITE_ENGINE_H
#include "blocks_harmonics_suite.h"
#include "suite_ott_curve.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>

namespace blocks_detail {
namespace suite_detail {
constexpr double pi=3.14159265358979323846;
inline double clamp(double x,double a,double b){return std::max(a,std::min(b,x));}
inline double db(double x){return 20*std::log10(std::max(x,1e-12));}
inline double gain(double x){return std::pow(10.,x/20);}
inline double chase(double x,double target,double a){if(x==target)return x;double n=x+a*(target-x);return std::abs(n-target)<1e-12?target:n;}
inline double soft(double x){if(x>=3)return 1;if(x<=-3)return -1;double q=x*x;return x*(27+q)/(27+9*q);}
inline bool range(float x,double lo,double hi){return std::isfinite(x)&&x>=lo&&x<=hi;}
struct Smooth{double v=0,t=0;void set(double x,bool now){t=x;if(now)v=x;}void tick(double a){v=chase(v,t,a);}};
template<unsigned N>struct Delay{std::array<double,N>v{};unsigned at=0;double process(double x){double y=v[at];v[at]=x;at=(at+1)%N;return y;}};
inline constexpr std::array<double,33>fir{{0,-.000074639027065050059,0,.00085393959353168535,0,-.0032289995681372753,0,.0087893603656612751,0,-.020170804917093246,0,.042468063439226239,0,-.091911008034451638,0,.31327408814832808,.5,.31327408814832813,0,-.091911008034451638,0,.042468063439226239,0,-.020170804917093259,0,.0087893603656612751,0,-.0032289995681372796,0,.00085393959353168524,0,-.000074639027065050655,0}};
struct Up{std::array<double,16>v{};unsigned at=15;double process(double x,unsigned phase){if(!phase){at=(at+1)%16;v[at]=x;return v[(at+8)%16];}double y=0;for(unsigned i=1;i<33;i+=2)y+=fir[i]*(2*v[(at+16-i/2)%16]);return y;}};
struct Down{std::array<double,33>v{};unsigned at=0;double process(double x,bool emit){v[at]=x;double y=0;if(emit){y=.5*v[(at+33-16)%33];for(unsigned i=1;i<33;i+=2)y+=fir[i]*v[(at+33-i)%33];}at=(at+1)%33;return y;}};
struct ColourState{double low=0,damp=0,tilt=0,magnet=0;std::array<std::array<double,4>,2>edge{};};
struct Channel{Up up1,up2;Down down1,down2;Delay<24>bypass;std::array<ColourState,2>colour{};double dcIn=0,dcOut=0;};
struct Split{double low=0,upper=0;std::array<double,3>process(double x,double al,double ah){low+=al*(x-low);upper+=ah*(x-upper);return{low,upper-low,x-upper};}};
struct Slot{
 Smooth on,mix,drive,tone,trim,activity,low,high,damp,edgeDepth;std::array<Smooth,5>style;double edgeAlpha=0;
 double sag=0;
 void configure(bool enabled,unsigned model,double d,double t,double m,double output,double rate,bool now){
  on.set(enabled,now);mix.set(m,now);drive.set(gain(d),now);tone.set(t,now);trim.set(gain(output),now);
  activity.set(clamp(std::max(d/6.,std::abs(t)),0.,1.),now);low.set(gain(-t*9),now);high.set(gain(t*9),now);
  damp.set(1-std::exp(-2*pi*(10000*std::pow(1.6,t))/(4*rate)),now);edgeDepth.set(clamp((d-18)/18,0.,1.),now);edgeAlpha=1-std::exp(-2*pi*12000/(4*rate));
  for(unsigned i=0;i<5;++i)style[i].set(i==model,now);
 }
 void tick(double a){for(auto*p:{&on,&mix,&drive,&tone,&trim,&activity,&low,&high,&damp,&edgeDepth})p->tick(a);for(auto&v:style)v.tick(a);}
};
}

class HarmonicsSuite {
public:
 struct Stereo{double left,right;};
 static constexpr unsigned latency=24;
 static bs_harmonics_suite_config defaults(){
  bs_harmonics_suite_config c{};c.version=2;c.colour_enabled=1;c.mix=c.colour_mix=c.colour2_mix=1;
  c.comp_threshold_db=-30;c.comp_ratio=4;c.comp_attack_ms=3;c.comp_release_ms=150;c.comp_knee_db=6;c.comp_auto_makeup=1;
  c.crush_recovery=.15f;c.ott_amount=.5f;c.ott_time=c.ott_up=c.ott_down=1;c.ott_low_hz=88.3f;c.ott_high_hz=2500;
  for(unsigned i=0;i<3;++i)c.bands[i]={float(suite_detail::OttCurve::upper[i]),0,1,1};return c;
 }
 static bool valid(const bs_harmonics_suite_config&c){
  using suite_detail::range;
  if(c.version!=2||c.reserved||c.enabled>1||c.comp_enabled>1||c.colour_enabled>1||c.colour2_enabled>1||c.colour_style>4||c.colour2_style>4||c.crush_enabled>1||c.ott_enabled>1||c.comp_auto_makeup>1)return false;
  const float v[]={c.drive_db,c.tone,c.dynamics,c.mix,c.output_db,c.comp_threshold_db,c.comp_ratio,c.comp_attack_ms,c.comp_release_ms,c.comp_knee_db,c.comp_makeup_db,c.crush_amount,c.crush_recovery,c.crush_crunch_db,c.ott_amount,c.ott_time,c.ott_up,c.ott_down,c.colour_mix,c.colour2_drive_db,c.colour2_tone,c.colour2_mix,c.ott_low_hz,c.ott_high_hz,c.colour_output_db,c.colour2_output_db,c.crush_output_db,c.ott_output_db};
  constexpr double lo[]={0,-1,-1,0,-24,-60,1,.1,10,0,-24,0,.05,0,0,.25,0,0,0,0,-1,0,60,1000,-24,-24,-24,-24};
  constexpr double hi[]={36,1,1,1,12,0,20,100,2000,24,24,1,4,36,1,4,1,1,1,36,1,1,1000,10000,12,12,12,12};
  for(unsigned i=0;i<28;++i)if(!range(v[i],lo[i],hi[i]))return false;
  if(c.ott_high_hz<2*c.ott_low_hz)return false;
  for(const auto&b:c.bands)if(!range(b.threshold_db,-60,0)||!range(b.gain_db,-24,24)||!range(b.up,0,1)||!range(b.down,0,1))return false;
  return true;
 }
 const bs_harmonics_suite_config&config()const{return requested_;}
 const bs_harmonics_suite_meters&meters()const{return meters_;}
 void prepare(double rate){
  rate_=suite_detail::clamp(rate,8000,384000);smooth_=coeff(.005);peakDecay_=std::exp(-1/(.15*rate_));
  toneAlpha_=1-std::exp(-2*suite_detail::pi*700/(4*rate_));magnetAlpha_=1-std::exp(-2*suite_detail::pi*25/(4*rate_));dcPole_=std::exp(-2*suite_detail::pi*5/(4*rate_));
  sagAttack_=coeff(.02);sagRelease_=coeff(.18);crushAttack_=1-std::exp(-1/(.0013*4*rate_));loadAlpha_=1-std::exp(-1/(.25*4*rate_));
  dynamicFastAttack_=coeff(.0015);dynamicFastRelease_=coeff(.015);dynamicSlow_=coeff(.15);dynamicBase_=coeff(.015);dynamicLowAlpha_=1-std::exp(-2*suite_detail::pi*100/rate_);dynamicPeakDecay_=std::exp(-1/(.3*rate_));dynamicInputDecay_=std::exp(-1/(.03*rate_));onsetDecay_=std::exp(-1/(.015*rate_));dynamicGainAttack_=coeff(.001);dynamicGainRelease_=coeff(.015);
  reset();
 }
 bool configure(const bs_harmonics_suite_config&c,bool now=false){
  if(!valid(c))return false;requested_=c;using namespace suite_detail;
  enabled_.set(c.enabled,now);mix_.set(c.mix,now);output_.set(gain(c.output_db),now);dynamics_.set(c.dynamics,now);
  compOn_.set(c.comp_enabled,now);crushOn_.set(c.crush_enabled,now);ottOn_.set(c.ott_enabled,now);
  compMakeup_.set(gain(c.comp_makeup_db+(c.comp_auto_makeup?std::min(18.,-c.comp_threshold_db*(1-1/double(c.comp_ratio))*.5):0)),now);
  compAttack_=coeff(c.comp_attack_ms*.001);compRelease_=coeff(c.comp_release_ms*.001);compPeakDecay_=std::exp(-1/(.02*rate_));
  slots_[0].configure(c.colour_enabled,c.colour_style,c.drive_db,c.tone,c.colour_mix,c.colour_output_db,rate_,now);
  slots_[1].configure(c.colour2_enabled,c.colour2_style,c.colour2_drive_db,c.colour2_tone,c.colour2_mix,c.colour2_output_db,rate_,now);
  crushAmount_.set(c.crush_amount,now);crunch_.set(gain(c.crush_crunch_db),now);crushTrim_.set(gain(c.crush_output_db),now);
  crushActivity_.set(clamp(std::max(double(c.crush_amount),c.crush_crunch_db/6.),0.,1.),now);
  crushRecovery_=1-std::exp(-1/(c.crush_recovery*4*rate_));
  bool active=(c.colour_enabled&&c.colour_mix>0&&(c.drive_db>0||c.tone!=0))||(c.colour2_enabled&&c.colour2_mix>0&&(c.colour2_drive_db>0||c.colour2_tone!=0))||(c.crush_enabled&&(c.crush_amount>0||c.crush_crunch_db>0));
  filterOn_.set(active,now);
  ottAmount_.set(c.ott_amount,now);ottUp_.set(c.ott_up,now);ottDown_.set(c.ott_down,now);ottTrim_.set(gain(c.ott_output_db),now);
  splitLow_.set(1-std::exp(-2*pi*std::min(double(c.ott_low_hz),rate_*.2)/rate_),now);
  splitHigh_.set(1-std::exp(-2*pi*std::min(double(c.ott_high_hz),rate_*.45)/rate_),now);
  for(unsigned i=0;i<3;++i){bandRelease_[i]=coeff(OttCurve::release(i,c.ott_time));bandAttack_[i]=coeff(OttCurve::attack[i]);bandThreshold_[i].set(c.bands[i].threshold_db,now);bandTrim_[i].set(c.bands[i].gain_db,now);bandUp_[i].set(c.bands[i].up,now);bandDown_[i].set(c.bands[i].down,now);}
  ottGainRelease_=coeff(.006*c.ott_time);return true;
 }
 void reset(){
  left_={};right_={};dryL_={};dryR_={};dynamicDelay_={};dynamicLowL_=dynamicLowR_=dynamicBaseValue_=0;splitL_={};splitR_={};compEnv_=compDb_=compTarget_=crushDb_=crushLoad_=0;
  dynamicFast_=dynamicSlowValue_=dynamicPeak_=dynamicDb_=onsetHold_=0;bandEnv_={};bandDb_={};bandTarget_={};counter_=0;wetDormant_=filterDormant_=false;
  for(auto&s:slots_)s.sag=0;meters_={};for(auto&v:meters_.ott_input_db)v=-120;configure(requested_,true);
 }
 Stereo process(double originalL,double originalR,double inputL,double inputR){
  using namespace suite_detail;
  if(!std::isfinite(originalL))originalL=0;if(!std::isfinite(originalR))originalR=0;if(!std::isfinite(inputL))inputL=0;if(!std::isfinite(inputR))inputR=0;
  const double dryL=dryL_.process(originalL),dryR=dryR_.process(originalR);tick();
  const double magnitude=std::max(std::abs(inputL),std::abs(inputR));
  meters_.input_peak=float(std::max(magnitude,double(meters_.input_peak)*peakDecay_));
  if(enabled_.v==0){
   if(!wetDormant_){clearWet();wetDormant_=true;}
   meters_.comp_reduction_db=meters_.crush_reduction_db=meters_.dynamics_gain_db=0;for(unsigned i=0;i<3;++i){meters_.ott_input_db[i]=-120;meters_.ott_gain_db[i]=0;}
   return finish(dryL,dryR);
  }
  wetDormant_=false;
  const double dynamicGain=dynamicDelay_.process(audioDynamics(magnitude));
  double m=std::max(std::abs(inputL),std::abs(inputR));compEnv_=std::max(m,compEnv_*compPeakDecay_);
  if(compOn_.v>0){
   if(counter_%8==0){double over=db(compEnv_)-requested_.comp_threshold_db,k=requested_.comp_knee_db,factor=1/requested_.comp_ratio-1;
    compTarget_=k>0&&over>-k*.5&&over<k*.5?factor*(over+k*.5)*(over+k*.5)/(2*k):over>=k*.5?factor*over:0;}
   compDb_=chase(compDb_,compTarget_,compTarget_<compDb_?compAttack_:compRelease_);
   double g=1+compOn_.v*(gain(compDb_)*compMakeup_.v-1);inputL*=g;inputR*=g;
  }
  meters_.comp_reduction_db=float(-compDb_*compOn_.v);
  Stereo wet=oversample(inputL,inputR);
  dynamicLowL_+=dynamicLowAlpha_*(wet.left-dynamicLowL_);dynamicLowR_+=dynamicLowAlpha_*(wet.right-dynamicLowR_);
  if(dynamicGain!=1){double foundation=std::sqrt(std::sqrt(std::max(0.,dynamicGain)));wet.left=foundation*dynamicLowL_+dynamicGain*(wet.left-dynamicLowL_);wet.right=foundation*dynamicLowR_+dynamicGain*(wet.right-dynamicLowR_);}
  wet=multiband(wet);
  ++counter_;double amount=enabled_.v*mix_.v,trim=1+enabled_.v*(output_.v-1);
  return finish((dryL+amount*(wet.left-dryL))*trim,(dryR+amount*(wet.right-dryR))*trim);
 }
 static bool previewColour(const bs_harmonics_suite_config&c,float frequency,float rate,float*out,unsigned count){
  if(!valid(c)||!out||!std::isfinite(frequency)||frequency<50||frequency>2000||!std::isfinite(rate)||rate<8000||rate>192000||count<32||count>1024)return false;
  HarmonicsSuite h;h.prepare(rate);auto p=c;p.enabled=1;p.comp_enabled=p.crush_enabled=p.ott_enabled=0;p.dynamics=0;p.mix=1;p.output_db=0;h.configure(p,true);
  const double period=rate/frequency;const unsigned warm=unsigned(std::ceil(4*period));unsigned at=0;double previous=0;
  for(unsigned i=0;i<=warm+unsigned(std::ceil(period));++i){double x=.25*std::sin(2*suite_detail::pi*(double(i)-warm+latency)/period),y=h.process(x,x,x,x).left;
   while(at<count&&double(i)>=warm+period*at/count){double position=warm+period*at/count,t=position-(double(i)-1);out[at++]=float(previous+(y-previous)*t);}previous=y;}return at==count;
 }
 static bool previewDynamics(const bs_harmonics_suite_config&c,float rate,float*dry,float*wet,unsigned count){
  if(!valid(c)||!dry||!wet||!std::isfinite(rate)||rate<8000||rate>192000||count<64||count>256)return false;
  HarmonicsSuite h;h.prepare(rate);auto p=c;p.enabled=1;p.comp_enabled=p.colour_enabled=p.colour2_enabled=p.crush_enabled=p.ott_enabled=0;p.mix=1;p.output_db=0;h.configure(p,true);
  const unsigned n=unsigned(rate*.6);suite_detail::Delay<24>d;
  double ds=0,ws=0;unsigned samples=0,bin=0;
  for(unsigned i=0;i<n;++i){double t=i/rate,x=.25*(1-std::exp(-t/.002))*std::exp(-t/.12)*std::sin(2*suite_detail::pi*130.81278265*t);
   double dx=d.process(x),wx=h.process(x,x,x,x).left;ds+=dx*dx;ws+=wx*wx;++samples;
   if((uint64_t(i+1)*count)/n>bin){dry[bin]=float(std::sqrt(ds/samples));wet[bin]=float(std::sqrt(ws/samples));++bin;ds=ws=0;samples=0;}}
  return bin==count;
 }
private:
 bs_harmonics_suite_config requested_=defaults();bs_harmonics_suite_meters meters_{};
 double rate_=48000,smooth_=0,peakDecay_=0,toneAlpha_=0,magnetAlpha_=0,dcPole_=0,sagAttack_=0,sagRelease_=0,crushAttack_=0,loadAlpha_=0;
 suite_detail::Smooth enabled_,mix_,output_,dynamics_,compOn_,compMakeup_,crushOn_,crushAmount_,crunch_,crushTrim_,crushActivity_,filterOn_,ottOn_,ottAmount_,ottUp_,ottDown_,ottTrim_,splitLow_,splitHigh_;
 std::array<suite_detail::Slot,2>slots_;
 std::array<suite_detail::Smooth,3>bandThreshold_,bandTrim_,bandUp_,bandDown_;
 double compEnv_=0,compDb_=0,compTarget_=0,compAttack_=0,compRelease_=0,compPeakDecay_=0,crushDb_=0,crushLoad_=0,crushRecovery_=0;
 double onsetHold_=0,onsetDecay_=0,dynamicInputDecay_=0,dynamicLowL_=0,dynamicLowR_=0,dynamicLowAlpha_=0,dynamicBase_=0,dynamicBaseValue_=0,dynamicFast_=0,dynamicSlowValue_=0,dynamicPeak_=0,dynamicDb_=0,dynamicFastAttack_=0,dynamicFastRelease_=0,dynamicSlow_=0,dynamicPeakDecay_=0,dynamicGainAttack_=0,dynamicGainRelease_=0;
 std::array<double,3>bandEnv_{},bandDb_{},bandTarget_{},bandRelease_{},bandAttack_{};double ottGainRelease_=0;
 unsigned counter_=0;bool wetDormant_=false,filterDormant_=false;
 suite_detail::Channel left_,right_;suite_detail::Delay<24>dryL_,dryR_,dynamicDelay_;suite_detail::Split splitL_,splitR_;
 double coeff(double seconds)const{return 1-std::exp(-1/(seconds*rate_));}
 void tick(){
  for(auto*p:{&enabled_,&mix_,&output_,&dynamics_,&compOn_,&compMakeup_,&crushOn_,&crushAmount_,&crunch_,&crushTrim_,&crushActivity_,&filterOn_,&ottOn_,&ottAmount_,&ottUp_,&ottDown_,&ottTrim_,&splitLow_,&splitHigh_})p->tick(smooth_);
  for(auto&s:slots_)s.tick(smooth_);for(unsigned i=0;i<3;++i){bandThreshold_[i].tick(smooth_);bandTrim_[i].tick(smooth_);bandUp_[i].tick(smooth_);bandDown_[i].tick(smooth_);}
 }
 void clearWet(){dynamicDelay_={};dynamicLowL_=dynamicLowR_=dynamicBaseValue_=onsetHold_=0;left_={};right_={};splitL_={};splitR_={};compEnv_=compDb_=compTarget_=crushDb_=crushLoad_=0;dynamicFast_=dynamicSlowValue_=dynamicPeak_=dynamicDb_=0;bandEnv_={};bandDb_={};bandTarget_={};for(auto&s:slots_)s.sag=0;}
 Stereo finish(double l,double r){meters_.output_peak=float(std::max({std::abs(l),std::abs(r),double(meters_.output_peak)*peakDecay_}));return{l,r};}
 // Original level-independent follower-ratio shaper. Published detector principles:
 // Gin/MGA (fast/base/slow ratios), Airwindows Point, and SPL differential envelopes.
 // Gain follows the24-sample audio delay and is applied after saturation.
 // The complementary100Hz low foundation receives one quarter of the gain dB.
 double audioDynamics(double magnitude){
  using namespace suite_detail;
  dynamicPeak_=std::max(magnitude,dynamicPeak_*dynamicInputDecay_);
  dynamicFast_+=dynamicFastAttack_*(dynamicPeak_-dynamicFast_);
  dynamicBaseValue_+=dynamicBase_*(dynamicPeak_-dynamicBaseValue_);
  dynamicSlowValue_=std::max(dynamicFast_,dynamicSlowValue_*dynamicPeakDecay_);
  if(dynamics_.v==0){dynamicDb_=onsetHold_=0;meters_.dynamics_gain_db=0;return 1;}
  const double base=std::max(dynamicBaseValue_,1e-10),fast=std::max(dynamicFast_,1e-10),slow=std::max(dynamicSlowValue_,1e-10);
  double attack=std::max(0.,db(fast/base)),tail=std::max(0.,db(slow/base)),guard=clamp((db(base)+100)/35,0.,1.);
  onsetHold_=std::max(clamp(attack/6,0.,1.),onsetHold_*onsetDecay_);double body=1-onsetHold_;
  double target=dynamics_.v<0?(-dynamics_.v)*(std::min(18.,2*attack+12*onsetHold_)-body*std::min(48.,3*tail)):dynamics_.v*(std::min(3.,.25*attack)+body*std::min(24.,4*tail))*guard;
  target=clamp(target,-48.,24.);dynamicDb_=chase(dynamicDb_,target,target<dynamicDb_?dynamicGainAttack_:dynamicGainRelease_);
  meters_.dynamics_gain_db=float(dynamicDb_);return gain(dynamicDb_);
 }
 double colourSample(suite_detail::ColourState&c,suite_detail::Slot&s,double x){
  using namespace suite_detail;double y=0;
  if(s.style[0].v>0){
   const double root=std::sqrt(s.drive.v),supply=1/(1+.5*s.sag*root*(s.drive.v-1)/(s.drive.v+1));
   double a=soft(x*root+.12)-soft(.12);c.low+=toneAlpha_*(a-c.low);a=c.low*s.low.v+(a-c.low)*s.high.v;
   a=soft(a*root*supply-.18)-soft(-.18);c.damp+=s.damp.v*(a-c.damp);y+=s.style[0].v*c.damp;
  }
  if(s.style[1].v>0||s.style[2].v>0||s.style[3].v>0||s.style[4].v>0){
   c.tilt+=toneAlpha_*(x-c.tilt);double a=(c.tilt*s.low.v+(x-c.tilt)*s.high.v)*s.drive.v;
   if(s.style[1].v>0)y+=s.style[1].v*clamp(a,-.5,.5);
   if(s.style[2].v>0){double raw=.5*std::sin(pi*a),filtered=raw;for(auto&z:c.edge[0]){z+=s.edgeAlpha*(filtered-z);filtered=z;}y+=s.style[2].v*(raw+s.edgeDepth.v*(filtered-raw));}
   if(s.style[3].v>0){c.magnet+=magnetAlpha_*(soft(a)-c.magnet);double tape=.4*std::atan(3*(a-.8*c.magnet));double bandwidth=s.damp.v/(1+.08*std::sqrt(s.drive.v));c.damp+=bandwidth*(tape-c.damp);y+=s.style[3].v*c.damp;}
   if(s.style[4].v>0){double rounded=soft(a),raw=1.5*(std::sqrt(rounded*rounded+.0625)-.25),filtered=raw;for(auto&z:c.edge[1]){z+=s.edgeAlpha*(filtered-z);filtered=z;}y+=s.style[4].v*(raw+s.edgeDepth.v*(filtered-raw));}
  }
  return y;
 }
 Stereo oversample(double l,double r){
  using namespace suite_detail;
  double byL=left_.bypass.process(l),byR=right_.bypass.process(r),outL=0,outR=0;
  const double linearTrim=(1+slots_[0].on.v*(slots_[0].trim.v-1))*(1+slots_[1].on.v*(slots_[1].trim.v-1))*(1+crushOn_.v*(crushTrim_.v-1));
  if(filterOn_.v==0){
   if(!filterDormant_){auto bl=left_.bypass,br=right_.bypass;left_={};right_={};left_.bypass=bl;right_.bypass=br;filterDormant_=true;}
   meters_.crush_reduction_db=0;return{byL*linearTrim,byR*linearTrim};
  }
  filterDormant_=false;const double crushDepth=crushOn_.v*crushActivity_.v,pressure=crushDepth>0?gain(30*crushAmount_.v):1;
  for(auto&s:slots_){double m=std::max(std::abs(l),std::abs(r));s.sag+=(m>s.sag?sagAttack_:sagRelease_)*(m-s.sag);}
  for(unsigned a=0;a<2;++a){
   double uL=left_.up1.process(l,a),uR=right_.up1.process(r,a),dL=0,dR=0;
   for(unsigned b=0;b<2;++b){
    double xL=left_.up2.process(uL,b),xR=right_.up2.process(uR,b);
    for(unsigned j=0;j<2;++j){auto&s=slots_[j];double depth=s.on.v*s.mix.v*s.activity.v;
     if(depth>0){double cL=colourSample(left_.colour[j],s,xL),cR=colourSample(right_.colour[j],s,xR);xL+=depth*(cL-xL);xR+=depth*(cR-xR);}
     double trim=1+s.on.v*(s.trim.v-1);xL*=trim;xR*=trim;
    }
    if(crushDepth>0){
     double pL=xL*pressure,pR=xR*pressure,m=std::max(std::abs(pL),std::abs(pR));
     double target=std::min(0.,db(.5)-db(m));crushLoad_+=loadAlpha_*(clamp(-crushDb_/24,0.,1.)-crushLoad_);
     crushDb_=chase(crushDb_,target,target<crushDb_?crushAttack_:crushRecovery_/(1+5*crushLoad_));
     double attenuation=gain(crushDb_);xL+=crushDepth*(clamp(pL*attenuation*crunch_.v,-1.,1.)-xL);xR+=crushDepth*(clamp(pR*attenuation*crunch_.v,-1.,1.)-xR);
    }
    double trim=1+crushOn_.v*(crushTrim_.v-1);xL*=trim;xR*=trim;
    double dcL=xL-left_.dcIn+dcPole_*left_.dcOut,dcR=xR-right_.dcIn+dcPole_*right_.dcOut;left_.dcIn=xL;right_.dcIn=xR;left_.dcOut=std::abs(dcL)<1e-20?0:dcL;right_.dcOut=std::abs(dcR)<1e-20?0:dcR;
    double vl=left_.down2.process(left_.dcOut,b==0),vr=right_.down2.process(right_.dcOut,b==0);if(!b){dL=vl;dR=vr;}
   }
   double vl=left_.down1.process(dL,a==0),vr=right_.down1.process(dR,a==0);if(!a){outL=vl;outR=vr;}
  }
  meters_.crush_reduction_db=float(-crushDb_*crushDepth);
  return{byL*linearTrim+filterOn_.v*(outL-byL*linearTrim),byR*linearTrim+filterOn_.v*(outR-byR*linearTrim)};
 }
 Stereo multiband(Stereo in){
  using namespace suite_detail;auto l=splitL_.process(in.left,splitLow_.v,splitHigh_.v),r=splitR_.process(in.right,splitLow_.v,splitHigh_.v);
  double depth=ottAmount_.v,outL=in.left,outR=in.right;
  for(unsigned i=0;i<3;++i){
   double level=.5*(l[i]*l[i]+r[i]*r[i]);bandEnv_[i]+=(level>bandEnv_[i]?bandAttack_[i]:bandRelease_[i])*(level-bandEnv_[i]);
   if(bandEnv_[i]<1e-30)bandEnv_[i]=0;
   if(ottOn_.v>0||counter_%8==0){double levelDb=10*std::log10(std::max(bandEnv_[i],1e-20));meters_.ott_input_db[i]=float(std::max(-120.,levelDb));
    bandTarget_[i]=OttCurve::gainDb(i,levelDb,depth,ottUp_.v*bandUp_[i].v,ottDown_.v*bandDown_[i].v,bandThreshold_[i].v);
   }
   bandDb_[i]=chase(bandDb_[i],bandTarget_[i],smooth_);
   double applied=(bandDb_[i]+bandTrim_[i].v)*ottOn_.v,g=applied==0?1:gain(applied);
   outL+=(g-1)*l[i];outR+=(g-1)*r[i];meters_.ott_gain_db[i]=float(applied);
  }
  double trim=1+ottOn_.v*(ottTrim_.v-1);return{outL*trim,outR*trim};
 }
};
static_assert(sizeof(bs_harmonics_suite_config)==204,"Suite config ABI");
static_assert(sizeof(bs_harmonics_suite_meters)==44,"Suite meter ABI");
}
#endif

