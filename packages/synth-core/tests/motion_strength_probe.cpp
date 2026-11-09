#include "blocks_synth.h"
#include <array>
#include <vector>
#include <algorithm>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
namespace {
constexpr unsigned rate=48000,frames=rate*4;
struct Shape{const char*name;float a,d,s,r;};
struct Measure{double peak=0,mean=0,rms=0;unsigned periods=0;};
Measure measure(const std::vector<float>&x,unsigned start,unsigned end){Measure m;double previous=-1,energy=0;for(unsigned i=start;i<end;++i){energy+=double(x[i])*x[i];if(i==start)continue;if(x[i-1]<=0&&x[i]>0){const double crossing=i-1-double(x[i-1])/(double(x[i])-x[i-1]);if(previous>=0&&std::max(std::abs(x[i-1]),std::abs(x[i]))>1e-10){const double cents=1200*std::log2(48000/(crossing-previous)/1046.5022612023945);m.peak=std::max(m.peak,std::abs(cents));m.mean+=cents;++m.periods;}previous=crossing;}}m.rms=std::sqrt(energy/(end-start));if(m.periods)m.mean/=m.periods;return m;}
void emit(std::ostream&o,const Measure&m){o<<"{\"periods\":"<<m.periods<<",\"meanCents\":";if(m.periods)o<<m.mean;else o<<"null";o<<",\"peakAbsCents\":";if(m.periods)o<<m.peak;else o<<"null";o<<",\"rms\":"<<m.rms<<'}';}
}
int main(int argc,char**argv){try{
 if(argc!=2)throw std::runtime_error("Usage: motion-strength-probe output.json");
 const Shape shapes[]={{"held",.001f,.2f,1,.02f},{"pluck",.001f,.02f,0,.02f},{"long_zero_sustain_decay",.001f,8,0,.02f},{"slow_attack",1,.02f,0,.02f},{"long_release",.001f,.02f,0,10}};
 std::ofstream o(argv[1]);o<<std::setprecision(12)<<"{\"abi\":"<<bs_abi_version()<<",\"rate\":48000,\"key\":84,\"velocity\":0.72,\"speedHz\":0.58,\"frames\":"<<frames<<",\"method\":\"Actual Sine output, interpolated adjacent positive zero crossings. Each attack4-16ms; held late1-3s. No listening judgment.\",\"cases\":[";bool first=true;unsigned count=0;
 for(const auto&shape:shapes)for(unsigned mono:{0u,1u})for(unsigned repeated:{0u,1u})for(float sensitivity:{0.f,.272f,.85f})for(float response:{0.f,1.f}){
  auto*s=bs_create();if(!s)throw std::runtime_error("create failed");std::array<float,BS_PARAMETER_COUNT>p{};for(unsigned i=0;i<p.size();++i)p[i]=bs_parameter_info(i)->default_value;
  p[BS_GAIN]=.5f;p[BS_OSC1_WAVE]=BS_SINE;p[BS_OSC1_LEVEL]=1;p[BS_OSC2_LEVEL]=0;p[BS_FILTER_MIX]=0;p[BS_DRIVE_ENABLED]=0;p[BS_FULLNESS]=0;p[BS_ATTACK]=shape.a;p[BS_DECAY]=shape.d;p[BS_SUSTAIN_LEVEL]=shape.s;p[BS_RELEASE]=shape.r;p[BS_DRIFT_CENTS]=120;p[BS_DRIFT_HZ]=.58f;p[BS_SETTLING_CENTS]=60;p[BS_SETTLING_TIME]=.18f;p[BS_VELOCITY_MOVEMENT]=sensitivity;p[BS_ENVELOPE_RESPONSE]=response;
  for(unsigned i=0;i<p.size();++i)if(!bs_set_parameter(s,i,p[i]))throw std::runtime_error("parameter failed");bs_performance_config perf{};bs_default_performance(&perf);perf.mono=mono;if(!bs_set_performance(s,&perf))throw std::runtime_error("performance failed");bs_reset(s);bs_patch actual{};bs_get_patch(s,&actual);
  std::vector<bs_event>events;const unsigned attacks=repeated?24:1;for(unsigned i=0;i<attacks;++i){const unsigned start=i*5760;events.push_back({start,BS_NOTE_ON,0,84,0,.72f});events.push_back({repeated?start+3840:168000,BS_NOTE_OFF,0,84,0,0});}
  std::vector<float>l(frames),r(frames);std::vector<bs_event>local;local.reserve(2);for(unsigned start=0;start<frames;start+=256){const unsigned n=std::min(256u,frames-start);local.clear();for(auto e:events)if(e.sample_offset>=start&&e.sample_offset<start+n){e.sample_offset-=start;local.push_back(e);}if(bs_render(s,l.data()+start,r.data()+start,n,local.data(),unsigned(local.size())))throw std::runtime_error("render failed");}bs_destroy(s);for(float v:l)if(!std::isfinite(v))throw std::runtime_error("nonfinite");
  if(!first)o<<',';first=false;o<<"\n{\"shape\":\""<<shape.name<<"\",\"mono\":"<<mono<<",\"repeated\":"<<repeated<<",\"sensitivity\":"<<sensitivity<<",\"response\":"<<response<<",\"parameters\":[";for(unsigned i=0;i<p.size();++i){if(i)o<<',';o<<actual.values[i];}o<<"],\"events\":[";for(unsigned i=0;i<events.size();++i){if(i)o<<',';const auto&e=events[i];o<<"{\"sample\":"<<e.sample_offset<<",\"type\":"<<e.type<<",\"channel\":0,\"key\":84,\"velocity\":"<<e.value<<'}';}o<<"],\"attacks\":[";for(unsigned i=0;i<attacks;++i){if(i)o<<',';emit(o,measure(l,i*5760+192,i*5760+768));}o<<"],\"late\":";if(repeated)o<<"null";else emit(o,measure(l,48000,144000));o<<'}';++count;
 }
 o<<"]}\n";if(count!=120||!o)throw std::runtime_error("incomplete");std::cout<<count<<" actual-output Mono/Poly movement cases\n";return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
