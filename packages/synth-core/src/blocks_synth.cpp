#include "blocks_synth.h"
#include "fullness.h"
#include "waveforms.h"
#include <limits>
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
 {BS_FULLNESS,"Fullness","ratio",0,1,0,BS_LINEAR},
 {BS_OSC1_WAVE,"Oscillator 1 waveform","waveform",0,4,BS_SAW,BS_DISCRETE},
 {BS_OSC2_WAVE,"Oscillator 2 waveform","waveform",0,4,BS_PULSE,BS_DISCRETE},
 {BS_OSC1_LEVEL,"Oscillator 1 level","linear",0,1,.65f,BS_LINEAR},
 {BS_OSC2_LEVEL,"Oscillator 2 level","linear",0,1,.35f,BS_LINEAR},
 {BS_FILTER_MIX,"Filter mix","ratio",0,1,1,BS_LINEAR},
 {BS_FILTER_AMOUNT,"Filter envelope amount","semitones",-48,48,0,BS_LINEAR},
 {BS_FILTER_ATTACK,"Filter attack","seconds",.001f,5,.005f,BS_LOGARITHMIC},
 {BS_FILTER_DECAY,"Filter decay","seconds",.001f,8,.25f,BS_LOGARITHMIC},
 {BS_FILTER_SUSTAIN,"Filter sustain","linear",0,1,0,BS_LINEAR},
 {BS_FILTER_RELEASE,"Filter release","seconds",.001f,10,.15f,BS_LOGARITHMIC},
 {BS_FILTER_ATTACK_BEND,"Filter attack bend","octaves",-2,2,0,BS_LINEAR},
 {BS_FILTER_DECAY_BEND,"Filter decay bend","octaves",-2,2,0,BS_LINEAR},
 {BS_FILTER_RELEASE_BEND,"Filter release bend","octaves",-2,2,0,BS_LINEAR},
 {BS_SETTLING_CENTS,"Pitch settling","cents",0,20,0,BS_LINEAR},
 {BS_SETTLING_TIME,"Pitch settling time","seconds",.02f,1,.18f,BS_LOGARITHMIC},
 {BS_VELOCITY_MOVEMENT,"Velocity movement","ratio",0,1,0,BS_LINEAR}
};
static_assert(sizeof(bs_event)==24 && offsetof(bs_event,value)==20,"ABI event layout");
static_assert(sizeof(bs_patch)==144,"ABI patch layout");
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
using Weights=std::array<double,5>;
double oscillator(const Weights &weights,double phase,double step,double width) {
 double result=0;
 if(weights[BS_SINE])result+=weights[BS_SINE]*blocks_detail::sine(phase);
 if(weights[BS_TRIANGLE])result+=weights[BS_TRIANGLE]*blocks_detail::triangle(phase,step);
 if(weights[BS_SAW])result+=weights[BS_SAW]*saw(phase,step);
 if(weights[BS_PULSE])result+=weights[BS_PULSE]*pulse(phase,step,width);
 if(weights[BS_SQUARE])result+=weights[BS_SQUARE]*pulse(phase,step,.5);
 return result;
}
double random_signed(uint32_t &state) {
 state^=state<<13; state^=state>>17; state^=state<<5;
 return double(state)/4294967295.0*2-1;
}
enum class Stage { attack,decay,sustain,release };
struct FilterEnvelope {
 Stage stage=Stage::attack;double age=0,level=0,releaseLevel=0;
 double attack=.005,decay=.25,sustain=0,release=.15,attackBend=0,decayBend=0,releaseBend=0;
 void noteOff(){if(stage!=Stage::release){stage=Stage::release;age=0;releaseLevel=level;}}
 double sample(double dt){
  switch(stage){case Stage::attack:level=bend(age/attack,attackBend);break;case Stage::decay:level=1-(1-sustain)*bend(age/decay,decayBend);break;case Stage::sustain:level=sustain;break;case Stage::release:level=releaseLevel*(1-bend(age/release,releaseBend));break;}
  age+=dt;if(stage==Stage::attack&&age>=attack){stage=Stage::decay;age=0;}else if(stage==Stage::decay&&age>=decay){stage=Stage::sustain;age=0;}
  return level;
 }
};
struct Voice {
 bool active=false,held=false,pedal=false; uint32_t channel=0,key=0,rng=1; uint64_t order=0,ordinal=0; uint32_t tailRemaining=0;
 Stage stage=Stage::attack; double phase1=0,phase2=0,age=0,stageAge=0,level=0,releaseLevel=0;
 double frequency=440,velocity=1,filter=0,panLeft=.7071,panRight=.7071;
 double attack=.01,decay=.3,sustain=.6,release=.3,attackBend=0,decayBend=0,releaseBend=0;
 double drop=0,dropTime=.1,dropBend=0,drift=0,driftTarget=0,driftAge=0;
 double settling=0,settlingTime=.18,movementScale=1,rateScale=1;
 FilterEnvelope filterEnvelope;
 blocks_detail::FullnessPath fullness;
};
void release(Voice &voice) {
 if(voice.stage==Stage::release) return;
 voice.stage=Stage::release; voice.stageAge=0; voice.releaseLevel=voice.level; voice.pedal=false;voice.filterEnvelope.noteOff();
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
 std::array<Voice,BS_MAX_VOICES> tails{};
 std::array<std::array<uint64_t,128>,16> onOrdinals{},offOrdinals{};
 std::array<bool,16> pedals{};
 std::array<Weights,2> waveWeights{{Weights{{0,0,1,0,0}},Weights{{0,0,0,1,0}}}};
 uint64_t sequence=0;
 void canonicalMix(){const double total=double(parameters[BS_OSC1_LEVEL])+parameters[BS_OSC2_LEVEL];parameters[BS_OSC_MIX]=total>0?float(parameters[BS_OSC2_LEVEL]/total):.5f;}
 bs_synth() { for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i) parameters[i]=float(smooth[i]=descriptors[i].default_value);canonicalMix(); }
 void reset() { for(unsigned osc=0;osc<2;++osc) {waveWeights[osc]={};waveWeights[osc][unsigned(parameters[BS_OSC1_WAVE+osc])]=1;} voices={}; tails={}; onOrdinals={}; offOrdinals={}; pedals={}; sequence=0; for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i) smooth[i]=parameters[i]; }
 void panic() {voices={};tails={};onOrdinals={};offOrdinals={};pedals={};}
 void on(uint32_t channel,uint32_t key,float velocity) {
  if(channel>=16 || key>127 || !std::isfinite(velocity)) return;
  if(velocity<=0) { off(channel,key); return; }
  if(onOrdinals[channel][key]==std::numeric_limits<uint64_t>::max()||sequence==std::numeric_limits<uint64_t>::max()) {panic();sequence=0;}
  const uint64_t ordinal=++onOrdinals[channel][key];
  Voice *v=nullptr;
  for(auto &candidate:voices) if(!candidate.active) { v=&candidate; break; }
  if(!v) {
   v=&*std::min_element(voices.begin(),voices.end(),[](const Voice&a,const Voice&b){
    const auto rank=[](const Voice &x){return x.stage==Stage::release?0:x.pedal&&!x.held?1:2;};
    const int ar=rank(a),br=rank(b);if(ar!=br)return ar<br;
    if(ar<2&&a.level*a.velocity!=b.level*b.velocity)return a.level*a.velocity<b.level*b.velocity;
    return a.order<b.order;
   });
   // Fixed 3ms snapshots keep a stolen oscillator/filter continuous. If all 16
   // tails are occupied, replace the quietest remaining weighted tail.
   Voice *tail=nullptr;for(auto &candidate:tails)if(!candidate.active){tail=&candidate;break;}
   if(!tail)tail=&*std::min_element(tails.begin(),tails.end(),[](const Voice&a,const Voice&b){return a.level*a.velocity*a.tailRemaining<b.level*b.velocity*b.tailRemaining;});
   *tail=*v;tail->tailRemaining=uint32_t(std::ceil(.003*rate));tail->held=false;
  }
  *v=Voice{}; v->active=v->held=true; v->channel=channel; v->key=key; v->order=++sequence; v->ordinal=ordinal;
  v->frequency=440*std::exp2((double(key)-69)/12); v->velocity=clamp(velocity,0,1);
  const double pan=.5+.15*(double(key%7)/3-1); v->panLeft=std::sqrt(1-pan); v->panRight=std::sqrt(pan);
  v->rng=0x9e3779b9u^uint32_t(sequence*747796405u)^uint32_t((key+channel*128)*2891336453u); if(!v->rng) v->rng=1;
  v->driftTarget=random_signed(v->rng);
  v->attack=parameters[BS_ATTACK]; v->decay=parameters[BS_DECAY]; v->sustain=parameters[BS_SUSTAIN_LEVEL]; v->release=parameters[BS_RELEASE];
  v->attackBend=parameters[BS_ATTACK_BEND]; v->decayBend=parameters[BS_DECAY_BEND]; v->releaseBend=parameters[BS_RELEASE_BEND];
  v->drop=parameters[BS_PITCH_DROP_CENTS]; v->dropTime=parameters[BS_PITCH_DROP_TIME]; v->dropBend=parameters[BS_PITCH_DROP_BEND];
  auto &fe=v->filterEnvelope;fe.attack=parameters[BS_FILTER_ATTACK];fe.decay=parameters[BS_FILTER_DECAY];fe.sustain=parameters[BS_FILTER_SUSTAIN];fe.release=parameters[BS_FILTER_RELEASE];fe.attackBend=parameters[BS_FILTER_ATTACK_BEND];fe.decayBend=parameters[BS_FILTER_DECAY_BEND];fe.releaseBend=parameters[BS_FILTER_RELEASE_BEND];
  v->settlingTime=parameters[BS_SETTLING_TIME];
  if(parameters[BS_SETTLING_CENTS]>0||parameters[BS_VELOCITY_MOVEMENT]>0){
   // Separate stream: never consume the legacy drift RNG. Rates/velocity are
   // note snapshots; drift amount and nominal speed remain live parameters.
   uint32_t movementRng=0x85ebca6bu^uint32_t(sequence*2246822519u)^uint32_t((key+channel*128)*3266489917u);if(!movementRng)movementRng=1;
   v->movementScale=1-parameters[BS_VELOCITY_MOVEMENT]+parameters[BS_VELOCITY_MOVEMENT]*v->velocity;
   v->settling=random_signed(movementRng)*parameters[BS_SETTLING_CENTS]*v->movementScale;
   v->rateScale=1+.2*random_signed(movementRng);
  }
 }
 void off(uint32_t channel,uint32_t key) {
  if(channel>=16||key>=128||offOrdinals[channel][key]>=onOrdinals[channel][key])return;
  const uint64_t ordinal=++offOrdinals[channel][key];
  for(auto &v:voices)if(v.active&&v.held&&v.channel==channel&&v.key==key&&v.ordinal==ordinal) {
   v.held=false;if(pedals[channel])v.pedal=true;else release(v);break;
  }
 }
 void pedal(uint32_t channel,bool down) {
  if(channel>=16) return; pedals[channel]=down;
  if(!down) for(auto &v:voices) if(v.active&&v.channel==channel&&v.pedal&&!v.held) release(v);
 }
 int event(const bs_event &e) {
  if(e.type==BS_PARAMETER) return bs_set_parameter(this,e.parameter_id,e.value)?0:1;
  if(e.type==BS_PANIC) { panic(); return 0; }
  if(e.channel>=16 || !std::isfinite(e.value)) return 1;
  if(e.type==BS_PEDAL) { pedal(e.channel,e.value>=.5f); return 0; }
  if(e.key>127) return 1;
  if(e.type==BS_NOTE_ON) { on(e.channel,e.key,e.value); return 0; }
  if(e.type==BS_NOTE_OFF) { off(e.channel,e.key); return 0; }
  return 1;
 }
 void sample(float &left,float &right) {
  for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i)if(i!=BS_OSC1_WAVE&&i!=BS_OSC2_WAVE) smooth[i]+=smoothing*(parameters[i]-smooth[i]);
  for(unsigned osc=0;osc<2;++osc) {
   const unsigned target=unsigned(parameters[BS_OSC1_WAVE+osc]);double sum=0;
   for(unsigned wave=0;wave<5;++wave) {double &weight=waveWeights[osc][wave];weight+=smoothing*((wave==target?1.:0.)-weight);if(std::abs(weight)<1e-12)weight=0;sum+=weight;}
   if(1-waveWeights[osc][target]<1e-12) {waveWeights[osc]={};waveWeights[osc][target]=1;} else for(auto &weight:waveWeights[osc])weight/=sum;
  }
  const bool legacyWaves=waveWeights[0][BS_SAW]==1 && waveWeights[1][BS_PULSE]==1;
  if(parameters[BS_FULLNESS]==0 && smooth[BS_FULLNESS]<1e-12) smooth[BS_FULLNESS]=0;
  const double cutoff=std::min(smooth[BS_CUTOFF],rate*.45), filterAlpha=1-std::exp(-2*pi*cutoff*dt);
  const double driftSpeed=smooth[BS_DRIFT_HZ], driftAlpha=1-std::exp(-2*pi*driftSpeed*dt);
  const double fullness=smooth[BS_FULLNESS];
  const double level1=smooth[BS_OSC1_LEVEL],level2=smooth[BS_OSC2_LEVEL],w=smooth[BS_PULSE_WIDTH];
  double l=0,r=0;
  for(unsigned voiceIndex=0;voiceIndex<2*BS_MAX_VOICES;++voiceIndex) {
   auto &v=voiceIndex<BS_MAX_VOICES?voices[voiceIndex]:tails[voiceIndex-BS_MAX_VOICES];if(!v.active)continue;
   const double voiceDriftSpeed=driftSpeed*v.rateScale,voiceDriftAlpha=v.rateScale==1?driftAlpha:1-std::exp(-2*pi*voiceDriftSpeed*dt);
   v.driftAge+=dt; if(v.driftAge>=1/voiceDriftSpeed) { v.driftAge-=1/voiceDriftSpeed; v.driftTarget=random_signed(v.rng); }
   v.drift+=voiceDriftAlpha*(v.driftTarget-v.drift);
   const double drop=v.drop*(1-bend(v.age/v.dropTime,v.dropBend));
   const double settling=v.settling!=0?v.settling*std::exp(-4.605170185988092*v.age/v.settlingTime):0;
   const double frequency=v.frequency*std::exp2((v.drift*smooth[BS_DRIFT_CENTS]*v.movementScale+settling+drop)/1200);
   const double step1=clamp(frequency*dt,1e-9,.45),step2=clamp(frequency*std::exp2(smooth[BS_OSC2_DETUNE]/1200)*dt,1e-9,.45);
   const double saw1=saw(v.phase1,step1),pulse2=pulse(v.phase2,step2,smooth[BS_PULSE_WIDTH]);
   const double raw=legacyWaves?level1*saw1+level2*pulse2:level1*oscillator(waveWeights[0],v.phase1,step1,w)+level2*oscillator(waveWeights[1],v.phase2,step2,w);
   v.phase1+=step1; v.phase1-=std::floor(v.phase1); v.phase2+=step2; v.phase2-=std::floor(v.phase2);
   // Keep residual history warm while bypassed. The zero branch retains the
   // legacy dry input and arithmetic exactly; no gain compensation or wet mix.
   const double residual=v.fullness.process(raw,dcPole);
   const double enriched=fullness>0?raw+fullness*residual:raw;
   const double filterEnv=v.filterEnvelope.sample(dt);
   const double voiceAlpha=smooth[BS_FILTER_AMOUNT]==0?filterAlpha:1-std::exp(-2*pi*clamp(smooth[BS_CUTOFF]*std::exp2(smooth[BS_FILTER_AMOUNT]*filterEnv/12),20,rate*.45)*dt);
   v.filter+=voiceAlpha*(enriched-v.filter); if(std::abs(v.filter)<1e-20) v.filter=0;
   double amplitude=envelope(v,dt)*v.velocity;
   if(voiceIndex>=BS_MAX_VOICES) {amplitude*=double(v.tailRemaining)/std::ceil(.003*rate);if(--v.tailRemaining==0)v.active=false;}
   const double filtered=smooth[BS_FILTER_MIX]==1?v.filter:enriched+(v.filter-enriched)*smooth[BS_FILTER_MIX];
   const double dry=std::tanh(filtered*smooth[BS_DRIVE]);
   const double value=dry*amplitude*.25;
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
 const double value=d.mapping==BS_LOGARITHMIC?d.minimum*std::pow(d.maximum/d.minimum,n):d.minimum+(d.maximum-d.minimum)*n;
 return float(d.mapping==BS_DISCRETE?std::round(value):value);
}
float bs_physical_to_normalized(uint32_t id,float physical) {
 if(id>=BS_PARAMETER_COUNT || !std::isfinite(physical)) return 0;
 const auto &d=descriptors[id]; const double bounded=clamp(physical,d.minimum,d.maximum),p=d.mapping==BS_DISCRETE?std::round(bounded):bounded;
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
 const double bounded=clamp(physical,descriptors[id].minimum,descriptors[id].maximum);
 synth->parameters[id]=float(descriptors[id].mapping==BS_DISCRETE?std::round(bounded):bounded);
 if(id==BS_OSC_MIX){synth->parameters[BS_OSC1_LEVEL]=1-synth->parameters[id];synth->parameters[BS_OSC2_LEVEL]=synth->parameters[id];synth->canonicalMix();}
 else if(id==BS_OSC1_LEVEL||id==BS_OSC2_LEVEL)synth->canonicalMix();
 return 1;
}
float bs_get_parameter(const bs_synth *synth,uint32_t id) { return synth&&id<BS_PARAMETER_COUNT?synth->parameters[id]:0; }
int bs_get_patch(const bs_synth *synth,bs_patch *patch) {
 if(!synth||!patch) return 0; patch->version=BS_ABI_VERSION;
 for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i) patch->values[i]=synth->parameters[i]; return 1;
}
int bs_set_patch(bs_synth *synth,const bs_patch *patch) {
 if(!synth||!patch||(patch->version<1||patch->version>BS_ABI_VERSION)) return 0;
 const uint32_t count=patch->version==1?18u:patch->version==2?19u:patch->version==3?21u:BS_PARAMETER_COUNT;
 for(uint32_t i=0;i<count;++i)if(!std::isfinite(patch->values[i]))return 0;
 // Build all canonical targets before changing any current parameter. V4's
 // independent levels win over an inconsistent compatibility Mix field.
 std::array<float,BS_PARAMETER_COUNT> next{};
 for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i){const double value=clamp(i<count?patch->values[i]:descriptors[i].default_value,descriptors[i].minimum,descriptors[i].maximum);next[i]=float(descriptors[i].mapping==BS_DISCRETE?std::round(value):value);}
 if(patch->version<4){next[BS_OSC1_LEVEL]=1-next[BS_OSC_MIX];next[BS_OSC2_LEVEL]=next[BS_OSC_MIX];}
 synth->parameters=next;synth->canonicalMix();
 return 1;
}
void bs_note_on(bs_synth *synth,uint32_t channel,uint32_t key,float velocity) { if(synth) synth->on(channel,key,velocity); }
void bs_note_off(bs_synth *synth,uint32_t channel,uint32_t key) { if(synth&&channel<16&&key<128) synth->off(channel,key); }
void bs_sustain(bs_synth *synth,uint32_t channel,float down) { if(synth&&std::isfinite(down)) synth->pedal(channel,down>=.5f); }
void bs_panic(bs_synth *synth) { if(synth) synth->panic(); }
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
