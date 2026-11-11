#ifndef BLOCKS_RESONANT_FILTER_H
#define BLOCKS_RESONANT_FILTER_H
#include <algorithm>
#include <cmath>
namespace blocks_detail {
// Original implementation of the linear trapezoidal-integrator SVF equations.
// Mathematical reference: Andrew Simper, Cytomic, SvfLinearTrapOptimised2.pdf.
// No copied implementation, nonlinear ladder claim, or self-oscillation mode.
struct ResonantCoefficients {
 double a1=1,a2=0,a3=0,cutoff=-1,damping=-1,rate=-1;
 void set(double hz,double k,double sampleRate) {
  hz=std::max(20.,std::min(sampleRate*.45,hz));
  if(hz==cutoff&&k==damping&&sampleRate==rate)return;
  cutoff=hz;damping=k;rate=sampleRate;
  const double g=std::tan(3.14159265358979323846*hz/sampleRate);
  a1=1/(1+g*(g+k));a2=g*a1;a3=g*a2;
 }
 static double q(double resonance){return .7071067811865475244*std::exp(2.4260151319598084*std::max(0.,std::min(1.,resonance)));}
};
struct ResonantFilter {
 double ic1=0,ic2=0;
 ResonantCoefficients coefficients;
 double process(double input,const ResonantCoefficients&c) {
  const double v3=input-ic2,v1=c.a1*ic1+c.a2*v3,v2=ic2+c.a2*ic1+c.a3*v3;
  ic1=2*v1-ic1;ic2=2*v2-ic2;
  if(std::abs(ic1)<1e-20)ic1=0;if(std::abs(ic2)<1e-20)ic2=0;
  return v2;
 }
 void clear(){ic1=ic2=0;}
};
}
#endif
