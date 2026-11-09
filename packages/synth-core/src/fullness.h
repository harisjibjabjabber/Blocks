#ifndef BLOCKS_FULLNESS_H
#define BLOCKS_FULLNESS_H
#include <algorithm>
#include <array>
#include <cmath>

namespace blocks_detail {
// Original monotonic asymmetric polynomial saturator. The derivative inside
// [-1,1] is (1-x*x)*(1+2*a*x), nonnegative for a=.22. Outside it is constant.
// Its analytic primitive enables first-order ADAA (Parker/Zavalishin/Le Bivic,
// DAFx 2016, eq. 9). No third-party code is used. Not a transistor model.
inline double saturation(double x) {
 constexpr double a=.22;
 x=std::max(-1.0,std::min(1.0,x)); const double x2=x*x;
 return x-x*x2/3+a*(x2-.5*x2*x2);
}
inline double primitive(double x) {
 constexpr double a=.22;
 if(x>1) return 5.0/12+a*7.0/30+saturation(1)*(x-1);
 if(x< -1) return 5.0/12-a*7.0/30+saturation(-1)*(x+1);
 const double x2=x*x;
 return .5*x2-x2*x2/12+a*(x*x2/3-x*x2*x2/10);
}
struct AntialiasedSaturation {
 double previous=0;
 double process(double x) {
  const double difference=x-previous;
  const double result=std::abs(difference)>1e-5 ? (primitive(x)-primitive(previous))/difference : saturation((x+previous)*.5);
  previous=x; return result;
 }
};
struct FullnessPath {
 AntialiasedSaturation shaper;
 double dcInput=0,dcOutput=0;
 std::array<double,4> poles{};
 double process(double raw,double preGain,double poleAlpha,double dcPole) {
  const double shaped=shaper.process(raw*preGain);
  // Unity-ish high-frequency gain; the zero at DC removes even-harmonic bias.
  double value=(1+dcPole)*.5*(shaped-dcInput)+dcPole*dcOutput;
  dcInput=shaped; dcOutput=value;
  for(double &pole:poles) { pole+=poleAlpha*(value-pole); if(std::abs(pole)<1e-20) pole=0; value=pole; }
  return value;
 }
};
}
#endif
