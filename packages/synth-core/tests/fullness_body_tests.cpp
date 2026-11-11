#include "../src/fullness.h"
#include <complex>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL line%d: %s\n",__LINE__,#x);std::exit(1);}}while(false)
int main(){
 constexpr double pi=3.14159265358979323846;
 // Independent complex response verifies the additive body cannot cancel dry,
 // including frequencies outside the useful bass band and all supported rates.
 double minReal=1,maxGain=0;
 for(double rate:{8000.,44100.,48000.,96000.,384000.}){
  const double a=1-std::exp(-2*pi*180/rate),b=a/18;
  for(unsigned i=0;i<=4096;++i){const auto z=std::polar(1.,-pi*i/4096);const auto h=.5*(a/(1.-(1-a)*z)-b/(1.-(1-b)*z));minReal=std::min(minReal,h.real());CHECK(h.real()>-1e-12);for(double amount:{0.,.25,.5,.75,1.}){const double gain=std::abs(1.+amount*h);CHECK(gain>=1-1e-12);maxGain=std::max(maxGain,gain);}}
  blocks_detail::FullnessPath path;double dc=0;for(unsigned i=0;i<unsigned(rate*2);++i)dc=path.body(.8,a);CHECK(std::abs(dc)<1e-8);
  for(double frequency:{30.,65.406,261.626,1000.}){
   blocks_detail::FullnessPath p;double dryPower=0,wetPower=0,cross=0;
   for(unsigned i=0;i<unsigned(rate*2);++i){double x=.4*std::sin(2*pi*frequency*i/rate),body=p.body(x,a);if(i>rate){dryPower+=x*x;wetPower+=(x+body)*(x+body);cross+=x*body;}}
   CHECK(wetPower>=dryPower*.99999);CHECK(cross>=-1e-8);
  }
 }
 // Primitive derivative must match the bounded residual, including extension.
 for(double x:{-2.,-1.2,-.9,-.4,0.,.4,.9,1.2,2.}){const double h=1e-6,derivative=(blocks_detail::harmonicPrimitive(x+h)-blocks_detail::harmonicPrimitive(x-h))/(2*h);CHECK(std::abs(derivative-blocks_detail::harmonicResidual(x))<1e-8);}
 // No negative linear foundation slope in the complete pre-Drive transfer.
 for(unsigned i=0;i<=10000;++i){double x=-1.+2.*i/10000,h=1e-6,slope=1+(blocks_detail::harmonicResidual(x+h)-blocks_detail::harmonicResidual(x-h))/(2*h);CHECK(slope>.94);}
 std::printf("PASS additive body positive-real/DC/time-domain and stronger residual primitive: min_Re=%.12g max_body_gain=%.6f\n",minReal,maxGain);
}
