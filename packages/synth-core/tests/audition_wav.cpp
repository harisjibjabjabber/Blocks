#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

// This is an offline host of the real portable core, not an alternative synth.
// All clips have one fixed Output setting (.3); no file is peak normalized.
namespace {
constexpr uint32_t rate=48000, frames=rate*6, block=256;
#ifdef __EMSCRIPTEN__
constexpr const char *renderTarget="portable C++ core compiled to WebAssembly";
#else
constexpr const char *renderTarget="portable C++ core compiled natively";
#endif
// ABI 3 appends these stable IDs; reject older cores rather than fake waveforms.
constexpr uint32_t osc1=BS_OSC1_WAVE, osc2=BS_OSC2_WAVE;
struct Clip { std::string id,title,description; std::array<float,BS_PARAMETER_COUNT> patch; std::vector<bs_event> events; };
uint32_t at(double seconds) { return uint32_t(std::llround(seconds*rate)); }
void event(Clip &c,double time,uint32_t type,uint32_t key=0,float value=0,uint32_t parameter=0,uint32_t channel=0) { c.events.push_back({at(time),type,channel,key,parameter,value}); }
void note(Clip &c,double start,double end,uint32_t key,float velocity=.72f) { event(c,start,BS_NOTE_ON,key,velocity); event(c,end,BS_NOTE_OFF,key); }
void chord(Clip &c,double start,double end,std::initializer_list<uint32_t> keys,float velocity=.72f) { for(auto key:keys) note(c,start,end,key,velocity); }
void character(Clip &c,float amount) { c.patch[BS_DRIFT_CENTS]=10*amount;c.patch[BS_DRIVE]=1+1.2f*amount;c.patch[BS_DRIFT_HZ]=.1f+.5f*amount; }
Clip factory(const std::string &id) {
 Clip c;c.id=id;
 for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i)c.patch[i]=bs_parameter_info(i)->default_value;
 c.patch[BS_GAIN]=.3f;
 if(id=="velvet") { c.title="Velvet Current";c.patch[BS_ATTACK]=.12f;c.patch[BS_DECAY]=.7f;c.patch[BS_SUSTAIN_LEVEL]=.72f;c.patch[BS_RELEASE]=.8f;c.patch[BS_CUTOFF]=2800;c.patch[BS_OSC2_DETUNE]=4;character(c,.32f);c.patch[BS_FULLNESS]=.28f; }
 if(id=="glass") { c.title="Glass Garden";c.patch[BS_ATTACK]=.004f;c.patch[BS_DECAY]=.48f;c.patch[BS_SUSTAIN_LEVEL]=.16f;c.patch[BS_RELEASE]=.45f;c.patch[BS_CUTOFF]=7500;c.patch[BS_OSC_MIX]=.15f;c.patch[BS_OSC2_DETUNE]=2;c.patch[BS_DECAY_BEND]=-.65f;character(c,.16f);c.patch[BS_FULLNESS]=.12f; }
 if(id=="low") { c.title="Low Tide";c.patch[BS_ATTACK]=.008f;c.patch[BS_DECAY]=.3f;c.patch[BS_SUSTAIN_LEVEL]=.68f;c.patch[BS_RELEASE]=.18f;c.patch[BS_CUTOFF]=680;c.patch[BS_OSC_MIX]=.7f;c.patch[BS_OSC2_DETUNE]=-3;character(c,.6f);c.patch[BS_FULLNESS]=.5f; }
 return c;
}
std::vector<Clip> fixtures() {
 std::vector<Clip> clips;
 auto velvet=factory("velvet");velvet.description="Two voiced chords with release space; unchanged factory patch.";
 chord(velvet,.2,2,{48,55,60,64,71});chord(velvet,2.7,4.5,{50,57,60,65,69});clips.push_back(velvet);
 auto glass=factory("glass");glass.description="Short melodic phrase with varied input velocity; unchanged factory patch.";
 const uint32_t melody[]={72,76,79,83,79,76,74,77};for(unsigned i=0;i<8;++i)note(glass,.2+.45*i,.38+.45*i,melody[i],.55f+.06f*float(i%4));clips.push_back(glass);
 auto low=factory("low");low.description="Bass phrase and spaces between releases; unchanged factory patch.";
 const uint32_t bass[]={36,36,43,34,41};for(unsigned i=0;i<5;++i)note(low,.2+.95*i,.72+.95*i,bass[i],.76f);clips.push_back(low);
 auto wave=factory("init");wave.id="sine-triangle";wave.title="Sine then Triangle";wave.description="Same MIDI60 note and controls: sine at0.2s, triangle at3.2s. Fullness/drift off, only waveform differs.";
 wave.patch[osc1]=wave.patch[osc2]=BS_SINE;wave.patch[BS_OSC_MIX]=0;wave.patch[BS_OSC2_DETUNE]=0;wave.patch[BS_CUTOFF]=12000;
 note(wave,.2,1.9,60);event(wave,3,BS_PARAMETER,0,BS_TRIANGLE,osc1);event(wave,3,BS_PARAMETER,0,BS_TRIANGLE,osc2);note(wave,3.2,4.9,60);clips.push_back(wave);
 auto dense=factory("velvet");dense.id="voice-overflow";dense.title="Voice ownership and stealing stress";dense.description="Velvet with3ms attack/500ms release.16 held notes then8 overlapping same-key attacks exceed capacity; old releases arrive before newer releases. Pedal and a second dense chord exercise tail cleanup. This is a stress fixture, not a musical-quality verdict.";
 dense.patch[BS_ATTACK]=.003f;dense.patch[BS_RELEASE]=.5f;
 event(dense,.1,BS_PEDAL,0,1);
 for(uint32_t key=60;key<76;++key)note(dense,.2,1.4,key,.5f);
 for(uint32_t key=60;key<68;++key)note(dense,.8,2,key,.55f);
 event(dense,2.3,BS_PEDAL,0,0);
 for(uint32_t key=48;key<64;++key)note(dense,3,3.8,key,.5f);
 clips.push_back(dense);
 for(auto &c:clips)std::stable_sort(c.events.begin(),c.events.end(),[](const bs_event&a,const bs_event&b){return a.sample_offset<b.sample_offset;});
 return clips;
}
void little(std::ostream &out,uint32_t value,unsigned bytes) { for(unsigned i=0;i<bytes;++i)out.put(char(value>>(8*i))); }
void quoted(std::ostream &out,const std::string &value) { out<<'"';for(char c:value){if(c=='"'||c=='\\')out<<'\\';out<<c;}out<<'"'; }
bool render(Clip &c,const std::string &directory) {
 bs_synth *s=bs_create();if(!s||!bs_prepare(s,rate))return false;
 for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i)if(!bs_set_parameter(s,i,c.patch[i])){bs_destroy(s);return false;}
 bs_reset(s);bs_patch actual{};if(!bs_get_patch(s,&actual)){bs_destroy(s);return false;}
 std::vector<float> l(frames),r(frames);std::vector<bs_event> local;local.reserve(c.events.size());uint32_t maxVoices=0;
 for(uint32_t start=0;start<frames;start+=block) {
  const uint32_t n=std::min(block,frames-start);local.clear();
  for(auto e:c.events)if(e.sample_offset>=start&&e.sample_offset<start+n){e.sample_offset-=start;local.push_back(e);}
  if(bs_render(s,l.data()+start,r.data()+start,n,local.data(),uint32_t(local.size()))!=0){bs_destroy(s);return false;}
  maxVoices=std::max(maxVoices,bs_active_voices(s));
 }
 const auto remaining=bs_active_voices(s);bs_destroy(s);
 double power=0,peak=0,mean=0,tail=0;uint32_t clipped=0;
 for(uint32_t i=0;i<frames;++i)for(float value:{l[i],r[i]}){
  if(!std::isfinite(value))return false;power+=double(value)*value;peak=std::max(peak,std::abs(double(value)));mean+=value;if(std::abs(value)>1)++clipped;if(i>=frames-rate/2)tail+=double(value)*value;
 }
 std::ofstream wav(directory+"/"+c.id+".wav",std::ios::binary);if(!wav)return false;
 wav.write("RIFF",4);little(wav,36+frames*4,4);wav.write("WAVEfmt ",8);little(wav,16,4);little(wav,1,2);little(wav,2,2);little(wav,rate,4);little(wav,rate*4,4);little(wav,4,2);little(wav,16,2);wav.write("data",4);little(wav,frames*4,4);
 for(uint32_t i=0;i<frames;++i)for(float value:{l[i],r[i]})little(wav,uint16_t(int16_t(std::lround(std::max(-1.f,std::min(1.f,value))*32767))),2);
 if(!wav)return false;
 std::ofstream json(directory+"/"+c.id+".json");if(!json)return false;json<<std::setprecision(10);
 json<<"{\n  \"fixtureVersion\":1,\n  \"id\":";quoted(json,c.id);json<<",\n  \"title\":";quoted(json,c.title);json<<",\n  \"description\":";quoted(json,c.description);
 json<<",\n  \"engine\":";quoted(json,renderTarget);json<<",\n  \"abiVersion\":"<<bs_abi_version()<<",\n  \"patchVersion\":"<<actual.version<<",\n  \"sampleRate\":"<<rate<<",\n  \"frames\":"<<frames<<",\n  \"renderBlockFrames\":"<<block<<",\n  \"channels\":2,\n  \"encoding\":\"PCM16 little-endian\",\n  \"normalized\":false,\n  \"resetPolicy\":\"bs_reset after setting patch; deterministic core seed\",\n  \"parameters\":[";
 for(uint32_t i=0;i<BS_PARAMETER_COUNT;++i){if(i)json<<',';const auto*p=bs_parameter_info(i);json<<"\n    {\"id\":"<<i<<",\"name\":";quoted(json,p->name);json<<",\"unit\":";quoted(json,p->unit);json<<",\"default\":"<<p->default_value<<",\"value\":"<<actual.values[i]<<'}';}
 json<<"\n  ],\n  \"events\":[";
 for(size_t i=0;i<c.events.size();++i){if(i)json<<',';const auto&e=c.events[i];json<<"\n    {\"sampleOffset\":"<<e.sample_offset<<",\"type\":"<<e.type<<",\"channel\":"<<e.channel<<",\"key\":"<<e.key<<",\"parameterId\":"<<e.parameter_id<<",\"value\":"<<e.value<<'}';}
 json<<"\n  ],\n  \"measurements\":{\"rms\":"<<std::sqrt(power/(frames*2))<<",\"peak\":"<<peak<<",\"dc\":"<<mean/(frames*2)<<",\"lastHalfSecondRms\":"<<std::sqrt(tail/rate)<<",\"clippedSamples\":"<<clipped<<",\"maxActiveVoicesAtBlockEnd\":"<<maxVoices<<",\"voicesAtEnd\":"<<remaining<<"},\n  \"acceptance\":\"Rendered signal only; no listening or physical-phone acceptance claimed\"\n}\n";
 return bool(json)&&clipped==0&&remaining==0;
}
}
int main(int argc,char **argv) {
 if(argc!=2){std::cerr<<"Usage: audition-wav existing-output-directory\n";return 1;}
 if(bs_abi_version()<3||bs_parameter_count()!=21){std::cerr<<"This fixture requires the21-parameter waveform core (ABI3).\n";return 2;}
 for(auto &clip:fixtures()){if(!render(clip,argv[1])){std::cerr<<"Failed fixture: "<<clip.id<<'\n';return 3;}std::cout<<clip.id<<".wav\n";}
 return 0;
}
