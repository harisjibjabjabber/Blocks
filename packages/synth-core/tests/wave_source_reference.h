#pragma once
// Measurement-only reference: original current PolyBLEP and 2x/FIR comparator.
// Production source is wave_source.h. No third-party DSP source copied.
#include "../src/wave_source.h"
#include <array>
#include <cmath>
namespace source_measurement {
inline constexpr double halfband[]={-2.8276239616861412e-05,1.3610765591348114e-19,0.00047457914152709493,-8.1640071238072918e-19,-0.0022548599889103925,2.5415933337166443e-18,0.0071107141292696425,-5.6489075174427941e-18,-0.017936243556608014,9.9450104726312807e-18,0.040132438554654169,-1.4549804117340136e-17,-0.090123990198182166,1.8133700508232298e-17,0.31263081598907799,0.49998964433757692,0.31263081598907799,1.8133700508232298e-17,-0.090123990198182166,-1.4549804117340136e-17,0.040132438554654169,9.9450104726312807e-18,-0.017936243556608014,-5.6489075174427941e-18,0.0071107141292696425,2.5415933337166443e-18,-0.0022548599889103925,-8.1640071238072918e-19,0.00047457914152709493,1.3610765591348114e-19,-2.8276239616861412e-05};
class OscillatorSource {
 double phase_=0,rate_=48000;unsigned mode_=0,index_=0;std::array<double,31>history_{};
 static double blep(double p,double step){if(p<step){double x=p/step;return x+x-x*x-1;}if(p>1-step){double x=(p-1)/step;return x*x+x+x+1;}return 0;}
 static double saw(double p,double step){return 2*p-1-blep(p,step);}
 static double pulse(double p,double step,double width){double q=p-width;q-=std::floor(q);return(p<width?1:-1)+blep(p,step)-blep(q,step);}
 void advance(double step){phase_+=step;phase_-=std::floor(phase_);}
 void push(double x){history_[index_]=x;if(++index_==31)index_=0;}
 double filtered()const{double out=0;for(unsigned j=0;j<31;++j)if(std::abs(halfband[j])>1e-15)out+=halfband[j]*history_[(index_+30-j)%31];return out;}
public:
 void prepare(double rate,unsigned mode){rate_=rate;mode_=mode;reset();}
 void reset(){phase_=0;index_=0;history_={};}
 unsigned latency(unsigned wave)const{return mode_==1&&wave>=2?7:0;}
 double sample(unsigned wave,double hz,double width=.5){double step=std::clamp(hz/rate_,1e-9,.45);width=std::clamp(width,.1,.9);double out;
 if(mode_==2){out=blocks_detail::StudioOscillator::sample(wave,phase_,step,width);advance(step);return out;}
 if(wave<2){out=wave?blocks_detail::triangle(phase_,step):blocks_detail::sine(phase_);advance(step);return out;}
 if(mode_==1){for(unsigned i=0;i<2;++i){push(wave==2?saw(phase_,step*.5):pulse(phase_,step*.5,width));advance(step*.5);}return filtered();}
 out=wave==2?saw(phase_,step):pulse(phase_,step,width);advance(step);return out;
 }
};
}
