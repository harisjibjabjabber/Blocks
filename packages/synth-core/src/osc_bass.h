#ifndef BLOCKS_OSC_BASS_ENGINE_H
#define BLOCKS_OSC_BASS_ENGINE_H
#include "blocks_osc_bass.h"
#include "wave_source.h"
#include "osc_bass_tables.h"
#include <array>
#include <cmath>
#include <cstddef>
#include <algorithm>
namespace blocks_detail {
inline bs_osc_bass_config defaultOscBass(){return {1,0,{{0,4,.65f,.35f},{0,4,.65f,.35f}}};}
inline bool validOscBassEntry(const bs_osc_bass_entry&e){return e.enabled<=1&&std::isfinite(e.spin_hz)&&e.spin_hz>=.1f&&e.spin_hz<=20&&std::isfinite(e.motion)&&e.motion>=0&&e.motion<=1&&std::isfinite(e.grit)&&e.grit>=0&&e.grit<=1;}
inline bool validOscBass(const bs_osc_bass_config&c){return c.version==1&&c.reserved==0&&validOscBassEntry(c.oscillators[0])&&validOscBassEntry(c.oscillators[1]);}
struct OscBassPose {double cosine=1,sine=0,contrast=1,grit=0,guardScale=1;};
class OscBassSource {
 static double quad(bool triangle,double phase,const StudioOscillator::Plan&p){const auto&h=bass_tables::levels[p.level];const double high=StudioOscillator::read(triangle?h.triangle:h.saw,h.size,phase);if(p.level==0||p.blend==1)return high;const auto&l=bass_tables::levels[p.level-1];const double low=StudioOscillator::read(triangle?l.triangle:l.saw,l.size,phase);return low+(high-low)*p.blend;}
 static double harmonicGate(unsigned harmonic,double allowed){const double t=std::clamp((allowed/harmonic-1)/.02,0.,1.);return t*t*(3-2*t);}
public:
 static OscBassPose pose(double spin,double motion,double grit,double phase,double rate){const double angle=3.14159265358979323846*motion*std::sin(6.283185307179586*phase);return {std::cos(angle),std::sin(angle),.5+grit,grit,1/(1-10*spin/(.49*rate))};}
 static double mix(const std::array<double,5>&weights,double phase,double step,double width,const OscBassPose&pose){
  const double safeStep=step*pose.guardScale;const auto plan=StudioOscillator::plan(safeStep);const double sin1=sine(phase),cos1=sine(phase+.25);constexpr double sawA=-.63661977236758134308,triA=.81056946913870217155;
  double result=0;
  for(unsigned wave=0;wave<5;++wave)if(weights[wave]){
   double fundamental=0,dc=0,higher=0,quadrature=0;
   if(wave==0){fundamental=sin1;const double allowed=.49/safeStep;for(unsigned n=2;n<=3;++n){const double gain=pose.grit*(n==2?.25:.125)*harmonicGate(n,allowed);higher+=gain*sine(phase*n);quadrature-=gain*sine(phase*n+.25);}}
   else if(wave==1){fundamental=triA*cos1;if(plan.level){higher=StudioOscillator::table(true,phase,plan)-fundamental;quadrature=quad(true,phase,plan);}}
   else if(wave==2){fundamental=sawA*sin1;if(plan.level){higher=StudioOscillator::table(false,phase,plan)-fundamental;quadrature=quad(false,phase,plan);}}
   else{const double w=wave==4?.5:std::clamp(width,.1,.9);fundamental=sawA*(sine(phase-w)-sin1);dc=2*w-1;if(plan.level){higher=StudioOscillator::table(false,phase-w,plan)-StudioOscillator::table(false,phase,plan)-fundamental;quadrature=quad(false,phase-w,plan)-quad(false,phase,plan);}}
   result+=weights[wave]*(dc+fundamental+pose.contrast*(pose.cosine*higher+pose.sine*quadrature));
  }
  return result;
 }
};
class OscBass {
 struct State{double phase=0,lastPhase=0,enabled=0,spin=4,motion=.65,grit=.35;OscBassPose pose;};
 bs_osc_bass_config requested_=defaultOscBass();std::array<State,2>states_{};
 static double toward(double x,double y,double a){const double n=x+a*(y-x);return std::abs(n-y)<1e-12?y:n;}
public:
 bool configure(const bs_osc_bass_config&c){if(!validOscBass(c))return false;requested_=c;return true;}
 const bs_osc_bass_config&config()const{return requested_;}
 void reset(double rate){for(unsigned i=0;i<2;++i){auto&s=states_[i];const auto&c=requested_.oscillators[i];s={};s.enabled=c.enabled;s.spin=c.spin_hz;s.motion=c.motion;s.grit=c.grit;s.pose=OscBassSource::pose(s.spin,s.motion,s.grit,0,rate);}}
 void tick(double rate,double smoothing){for(unsigned i=0;i<2;++i){auto&s=states_[i];const auto&c=requested_.oscillators[i];s.spin=toward(s.spin,c.spin_hz,smoothing);s.motion=toward(s.motion,c.motion,smoothing);s.grit=toward(s.grit,c.grit,smoothing);const double fade=1/(.005*rate);s.enabled=c.enabled>s.enabled?std::min(double(c.enabled),s.enabled+fade):std::max(double(c.enabled),s.enabled-fade);s.lastPhase=s.phase;if(s.enabled>0)s.pose=OscBassSource::pose(s.spin,s.motion,s.grit,s.phase,rate);s.phase+=s.spin/rate;s.phase-=std::floor(s.phase);}}
 bool active(unsigned osc)const{return states_[osc].enabled>0;}
 bool fullyActive(unsigned osc)const{return states_[osc].enabled==1;}
 double phase(unsigned osc)const{return osc<2?states_[osc].lastPhase:-1;}
 double apply(unsigned osc,double original,const std::array<double,5>&weights,double phase,double step,double width)const{const auto&s=states_[osc];if(s.enabled==0)return original;const double bass=OscBassSource::mix(weights,phase,step,width,s.pose);return s.enabled==1?bass:original+(bass-original)*s.enabled;}
};
static_assert(sizeof(bs_osc_bass_entry)==16&&sizeof(bs_osc_bass_config)==40&&offsetof(bs_osc_bass_config,oscillators)==8,"OSC Bass ABI");
}
#endif
