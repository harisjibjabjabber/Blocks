#ifndef BLOCKS_WAVE_SOURCE_H
#define BLOCKS_WAVE_SOURCE_H
#include "waveforms.h"
#include "wave_source_tables.h"
#include <algorithm>
#include <array>
#include <cmath>

namespace blocks_detail {
// Studio is the current oscillator source.
// No phase ownership, latency, mutable tables, allocation or state reset.
// Caller supplies finite phase, positive step <=.45 and finite pulse width.
// Wave IDs follow the public enum: Sine0, Triangle1, Saw2, Pulse3, Square4.
class StudioOscillator {
public:
 struct Plan {unsigned level;double blend;};
 static Plan plan(double step) {
  const double allowed=.49/std::max(step,1e-12);
  unsigned lo=0,hi=studio_tables::count;
  while(lo+1<hi){const unsigned mid=(lo+hi)/2;if(studio_tables::levels[mid].harmonic<=allowed)lo=mid;else hi=mid;}
  if(lo==0)return {0,1};
  const double t=std::clamp((allowed/studio_tables::levels[lo].harmonic-1)/.02,0.,1.);
  return {lo,t*t*(3-2*t)};
 }
 static double read(const float *data,unsigned size,double phase) {
  phase-=std::floor(phase);const double at=phase*size;const int i=int(at);const double t=at-i;
  const unsigned mask=size-1;const double a=data[unsigned(i-1)&mask],b=data[unsigned(i)&mask],c=data[unsigned(i+1)&mask],d=data[unsigned(i+2)&mask];
  return b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
 }
 static double table(bool triangle,double phase,const Plan&p) {
  const auto&high=studio_tables::levels[p.level];
  const double h=read(triangle?high.triangle:high.saw,high.size,phase);
  if(p.level==0||p.blend==1)return h;
  const auto&low=studio_tables::levels[p.level-1];
  const double l=read(triangle?low.triangle:low.saw,low.size,phase);
  return l+(h-l)*p.blend;
 }
 static double selected(unsigned wave,double phase,double width,const Plan&p) {
  if(wave==1)return table(true,phase,p);
  if(wave==2)return table(false,phase,p);
  if(wave==3||wave==4){const double w=wave==4?.5:std::clamp(width,.1,.9);return table(false,phase-w,p)-table(false,phase,p)+2*w-1;}
  return 0;
 }
public:
 static double sample(unsigned wave,double phase,double step,double width=.5) {
  if(wave==0)return sine(phase);
  return selected(wave,phase,width,plan(step));
 }
 static double mix(const std::array<double,5>&weights,double phase,double step,double width) {
  double result=weights[0]?weights[0]*sine(phase):0;
  if(weights[1]==0&&weights[2]==0&&weights[3]==0&&weights[4]==0)return result;
  const auto p=plan(step);
  for(unsigned wave=1;wave<5;++wave)if(weights[wave])result+=weights[wave]*selected(wave,phase,width,p);
  return result;
 }
};
}
#endif
