#include "../src/harmonics.h"
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <cstring>
#include <vector>
#include <string>
constexpr double pi=3.14159265358979323846;
static void check(bool b,const char*s){if(!b){std::fprintf(stderr,"FAIL %s\n",s);std::exit(1);}}
static double signal(unsigned i,double rate,bool pluck=false){const double t=i/rate,phase=2*pi*110*t;double wave=.55*std::sin(phase)+.24*std::sin(phase*2)+.13*std::sin(phase*5)+.08*std::sin(phase*13);const double local=std::fmod(t,.5),env=pluck?(1-std::exp(-local/.0005))*std::exp(-local/.085):.7;return .45*wave*env;}
template<class H>static double bench(unsigned n,unsigned model=1){H h;h.prepare(48000);bs_harmonics_entry e{1,model,.35f,.5f,.8f,0};h.configure(e,true);double sum=0;auto t=std::chrono::steady_clock::now();for(unsigned i=0;i<n;++i)sum+=h.process(.23*std::sin(i*.0143),6);const double ms=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-t).count();std::printf(" checksum=%.12g",sum);return ms;}
static void wav(const std::string&name,const std::vector<float>&v){FILE*f=std::fopen(name.c_str(),"wb");check(f,"open wav");const uint32_t size=36+uint32_t(v.size()*4),fmt=16,rate=48000,bytes=192000,data=uint32_t(v.size()*4);const uint16_t format=3,channels=1,align=4,bits=32;std::fwrite("RIFF",1,4,f);std::fwrite(&size,4,1,f);std::fwrite("WAVEfmt ",1,8,f);std::fwrite(&fmt,4,1,f);std::fwrite(&format,2,1,f);std::fwrite(&channels,2,1,f);std::fwrite(&rate,4,1,f);std::fwrite(&bytes,4,1,f);std::fwrite(&align,2,1,f);std::fwrite(&bits,2,1,f);std::fwrite("data",1,4,f);std::fwrite(&data,4,1,f);std::fwrite(v.data(),4,v.size(),f);std::fclose(f);}
template<class H>static std::vector<float>render(unsigned model,float tone,float dynamics,double drive,bool pluck){H h;h.prepare(48000);bs_harmonics_entry e{1,model,tone,dynamics,1,0};h.configure(e,true);std::vector<float>v(48000*4);for(unsigned i=0;i<v.size();++i)v[i]=float(h.process(signal(i,48000,pluck),drive));return v;}
static double rms(const std::vector<float>&v){double e=0;for(auto x:v)e+=double(x)*x;return std::sqrt(e/v.size());}
int main(int argc,char**argv){
 for(unsigned run=0;run<3;++run)for(unsigned model=0;model<3;++model){double ms=bench<blocks_detail::Harmonics>(240000,model);std::printf("\nPROFILE_BENCH run%u model%u ms=%.6f\n",run,model,ms);}
 if(argc>2){auto save=[&](std::string name,std::vector<float>v){double r=rms(v),peak=0;for(float x:v)peak=std::max(peak,std::abs(double(x)));std::printf("AUDIO %s raw_rms=%.6f raw_peak=%.6f matched_peak=%.6f\n",name.c_str(),r,peak,peak*.1/r);auto fixed=v;for(auto&x:fixed)x*=.2f;wav(std::string(argv[2])+"/"+name+"-fixed.wav",fixed);for(auto&x:v)x=float(x*.1/std::max(r,1e-12));wav(std::string(argv[2])+"/"+name+"-matched.wav",v);};
  for(float tone:{-1.f,0.f,1.f}){auto suffix="-tone"+std::to_string(int(tone));save("round-held"+suffix,render<blocks_detail::Harmonics>(0,tone,0,8,false));}
  for(float dyn:{0.f,.5f,1.f}){auto suffix="-dynamics"+std::to_string(int(dyn*100));save("round-pluck"+suffix,render<blocks_detail::Harmonics>(0,0,dyn,8,true));}
  for(unsigned model=0;model<3;++model)save("style"+std::to_string(model),render<blocks_detail::Harmonics>(model,0,.5,8,true));
 }
}
