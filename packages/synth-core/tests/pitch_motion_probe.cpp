#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

// Offline output-frequency measurement; all sound comes from bs_render.
// Sine, dry filter and symmetric saturation preserve identifiable crossings.
namespace {
constexpr unsigned rate=48000,frames=rate*4,block=256;
struct Profile {const char*name;float drift,settling,speed,sensitivity;};
struct Window {double start,end,min=1e9,max=-1e9,sum=0,absSum=0;unsigned count=0;};
void quote(std::ostream&o,const std::string&s){o<<'"';for(char c:s){if(c=='"'||c=='\\')o<<'\\';o<<c;}o<<'"';}
std::vector<Window> windows(){return{{.01,.03},{.03,.06},{.06,.12},{.12,.25},{.25,.5},{.5,1},{1,2},{2,3.5}};}
}
int main(int argc,char**argv){try{
 if(argc!=2)throw std::runtime_error("Usage: pitch-motion-probe output-json");
 if(bs_parameter_info(BS_DRIFT_CENTS)->maximum<120||bs_parameter_info(BS_SETTLING_CENTS)->maximum<80)throw std::runtime_error("Wait for authorized120/80 descriptor ranges; do not measure silently clamped controls");
 const std::vector<Profile>profiles={
  {"neutral",0,0,.58f,0},
  {"macro60",4.8f,1.2f,.58f,.51f},
  {"old-drift-slow",40,0,.1f,.85f},
  {"old-drift-fast",40,0,.58f,.85f},
  {"old-settling",0,8,.58f,.85f},
  {"old-combined-slow",40,8,.1f,.85f},
  {"old-combined-fast",40,8,.58f,.85f},
  {"new-settling",0,60,.58f,.85f},
  {"new-combined-slow",120,60,.1f,.85f},
  {"new-combined-fast",120,60,.58f,.85f}};
 std::ofstream out(argv[1]);out<<std::setprecision(12)<<"{\"fixtureVersion\":1,\"abiVersion\":"<<bs_abi_version()<<",\"sampleRate\":"<<rate<<",\"frames\":"<<frames<<",\"blockFrames\":"<<block<<",\"method\":\"Linear-interpolated positive-going output zero crossings; cents from adjacent-cycle period, timestamped at cycle midpoint. Single Sine, dry filter, neutral Fullness/Drop and Drive1; frequency measurement, not listening judgement.\",\"reset\":\"Deterministic bs_reset per case; firstNoteOn ordinal1\",\"cases\":[";
 bool first=true;unsigned cases=0;
 for(const auto&profile:profiles)for(unsigned key:{60u,69u,72u})for(float velocity:{.25f,.72f,1.f}){
  bs_synth*s=bs_create();if(!s||!bs_prepare(s,rate))throw std::runtime_error("Prepare failed");
  std::array<float,BS_PARAMETER_COUNT>p{};for(unsigned i=0;i<p.size();++i)p[i]=bs_parameter_info(i)->default_value;
  p[BS_GAIN]=.3f;p[BS_OSC1_WAVE]=p[BS_OSC2_WAVE]=BS_SINE;p[BS_OSC_MIX]=0;p[BS_OSC1_LEVEL]=1;p[BS_OSC2_LEVEL]=0;p[BS_OSC2_DETUNE]=0;p[BS_ATTACK]=.001f;p[BS_DECAY]=.01f;p[BS_SUSTAIN_LEVEL]=1;p[BS_RELEASE]=.1f;p[BS_DRIVE]=1;p[BS_FULLNESS]=0;p[BS_FILTER_MIX]=0;p[BS_FILTER_AMOUNT]=0;p[BS_PITCH_DROP_CENTS]=0;p[BS_DRIFT_CENTS]=profile.drift;p[BS_DRIFT_HZ]=profile.speed;p[BS_SETTLING_CENTS]=profile.settling;p[BS_SETTLING_TIME]=.18f;p[BS_VELOCITY_MOVEMENT]=profile.sensitivity;if(p.size()>35)p[35]=0; // Compare raw manual controls, not the envelope-adaptive budget.
  for(unsigned i=0;i<p.size();++i)if(!bs_set_parameter(s,i,p[i]))throw std::runtime_error("Set parameter failed");bs_reset(s);bs_patch actual{};bs_get_patch(s,&actual);
  const std::array<bs_event,2>events={{{0,BS_NOTE_ON,0,key,0,velocity},{rate*38/10,BS_NOTE_OFF,0,key,0,0}}};
  std::vector<float>left(frames),right(frames);std::vector<bs_event>local;local.reserve(2);
  for(unsigned start=0;start<frames;start+=block){unsigned n=std::min(block,frames-start);local.clear();for(auto e:events)if(e.sample_offset>=start&&e.sample_offset<start+n){e.sample_offset-=start;local.push_back(e);}if(bs_render(s,left.data()+start,right.data()+start,n,local.data(),unsigned(local.size())))throw std::runtime_error("Render rejected events");}
  if(bs_active_voices(s))throw std::runtime_error("Voice did not release");bs_destroy(s);
  auto measured=windows();double previous=-1,peak=0;const double nominal=440*std::pow(2.,(double(key)-69)/12.);
  for(unsigned i=1;i<frames;++i){if(!std::isfinite(left[i]))throw std::runtime_error("Nonfinite output");if(left[i-1]<=0&&left[i]>0){double crossing=i-1+double(-left[i-1])/(left[i]-left[i-1]);if(previous>=0){double time=(crossing+previous)/(2*rate),cents=1200*std::log2((rate/(crossing-previous))/nominal);for(auto&w:measured)if(time>=w.start&&time<w.end){w.min=std::min(w.min,cents);w.max=std::max(w.max,cents);w.sum+=cents;w.absSum+=std::abs(cents);++w.count;peak=std::max(peak,std::abs(cents));}}previous=crossing;}}
  if(std::string(profile.name)=="neutral"&&peak>.03)throw std::runtime_error("Neutral pitch measurement error above0.03cents");
  if(!first)out<<',';first=false;out<<"\n{\"profile\":";quote(out,profile.name);out<<",\"key\":"<<key<<",\"velocity\":"<<velocity<<",\"parameters\":[";for(unsigned i=0;i<p.size();++i){if(i)out<<',';out<<"{\"id\":"<<i<<",\"value\":"<<actual.values[i]<<'}';}out<<"],\"events\":[{\"sampleOffset\":0,\"type\":0,\"channel\":0,\"key\":"<<key<<",\"value\":"<<velocity<<"},{\"sampleOffset\":"<<rate*38/10<<",\"type\":1,\"channel\":0,\"key\":"<<key<<",\"value\":0}],\"maxAbsMeasuredCents\":"<<peak<<",\"windows\":[";
  for(unsigned i=0;i<measured.size();++i){const auto&w=measured[i];if(!w.count)throw std::runtime_error("Empty analysis window");if(i)out<<',';out<<"{\"startSeconds\":"<<w.start<<",\"endSeconds\":"<<w.end<<",\"cycles\":"<<w.count<<",\"minCents\":"<<w.min<<",\"maxCents\":"<<w.max<<",\"meanCents\":"<<w.sum/w.count<<",\"meanAbsCents\":"<<w.absSum/w.count<<'}';}out<<"]}";++cases;
 }
 out<<"\n]}\n";if(!out||cases!=90)throw std::runtime_error("Incomplete probe");std::cout<<cases<<" actual-core pitch cases; neutral controls below0.03cents\n";return 0;
 }catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
