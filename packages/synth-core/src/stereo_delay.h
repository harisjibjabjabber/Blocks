#ifndef BLOCKS_STEREO_DELAY_H
#define BLOCKS_STEREO_DELAY_H
#include "blocks_delay.h"
#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <new>
namespace blocks_detail {
class StereoDelay {
 bs_delay_config config_=defaults();
 std::unique_ptr<double[]> memory_;
 unsigned capacity_=0,write_=0,validHistory_=0,fadeRemaining_=0,fadeLength_=960;
 double rate_=48000,bpm_=120,smoothing_=1-std::exp(-1./240),damping_=1,dampingTarget_=1;
 double tap_=12000,nextTap_=12000,requestedTap_=12000;
 double wet_=0,feedback_=0,send_=0,ping_=0,filterL_=0,filterR_=0;
 static double approach(double value,double target,double amount){value+=(target-value)*amount;return std::abs(value-target)<1e-12?target:value;}
 double delaySamples(double bpm)const{
  const double seconds=config_.synced?(60/bpm)*(4./config_.division)*(config_.triplet?2./3:1):config_.time_seconds;
  return std::max(1.,std::min(2*rate_,seconds*rate_));
 }
 void prepareDamping(){dampingTarget_=1-std::exp(-6.2831853071795864769*std::min(double(config_.damping_hz),rate_*.45)/rate_);}
 double integerRead(unsigned channel,unsigned distance)const{
  if(distance>validHistory_)return 0;
  const unsigned at=write_>=distance?write_-distance:write_+capacity_-distance;
  return memory_[channel*capacity_+at];
 }
 double read(unsigned channel,double distance)const{
  const auto whole=unsigned(distance);const double fraction=distance-whole;
  const double a=integerRead(channel,whole);
  return fraction==0?a:a+fraction*(integerRead(channel,whole+1)-a);
 }
public:
 static bs_delay_config defaults(){return{BS_DELAY_VERSION,0,BS_DELAY_STEREO,0,8,0,.25f,0,0,20000};}
 static bool valid(const bs_delay_config&c){
  return c.version==BS_DELAY_VERSION&&c.enabled<=1&&c.mode<=BS_DELAY_PINGPONG&&c.synced<=1&&c.triplet<=1&&
   (c.division==4||c.division==8||c.division==16||c.division==32||c.division==64)&&(!c.triplet||c.division<=16)&&
   std::isfinite(c.time_seconds)&&c.time_seconds>=.01f&&c.time_seconds<=2&&std::isfinite(c.feedback)&&c.feedback>=0&&c.feedback<=.9f&&
   std::isfinite(c.wet)&&c.wet>=0&&c.wet<=1&&std::isfinite(c.damping_hz)&&c.damping_hz>=20&&c.damping_hz<=20000;
 }
 bool prepare(double rate){
  if(!std::isfinite(rate)||rate<8000||rate>384000)return false;
  const auto capacity=unsigned(std::ceil(rate*2))+2;
  // Allocation and page initialization are preparation work, never render or panic.
  std::unique_ptr<double[]> next(new(std::nothrow) double[size_t(capacity)*2]{});if(!next)return false;
  memory_=std::move(next);capacity_=capacity;rate_=rate;smoothing_=1-std::exp(-1/(.005*rate));fadeLength_=unsigned(std::ceil(.02*rate));prepareDamping();clear();return true;
 }
 bool configure(const bs_delay_config&config){if(!valid(config))return false;config_=config;prepareDamping();return true;}
 const bs_delay_config&config()const{return config_;}
 // Valid-history guards exclude stale samples, avoiding a buffer-sized clear
 // inside a sample-offset panic. Every newly valid sample has been overwritten.
 void clear(){write_=validHistory_=fadeRemaining_=0;filterL_=filterR_=0;tap_=nextTap_=requestedTap_=delaySamples(bpm_);wet_=config_.enabled?config_.wet:0;send_=config_.enabled?1:0;feedback_=config_.feedback;ping_=config_.mode;damping_=dampingTarget_;}
 void process(double&left,double&right,double bpm){
  if(!memory_)return;
  if(std::isfinite(bpm)&&bpm>=40&&bpm<=240)bpm_=bpm;
  if(!config_.enabled&&send_==0&&wet_==0&&validHistory_==0)return;
  requestedTap_=delaySamples(bpm_);
  if(!fadeRemaining_&&std::abs(requestedTap_-tap_)>1e-9){nextTap_=requestedTap_;fadeRemaining_=fadeLength_;}
  double echoL=read(0,tap_),echoR=read(1,tap_);
  if(fadeRemaining_){const double blend=double(fadeLength_-fadeRemaining_+1)/fadeLength_;echoL+=blend*(read(0,nextTap_)-echoL);echoR+=blend*(read(1,nextTap_)-echoR);if(--fadeRemaining_==0)tap_=nextTap_;}
  wet_=approach(wet_,config_.enabled?config_.wet:0,smoothing_);send_=approach(send_,config_.enabled?1:0,smoothing_);
  feedback_=approach(feedback_,config_.feedback,smoothing_);ping_=approach(ping_,config_.mode,smoothing_);damping_=approach(damping_,dampingTarget_,smoothing_);
  filterL_+=damping_*(echoL-filterL_);filterR_+=damping_*(echoR-filterR_);
  if(std::abs(filterL_)<1e-18)filterL_=0;if(std::abs(filterR_)<1e-18)filterR_=0;
  const double returnL=filterL_+ping_*(filterR_-filterL_),returnR=filterR_+ping_*(filterL_-filterR_);
  memory_[write_]=left*send_+feedback_*returnL;memory_[capacity_+write_]=right*send_+feedback_*returnR;
  if(++write_==capacity_)write_=0;if(validHistory_<capacity_-1)++validHistory_;
  if(wet_!=0){left+=wet_*(echoL-left);right+=wet_*(echoR-right);}
 }
};
static_assert(sizeof(bs_delay_config)==40&&offsetof(bs_delay_config,time_seconds)==24&&offsetof(bs_delay_config,damping_hz)==36,"Delay ABI");
}
#endif
