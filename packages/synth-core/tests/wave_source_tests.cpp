#include "../src/wave_source.h"
#include <complex>
#include <vector>
#include <cstdio>
#include <cstdlib>
#include <new>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(auto*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(0)
using Source=blocks_detail::StudioOscillator;
constexpr double pi=3.14159265358979323846;
static double blep(double p,double d){if(p<d){double x=p/d;return x+x-x*x-1;}if(p>1-d){double x=(p-1)/d;return x*x+x+x+1;}return 0;}
static double legacy(unsigned wave,double p,double d,double w){if(wave==1)return blocks_detail::triangle(p,d);if(wave==2)return 2*p-1-blep(p,d);double q=p-w;q-=std::floor(q);return(p<w?1:-1)+blep(p,d)-blep(q,d);}
static void fft(std::vector<std::complex<double>>&a){const unsigned n=unsigned(a.size());for(unsigned i=1,j=0;i<n;++i){unsigned bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)std::swap(a[i],a[j]);}for(unsigned len=2;len<=n;len<<=1){const auto unit=std::polar(1.,-2*pi/len);for(unsigned start=0;start<n;start+=len){std::complex<double>w=1;for(unsigned j=0;j<len/2;++j){auto u=a[start+j],v=a[start+j+len/2]*w;a[start+j]=u+v;a[start+j+len/2]=u-v;w*=unit;}}}for(auto&v:a)v/=n;}
struct Spectrum{double alias=0,wantedError=0,fundamental=0;};
static Spectrum spectrum(unsigned wave,unsigned bin,double width,bool studio){constexpr unsigned n=65536;std::vector<std::complex<double>>data(n);std::vector<double>expected(n/2);const double step=double(bin)/n;for(unsigned i=0;i<n;++i){double p=std::fmod(i*step,1.);data[i]=studio?Source::sample(wave,p,step,width):legacy(wave,p,step,width);}fft(data);for(unsigned h=1;h*bin<n/2;++h){double value=wave==1?(h%2?4/(pi*pi*h*h):0):wave==2?1/(pi*h):std::abs(std::polar(1.,-2*pi*h*width)-1.)/(pi*h);expected[h*bin]=value;}Spectrum s;s.fundamental=std::abs(data[bin]);for(unsigned i=1;i<n/2&&i*48000./n<=20000;++i)if(expected[i]>1e-14)s.wantedError+=std::pow(std::abs(data[i])-expected[i],2);else s.alias+=std::norm(data[i]);return s;}
int main(){
 {for(unsigned wave=0;wave<5;++wave)for(double p:{-.1,0.,.1234567,.5,.999999,1.1}){std::array<double,5>w{};w[wave]=1;CHECK(Source::mix(w,p,.01,.3)==Source::sample(wave,p,.01,.3));CHECK(Source::sample(4,p,.01,.1)==Source::sample(3,p,.01,.5));CHECK(Source::sample(0,p,.01)==blocks_detail::sine(p));}std::array<double,5>w{.1,.2,.3,.25,.15};double sum=0;for(unsigned i=0;i<5;++i)sum+=w[i]*Source::sample(i,.345,.001,.7);CHECK(Source::mix(w,.345,.001,.7)==sum);}
 std::puts("PASS Studio source pure weighted mix, unchanged sine and fixed-duty Square");
 {double worstRatio=0;for(unsigned wave:{2u,3u})for(unsigned key:{24u,48u,72u,96u,108u})for(double width:{.1,.5,.9}){unsigned bin=unsigned(std::round(440*std::exp2((double(key)-69)/12)*65536/48000));if(!(bin&1))++bin;auto a=spectrum(wave,bin,width,false),b=spectrum(wave,bin,width,true);CHECK(b.alias<a.alias*.01);CHECK(b.wantedError<a.wantedError);CHECK(b.fundamental>.999*(wave==2?1/pi:std::abs(std::polar(1.,-2*pi*width)-1.)/pi));worstRatio=std::max(worstRatio,b.alias/a.alias);}std::printf("METRIC worst Studio/Legacy unwanted-bin energy %.9g\n",worstRatio);}
 std::puts("PASS actual source spectra improve unwanted energy and wanted partial fidelity across pitch/PW matrix");
 {for(unsigned bin:{45u,357u,2859u,5715u}){auto a=spectrum(1,bin,.5,false),b=spectrum(1,bin,.5,true);CHECK(b.fundamental>4/(pi*pi)*.9999);CHECK(b.wantedError<a.wantedError*.05);}}
 std::puts("PASS Studio triangle preserves fundamental and improves wanted upper partials");
 {double worst=0;for(unsigned level=1;level<blocks_detail::studio_tables::count;++level)for(double edge:{1.,1.02})for(unsigned i=0;i<32;++i)for(unsigned wave:{1u,2u,3u}){double step=.49/(blocks_detail::studio_tables::levels[level].harmonic*edge),p=double(i)/32;double a=Source::sample(wave,p,step*(1-1e-9),.3),b=Source::sample(wave,p,step*(1+1e-9),.3);worst=std::max(worst,std::abs(a-b));CHECK(std::abs(a-b)<1e-7);}std::printf("METRIC largest tier-edge delta %.9g\n",worst);}
 std::puts("PASS phase-continuous mip boundaries at both ends of every smooth transition");
 {double peak=0;watch=true;for(double rate:{8000.,44100.,48000.,96000.,192000.,384000.})for(unsigned wave=0;wave<5;++wave){double p=0;for(unsigned i=0;i<24000;++i){double hz=8.1757989156*std::exp2(10.*i/24000),step=std::min(.45,hz/rate),width=.5+.4*std::sin(i*.013);double x=Source::sample(wave,p,step,width);CHECK(std::isfinite(x)&&std::abs(x)<2);peak=std::max(peak,std::abs(x));CHECK(x==Source::sample(wave,p,step,width));p+=step;p-=std::floor(p);}}watch=false;CHECK(allocations==0);std::printf("METRIC all-rate pitch/PWM sweep peak %.9g\n",peak);}
 std::puts("PASS 8-384kHz source sweeps, bounded deterministic output and zero render allocation");
 {for(double width:{.1,.3,.5,.7,.9}){double sum=0;constexpr unsigned n=65536;for(unsigned i=0;i<n;++i)sum+=Source::sample(3,double(i)/n,.001,width);CHECK(std::abs(sum/n-(2*width-1))<1e-7);}}
 std::puts("PASS stationary Pulse preserves documented duty-dependent DC mean");
}
