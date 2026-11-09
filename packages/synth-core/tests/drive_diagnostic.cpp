#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <complex>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

// Offline host/analysis only. Sound is exclusively bs_render from the real core.
namespace {
constexpr unsigned rate=48000, frames=rate*10, block=256, fftSize=262144;
constexpr double pi=3.14159265358979323846;
struct Case { std::string id; unsigned wave; bool dual; float width,detune; };
struct Metrics { double dc=0,ac=0,stereoAc=0,peak=0,windowMin=1,windowMax=0,fundamental=0,harmonics=0; unsigned clipped=0; };
void quote(std::ostream&o,const std::string&s){o<<'"';for(char c:s){if(c=='"'||c=='\\')o<<'\\';o<<c;}o<<'"';}
void little(std::ostream&o,unsigned n,unsigned bytes){for(unsigned i=0;i<bytes;++i)o.put(char(n>>(8*i)));}
void fft(std::vector<std::complex<double>>&a){
 for(unsigned i=1,j=0;i<a.size();++i){unsigned bit=unsigned(a.size())>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)std::swap(a[i],a[j]);}
 for(unsigned len=2;len<=a.size();len<<=1){const auto wlen=std::polar(1.,-2*pi/len);for(unsigned i=0;i<a.size();i+=len){std::complex<double>w=1;for(unsigned j=0;j<len/2;++j){auto u=a[i+j],v=a[i+j+len/2]*w;a[i+j]=u+v;a[i+j+len/2]=u-v;w*=wlen;}}}
}
double ac(const std::vector<float>&a,unsigned start,unsigned end){double sum=0,p=0;for(unsigned i=start;i<end;++i){sum+=a[i];p+=double(a[i])*a[i];}double n=end-start;return std::sqrt(std::max(0.,p/n-(sum/n)*(sum/n)));}
void analysisSelfTest(){
 // Known mathematical probe validates the analyzer only; never saved as audio.
 constexpr unsigned n=4096,k=37;std::vector<float>probe(n);std::vector<std::complex<double>>bins(n);for(unsigned i=0;i<n;++i){probe[i]=float(.2+.1*std::sin(2*pi*k*i/n));bins[i]=probe[i];}fft(bins);
 if(std::abs(ac(probe,0,n)-.1/std::sqrt(2.))>1e-7||std::abs(bins[0].real()/n-.2)>1e-7||std::abs(2*std::norm(bins[k])/(n*n)-.005)>1e-7)throw std::runtime_error("AC/DC/FFT analysis self-test failed");
}
Metrics measure(const std::vector<float>&l,const std::vector<float>&r,const std::vector<unsigned>&keys,float detune,bool dual){
 Metrics m;std::vector<float>mono(frames);for(unsigned i=0;i<frames;++i){mono[i]=(l[i]+r[i])*.5f;for(float v:{l[i],r[i]}){if(!std::isfinite(v))throw std::runtime_error("Nonfinite core output");m.peak=std::max(m.peak,std::abs(double(v)));if(std::abs(v)>1)++m.clipped;}}
 const unsigned start=rate*3/2,end=rate*9;for(unsigned i=start;i<end;++i)m.dc+=mono[i];m.dc/=end-start;m.ac=ac(mono,start,end);const double al=ac(l,start,end),ar=ac(r,start,end);m.stereoAc=std::sqrt((al*al+ar*ar)*.5);
 for(unsigned i=start;i+rate/4<=end;i+=rate/4){double v=ac(mono,i,i+rate/4);m.windowMin=std::min(m.windowMin,v);m.windowMax=std::max(m.windowMax,v);}
 std::vector<std::complex<double>>spectrum(fftSize);double windowPower=0;for(unsigned i=0;i<fftSize;++i){double w=.5-.5*std::cos(2*pi*i/(fftSize-1));spectrum[i]=(mono[rate*2+i]-m.dc)*w;windowPower+=w*w;}fft(spectrum);
 // Union bands around both oscillator frequencies. Chord partials can overlap;
 // these are aggregate band energies, not isolated oscillator amplitudes/THD.
 std::vector<bool>fund(fftSize/2,false),harm(fftSize/2,false);
 for(unsigned key:keys)for(unsigned osc=0;osc<(dual?2u:1u);++osc){double f=440*std::pow(2.,(double(key)-69)/12.+(osc?detune:0)/1200.);for(unsigned h=1;h<=8;++h){int bin=int(std::lround(f*h*fftSize/rate));for(int b=bin-3;b<=bin+3;++b)if(b>0&&unsigned(b)<fftSize/2)(h==1?fund:harm)[unsigned(b)]=true;}}
 for(unsigned i=1;i<fftSize/2;++i){double power=2*std::norm(spectrum[i])/(fftSize*windowPower);if(fund[i])m.fundamental+=power;else if(harm[i])m.harmonics+=power;}
 return m;
}
void wav(const std::string&path,const std::vector<float>&l,const std::vector<float>&r){std::ofstream o(path,std::ios::binary);unsigned n=unsigned(l.size());o.write("RIFF",4);little(o,36+n*4,4);o.write("WAVEfmt ",8);little(o,16,4);little(o,1,2);little(o,2,2);little(o,rate,4);little(o,rate*4,4);little(o,4,2);little(o,16,2);o.write("data",4);little(o,n*4,4);for(unsigned i=0;i<n;++i)for(float x:{l[i],r[i]})little(o,uint16_t(int16_t(std::lround(std::clamp(x,-1.f,1.f)*32767))),2);if(!o)throw std::runtime_error("WAV write failed");}
std::array<float,BS_PARAMETER_COUNT> patch(const Case&c,float drive){
 std::array<float,BS_PARAMETER_COUNT>p{};for(unsigned i=0;i<p.size();++i)p[i]=bs_parameter_info(i)->default_value;
 p[BS_GAIN]=.3f;p[BS_OSC_MIX]=c.dual?.5f:0;p[BS_OSC2_DETUNE]=c.detune;p[BS_PULSE_WIDTH]=c.width;p[BS_ATTACK]=.01f;p[BS_DECAY]=.1f;p[BS_SUSTAIN_LEVEL]=1;p[BS_RELEASE]=.1f;p[BS_ATTACK_BEND]=p[BS_DECAY_BEND]=p[BS_RELEASE_BEND]=0;
 p[BS_CUTOFF]=6000;p[BS_DRIVE]=drive;p[BS_DRIFT_CENTS]=0;p[BS_PITCH_DROP_CENTS]=0;p[BS_FULLNESS]=0;p[BS_OSC1_WAVE]=c.dual?BS_SAW:c.wave;p[BS_OSC2_WAVE]=c.wave;
 p[BS_OSC1_LEVEL]=c.dual?.5f:1;p[BS_OSC2_LEVEL]=c.dual?.5f:0;p[BS_FILTER_MIX]=1;p[BS_FILTER_AMOUNT]=0;p[BS_SETTLING_CENTS]=0;p[BS_VELOCITY_MOVEMENT]=0;
 return p;
}
}
int main(int argc,char**argv){try{
 if(argc!=2)throw std::runtime_error("Usage: drive-diagnostic existing-output-directory");
 if(!((bs_abi_version()==4&&bs_parameter_count()==35)||(bs_abi_version()==5&&bs_parameter_count()==40)||(bs_abi_version()==6&&bs_parameter_count()==42)))throw std::runtime_error("Requires a coherent ABI4/35, ABI5/40 or ABI6/42 core");
 analysisSelfTest();
 std::vector<Case>cases={{"single-saw",BS_SAW,false,.5f,0},{"single-square",BS_SQUARE,false,.5f,0},{"single-pulse50",BS_PULSE,false,.5f,0},{"single-pulse6592",BS_PULSE,false,.6592f,0}};
 for(float detune:{0.f,4.8f,20.f})for(unsigned kind=0;kind<3;++kind)cases.push_back({"dual-"+std::string(kind==0?"square":kind==1?"pulse50":"pulse6592")+"-"+std::to_string(detune),kind==0?unsigned(BS_SQUARE):unsigned(BS_PULSE),true,kind==2?.6592f:.5f,detune});
 std::ofstream json(std::string(argv[1])+"/matrix.json");json<<std::setprecision(12)<<"{\"fixtureVersion\":1,\"abiVersion\":"<<bs_abi_version()<<",\"sampleRate\":"<<rate<<",\"framesPerCase\":"<<frames<<",\"blockFrames\":"<<block<<",\"normalized\":false,\"steadyIntervalSeconds\":[1.5,9],\"fftIntervalSeconds\":[2,"<<2.+double(fftSize)/rate<<"],\"fftSize\":"<<fftSize<<",\"fftWindow\":\"Hann; power normalized by window energy\",\"harmonicBands\":\"Union of plus/minus3 FFT bins around actual oscillator fundamentals and harmonics2..8; fundamental bins excluded from higher-harmonic union; chord overlap prevents isolated-voice THD interpretation\",\"cases\":[";
 bool first=true;unsigned count=0;
 for(unsigned phrase=0;phrase<2;++phrase){std::vector<unsigned>keys=phrase?std::vector<unsigned>{48,55,60,64}:std::vector<unsigned>{36};std::vector<float>clipL,clipR;
 for(const auto&c:cases)for(float drive:{1.f,2.f,4.f,8.f,12.f}){
  auto p=patch(c,drive);if(p.size()>35)p[35]=0;bs_synth*s=bs_create();if(!s||!bs_prepare(s,rate))throw std::runtime_error("Core prepare failed");for(unsigned i=0;i<p.size();++i)if(!bs_set_parameter(s,i,p[i]))throw std::runtime_error("Parameter rejected");bs_reset(s);bs_patch actual{};bs_get_patch(s,&actual);
  std::vector<bs_event>events;for(unsigned key:keys)events.push_back({rate/5,BS_NOTE_ON,0,key,0,.72f});for(unsigned key:keys)events.push_back({rate*19/2,BS_NOTE_OFF,0,key,0,0});
  std::vector<float>l(frames),r(frames);std::vector<bs_event>local;local.reserve(events.size());for(unsigned start=0;start<frames;start+=block){unsigned n=std::min(block,frames-start);local.clear();for(auto e:events)if(e.sample_offset>=start&&e.sample_offset<start+n){e.sample_offset-=start;local.push_back(e);}if(bs_render(s,l.data()+start,r.data()+start,n,local.data(),unsigned(local.size())))throw std::runtime_error("Render event error");}unsigned voices=bs_active_voices(s);bs_destroy(s);
  auto m=measure(l,r,keys,c.detune,c.dual);if(m.clipped||voices)throw std::runtime_error("Clipped/uncleared case");
  if(!first)json<<',';first=false;json<<"\n{\"id\":";quote(json,c.id+(phrase?"-chord":"-bass")+"-drive"+std::to_string(int(drive)));json<<",\"configuration\":";quote(json,c.id);json<<",\"phrase\":\""<<(phrase?"chord":"bass")<<"\",\"drive\":"<<drive<<",\"parameters\":[";
  for(unsigned i=0;i<p.size();++i){if(i)json<<',';json<<"{\"id\":"<<i<<",\"name\":";quote(json,bs_parameter_info(i)->name);json<<",\"value\":"<<actual.values[i]<<'}';}json<<"],\"events\":[";for(unsigned i=0;i<events.size();++i){if(i)json<<',';const auto&e=events[i];json<<"{\"sampleOffset\":"<<e.sample_offset<<",\"type\":"<<e.type<<",\"channel\":"<<e.channel<<",\"key\":"<<e.key<<",\"value\":"<<e.value<<'}';}
  json<<"],\"metrics\":{\"monoDc\":"<<m.dc<<",\"monoAcRms\":"<<m.ac<<",\"stereoAcRms\":"<<m.stereoAc<<",\"peak\":"<<m.peak<<",\"window250msAcMin\":"<<m.windowMin<<",\"window250msAcMax\":"<<m.windowMax<<",\"fundamentalBandPower\":"<<m.fundamental<<",\"higherHarmonicBandPower\":"<<m.harmonics<<",\"clippedSamples\":"<<m.clipped<<",\"voicesAtEnd\":"<<voices<<"}}";
  if(c.dual&&c.width==.6592f&&c.detune==4.8f){clipL.insert(clipL.end(),l.begin(),l.end());clipR.insert(clipR.end(),r.begin(),r.end());}++count;
 }
 wav(std::string(argv[1])+(phrase?"/drive-chord.wav":"/drive-bass.wav"),clipL,clipR);
 }
 json<<"\n]}\n";if(!json||count!=130)throw std::runtime_error("Incomplete matrix");std::cout<<count<<" actual-core cases rendered\n";return 0;
 }catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
