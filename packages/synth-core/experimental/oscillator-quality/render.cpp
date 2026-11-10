#include "oscillator_source.h"
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cmath>
#include <string>
#include <vector>
using oscillator_spike::OscillatorSource;
int main(int argc,char**argv){if(argc!=2)return 1;std::string dir=argv[1];FILE*data=std::fopen((dir+"/static.f32").c_str(),"wb"),*meta=std::fopen((dir+"/static.jsonl").c_str(),"w");if(!data||!meta)return 2;constexpr unsigned n=65536,warm=256;unsigned id=0;std::vector<float>buffer(n);
 for(unsigned key=24;key<=108;++key)for(unsigned wave=0;wave<4;++wave){if(wave<2&&key%12)continue;for(unsigned p=0;p<(wave==3?5u:1u);++p){double pw=wave==3?.1+.2*p:.5;unsigned bin=unsigned(std::round((440*std::exp2((double(key)-69)/12))*n/48000));if(!(bin&1))++bin;double hz=double(bin)*48000/n;
 for(unsigned mode=0;mode<3;++mode){OscillatorSource osc;osc.prepare(48000,mode);for(unsigned i=0;i<warm;++i)osc.sample(wave,hz,pw);for(unsigned i=0;i<n;++i){double value=osc.sample(wave,hz,pw);if(!std::isfinite(value))return 3;buffer[i]=float(value);}if(std::fwrite(buffer.data(),sizeof(float),n,data)!=n)return 4;std::fprintf(meta,"{\"id\":%u,\"key\":%u,\"wave\":%u,\"pw\":%.9f,\"mode\":%u,\"bin\":%u,\"hz\":%.12f,\"frames\":%u,\"warm\":%u,\"latency\":%u}\n",id++,key,wave,pw,mode,bin,hz,n,warm,osc.latency(wave));}}}
 std::fclose(data);std::fclose(meta);std::printf("rendered %u coherent static cases\n",id);
 constexpr unsigned dynamicFrames=144000;buffer.resize(dynamicFrames);for(unsigned scenario=0;scenario<4;++scenario)for(unsigned mode=0;mode<3;++mode){OscillatorSource osc;osc.prepare(48000,mode);for(unsigned i=0;i<dynamicFrames;++i){double t=double(i)/48000,hz,pw=.5;if(scenario==0)hz=65.406391325*std::exp2(6*t/3);else if(scenario==1){hz=440;pw=.5+.4*std::sin(6.283185307179586*7*t);}else if(scenario==2)hz=440*std::exp2(50./1200*std::sin(6.283185307179586*6*t));else {hz=1760*std::exp2(.5*std::sin(6.283185307179586*31*t));pw=.5+.4*std::sin(6.283185307179586*53*t);}double value=osc.sample(scenario==0||scenario==2?2:3,hz,pw);if(!std::isfinite(value))return 5;buffer[i]=float(value);}auto path=dir+"/dynamic-"+std::to_string(scenario)+"-"+std::to_string(mode)+".f32";auto*f=std::fopen(path.c_str(),"wb");if(!f)return 6;std::fwrite(buffer.data(),4,buffer.size(),f);std::fclose(f);}
 for(unsigned mode=0;mode<3;++mode){OscillatorSource osc;osc.prepare(48000,mode);for(unsigned i=0;i<10000;++i)osc.sample(3,440,.3);osc.reset();OscillatorSource second;second.prepare(48000,mode);for(unsigned i=0;i<10000;++i)if(osc.sample(3,440,.3)!=second.sample(3,440,.3))return 7;}
 std::puts("PASS finite source matrix and deterministic reset; no live engine modified");return 0;}
