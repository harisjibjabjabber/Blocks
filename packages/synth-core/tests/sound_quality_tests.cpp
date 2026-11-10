#include "blocks_synth.h"
#include "blocks_sound.h"
#include "blocks_voicing.h"
#include "../src/ladder_filter.h"
#include <array>
#include <cmath>
#include <complex>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <vector>
#include <chrono>
#include <new>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(void*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d: %s\n",__LINE__,#x);std::exit(1);}}while(false)
constexpr double pi=3.14159265358979323846;
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));}~Synth(){bs_destroy(p);}};
static std::vector<float> render(bs_synth*s,unsigned n,unsigned block){std::vector<float>a(n*2);for(unsigned t=0;t<n;t+=block){const auto count=std::min(block,n-t);watch=true;const int result=bs_render(s,a.data()+t,a.data()+n+t,count,nullptr,0);watch=false;CHECK(result==0);}return a;}
int main(){
 {Synth s;bs_sound_config c{},before{};bs_default_sound(&c);CHECK(sizeof(c)==16&&c.version==1&&c.oscillator==0&&c.filter_model==0&&c.filter_drive==1);CHECK(bs_get_sound(s.p,&before));for(unsigned field=0;field<4;++field){auto bad=c;if(field==0)bad.version=2;if(field==1)bad.oscillator=2;if(field==2)bad.filter_model=2;if(field==3)bad.filter_drive=std::numeric_limits<float>::quiet_NaN();CHECK(!bs_set_sound(s.p,&bad));bs_sound_config after{};CHECK(bs_get_sound(s.p,&after)&&std::memcmp(&before,&after,16)==0);}CHECK(!bs_set_sound(nullptr,&c)&&!bs_set_sound(s.p,nullptr));}
 std::puts("PASS additive sound ABI/default and atomic rejection");
 {Synth a,b;bs_sound_config c{};bs_default_sound(&c);CHECK(bs_set_sound(b.p,&c));for(auto*s:{a.p,b.p}){bs_note_on(s,0,48,1);bs_note_on(s,0,60,.7f);}CHECK(render(a.p,12000,127)==render(b.p,12000,127));}
 std::puts("PASS explicit Legacy equals unchanged default path exactly");
 {double maximum=0;unsigned cases=0;for(double rate:{8000.,44100.,48000.,96000.,192000.,384000.})for(double cutoff:{20.,200.,2000.,20000.})for(double resonance:{0.,.5,1.})for(double drive:{1.,12.}){blocks_detail::LadderFilter f;blocks_detail::LadderCoefficients c;c.set(cutoff,resonance,rate);for(unsigned i=0;i<4096;++i){const double x=(i<2048?.8:0)*std::sin(2*pi*std::min(440.,rate*.2)*i/rate);const double y=f.processRaw<true>(x,c,drive,1);CHECK(std::isfinite(y)&&std::abs(y)<4);maximum=std::max(maximum,f.worstResidual);}++cases;}std::printf("METRIC ladder bounded matrix cases=%u worst implicit residual=%.9g\n",cases,maximum);CHECK(maximum<1e-6);}
 std::puts("PASS nonlinear simultaneous feedback converges over supported rates/cutoffs/resonance/drive");
 {blocks_detail::LadderCoefficients c;c.set(1000,0,48000);blocks_detail::LadderFilter dry;const auto&h=dry.taps();for(unsigned i=0;i<64;++i){const double y=dry.process<true>(i==0?1:0,c,1,0);double expected=0;for(unsigned j=0;j<h.size();++j){const int k=int(8*i)-int(j);if(k>=0&&unsigned(k)<h.size())expected+=8*h[j]*h[unsigned(k)];}CHECK(std::abs(y-expected)<1e-12);}double low=0,high=0;for(auto entry:{std::pair<double,double*>{100.,&low},{4000.,&high}}){blocks_detail::LadderFilter f;for(unsigned i=0;i<48000;++i){const double y=f.process<true>(.0001*std::sin(2*pi*entry.first*i/48000),c,1,1);if(i>24000)*entry.second+=y*y;}}CHECK(high<low*.0001);std::printf("METRIC ladder4000Hz/100Hz RMS=%.7g\n",std::sqrt(high/low));}
 std::puts("PASS aligned filtered dry and steep four-pole rejection");
 {double worst=0;unsigned cases=0;for(double rate:{8000.,48000.,96000.})for(double cutoff:{100.,1000.,2000.})for(double resonance:{0.,.5,1.}){
  blocks_detail::LadderFilter f;blocks_detail::LadderCoefficients c;c.set(cutoff,resonance,rate);const std::array<double,3>hz{{cutoff*.2,cutoff,std::min(rate*.4,cutoff*2)}};std::array<std::complex<double>,3> measured{};
  for(unsigned i=0;i<unsigned(rate*3);++i){const double y=f.process<true>(i==0?1e-7:0,c,1,1)/1e-7;for(unsigned j=0;j<3;++j)measured[j]+=y*std::polar(1.,-2*pi*hz[j]*i/rate);}
  for(unsigned j=0;j<3;++j){std::complex<double> expected=0;for(unsigned image=0;image<8;++image){const double omega=2*pi*hz[j]/(8*rate)+2*pi*image/8;const auto z=std::polar(1.,-omega);const auto pole=c.g*(1.+z)/((1+c.g)+(c.g-1)*z);const auto p4=pole*pole*pole*pole;const auto transfer=c.gain*p4/(1.+c.feedback*p4);std::complex<double> h=0;const auto&taps=f.taps();for(unsigned n=0;n<127;++n)h+=taps[n]*std::polar(1.,-omega*n);expected+=h*h*transfer;}const double error=std::abs(measured[j]-expected)/std::max(.001,std::abs(expected));worst=std::max(worst,error);if(error>=1e-5)std::printf("FAILCASE rate=%g cutoff=%g res=%g hz=%g measured=(%.9g,%.9g) expected=(%.9g,%.9g) err=%.9g\n",rate,cutoff,resonance,hz[j],measured[j].real(),measured[j].imag(),expected.real(),expected.imag(),error);CHECK(error<1e-5);++cases;}
 }std::printf("METRIC ladder measured complex transfer cases=%u max relative error=%.9g\n",cases,worst);}
 std::puts("PASS actual small-signal ladder magnitude and phase match simultaneous feedback plus all eight FIR images");
 {Synth a,b;bs_sound_config c{1,1,1,4};for(auto*s:{a.p,b.p}){CHECK(bs_set_sound(s,&c));bs_set_parameter(s,BS_CUTOFF,1800);bs_set_parameter(s,BS_FILTER_RESONANCE,.75f);bs_reset(s);bs_voicing_config v{1,7,10,.6f};CHECK(bs_set_voicing(s,&v));for(unsigned n=0;n<4;++n)bs_note_on(s,0,36+n*7,.8f);}const auto x=render(a.p,12000,1),y=render(b.p,12000,127);CHECK(x==y);double energy=0;for(auto v:x){CHECK(std::isfinite(v)&&std::abs(v)<=1);energy+=v*v;}CHECK(energy>1e-6);c={1,0,0,1};CHECK(bs_set_sound(a.p,&c));CHECK(bs_active_voices(a.p)==4);render(a.p,1024,128);bs_panic(a.p);auto silence=render(a.p,1024,128);for(auto v:silence)CHECK(v==0);CHECK(allocations==0);}
 std::puts("PASS Studio plus ladder with seven-copy voices, live mode edit and panic");
 {double error=0;for(int n=-40000;n<=40000;++n){const double x=n/10000.;const auto s=blocks_detail::LadderFilter::shape(x);error=std::max(error,std::abs(s.value-std::tanh(x)));CHECK(s.derivative>0&&s.derivative<=1);}CHECK(error<1.5e-5);std::printf("METRIC nonlinear approximation max absolute error=%.9g\n",error);}
 std::puts("PASS nonlinear approximation accuracy and monotonic derivative");
 {double residual=0,peak=0;for(double rate:{8000.,48000.,192000.,384000.}){blocks_detail::LadderFilter f;blocks_detail::LadderCoefficients c;for(unsigned i=0;i<16000;++i){c.set(i%127<63?20:20000,i%173<86?0:1,rate);const double drive=i%251<125?1:12;const double y=f.processRaw<true>(i%97<48?2.:-2.,c,drive,double(i%100)/99);CHECK(std::isfinite(y)&&std::abs(y)<8);peak=std::max(peak,std::abs(y));}residual=std::max(residual,f.worstResidual);}std::printf("METRIC adversarial step-modulation peak=%.7g residual=%.7g\n",peak,residual);CHECK(residual<1e-5);}
 std::puts("PASS un-smoothed adversarial drive/cutoff/resonance and Mix switching");
 {double minimumGrowth=100,maximumGrowth=-100;unsigned cases=0;
  for(unsigned wave:{unsigned(BS_TRIANGLE),unsigned(BS_SAW)})for(unsigned key:{36u,60u,84u})for(double cutoff:{6000.,20000.}){
   double energy[2]{};for(unsigned option=0;option<2;++option){Synth s;const bs_sound_config c{1,1,1,option?12.f:1.f};CHECK(bs_set_sound(s.p,&c));
    for(auto pair:{std::pair<unsigned,float>{BS_OSC1_LEVEL,1},{BS_OSC2_LEVEL,0},{BS_OSC1_WAVE,float(wave)},{BS_DRIVE_ENABLED,0},{BS_FULLNESS_ENABLED,0},{BS_CUTOFF,float(cutoff)},{BS_FILTER_RESONANCE,.3f},{BS_ATTACK,.001f},{BS_SUSTAIN_LEVEL,1},{BS_GAIN,.15f}})CHECK(bs_set_parameter(s.p,pair.first,pair.second));
    bs_reset(s.p);bs_note_on(s.p,0,key,1);const auto audio=render(s.p,16384,128);for(unsigned i=8192;i<16384;++i)energy[option]+=double(audio[i])*audio[i];
   }const double growth=10*std::log10(energy[1]/energy[0]);minimumGrowth=std::min(minimumGrowth,growth);maximumGrowth=std::max(maximumGrowth,growth);CHECK(growth>-.1&&growth<10);++cases;
  }std::printf("METRIC actual-core raw Ladder Drive12/1 RMS cases=%u min=%.6fdB max=%.6fdB\n",cases,minimumGrowth,maximumGrowth);
 }
 std::puts("PASS full-level Triangle/Saw bass-to-high Drive adds density and level without the old maximum-drive sink");
 {Synth a,b;bs_sound_config c{1,1,1,1};for(auto*s:{a.p,b.p}){CHECK(bs_set_sound(s,&c));bs_voicing_config v{1,7,12,.8f};CHECK(bs_set_voicing(s,&v));bs_set_parameter(s,BS_OSC2_LEVEL,0);bs_set_parameter(s,BS_CUTOFF,20000);bs_set_parameter(s,BS_SUSTAIN_LEVEL,1);bs_reset(s);for(unsigned key:{48u,55u,60u,64u})bs_note_on(s,0,key,.8f);}
  for(float drive:{1.f,12.f,2.f,8.f,1.f}){c.filter_drive=drive;CHECK(bs_set_sound(a.p,&c)&&bs_set_sound(b.p,&c));CHECK(render(a.p,4096,1)==render(b.p,4096,127));CHECK(bs_active_voices(a.p)==4);}CHECK(allocations==0);
 }
 std::puts("PASS live raw-Drive sweeps keep seven-copy chord ownership and exact sample-block invariance without render allocations");
 {Synth s;bs_sound_config c{1,1,1,6};CHECK(bs_set_sound(s.p,&c));bs_set_parameter(s.p,BS_CUTOFF,1500);bs_set_parameter(s.p,BS_FILTER_RESONANCE,.6f);bs_reset(s.p);for(unsigned n=0;n<16;++n)bs_note_on(s.p,0,36+n*3,.7f);const auto start=std::chrono::steady_clock::now();const auto a=render(s.p,24000,128);const double elapsed=std::chrono::duration<double>(std::chrono::steady_clock::now()-start).count();std::printf("METRIC Studio+ladder16notes desktop WASM ms/audio-second=%.3f\n",elapsed*2000);}
}
