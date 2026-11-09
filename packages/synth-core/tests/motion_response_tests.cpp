#include "blocks_synth.h"
#include "../src/motion_response.h"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <algorithm>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d: %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p);}~Synth(){bs_destroy(p);}};
struct Shape{const char*name;float attack,decay,sustain,release;};
static void setup(bs_synth*s,const Shape&shape,float response,float drift=120,float settling=60){
 bs_set_parameter(s,BS_OSC1_WAVE,BS_SINE);bs_set_parameter(s,BS_OSC1_LEVEL,1);bs_set_parameter(s,BS_OSC2_LEVEL,0);bs_set_parameter(s,BS_FILTER_MIX,0);bs_set_parameter(s,BS_DRIVE_ENABLED,0);bs_set_parameter(s,BS_GAIN,.5f);
 bs_set_parameter(s,BS_ATTACK,shape.attack);bs_set_parameter(s,BS_DECAY,shape.decay);bs_set_parameter(s,BS_SUSTAIN_LEVEL,shape.sustain);bs_set_parameter(s,BS_RELEASE,shape.release);bs_set_parameter(s,BS_DRIFT_CENTS,drift);bs_set_parameter(s,BS_DRIFT_HZ,4);bs_set_parameter(s,BS_SETTLING_CENTS,settling);bs_set_parameter(s,BS_SETTLING_TIME,.18f);bs_set_parameter(s,BS_ENVELOPE_RESPONSE,response);bs_reset(s);
}
static std::vector<float> audio(bs_synth*s,unsigned frames,unsigned block,const std::vector<bs_event>&events={{0,BS_NOTE_ON,0,84,0,1}}){
 std::vector<float>left(frames),right(frames);std::vector<bs_event>local;local.reserve(events.size());
 for(unsigned start=0;start<frames;start+=block){const unsigned count=std::min(block,frames-start);local.clear();for(auto e:events)if(e.sample_offset>=start&&e.sample_offset<start+count){e.sample_offset-=start;local.push_back(e);}CHECK(bs_render(s,left.data()+start,right.data()+start,count,local.data(),unsigned(local.size()))==0);}
 for(unsigned i=0;i<frames;++i)CHECK(std::isfinite(left[i])&&std::isfinite(right[i])&&std::abs(left[i])<=1&&std::abs(right[i])<=1);return left;
}
static std::vector<double> periods(const std::vector<float>&a,unsigned start,unsigned end){std::vector<double>out;double previous=0;bool have=false;for(unsigned i=start+1;i<end;++i)if(a[i-1]<=0&&a[i]>0){const double crossing=i-1-double(a[i-1])/(double(a[i])-a[i-1]);if(have)out.push_back(1200*std::log2(48000/(crossing-previous)/1046.5022612023945));previous=crossing;have=true;}CHECK(out.size()>3);return out;}
static double mean(const std::vector<double>&values){double sum=0;for(double v:values)sum+=v;return sum/values.size();}
static double peak(const std::vector<double>&values){double result=0;for(double v:values)result=std::max(result,std::abs(v));return result;}
int main(){
 using namespace blocks_detail;
 const auto shape=[](double a,double d,double s,double r,double ab=0,double db=0,double rb=0){return motionShortness(a,d,s,r,ab,db,rb);};
 const double pluck=shape(.001,.02,0,.02);CHECK(pluck>.99);CHECK(shape(.001,8,0,.02)<.01);CHECK(shape(1,.02,0,.02)<.01);CHECK(shape(.001,.02,1,.02)==0);CHECK(shape(.001,.02,0,10)<.01);
 CHECK(shape(.001,.3,0,.1,0,-2)>shape(.001,.3,0,.1,0,2));CHECK(shape(.001,.1,0,.8,0,0,-2)>shape(.001,.1,0,.8,0,0,2));
 std::puts("PASS envelope response distinguishes short plucks, zero-sustain long decay, slow attack, sustain, release and bend shapes");
 for(double a:{.001,.03,.5,5.})for(double d:{.001,.1,1.,8.})for(double s:{0.,.2,.8,1.})for(double r:{.001,.1,1.,10.})for(double b:{-2.,0.,2.}){
  const double q=shape(a,d,s,r,b,b,b);CHECK(std::isfinite(q)&&q>=0&&q<=1);
  for(double amount:{0.,8.9,29.8,60.,120.}){CHECK(settlingAllowance(amount,q)<=amount);CHECK(settlingAllowance(amount,q)>=0);for(double age:{0.,.01,.1,1.,10.}){const double budget=responsiveDrift(amount,q,age);CHECK(budget>=0&&budget<=amount+1e-12);if(age>=10)CHECK(budget<=29.800001);}}
 }
 std::puts("PASS adaptive movement is finite, smooth and attenuation-only across the envelope matrix; sustained drift returns to calibrated budget");
 bs_synth*s=bs_create();CHECK(s);bs_patch legacy{};CHECK(bs_get_patch(s,&legacy));legacy.version=4;legacy.values[13]=120;legacy.values[32]=60;CHECK(bs_set_patch(s,&legacy));CHECK(bs_get_parameter(s,BS_ENVELOPE_RESPONSE)==0);CHECK(bs_get_parameter(s,BS_DRIVE_ENABLED)==1);bs_destroy(s);
 std::puts("PASS legacy physical movement remains explicit manual mode after migration");
 {
  const Shape shapes[]={{"sustained",.001f,.2f,1,.02f},{"short_pluck",.001f,.02f,0,.02f},{"zero_sustain_long_decay",.001f,8,0,.02f},{"slow_attack",1,.02f,0,.02f},{"long_release",.001f,.02f,0,10}};
  double pluckMotion=0,sustainedMotion=0;
  for(const auto&shape:shapes){Synth manual,adaptive,neutral;setup(manual.p,shape,0);setup(adaptive.p,shape,1);setup(neutral.p,shape,0,0,0);const auto m=audio(manual.p,24000,127),a=audio(adaptive.p,24000,256),n=audio(neutral.p,24000,1);const double base=mean(periods(n,192,768)),raw=mean(periods(m,192,768))-base,adapted=mean(periods(a,192,768))-base;CHECK(std::abs(base)<.05);CHECK(std::abs(raw)>20);CHECK(std::abs(adapted)<=std::abs(raw)+.1);CHECK(bs_get_parameter(adaptive.p,BS_DRIFT_CENTS)==120&&bs_get_parameter(adaptive.p,BS_SETTLING_CENTS)==60&&bs_get_parameter(adaptive.p,BS_ENVELOPE_RESPONSE)==1);
   if(shape.decay==.02f&&shape.attack==.001f&&shape.release==.02f){pluckMotion=std::abs(adapted);CHECK(pluckMotion>20&&pluckMotion>std::abs(raw)*.9);}else{CHECK(std::abs(adapted)<12);if(shape.sustain==1)sustainedMotion=std::abs(adapted);}
   std::printf("METRIC response_%s early_manual_cents=%.6f early_adaptive_cents=%.6f\n",shape.name,raw,adapted);
  }
  CHECK(pluckMotion>sustainedMotion*3);
 }
 std::puts("PASS actual sine pitch preserves short-pluck movement while reducing sustained, long-decay, slow-attack and long-release movement without changing knobs");
 {
  const Shape held={"held",.001f,.2f,1,.2f};Synth manual,adaptive;setup(manual.p,held,0);setup(adaptive.p,held,1);const auto m=audio(manual.p,144000,127),a=audio(adaptive.p,144000,256);const double raw=peak(periods(m,48000,144000)),adapted=peak(periods(a,48000,144000));CHECK(adapted<30.1&&raw>40&&raw>adapted*3);std::printf("METRIC response_held_late_peak_manual_cents=%.6f adaptive_cents=%.6f\n",raw,adapted);
  Synth prefix,explicitManual;setup(prefix.p,held,0);setup(explicitManual.p,held,0);bs_set_parameter(prefix.p,BS_DRIVE_ENABLED,1);bs_set_parameter(explicitManual.p,BS_DRIVE_ENABLED,1);bs_reset(explicitManual.p);bs_patch old{};CHECK(bs_get_patch(prefix.p,&old));old.version=4;CHECK(bs_set_patch(prefix.p,&old));bs_reset(prefix.p);CHECK(audio(prefix.p,48000,127)==audio(explicitManual.p,48000,256));
 }
 std::puts("PASS actual held-note drift stays within adaptive budget and response0 remains identical to migrated v4 manual audio");
 {
  const Shape pluck={"pluck",.001f,.12f,.1f,.2f};Synth one,blocks;setup(one.p,pluck,1);setup(blocks.p,pluck,1);const std::vector<bs_event>events={{0,BS_NOTE_ON,0,84,0,1},{5000,BS_PARAMETER,0,0,BS_ENVELOPE_RESPONSE,0},{5200,BS_PARAMETER,0,0,BS_ENVELOPE_RESPONSE,1},{8000,BS_NOTE_ON,1,79,0,.4f},{12000,BS_PARAMETER,0,0,BS_DRIFT_CENTS,80},{16000,BS_NOTE_OFF,0,84,0,0},{22000,BS_NOTE_OFF,1,79,0,0}};CHECK(audio(one.p,48000,1,events)==audio(blocks.p,48000,127,events));CHECK(bs_active_voices(one.p)==0&&bs_active_voices(blocks.p)==0);
 }
 std::puts("PASS adaptive response retargeting, overlapping notes and release remain sample/block invariant");

}
