#include "blocks_synth.h"
#include "../src/fullness.h"
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <complex>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <new>
#include <vector>
static bool watchAllocations=false;
static unsigned allocations=0;
void *operator new(std::size_t size) { if(watchAllocations) ++allocations; if(void *p=std::malloc(size?size:1)) return p; throw std::bad_alloc(); }
void operator delete(void *p) noexcept { std::free(p); }
void operator delete(void *p,std::size_t) noexcept { std::free(p); }
#define CHECK(x) do { if(!(x)) { std::fprintf(stderr,"FAIL %s:%d: %s\n",__FILE__,__LINE__,#x); std::exit(1); } } while(false)
struct Synth { bs_synth *p=bs_create(); Synth(){CHECK(p);} ~Synth(){bs_destroy(p);} };
struct Audio { std::vector<float> l,r; explicit Audio(unsigned size):l(size),r(size){} };
static bs_event note(unsigned offset,unsigned key,float velocity=1,unsigned channel=0) { return {offset,BS_NOTE_ON,channel,key,0,velocity}; }
static Audio render(bs_synth *s,unsigned frames,unsigned block,const std::vector<bs_event>&events={}) {
 Audio a(frames); std::vector<bs_event> local; local.reserve(events.size());
 for(unsigned start=0;start<frames;start+=block) {
  const unsigned count=std::min(block,frames-start); local.clear();
  for(auto e:events) if(e.sample_offset>=start&&e.sample_offset<start+count) { e.sample_offset-=start; local.push_back(e); }
  watchAllocations=true; const int result=bs_render(s,a.l.data()+start,a.r.data()+start,count,local.data(),unsigned(local.size())); watchAllocations=false;
  CHECK(result==0);
 }
 return a;
}
static double energy(const Audio&a) { double sum=0; for(float x:a.l) sum+=double(x)*x; return sum; }
static void same(const Audio&a,const Audio&b) { CHECK(a.l==b.l); CHECK(a.r==b.r); }
static void clean(const Audio&a) { for(float x:a.l) CHECK(std::isfinite(x)&&std::abs(x)<=1); for(float x:a.r) CHECK(std::isfinite(x)&&std::abs(x)<=1); }
static unsigned crossings(const Audio&a,unsigned start,unsigned end) { unsigned n=0; for(unsigned i=start+1;i<end;++i) if(a.l[i-1]<=0&&a.l[i]>0) ++n; return n; }
static double magnitude(const Audio&a,double frequency) { double real=0,imaginary=0; for(unsigned i=4800;i<a.l.size();++i) { const double angle=6.283185307179586*frequency*i/48000; real+=a.l[i]*std::cos(angle); imaginary-=a.l[i]*std::sin(angle); } return 2*std::hypot(real,imaginary)/(a.l.size()-4800); }
struct BlendMeasurement { double rms,fundamental; };
static BlendMeasurement measureBlend(float mix,float width,unsigned pitch,float amount,bool lowTide=false) {
 Synth s; bs_set_parameter(s.p,BS_OSC_MIX,mix); bs_set_parameter(s.p,BS_PULSE_WIDTH,width); bs_set_parameter(s.p,BS_FULLNESS,amount);
 bs_set_parameter(s.p,BS_OSC2_DETUNE,lowTide?-3:0); bs_set_parameter(s.p,BS_ATTACK,lowTide?.008f:.001f); bs_set_parameter(s.p,BS_SUSTAIN_LEVEL,lowTide?.68f:1.f);
 if(lowTide) {bs_set_parameter(s.p,BS_CUTOFF,680);bs_set_parameter(s.p,BS_DRIVE,1.72f);bs_set_parameter(s.p,BS_DRIFT_CENTS,6);bs_set_parameter(s.p,BS_DRIFT_HZ,.4f);bs_set_parameter(s.p,BS_RELEASE,.18f);}
 bs_reset(s.p); const auto a=render(s.p,24000,128,{note(0,pitch)});clean(a);double sum=0;for(unsigned i=4800;i<a.l.size();++i)sum+=double(a.l[i])*a.l[i];
 return {std::sqrt(sum/(a.l.size()-4800)),magnitude(a,440*std::exp2((double(pitch)-69)/12))};
}
static double aliasRatio(std::vector<std::complex<double>> data,unsigned fundamental) {
 const unsigned n=unsigned(data.size());
 for(unsigned i=1,j=0;i<n;++i) { unsigned bit=n>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit; if(i<j) std::swap(data[i],data[j]); }
 for(unsigned len=2;len<=n;len<<=1) {
  const auto increment=std::polar(1.0,-6.283185307179586/len);
  for(unsigned start=0;start<n;start+=len) { std::complex<double> phase(1,0); for(unsigned j=0;j<len/2;++j) { const auto a=data[start+j],b=data[start+j+len/2]*phase; data[start+j]=a+b; data[start+j+len/2]=a-b; phase*=increment; } }
 }
 double aliased=0,wanted=0;
 for(unsigned i=1;i<n/2;++i) { const double power=std::norm(data[i]); if(i%fundamental==0) wanted+=power; else aliased+=power; }
 return aliased/wanted;
}
int main() {
 CHECK(bs_abi_version()==2 && bs_parameter_count()==19);
 {
  Synth s; CHECK(!bs_prepare(s.p,0)); CHECK(!bs_prepare(s.p,std::numeric_limits<double>::infinity())); CHECK(bs_prepare(s.p,44100));
  for(unsigned i=0;i<BS_PARAMETER_COUNT;++i) {
   const auto*d=bs_parameter_info(i); CHECK(d&&d->id==i&&d->name&&d->unit);
   CHECK(bs_set_parameter(s.p,i,-1e9f)); CHECK(bs_get_parameter(s.p,i)==d->minimum);
   CHECK(bs_set_parameter(s.p,i,1e9f)); CHECK(bs_get_parameter(s.p,i)==d->maximum);
   for(float n:{0.f,.1f,.5f,.9f,1.f}) CHECK(std::abs(bs_physical_to_normalized(i,bs_normalized_to_physical(i,n))-n)<.00001f);
   CHECK(!bs_set_parameter(s.p,i,std::numeric_limits<float>::quiet_NaN())); CHECK(bs_get_parameter(s.p,i)==d->maximum);
  }
  CHECK(!bs_parameter_info(99)); CHECK(!bs_set_parameter(s.p,99,1));
  bs_patch patch{},after{}; CHECK(bs_get_patch(s.p,&patch)); patch.version=999; CHECK(!bs_set_patch(s.p,&patch)); patch.version=2; patch.values[7]=std::numeric_limits<float>::infinity(); CHECK(!bs_set_patch(s.p,&patch)); CHECK(bs_get_patch(s.p,&after)); CHECK(after.values[7]==bs_parameter_info(7)->maximum);
  patch=after; patch.version=1; patch.values[BS_FULLNESS]=std::numeric_limits<float>::quiet_NaN(); CHECK(bs_set_patch(s.p,&patch)); CHECK(bs_get_parameter(s.p,BS_FULLNESS)==0); CHECK(bs_get_patch(s.p,&after)); CHECK(after.version==2);
  for(unsigned i=0;i<18;++i) CHECK(after.values[i]==patch.values[i]);
  patch=after; patch.values[BS_FULLNESS]=.55f; CHECK(bs_set_patch(s.p,&patch)); CHECK(bs_get_patch(s.p,&after)); CHECK(std::memcmp(&patch,&after,sizeof patch)==0);
 }
 std::puts("PASS parameter bounds, normalized mappings and atomic patch validation");
 {
  Synth s; bs_set_parameter(s.p,BS_RELEASE,.001f); bs_reset(s.p);
  auto a=render(s.p,256,256,{note(17,60),{100,BS_NOTE_OFF,0,60,0,0}});
  for(unsigned i=0;i<=17;++i) CHECK(a.l[i]==0&&a.r[i]==0);
  CHECK(energy(a)>0); CHECK(bs_active_voices(s.p)==0); for(unsigned i=150;i<256;++i) CHECK(a.l[i]==0&&a.r[i]==0);
  bs_note_on(s.p,0,60,1); bs_note_on(s.p,0,60,1); bs_note_on(s.p,1,60,1); render(s.p,80,80); bs_sustain(s.p,0,1); bs_note_off(s.p,0,60); render(s.p,100,32); CHECK(bs_active_voices(s.p)==3);
  bs_sustain(s.p,0,0); render(s.p,100,32); CHECK(bs_active_voices(s.p)==2); bs_note_off(s.p,0,60); render(s.p,100,32); CHECK(bs_active_voices(s.p)==1); bs_note_off(s.p,1,60); render(s.p,100,32); CHECK(bs_active_voices(s.p)==0);
  bs_note_on(s.p,0,70,1); auto panic=render(s.p,256,31,{{40,BS_PANIC,0,0,0,0}}); for(unsigned i=40;i<256;++i) CHECK(panic.l[i]==0&&panic.r[i]==0);
 }
 std::puts("PASS sample offset timing, FIFO/channel note release, sustain and immediate panic");
 {
  const std::vector<bs_event> events={note(13,60),note(13,64,.7f),{127,BS_PARAMETER,0,0,BS_CUTOFF,700},note(255,67),{400,BS_PARAMETER,0,0,BS_FULLNESS,.55f},{512,BS_PEDAL,0,0,0,1},{600,BS_NOTE_OFF,0,60,0,0},{799,BS_PARAMETER,0,0,BS_DRIFT_CENTS,18},{900,BS_PEDAL,0,0,0,0},{1000,BS_PARAMETER,0,0,BS_DRIVE,4},{1499,BS_NOTE_OFF,0,64,0,0},{2300,BS_NOTE_OFF,0,67,0,0},{2700,BS_PARAMETER,0,0,BS_FULLNESS,0}};
  Synth a,b,c,d; same(render(a.p,12000,12000,events),render(b.p,12000,127,events)); same(render(d.p,12000,1,events),render(c.p,12000,256,events));
  Synth untouched; auto silence=render(untouched.p,512,64); CHECK(energy(silence)==0);
  bs_set_parameter(a.p,BS_GAIN,.1f); CHECK(bs_get_parameter(b.p,BS_GAIN)!=.1f);
 }
 std::puts("PASS sample-exact block invariance (1/127/256/full) and multiple-instance isolation");
 {
  Synth s; bs_set_parameter(s.p,BS_DRIFT_CENTS,30); bs_set_parameter(s.p,BS_DRIFT_HZ,5); bs_reset(s.p);
  auto first=render(s.p,24000,113,{note(0,69)}); bs_reset(s.p); same(first,render(s.p,24000,256,{note(0,69)}));
  bs_set_parameter(s.p,BS_DRIFT_CENTS,0); bs_reset(s.p); auto stable=render(s.p,24000,256,{note(0,69)}); CHECK(first.l!=stable.l); clean(first);
 }
 std::puts("PASS smooth seeded drift determinism and audible-signal difference");
 {
  Synth a,b;
  for(auto*s:{a.p,b.p}) { bs_set_parameter(s,BS_OSC_MIX,0); bs_set_parameter(s,BS_ATTACK,.001f); bs_set_parameter(s,BS_SUSTAIN_LEVEL,1); bs_set_parameter(s,BS_CUTOFF,20000); }
  bs_set_parameter(b.p,BS_PITCH_DROP_CENTS,1200); bs_set_parameter(b.p,BS_PITCH_DROP_TIME,.5f); bs_reset(a.p); bs_reset(b.p);
  auto base=render(a.p,4800,256,{note(0,60)}),drop=render(b.p,4800,127,{note(0,60)}); CHECK(crossings(drop,500,4500)>crossings(base,500,4500)*1.5); clean(drop);
  bs_reset(b.p); bs_set_parameter(b.p,BS_PITCH_DROP_BEND,2); auto curved=render(b.p,4800,256,{note(0,60)}); CHECK(curved.l!=drop.l);
 }
 std::puts("PASS pitch-drop envelope raises initial pitch and responds to bend");
 {
  for(unsigned pitch:{36u,60u,84u,96u}) {
   Synth dry,fat; for(auto*s:{dry.p,fat.p}) { bs_set_parameter(s,BS_OSC2_DETUNE,0); bs_set_parameter(s,BS_ATTACK,.001f); bs_set_parameter(s,BS_SUSTAIN_LEVEL,1); bs_set_parameter(s,BS_RELEASE,.001f); }
   bs_set_parameter(fat.p,BS_FULLNESS,1); bs_reset(dry.p); bs_reset(fat.p);
   const auto a=render(dry.p,48000,127,{note(0,pitch)}),b=render(fat.p,48000,127,{note(0,pitch)}); clean(b); CHECK(a.l!=b.l);
   const double ratio=std::sqrt(energy(b)/energy(a)); CHECK(ratio>.9&&ratio<1.1);
   const int ca=int(crossings(a,4800,48000)),cb=int(crossings(b,4800,48000));
   const double frequency=440*std::exp2((double(pitch)-69)/12),fundamental=magnitude(b,frequency);
   CHECK(std::abs(cb-frequency*.9)<=1.5); CHECK(fundamental>3*magnitude(b,frequency*.97)); CHECK(fundamental>3*magnitude(b,frequency*1.03));
   double dc=0; for(unsigned i=4800;i<48000;++i) dc+=b.l[i]; dc/=43200; CHECK(std::abs(dc)<.0001);
   std::printf("METRIC Fullness pitch=%u RMS_ratio=%.6f DC=%.8f crossings=%d/%d H1=%.7f H2=%.7f H3=%.7f\n",pitch,ratio,dc,ca,cb,fundamental,magnitude(b,frequency*2),magnitude(b,frequency*3));
   bs_reset(fat.p); same(b,render(fat.p,48000,256,{note(0,pitch)}));
   bs_note_off(fat.p,0,pitch); const auto tail=render(fat.p,128,32); CHECK(bs_active_voices(fat.p)==0); for(unsigned i=64;i<128;++i) CHECK(tail.l[i]==0&&tail.r[i]==0);
  }
  for(float mix:{.15f,.35f,.7f}) for(unsigned pitch:{36u,60u,84u}) {
   Synth dry,fat; for(auto*s:{dry.p,fat.p}) { bs_set_parameter(s,BS_OSC_MIX,mix); bs_set_parameter(s,BS_OSC2_DETUNE,0); bs_set_parameter(s,BS_PULSE_WIDTH,.5f); bs_set_parameter(s,BS_ATTACK,.001f); bs_set_parameter(s,BS_SUSTAIN_LEVEL,1); }
   bs_set_parameter(fat.p,BS_FULLNESS,1); bs_reset(dry.p); bs_reset(fat.p);
   const auto a=render(dry.p,24000,128,{note(0,pitch)}),b=render(fat.p,24000,128,{note(0,pitch)}); clean(b);
   const double db=10*std::log10(energy(b)/energy(a)); std::printf("METRIC Fullness mix=%.2f pitch=%u level_delta_dB=%.4f\n",mix,pitch,db); CHECK(std::abs(db)<2);
  }
  for(float width:{.25f,.5f,.75f}) for(float mix:{.15f,.35f,.7f}) for(unsigned pitch:{36u,60u,84u}) {
   std::array<BlendMeasurement,5> levels{};for(unsigned i=0;i<5;++i)levels[i]=measureBlend(mix,width,pitch,float(i)*.25f);
   const double floorRms=std::min(levels.front().rms,levels.back().rms),floorFund=std::min(levels.front().fundamental,levels.back().fundamental);
   double worstRms=0,worstFund=0;
   for(const auto &level:levels) {worstRms=std::min(worstRms,20*std::log10(level.rms/floorRms));worstFund=std::min(worstFund,20*std::log10(level.fundamental/floorFund));}
   std::printf("METRIC Fullness blend mix=%.2f width=%.2f pitch=%u worst_RMS_dip_dB=%.4f worst_H1_dip_dB=%.4f\n",mix,width,pitch,worstRms,worstFund); CHECK(worstRms> -3);CHECK(worstFund> -3);
  }
  for(unsigned pitch:{36u,60u,84u}) {
   std::array<BlendMeasurement,5> levels{};for(unsigned i=0;i<5;++i)levels[i]=measureBlend(.7f,.5f,pitch,float(i)*.25f,true);
   const double floorRms=std::min(levels.front().rms,levels.back().rms),floorFund=std::min(levels.front().fundamental,levels.back().fundamental);
   for(unsigned i=0;i<5;++i) {const auto &level=levels[i];const double db=20*std::log10(level.rms/floorRms),hdb=20*std::log10(level.fundamental/floorFund);std::printf("METRIC LowTide pitch=%u Fullness=%.2f RMS_dB=%.4f H1_dB=%.4f\n",pitch,float(i)*.25f,db,hdb);CHECK(db> -3);CHECK(hdb> -3);}
  }
  {
   Synth a,b;for(auto*s:{a.p,b.p}){bs_set_parameter(s,BS_FULLNESS,.7f);bs_set_parameter(s,BS_OSC_MIX,.15f);bs_set_parameter(s,BS_OSC2_DETUNE,0);bs_reset(s);}
   const std::vector<bs_event> sweep={note(0,60),{6000,BS_PARAMETER,0,0,BS_OSC_MIX,.7f},{12000,BS_PARAMETER,0,0,BS_OSC_MIX,.15f},{18000,BS_PARAMETER,0,0,BS_PULSE_WIDTH,.25f},{22000,BS_PARAMETER,0,0,BS_OSC_MIX,.7f},{26000,BS_PARAMETER,0,0,BS_PULSE_WIDTH,.75f},{32000,BS_PARAMETER,0,0,BS_PULSE_WIDTH,.5f},{38000,BS_PARAMETER,0,0,BS_FULLNESS,0}};
   const auto first=render(a.p,48000,127,sweep);same(first,render(b.p,48000,256,sweep));clean(first);double jump=0;for(unsigned i=1;i<first.l.size();++i)jump=std::max(jump,std::abs(double(first.l[i])-first.l[i-1]));std::printf("METRIC Fullness mix/width sweep maximum_sample_delta=%.8f\n",jump);CHECK(jump<.02);
  }
  // Coherent 5.895kHz sine at48kHz: bins above the fourth harmonic fold into
  // non-harmonic bins. Compare the same original shape with/without ADAA.
  constexpr unsigned n=4096,fundamental=503; std::vector<std::complex<double>> naive(n),antialiased(n); blocks_detail::AntialiasedSaturation shape;
  shape.previous=1.65*std::sin(6.283185307179586*fundamental*(n-1)/n);
  for(unsigned i=0;i<n;++i) { const double x=1.65*std::sin(6.283185307179586*fundamental*i/n); naive[i]=blocks_detail::saturation(x); antialiased[i]=shape.process(x); }
  const double plain=aliasRatio(naive,fundamental),adaa=aliasRatio(antialiased,fundamental); CHECK(adaa<plain*.7); std::printf("METRIC waveshaper alias_power_ratio naive=%.9f ADAA=%.9f reduction_dB=%.3f\n",plain,adaa,10*std::log10(adaa/plain));
 }
 std::puts("PASS Fullness tone-range level/DC/pitch stability, release, determinism and measured ADAA alias reduction");
 {
  Synth s; CHECK(bs_prepare(s.p,8000)); bs_set_parameter(s.p,BS_GAIN,1); bs_set_parameter(s.p,BS_DRIVE,12); bs_set_parameter(s.p,BS_DRIFT_CENTS,40); bs_set_parameter(s.p,BS_PITCH_DROP_CENTS,2400); bs_set_parameter(s.p,BS_PULSE_WIDTH,.1f); bs_set_parameter(s.p,BS_FULLNESS,1); bs_reset(s.p);
  for(unsigned i=0;i<40;++i) bs_note_on(s.p,i%16,88+i,1); CHECK(bs_active_voices(s.p)==16); clean(render(s.p,16000,23));
  float l[8],r[8]; const bs_event bad[]={note(4,60),note(2,61)}; CHECK(bs_render(s.p,l,r,8,bad,2)==-1); for(float x:l) CHECK(x==0);
  const bs_event invalid={0,BS_PARAMETER,0,0,999,2}; CHECK(bs_render(s.p,l,r,8,&invalid,1)==1);
 }
 CHECK(allocations==0); std::puts("PASS fixed polyphony, invalid event handling, bounded finite output and zero render allocations");
 {
  for(float amount:{0.f,1.f}) { Synth s; bs_set_parameter(s.p,BS_FULLNESS,amount); bs_reset(s.p); for(unsigned i=0;i<16;++i) bs_note_on(s.p,0,48+i,.6f); render(s.p,1024,128); const auto start=std::chrono::steady_clock::now(); const auto a=render(s.p,48000,128); const double milliseconds=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count(); clean(a); std::printf("METRIC render16voices48k Fullness=%.0f audio_seconds=1 wall_ms=%.3f\n",amount,milliseconds); }
 }
 return 0;
}
