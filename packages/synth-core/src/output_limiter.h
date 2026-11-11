#ifndef BLOCKS_OUTPUT_LIMITER_H
#define BLOCKS_OUTPUT_LIMITER_H
#include "blocks_output.h"
#include <array>
#include <algorithm>
#include <cmath>
#include <cstdint>

namespace blocks_detail {
// Original stereo-linked lookahead gain limiter. A sliding minimum holds each
// required attenuation for the full support of two cascaded box smoothers.
// The delayed peak therefore sees the fully established gain, while leading
// audio sees a triangular attack. No shaping, oversampling or added harmonics
// while gain=1. Constant storage; amortized O(1) per sample; no render allocation.
class OutputLimiter {
 static constexpr unsigned capacity=1024;
 struct Minimum {double value=1;uint64_t time=0;};
 std::array<Minimum,capacity> queue_{};
 std::array<double,capacity> left_{},right_{},box1_{},box2_{};
 unsigned head_=0,tail_=0,at_=0,boxAt_=0,boxSize_=25,delay_=48;
 uint64_t time_=0;
 double sum1_=25,sum2_=25,release_=0,peakDecay_=0,envelope_=1;
 bs_output_meters meters_{};
 static double safe(double x){return std::isfinite(x)?x:0;}
public:
 static constexpr double ceiling=.98;
 void prepare(double rate){boxSize_=unsigned(std::ceil(rate*.0005))+1;delay_=2*(boxSize_-1);release_=1-std::exp(-1/(.08*rate));peakDecay_=std::exp(-1/(.3*rate));clear();}
 void clear(){left_.fill(0);right_.fill(0);box1_.fill(1);box2_.fill(1);head_=tail_=at_=boxAt_=0;time_=0;sum1_=sum2_=boxSize_;envelope_=1;meters_={};}
 unsigned latency()const{return delay_;}
 bs_output_meters meters()const{return meters_;}
 void process(double&l,double&r){
  l=safe(l);r=safe(r);const double peak=std::max(std::abs(l),std::abs(r));
  const double required=peak>ceiling?ceiling/peak:1;
  while(head_!=tail_&&queue_[head_].time+delay_<time_)head_=(head_+1)%capacity;
  while(head_!=tail_&&queue_[(tail_+capacity-1)%capacity].value>=required)tail_=(tail_+capacity-1)%capacity;
  queue_[tail_]={required,time_++};tail_=(tail_+1)%capacity;
  const double target=queue_[head_].value;
  if(target<envelope_)envelope_=target;else envelope_+=release_*(target-envelope_);
  sum1_+=envelope_-box1_[boxAt_];box1_[boxAt_]=envelope_;const double first=sum1_/boxSize_;
  sum2_+=first-box2_[boxAt_];box2_[boxAt_]=first;boxAt_=(boxAt_+1)%boxSize_;
  const double gain=std::max(0.,std::min(1.,sum2_/boxSize_));
  const double delayedL=left_[at_],delayedR=right_[at_];left_[at_]=l;right_[at_]=r;at_=(at_+1)%delay_;
  // Bound roundoff at the declared sample ceiling; no ordinary-level clipping.
  l=std::max(-ceiling,std::min(ceiling,delayedL*gain));r=std::max(-ceiling,std::min(ceiling,delayedR*gain));
  meters_.input_peak=float(std::max(peak,double(meters_.input_peak)*peakDecay_));
  meters_.output_peak=float(std::max(std::max(std::abs(l),std::abs(r)),double(meters_.output_peak)*peakDecay_));
  meters_.gain_reduction_db=float(-20*std::log10(std::max(gain,1e-12)));
 }
};
}
#endif
