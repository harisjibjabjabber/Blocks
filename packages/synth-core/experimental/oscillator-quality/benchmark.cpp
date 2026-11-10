#include "oscillator_source.h"
#include <chrono>
#include <cstdio>
#include <array>
#include <cmath>
#include <algorithm>
using oscillator_spike::OscillatorSource;
int main(){volatile double sink=0;for(unsigned rep=0;rep<3;++rep)for(unsigned order=0;order<3;++order){unsigned mode=rep%2?2-order:order;for(unsigned wave=2;wave<=3;++wave){std::array<OscillatorSource,32>osc;for(auto&o:osc)o.prepare(48000,mode);double peak=0,sum=0;std::array<double,750>times{};for(unsigned block=0;block<850;++block){auto start=std::chrono::steady_clock::now();for(unsigned f=0;f<128;++f){double v=0;for(unsigned j=0;j<32;++j)v+=osc[j].sample(wave,110*std::exp2(double(j)/12),.1+.8*j/31)/32;sum+=v;peak=std::max(peak,std::abs(v));}auto end=std::chrono::steady_clock::now();if(block>=100)times[block-100]=std::chrono::duration<double,std::milli>(end-start).count();}double total=0;for(auto v:times)total+=v;std::sort(times.begin(),times.end());sink+=sum;std::printf("{\"repeat\":%u,\"mode\":%u,\"wave\":%u,\"oscillators\":32,\"ms_per_audio_second\":%.9f,\"p99_ms\":%.9f,\"max_ms\":%.9f,\"peak\":%.9f}\n",rep,mode,wave,total/2,times[742],times.back(),peak);}}return std::isfinite(double(sink))?0:1;}
