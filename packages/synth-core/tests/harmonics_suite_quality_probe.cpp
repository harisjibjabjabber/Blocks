#include "../src/harmonics_suite.h"
#include <cstdio>
#include <string>
// Offline coherent-sine alias fixture. Output is raw double PCM; analysis uses
// non-harmonic bins, not peak normalization or a misleading raw-curve baseline.
int main(int argc,char**argv){
 if(argc!=2)return 1;constexpr unsigned n=8192;constexpr double rate=48000;
 for(unsigned style=0;style<5;++style)for(unsigned drive:{18u,36u})for(unsigned bin:{5u,23u,359u}){
  auto c=blocks_detail::HarmonicsSuite::defaults();c.enabled=1;c.colour_style=style;c.drive_db=float(drive);
  blocks_detail::HarmonicsSuite h;h.prepare(rate);if(!h.configure(c,true))return 2;
  std::string path=std::string(argv[1])+"/colour-"+std::to_string(style)+"-drive-"+std::to_string(drive)+"-bin-"+std::to_string(bin)+".f64";
  FILE*f=std::fopen(path.c_str(),"wb");if(!f)return 3;
  for(unsigned i=0;i<rate*2+n;++i){double x=.12*std::sin(2*blocks_detail::suite_detail::pi*bin*i/n),y=h.process(x,x,x,x).left;if(i>=rate*2&&std::fwrite(&y,sizeof y,1,f)!=1)return 4;}
  std::fclose(f);
 }
 return 0;
}
