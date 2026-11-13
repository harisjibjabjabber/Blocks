#ifndef BLOCKS_MOTION_MACRO_H
#define BLOCKS_MOTION_MACRO_H
#include <algorithm>
namespace blocks_detail {
inline double motionCurve(double n,bool settling){const double xs[]={0,.6,.85,1},drift[]={0,4.8,40,120},hit[]={0,1.2,12,60};const double*y=settling?hit:drift;n=std::max(0.,std::min(1.,n));unsigned i=n<.6?0:n<.85?1:2;return y[i]+(n-xs[i])/(xs[i+1]-xs[i])*(y[i+1]-y[i]);}
inline double motionInverse(double cents){const double xs[]={0,.6,.85,1},ys[]={0,4.8,40,120};cents=std::max(0.,std::min(120.,cents));unsigned i=cents<4.8?0:cents<40?1:2;return xs[i]+(cents-ys[i])/(ys[i+1]-ys[i])*(xs[i+1]-xs[i]);}
}
#endif
