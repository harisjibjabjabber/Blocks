#include "blocks_synth.h"
#include "audio_rack.h"
#include "note_rack.h"
#include "motion_response.h"
#include "free_drift.h"
#include "resonant_filter.h"
#include "waveforms.h"
#include "performance.h"
#include "modulation.h"
#include "unison.h"
#include "stereo_delay.h"
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
 {BS_DRIFT_CENTS,"Pitch drift amount","cents",0,120,0,BS_LINEAR},
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
 {BS_SETTLING_CENTS,"Pitch settling","cents",0,80,0,BS_LINEAR},
 {BS_SETTLING_TIME,"Pitch settling time","seconds",.02f,1,.18f,BS_LOGARITHMIC},
 {BS_VELOCITY_MOVEMENT,"Velocity movement","ratio",0,1,0,BS_LINEAR},
 {BS_ENVELOPE_RESPONSE,"Envelope response","ratio",0,1,1,BS_LINEAR},
 {BS_DRIVE_ENABLED,"Drive enabled","switch",0,1,1,BS_DISCRETE},
 {BS_PITCH_DROP_ENABLED,"Pitch drop enabled","switch",0,1,1,BS_DISCRETE},
 {BS_SAUCE_ORDER,"Audio block order","order",0,1,0,BS_DISCRETE},
 {BS_FULLNESS_ENABLED,"Fullness enabled","switch",0,1,1,BS_DISCRETE},
 {BS_GLIDE_ENABLED,"Glide enabled","switch",0,1,0,BS_DISCRETE},
 {BS_GLIDE_TIME,"Glide time","seconds",0,2,.08f,BS_LINEAR},
 {BS_FILTER_RESONANCE,"Filter resonance","ratio",0,1,0,BS_LINEAR},
 {BS_FILTER_MODE,"Filter mode","mode",0,1,0,BS_DISCRETE}
};
static_assert(sizeof(bs_event)==24 && offsetof(bs_event,value)==20,"ABI event layout");
static_assert(sizeof(bs_patch)==180,"ABI patch layout");
static_assert(sizeof(bs_performance_config)==48&&offsetof(bs_performance_config,bpm)==28,"performance layout");
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
struct DropRecipe {double amount=0,time=.12,bend=0;bool primary=false;};
struct Voice {
 unsigned unisonCount=1;std::array<double,BS_MAX_UNISON>unisonPhase1{},unisonPhase2{};
 double rightFilter=0;blocks_detail::ResonantFilter rightResonant;blocks_detail::AudioRack rightSauce;
 bool active=false,held=false,pedal=false; uint32_t channel=0,key=0,rng=1; uint64_t order=0,ordinal=0; uint32_t tailRemaining=0;
 Stage stage=Stage::attack; double phase1=0,phase2=0,age=0,stageAge=0,level=0,releaseLevel=0;
 double frequency=440,velocity=1,filter=0,panLeft=.7071,panRight=.7071;
 double attack=.01,decay=.3,sustain=.6,release=.3,attackBend=0,decayBend=0,releaseBend=0;
 double drop=0,dropTime=.1,dropBend=0,drift=0,driftTarget=0,driftAge=0;
 double settling=0,settlingTime=.18,movementScale=1,rateScale=1;
 FilterEnvelope filterEnvelope;
 blocks_detail::ResonantFilter resonant;
 blocks_detail::AudioRack sauce;
 double motionShortness=0,settlingLimit=0;
 double glideStartFrequency=0,glideDuration=0,lastFrequency=440;
 std::array<DropRecipe,BS_NOTES_CAPACITY>drops{};unsigned dropCount=0;
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
 std::array<double,BS_PARAMETER_COUNT> smooth{},modulationSmooth{},modulationLogSpan{};
 std::array<Voice,BS_MAX_VOICES> voices{};
 std::array<Voice,BS_MAX_VOICES> tails{};
 std::array<std::array<uint64_t,128>,16> onOrdinals{},offOrdinals{};
 std::array<bool,16> pedals{};
 std::array<Weights,2> waveWeights{{Weights{{0,0,1,0,0}},Weights{{0,0,0,1,0}}}};
 uint64_t sequence=0;
 blocks_detail::Performance performance;
 blocks_detail::Modulation modulation;
 blocks_detail::Unison unison;
 blocks_detail::StereoDelay delay;
 bs_sauce_config sauceConfig{BS_SAUCE_VERSION,0,{}};
 blocks_detail::NoteRack noteRack;blocks_detail::Performance finalMono;
 bs_performance_config requestedPerformance=blocks_detail::defaultPerformance();bool notesExplicit=false;
 double driftPhase=0,filterBlend=0;
 float stereoWidth=1;double stereoWidthSmooth=1;
 blocks_detail::ResonantCoefficients resonantCoefficients;
 void canonicalMix(){const double total=double(parameters[BS_OSC1_LEVEL])+parameters[BS_OSC2_LEVEL];parameters[BS_OSC_MIX]=total>0?float(parameters[BS_OSC2_LEVEL]/total):.5f;}
 bs_synth() {
  for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i)parameters[i]=float(smooth[i]=descriptors[i].default_value);canonicalMix();
  for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i)if(descriptors[i].mapping==BS_LOGARITHMIC)modulationLogSpan[i]=std::log(double(descriptors[i].maximum)/descriptors[i].minimum);
  performance.bind({this,[](void*c,uint32_t ch,uint32_t key,float velocity,bool mono,bool legato){auto*s=static_cast<bs_synth*>(c);if(s->notesExplicit)s->noteRack.on(ch,key,velocity);else s->emitVoice(ch,key,velocity,mono,legato);},[](void*c,uint32_t ch,uint32_t key){auto*s=static_cast<bs_synth*>(c);if(s->notesExplicit)s->noteRack.off(ch,key);else s->voiceOff(ch,key);}});
  finalMono.bind({this,[](void*c,uint32_t ch,uint32_t key,float velocity,bool mono,bool legato){static_cast<bs_synth*>(c)->emitVoice(ch,key,velocity,mono,legato);},[](void*c,uint32_t ch,uint32_t key){static_cast<bs_synth*>(c)->voiceOff(ch,key);}});
  noteRack.bind({this,[](void*c,uint32_t ch,uint32_t key,float velocity){auto*s=static_cast<bs_synth*>(c);if(s->requestedPerformance.mono)s->finalMono.on(ch,key,velocity);else s->voiceOn(ch,key,velocity);},[](void*c,uint32_t ch,uint32_t key){auto*s=static_cast<bs_synth*>(c);if(s->requestedPerformance.mono)s->finalMono.off(ch,key);else s->voiceOff(ch,key);},[](void*c,uint32_t ch,bool down){auto*s=static_cast<bs_synth*>(c);if(s->requestedPerformance.mono)s->finalMono.pedal(ch,down);else s->voicePedal(ch,down);},[](void*c){static_cast<bs_synth*>(c)->clearOutputs();}});
 }
 void clearOutputs(){delay.clear();modulation.cancelRetrigger();for(auto&v:voices)v=Voice{};for(auto&v:tails)v=Voice{};onOrdinals={};offOrdinals={};pedals={};finalMono.clear();}
 void emitVoice(uint32_t channel,uint32_t key,float velocity,bool mono,bool legato){double previous=0;if(mono&&legato&&parameters[BS_GLIDE_ENABLED]&&parameters[BS_GLIDE_TIME]>0){uint64_t newest=0;for(const auto&v:voices)if(v.active&&(v.stage!=Stage::release||v.stageAge==0)&&v.order>newest){previous=v.lastFrequency;newest=v.order;}}const double duration=previous>0?smooth[BS_GLIDE_TIME]:0;if(mono)for(auto&v:voices)if(v.active)retire(v);voiceOn(channel,key,velocity,previous,duration);}
 int setNotes(const bs_notes_config&config){if(!blocks_detail::NoteRack::valid(config))return 0;bool topology=!notesExplicit||config.count!=noteRack.config().count;for(unsigned i=0;i<config.count&&!topology;++i){const auto&a=config.blocks[i];const auto&b=noteRack.config().blocks[i];topology=a.id!=b.id||a.type!=b.type||a.enabled!=b.enabled;}if(topology)performance.clear();if(!notesExplicit){clearOutputs();notesExplicit=true;auto legacy=requestedPerformance;legacy.mono=0;performance.configure(legacy);auto mono=blocks_detail::defaultPerformance();mono.mono=requestedPerformance.mono;finalMono.configure(mono);}return noteRack.configure(config,rate);}
 int setSauce(const bs_sauce_config&config){if(!blocks_detail::AudioRack::valid(config))return 0;sauceConfig=config;int drive=-1,fullness=-1;for(unsigned i=0;i<config.count;++i)if(config.blocks[i].primary){if(config.blocks[i].type==BS_SAUCE_DRIVE)drive=int(i);else fullness=int(i);}if(drive>=0&&fullness>=0)parameters[BS_SAUCE_ORDER]=drive<fullness?0:1;for(auto&v:voices)if(v.active){v.sauce.configure(config,rate,false,true);if(v.unisonCount>1)v.rightSauce.configure(config,rate,false,true);}for(auto&v:tails)if(v.active){v.sauce.configure(config,rate,false,true);if(v.unisonCount>1)v.rightSauce.configure(config,rate,false,true);}return 1;}
 void reorderPrimary(bool reverse){auto next=sauceConfig;int drive=-1,fullness=-1;for(unsigned i=0;i<next.count;++i)if(next.blocks[i].primary){if(next.blocks[i].type==BS_SAUCE_DRIVE)drive=int(i);else fullness=int(i);}if(drive>=0&&fullness>=0&&((drive>fullness)!=reverse)){std::swap(next.blocks[unsigned(drive)],next.blocks[unsigned(fullness)]);setSauce(next);}}
 void reset() { delay.clear();unison.reset();stereoWidthSmooth=stereoWidth; for(unsigned osc=0;osc<2;++osc) {waveWeights[osc]={};waveWeights[osc][unsigned(parameters[BS_OSC1_WAVE+osc])]=1;} for(auto&v:voices)v=Voice{};for(auto&v:tails)v=Voice{}; onOrdinals={}; offOrdinals={}; pedals={}; sequence=0;driftPhase=0;filterBlend=parameters[BS_FILTER_MODE];modulation.reset();modulationSmooth={};performance.prepare(rate);noteRack.prepare(rate);finalMono.prepare(rate); for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i) smooth[i]=parameters[i]; }
 void panic() {performance.clear();noteRack.clear();clearOutputs();}
 void retire(Voice&v){
  Voice*tail=nullptr;for(auto&candidate:tails)if(!candidate.active){tail=&candidate;break;}
  if(!tail)tail=&*std::min_element(tails.begin(),tails.end(),[](const Voice&a,const Voice&b){return a.level*a.velocity*a.tailRemaining<b.level*b.velocity*b.tailRemaining;});
  *tail=v;tail->tailRemaining=uint32_t(std::ceil(.003*rate));tail->held=false;v.active=false;
 }
 void on(uint32_t channel,uint32_t key,float velocity){if(performance.enabled())performance.on(channel,key,velocity);else if(notesExplicit)noteRack.on(channel,key,velocity);else voiceOn(channel,key,velocity);}
 void off(uint32_t channel,uint32_t key){if(performance.enabled())performance.off(channel,key);else if(notesExplicit)noteRack.off(channel,key);else voiceOff(channel,key);}
 void pedal(uint32_t channel,bool down){if(performance.enabled())performance.pedal(channel,down);else if(notesExplicit)noteRack.pedal(channel,down);else voicePedal(channel,down);}
 int setPerformance(const bs_performance_config&config){if(!blocks_detail::Performance::valid(config))return 0;if(requestedPerformance.mode!=config.mode||requestedPerformance.mono!=config.mono)panic();requestedPerformance=config;auto legacy=config;if(notesExplicit)legacy.mono=0;performance.configure(legacy);auto mono=blocks_detail::defaultPerformance();mono.mono=config.mono;finalMono.configure(mono);return 1;}
 void voiceOn(uint32_t channel,uint32_t key,float velocity,double previousFrequency=0,double glideDuration=0) {
  if(channel>=16 || key>127 || !std::isfinite(velocity)) return;
  if(velocity<=0) { voiceOff(channel,key); return; }
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
   retire(*v);
  }
  *v=Voice{};v->unisonCount=unison.config().count;v->sauce.configure(sauceConfig,rate,true,true);if(v->unisonCount>1)v->rightSauce.configure(sauceConfig,rate,true,true); v->active=v->held=true; v->channel=channel; v->key=key; v->order=++sequence; v->ordinal=ordinal;
  blocks_detail::Unison::startPhases(sequence,key,channel,v->unisonCount,v->unisonPhase1,v->unisonPhase2);
  v->frequency=440*std::exp2((double(key)-69)/12);v->lastFrequency=v->frequency;v->glideStartFrequency=previousFrequency;v->glideDuration=glideDuration; v->velocity=clamp(velocity,0,1);
  const double pan=.5+.15*(double(key%7)/3-1); v->panLeft=std::sqrt(1-pan); v->panRight=std::sqrt(pan);
  v->rng=0x9e3779b9u^uint32_t(sequence*747796405u)^uint32_t((key+channel*128)*2891336453u); if(!v->rng) v->rng=1;
  v->driftTarget=random_signed(v->rng);
  v->attack=parameters[BS_ATTACK]; v->decay=parameters[BS_DECAY]; v->sustain=parameters[BS_SUSTAIN_LEVEL]; v->release=parameters[BS_RELEASE];
  v->attackBend=parameters[BS_ATTACK_BEND]; v->decayBend=parameters[BS_DECAY_BEND]; v->releaseBend=parameters[BS_RELEASE_BEND];
  v->drop=notesExplicit?0:parameters[BS_PITCH_DROP_CENTS]; v->dropTime=parameters[BS_PITCH_DROP_TIME]; v->dropBend=parameters[BS_PITCH_DROP_BEND];
  if(notesExplicit)for(unsigned i=0;i<noteRack.config().count;++i){const auto&b=noteRack.config().blocks[i];if(b.type!=BS_NOTE_DROP||(!b.enabled&&!b.primary))continue;if(b.primary)v->drop=0;auto&e=v->drops[v->dropCount++];e.primary=b.primary!=0;e.amount=b.primary?parameters[BS_PITCH_DROP_CENTS]:b.drop_amount;e.time=b.primary?parameters[BS_PITCH_DROP_TIME]:b.drop_time;e.bend=b.primary?parameters[BS_PITCH_DROP_BEND]:b.drop_bend;}
  auto &fe=v->filterEnvelope;fe.attack=parameters[BS_FILTER_ATTACK];fe.decay=parameters[BS_FILTER_DECAY];fe.sustain=parameters[BS_FILTER_SUSTAIN];fe.release=parameters[BS_FILTER_RELEASE];fe.attackBend=parameters[BS_FILTER_ATTACK_BEND];fe.decayBend=parameters[BS_FILTER_DECAY_BEND];fe.releaseBend=parameters[BS_FILTER_RELEASE_BEND];
  v->settlingTime=parameters[BS_SETTLING_TIME];v->settlingLimit=parameters[BS_SETTLING_CENTS];
  if(parameters[BS_ENVELOPE_RESPONSE]>0&&(parameters[BS_DRIFT_CENTS]>29.8f||v->settlingLimit>8.9))v->motionShortness=blocks_detail::motionShortness(v->attack,v->decay,v->sustain,v->release,v->attackBend,v->decayBend,v->releaseBend);
  if(parameters[BS_SETTLING_CENTS]>0||parameters[BS_VELOCITY_MOVEMENT]>0){
   // Separate stream: never consume the legacy drift RNG. Rates/velocity are
   // note snapshots; drift amount and nominal speed remain live parameters.
   uint32_t movementRng=0x85ebca6bu^uint32_t(sequence*2246822519u)^uint32_t((key+channel*128)*3266489917u);if(!movementRng)movementRng=1;
   v->movementScale=1-parameters[BS_VELOCITY_MOVEMENT]+parameters[BS_VELOCITY_MOVEMENT]*v->velocity;
   v->settling=random_signed(movementRng)*parameters[BS_SETTLING_CENTS]*v->movementScale;
   v->rateScale=1+.2*random_signed(movementRng);
  }
  modulation.noteOn();
 }
 void voiceOff(uint32_t channel,uint32_t key) {
  if(channel>=16||key>=128||offOrdinals[channel][key]>=onOrdinals[channel][key])return;
  const uint64_t ordinal=++offOrdinals[channel][key];
  for(auto &v:voices)if(v.active&&v.held&&v.channel==channel&&v.key==key&&v.ordinal==ordinal) {
   v.held=false;if(pedals[channel])v.pedal=true;else release(v);break;
  }
 }
 void voicePedal(uint32_t channel,bool down) {
  if(channel>=16) return; pedals[channel]=down;
  if(!down) for(auto &v:voices) if(v.active&&v.channel==channel&&v.pedal&&!v.held) release(v);
 }
 int event(const bs_event &e) {
  if(e.type==BS_STEREO_WIDTH)return bs_set_stereo_width(this,e.value)?0:1;
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
  unison.tick(smoothing);
  stereoWidthSmooth+=(double(stereoWidth)-stereoWidthSmooth)*smoothing;
  if(std::abs(stereoWidthSmooth-stereoWidth)<1e-12)stereoWidthSmooth=stereoWidth;
  performance.tick();if(notesExplicit){noteRack.tick();finalMono.tick();}
  // A same-sample NoteOff/panic can cancel an attack before it sounds. Only
  // fresh primary voices still held/sustained at this sample trigger the LFOs.
  if(modulation.retriggerPending()){bool fresh=false;for(const auto&v:voices)fresh|=v.active&&v.age==0&&(v.held||v.pedal);if(!fresh)modulation.cancelRetrigger();}
  for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i)if(i!=BS_OSC1_WAVE&&i!=BS_OSC2_WAVE&&i!=BS_FILTER_MODE) smooth[i]+=smoothing*(parameters[i]-smooth[i]);
  for(unsigned osc=0;osc<2;++osc) {
   const unsigned target=unsigned(parameters[BS_OSC1_WAVE+osc]);double sum=0;
   for(unsigned wave=0;wave<5;++wave) {double &weight=waveWeights[osc][wave];weight+=smoothing*((wave==target?1.:0.)-weight);if(std::abs(weight)<1e-12)weight=0;sum+=weight;}
   if(1-waveWeights[osc][target]<1e-12) {waveWeights[osc]={};waveWeights[osc][target]=1;} else for(auto &weight:waveWeights[osc])weight/=sum;
  }
  const bool legacyWaves=waveWeights[0][BS_SAW]==1 && waveWeights[1][BS_PULSE]==1;
  if(parameters[BS_FULLNESS]==0 && smooth[BS_FULLNESS]<1e-12) smooth[BS_FULLNESS]=0;
  const auto offsets=modulation.tick(rate,performance.tempo());
  blocks_detail::AudioRack::Modulation sauceModulation;
  sauceModulation.count=modulation.sauceCount_;
  for(unsigned i=0;i<sauceModulation.count;++i)sauceModulation.offsets[i]={modulation.sauceOffsets_[i].id,modulation.sauceOffsets_[i].value};
  const auto*sauceModulationPtr=sauceModulation.count?&sauceModulation:nullptr;
  auto effective=smooth;
  for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i){
   double&offset=modulationSmooth[i];offset+=smoothing*(offsets[i]-offset);
   if(offsets[i]==0&&std::abs(offset)<1e-12)offset=0;
   if(offset!=0){const auto&d=descriptors[i];effective[i]=clamp(d.mapping==BS_LOGARITHMIC?smooth[i]*std::exp(modulationLogSpan[i]*offset):smooth[i]+(d.maximum-d.minimum)*offset,d.minimum,d.maximum);}
  }
  const double cutoff=std::min(effective[BS_CUTOFF],rate*.45), filterAlpha=1-std::exp(-2*pi*cutoff*dt);
  // Linear10ms transition. The one-pole stays warm throughout so returning
  // to Soft restores its exact uninterrupted history. Dormant SVF states clear;
  // entering Resonant starts cold under the fade, rapid retargets keep state.
  const double filterTarget=parameters[BS_FILTER_MODE],filterStep=dt/.01;
  filterBlend=filterTarget>filterBlend?std::min(filterTarget,filterBlend+filterStep):std::max(filterTarget,filterBlend-filterStep);
  const bool resonantActive=filterBlend>0;
  const double damping=resonantActive?1/blocks_detail::ResonantCoefficients::q(effective[BS_FILTER_RESONANCE]):1;
  if(resonantActive)resonantCoefficients.set(cutoff,damping,rate);
  const double driftSpeed=effective[BS_DRIFT_HZ],motionPhase=driftPhase;driftPhase+=driftSpeed*dt;
  const double fullness=effective[BS_FULLNESS],bodyAlpha=1-std::exp(-2*pi*180*dt);
  const double level1=effective[BS_OSC1_LEVEL],level2=effective[BS_OSC2_LEVEL],w=effective[BS_PULSE_WIDTH];
  double l=0,r=0;
  for(unsigned voiceIndex=0;voiceIndex<2*BS_MAX_VOICES;++voiceIndex) {
   auto &v=voiceIndex<BS_MAX_VOICES?voices[voiceIndex]:tails[voiceIndex-BS_MAX_VOICES];if(!v.active)continue;
   v.drift=blocks_detail::freeDrift(motionPhase,v.channel,v.key);
   double drop=v.drop*(1-bend(v.age/v.dropTime,v.dropBend))*effective[BS_PITCH_DROP_ENABLED];for(unsigned i=0;i<v.dropCount;++i){const auto&e=v.drops[i];drop+=e.amount*(1-bend(v.age/e.time,e.bend))*(e.primary?effective[BS_PITCH_DROP_ENABLED]:1);}
   const double response=effective[BS_ENVELOPE_RESPONSE];
   const double budget=blocks_detail::settlingAllowance(v.settlingLimit,v.motionShortness),scale=v.settlingLimit>0?budget/v.settlingLimit:1;
   const double settlingTime=response>0?v.settlingTime+response*(blocks_detail::settlingResponseTime(v.settlingTime,v.settlingLimit,v.motionShortness)-v.settlingTime):v.settlingTime;
   const double settling=v.settling!=0?v.settling*(response>0?1+response*(scale-1):1)*std::exp(-4.605170185988092*v.age/settlingTime):0;
   const double driftDepth=response>0?effective[BS_DRIFT_CENTS]+response*(blocks_detail::responsiveDrift(effective[BS_DRIFT_CENTS],v.motionShortness,v.age)-effective[BS_DRIFT_CENTS]):effective[BS_DRIFT_CENTS];
   const double destination=v.frequency*std::exp2((v.drift*driftDepth*v.movementScale+settling+drop)/1200);
   const double frequency=v.glideStartFrequency>0&&v.glideDuration>0&&v.age<v.glideDuration?std::exp2(std::log2(v.glideStartFrequency)+(std::log2(destination)-std::log2(v.glideStartFrequency))*(v.age/v.glideDuration)):destination;
   v.lastFrequency=frequency;
   double raw=0,rawRight=0;
   if(v.unisonCount==1){
    const double step1=clamp(frequency*dt,1e-9,.45),step2=clamp(frequency*std::exp2(effective[BS_OSC2_DETUNE]/1200)*dt,1e-9,.45);
    const double saw1=saw(v.phase1,step1),pulse2=pulse(v.phase2,step2,effective[BS_PULSE_WIDTH]);
    raw=legacyWaves?level1*saw1+level2*pulse2:level1*oscillator(waveWeights[0],v.phase1,step1,w)+level2*oscillator(waveWeights[1],v.phase2,step2,w);
    v.phase1+=step1;v.phase1-=std::floor(v.phase1);v.phase2+=step2;v.phase2-=std::floor(v.phase2);
   }else{
    const double oscillator2Ratio=std::exp2(effective[BS_OSC2_DETUNE]/1200);
    for(unsigned copy=0;copy<v.unisonCount;++copy){const auto&u=unison.copies[v.unisonCount][copy];auto&p1=v.unisonPhase1[copy];auto&p2=v.unisonPhase2[copy];const double step1=clamp(frequency*u.ratio*dt,1e-9,.45),step2=clamp(frequency*u.ratio*oscillator2Ratio*dt,1e-9,.45);
     const double value=legacyWaves?level1*saw(p1,step1)+level2*pulse(p2,step2,w):level1*oscillator(waveWeights[0],p1,step1,w)+level2*oscillator(waveWeights[1],p2,step2,w);
     raw+=value*u.left;rawRight+=value*u.right;p1+=step1;p1-=std::floor(p1);p2+=step2;p2-=std::floor(p2);
    }
   }
   const double enriched=raw;
   const double filterEnv=v.filterEnvelope.sample(dt);
   const double voiceAlpha=effective[BS_FILTER_AMOUNT]==0?filterAlpha:1-std::exp(-2*pi*clamp(effective[BS_CUTOFF]*std::exp2(effective[BS_FILTER_AMOUNT]*filterEnv/12),20,rate*.45)*dt);
   v.filter+=voiceAlpha*(enriched-v.filter); if(std::abs(v.filter)<1e-20) v.filter=0;
   double tone=v.filter;
   if(resonantActive){
    const auto*coefficients=&resonantCoefficients;
    if(effective[BS_FILTER_AMOUNT]!=0){v.resonant.coefficients.set(clamp(effective[BS_CUTOFF]*std::exp2(effective[BS_FILTER_AMOUNT]*filterEnv/12),20,rate*.45),damping,rate);coefficients=&v.resonant.coefficients;}
    const double lp=v.resonant.process(enriched,*coefficients);
    tone=filterBlend==1?lp:v.filter+(lp-v.filter)*filterBlend;
   }else v.resonant.clear();
   double amplitude=envelope(v,dt)*v.velocity;
   if(voiceIndex>=BS_MAX_VOICES) {amplitude*=double(v.tailRemaining)/std::ceil(.003*rate);if(--v.tailRemaining==0)v.active=false;}
   const double filtered=effective[BS_FILTER_MIX]==1?tone:enriched+(tone-enriched)*effective[BS_FILTER_MIX];
   const double dry=v.sauce.process(filtered,effective[BS_DRIVE],fullness,effective[BS_DRIVE_ENABLED],effective[BS_FULLNESS_ENABLED],dcPole,bodyAlpha,effective[BS_SAUCE_ORDER],sauceModulationPtr);
   const double value=dry*amplitude*.25;
   l+=value*v.panLeft;
   if(v.unisonCount==1)r+=value*v.panRight;
   else{
    v.rightFilter+=voiceAlpha*(rawRight-v.rightFilter);if(std::abs(v.rightFilter)<1e-20)v.rightFilter=0;
    double rightTone=v.rightFilter;
    if(resonantActive){const auto*coefficients=effective[BS_FILTER_AMOUNT]!=0?&v.resonant.coefficients:&resonantCoefficients;const double lp=v.rightResonant.process(rawRight,*coefficients);rightTone=filterBlend==1?lp:v.rightFilter+(lp-v.rightFilter)*filterBlend;}else v.rightResonant.clear();
    const double rightFiltered=effective[BS_FILTER_MIX]==1?rightTone:rawRight+(rightTone-rawRight)*effective[BS_FILTER_MIX];
    const double rightDry=v.rightSauce.process(rightFiltered,effective[BS_DRIVE],fullness,effective[BS_DRIVE_ENABLED],effective[BS_FULLNESS_ENABLED],dcPole,bodyAlpha,effective[BS_SAUCE_ORDER],sauceModulationPtr);
    r+=rightDry*amplitude*.25*v.panRight;
   }
   v.age+=dt;
  }
  if(stereoWidthSmooth!=1){const double mid=.5*(l+r),side=.5*(l-r)*stereoWidthSmooth;l=mid+side;r=mid-side;}
  delay.process(l,r,performance.tempo());
  left=float(std::tanh(l)*effective[BS_GAIN]); right=float(std::tanh(r)*effective[BS_GAIN]);
 }
};

extern "C" {
void bs_default_delay(bs_delay_config*config){if(config)*config=blocks_detail::StereoDelay::defaults();}
int bs_set_delay(bs_synth*synth,const bs_delay_config*config){return synth&&config&&synth->delay.configure(*config)?1:0;}
int bs_get_delay(const bs_synth*synth,bs_delay_config*config){if(!synth||!config)return 0;*config=synth->delay.config();return 1;}
void bs_default_voicing(bs_voicing_config*config){if(config)*config=blocks_detail::Unison::defaults();}
int bs_set_voicing(bs_synth*synth,const bs_voicing_config*config){return synth&&config&&synth->unison.configure(*config)?1:0;}
int bs_get_voicing(const bs_synth*synth,bs_voicing_config*config){if(!synth||!config)return 0;*config=synth->unison.config();return 1;}
void bs_default_notes(bs_notes_config*config){if(config)*config=blocks_detail::NoteRack::defaults();}
int bs_set_notes(bs_synth*synth,const bs_notes_config*config){return synth&&config?synth->setNotes(*config):0;}
int bs_get_notes(const bs_synth*synth,bs_notes_config*config){if(!synth||!config)return 0;*config=synth->noteRack.config();return 1;}
uint32_t bs_notes_pending_mask(const bs_synth*synth){return synth?synth->noteRack.pendingMask():0;}
void bs_default_sauce(bs_sauce_config*config){if(config)*config=bs_sauce_config{BS_SAUCE_VERSION,0,{}};}
int bs_set_sauce(bs_synth*synth,const bs_sauce_config*config){return synth&&config?synth->setSauce(*config):0;}
int bs_get_sauce(const bs_synth*synth,bs_sauce_config*config){if(!synth||!config)return 0;*config=synth->sauceConfig;return 1;}
void bs_default_modulation(bs_modulation_config*config){if(config)*config=blocks_detail::defaultModulation();}
int bs_set_modulation(bs_synth*synth,const bs_modulation_config*config){return synth&&config&&synth->modulation.configure(*config)?1:0;}
int bs_get_modulation(const bs_synth*synth,bs_modulation_config*config){return synth&&config&&synth->modulation.getLegacy(*config)?1:0;}
void bs_default_modulation_v2(bs_modulation_config_v2*config){if(config)*config=blocks_detail::defaultModulationV2();}
int bs_set_modulation_v2(bs_synth*synth,const bs_modulation_config_v2*config){return synth&&config&&synth->modulation.configure(*config)?1:0;}
int bs_get_modulation_v2(const bs_synth*synth,bs_modulation_config_v2*config){return synth&&config&&synth->modulation.getV2(*config)?1:0;}
void bs_default_modulation_v3(bs_modulation_config_v3*config){if(config)*config=blocks_detail::defaultModulationV3();}
int bs_set_modulation_v3(bs_synth*synth,const bs_modulation_config_v3*config){return synth&&config&&synth->modulation.configure(*config)?1:0;}
int bs_get_modulation_v3(const bs_synth*synth,bs_modulation_config_v3*config){if(!synth||!config)return 0;*config=synth->modulation.configV3();return 1;}
double bs_get_modulation_phase(const bs_synth*synth,uint32_t source_id){return synth?synth->modulation.phase(source_id):-1;}
void bs_default_performance(bs_performance_config*config){if(config)*config=blocks_detail::defaultPerformance();}
int bs_set_performance(bs_synth*synth,const bs_performance_config*config){return synth&&config?synth->setPerformance(*config):0;}
int bs_get_performance(const bs_synth*synth,bs_performance_config*config){if(!synth||!config)return 0;*config=synth->requestedPerformance;return 1;}
uint32_t bs_performance_pending(const bs_synth*synth){return synth&&synth->performance.pending()?1:0;}
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
bs_synth *bs_create(void) {auto*synth=new(std::nothrow) bs_synth;if(synth&&!synth->delay.prepare(48000)){delete synth;return nullptr;}return synth;}
void bs_destroy(bs_synth *synth) { delete synth; }
int bs_prepare(bs_synth *synth,double rate) {
 if(!synth||!std::isfinite(rate)||rate<8000||rate>384000) return 0;
 if(!synth->delay.prepare(rate))return 0;
 synth->rate=rate; synth->dt=1/rate; synth->smoothing=1-std::exp(-1/(.005*rate)); synth->dcPole=std::exp(-2*pi*10/rate); synth->reset(); return 1;
}
void bs_reset(bs_synth *synth) { if(synth) synth->reset(); }
int bs_set_parameter(bs_synth *synth,uint32_t id,float physical) {
 if(!synth||id>=BS_PARAMETER_COUNT||!std::isfinite(physical)) return 0;
 const double bounded=clamp(physical,descriptors[id].minimum,descriptors[id].maximum);
 synth->parameters[id]=float(descriptors[id].mapping==BS_DISCRETE?std::round(bounded):bounded);
 if(id==BS_OSC_MIX){synth->parameters[BS_OSC1_LEVEL]=1-synth->parameters[id];synth->parameters[BS_OSC2_LEVEL]=synth->parameters[id];synth->canonicalMix();}
 else if(id==BS_OSC1_LEVEL||id==BS_OSC2_LEVEL)synth->canonicalMix();
 else if(id==BS_SAUCE_ORDER)synth->reorderPrimary(synth->parameters[id]>=.5f);
 return 1;
}
int bs_set_stereo_width(bs_synth*synth,float width){if(!synth||!std::isfinite(width)||width<0||width>2)return 0;synth->stereoWidth=width;return 1;}
float bs_get_stereo_width(const bs_synth*synth){return synth?synth->stereoWidth:1;}
float bs_get_parameter(const bs_synth *synth,uint32_t id) { return synth&&id<BS_PARAMETER_COUNT?synth->parameters[id]:0; }
int bs_get_patch(const bs_synth *synth,bs_patch *patch) {
 if(!synth||!patch) return 0; patch->version=BS_ABI_VERSION;
 for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i) patch->values[i]=synth->parameters[i]; return 1;
}
int bs_set_patch(bs_synth *synth,const bs_patch *patch) {
 if(!synth||!patch||(patch->version<1||patch->version>BS_ABI_VERSION)) return 0;
 const uint32_t count=patch->version==1?18u:patch->version==2?19u:patch->version==3?21u:patch->version==4?35u:patch->version==5?40u:patch->version==6?42u:BS_PARAMETER_COUNT;
 for(uint32_t i=0;i<count;++i)if(!std::isfinite(patch->values[i]))return 0;
 // Build all canonical targets before changing any current parameter. V4's
 // independent levels win over an inconsistent compatibility Mix field.
 std::array<float,BS_PARAMETER_COUNT> next{};
 for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i){const double value=clamp(i<count?patch->values[i]:descriptors[i].default_value,descriptors[i].minimum,descriptors[i].maximum);next[i]=float(descriptors[i].mapping==BS_DISCRETE?std::round(value):value);}
 if(patch->version<4){next[BS_OSC1_LEVEL]=1-next[BS_OSC_MIX];next[BS_OSC2_LEVEL]=next[BS_OSC_MIX];}
 if(patch->version<5)next[BS_ENVELOPE_RESPONSE]=0;
 synth->parameters=next;synth->canonicalMix();synth->reorderPrimary(next[BS_SAUCE_ORDER]>=.5f);
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
