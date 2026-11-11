#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <complex>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>
namespace {
constexpr unsigned rate=48000,frames=rate*8,block=256,nfft=262144;
constexpr double pi=3.14159265358979323846;
struct Fixture{const char*id;std::vector<unsigned>keys;bool single;unsigned wave;float detune,width;};
void quote(std::ostream&o,const std::string&s){o<<'"';for(char c:s){if(c=='"'||c=='\\')o<<'\\';o<<c;}o<<'"';}
void little(std::ostream&o,unsigned n,unsigned bytes){for(unsigned i=0;i<bytes;++i)o.put(char(n>>(8*i)));}
void fft(std::vector<std::complex<double>>&a){for(unsigned i=1,j=0;i<a.size();++i){unsigned b=unsigned(a.size())>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j)std::swap(a[i],a[j]);}for(unsigned len=2;len<=a.size();len<<=1){const auto step=std::polar(1.,-2*pi/len);for(unsigned i=0;i<a.size();i+=len){std::complex<double>w=1;for(unsigned j=0;j<len/2;++j){auto x=a[i+j],y=w*a[i+j+len/2];a[i+j]=x+y;a[i+j+len/2]=x-y;w*=step;}}}}
struct Measurement{double rms=0,dc=0,peak=0,low=0,high=0,fund=0;};
Measurement measure(const std::vector<float>&l,const std::vector<float>&r,const Fixture&f){
 Measurement m;double power=0;for(unsigned i=0;i<frames;++i){for(float x:{l[i],r[i]}){if(!std::isfinite(x))throw std::runtime_error("Nonfinite");m.peak=std::max(m.peak,std::abs(double(x)));}if(i>=rate&&i<7*rate){const double x=(l[i]+r[i])*.5;m.dc+=x;power+=x*x;}}m.dc/=6*rate;m.rms=std::sqrt(std::max(0.,power/(6*rate)-m.dc*m.dc));
 std::vector<std::complex<double>>a(nfft);double windowPower=0;for(unsigned i=0;i<nfft;++i){const double w=.5-.5*std::cos(2*pi*i/(nfft-1));a[i]=((l[rate+i]+r[rate+i])*.5-m.dc)*w;windowPower+=w*w;}fft(a);
 std::vector<bool>fund(nfft/2,false);for(unsigned key:f.keys)for(unsigned osc=0;osc<(f.single?1u:2u);++osc){const double hz=440*std::exp2((double(key)-69)/12+(osc?f.detune:0)/1200.);const int center=int(std::lround(hz*nfft/rate));for(int b=center-3;b<=center+3;++b)if(b>0&&unsigned(b)<fund.size())fund[unsigned(b)]=true;}
 for(unsigned i=1;i<nfft/2;++i){double hz=double(i)*rate/nfft,p=2*std::norm(a[i])/(nfft*windowPower);if(hz>=30&&hz<=250)m.low+=p;if(hz>=1000&&hz<=10000)m.high+=p;if(fund[i])m.fund+=p;}return m;
}
void wav(const std::string&path,const std::vector<float>&l,const std::vector<float>&r){std::ofstream o(path,std::ios::binary);const unsigned n=unsigned(l.size());o.write("RIFF",4);little(o,36+n*4,4);o.write("WAVEfmt ",8);little(o,16,4);little(o,1,2);little(o,2,2);little(o,rate,4);little(o,rate*4,4);little(o,4,2);little(o,16,2);o.write("data",4);little(o,n*4,4);for(unsigned i=0;i<n;++i)for(float x:{l[i],r[i]})little(o,uint16_t(int16_t(std::lround(std::clamp(x,-1.f,1.f)*32767))),2);if(!o)throw std::runtime_error("WAV write failed");}
}
int main(int argc,char**argv){try{
 if(argc!=2)throw std::runtime_error("Usage: fullness-comparison output-directory");
 const std::vector<Fixture>fixtures={{"saw-bass",{36},true,BS_SAW,0,.5f},{"flat-bass",{36},false,BS_SAW,0,.6592f},{"detuned-bass",{36},false,BS_SAW,4.8f,.6592f},{"detuned-chord",{48,55,60,64},false,BS_SAW,4.8f,.6592f},{"sine-bass",{36},true,BS_SINE,0,.5f},{"sine-high",{84},true,BS_SINE,0,.5f}};
 std::ofstream out(std::string(argv[1])+"/measurements.json");out<<std::setprecision(12)<<"{\"fixtureVersion\":1,\"abiVersion\":"<<bs_abi_version()<<",\"parameterCount\":"<<bs_parameter_count()<<",\"sampleRate\":"<<rate<<",\"framesPerCase\":"<<frames<<",\"normalized\":false,\"analysis\":\"AC mono RMS1-7s; Hann FFT262144 samples from1s; low30-250Hz/high1-10kHz; fundamental union+/-3bins includes bothdetuned oscillators\",\"cases\":[";
 bool first=true;unsigned count=0;
 for(unsigned order=0;order<(BS_PARAMETER_COUNT>38?2u:1u);++order)for(const auto&f:fixtures){std::vector<float>clipL,clipR;
 for(float drive:{1.f,4.f,12.f})for(float fullness:{0.f,.25f,.5f,.75f,1.f}){
  bs_synth*s=bs_create();if(!s||!bs_prepare(s,rate))throw std::runtime_error("Prepare failed");std::array<float,BS_PARAMETER_COUNT>p{};for(unsigned i=0;i<p.size();++i)p[i]=bs_parameter_info(i)->default_value;
  p[BS_GAIN]=.3f;p[BS_ATTACK]=.01f;p[BS_DECAY]=.1f;p[BS_SUSTAIN_LEVEL]=1;p[BS_RELEASE]=.1f;p[BS_OSC1_WAVE]=f.wave;p[BS_OSC2_WAVE]=f.single?f.wave:BS_PULSE;p[BS_OSC1_LEVEL]=f.single?1:.5f;p[BS_OSC2_LEVEL]=f.single?0:.5f;p[BS_OSC2_DETUNE]=f.detune;p[BS_PULSE_WIDTH]=f.width;p[BS_CUTOFF]=6000;p[BS_DRIVE]=drive;p[BS_FULLNESS]=fullness;p[BS_DRIFT_CENTS]=p[BS_SETTLING_CENTS]=p[BS_VELOCITY_MOVEMENT]=p[BS_PITCH_DROP_CENTS]=p[BS_FILTER_AMOUNT]=0;p[BS_FILTER_MIX]=1;if(p.size()>35)p[35]=0;if(p.size()>38)p[38]=float(order);
  for(unsigned i=0;i<p.size();++i)if(!bs_set_parameter(s,i,p[i]))throw std::runtime_error("Parameter rejected");bs_reset(s);bs_patch actual{};bs_get_patch(s,&actual);
  std::vector<bs_event>events;for(unsigned key:f.keys)events.push_back({rate/5,BS_NOTE_ON,0,key,0,.72f});for(unsigned key:f.keys)events.push_back({rate*15/2,BS_NOTE_OFF,0,key,0,0});std::vector<float>l(frames),r(frames);std::vector<bs_event>local;local.reserve(events.size());
  for(unsigned start=0;start<frames;start+=block){const unsigned n=std::min(block,frames-start);local.clear();for(auto e:events)if(e.sample_offset>=start&&e.sample_offset<start+n){e.sample_offset-=start;local.push_back(e);}if(bs_render(s,l.data()+start,r.data()+start,n,local.data(),unsigned(local.size())))throw std::runtime_error("Render rejected events");}if(bs_active_voices(s))throw std::runtime_error("Uncleared voice");bs_destroy(s);const auto m=measure(l,r,f);if(m.peak>=1||m.rms<1e-7)throw std::runtime_error("Invalid signal");
  uint64_t pcmHash=14695981039346656037ull;for(unsigned i=0;i<frames;++i)for(float x:{l[i],r[i]}){uint32_t bits=0;std::memcpy(&bits,&x,4);for(unsigned b=0;b<4;++b){pcmHash^=(bits>>(b*8))&255;pcmHash*=1099511628211ull;}}
  if(!first)out<<',';first=false;out<<"\n{\"fixture\":";quote(out,f.id);out<<",\"order\":"<<order<<",\"drive\":"<<drive<<",\"fullness\":"<<fullness<<",\"floatPcmFnv64\":\""<<std::hex<<pcmHash<<std::dec<<"\",\"parameters\":[";for(unsigned i=0;i<p.size();++i){if(i)out<<',';out<<"{\"id\":"<<i<<",\"value\":"<<actual.values[i]<<'}';}out<<"],\"events\":[";for(unsigned i=0;i<events.size();++i){if(i)out<<',';const auto&e=events[i];out<<"{\"sampleOffset\":"<<e.sample_offset<<",\"type\":"<<e.type<<",\"channel\":0,\"key\":"<<e.key<<",\"value\":"<<e.value<<'}';}out<<"],\"metrics\":{\"acRms\":"<<m.rms<<",\"dc\":"<<m.dc<<",\"peak\":"<<m.peak<<",\"lowPower\":"<<m.low<<",\"highPower\":"<<m.high<<",\"fundamentalPower\":"<<m.fund<<"}}";
  if(fullness==0||fullness==1){clipL.insert(clipL.end(),l.begin(),l.end());clipR.insert(clipR.end(),r.begin(),r.end());}++count;
 }
 if(std::string(f.id)=="detuned-bass"||std::string(f.id)=="detuned-chord")wav(std::string(argv[1])+"/"+f.id+"-order"+std::to_string(order)+".wav",clipL,clipR);
 }
 out<<"\n]}\n";if(!out||count!=(BS_PARAMETER_COUNT>38?180u:90u))throw std::runtime_error("Incomplete matrix");std::cout<<count<<" Fullness fixtures rendered\n";return 0;
 }catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
