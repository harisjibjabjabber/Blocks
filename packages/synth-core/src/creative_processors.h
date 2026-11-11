#ifndef BLOCKS_CREATIVE_PROCESSORS_H
#define BLOCKS_CREATIVE_PROCESSORS_H
#include "blocks_creative_fx.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <memory>
#include <new>
namespace blocks_detail {
namespace creative_detail {
constexpr double pi=3.14159265358979323846;
inline double clamp(double x,double lo,double hi){return std::max(lo,std::min(hi,x));}
inline double follow(double x,double target,double a){x+=(target-x)*a;return std::abs(x-target)<1e-12?target:x;}
inline double gain(double db){return std::pow(10.,db/20);}
inline double db(double x){return 20*std::log10(std::max(1e-12,x));}
inline bool valid(const bs_creative_fx_block&c){if(!c.id||c.type>1||c.enabled>1)return false;const float v[]={c.mix,c.motion,c.space,c.shimmer,c.tight,c.click,c.body};for(float x:v)if(!std::isfinite(x)||x<0||x>1)return false;return std::isfinite(c.pitch)&&c.pitch>=-12&&c.pitch<=12&&std::isfinite(c.output_db)&&c.output_db>=-24&&c.output_db<=12;}
inline bs_creative_fx_block defaults(unsigned type){return{1,type,1,type==0?.35f:.7f,.45f,.35f,.45f,12,.6f,.35f,.5f,0};}
struct Line{
 std::unique_ptr<float[]> data;unsigned capacity=0,at=0,history=0;
 bool prepare(unsigned n){std::unique_ptr<float[]>p(new(std::nothrow)float[n]{});if(!p)return false;data=std::move(p);capacity=n;clear();return true;}
 void clear(){at=history=0;}
 double integer(unsigned n)const{return n&&n<=history?data[(at+capacity-n)%capacity]:0;}
 double read(double n)const{n=clamp(n,1,double(capacity-2));unsigned k=unsigned(n);return integer(k)+(n-k)*(integer(k+1)-integer(k));}
 void write(double x){data[at]=float(x);if(++at==capacity)at=0;if(history<capacity-1)++history;}
};
}

// Compact global insert: four moving tank delays, two input diffusers, and two
// real dual-head pitch shifters. About72KB per48k instance; no per-voice copies.
// All buffers are allocated only by prepare; configure and clear are bounded.
class MovingSpace {
 std::array<creative_detail::Line,8> line_;
 bs_creative_fx_block config_=creative_detail::defaults(0);
 double rate_=48000,smooth_=0,mix_=0,on_=1,motion_=0,space_=0,shimmer_=0,pitch_=2,pitchTarget_=2,trim_=1,trimTarget_=1;
 double envelope_=0,envAttack_=0,envRelease_=0,offset_=0,phase_=0,neutral_=0,lpAlpha_=0;
 std::array<double,4>damp_{};
 std::array<double,4>feedback_{},feedbackTarget_{};
 std::array<std::array<double,2>,2>inputFilter_{};
 std::array<double,63>taps_{};std::array<std::array<double,63>,2>history_{};unsigned firAt_=0;
 bool prepared_=false,shifting_=false;
 static double seconds(unsigned i){constexpr double t[]={.0097,.0131,.0193,.0239};return t[i];}
 std::array<double,2> shift(double l,double r){using namespace creative_detail;std::array<double,2>out{};const double window=.09*rate_,p2=phase_<.5?phase_+.5:phase_-.5,w=.5-.5*std::cos(2*pi*phase_);const double input[]={l,r};neutral_=follow(neutral_,std::abs(config_.pitch)<1e-5?1:0,smooth_);
  for(unsigned ch=0;ch<2;++ch){history_[ch][firAt_]=input[ch];double filtered=0;for(unsigned k=0;k<31;++k)filtered+=taps_[k]*(history_[ch][(firAt_+63-k)%63]+history_[ch][(firAt_+1+k)%63]);filtered+=taps_[31]*history_[ch][(firAt_+32)%63];auto&b=line_[6+ch];b.write(filtered);double y=w*b.read(2+phase_*window)+(1-w)*b.read(2+p2*window);out[ch]=y+neutral_*(filtered-y);}
  if(++firAt_==63)firAt_=0;phase_+=(1-pitch_)/window;phase_-=std::floor(phase_);return out;
 }
public:
 bool prepare(double rate){using namespace creative_detail;if(!std::isfinite(rate)||rate<8000||rate>384000)return false;std::array<Line,8>candidate;for(unsigned i=0;i<8;++i)if(!candidate[i].prepare(unsigned(std::ceil(rate*(i<4?.041:i<6?.01:.092)))+8))return false;line_=std::move(candidate);rate_=rate;smooth_=1-std::exp(-1/(.02*rate));envAttack_=1-std::exp(-1/(.0012*rate));envRelease_=1-std::exp(-1/(.12*rate));lpAlpha_=1-std::exp(-2*pi*std::min(7000.,.18*rate)/rate);double total=0;for(unsigned k=0;k<63;++k){double x=double(k)-31;taps_[k]=(x==0?.4:std::sin(.4*pi*x)/(pi*x))*(.42-.5*std::cos(2*pi*k/62)+.08*std::cos(4*pi*k/62));total+=taps_[k];}for(auto&t:taps_)t/=total;prepared_=true;clear();return true;}
 bool configure(const bs_creative_fx_block&c,bool now=false){if(!creative_detail::valid(c)||c.type!=0)return false;config_=c;pitchTarget_=std::pow(2.,c.pitch/12.);trimTarget_=creative_detail::gain(c.output_db);for(unsigned i=0;i<4;++i)feedbackTarget_[i]=std::pow(10.,-3*seconds(i)*(.55+.95*c.space)/(.08+.72*c.space*c.space));if(now){on_=c.enabled;mix_=c.enabled?c.mix:0;motion_=c.motion;space_=c.space;shimmer_=c.shimmer;pitch_=pitchTarget_;trim_=trimTarget_;neutral_=std::abs(c.pitch)<1e-5?1:0;feedback_=feedbackTarget_;}return true;}
 const bs_creative_fx_block&config()const{return config_;}
 void clear(){for(auto&b:line_)b.clear();damp_.fill(0);for(auto&v:inputFilter_)v.fill(0);for(auto&v:history_)v.fill(0);envelope_=offset_=phase_=0;firAt_=0;shifting_=false;configure(config_,true);}
 void process(double&l,double&r){using namespace creative_detail;if(!prepared_)return;if(!std::isfinite(l)||!std::isfinite(r)){l=r=0;clear();return;}if(!config_.enabled&&mix_==0&&line_[0].history==0)return;
  on_=follow(on_,config_.enabled,smooth_);mix_=follow(mix_,config_.enabled?config_.mix:0,smooth_);motion_=follow(motion_,config_.motion,smooth_);space_=follow(space_,config_.space,smooth_);shimmer_=follow(shimmer_,config_.shimmer,smooth_);pitch_=follow(pitch_,pitchTarget_,smooth_);trim_=follow(trim_,trimTarget_,smooth_);
  const double input[]={l*on_,r*on_};double peak=std::max(std::abs(input[0]),std::abs(input[1]));envelope_=follow(envelope_,peak,peak>envelope_?envAttack_:envRelease_);double desired=.004*rate_*motion_*envelope_/(.03+envelope_);offset_+=clamp(desired-offset_,-.45,.45);
  std::array<double,2>in{};for(unsigned ch=0;ch<2;++ch){double x=input[ch];for(auto&f:inputFilter_[ch]){f+=lpAlpha_*(x-f);x=f;}double d=line_[4+ch].read((ch?.0061:.0037)*rate_);in[ch]=d-.6*x;line_[4+ch].write(x+.6*in[ch]);}
  std::array<double,4>v{},h{};constexpr double bends[]={1.,-.87,.65,-.91};for(unsigned i=0;i<4;++i){double d=seconds(i)*(.55+.95*space_)*rate_+offset_*bends[i];double x=line_[i].read(d);damp_[i]+=lpAlpha_*(x-damp_[i]);v[i]=std::abs(damp_[i])<1e-20?0:damp_[i];}
  h[0]=.5*(v[0]+v[1]+v[2]+v[3]);h[1]=.5*(v[0]-v[1]+v[2]-v[3]);h[2]=.5*(v[0]+v[1]-v[2]-v[3]);h[3]=.5*(v[0]-v[1]-v[2]+v[3]);
  constexpr double a[]={.5,-.5,.5,-.5},b[]={.5,.5,-.5,-.5};double axisL=0,axisR=0;for(unsigned i=0;i<4;++i){axisL+=a[i]*h[i];axisR+=b[i]*h[i];}std::array<double,2>shifted{};
  if(shimmer_!=0){shifted=shift(axisL,axisR);shifting_=true;}else if(shifting_){line_[6].clear();line_[7].clear();for(auto&v:history_)v.fill(0);firAt_=0;phase_=0;shifting_=false;}
  for(unsigned i=0;i<4;++i){feedback_[i]=follow(feedback_[i],feedbackTarget_[i],smooth_);double bent=h[i]+shimmer_*(a[i]*(.35*shifted[0]-.5*axisL)+b[i]*(.35*shifted[1]-.5*axisR));line_[i].write(clamp(feedback_[i]*bent+a[i]*in[0]+b[i]*in[1],-16,16));}
  double wetL=h[0]+.15*in[0],wetR=h[3]+.15*in[1];const double shiftedMix=.65*shimmer_;wetL=(wetL+shiftedMix*(shifted[0]-wetL))*trim_;wetR=(wetR+shiftedMix*(shifted[1]-wetR))*trim_;
  if(mix_!=0){l=(1-mix_)*l+mix_*wetL;r=(1-mix_)*r+mix_*wetR;}
 }
};

// Audio-only percussion insert. Relative fast/base/peak envelopes separate onset
// from decaying body; no note trigger, generated kick, or voice-envelope rewrite.
// Hard-knee stereo-linked compression contains body; the onset accent is applied
// to the upper band, while Body independently balances the low foundation.
class Impact {
 bs_creative_fx_block config_=creative_detail::defaults(1);
 double rate_=48000,smooth_=0,mix_=0,tight_=0,click_=0,body_=.5,trim_=1,trimTarget_=1;
 double peak_=0,fast_=0,base_=0,slow_=0,onset_=0,shapeDb_=0,compDb_=0,lowL_=0,lowR_=0;
 double peakDecay_=0,fastA_=0,baseA_=0,slowDecay_=0,onsetDecay_=0,shapeUp_=0,shapeDown_=0,compAttack_=0,compRelease_=0,lowA_=0;
 bool prepared_=false;
public:
 bool prepare(double rate){using namespace creative_detail;if(!std::isfinite(rate)||rate<8000||rate>384000)return false;rate_=rate;smooth_=1-std::exp(-1/(.02*rate));peakDecay_=std::exp(-1/(.02*rate));fastA_=1-std::exp(-1/(.0008*rate));baseA_=1-std::exp(-1/(.012*rate));slowDecay_=std::exp(-1/(.22*rate));onsetDecay_=std::exp(-1/(.012*rate));shapeUp_=1-std::exp(-1/(.00035*rate));shapeDown_=1-std::exp(-1/(.002*rate));compAttack_=1-std::exp(-1/(.004*rate));compRelease_=1-std::exp(-1/(.06*rate));lowA_=1-std::exp(-2*pi*160/rate);prepared_=true;clear();return true;}
 bool configure(const bs_creative_fx_block&c,bool now=false){if(!creative_detail::valid(c)||c.type!=1)return false;config_=c;trimTarget_=creative_detail::gain(c.output_db);if(now){mix_=c.enabled?c.mix:0;tight_=c.tight;click_=c.click;body_=c.body;trim_=trimTarget_;}return true;}
 const bs_creative_fx_block&config()const{return config_;}
 void clear(){peak_=fast_=base_=slow_=onset_=shapeDb_=compDb_=lowL_=lowR_=0;configure(config_,true);}
 void process(double&l,double&r){using namespace creative_detail;if(!prepared_)return;if(!std::isfinite(l)||!std::isfinite(r)){l=r=0;clear();return;}mix_=follow(mix_,config_.enabled?config_.mix:0,smooth_);tight_=follow(tight_,config_.tight,smooth_);click_=follow(click_,config_.click,smooth_);body_=follow(body_,config_.body,smooth_);trim_=follow(trim_,trimTarget_,smooth_);
  const double magnitude=std::max(std::abs(l),std::abs(r));peak_=std::max(magnitude,peak_*peakDecay_);fast_+=fastA_*(peak_-fast_);base_+=baseA_*(peak_-base_);slow_=std::max(fast_,slow_*slowDecay_);double attack=std::max(0.,db(std::max(fast_,1e-10)/std::max(base_,1e-10))),tail=std::max(0.,db(std::max(slow_,1e-10)/std::max(base_,1e-10)));onset_=std::max(clamp(attack/6,0.,1.),onset_*onsetDecay_);
  double gate=clamp((db(base_)+100)/35,0.,1.);double target=-tight_*(1-onset_)*std::min(36.,2.5*tail)*gate;shapeDb_=follow(shapeDb_,target,target>shapeDb_?shapeUp_:shapeDown_);
  double threshold=-18-18*tight_,ratio=2+18*tight_,compression=-tight_*std::max(0.,db(peak_)-threshold)*(1-1/ratio);compDb_=follow(compDb_,compression,compression<compDb_?compAttack_:compRelease_);
  lowL_+=lowA_*(l-lowL_);lowR_+=lowA_*(r-lowR_);double wetL=l,wetR=r;
  if(tight_!=0||click_!=0||body_!=.5){double bodyGain=std::pow(2.,2*(body_-.5)),upperGain=gain(click_*std::min(18.,attack+6*onset_));double g=gain(shapeDb_+compDb_+6*tight_);wetL=(bodyGain*lowL_+upperGain*(l-lowL_))*g;wetR=(bodyGain*lowR_+upperGain*(r-lowR_))*g;}
  if(mix_!=0){l=(1-mix_)*l+mix_*wetL*trim_;r=(1-mix_)*r+mix_*wetR*trim_;}
 }
};
}
#endif
