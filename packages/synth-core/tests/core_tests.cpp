#include "blocks_synth.h"
#include "../src/fullness.h"
#include "../src/waveforms.h"
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
static double acRms(const Audio&a,unsigned start=0) {double sum=0,squares=0;for(unsigned i=start;i<a.l.size();++i){sum+=a.l[i];squares+=double(a.l[i])*a.l[i];}const double n=a.l.size()-start;return std::sqrt(std::max(0.,squares/n-(sum/n)*(sum/n)));}
static double rangeRms(const Audio&a,unsigned start,unsigned end){double sum=0,squares=0;for(unsigned i=start;i<end;++i){sum+=a.l[i];squares+=double(a.l[i])*a.l[i];}const double n=end-start;return std::sqrt(std::max(0.,squares/n-(sum/n)*(sum/n)));}
static double estimateFrequency(const Audio&a,unsigned start,unsigned end){double first=0,last=0;unsigned n=0;for(unsigned i=start+1;i<end;++i)if(a.l[i-1]<=0&&a.l[i]>0){double at=i-1-double(a.l[i-1])/(double(a.l[i])-a.l[i-1]);if(n++==0)first=at;last=at;}CHECK(n>2);return 48000*(n-1)/(last-first);}
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
 CHECK(bs_abi_version()==5 && bs_parameter_count()==40);
 {
  Synth s; CHECK(!bs_prepare(s.p,0)); CHECK(!bs_prepare(s.p,std::numeric_limits<double>::infinity())); CHECK(bs_prepare(s.p,44100));
  for(unsigned i=0;i<BS_PARAMETER_COUNT;++i) {
   const auto*d=bs_parameter_info(i); CHECK(d&&d->id==i&&d->name&&d->unit);
   CHECK(bs_set_parameter(s.p,i,-1e9f)); CHECK(bs_get_parameter(s.p,i)==d->minimum);
   CHECK(bs_set_parameter(s.p,i,1e9f)); CHECK(bs_get_parameter(s.p,i)==d->maximum);
   for(float n:{0.f,.1f,.5f,.9f,1.f}) CHECK(std::abs(bs_physical_to_normalized(i,bs_normalized_to_physical(i,n))-(d->mapping==BS_DISCRETE?std::round(n*(d->maximum-d->minimum))/(d->maximum-d->minimum):n))<.00001f);
   CHECK(!bs_set_parameter(s.p,i,std::numeric_limits<float>::quiet_NaN())); CHECK(bs_get_parameter(s.p,i)==d->maximum);
  }
  CHECK(!bs_parameter_info(99)); CHECK(!bs_set_parameter(s.p,99,1));
  bs_patch patch{},after{}; CHECK(bs_get_patch(s.p,&patch)); patch.version=999; CHECK(!bs_set_patch(s.p,&patch)); patch.version=2; patch.values[7]=std::numeric_limits<float>::infinity(); CHECK(!bs_set_patch(s.p,&patch)); CHECK(bs_get_patch(s.p,&after)); CHECK(after.values[7]==bs_parameter_info(7)->maximum);
  patch=after; patch.version=1; patch.values[BS_FULLNESS]=std::numeric_limits<float>::quiet_NaN(); CHECK(bs_set_patch(s.p,&patch)); CHECK(bs_get_parameter(s.p,BS_FULLNESS)==0); CHECK(bs_get_patch(s.p,&after)); CHECK(after.version==5);
  for(unsigned i=0;i<18;++i) CHECK(after.values[i]==patch.values[i]);
  CHECK(sizeof(bs_patch)==164);
  patch=after;patch.version=4;for(unsigned i=35;i<BS_PARAMETER_COUNT;++i)patch.values[i]=std::numeric_limits<float>::quiet_NaN();CHECK(bs_set_patch(s.p,&patch));CHECK(bs_get_patch(s.p,&after));CHECK(after.version==5);CHECK(after.values[BS_ENVELOPE_RESPONSE]==0&&after.values[BS_DRIVE_ENABLED]==1&&after.values[BS_PITCH_DROP_ENABLED]==1&&after.values[BS_SAUCE_ORDER]==0&&after.values[BS_FULLNESS_ENABLED]==1);for(unsigned i=0;i<35;++i)CHECK(after.values[i]==patch.values[i]);
  patch=after;patch.values[BS_ENVELOPE_RESPONSE]=.6f;patch.values[BS_DRIVE_ENABLED]=0;patch.values[BS_PITCH_DROP_ENABLED]=0;patch.values[BS_SAUCE_ORDER]=1;patch.values[BS_FULLNESS_ENABLED]=0;CHECK(bs_set_patch(s.p,&patch));CHECK(bs_get_patch(s.p,&after));CHECK(std::memcmp(&patch,&after,sizeof patch)==0);patch.values[BS_FULLNESS_ENABLED]=std::numeric_limits<float>::quiet_NaN();CHECK(!bs_set_patch(s.p,&patch));bs_patch retained{};CHECK(bs_get_patch(s.p,&retained));CHECK(std::memcmp(&retained,&after,sizeof after)==0);
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
  // Reference patch previously went quiet. Keep its actual detune/drift, and
  // test long enough for phase divergence rather than only coherent attacks.
  const float reference[]={.865f,.678f,4.8f,.6592f,.015f,8,1,.35f,0,-.77f,0,6000,12,20,.58f,0,.12f,0,1};
  double worst=0;
  for(unsigned fixture=0;fixture<4;++fixture)for(unsigned base:{48u,60u}) {
   std::array<double,3> rms{};
   for(unsigned blend=0;blend<3;++blend) {
    Synth s;
    if(fixture==0)for(unsigned id=0;id<19;++id)bs_set_parameter(s.p,id,reference[id]);
    if(fixture==1){bs_set_parameter(s.p,BS_ATTACK,.12f);bs_set_parameter(s.p,BS_DECAY,.7f);bs_set_parameter(s.p,BS_SUSTAIN_LEVEL,.72f);bs_set_parameter(s.p,BS_CUTOFF,2800);bs_set_parameter(s.p,BS_OSC2_DETUNE,4);bs_set_parameter(s.p,BS_DRIVE,1.384f);bs_set_parameter(s.p,BS_DRIFT_CENTS,3.2f);bs_set_parameter(s.p,BS_DRIFT_HZ,.26f);}
    if(fixture==2){bs_set_parameter(s.p,BS_ATTACK,.004f);bs_set_parameter(s.p,BS_DECAY,.48f);bs_set_parameter(s.p,BS_SUSTAIN_LEVEL,.16f);bs_set_parameter(s.p,BS_CUTOFF,7500);bs_set_parameter(s.p,BS_OSC_MIX,.15f);bs_set_parameter(s.p,BS_OSC2_DETUNE,2);bs_set_parameter(s.p,BS_DRIVE,1.192f);bs_set_parameter(s.p,BS_DRIFT_CENTS,1.6f);}
    if(fixture==3){bs_set_parameter(s.p,BS_ATTACK,.008f);bs_set_parameter(s.p,BS_DECAY,.3f);bs_set_parameter(s.p,BS_SUSTAIN_LEVEL,.68f);bs_set_parameter(s.p,BS_CUTOFF,680);bs_set_parameter(s.p,BS_OSC_MIX,.7f);bs_set_parameter(s.p,BS_OSC2_DETUNE,-3);bs_set_parameter(s.p,BS_DRIVE,1.72f);bs_set_parameter(s.p,BS_DRIFT_CENTS,6);bs_set_parameter(s.p,BS_DRIFT_HZ,.4f);}
    bs_set_parameter(s.p,BS_FULLNESS,float(blend)*.5f);bs_reset(s.p);std::vector<bs_event> events;for(unsigned interval:{0u,4u,7u,12u})events.push_back(note(0,base+interval,.65f));auto audio=render(s.p,48000*8,127,events);clean(audio);rms[blend]=acRms(audio,48000);
    if(fixture==0){CHECK(bs_get_parameter(s.p,BS_DRIFT_CENTS)==20);CHECK(bs_get_parameter(s.p,BS_DRIFT_HZ)==.58f);}
   }
   // Fullness is now intentional additive low-band body, not a unity-level
   // residual. Tighten the attenuation guard while allowing bounded growth.
   // Measured default-rack long-note gain is <4.8dB;6dB leaves headroom without
   // accepting the previous phase-cancellation loss or unrestricted boosting.
   for(unsigned i=1;i<3;++i){const double db=20*std::log10(rms[i]/rms[0]);worst=std::max(worst,std::abs(db));CHECK(db>-.15&&db<6);}
  }
  // Original screenshot's zero-sustain decay is a separate short-note fixture.
  for(unsigned pitch:{48u,60u,72u,84u,96u}){
   std::array<double,2> level{};for(unsigned full=0;full<2;++full){Synth s;for(unsigned id=0;id<19;++id)bs_set_parameter(s.p,id,reference[id]);bs_set_parameter(s.p,BS_DECAY,.41964f);bs_set_parameter(s.p,BS_SUSTAIN_LEVEL,0);bs_set_parameter(s.p,BS_DRIFT_CENTS,10);bs_set_parameter(s.p,BS_FULLNESS,float(full));bs_reset(s.p);const auto a=render(s.p,48000,128,{note(0,pitch,.8f)});clean(a);level[full]=acRms(a);CHECK(crossings(a,24000,48000)==0);}const double delta=20*std::log10(level[1]/level[0]);CHECK(delta>-.15&&delta<6);
  }
  Synth dry,body;for(auto*x:{dry.p,body.p}){bs_set_parameter(x,BS_OSC1_WAVE,BS_SINE);bs_set_parameter(x,BS_OSC2_WAVE,BS_SINE);bs_set_parameter(x,BS_OSC2_DETUNE,0);bs_set_parameter(x,BS_ATTACK,.001f);bs_set_parameter(x,BS_SUSTAIN_LEVEL,1);bs_set_parameter(x,BS_CUTOFF,20000);}bs_set_parameter(body.p,BS_FULLNESS,1);bs_reset(dry.p);bs_reset(body.p);
  const auto d=render(dry.p,48000,127,{note(0,60)}),b=render(body.p,48000,127,{note(0,60)});clean(b);const double f=440*std::exp2((60.-69)/12),h1ratio=magnitude(b,f)/magnitude(d,f),h2=magnitude(b,2*f);CHECK(h1ratio>1.05&&h1ratio<1.8);CHECK(h2>magnitude(d,2*f)*10);CHECK(h2>.0001);bs_reset(body.p);same(b,render(body.p,48000,256,{note(0,60)}));
  bs_set_parameter(body.p,BS_RELEASE,.001f);bs_note_off(body.p,0,60);render(body.p,20000,127);CHECK(bs_active_voices(body.p)==0);
  // Coherent 11.73kHz sine: the cubic's third harmonic crosses Nyquist. Compare
  // this CURRENT residual, not the obsolete clipped Fullness saturator.
  constexpr unsigned n=4096,fundamental=1001;std::vector<std::complex<double>> naive(n),antialiased(n);blocks_detail::AntialiasedResidual shape;shape.previous=std::sin(6.283185307179586*fundamental*(n-1)/n);
  for(unsigned i=0;i<n;++i){const double x=std::sin(6.283185307179586*fundamental*i/n);naive[i]=blocks_detail::harmonicResidual(x);antialiased[i]=shape.process(x);}
  const double plain=aliasRatio(naive,fundamental),adaa=aliasRatio(antialiased,fundamental);CHECK(adaa<plain*.7);
  std::printf("METRIC residual long_detuned_chords_max_level_delta_dB=%.6f sine_H1_ratio=%.6f sine_H2=%.8f alias_reduction_dB=%.3f\n",worst,h1ratio,h2,10*std::log10(adaa/plain));
 }
 std::puts("PASS additive Fullness detuned8s chords, user sustain/decay, bounded body/fundamental growth and current-residual ADAA alias reduction");
 {
  Synth s; CHECK(bs_prepare(s.p,8000)); bs_set_parameter(s.p,BS_GAIN,1); bs_set_parameter(s.p,BS_DRIVE,12); bs_set_parameter(s.p,BS_DRIFT_CENTS,40); bs_set_parameter(s.p,BS_PITCH_DROP_CENTS,2400); bs_set_parameter(s.p,BS_PULSE_WIDTH,.1f); bs_set_parameter(s.p,BS_FULLNESS,1); bs_reset(s.p);
  for(unsigned i=0;i<40;++i) bs_note_on(s.p,i%16,88+i,1); CHECK(bs_active_voices(s.p)==16); clean(render(s.p,16000,23));
  float l[8],r[8]; const bs_event bad[]={note(4,60),note(2,61)}; CHECK(bs_render(s.p,l,r,8,bad,2)==-1); for(float x:l) CHECK(x==0);
  const bs_event invalid={0,BS_PARAMETER,0,0,999,2}; CHECK(bs_render(s.p,l,r,8,&invalid,1)==1);
 }

 {
  Synth s;bs_patch p{},after{};bs_get_patch(s.p,&p);p.version=2;p.values[BS_FULLNESS]=.55f;p.values[BS_OSC1_WAVE]=std::numeric_limits<float>::quiet_NaN();p.values[BS_OSC2_WAVE]=p.values[BS_OSC1_WAVE];
  CHECK(bs_set_patch(s.p,&p));CHECK(bs_get_parameter(s.p,BS_FULLNESS)==.55f);CHECK(bs_get_parameter(s.p,BS_OSC1_WAVE)==BS_SAW);CHECK(bs_get_parameter(s.p,BS_OSC2_WAVE)==BS_PULSE);
  bs_get_patch(s.p,&p);p.values[BS_OSC1_WAVE]=1.6f;CHECK(bs_set_patch(s.p,&p));CHECK(bs_get_parameter(s.p,BS_OSC1_WAVE)==2);
  bs_get_patch(s.p,&after);p.values[BS_OSC2_WAVE]=std::numeric_limits<float>::infinity();CHECK(!bs_set_patch(s.p,&p));bs_patch rejected{};bs_get_patch(s.p,&rejected);CHECK(std::memcmp(&after,&rejected,sizeof after)==0);
  // All25 pairs across bass/middle/treble and five intermediate Fullness points.
  double worstRms=0,worstH1=0;
  for(unsigned first=0;first<5;++first)for(unsigned second=0;second<5;++second)for(unsigned pitch:{36u,60u,84u}) {
   std::array<BlendMeasurement,5> levels{};
   for(unsigned blend=0;blend<5;++blend) {
    Synth x;bs_set_parameter(x.p,BS_OSC1_WAVE,float(first));bs_set_parameter(x.p,BS_OSC2_WAVE,float(second));bs_set_parameter(x.p,BS_OSC2_DETUNE,0);bs_set_parameter(x.p,BS_FULLNESS,float(blend)*.25f);bs_set_parameter(x.p,BS_ATTACK,.001f);bs_set_parameter(x.p,BS_SUSTAIN_LEVEL,1);bs_reset(x.p);
    auto a=render(x.p,16000,127,{note(0,pitch)});clean(a);double sum=0;for(unsigned i=4800;i<a.l.size();++i)sum+=double(a.l[i])*a.l[i];
    levels[blend]={std::sqrt(sum/(a.l.size()-4800)),magnitude(a,440*std::exp2((double(pitch)-69)/12))};CHECK(levels[blend].rms>.0001);
   }
   for(const auto &level:levels) {const double rms=20*std::log10(level.rms/std::min(levels[0].rms,levels[4].rms)),h1=20*std::log10(level.fundamental/std::min(levels[0].fundamental,levels[4].fundamental));worstRms=std::min(worstRms,rms);worstH1=std::min(worstH1,h1);if(rms< -3||h1< -3)std::printf("BAD pair=%u/%u pitch=%u RMS=%f H1=%f\n",first,second,pitch,rms,h1);CHECK(rms> -3);CHECK(h1> -3);}
  }
  std::printf("METRIC waveform_pairs75 Fullness375 worst_RMS_dip_dB=%.5f worst_H1_dip_dB=%.5f\n",worstRms,worstH1);
  // Silent pre-roll must not change a loaded nonlegacy patch attack.
  {Synth a,b;for(auto*x:{a.p,b.p}){bs_set_parameter(x,BS_OSC1_WAVE,BS_TRIANGLE);bs_set_parameter(x,BS_OSC2_WAVE,BS_SINE);bs_set_parameter(x,BS_FULLNESS,.7f);bs_reset(x);}render(b.p,4800,127);same(render(a.p,4800,127,{note(0,60)}),render(b.p,4800,127,{note(0,60)}));}
  for(float amount:{0.f,.6f,1.f}) {
   Synth a,b;for(auto*x:{a.p,b.p}){bs_set_parameter(x,BS_FULLNESS,amount);bs_set_parameter(x,BS_OSC2_DETUNE,0);bs_reset(x);}
   const std::vector<bs_event> events={note(0,60),{3000,BS_PARAMETER,0,0,BS_OSC1_WAVE,BS_SINE},{3050,BS_PARAMETER,0,0,BS_OSC1_WAVE,BS_TRIANGLE},{6000,BS_PARAMETER,0,0,BS_OSC2_WAVE,BS_SINE},{9000,BS_PARAMETER,0,0,BS_OSC1_WAVE,BS_PULSE},{12000,BS_PARAMETER,0,0,BS_OSC1_WAVE,BS_SQUARE},{15000,BS_PARAMETER,0,0,BS_OSC1_WAVE,BS_SAW},{15000,BS_PARAMETER,0,0,BS_OSC2_WAVE,BS_PULSE}};
   const auto audio=render(a.p,24000,127,events);same(audio,render(b.p,24000,256,events));clean(audio);double delta=0;for(unsigned i=1;i<audio.l.size();++i)delta=std::max(delta,std::abs(double(audio.l[i])-audio.l[i-1]));std::printf("METRIC held_wave_retarget Fullness=%.1f max_sample_delta=%.7f\n",amount,delta);CHECK(delta<.025);
  }
  constexpr unsigned n=4096,f=503;std::vector<std::complex<double>> tri(n),naive(n),sinusoid(n);
  for(unsigned i=0;i<n;++i) {const double phase=std::fmod(double(i)*f/n,1.);tri[i]=blocks_detail::triangle(phase,double(f)/n);sinusoid[i]=blocks_detail::sine(phase);naive[i]=phase<.5?1-4*phase:4*phase-3;}
  const double triangleAlias=aliasRatio(tri,f),naiveAlias=aliasRatio(naive,f),sineAlias=aliasRatio(sinusoid,f);CHECK(triangleAlias<naiveAlias*.001);CHECK(sineAlias<1e-10);
  double tierJump=0;for(unsigned h:blocks_detail::triangleLimits)if(h>1)for(unsigned i=0;i<2048;++i){const double phase=double(i)/2048,step=.45/h; tierJump=std::max(tierJump,std::abs(blocks_detail::triangle(phase,step*(1-1e-8))-blocks_detail::triangle(phase,step*(1+1e-8))));}CHECK(tierJump<1e-7);
  std::printf("METRIC triangle_alias_power=%.12f naive=%.9f sine_alias=%.12f mip_boundary_delta=%.10f\n",triangleAlias,naiveAlias,sineAlias,tierJump);
 }
 std::puts("PASS discrete waveform migration, 375 Fullness signals, live crossfade retarget/block invariance and table alias/tier continuity");
 {
  // A stolen same-key owner still consumes its own later NoteOff.
  Synth s;bs_set_parameter(s.p,BS_RELEASE,.001f);bs_reset(s.p);for(unsigned key=60;key<76;++key)bs_note_on(s.p,0,key,1);render(s.p,1000,127);bs_note_on(s.p,0,60,1);render(s.p,200,127);CHECK(bs_active_voices(s.p)==16);bs_note_off(s.p,0,60);render(s.p,200,127);CHECK(bs_active_voices(s.p)==16);bs_note_off(s.p,0,60);render(s.p,200,127);CHECK(bs_active_voices(s.p)==15);
  // Released slot wins over the oldest held note; pedal-released wins next.
  bs_reset(s.p);for(unsigned key=60;key<76;++key)bs_note_on(s.p,0,key,1);render(s.p,1000,127);bs_note_off(s.p,0,70);bs_note_on(s.p,0,80,1);bs_note_off(s.p,0,60);render(s.p,200,127);CHECK(bs_active_voices(s.p)==15);
  bs_reset(s.p);for(unsigned key=60;key<76;++key)bs_note_on(s.p,0,key,1);render(s.p,1000,127);bs_sustain(s.p,0,1);bs_note_off(s.p,0,70);bs_note_on(s.p,0,80,1);bs_sustain(s.p,0,0);render(s.p,200,127);CHECK(bs_active_voices(s.p)==16);bs_note_off(s.p,0,60);render(s.p,200,127);CHECK(bs_active_voices(s.p)==15);
  // Overflow16 tails with64 simultaneous steals: deterministic finite/bounded,
  // exact panic including all tails; no promise of zero clicks on overflow.
  std::vector<bs_event> events;for(unsigned i=0;i<16;++i)events.push_back(note(0,60+i));for(unsigned i=0;i<64;++i)events.push_back(note(1000+i/32,60+i%16));events.push_back({1300,BS_PANIC,0,0,0,0});Synth a,b;const auto dense=render(a.p,1800,31,events);same(dense,render(b.p,1800,128,events));clean(dense);for(unsigned i=1300;i<1800;++i)CHECK(dense.l[i]==0&&dense.r[i]==0);
  // Single steal should continue the previous contribution on the exact attack sample.
  Synth steal,control;for(auto*x:{steal.p,control.p})for(unsigned key=60;key<76;++key)bs_note_on(x,0,key,.6f);same(render(steal.p,1000,127),render(control.p,1000,127));bs_note_on(steal.p,0,80,.6f);const auto st=render(steal.p,1,1),ct=render(control.p,1,1);CHECK(std::abs(st.l[0]-ct.l[0])<1e-7);CHECK(std::abs(st.r[0]-ct.r[0])<1e-7);
 }
 std::puts("PASS stolen-key FIFO ownership, quiet/released/pedal priority, bounded tails, continuity and dense block invariance");
 {
  Synth s;CHECK(bs_set_parameter(s.p,BS_OSC_MIX,.2f));CHECK(std::abs(bs_get_parameter(s.p,BS_OSC1_LEVEL)-.8f)<1e-7);CHECK(bs_get_parameter(s.p,BS_OSC2_LEVEL)==.2f);
  bs_set_parameter(s.p,BS_OSC1_LEVEL,.4f);CHECK(std::abs(bs_get_parameter(s.p,BS_OSC_MIX)-1.f/3)<1e-7);CHECK(bs_get_parameter(s.p,BS_OSC2_LEVEL)==.2f);bs_set_parameter(s.p,BS_OSC1_LEVEL,0);bs_set_parameter(s.p,BS_OSC2_LEVEL,0);CHECK(bs_get_parameter(s.p,BS_OSC_MIX)==.5f);
  bs_patch p{},q{};bs_get_patch(s.p,&p);p.values[BS_OSC_MIX]=.99f;p.values[BS_OSC1_LEVEL]=.7f;p.values[BS_OSC2_LEVEL]=.7f;CHECK(bs_set_patch(s.p,&p));bs_get_patch(s.p,&q);CHECK(q.values[BS_OSC_MIX]==.5f);CHECK(q.values[BS_OSC1_LEVEL]==.7f&&q.values[BS_OSC2_LEVEL]==.7f);
  p=q;p.version=3;p.values[BS_OSC_MIX]=.23f;for(unsigned id=21;id<BS_PARAMETER_COUNT;++id)p.values[id]=std::numeric_limits<float>::quiet_NaN();CHECK(bs_set_patch(s.p,&p));bs_get_patch(s.p,&q);CHECK(std::abs(q.values[BS_OSC1_LEVEL]-.77f)<1e-7);CHECK(q.values[BS_OSC2_LEVEL]==.23f);CHECK(q.values[BS_FILTER_MIX]==1&&q.values[BS_FILTER_AMOUNT]==0&&q.values[BS_SETTLING_CENTS]==0&&q.values[BS_VELOCITY_MOVEMENT]==0);
  Synth migrated,canonical;CHECK(bs_set_patch(migrated.p,&p));CHECK(bs_set_patch(canonical.p,&q));bs_reset(migrated.p);bs_reset(canonical.p);same(render(migrated.p,24000,127,{note(0,60)}),render(canonical.p,24000,256,{note(0,60)}));
  bs_get_patch(s.p,&p);p.values[34]=std::numeric_limits<float>::infinity();CHECK(!bs_set_patch(s.p,&p));bs_patch unchanged{};bs_get_patch(s.p,&unchanged);CHECK(std::memcmp(&q,&unchanged,sizeof q)==0);
  Synth square,pulse,changedWidth;for(auto*x:{square.p,pulse.p,changedWidth.p}){bs_set_parameter(x,BS_OSC1_LEVEL,0);bs_set_parameter(x,BS_OSC2_LEVEL,1);bs_set_parameter(x,BS_OSC2_DETUNE,0);bs_set_parameter(x,BS_PULSE_WIDTH,.5f);}bs_set_parameter(square.p,BS_OSC2_WAVE,BS_SQUARE);bs_set_parameter(changedWidth.p,BS_OSC2_WAVE,BS_SQUARE);bs_set_parameter(changedWidth.p,BS_PULSE_WIDTH,.19f);bs_reset(square.p);bs_reset(pulse.p);bs_reset(changedWidth.p);const auto sq=render(square.p,8000,127,{note(0,60)});same(sq,render(pulse.p,8000,256,{note(0,60)}));same(sq,render(changedWidth.p,8000,128,{note(0,60)}));
  Synth silent;bs_set_parameter(silent.p,BS_OSC1_LEVEL,0);bs_set_parameter(silent.p,BS_OSC2_LEVEL,0);bs_reset(silent.p);CHECK(energy(render(silent.p,4000,128,{note(0,60)}))==0);
 }
 std::puts("PASS independent levels, canonical Mix alias, atomic v4/v3 migrations and fixed-duty Square");
 {
  Synth base,pluck,negative,bypassA,bypassB;
  for(auto*x:{base.p,pluck.p,negative.p,bypassA.p,bypassB.p}){bs_set_parameter(x,BS_OSC1_LEVEL,1);bs_set_parameter(x,BS_OSC2_LEVEL,0);bs_set_parameter(x,BS_ATTACK,.001f);bs_set_parameter(x,BS_SUSTAIN_LEVEL,1);bs_set_parameter(x,BS_RELEASE,.8f);bs_set_parameter(x,BS_CUTOFF,200);bs_set_parameter(x,BS_FILTER_ATTACK,.001f);bs_set_parameter(x,BS_FILTER_DECAY,.1f);bs_set_parameter(x,BS_FILTER_SUSTAIN,0);}
  bs_set_parameter(pluck.p,BS_FILTER_AMOUNT,48);bs_set_parameter(negative.p,BS_FILTER_AMOUNT,-36);bs_set_parameter(bypassA.p,BS_FILTER_MIX,0);bs_set_parameter(bypassB.p,BS_FILTER_MIX,0);bs_set_parameter(bypassB.p,BS_FILTER_AMOUNT,48);for(auto*x:{base.p,pluck.p,negative.p,bypassA.p,bypassB.p})bs_reset(x);
  const auto b=render(base.p,24000,127,{note(0,60)}),p=render(pluck.p,24000,256,{note(0,60)}),n=render(negative.p,24000,127,{note(0,60)});clean(p);CHECK(rangeRms(p,600,2200)>rangeRms(b,600,2200)*1.2);CHECK(rangeRms(n,600,2200)<rangeRms(b,600,2200)*.7);CHECK(std::abs(rangeRms(p,14400,24000)/rangeRms(b,14400,24000)-1)<.001);
  same(render(bypassA.p,24000,127,{note(0,60)}),render(bypassB.p,24000,256,{note(0,60)}));
  // Independent filter release changes the timbre while the longer amp release
  // continues; sustain pedal delays both release starts coherently.
  Synth shortRelease,longRelease;for(auto*x:{shortRelease.p,longRelease.p}){bs_set_parameter(x,BS_CUTOFF,200);bs_set_parameter(x,BS_ATTACK,.001f);bs_set_parameter(x,BS_SUSTAIN_LEVEL,1);bs_set_parameter(x,BS_RELEASE,1);bs_set_parameter(x,BS_FILTER_AMOUNT,36);bs_set_parameter(x,BS_FILTER_ATTACK,.001f);bs_set_parameter(x,BS_FILTER_SUSTAIN,1);}bs_set_parameter(shortRelease.p,BS_FILTER_RELEASE,.01f);bs_set_parameter(longRelease.p,BS_FILTER_RELEASE,.5f);bs_reset(shortRelease.p);bs_reset(longRelease.p);const std::vector<bs_event> releaseEvents={note(0,60),{12000,BS_PEDAL,0,0,0,1},{13000,BS_NOTE_OFF,0,60,0,0},{16000,BS_PEDAL,0,0,0,0}};const auto shortAudio=render(shortRelease.p,30000,127,releaseEvents),longAudio=render(longRelease.p,30000,256,releaseEvents);for(unsigned i=0;i<=16000;++i)CHECK(shortAudio.l[i]==longAudio.l[i]);CHECK(rangeRms(longAudio,18000,23000)>rangeRms(shortAudio,18000,23000)*1.2);
  // Snapshot envelope settings and independently live amount/mix: changing ADSR
  // after onset leaves this note intact; amount/mix events alter its held timbre.
  Synth a,c;for(auto*x:{a.p,c.p}){bs_set_parameter(x,BS_FILTER_AMOUNT,36);bs_set_parameter(x,BS_FILTER_ATTACK,1);bs_set_parameter(x,BS_CUTOFF,300);bs_reset(x);}
  const auto original=render(a.p,16000,127,{note(0,60)});const auto snapshot=render(c.p,16000,127,{note(0,60),{1000,BS_PARAMETER,0,0,BS_FILTER_ATTACK,.001f},{2000,BS_PARAMETER,0,0,BS_FILTER_ATTACK_BEND,2}});same(original,snapshot);
  for(unsigned curve:{BS_FILTER_ATTACK_BEND,BS_FILTER_DECAY_BEND,BS_FILTER_RELEASE_BEND}){
   Synth plain,curved;for(auto*x:{plain.p,curved.p}){bs_set_parameter(x,BS_CUTOFF,400);bs_set_parameter(x,BS_ATTACK,.001f);bs_set_parameter(x,BS_SUSTAIN_LEVEL,1);bs_set_parameter(x,BS_RELEASE,.8f);bs_set_parameter(x,BS_FILTER_AMOUNT,24);bs_set_parameter(x,BS_FILTER_ATTACK,.1f);bs_set_parameter(x,BS_FILTER_DECAY,.2f);bs_set_parameter(x,BS_FILTER_SUSTAIN,.4f);bs_set_parameter(x,BS_FILTER_RELEASE,.4f);}bs_set_parameter(curved.p,curve,2);bs_reset(plain.p);bs_reset(curved.p);const std::vector<bs_event> e={note(0,60),{16000,BS_NOTE_OFF,0,60,0,0}};const auto pa=render(plain.p,30000,127,e),ca=render(curved.p,30000,256,e);const unsigned start=curve==BS_FILTER_ATTACK_BEND?600:curve==BS_FILTER_DECAY_BEND?6000:18000,end=curve==BS_FILTER_ATTACK_BEND?3000:curve==BS_FILTER_DECAY_BEND?12000:28000;CHECK(std::abs(rangeRms(ca,start,end)/rangeRms(pa,start,end)-1)>.01);
  }
  const std::vector<bs_event> live={note(0,60),{3000,BS_PARAMETER,0,0,BS_FILTER_AMOUNT,-24},{6000,BS_PARAMETER,0,0,BS_FILTER_MIX,0},{9000,BS_PARAMETER,0,0,BS_FILTER_MIX,.4f},{12000,BS_PARAMETER,0,0,BS_FILTER_AMOUNT,48}};Synth liveA,liveB;same(render(liveA.p,16000,1,live),render(liveB.p,16000,127,live));
 }
 std::puts("PASS independent filter pluck/release, bipolar amount, exact dry bypass, snapshots and live sample-accurate automation");
 {
  const auto configure=[](bs_synth*x,float amount,float sensitivity){bs_set_parameter(x,BS_ENVELOPE_RESPONSE,0);bs_set_parameter(x,BS_OSC1_WAVE,BS_SINE);bs_set_parameter(x,BS_OSC1_LEVEL,1);bs_set_parameter(x,BS_OSC2_LEVEL,0);bs_set_parameter(x,BS_ATTACK,.001f);bs_set_parameter(x,BS_SUSTAIN_LEVEL,1);bs_set_parameter(x,BS_CUTOFF,20000);bs_set_parameter(x,BS_SETTLING_CENTS,amount);bs_set_parameter(x,BS_SETTLING_TIME,1);bs_set_parameter(x,BS_VELOCITY_MOVEMENT,sensitivity);bs_reset(x);};
  Synth base,hard,soft,repeat;configure(base.p,0,0);configure(hard.p,20,1);configure(soft.p,20,1);configure(repeat.p,20,1);const auto b=render(base.p,144000,127,{note(0,69)}),h=render(hard.p,144000,127,{note(0,69)}),s=render(soft.p,144000,256,{note(0,69,.2f)});same(h,render(repeat.p,144000,256,{note(0,69)}));
  const double baseFrequency=estimateFrequency(b,500,2500),hardCents=1200*std::log2(estimateFrequency(h,500,2500)/baseFrequency),softCents=1200*std::log2(estimateFrequency(s,500,2500)/baseFrequency),lateCents=1200*std::log2(estimateFrequency(h,100000,140000)/estimateFrequency(b,100000,140000));CHECK(hardCents>10&&hardCents<=20);CHECK(std::abs(softCents)<std::abs(hardCents)*.3);CHECK(std::abs(lateCents)<.05);
  // Controls are captured pernote; disabling their targets during a held note
  // does not reset/retrigger its settling or independent rate seed.
  Synth snapshot;configure(snapshot.p,20,1);same(h,render(snapshot.p,144000,127,{note(0,69),{500,BS_PARAMETER,0,0,BS_SETTLING_CENTS,0},{500,BS_PARAMETER,0,0,BS_SETTLING_TIME,.02f},{500,BS_PARAMETER,0,0,BS_VELOCITY_MOVEMENT,0}}));
  Synth legacyA,legacyB,motion;for(auto*x:{legacyA.p,legacyB.p,motion.p}){configure(x,0,0);bs_set_parameter(x,BS_DRIFT_CENTS,20);bs_set_parameter(x,BS_DRIFT_HZ,.58f);}bs_set_parameter(legacyB.p,BS_SETTLING_TIME,.02f);bs_set_parameter(motion.p,BS_VELOCITY_MOVEMENT,1);const auto old=render(legacyA.p,144000,127,{note(0,69)});same(old,render(legacyB.p,144000,256,{note(0,69)}));CHECK(old.l!=render(motion.p,144000,127,{note(0,69)}).l);
  std::printf("METRIC settling early_hard_cents=%.6f early_soft_cents=%.6f late_cents=%.7f\n",hardCents,softCents,lateCents);clean(h);clean(s);
 }
 std::puts("PASS seeded pitch settling, velocity articulation, stable tuning, note snapshots, repeatability and disabled legacy movement behavior");
 {
  for(float amount:{-48.f,48.f})for(float mix:{0.f,.5f,1.f}){Synth s;CHECK(bs_prepare(s.p,8000));bs_set_parameter(s.p,BS_GAIN,1);bs_set_parameter(s.p,BS_DRIVE,12);bs_set_parameter(s.p,BS_OSC1_LEVEL,1);bs_set_parameter(s.p,BS_OSC2_LEVEL,1);bs_set_parameter(s.p,BS_OSC1_WAVE,BS_SQUARE);bs_set_parameter(s.p,BS_FILTER_AMOUNT,amount);bs_set_parameter(s.p,BS_FILTER_MIX,mix);bs_set_parameter(s.p,BS_FILTER_ATTACK,.001f);bs_set_parameter(s.p,BS_FILTER_DECAY,.001f);bs_set_parameter(s.p,BS_FILTER_SUSTAIN,1);bs_set_parameter(s.p,BS_SETTLING_CENTS,20);bs_set_parameter(s.p,BS_SETTLING_TIME,.02f);bs_set_parameter(s.p,BS_VELOCITY_MOVEMENT,1);bs_set_parameter(s.p,BS_DRIFT_CENTS,40);bs_set_parameter(s.p,BS_DRIFT_HZ,10);bs_set_parameter(s.p,BS_FULLNESS,1);bs_reset(s.p);for(unsigned i=0;i<16;++i)bs_note_on(s.p,0,112+i,1);clean(render(s.p,8000,31));}
 }
 CHECK(allocations==0); std::puts("PASS fixed polyphony, invalid event handling, bounded finite output and zero render allocations");
 {
  for(float amount:{0.f,1.f}) { Synth s; bs_set_parameter(s.p,BS_FULLNESS,amount); bs_reset(s.p); for(unsigned i=0;i<16;++i) bs_note_on(s.p,0,48+i,.6f); render(s.p,1024,128); const auto start=std::chrono::steady_clock::now(); const auto a=render(s.p,48000,128); const double milliseconds=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count(); clean(a); std::printf("METRIC render16voices48k Fullness=%.0f audio_seconds=1 wall_ms=%.3f\n",amount,milliseconds); }
 }
 {
  Synth s;bs_set_parameter(s.p,BS_FULLNESS,.6f);bs_set_parameter(s.p,BS_FILTER_AMOUNT,36);bs_set_parameter(s.p,BS_FILTER_MIX,.7f);bs_set_parameter(s.p,BS_FILTER_SUSTAIN,.4f);bs_set_parameter(s.p,BS_SETTLING_CENTS,20);bs_set_parameter(s.p,BS_VELOCITY_MOVEMENT,.7f);bs_set_parameter(s.p,BS_DRIFT_CENTS,40);bs_reset(s.p);for(unsigned i=0;i<16;++i)bs_note_on(s.p,0,48+i,.4f+.035f*i);const auto start=std::chrono::steady_clock::now();const auto a=render(s.p,48000,128);const double ms=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();clean(a);CHECK(allocations==0);std::printf("METRIC render16voices48k filter_envelope_and_movement audio_seconds=1 wall_ms=%.3f\n",ms);
 }
 return 0;
}
