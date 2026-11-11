#ifndef BLOCKS_STEREO_REVERB_H
#define BLOCKS_STEREO_REVERB_H
#include "blocks_reverb.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <memory>
#include <new>
namespace blocks_detail {
class StereoReverb {
 static constexpr double pi=3.14159265358979323846;
 struct Line {
  std::unique_ptr<float[]> data; unsigned capacity=0,at=0,history=0;
  bool prepare(unsigned n){std::unique_ptr<float[]>p(new(std::nothrow)float[n]{});if(!p)return false;data=std::move(p);capacity=n;clear();return true;}
  void clear(){at=history=0;}
  double integer(unsigned delay)const{if(!delay||delay>history)return 0;return data[(at+capacity-delay)%capacity];}
  double read(double delay)const{delay=std::max(1.,std::min(double(capacity-2),delay));const auto n=unsigned(delay);const double f=delay-n;return integer(n)*(1-f)+integer(n+1)*f;}
  void write(double x){data[at]=float(x);if(++at==capacity)at=0;if(history<capacity-1)++history;}
 };
 struct Tap {
  double from=1,to=1,pending=1,blend=1;
  void reset(double n){from=to=pending=n;blend=1;}
  void set(double n){pending=n;}
  double read(const Line&l,double step,double modulation=0,double immediate=0){if(blend>=1&&std::abs(pending-to)>1e-9){from=to;to=pending;blend=0;}const double a=from<=0?immediate:l.read(from+modulation),b=to<=0?immediate:l.read(to+modulation);const double y=a+(b-a)*blend;blend=std::min(1.,blend+step);return y;}
 };
 std::array<Line,18> lines_; // tank8, input diffusion6, predelay2, shifter2
 std::array<Tap,16> taps_;
 std::array<double,8> dampingState_{},feedback_{},feedbackTarget_{},phase_{};
 std::array<double,2> inputLow_{},shiftReturn_{};
 std::array<double,63> shiftTaps_{};
 std::array<std::array<double,63>,2> shiftHistory_{};
 unsigned shiftAt_=0;
 double neutralPitch_=0;
 bool shiftActive_=false;
 bs_reverb_config config_=defaults();
 double rate_=48000,smooth_=0,fadeStep_=0,wet_=0,send_=0,trim_=1,width_=1;
 double diffusion_=0,lowAlpha_=0,dampAlpha_=0,modDepth_=0,modRate_=0,shimmer_=0,pitch_=2,shiftPhase_=0;
 double lowTarget_=0,dampTarget_=0,trimTarget_=1,pitchTarget_=2,early_=.2;
 bool prepared_=false;
 double wetLeft_=0;
 static double approach(double a,double b,double c){a+=(b-a)*c;return std::abs(a-b)<1e-12?b:a;}
 static double quiet(double x){return std::abs(x)<1e-20?0:x;}
 static double guard(double x){return std::max(-32.,std::min(32.,x));}
 static double baseTime(unsigned i){constexpr double times[8]={.0297,.0371,.0411,.0437,.0531,.0617,.0677,.0733};return times[i];}
 void targets(bool reset){
  const double scale=config_.size*(config_.mode==BS_REVERB_PLATE?1.:1.55);
  for(unsigned i=0;i<8;++i){const double seconds=baseTime(i)*scale;const double n=seconds*rate_;if(reset)taps_[i].reset(n);else taps_[i].set(n);feedbackTarget_[i]=std::pow(10.,-3*seconds/config_.decay_seconds);}
  constexpr double diffusors[6]={.0047,.0113,.0197,.0053,.0137,.0239};
  for(unsigned i=0;i<6;++i){const double n=diffusors[i]*scale*rate_;if(reset)taps_[8+i].reset(n);else taps_[8+i].set(n);}
  for(unsigned i=14;i<16;++i){const double n=double(config_.predelay_seconds)*rate_;if(reset)taps_[i].reset(n);else taps_[i].set(n);}
  lowTarget_=1-std::exp(-2*pi*std::min(double(config_.lowcut_hz),rate_*.4)/rate_);
  dampTarget_=1-std::exp(-2*pi*std::min(double(config_.damping_hz),rate_*.45)/rate_);
  trimTarget_=std::pow(10.,config_.output_db/20.);
  pitchTarget_=std::pow(2.,config_.shimmer_semitones/12.);
 }
 double diffuse(unsigned ch,double x){
  const double g=.25+.5*diffusion_;
  for(unsigned stage=0;stage<3;++stage){const unsigned i=8+ch*3+stage;const double delayed=taps_[i].read(lines_[i],fadeStep_);const double y=delayed-g*x;lines_[i].write(x+g*y);x=y;}
  return x;
 }
 std::array<double,2> shifted(double l,double r){
  std::array<double,2> result{};const double window=.09*rate_;
  double p2=shiftPhase_+.5;if(p2>=1)p2-=1;
  const double w=.5-.5*std::cos(2*pi*shiftPhase_);
  const double input[2]={l,r};
  neutralPitch_=approach(neutralPitch_,std::abs(config_.shimmer_semitones)<1e-5?1:0,smooth_);
  for(unsigned ch=0;ch<2;++ch){auto&history=shiftHistory_[ch];history[shiftAt_]=input[ch];double filtered=0;for(unsigned k=0;k<31;++k)filtered+=shiftTaps_[k]*(history[(shiftAt_+63-k)%63]+history[(shiftAt_+1+k)%63]);filtered+=shiftTaps_[31]*history[(shiftAt_+32)%63];auto&line=lines_[16+ch];line.write(filtered);const double y=w*line.read(2+shiftPhase_*window)+(1-w)*line.read(2+p2*window);result[ch]=y+neutralPitch_*(filtered-y);}
  if(++shiftAt_==63)shiftAt_=0;
  shiftPhase_+=(1-pitch_)/window;shiftPhase_-=std::floor(shiftPhase_);return result;
 }
public:
 static bs_reverb_config defaults(){return{1,0,BS_REVERB_PLATE,.015f,2.5f,1,.75f,120,7000,.3f,.2f,.35f,.25f,0,12,1};}
 static bool valid(const bs_reverb_config&c){
  if(c.version!=1||c.enabled>1||c.mode>2)return false;
  const float values[]={c.predelay_seconds,c.decay_seconds,c.size,c.diffusion,c.lowcut_hz,c.damping_hz,c.mod_rate_hz,c.mod_depth,c.shimmer,c.wet,c.output_db,c.shimmer_semitones,c.wet_width};
  constexpr float lo[]={0,.2f,.5f,0,20,200,.05f,0,0,0,-24,-12,0},hi[]={.25f,30,2,1,2000,20000,2,1,1,1,12,12,2};
  for(unsigned i=0;i<13;++i)if(!std::isfinite(values[i])||values[i]<lo[i]||values[i]>hi[i])return false;return true;
 }
 bool prepare(double rate){
  if(!std::isfinite(rate)||rate<8000||rate>384000)return false;
  std::array<Line,18> next;
  for(unsigned i=0;i<18;++i){const double seconds=i<8?.24:i<14?.08:i<16?.251:.091;if(!next[i].prepare(unsigned(std::ceil(seconds*rate))+8))return false;}
  lines_=std::move(next);rate_=rate;smooth_=1-std::exp(-1/(.02*rate));fadeStep_=1/(.05*rate);
  // Original Blackman-windowed sinc. Conservative0.20Fs pass edge protects
  // every supported upward ratio through2x; down shifts retain this warm band.
  double total=0;for(unsigned k=0;k<63;++k){const double x=double(k)-31;const double sinc=x==0?.4:std::sin(2*pi*.2*x)/(pi*x);shiftTaps_[k]=sinc*(.42-.5*std::cos(2*pi*k/62)+.08*std::cos(4*pi*k/62));total+=shiftTaps_[k];}for(auto&t:shiftTaps_)t/=total;
  prepared_=true;clear();return true;
 }
 bool configure(const bs_reverb_config&c){if(!valid(c))return false;config_=c;targets(false);return true;}
 const bs_reverb_config&config()const{return config_;}
 double wetLeft()const{return wetLeft_;}
 void clear(){
  wetLeft_=0;
  for(auto&l:lines_)l.clear();dampingState_.fill(0);inputLow_.fill(0);shiftReturn_.fill(0);shiftPhase_=0;shiftAt_=0;for(auto&h:shiftHistory_)h.fill(0);shiftActive_=false;neutralPitch_=std::abs(config_.shimmer_semitones)<1e-5?1:0;targets(true);feedback_=feedbackTarget_;
  for(unsigned i=0;i<8;++i)phase_[i]=i*.123456789;
  wet_=config_.enabled?config_.wet:0;send_=config_.enabled?1:0;trim_=trimTarget_;width_=config_.wet_width;diffusion_=config_.diffusion;lowAlpha_=lowTarget_;dampAlpha_=dampTarget_;modDepth_=config_.mod_depth;modRate_=config_.mod_rate_hz;shimmer_=config_.mode==BS_REVERB_SHIMMER?config_.shimmer:0;pitch_=pitchTarget_;early_=config_.mode==BS_REVERB_PLATE?.2:.055;
 }
 void process(double&left,double&right){
  wetLeft_=0;
  if(!prepared_)return;
  if(!config_.enabled&&wet_==0&&send_==0&&lines_[0].history==0)return;
  if(!std::isfinite(left)||!std::isfinite(right)){left=right=0;clear();return;}
  wet_=approach(wet_,config_.enabled?config_.wet:0,smooth_);send_=approach(send_,config_.enabled?1:0,smooth_);
  trim_=approach(trim_,trimTarget_,smooth_);width_=approach(width_,config_.wet_width,smooth_);diffusion_=approach(diffusion_,config_.diffusion,smooth_);
  lowAlpha_=approach(lowAlpha_,lowTarget_,smooth_);dampAlpha_=approach(dampAlpha_,dampTarget_,smooth_);modDepth_=approach(modDepth_,config_.mod_depth,smooth_);modRate_=approach(modRate_,config_.mod_rate_hz,smooth_);
  shimmer_=approach(shimmer_,config_.mode==BS_REVERB_SHIMMER?config_.shimmer:0,smooth_);pitch_=approach(pitch_,pitchTarget_,smooth_);early_=approach(early_,config_.mode==BS_REVERB_PLATE?.2:.055,smooth_);
  const double original[2]={left,right};std::array<double,2> input{};
  for(unsigned ch=0;ch<2;++ch){const double x=original[ch]*send_;inputLow_[ch]=quiet(inputLow_[ch]+lowAlpha_*(x-inputLow_[ch]));const double hp=x-inputLow_[ch];auto&pre=lines_[14+ch];const double delayed=taps_[14+ch].read(pre,fadeStep_,0,hp);pre.write(hp);input[ch]=diffuse(ch,delayed);}
  std::array<double,8> v{};double sum=0,wetL=0,wetR=0;
  constexpr double a[8]={1,1,-1,-1,1,1,-1,-1},b[8]={1,-1,1,-1,-1,1,-1,1};
  constexpr double c[8]={1,-1,-1,1,1,-1,-1,1},d[8]={1,1,1,1,-1,-1,-1,-1};
  constexpr double norm=.3535533905932737622;
  for(unsigned i=0;i<8;++i){
   phase_[i]+=modRate_*(.83+i*.071)/rate_;if(phase_[i]>=1)phase_[i]-=1;
   const double modulation=modDepth_*.0012*rate_*std::sin(2*pi*phase_[i]);
   const double x=taps_[i].read(lines_[i],fadeStep_,modulation);dampingState_[i]=quiet(dampingState_[i]+dampAlpha_*(x-dampingState_[i]));v[i]=dampingState_[i];sum+=v[i];wetL+=norm*c[i]*v[i];wetR+=norm*d[i]*v[i];
  }
  double returnL=0,returnR=0;for(unsigned i=0;i<8;++i){returnL+=norm*a[i]*(.25*sum-v[i]);returnR+=norm*b[i]*(.25*sum-v[i]);}
  std::array<double,2> shift{};
  if(shimmer_!=0){shift=shifted(returnL,returnR);shiftActive_=true;}
  else if(shiftActive_){for(unsigned i=16;i<18;++i)lines_[i].clear();for(auto&h:shiftHistory_)h.fill(0);shiftAt_=0;shiftPhase_=0;shiftActive_=false;}
  // Householder is orthogonal. Replace part of two orthogonal feedback axes,
  // not the entire tank: six axes preserve the long unshifted body. A0.5 debit
  // funds at most0.35 shifted return (dual-head time-resampling needs margin).
  // This is not a freeze; pitch, damping and modulation change actual decay.
  for(unsigned i=0;i<8;++i){feedback_[i]=approach(feedback_[i],feedbackTarget_[i],smooth_);const double feed=norm*(a[i]*input[0]+b[i]*input[1]);const double shiftedFeedback=norm*shimmer_*(a[i]*(.35*shift[0]-.5*returnL)+b[i]*(.35*shift[1]-.5*returnR));const double returning=(.25*sum-v[i]+shiftedFeedback)*feedback_[i];lines_[i].write(guard(feed+returning));}
  wetL+=early_*input[0];wetR+=early_*input[1];
  const double mid=(wetL+wetR)*.5,side=(wetL-wetR)*.5*width_;wetL=(mid+side)*trim_;wetR=(mid-side)*trim_;
  wetLeft_=wet_*wetL;
  if(wet_!=0){left=(1-wet_)*left+wet_*wetL;right=(1-wet_)*right+wet_*wetR;}
 }
};
static_assert(sizeof(bs_reverb_config)==64&&offsetof(bs_reverb_config,predelay_seconds)==12&&offsetof(bs_reverb_config,shimmer_semitones)==56&&offsetof(bs_reverb_config,wet_width)==60,"Reverb ABI");
}
#endif
