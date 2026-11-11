#include "blocks_synth.h"
#include "audio_rack.h"
#include "harmonics_suite.h"
#include "note_rack.h"
#include "motion_response.h"
#include "free_drift.h"
#include "resonant_filter.h"
#include "blocks_sound.h"
#include "ladder_filter.h"
#include "wave_source.h"
#include "waveforms.h"
#include "performance.h"
#include "modulation.h"
#include "unison.h"
#include "osc_bass.h"
#include "sub_notes.h"
#include "blocks_filter_routing.h"
#include "filter_route.h"
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
 {BS_DRIVE,"Reserved (Suite owns Drive)","gain",1,12,1,BS_LOGARITHMIC},
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
 {BS_DRIVE_ENABLED,"Reserved (Suite power)","switch",0,1,1,BS_DISCRETE},
 {BS_PITCH_DROP_ENABLED,"Pitch drop enabled","switch",0,1,1,BS_DISCRETE},
 {BS_SAUCE_ORDER,"Reserved (Suite order)","order",0,1,0,BS_DISCRETE},
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
using Weights=std::array<double,5>;
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
 bool ladderWarm=false;
 blocks_detail::LadderFilter ladder,rightLadder;
 blocks_detail::LadderCoefficients ladderCoefficients;
 unsigned unisonCount=1,unisonCount1=1,unisonCount2=1;std::array<double,BS_MAX_UNISON>unisonPhase1{},unisonPhase2{};
 blocks_detail::FilterRouteAlignment bypassAlignment,rightBypassAlignment;
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
 blocks_detail::HarmonicsSuite suite;std::array<double,BS_HARMONICS_SUITE_LATENCY>cleanSubDelay{};unsigned cleanSubDelayPosition=0;
 bs_sound_config soundConfig{BS_SOUND_VERSION,BS_SOURCE_STUDIO,BS_FILTER_EXISTING,1};
 double ladderBlend=0,ladderDrive=1;
 blocks_detail::LadderCoefficients ladderCoefficients;
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
 blocks_detail::Unison unison,unison2;blocks_detail::OscBass oscBass;
 blocks_detail::SubNotes subNotes;Voice subVoice;int subSelection=-1;double subLevel=0,subOn=0,subFX=0,subWave=0,subOctave=-1;
 bs_clock_config clockConfig{1,120,4};double clockBpm=120;
 double tempo()const{return clockBpm;}
 int setClock(const bs_clock_config&c){if(c.version!=1||!std::isfinite(c.bpm)||c.bpm<40||c.bpm>240||c.beats_per_bar<1||c.beats_per_bar>16)return 0;clockConfig=c;return 1;}
 bs_filter_routing_config filterRouting{BS_FILTER_ROUTING_VERSION,3};std::array<double,2>filterRoutes{{1,1}};
 blocks_detail::StereoDelay delay;
 bs_sauce_config sauceConfig{BS_SAUCE_VERSION,0,{}};
 blocks_detail::NoteRack noteRack;blocks_detail::Performance finalMono;
 bs_performance_config requestedPerformance=blocks_detail::defaultPerformance();bool notesExplicit=false;
 double driftPhase=0,filterBlend=0;
 float stereoWidth=1;double stereoWidthSmooth=1;
 blocks_detail::ResonantCoefficients resonantCoefficients;
 int setVoicingV2(const bs_voicing_config_v2&c){
  if(c.version!=BS_VOICING_VERSION_V2||c.reserved!=0)return 0;
  const auto&a=c.oscillators[0];const auto&b=c.oscillators[1];
  if(!blocks_detail::Unison::valid(a)||!blocks_detail::Unison::valid(b))return 0;
  unison.configure(a);unison2.configure(b);return 1;
 }
 int setFilterRouting(const bs_filter_routing_config&c){if(c.version!=BS_FILTER_ROUTING_VERSION||c.mask>3)return 0;filterRouting=c;return 1;}
 void canonicalMix(){const double total=double(parameters[BS_OSC1_LEVEL])+parameters[BS_OSC2_LEVEL];parameters[BS_OSC_MIX]=total>0?float(parameters[BS_OSC2_LEVEL]/total):.5f;}
 int setSound(const bs_sound_config&c){if(c.version!=BS_SOUND_VERSION||c.oscillator!=BS_SOURCE_STUDIO||c.filter_model>BS_FILTER_LADDER||!std::isfinite(c.filter_drive)||c.filter_drive<1||c.filter_drive>12)return 0;soundConfig=c;return 1;}
 double source(const Weights&weights,double phase,double step,double width){return blocks_detail::StudioOscillator::mix(weights,phase,step,width);}
 bs_synth() {
  suite.prepare(48000);
  for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i)parameters[i]=float(smooth[i]=descriptors[i].default_value);canonicalMix();
  for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i)if(descriptors[i].mapping==BS_LOGARITHMIC)modulationLogSpan[i]=std::log(double(descriptors[i].maximum)/descriptors[i].minimum);
  performance.bind({this,[](void*c,uint32_t ch,uint32_t key,float velocity,bool mono,bool legato){auto*s=static_cast<bs_synth*>(c);if(s->notesExplicit)s->noteRack.on(ch,key,velocity);else s->emitVoice(ch,key,velocity,mono,legato);},[](void*c,uint32_t ch,uint32_t key){auto*s=static_cast<bs_synth*>(c);if(s->notesExplicit)s->noteRack.off(ch,key);else s->voiceOff(ch,key);}});
  finalMono.bind({this,[](void*c,uint32_t ch,uint32_t key,float velocity,bool mono,bool legato){static_cast<bs_synth*>(c)->emitVoice(ch,key,velocity,mono,legato);},[](void*c,uint32_t ch,uint32_t key){static_cast<bs_synth*>(c)->voiceOff(ch,key);}});
  noteRack.bind({this,[](void*c,uint32_t ch,uint32_t key,float velocity){auto*s=static_cast<bs_synth*>(c);if(s->requestedPerformance.mono)s->finalMono.on(ch,key,velocity);else s->voiceOn(ch,key,velocity);},[](void*c,uint32_t ch,uint32_t key){auto*s=static_cast<bs_synth*>(c);if(s->requestedPerformance.mono)s->finalMono.off(ch,key);else s->voiceOff(ch,key);},[](void*c,uint32_t ch,bool down){auto*s=static_cast<bs_synth*>(c);if(s->requestedPerformance.mono)s->finalMono.pedal(ch,down);else s->voicePedal(ch,down);},[](void*c){static_cast<bs_synth*>(c)->clearOutputs();}});
 }
 void clearOutputs(){subNotes.clear();subVoice=Voice{};subSelection=-1;oscBass.cancelRetrigger();delay.clear();suite.reset();cleanSubDelay={};cleanSubDelayPosition=0;modulation.cancelRetrigger();for(auto&v:voices)v=Voice{};for(auto&v:tails)v=Voice{};onOrdinals={};offOrdinals={};pedals={};finalMono.clear();}
 void emitVoice(uint32_t channel,uint32_t key,float velocity,bool mono,bool legato){double previous=0;if(mono&&legato&&parameters[BS_GLIDE_ENABLED]&&parameters[BS_GLIDE_TIME]>0){uint64_t newest=0;for(const auto&v:voices)if(v.active&&(v.stage!=Stage::release||v.stageAge==0)&&v.order>newest){previous=v.lastFrequency;newest=v.order;}}const double duration=previous>0?smooth[BS_GLIDE_TIME]:0;if(mono)for(auto&v:voices)if(v.active)retire(v);voiceOn(channel,key,velocity,previous,duration);}
 int setNotes(const bs_notes_config&config){if(!blocks_detail::NoteRack::valid(config))return 0;bool topology=!notesExplicit||config.count!=noteRack.config().count;for(unsigned i=0;i<config.count&&!topology;++i){const auto&a=config.blocks[i];const auto&b=noteRack.config().blocks[i];topology=a.id!=b.id||a.type!=b.type||a.enabled!=b.enabled;}if(topology)performance.clear();if(!notesExplicit){clearOutputs();notesExplicit=true;auto legacy=requestedPerformance;legacy.mono=0;performance.configure(legacy);auto mono=blocks_detail::defaultPerformance();mono.mono=requestedPerformance.mono;finalMono.configure(mono);}return noteRack.configure(config,rate);}
 int setSauce(const bs_sauce_config&config){if(!blocks_detail::AudioRack::valid(config))return 0;sauceConfig=config;subVoice.sauce.configure(config,rate,false,true);for(auto&v:voices)if(v.active){v.sauce.configure(config,rate,false,true);if(v.unisonCount>1)v.rightSauce.configure(config,rate,false,true);}for(auto&v:tails)if(v.active){v.sauce.configure(config,rate,false,true);if(v.unisonCount>1)v.rightSauce.configure(config,rate,false,true);}return 1;}
 void reset() { subNotes.clear();subVoice=Voice{};subSelection=-1;subOn=subNotes.config.enabled;subLevel=subNotes.config.level;subFX=subNotes.config.routing;subWave=subNotes.config.waveform;subOctave=subNotes.config.octave;clockBpm=clockConfig.bpm;ladderBlend=soundConfig.filter_model;ladderDrive=soundConfig.filter_drive;delay.clear();suite.reset();cleanSubDelay={};cleanSubDelayPosition=0;unison.reset();unison2.reset();oscBass.reset(rate);filterRoutes={double(bool(filterRouting.mask&1)),double(bool(filterRouting.mask&2))};stereoWidthSmooth=stereoWidth; for(unsigned osc=0;osc<2;++osc) {waveWeights[osc]={};waveWeights[osc][unsigned(parameters[BS_OSC1_WAVE+osc])]=1;} for(auto&v:voices)v=Voice{};for(auto&v:tails)v=Voice{}; onOrdinals={}; offOrdinals={}; pedals={}; sequence=0;driftPhase=0;filterBlend=parameters[BS_FILTER_MODE];modulation.reset();modulationSmooth={};performance.prepare(rate);noteRack.prepare(rate);finalMono.prepare(rate); for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i) smooth[i]=parameters[i]; }
 void panic() {performance.clear();noteRack.clear();clearOutputs();}
 void retire(Voice&v){
  Voice*tail=nullptr;for(auto&candidate:tails)if(!candidate.active){tail=&candidate;break;}
  if(!tail)tail=&*std::min_element(tails.begin(),tails.end(),[](const Voice&a,const Voice&b){return a.level*a.velocity*a.tailRemaining<b.level*b.velocity*b.tailRemaining;});
  *tail=v;tail->tailRemaining=uint32_t(std::ceil(.003*rate));tail->held=false;v.active=false;
 }
 void on(uint32_t channel,uint32_t key,float velocity){if(performance.enabled())performance.on(channel,key,velocity);else if(notesExplicit)noteRack.on(channel,key,velocity);else voiceOn(channel,key,velocity);}
 void off(uint32_t channel,uint32_t key){if(performance.enabled())performance.off(channel,key);else if(notesExplicit)noteRack.off(channel,key);else voiceOff(channel,key);}
 void pedal(uint32_t channel,bool down){if(performance.enabled())performance.pedal(channel,down);else if(notesExplicit)noteRack.pedal(channel,down);else voicePedal(channel,down);}
 int setPerformance(const bs_performance_config&config){if(!blocks_detail::Performance::valid(config))return 0;if(requestedPerformance.mode!=config.mode||requestedPerformance.mono!=config.mono)panic();requestedPerformance=config;clockConfig.bpm=config.bpm;auto legacy=config;if(notesExplicit)legacy.mono=0;performance.configure(legacy);auto mono=blocks_detail::defaultPerformance();mono.mono=config.mono;finalMono.configure(mono);return 1;}
 void voiceOn(uint32_t channel,uint32_t key,float velocity,double previousFrequency=0,double glideDuration=0) {
  if(channel>=16 || key>127 || !std::isfinite(velocity)) return;
  if(velocity<=0) { voiceOff(channel,key); return; }
  if(onOrdinals[channel][key]==std::numeric_limits<uint64_t>::max()||sequence==std::numeric_limits<uint64_t>::max()) {panic();sequence=0;}
  subNotes.on(channel,key,velocity);
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
  *v=Voice{};v->unisonCount1=unison.config().count;v->unisonCount2=unison2.config().count;v->unisonCount=std::max(v->unisonCount1,v->unisonCount2);v->sauce.configure(sauceConfig,rate,true,true);if(v->unisonCount>1)v->rightSauce.configure(sauceConfig,rate,true,true); v->active=v->held=true; v->channel=channel; v->key=key; v->order=++sequence; v->ordinal=ordinal;
  if(v->unisonCount1==v->unisonCount2)blocks_detail::Unison::startPhases(sequence,key,channel,v->unisonCount,v->unisonPhase1,v->unisonPhase2);
  else {std::array<double,BS_MAX_UNISON>unused{};blocks_detail::Unison::startPhases(sequence,key,channel,v->unisonCount1,v->unisonPhase1,unused);blocks_detail::Unison::startPhases(sequence,key,channel,v->unisonCount2,unused,v->unisonPhase2);}
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
  modulation.noteOn();oscBass.noteOn();
 }
 void voiceOff(uint32_t channel,uint32_t key) {
  if(channel>=16||key>=128||offOrdinals[channel][key]>=onOrdinals[channel][key])return;
  subNotes.off(channel,key);const uint64_t ordinal=++offOrdinals[channel][key];
  for(auto &v:voices)if(v.active&&v.held&&v.channel==channel&&v.key==key&&v.ordinal==ordinal) {
   v.held=false;if(pedals[channel])v.pedal=true;else release(v);break;
  }
 }
 void voicePedal(uint32_t channel,bool down) {
  if(channel>=16) return; pedals[channel]=down;subNotes.pedal(channel,down);
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
  unison.tick(smoothing);unison2.tick(smoothing);clockBpm+=smoothing*(clockConfig.bpm-clockBpm);
  for(unsigned osc=0;osc<2;++osc){const double target=(filterRouting.mask&(1u<<osc))?1:0;filterRoutes[osc]+=smoothing*(target-filterRoutes[osc]);if(std::abs(filterRoutes[osc]-target)<1e-12)filterRoutes[osc]=target;}
  const auto linearFade=[](double x,double target,double step){return x<target?std::min(target,x+step):std::max(target,x-step);};
  ladderBlend=linearFade(ladderBlend,soundConfig.filter_model,dt/.01);
  ladderDrive+=(soundConfig.filter_drive-ladderDrive)*smoothing;
  stereoWidthSmooth+=(double(stereoWidth)-stereoWidthSmooth)*smoothing;
  if(std::abs(stereoWidthSmooth-stereoWidth)<1e-12)stereoWidthSmooth=stereoWidth;
  performance.tick();if(notesExplicit){noteRack.tick();finalMono.tick();}
  bool bassFresh=false;for(const auto&v:voices)bassFresh|=v.active&&v.age==0&&(v.held||v.pedal);oscBass.tick(rate,smoothing,tempo(),bassFresh);
  // A same-sample NoteOff/panic can cancel an attack before it sounds. Only
  // fresh primary voices still held/sustained at this sample trigger the LFOs.
  if(modulation.retriggerPending()){bool fresh=false;for(const auto&v:voices)fresh|=v.active&&v.age==0&&(v.held||v.pedal);if(!fresh)modulation.cancelRetrigger();}
  for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i)if(i!=BS_OSC1_WAVE&&i!=BS_OSC2_WAVE&&i!=BS_FILTER_MODE) smooth[i]+=smoothing*(parameters[i]-smooth[i]);
  for(unsigned osc=0;osc<2;++osc) {
   const unsigned target=unsigned(parameters[BS_OSC1_WAVE+osc]);double sum=0;
   for(unsigned wave=0;wave<5;++wave) {double &weight=waveWeights[osc][wave];weight+=smoothing*((wave==target?1.:0.)-weight);if(std::abs(weight)<1e-12)weight=0;sum+=weight;}
   if(1-waveWeights[osc][target]<1e-12) {waveWeights[osc]={};waveWeights[osc][target]=1;} else for(auto &weight:waveWeights[osc])weight/=sum;
  }
  if(parameters[BS_FULLNESS]==0 && smooth[BS_FULLNESS]<1e-12) smooth[BS_FULLNESS]=0;
  const auto offsets=modulation.tick(rate,tempo());
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
  if(ladderBlend>0)ladderCoefficients.set(cutoff,effective[BS_FILTER_RESONANCE],rate);
  const double driftSpeed=effective[BS_DRIFT_HZ],motionPhase=driftPhase;driftPhase+=driftSpeed*dt;
  const double fullness=effective[BS_FULLNESS],bodyAlpha=1-std::exp(-2*pi*180*dt);
  const double level1=effective[BS_OSC1_LEVEL],level2=effective[BS_OSC2_LEVEL],w=effective[BS_PULSE_WIDTH],oscillator2Ratio=std::exp2(effective[BS_OSC2_DETUNE]/1200);
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
   const auto bassFrame1=oscBass.active(0)?oscBass.frame(0,frequency,v.level,v.velocity):blocks_detail::BassFrame{};
   const auto bassFrame2=oscBass.active(1)?oscBass.frame(1,frequency*oscillator2Ratio,v.level,v.velocity):blocks_detail::BassFrame{};
   double raw=0,rawRight=0,bypass=0,bypassRight=0;
   // Shared settings can reuse the paired source summation.
   const bool paired=!oscBass.active(0)&&!oscBass.active(1)&&v.unisonCount1==v.unisonCount2&&unison.sameSmoothing(unison2)&&filterRoutes[0]==1&&filterRoutes[1]==1;
   if(paired&&v.unisonCount==1){
    const double step1=clamp(frequency*dt,1e-9,.45),step2=clamp(frequency*oscillator2Ratio*dt,1e-9,.45);
    raw=(level1==0?0:level1*source(waveWeights[0],v.phase1,step1,w))+(level2==0?0:level2*source(waveWeights[1],v.phase2,step2,w));
    v.phase1+=step1;v.phase1-=std::floor(v.phase1);v.phase2+=step2;v.phase2-=std::floor(v.phase2);
   }else if(paired){
    for(unsigned copy=0;copy<v.unisonCount;++copy){const auto&u=unison.copies[v.unisonCount][copy];auto&p1=v.unisonPhase1[copy];auto&p2=v.unisonPhase2[copy];const double step1=clamp(frequency*u.ratio*dt,1e-9,.45),step2=clamp(frequency*u.ratio*oscillator2Ratio*dt,1e-9,.45);
     double value=0;
     value=(level1==0?0:level1*source(waveWeights[0],p1,step1,w))+(level2==0?0:level2*source(waveWeights[1],p2,step2,w));
     raw+=value*u.left;rawRight+=value*u.right;p1+=step1;p1-=std::floor(p1);p2+=step2;p2-=std::floor(p2);
    }
   }else{
    // Independent oscillator copy pools still feed one stereo filter/effects
    // pair per logical note. Zero-level oscillators keep advancing phases.
    const auto generate=[&](unsigned osc,double level,unsigned count,blocks_detail::Unison&voicing,double&single,std::array<double,BS_MAX_UNISON>&phases){
     std::array<double,2>sum{};
     for(unsigned copy=0;copy<count;++copy){const auto u=count==1?blocks_detail::Unison::Copy{}:voicing.copies[count][copy];double&phase=count==1?single:phases[copy];const double step=clamp(frequency*u.ratio*(osc?oscillator2Ratio:1)*dt,1e-9,.45);
      double value=0;if(level!=0){if(oscBass.fullyActive(osc))value=level*oscBass.applyFrame(osc,0,waveWeights[osc],phase,step,w,osc?bassFrame2:bassFrame1);else{value=level*source(waveWeights[osc],phase,step,w);if(oscBass.active(osc))value=level*oscBass.applyFrame(osc,value/level,waveWeights[osc],phase,step,w,osc?bassFrame2:bassFrame1);}}
      sum[0]+=value*u.left;sum[1]+=value*u.right;phase+=step;phase-=std::floor(phase);
     }
     return sum;
    };
    const auto first=generate(0,level1,v.unisonCount1,unison,v.phase1,v.unisonPhase1),second=generate(1,level2,v.unisonCount2,unison2,v.phase2,v.unisonPhase2);
    raw=first[0]*filterRoutes[0]+second[0]*filterRoutes[1];rawRight=first[1]*filterRoutes[0]+second[1]*filterRoutes[1];
    bypass=first[0]*(1-filterRoutes[0])+second[0]*(1-filterRoutes[1]);bypassRight=first[1]*(1-filterRoutes[0])+second[1]*(1-filterRoutes[1]);
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
   if(voiceIndex>=BS_MAX_VOICES) {const double tailGain=double(v.tailRemaining)/std::ceil(.003*rate);amplitude*=tailGain;if(--v.tailRemaining==0)v.active=false;}
   double filtered=effective[BS_FILTER_MIX]==1?tone:enriched+(tone-enriched)*effective[BS_FILTER_MIX];
   if(ladderBlend>0){v.ladderWarm=true;const auto*c=&ladderCoefficients;if(effective[BS_FILTER_AMOUNT]!=0){v.ladderCoefficients.set(clamp(effective[BS_CUTOFF]*std::exp2(effective[BS_FILTER_AMOUNT]*filterEnv/12),20,rate*.45),effective[BS_FILTER_RESONANCE],rate);c=&v.ladderCoefficients;}const double lp=v.ladder.processRaw(enriched,*c,ladderDrive,effective[BS_FILTER_MIX]);filtered=ladderBlend==1?lp:filtered+(lp-filtered)*ladderBlend;}else if(v.ladderWarm){v.ladder.clear();v.rightLadder.clear();v.bypassAlignment.clear();v.rightBypassAlignment.clear();v.ladderWarm=false;}
   double rightFiltered=0;
   if(v.unisonCount>1){
    v.rightFilter+=voiceAlpha*(rawRight-v.rightFilter);if(std::abs(v.rightFilter)<1e-20)v.rightFilter=0;
    double rightTone=v.rightFilter;
    if(resonantActive){const auto*coefficients=effective[BS_FILTER_AMOUNT]!=0?&v.resonant.coefficients:&resonantCoefficients;const double lp=v.rightResonant.process(rawRight,*coefficients);rightTone=filterBlend==1?lp:v.rightFilter+(lp-v.rightFilter)*filterBlend;}else v.rightResonant.clear();
    rightFiltered=effective[BS_FILTER_MIX]==1?rightTone:rawRight+(rightTone-rawRight)*effective[BS_FILTER_MIX];
    if(ladderBlend>0){const auto*c=effective[BS_FILTER_AMOUNT]!=0?&v.ladderCoefficients:&ladderCoefficients;const double lp=v.rightLadder.processRaw(rawRight,*c,ladderDrive,effective[BS_FILTER_MIX]);rightFiltered=ladderBlend==1?lp:rightFiltered+(lp-rightFiltered)*ladderBlend;}
   }
   // Bypass rejoins before Sauce/amp. Ladder's bypass matches its complete
   // linear reconstruction response, not merely an integer delay.
   if(ladderBlend>0){const double aligned=v.bypassAlignment.process(bypass);bypass=ladderBlend==1?aligned:bypass+(aligned-bypass)*ladderBlend;if(v.unisonCount>1){const double rightAligned=v.rightBypassAlignment.process(bypassRight);bypassRight=ladderBlend==1?rightAligned:bypassRight+(rightAligned-bypassRight)*ladderBlend;}}
   if(bypass!=0)filtered+=bypass;if(bypassRight!=0)rightFiltered+=bypassRight;
   const double linkedMagnitude=v.unisonCount>1?std::sqrt(.5*(filtered*filtered+rightFiltered*rightFiltered)):std::abs(filtered);
   const double dry=v.sauce.process(filtered,effective[BS_DRIVE],fullness,effective[BS_DRIVE_ENABLED],effective[BS_FULLNESS_ENABLED],dcPole,bodyAlpha,effective[BS_SAUCE_ORDER],sauceModulationPtr,linkedMagnitude,amplitude);
   const double value=dry*amplitude*.25;
   l+=value*v.panLeft;
   if(v.unisonCount==1)r+=value*v.panRight;
   else{
    const double rightDry=v.rightSauce.process(rightFiltered,effective[BS_DRIVE],fullness,effective[BS_DRIVE_ENABLED],effective[BS_FULLNESS_ENABLED],dcPole,bodyAlpha,effective[BS_SAUCE_ORDER],sauceModulationPtr,linkedMagnitude,amplitude);
    r+=rightDry*amplitude*.25*v.panRight;
   }
   v.age+=dt;
  }

  const auto&sc=subNotes.config;const double fade=dt/.005;
  subOn=sc.enabled>subOn?std::min(double(sc.enabled),subOn+fade):std::max(double(sc.enabled),subOn-fade);
  subLevel+=smoothing*(sc.level-subLevel);subFX+=smoothing*(sc.routing-subFX);subWave+=smoothing*(sc.waveform-subWave);subOctave+=smoothing*(sc.octave-subOctave);
  const int selected=subNotes.selected();
  if(selected!=subSelection){
   if(selected<0){if(subVoice.active)release(subVoice);}
   else{const bool connected=subVoice.active&&subVoice.stage!=Stage::release;const double previous=subVoice.lastFrequency;const double phase=subVoice.phase1;
    if(!connected){subVoice=Voice{};subVoice.active=true;subVoice.phase1=phase;subVoice.sauce.configure(sauceConfig,rate,true,true);subVoice.attack=parameters[BS_ATTACK];subVoice.decay=parameters[BS_DECAY];subVoice.sustain=parameters[BS_SUSTAIN_LEVEL];subVoice.release=parameters[BS_RELEASE];subVoice.attackBend=parameters[BS_ATTACK_BEND];subVoice.decayBend=parameters[BS_DECAY_BEND];subVoice.releaseBend=parameters[BS_RELEASE_BEND];auto&f=subVoice.filterEnvelope;f.attack=parameters[BS_FILTER_ATTACK];f.decay=parameters[BS_FILTER_DECAY];f.sustain=parameters[BS_FILTER_SUSTAIN];f.release=parameters[BS_FILTER_RELEASE];f.attackBend=parameters[BS_FILTER_ATTACK_BEND];f.decayBend=parameters[BS_FILTER_DECAY_BEND];f.releaseBend=parameters[BS_FILTER_RELEASE_BEND];}
    subVoice.frequency=440*std::exp2((selected%128-69)/12.);subVoice.velocity=subNotes.velocity(selected);subVoice.channel=unsigned(selected)/128;subVoice.key=unsigned(selected)%128;subVoice.age=0;subVoice.glideStartFrequency=connected&&parameters[BS_GLIDE_ENABLED]?previous:0;subVoice.glideDuration=subVoice.glideStartFrequency>0?parameters[BS_GLIDE_TIME]:0;
   }subSelection=selected;
  }
  double cleanSub=0;
  if(subVoice.active){auto&v=subVoice;const double target=v.frequency;const double f=v.glideStartFrequency>0&&v.glideDuration>0&&v.age<v.glideDuration?std::exp2(std::log2(v.glideStartFrequency)+(std::log2(target)-std::log2(v.glideStartFrequency))*v.age/v.glideDuration):target;v.lastFrequency=f;
   const double step=std::min(.45,f*std::exp2(subOctave)*dt),sn=blocks_detail::sine(v.phase1),tri=blocks_detail::triangle(v.phase1-.25,step),raw=sn+subWave*(tri-sn);v.phase1+=step;v.phase1-=std::floor(v.phase1);
   const double subEnvelope=envelope(v,dt)*v.velocity;const double amplitude=subEnvelope*subLevel*subOn*.25;
   cleanSub=raw*amplitude*(1-subFX);const double subFilterEnvelope=v.filterEnvelope.sample(dt);
   if(subFX>1e-12&&subOn>0){const double fe=subFilterEnvelope,fc=clamp(cutoff*std::exp2(effective[BS_FILTER_AMOUNT]*fe/12),20,rate*.45),a=1-std::exp(-2*pi*fc*dt);v.filter+=a*(raw-v.filter);double tone=v.filter;
    if(resonantActive){v.resonant.coefficients.set(fc,damping,rate);const double lp=v.resonant.process(raw,v.resonant.coefficients);tone+=filterBlend*(lp-tone);}
    double filtered=raw+effective[BS_FILTER_MIX]*(tone-raw);if(ladderBlend>0){v.ladderCoefficients.set(fc,effective[BS_FILTER_RESONANCE],rate);const double lp=v.ladder.processRaw(raw,v.ladderCoefficients,ladderDrive,effective[BS_FILTER_MIX]);filtered+=ladderBlend*(lp-filtered);}
    const double colour=v.sauce.process(filtered,effective[BS_DRIVE],fullness,effective[BS_DRIVE_ENABLED],effective[BS_FULLNESS_ENABLED],dcPole,bodyAlpha,effective[BS_SAUCE_ORDER],sauceModulationPtr,-1,subEnvelope);l+=colour*amplitude*subFX;r+=colour*amplitude*subFX;
   }v.age+=dt;
  }
  const auto processed=suite.process(l,r,l,r);l=processed.left;r=processed.right;
  const double alignedCleanSub=cleanSubDelay[cleanSubDelayPosition];cleanSubDelay[cleanSubDelayPosition]=cleanSub;cleanSubDelayPosition=(cleanSubDelayPosition+1)%BS_HARMONICS_SUITE_LATENCY;cleanSub=alignedCleanSub;
  if(stereoWidthSmooth!=1){const double mid=.5*(l+r),side=.5*(l-r)*stereoWidthSmooth;l=mid+side;r=mid-side;}
  delay.process(l,r,tempo());
  if(cleanSub!=0){left=float(clamp((std::tanh(l)+cleanSub)*effective[BS_GAIN],-1,1));right=float(clamp((std::tanh(r)+cleanSub)*effective[BS_GAIN],-1,1));}
  else{left=float(std::tanh(l)*effective[BS_GAIN]); right=float(std::tanh(r)*effective[BS_GAIN]);}
 }
};

extern "C" {

void bs_default_harmonics_suite(bs_harmonics_suite_config*c){if(c)*c=blocks_detail::HarmonicsSuite::defaults();}
int bs_set_harmonics_suite(bs_synth*s,const bs_harmonics_suite_config*c){return s&&c&&s->suite.configure(*c)?1:0;}
int bs_get_harmonics_suite(const bs_synth*s,bs_harmonics_suite_config*c){if(!s||!c)return 0;*c=s->suite.config();return 1;}
int bs_get_harmonics_suite_meters(const bs_synth*s,bs_harmonics_suite_meters*m){if(!s||!m)return 0;*m=s->suite.meters();return 1;}
uint32_t bs_harmonics_suite_latency(void){return BS_HARMONICS_SUITE_LATENCY;}
int bs_suite_dynamics_preview(const bs_harmonics_suite_config*c,float rate,float*dry,float*wet,uint32_t count){return c&&blocks_detail::HarmonicsSuite::previewDynamics(*c,rate,dry,wet,count)?1:0;}
int bs_suite_colour_preview(const bs_harmonics_suite_config*c,float frequency,float rate,float*out,uint32_t count){return c&&blocks_detail::HarmonicsSuite::previewColour(*c,frequency,rate,out,count)?1:0;}

void bs_default_clock(bs_clock_config*c){if(c)*c={1,120,4};}
int bs_set_clock(bs_synth*s,const bs_clock_config*c){return s&&c?s->setClock(*c):0;}
int bs_get_clock(const bs_synth*s,bs_clock_config*c){if(!s||!c)return 0;*c=s->clockConfig;return 1;}
void bs_default_sub(bs_sub_config*c){if(c)*c=blocks_detail::defaultSub();}
int bs_set_sub(bs_synth*s,const bs_sub_config*c){return s&&c&&s->subNotes.configure(*c)?1:0;}
int bs_get_sub(const bs_synth*s,bs_sub_config*c){if(!s||!c)return 0;*c=s->subNotes.config;return 1;}
int bs_get_sub_note(const bs_synth*s){return s&&s->subVoice.active&&s->subOn>0?int(s->subVoice.key):-1;}
void bs_default_osc_bass_v2(bs_osc_bass_config_v2*c){if(c)*c=blocks_detail::defaultOscBassV2();}
int bs_set_osc_bass_v2(bs_synth*s,const bs_osc_bass_config_v2*c){return s&&c&&s->oscBass.configure(*c)?1:0;}
int bs_get_osc_bass_v2(const bs_synth*s,bs_osc_bass_config_v2*c){if(!s||!c)return 0;*c=s->oscBass.configV2();return 1;}
double bs_get_osc_bass_raw_phase(const bs_synth*s,uint32_t i){return s?s->oscBass.rawPhase(i):-1;}
double bs_get_osc_bass_rate(const bs_synth*s,uint32_t i){return s?s->oscBass.hz(i):-1;}
double bs_osc_bass_warp_phase(double phase,float curl){return std::isfinite(phase)&&phase>=0&&phase<1&&std::isfinite(curl)&&std::abs(curl)<=.8f?blocks_detail::bassWarp(phase,curl):-1;}
int bs_osc_bass_preview_v2(uint32_t wave,uint32_t quality,float width,const bs_osc_bass_entry_v2*c,double rotation,double frequency,double rate,double bpm,float env,float vel,float*out,uint32_t samples){
 if(wave>4||quality!=1||!std::isfinite(width)||width<.1f||width>.9f||!c||!blocks_detail::validOscBassEntryV2(*c)||!std::isfinite(rotation)||rotation<0||rotation>=1||!std::isfinite(rate)||rate<8000||rate>384000||!std::isfinite(frequency)||frequency<=0||frequency>=rate*.5||!std::isfinite(bpm)||bpm<40||bpm>240||!std::isfinite(env)||env<0||env>1||!std::isfinite(vel)||vel<0||vel>1||!out||!samples||samples>2048)return 0;
 Weights w{};w[wave]=1;const double step=std::min(.45,frequency/rate);std::array<double,4>voices{};voices[c->voice]=1;const double hz=c->synced?bpm/(60*c->cycle_beats):c->spin_hz,guard=(c->synced||c->curl!=0)?std::min(rate*.02,hz*2):hz;const auto pose=blocks_detail::OscBassSource::pose(guard,c->motion,c->grit,rotation,rate);const auto f=blocks_detail::bassFrame(pose,voices,rotation,c->motion,c->grit,frequency,env,vel);
 for(unsigned i=0;i<samples;++i){const double phase=double(i)/samples;out[i]=float(c->enabled?blocks_detail::bassExpandedMix(w,phase,step,width,f):blocks_detail::StudioOscillator::mix(w,phase,step,width));}return 1;
}
double bs_get_osc_bass_phase(const bs_synth*s,uint32_t oscillator){return s?s->oscBass.phase(oscillator):-1;}
void bs_default_sound(bs_sound_config*c){if(c)*c={BS_SOUND_VERSION,BS_SOURCE_STUDIO,BS_FILTER_EXISTING,1};}
int bs_set_sound(bs_synth*s,const bs_sound_config*c){return s&&c?s->setSound(*c):0;}
int bs_get_sound(const bs_synth*s,bs_sound_config*c){if(!s||!c)return 0;*c=s->soundConfig;return 1;}
void bs_default_delay(bs_delay_config*config){if(config)*config=blocks_detail::StereoDelay::defaults();}
int bs_set_delay(bs_synth*synth,const bs_delay_config*config){return synth&&config&&synth->delay.configure(*config)?1:0;}
int bs_get_delay(const bs_synth*synth,bs_delay_config*config){if(!synth||!config)return 0;*config=synth->delay.config();return 1;}
void bs_default_voicing_v2(bs_voicing_config_v2*config){if(config)*config={2,0,{{1,0,0},{1,0,0}}};}
int bs_set_voicing_v2(bs_synth*synth,const bs_voicing_config_v2*config){return synth&&config?synth->setVoicingV2(*config):0;}
int bs_get_voicing_v2(const bs_synth*synth,bs_voicing_config_v2*config){if(!synth||!config)return 0;const auto&a=synth->unison.config();const auto&b=synth->unison2.config();*config={2,0,{{a.count,a.detune_cents,a.spread},{b.count,b.detune_cents,b.spread}}};return 1;}
void bs_default_filter_routing(bs_filter_routing_config*config){if(config)*config={BS_FILTER_ROUTING_VERSION,3};}
int bs_set_filter_routing(bs_synth*synth,const bs_filter_routing_config*config){return synth&&config?synth->setFilterRouting(*config):0;}
int bs_get_filter_routing(const bs_synth*synth,bs_filter_routing_config*config){if(!synth||!config)return 0;*config=synth->filterRouting;return 1;}
void bs_default_notes(bs_notes_config*config){if(config)*config=blocks_detail::NoteRack::defaults();}
int bs_set_notes(bs_synth*synth,const bs_notes_config*config){return synth&&config?synth->setNotes(*config):0;}
int bs_get_notes(const bs_synth*synth,bs_notes_config*config){if(!synth||!config)return 0;*config=synth->noteRack.config();return 1;}
uint32_t bs_notes_pending_mask(const bs_synth*synth){return synth?synth->noteRack.pendingMask():0;}
void bs_default_sauce(bs_sauce_config*config){if(config)*config=bs_sauce_config{BS_SAUCE_VERSION,0,{}};}
int bs_set_sauce(bs_synth*synth,const bs_sauce_config*config){return synth&&config?synth->setSauce(*config):0;}
int bs_get_sauce(const bs_synth*synth,bs_sauce_config*config){if(!synth||!config)return 0;*config=synth->sauceConfig;return 1;}
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
 synth->rate=rate; synth->dt=1/rate; synth->smoothing=1-std::exp(-1/(.005*rate)); synth->dcPole=std::exp(-2*pi*10/rate); synth->suite.prepare(rate);synth->reset(); return 1;
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
int bs_set_stereo_width(bs_synth*synth,float width){if(!synth||!std::isfinite(width)||width<0||width>2)return 0;synth->stereoWidth=width;return 1;}
float bs_get_stereo_width(const bs_synth*synth){return synth?synth->stereoWidth:1;}
float bs_get_parameter(const bs_synth *synth,uint32_t id) { return synth&&id<BS_PARAMETER_COUNT?synth->parameters[id]:0; }
int bs_get_patch(const bs_synth *synth,bs_patch *patch) {
 if(!synth||!patch) return 0; patch->version=BS_ABI_VERSION;
 for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i) patch->values[i]=synth->parameters[i]; return 1;
}
int bs_set_patch(bs_synth *synth,const bs_patch *patch) {
 if(!synth||!patch||patch->version!=BS_ABI_VERSION) return 0;
 const uint32_t count=BS_PARAMETER_COUNT;
 for(uint32_t i=0;i<count;++i)if(!std::isfinite(patch->values[i]))return 0;
 // Validate and canonicalize all current targets before mutation.
 std::array<float,BS_PARAMETER_COUNT> next{};
 for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i){const double value=clamp(patch->values[i],descriptors[i].minimum,descriptors[i].maximum);next[i]=float(descriptors[i].mapping==BS_DISCRETE?std::round(value):value);}
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
