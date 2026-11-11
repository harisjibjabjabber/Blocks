#include "blocks_delay.h"
#include "blocks_synth.h"
#include "../src/stereo_delay.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <new>
#include <vector>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(void*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void*operator new[](std::size_t n){return ::operator new(n);}
void operator delete(void*p)noexcept{std::free(p);}void operator delete[](void*p)noexcept{std::free(p);}
void operator delete(void*p,std::size_t)noexcept{std::free(p);}void operator delete[](void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d: %s\n",__LINE__,#x);std::exit(1);}}while(false)
using blocks_detail::StereoDelay;
static void near(double a,double b,double tolerance=1e-10){if(std::abs(a-b)>tolerance){std::fprintf(stderr,"actual%.17g expected%.17g\n",a,b);CHECK(false);}}
static bs_delay_config wet(){auto c=StereoDelay::defaults();c.enabled=1;c.wet=1;c.time_seconds=.125f;return c;}
static std::array<double,2> sample(StereoDelay&d,double l=0,double r=0,double bpm=120){watch=true;d.process(l,r,bpm);watch=false;CHECK(std::isfinite(l)&&std::isfinite(r));return{l,r};}
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,8192));}~Synth(){bs_destroy(p);}};
static std::array<float,2> hostSample(bs_synth*s){std::array<float,2>out{};watch=true;CHECK(bs_render(s,&out[0],&out[1],1,nullptr,0)==0);watch=false;return out;}
int main(){
 {StereoDelay d;auto c=StereoDelay::defaults();CHECK(sizeof c==40&&offsetof(bs_delay_config,time_seconds)==24&&offsetof(bs_delay_config,damping_hz)==36);CHECK(c.version==1&&c.enabled==0&&c.wet==0&&c.feedback==0&&c.damping_hz==20000);CHECK(d.configure(c)&&d.prepare(48000));
  for(unsigned test=0;test<15;++test){auto bad=c;switch(test){case 0:bad.version=2;break;case 1:bad.enabled=2;break;case 2:bad.mode=2;break;case 3:bad.synced=2;break;case 4:bad.division=2;break;case 5:bad.division=32;bad.triplet=1;break;case 6:bad.triplet=2;break;case 7:bad.time_seconds=.009f;break;case 8:bad.time_seconds=2.01f;break;case 9:bad.feedback=.901f;break;case 10:bad.wet=-.01f;break;case 11:bad.wet=1.01f;break;case 12:bad.damping_hz=19;break;case 13:bad.damping_hz=20001;break;default:bad.feedback=std::numeric_limits<float>::quiet_NaN();break;}watch=true;CHECK(!d.configure(bad));watch=false;CHECK(std::memcmp(&c,&d.config(),sizeof c)==0);}
  CHECK(!d.prepare(7999)&&!d.prepare(384001)&&!d.prepare(std::numeric_limits<double>::infinity()));
  for(unsigned i=0;i<5000;++i){const double l=std::sin(i*.1),r=std::cos(i*.03);const auto x=sample(d,l,r);CHECK(x[0]==l&&x[1]==r);}
 }
 std::puts("PASS Delay40-byte defaults, atomic validation and exact default bypass");
 {StereoDelay d;CHECK(d.configure(wet())&&d.prepare(8192));for(unsigned i=0;i<4096;++i){auto x=sample(d,i==0?1:0,i==13?.25:0);CHECK(x[0]==(i==1024?1:0));CHECK(x[1]==(i==1037?.25:0));}
  for(unsigned mode:{BS_DELAY_STEREO,BS_DELAY_PINGPONG}){auto c=wet();c.mode=mode;c.feedback=.5f;CHECK(d.configure(c));d.clear();std::array<std::array<double,2>,4>energy{};
   for(unsigned i=0;i<4200;++i){auto x=sample(d,i==0?1:0);for(unsigned echo=1;echo<=4;++echo)if(i>=echo*1024&&i<echo*1024+100){energy[echo-1][0]+=x[0];energy[echo-1][1]+=x[1];}}
   for(unsigned echo=0;echo<4;++echo){const unsigned channel=mode==BS_DELAY_PINGPONG?echo%2:0;near(energy[echo][channel],std::pow(.5,echo));near(energy[echo][1-channel],0);}
  }
 }
 std::puts("PASS stereo impulse timing and alternating pingpong feedback with measured geometric decay");
 {for(double rate:{8000.,48000.,384000.})for(const auto setup:std::array<std::array<double,3>,3>{{{{40,4,0}},{{120,8,1}},{{240,64,0}}}}){StereoDelay d;auto c=wet();c.synced=1;c.division=unsigned(setup[1]);c.triplet=unsigned(setup[2]);CHECK(d.configure(c)&&d.prepare(rate));sample(d,0,0,setup[0]);d.clear();const double target=rate*60/setup[0]*4/setup[1]*(setup[2]?2./3:1);const auto floor=unsigned(target);double sum=0,moment=0;
   for(unsigned i=0;i<floor+3;++i){auto x=sample(d,i==0?1:0,0,setup[0]);sum+=x[0];moment+=x[0]*i;if(i<floor||i>floor+1)CHECK(x[0]==0);CHECK(x[1]==0);}near(sum,1);near(moment,target,1e-8);
  }
 }
 std::puts("PASS global-tempo quarter/triplet/64th fractional timing across8/48/384k without hidden time cap");
 {StereoDelay d;auto c=wet();CHECK(d.configure(c)&&d.prepare(8192));for(unsigned i=0;i<4096;++i)sample(d,i*.0001);c.time_seconds=.25f;CHECK(d.configure(c));const unsigned fade=unsigned(std::ceil(.02*8192));
  for(unsigned n=0;n<fade+4;++n){const unsigned at=4096+n;const auto x=sample(d,at*.0001);const double blend=std::min(1.,double(n+1)/fade),old=(at-1024)*.0001,next=(at-2048)*.0001;near(x[0],old+blend*(next-old),1e-12);}
 }
 std::puts("PASS delay-time edit follows exact20ms dual-tap crossfade rather than a discontinuous read jump");
 {StereoDelay d;auto c=wet();c.wet=0;CHECK(d.configure(c)&&d.prepare(8192));CHECK(sample(d,1)[0]==1);for(unsigned i=1;i<100;++i)CHECK(sample(d)[0]==0);c.wet=1;CHECK(d.configure(c));double echo=0;for(unsigned i=100;i<=1024;++i){auto x=sample(d);if(i==1024)echo=x[0];}near(echo,1,1e-9);
  c.feedback=.8f;CHECK(d.configure(c));d.clear();sample(d,1);for(unsigned i=0;i<2000;++i)sample(d);watch=true;d.clear();watch=false;for(unsigned i=0;i<10000;++i){const auto x=sample(d);CHECK(x[0]==0&&x[1]==0);}
  c.enabled=0;CHECK(d.configure(c));d.clear();for(unsigned i=0;i<3000;++i){auto x=sample(d,.7,-.2);CHECK(x[0]==.7&&x[1]==-.2);}c.enabled=1;CHECK(d.configure(c));for(unsigned i=0;i<4096;++i){auto x=sample(d);CHECK(x[0]==0&&x[1]==0);}
 }
 std::puts("PASS enabled zero-wet warm history, exact dry bypass and O(1) clear excluding all stale tail/input");
 {StereoDelay a,b;auto c=wet();c.feedback=.9f;c.wet=.8f;CHECK(a.configure(c)&&b.configure(c)&&a.prepare(8000)&&b.prepare(8000));std::vector<std::array<double,2>>one(32000),chunked(32000);
  const auto render=[&](StereoDelay&d,std::vector<std::array<double,2>>&out,unsigned block){auto current=c;for(unsigned start=0;start<out.size();start+=block)for(unsigned i=start;i<std::min(unsigned(out.size()),start+block);++i){
    if(i==2000||i==2020||i==2080||i==4000||i==8000){current.time_seconds=i==2000?.03125f:i==2020?2.f:i==2080?.0625f:i==4000?.25f:.015625f;current.mode=i%3?BS_DELAY_PINGPONG:BS_DELAY_STEREO;current.damping_hz=i==4000?20:20000;watch=true;CHECK(d.configure(current));watch=false;}
    if(i==12000){current.synced=1;current.division=8;CHECK(d.configure(current));}if(i==20000){watch=true;d.clear();watch=false;}
    out[i]=sample(d,i<10000?.25*std::sin(i*.17):0,i<10000?.15*std::cos(i*.13):0,i<16000?120:40);CHECK(std::abs(out[i][0])<3&&std::abs(out[i][1])<3);
   }};render(a,one,1);render(b,chunked,127);CHECK(one==chunked);for(unsigned i=20000;i<one.size();++i)CHECK(one[i][0]==0&&one[i][1]==0);
 }
 std::puts("PASS time retarget/mode/damping/tempo transitions finite, block independent and panic silence");
 {StereoDelay bright,dark;auto c=wet();c.feedback=.8f;CHECK(bright.configure(c)&&bright.prepare(8192));c.damping_hz=200;CHECK(dark.configure(c)&&dark.prepare(8192));double high=0,low=0;for(unsigned i=0;i<3200;++i){const double input=i<128?(i%2?-.5:.5):0;auto a=sample(bright,input),b=sample(dark,input);if(i>=2048&&i<2304){high+=a[0]*a[0];low+=b[0]*b[0];}}CHECK(high>0&&low<high*.02);
 }
 std::puts("PASS feedback low-pass damping measurably removes high-frequency repeat energy");
 {Synth s;bs_delay_config c{};bs_default_delay(&c);CHECK(!bs_set_delay(nullptr,&c)&&!bs_set_delay(s.p,nullptr)&&!bs_get_delay(nullptr,&c)&&!bs_get_delay(s.p,nullptr));CHECK(bs_get_delay(s.p,&c)&&c.enabled==0&&c.wet==0);c=wet();c.feedback=.5f;CHECK(bs_set_delay(s.p,&c));bs_delay_config got{};CHECK(bs_get_delay(s.p,&got)&&std::memcmp(&c,&got,sizeof c)==0);auto bad=c;bad.feedback=2;CHECK(!bs_set_delay(s.p,&bad));CHECK(bs_get_delay(s.p,&got)&&std::memcmp(&c,&got,sizeof c)==0);
  bs_patch patch{};CHECK(bs_get_patch(s.p,&patch)&&bs_set_patch(s.p,&patch));bs_panic(s.p);bs_reset(s.p);CHECK(bs_prepare(s.p,8192));CHECK(bs_get_delay(s.p,&got)&&std::memcmp(&c,&got,sizeof c)==0);
 }
 std::puts("PASS additive Delay CAPI atomic validation, independent tone patch and lifecycle config retention");
 {Synth dry,echo;auto c=wet();CHECK(bs_set_delay(echo.p,&c));bs_reset(dry.p);bs_reset(echo.p);bs_note_on(dry.p,0,60,.6f);bs_note_on(echo.p,0,60,.6f);std::vector<std::array<float,2>>expected(6000);bool audible=false;
  for(unsigned i=0;i<expected.size();++i){expected[i]=hostSample(dry.p);auto x=hostSample(echo.p);if(i<1024)CHECK(x[0]==0&&x[1]==0);else{CHECK(x==expected[i-1024]);audible|=x[0]!=0||x[1]!=0;}}CHECK(audible);
  watch=true;bs_panic(echo.p);watch=false;for(unsigned i=0;i<4000;++i){auto x=hostSample(echo.p);CHECK(x[0]==0&&x[1]==0);}CHECK(bs_active_voices(echo.p)==0);
 }
 std::puts("PASS actual core fully-wet output is exact delayed legacy audio; panic clears voices and old echoes");
 {Synth dry,bypass;auto c=wet();c.wet=0;c.feedback=.9f;CHECK(bs_set_delay(bypass.p,&c));bs_reset(dry.p);bs_reset(bypass.p);bs_note_on(dry.p,0,64,.7f);bs_note_on(bypass.p,0,64,.7f);for(unsigned i=0;i<4000;++i)CHECK(hostSample(dry.p)==hostSample(bypass.p));bs_note_off(dry.p,0,64);bs_note_off(bypass.p,0,64);for(unsigned i=0;i<3000;++i)CHECK(hostSample(dry.p)==hostSample(bypass.p));watch=true;bs_reset(bypass.p);watch=false;for(unsigned i=0;i<3000;++i){auto x=hostSample(bypass.p);CHECK(x[0]==0&&x[1]==0);}
 }
 std::puts("PASS actual enabled zero-wet sound stays exact through release and reset cannot revive delay history");
 CHECK(allocations==0);std::puts("PASS Delay configure/render/clear allocate zero memory; buffers allocated only during prepare");
 return 0;
}
