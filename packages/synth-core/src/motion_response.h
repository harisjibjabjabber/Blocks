#ifndef BLOCKS_MOTION_RESPONSE_H
#define BLOCKS_MOTION_RESPONSE_H
#include <algorithm>
#include <cmath>
namespace blocks_detail {
inline double unit(double x){return std::max(0.0,std::min(1.0,x));}
inline double smoothUnit(double x){x=unit(x);return x*x*(3-2*x);}
// Original continuous envelope-shape heuristic, not note-duration prediction.
// Energy and residual are evaluated after the attack on the actual curved ADSR.
inline double motionShortness(double attack,double decay,double sustain,double release,double attackBend,double decayBend,double releaseBend){
 const double S=unit(sustain),A=std::max(.001,attack),D=std::max(.001,decay),R=std::max(.001,release),h=.35;
 const double pa=std::exp2(attackBend),pd=std::exp2(decayBend),pr=std::exp2(releaseBend),u=std::min(1.0,h/D),t=std::min(h,D),k=1-S;
 const double integral=t-2*k*D*std::pow(u,pd+1)/(pd+1)+k*k*D*std::pow(u,2*pd+1)/(2*pd+1)+std::max(0.0,h-D)*S*S;
 const double energy=unit(integral/h),residual=1-k*std::pow(u,pd),audibleAttack=A*std::pow(.9,1/pa);
 const double fast=1/(1+std::pow(audibleAttack/.045,2));
 const double tailEnergy=R*(1-2/(pr+1)+1/(2*pr+1)),tail=std::exp(-std::max(0.0,tailEnergy-.06)/.5);
 return unit(fast*smoothUnit((1-energy-.05)/.85)*std::pow(1-S,2)*std::pow(1-residual*residual,2)*tail);
}
inline double settlingAllowance(double requested,double shortness){return std::min(requested,8.9+std::max(0.0,requested-8.9)*shortness);}
inline double responsiveDrift(double requested,double shortness,double age){const double base=std::min(requested,29.8);if(requested<=29.8||shortness==0)return base;return base+(requested-base)*shortness*std::exp(-age/(.06+.12*shortness));}
}
#endif
