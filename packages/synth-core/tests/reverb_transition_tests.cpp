#include "../src/stereo_reverb.h"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
using Reverb=blocks_detail::StereoReverb;
using Frame=std::array<double,2>;
static Frame tick(Reverb&r,unsigned i){double l=.15*std::sin(i*.193),right=.1*std::cos(i*.127);r.process(l,right);CHECK(std::isfinite(l)&&std::isfinite(right));return{l,right};}
int main(){
 auto c=Reverb::defaults();c.enabled=1;c.mode=BS_REVERB_SHIMMER;c.wet=1;c.shimmer=1;c.mod_depth=0;c.predelay_seconds=0;c.decay_seconds=6;
 {Reverb zero,near;CHECK(zero.configure(c)&&near.configure(c)&&zero.prepare(8000)&&near.prepare(8000));for(unsigned i=0;i<16000;++i)CHECK(tick(zero,i)==tick(near,i));
  auto z=c;z.shimmer_semitones=0;auto n=z;n.shimmer_semitones=.0001f;CHECK(zero.configure(z)&&near.configure(n));double earlyDifference=0,largest=0;auto previous=tick(zero,16000);tick(near,16000);
  for(unsigned i=16001;i<20000;++i){auto a=tick(zero,i),b=tick(near,i);for(unsigned ch=0;ch<2;++ch){if(i<17600)earlyDifference+=std::pow(a[ch]-b[ch],2);largest=std::max(largest,std::abs(a[ch]-previous[ch]));}previous=a;}
  std::printf("METRIC neutral pitch early crossfade energy %.9g largest adjacent step %.9g\n",earlyDifference,largest);CHECK(earlyDifference>1e-6&&largest<.05);
 }
 std::puts("PASS zero-semitone bypass begins a smooth early crossfade rather than waiting for a discontinuous ratio threshold");
 {Reverb a,b;CHECK(a.configure(c)&&b.configure(c)&&a.prepare(8000)&&b.prepare(8000));std::vector<Frame>x(30000),y(30000);
  auto run=[&](Reverb&r,std::vector<Frame>&out,unsigned block){for(unsigned start=0;start<out.size();start+=block)for(unsigned i=start;i<std::min(unsigned(out.size()),start+block);++i){if(i==16000||i==16020||i==16100||i==20000||i==24000){auto q=c;q.shimmer_semitones=i<20000?0:i<24000?-12:12;q.predelay_seconds=i==16020?.2f:0;q.size=i==16100?2:1;CHECK(r.configure(q));}if(i==28000)r.clear();if(i<28000)out[i]=tick(r,i);else{double l=0,right=0;r.process(l,right);out[i]={l,right};}}};run(a,x,1);run(b,y,127);CHECK(x==y);for(unsigned i=28000;i<x.size();++i)CHECK(x[i][0]==0&&x[i][1]==0);
 }
 std::puts("PASS repeated zero/up/down edits with pending Size/Predelay retargets remain block-exact and panic clears history");
}
