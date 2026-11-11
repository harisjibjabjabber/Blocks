#ifndef BLOCKS_OSC_BASS_ENGINE_H
#define BLOCKS_OSC_BASS_ENGINE_H
#include "blocks_osc_bass.h"
#include "wave_source.h"
#include "osc_bass_tables.h"
#include "bass_pm_tables.h"
#include <array>
#include <cmath>
#include <cstddef>
#include <algorithm>
namespace blocks_detail {
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

inline bs_osc_bass_config_v2 defaultOscBassV2(){return {2,0,{{0,0,0,0,4,.65f,.35f,.5f,0},{0,0,0,0,4,.65f,.35f,.5f,0}}};}
inline bool validOscBassEntryV2(const bs_osc_bass_entry_v2&e){return (e.enabled<=1&&std::isfinite(e.spin_hz)&&e.spin_hz>=.1f&&e.spin_hz<=20&&std::isfinite(e.motion)&&e.motion>=0&&e.motion<=1&&std::isfinite(e.grit)&&e.grit>=0&&e.grit<=1)&&e.voice<=3&&e.synced<=1&&e.retrigger<=1&&std::isfinite(e.cycle_beats)&&e.cycle_beats>=.03125f&&e.cycle_beats<=64&&std::isfinite(e.curl)&&std::abs(e.curl)<=.8f;}
inline bool validOscBassV2(const bs_osc_bass_config_v2&c){return c.version==2&&c.reserved==0&&validOscBassEntryV2(c.oscillators[0])&&validOscBassEntryV2(c.oscillators[1]);}
inline double bassWarp(double phase,double curl){return std::abs(curl)<1e-10?phase:std::expm1(-curl*phase)/std::expm1(-curl);}
struct BassFrame {OscBassPose rotor;std::array<double,4>voices{{1,0,0,0}};std::array<double,33>harmonics{};double rotation=0;};
inline BassFrame bassFrame(const OscBassPose&pose,const std::array<double,4>&voices,double rotation,double motion,double grit,double frequency,double envelope,double velocity){
 BassFrame f;f.rotor=pose;f.voices=voices;f.rotation=rotation;if(voices[0]==1)return f;
 const double movement=.5+.5*sine(rotation),index=std::clamp((.2+3.5*grit)*8,0.,32.);const unsigned lo=unsigned(index),hi=std::min(32u,lo+1);const double blend=index-lo;
 // Ratio-locked PM spectra are interpolated before evaluation, excluding F0.
 // Lorentzian spectral resonances produce moving formants without an IIR state.
 const double f1=450+750*motion*movement,f2=1100+1500*motion*(1-movement);
 const double breath=std::clamp(envelope,0.,1.)*(.3+.7*std::clamp(velocity,0.,1.));
 std::array<double,4>frayMotion{};if(voices[3]!=0)for(unsigned n=0;n<4;++n)frayMotion[n]=1+.3*motion*sine(rotation*(n+1));
 for(unsigned n=2;n<=32;++n){const double hz=frequency*n;double growl=0,throat=0,fray=0;
  if(voices[1]!=0){const double a=(hz-f1)/(180+120*grit),b=(hz-f2)/(280+180*grit),form=.12+1.1/(1+a*a)+.8/(1+b*b);const double pmA=bassPM[0][lo][n]+blend*(bassPM[0][hi][n]-bassPM[0][lo][n]),pmB=bassPM[1][lo][n]+blend*(bassPM[1][hi][n]-bassPM[1][lo][n]);growl=voices[1]*(.5+grit)*(.65*pmA+.35*pmB)*form;}
  if(voices[2]!=0){const double a=(hz-(320+800*motion*movement))/90,b=(hz-(1600+1100*motion*movement))/160;throat=voices[2]*(.4+grit)*((.06+1.6/(1+a*a)+1.1/(1+b*b))/std::sqrt(double(n)));}
  if(voices[3]!=0){const double pmB=bassPM[1][lo][n]+blend*(bassPM[1][hi][n]-bassPM[1][lo][n]),rough=(n%3==0?-1.:1.)*(.12+.8*grit*breath)/std::sqrt(double(n));fray=voices[3]*(pmB*.5+rough)*(.25+.75*breath)*frayMotion[n%4];}
  f.harmonics[n]=growl+throat+fray;
 }
 return f;
}
inline double bassExpandedMix(const std::array<double,5>&weights,double phase,double step,double width,const BassFrame&f){
 if(f.voices[0]==1)return OscBassSource::mix(weights,phase,step,width,f.rotor);
 double fundamental=0,dc=0;constexpr double sa=-.63661977236758134308,ta=.81056946913870217155;const double sn=sine(phase),cs=sine(phase+.25);
 fundamental=weights[0]*sn+weights[1]*ta*cs+weights[2]*sa*sn;
 for(unsigned wave=3;wave<5;++wave)if(weights[wave]){const double w=wave==4?.5:width;fundamental+=weights[wave]*sa*(sine(phase-w)-sn);dc+=weights[wave]*(2*w-1);}
 const double base=dc+fundamental;double result=f.voices[0]?f.voices[0]*OscBassSource::mix(weights,phase,step,width,f.rotor)+(1-f.voices[0])*base:base;
 double sh=sn,ch=cs;const double allowed=.49/(step*f.rotor.guardScale);
 // Recurrence evaluates only requested partials, with a smooth Nyquist margin.
 for(unsigned n=2;n<=32;++n){const double next=sh*cs+ch*sn;ch=ch*cs-sh*sn;sh=next;const double gate=std::clamp((allowed/n-1)/.04,0.,1.);if(gate==0)break;const double colour=weights[0]+weights[1]*(n%2?.8:.25)+weights[2]+weights[3]*(.35+.65*std::abs(sine(n*width)))+weights[4]*(n%2?1:.2);result+=f.harmonics[n]*sh*gate*gate*(3-2*gate)*colour;}
 return result;
}
class OscBass {
 struct State{double phase=0,lastPhase=0,lastRaw=0,enabled=0,spin=4,motion=.65,grit=.35,curl=0,hz=4;OscBassPose pose;std::array<double,4>voices{{1,0,0,0}};};
 bs_osc_bass_config_v2 requested_=defaultOscBassV2();std::array<State,2>states_{};bool trigger_=false;
 static double toward(double x,double y,double a){const double n=x+a*(y-x);return std::abs(n-y)<1e-12?y:n;}
public:
 bool configure(const bs_osc_bass_config_v2&c){if(!validOscBassV2(c))return false;requested_=c;return true;}
 const bs_osc_bass_config_v2&configV2()const{return requested_;}
 void reset(double rate){trigger_=false;for(unsigned i=0;i<2;++i){auto&s=states_[i];const auto&c=requested_.oscillators[i];s={};s.enabled=c.enabled;s.spin=c.spin_hz;s.motion=c.motion;s.grit=c.grit;s.curl=c.curl;s.voices={};s.voices[c.voice]=1;s.pose=OscBassSource::pose(s.spin,s.motion,s.grit,0,rate);}}
 void noteOn(){trigger_=true;}void cancelRetrigger(){trigger_=false;}
 void tick(double rate,double smoothing,double bpm=120,bool fresh=true){for(unsigned i=0;i<2;++i){auto&s=states_[i];const auto&c=requested_.oscillators[i];s.spin=toward(s.spin,c.spin_hz,smoothing);s.motion=toward(s.motion,c.motion,smoothing);s.grit=toward(s.grit,c.grit,smoothing);s.curl=toward(s.curl,c.curl,smoothing);for(unsigned n=0;n<4;++n)s.voices[n]=toward(s.voices[n],n==c.voice?1:0,smoothing);const double fade=1/(.005*rate);s.enabled=c.enabled>s.enabled?std::min(double(c.enabled),s.enabled+fade):std::max(double(c.enabled),s.enabled-fade);if(trigger_&&fresh&&c.retrigger)s.phase=0;s.hz=c.synced?bpm/(60*c.cycle_beats):s.spin;s.lastRaw=s.phase;s.lastPhase=bassWarp(s.phase,s.curl);if(s.enabled>0)s.pose=OscBassSource::pose(std::min(rate*.02,s.hz*2),s.motion,s.grit,s.lastPhase,rate);if(!c.synced&&s.curl==0)s.pose=OscBassSource::pose(s.spin,s.motion,s.grit,s.lastPhase,rate);s.phase+=s.hz/rate;s.phase-=std::floor(s.phase);}trigger_=false;}
 bool active(unsigned osc)const{return states_[osc].enabled>0;}
 bool fullyActive(unsigned osc)const{return states_[osc].enabled==1;}
 double phase(unsigned osc)const{return osc<2?states_[osc].lastPhase:-1;}
 double rawPhase(unsigned osc)const{return osc<2?states_[osc].lastRaw:-1;}
 double hz(unsigned osc)const{return osc<2?states_[osc].hz:-1;}
 BassFrame frame(unsigned osc,double frequency,double env=1,double velocity=1)const{const auto&s=states_[osc];return bassFrame(s.pose,s.voices,s.lastPhase,s.motion,s.grit,frequency,env,velocity);}
 double applyFrame(unsigned osc,double original,const std::array<double,5>&weights,double phase,double step,double width,const BassFrame&f)const{const auto&s=states_[osc];if(s.enabled==0)return original;const double bass=bassExpandedMix(weights,phase,step,width,f);return s.enabled==1?bass:original+(bass-original)*s.enabled;}
 double apply(unsigned osc,double original,const std::array<double,5>&weights,double phase,double step,double width)const{return applyFrame(osc,original,weights,phase,step,width,frame(osc,step*48000));}
};
static_assert(sizeof(bs_osc_bass_entry_v2)==36&&sizeof(bs_osc_bass_config_v2)==80,"Bass v2 ABI");
}
#endif
