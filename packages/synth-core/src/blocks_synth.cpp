#include "blocks_synth.h"
#include "fullness.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <new>

namespace {
constexpr double pi=3.14159265358979323846;
constexpr bs_parameter_descriptor descriptors[] = {
 {BS_GAIN,"Output","linear",0,1,.3f,BS_LINEAR},
 {BS_OSC_MIX,"Oscillator mix","linear",0,1,.35f,BS_LINEAR},
 {BS_OSC2_DETUNE,"Oscillator 2 detune","cents",-1200,1200,7,BS_LINEAR},
 {BS_PULSE_WIDTH,"Pulse width","ratio",.1f,.9f,.5f,BS_LINEAR},
 {BS_ATTACK,"Attack","seconds",.001f,5,.015f,BS_LOGARITHMIC},
 {BS_DECAY,"Decay","seconds",.001f,8,.3f,BS_LOGARITHMIC},
 {BS_SUSTAIN_LEVEL,"Sustain","linear",0,1,.65f,BS_LINEAR},
 {BS_RELEASE,"Release","seconds",.001f,10,.35f,BS_LOGARITHMIC},
 {BS_ATTACK_BEND,"Attack bend","octaves",-2,2,0,BS_LINEAR},
 {BS_DECAY_BEND,"Decay bend","octaves",-2,2,0,BS_LINEAR},
 {BS_RELEASE_BEND,"Release bend","octaves",-2,2,0,BS_LINEAR},
 {BS_CUTOFF,"Low-pass cutoff","Hz",20,20000,6000,BS_LOGARITHMIC},
 {BS_DRIVE,"Drive","gain",1,12,1,BS_LOGARITHMIC},
 {BS_DRIFT_CENTS,"Pitch drift amount","cents",0,40,0,BS_LINEAR},
 {BS_DRIFT_HZ,"Pitch drift speed","Hz",.05f,10,.5f,BS_LOGARITHMIC},
 {BS_PITCH_DROP_CENTS,"Pitch drop amount","cents",0,2400,0,BS_LINEAR},
 {BS_PITCH_DROP_TIME,"Pitch drop time","seconds",.001f,4,.12f,BS_LOGARITHMIC},
 {BS_PITCH_DROP_BEND,"Pitch drop bend","octaves",-2,2,0,BS_LINEAR},
 {BS_FULLNESS,"Fullness","ratio",0,1,0,BS_LINEAR}
};
static_assert(sizeof(bs_event)==24 && offsetof(bs_event,value)==20,"ABI event layout");
static_assert(sizeof(bs_patch)==80,"ABI patch layout");
double clamp(double x,double lo,double hi) { return std::max(lo,std::min(hi,x)); }
double bend(double progress,double curve) { return std::pow(clamp(progress,0,1),std::exp2(curve)); }
// Original implementation of the standard polynomial band-limited step correction.
double blep(double phase,double dt) {
 if(phase<dt) { const double x=phase/dt; return x+x-x*x-1; }
 if(phase>1-dt) { const double x=(phase-1)/dt; return x*x+x+x+1; }
 return 0;
}
double saw(double phase,double dt) { return 2*phase-1-blep(phase,dt); }
double pulse(double phase,double dt,double width) {
 double shifted=phase-width; if(shifted<0) shifted+=1;
 return (phase<width?1:-1)+blep(phase,dt)-blep(shifted,dt);
}
double random_signed(uint32_t &state) {
 state^=state<<13; state^=state>>17; state^=state<<5;
 return double(state)/4294967295.0*2-1;
}
enum class Stage { attack,decay,sustain,release };
struct Voice {
 bool active=false,held=false,pedal=false; uint32_t channel=0,key=0,rng=1; uint64_t order=0;
 Stage stage=Stage::attack; double phase1=0,phase2=0,age=0,stageAge=0,level=0,releaseLevel=0;
 double frequency=440,velocity=1,filter=0,panLeft=.7071,panRight=.7071,bodyLevel=1;
 double attack=.01,decay=.3,sustain=.6,release=.3,attackBend=0,decayBend=0,releaseBend=0;
 double drop=0,dropTime=.1,dropBend=0,drift=0,driftTarget=0,driftAge=0;
 blocks_detail::FullnessPath fullness;
};
void release(Voice &voice) {
 if(voice.stage==Stage::release) return;
 voice.stage=Stage::release; voice.stageAge=0; voice.releaseLevel=voice.level; voice.pedal=false;
}
double envelope(Voice &v,double dt) {
 // Evaluate at the current sample, then advance: NoteOn has exact zero initial level.
 switch(v.stage) {
 case Stage::attack: v.level=bend(v.stageAge/v.attack,v.attackBend); break;
 case Stage::decay: v.level=1-(1-v.sustain)*bend(v.stageAge/v.decay,v.decayBend); break;
 case Stage::sustain: v.level=v.sustain; break;
 case Stage::release: v.level=v.releaseLevel*(1-bend(v.stageAge/v.release,v.releaseBend)); break;
 }
 v.stageAge+=dt;
 if(v.stage==Stage::attack && v.stageAge>=v.attack) { v.stage=Stage::decay; v.stageAge=0; }
 else if(v.stage==Stage::decay && v.stageAge>=v.decay) { v.stage=Stage::sustain; v.stageAge=0; }
 else if(v.stage==Stage::release && v.stageAge>=v.release) { v.active=false; }
 return v.level;
}
}

struct bs_synth {
 double rate=48000,dt=1.0/48000,smoothing=1-std::exp(-1.0/(.005*48000)),dcPole=std::exp(-2*pi*10/48000);
 std::array<float,BS_PARAMETER_COUNT> parameters{};
 std::array<double,BS_PARAMETER_COUNT> smooth{};
 std::array<Voice,BS_MAX_VOICES> voices{};
 std::array<bool,16> pedals{};
 uint64_t sequence=0;
 bs_synth() { for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i) parameters[i]=float(smooth[i]=descriptors[i].default_value); }
 void reset() { voices={}; pedals={}; sequence=0; for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i) smooth[i]=parameters[i]; }
 void on(uint32_t channel,uint32_t key,float velocity) {
  if(channel>=16 || key>127 || !std::isfinite(velocity)) return;
  if(velocity<=0) { off(channel,key); return; }
  Voice *v=nullptr;
  for(auto &candidate:voices) if(!candidate.active) { v=&candidate; break; }
  if(!v) v=&*std::min_element(voices.begin(),voices.end(),[](const Voice&a,const Voice&b){return a.order<b.order;});
  *v=Voice{}; v->active=v->held=true; v->channel=channel; v->key=key; v->order=++sequence;
  v->frequency=440*std::exp2((double(key)-69)/12); v->velocity=clamp(velocity,0,1);
  v->bodyLevel=1/std::sqrt(1+(v->frequency/3000)*(v->frequency/3000));
  const double pan=.5+.15*(double(key%7)/3-1); v->panLeft=std::sqrt(1-pan); v->panRight=std::sqrt(pan);
  v->rng=0x9e3779b9u^uint32_t(sequence*747796405u)^uint32_t((key+channel*128)*2891336453u); if(!v->rng) v->rng=1;
  v->driftTarget=random_signed(v->rng);
  v->attack=parameters[BS_ATTACK]; v->decay=parameters[BS_DECAY]; v->sustain=parameters[BS_SUSTAIN_LEVEL]; v->release=parameters[BS_RELEASE];
  v->attackBend=parameters[BS_ATTACK_BEND]; v->decayBend=parameters[BS_DECAY_BEND]; v->releaseBend=parameters[BS_RELEASE_BEND];
  v->drop=parameters[BS_PITCH_DROP_CENTS]; v->dropTime=parameters[BS_PITCH_DROP_TIME]; v->dropBend=parameters[BS_PITCH_DROP_BEND];
 }
 void off(uint32_t channel,uint32_t key) {
  Voice *oldest=nullptr;
  for(auto &v:voices) if(v.active&&v.held&&v.channel==channel&&v.key==key&&(!oldest||v.order<oldest->order)) oldest=&v;
  if(oldest) { oldest->held=false; if(pedals[channel]) oldest->pedal=true; else release(*oldest); }
 }
 void pedal(uint32_t channel,bool down) {
  if(channel>=16) return; pedals[channel]=down;
  if(!down) for(auto &v:voices) if(v.active&&v.channel==channel&&v.pedal&&!v.held) release(v);
 }
 int event(const bs_event &e) {
  if(e.type==BS_PARAMETER) return bs_set_parameter(this,e.parameter_id,e.value)?0:1;
  if(e.type==BS_PANIC) { voices={}; pedals={}; return 0; }
  if(e.channel>=16 || !std::isfinite(e.value)) return 1;
  if(e.type==BS_PEDAL) { pedal(e.channel,e.value>=.5f); return 0; }
  if(e.key>127) return 1;
  if(e.type==BS_NOTE_ON) { on(e.channel,e.key,e.value); return 0; }
  if(e.type==BS_NOTE_OFF) { off(e.channel,e.key); return 0; }
  return 1;
 }
 void sample(float &left,float &right) {
  for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i) smooth[i]+=smoothing*(parameters[i]-smooth[i]);
  if(parameters[BS_FULLNESS]==0 && smooth[BS_FULLNESS]<1e-12) smooth[BS_FULLNESS]=0;
  const double cutoff=std::min(smooth[BS_CUTOFF],rate*.45), filterAlpha=1-std::exp(-2*pi*cutoff*dt);
  const double driftSpeed=smooth[BS_DRIFT_HZ], driftAlpha=1-std::exp(-2*pi*driftSpeed*dt);
  const double fullness=smooth[BS_FULLNESS];
  // Four equal one-poles need ~2.299x per-pole cutoff for a combined -3dB
  // corner near the requested cutoff at low frequencies. Clamp below Nyquist.
  const double fatAlpha=fullness>0 ? 1-std::exp(-2*pi*std::min(cutoff*2.298959223,rate*.45)*dt) : 0;
  const double preGain=fullness>0 ? 1.5*std::sqrt(smooth[BS_DRIVE]) : 0;
  const double mix=smooth[BS_OSC_MIX],a=1-mix,w=smooth[BS_PULSE_WIDTH],pulseVariance=4*w*(1-w);
  // Approximate RMS matching from ideal saw/pulse variance and covariance.
  // This avoids rewarding Fullness mainly with gain, including other mix/drive settings.
  const double dryRms=std::sqrt(std::max(1e-6,a*a/3+pulseVariance*(mix*mix-a*mix)));
  const double fatRms=std::sqrt(std::max(1e-6,a*a/3+pulseVariance*(mix*mix+a*mix)));
  const double shapedRms=std::min(1.0,fatRms*preGain);
  const double bodyGain=fullness>0 ? std::tanh(dryRms*smooth[BS_DRIVE])/(shapedRms-shapedRms*shapedRms*shapedRms/3) : 0;
  double l=0,r=0;
  for(auto &v:voices) if(v.active) {
   v.driftAge+=dt; if(v.driftAge>=1/driftSpeed) { v.driftAge-=1/driftSpeed; v.driftTarget=random_signed(v.rng); }
   v.drift+=driftAlpha*(v.driftTarget-v.drift);
   const double drop=v.drop*(1-bend(v.age/v.dropTime,v.dropBend));
   const double frequency=v.frequency*std::exp2((v.drift*smooth[BS_DRIFT_CENTS]+drop)/1200);
   const double step1=clamp(frequency*dt,1e-9,.45),step2=clamp(frequency*std::exp2(smooth[BS_OSC2_DETUNE]/1200)*dt,1e-9,.45);
   const double saw1=saw(v.phase1,step1),pulse2=pulse(v.phase2,step2,smooth[BS_PULSE_WIDTH]);
   const double raw=(1-mix)*saw1+mix*pulse2;
   // These waveforms have opposite fundamental polarity at equal phase.
   // Only the Fullness path aligns them; the legacy dry mix stays untouched.
   const double fatRaw=(1-mix)*saw1-mix*pulse2;
   v.phase1+=step1; v.phase1-=std::floor(v.phase1); v.phase2+=step2; v.phase2-=std::floor(v.phase2);
   v.filter+=filterAlpha*(raw-v.filter); if(std::abs(v.filter)<1e-20) v.filter=0;
   const double amplitude=envelope(v,dt)*v.velocity;
   const double dry=std::tanh(v.filter*smooth[BS_DRIVE]);
   // The zero branch retains the v1 signal path and operation order exactly.
   const double body=fullness>0 ? bodyGain*v.bodyLevel*v.fullness.process(fatRaw,preGain,fatAlpha,dcPole) : 0;
   const double value=(fullness>0 ? dry+(body-dry)*fullness : dry)*amplitude*.25;
   l+=value*v.panLeft; r+=value*v.panRight; v.age+=dt;
  }
  left=float(std::tanh(l)*smooth[BS_GAIN]); right=float(std::tanh(r)*smooth[BS_GAIN]);
 }
};

extern "C" {
uint32_t bs_abi_version(void) { return BS_ABI_VERSION; }
uint32_t bs_parameter_count(void) { return BS_PARAMETER_COUNT; }
const bs_parameter_descriptor *bs_parameter_info(uint32_t id) { return id<BS_PARAMETER_COUNT?&descriptors[id]:nullptr; }
float bs_normalized_to_physical(uint32_t id,float normalized) {
 if(id>=BS_PARAMETER_COUNT || !std::isfinite(normalized)) return 0;
 const auto &d=descriptors[id]; const double n=clamp(normalized,0,1);
 return float(d.mapping==BS_LOGARITHMIC?d.minimum*std::pow(d.maximum/d.minimum,n):d.minimum+(d.maximum-d.minimum)*n);
}
float bs_physical_to_normalized(uint32_t id,float physical) {
 if(id>=BS_PARAMETER_COUNT || !std::isfinite(physical)) return 0;
 const auto &d=descriptors[id]; const double p=clamp(physical,d.minimum,d.maximum);
 return float(d.mapping==BS_LOGARITHMIC?std::log(p/d.minimum)/std::log(d.maximum/d.minimum):(p-d.minimum)/(d.maximum-d.minimum));
}
bs_synth *bs_create(void) { return new(std::nothrow) bs_synth; }
void bs_destroy(bs_synth *synth) { delete synth; }
int bs_prepare(bs_synth *synth,double rate) {
 if(!synth||!std::isfinite(rate)||rate<8000||rate>384000) return 0;
 synth->rate=rate; synth->dt=1/rate; synth->smoothing=1-std::exp(-1/(.005*rate)); synth->dcPole=std::exp(-2*pi*10/rate); synth->reset(); return 1;
}
void bs_reset(bs_synth *synth) { if(synth) synth->reset(); }
int bs_set_parameter(bs_synth *synth,uint32_t id,float physical) {
 if(!synth||id>=BS_PARAMETER_COUNT||!std::isfinite(physical)) return 0;
 synth->parameters[id]=float(clamp(physical,descriptors[id].minimum,descriptors[id].maximum)); return 1;
}
float bs_get_parameter(const bs_synth *synth,uint32_t id) { return synth&&id<BS_PARAMETER_COUNT?synth->parameters[id]:0; }
int bs_get_patch(const bs_synth *synth,bs_patch *patch) {
 if(!synth||!patch) return 0; patch->version=BS_ABI_VERSION;
 for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i) patch->values[i]=synth->parameters[i]; return 1;
}
int bs_set_patch(bs_synth *synth,const bs_patch *patch) {
 if(!synth||!patch||(patch->version!=BS_ABI_VERSION&&patch->version!=1)) return 0;
 const uint32_t count=patch->version==1 ? 18u : BS_PARAMETER_COUNT;
 for(uint32_t i=0;i<count;++i) if(!std::isfinite(patch->values[i])) return 0;
 for(uint32_t i=0;i<count;++i) bs_set_parameter(synth,i,patch->values[i]);
 if(patch->version==1) bs_set_parameter(synth,BS_FULLNESS,0);
 return 1;
}
void bs_note_on(bs_synth *synth,uint32_t channel,uint32_t key,float velocity) { if(synth) synth->on(channel,key,velocity); }
void bs_note_off(bs_synth *synth,uint32_t channel,uint32_t key) { if(synth&&channel<16&&key<128) synth->off(channel,key); }
void bs_sustain(bs_synth *synth,uint32_t channel,float down) { if(synth&&std::isfinite(down)) synth->pedal(channel,down>=.5f); }
void bs_panic(bs_synth *synth) { if(synth) { synth->voices={}; synth->pedals={}; } }
uint32_t bs_active_voices(const bs_synth *synth) { uint32_t count=0; if(synth) for(const auto&v:synth->voices) if(v.active) ++count; return count; }
int bs_render(bs_synth *synth,float *left,float *right,uint32_t frames,const bs_event *events,uint32_t count) {
 if(!synth||!left||!right||left==right) return -1;
 bool valid=events||count==0;
 if(valid) for(uint32_t i=0;i<count;++i) if(events[i].sample_offset>=frames||(i&&events[i].sample_offset<events[i-1].sample_offset)) { valid=false; break; }
 if(!valid) { std::fill_n(left,frames,0); std::fill_n(right,frames,0); return -1; }
 uint32_t cursor=0; int rejected=0;
 for(uint32_t frame=0;frame<frames;++frame) {
  while(cursor<count&&events[cursor].sample_offset==frame) rejected+=synth->event(events[cursor++]);
  synth->sample(left[frame],right[frame]);
 }
 return rejected;
}
}
