#ifndef BLOCKS_FULLNESS_H
#define BLOCKS_FULLNESS_H
#include <algorithm>
#include <cmath>
namespace blocks_detail {
// Original bounded harmonic residual: even harmonics plus a Chebyshev-inspired
// cubic. For a unit sine, x^3-.75x has no first harmonic. This is not a circuit
// model; on other waveforms/levels it also changes the fundamental modestly.
inline double harmonicResidual(double x) {
 x=std::max(-1.0,std::min(1.0,x));
 return .12*x*x+.20*(x*x*x-.75*x);
}
inline double harmonicPrimitive(double x) {
 const auto inside=[](double y){return .12*y*y*y/3+.20*(y*y*y*y/4-.375*y*y);};
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
 double process(double raw,double dcPole) {
  const double shaped=shaper.process(raw);
  // Only the residual loses DC; the original dry foundation is untouched.
  const double value=(1+dcPole)*.5*(shaped-dcInput)+dcPole*dcOutput;
  dcInput=shaped;dcOutput=value;return value;
 }
};
}
#endif
