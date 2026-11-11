#pragma once
#include "table_bank.h"
#include "waveforms.h"
#include <algorithm>
#include <array>
#include <cmath>
namespace oscillator_spike {
// Isolated opt-in source interface. No app/core state, allocation or render IO.
// mode0=current source;1=2x analytic PolyBLEP+31tap FIR;2=Fourier mip bank.
// Wave0=sine/1=triangle are unchanged controls in every mode;2=saw/3=pulse.
class OscillatorSource {
 double phase_=0,rate_=48000;unsigned mode_=0,index_=0;std::array<double,31>history_{};
 static double blep(double p,double step){if(p<step){double x=p/step;return x+x-x*x-1;}if(p>1-step){double x=(p-1)/step;return x*x+x+x+1;}return 0;}
 static double saw(double p,double step){return 2*p-1-blep(p,step);}
 static double pulse(double p,double step,double width){double shifted=p-width;shifted-=std::floor(shifted);return (p<width?1:-1)+blep(p,step)-blep(shifted,step);}
 static double read(unsigned level,double phase){phase-=std::floor(phase);double at=phase*tableSize;int i=int(at);double t=at-i;const auto*data=sawBank[level];auto value=[&](int n){return double(data[unsigned(n)&(tableSize-1)]);};double a=value(i-1),b=value(i),c=value(i+1),d=value(i+2);return b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));}
 static double tableSaw(double phase,double step){double allowed=.49/step;unsigned level=0;while(level+1<tableCount&&limits[level+1]<=allowed)++level;if(!level)return read(0,phase);double t=std::clamp((allowed/limits[level]-1)/.02,0.,1.);return read(level-1,phase)+(read(level,phase)-read(level-1,phase))*t;}
 void advance(double step){phase_+=step;phase_-=std::floor(phase_);}
 void push(double x){history_[index_]=x;if(++index_==31)index_=0;}
 double filtered()const{double out=0;for(unsigned j=0;j<31;++j)if(std::abs(halfband[j])>1e-15){unsigned at=(index_+30-j)%31;out+=halfband[j]*history_[at];}return out;}
public:
 void prepare(double sampleRate,unsigned mode){rate_=sampleRate;mode_=mode;reset();}
 void reset(double phase=0){phase_=phase-std::floor(phase);index_=0;history_={};}
 unsigned latency(unsigned wave)const{return mode_==1&&wave>=2?7:0;}
 double sample(unsigned wave,double hz,double width=.5){const double step=std::clamp(hz/rate_,1e-9,.45);width=std::clamp(width,.1,.9);double value=0;
  if(wave<2){value=wave==0?blocks_detail::sine(phase_):blocks_detail::triangle(phase_,step);advance(step);return value;}
  if(mode_==1){for(unsigned i=0;i<2;++i){push(wave==2?saw(phase_,step*.5):pulse(phase_,step*.5,width));advance(step*.5);}return filtered();}
  if(mode_==2){value=tableSaw(phase_,step);if(wave==3)value=tableSaw(phase_-width,step)-value+2*width-1;}
  else value=wave==2?saw(phase_,step):pulse(phase_,step,width);
  advance(step);return value;
 }
};
}
