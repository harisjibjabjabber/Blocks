#ifndef BLOCKS_FULLNESS_H
#define BLOCKS_FULLNESS_H
#include <algorithm>
#include <cmath>
namespace blocks_detail {
// Original additive harmonic colour. No negative linear term: quiet oscillator
// mixtures must not lose their foundation. This is not a circuit model.
inline double harmonicResidual(double x) {
 x=std::max(-1.0,std::min(1.0,x));
 return .20*x*x+.25*x*x*x;
}
inline double harmonicPrimitive(double x) {
 const auto inside=[](double y){return .20*y*y*y/3+.25*y*y*y*y/4;};
 if(x>1)return inside(1)+harmonicResidual(1)*(x-1);
 if(x< -1)return inside(-1)+harmonicResidual(-1)*(x+1);
 return inside(x);
}
// First-order antiderivative antialiasing, Parker/Zavalishin/Le Bivic 2016
// equation9, applied only to the small residual. No external code copied.
struct AntialiasedResidual {
 double previous=0;
 double process(double x) {
  const double difference=x-previous;
  const double result=std::abs(difference)>1e-5?(harmonicPrimitive(x)-harmonicPrimitive(previous))/difference:harmonicResidual((x+previous)*.5);
  previous=x;return result;
 }
};
struct FullnessPath {
 AntialiasedResidual shaper;
 double dcInput=0,dcOutput=0;
 double bodyLow=0,bodySub=0;
 double process(double raw,double dcPole) {
  const double shaped=shaper.process(raw);
  // Only the residual loses DC; the original dry foundation is untouched.
  const double value=(1+dcPole)*.5*(shaped-dcInput)+dcPole*dcOutput;
  dcInput=shaped;dcOutput=value;return value;
 }
 // Called after Drive, and warmed even when Fullness is zero. coefficient is
 // the prepared ~180Hz one-pole alpha. The slower average rejects DC without
 // replacing or attenuating the dry path. Difference of these ordered low-pass
 // responses has nonnegative real part: positive addition cannot cancel dry.
 // Linear processing adds no new harmonics/alias source after Drive.
 double body(double signal,double coefficient) {
  const double alpha=std::max(0.0,std::min(1.0,coefficient));
  bodyLow+=alpha*(signal-bodyLow);
  bodySub+=(alpha/18)*(signal-bodySub);
  return .5*(bodyLow-bodySub);
 }
};
}
#endif
