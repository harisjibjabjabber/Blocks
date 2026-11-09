#ifndef BLOCKS_WAVEFORMS_H
#define BLOCKS_WAVEFORMS_H
#include "wave_tables.h"
#include <array>
#include <cmath>
#include <algorithm>
namespace blocks_detail {
inline double table(const float *data,double phase) {
 phase-=std::floor(phase); const double index=phase*waveTableSize; const auto first=unsigned(index); const double fraction=index-first;
 return data[first]+(data[first+1]-data[first])*fraction;
}
inline double sine(double phase) { return table(sineTable,phase); }
inline double triangle(double phase,double step) {
 const double allowed=.45/std::max(1e-9,step);unsigned level=0;
 while(level<7 && triangleLimits[level+1]<=allowed) ++level;
 if(level==0) return table(triangleTables[0],phase);
 const double low=table(triangleTables[level-1],phase),high=table(triangleTables[level],phase);
 const double next=double(triangleLimits[level])*2+1;
 const double weight=std::max(0.0,std::min(1.0,(allowed-triangleLimits[level])/(next-triangleLimits[level])));
 return low+(high-low)*weight;
}
}
#endif
