// Measurement fixture, not a universal alias-free or listening assertion.
#include "../src/ladder_filter.h"
#include <complex>
#include <vector>
#include <cstdio>
#include <cmath>
#include <algorithm>
constexpr double pi=3.14159265358979323846;
static void fft(std::vector<std::complex<double>>&a){const unsigned n=unsigned(a.size());for(unsigned i=1,j=0;i<n;++i){unsigned bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)std::swap(a[i],a[j]);}for(unsigned len=2;len<=n;len<<=1){auto unit=std::polar(1.,-2*pi/len);for(unsigned start=0;start<n;start+=len){std::complex<double>w=1;for(unsigned j=0;j<len/2;++j){auto u=a[start+j],v=a[start+j+len/2]*w;a[start+j]=u+v;a[start+j+len/2]=u-v;w*=unit;}}}for(auto&v:a)v/=n;}
int main(){constexpr unsigned n=16384;for(unsigned bin:{341u,1707u,3413u})for(double drive:{1.,12.}){
 blocks_detail::LadderFilter one,two;blocks_detail::LadderCoefficients c1,c2;c1.set(6000,.65,48000);c2.set(6000,.65,48000);c1.g=std::tan(pi*6000/48000);c1.refreshLinear();
 std::vector<std::complex<double>>a(n),b(n);double peak1=0,peak2=0;
 for(unsigned i=0;i<4*n;++i){const double input=.4*std::sin(2*pi*bin*i/n);const double x=one.step<true>(input*drive*c1.gain,c1),y=two.processRaw<true>(input,c2,drive,1);if(!std::isfinite(x)||!std::isfinite(y))return 1;if(i>=3*n){a[i-3*n]=x;b[i-3*n]=y;peak1=std::max(peak1,std::abs(x));peak2=std::max(peak2,std::abs(y));}}
 fft(a);fft(b);std::vector<bool>wanted(n/2);for(unsigned h=1;h*bin<n/2;h+=2)wanted[h*bin]=true;double alias1=0,alias2=0,wanted1=0,wanted2=0;
 for(unsigned i=1;i<n/2&&i*48000./n<=20000;++i){if(wanted[i]){wanted1+=std::norm(a[i]);wanted2+=std::norm(b[i]);}else{alias1+=std::norm(a[i]);alias2+=std::norm(b[i]);}}
 std::printf("{\"hz\":%.9f,\"drive\":%.1f,\"cutoff\":6000,\"resonance\":0.65,\"studio_oversampling\":8,\"input_peak\":0.4,\"one_alias_power\":%.12g,\"studio_alias_power\":%.12g,\"alias_reduction_dB\":%.9f,\"one_fundamental_peak\":%.12g,\"studio_fundamental_peak\":%.12g,\"fundamental_change_dB\":%.9f,\"wanted_power_change_dB\":%.9f,\"one_peak\":%.9f,\"studio_peak\":%.9f,\"one_residual\":%.9g,\"studio_residual\":%.9g}\n",48000.*bin/n,drive,alias1,alias2,10*std::log10(alias1/alias2),2*std::abs(a[bin]),2*std::abs(b[bin]),20*std::log10(std::abs(b[bin])/std::abs(a[bin])),10*std::log10(wanted2/wanted1),peak1,peak2,one.worstResidual,two.worstResidual);
 }return 0;}
