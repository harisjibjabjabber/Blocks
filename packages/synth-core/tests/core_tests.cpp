#include "blocks_synth.h"
#include <algorithm>
#include <cmath>
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
int main() {
 CHECK(bs_abi_version()==1 && bs_parameter_count()==18);
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
  bs_patch patch{},after{}; CHECK(bs_get_patch(s.p,&patch)); patch.version=2; CHECK(!bs_set_patch(s.p,&patch)); patch.version=1; patch.values[7]=std::numeric_limits<float>::infinity(); CHECK(!bs_set_patch(s.p,&patch)); CHECK(bs_get_patch(s.p,&after)); CHECK(after.values[7]==bs_parameter_info(7)->maximum);
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
  const std::vector<bs_event> events={note(13,60),note(13,64,.7f),{127,BS_PARAMETER,0,0,BS_CUTOFF,700},note(255,67),{512,BS_PEDAL,0,0,0,1},{600,BS_NOTE_OFF,0,60,0,0},{799,BS_PARAMETER,0,0,BS_DRIFT_CENTS,18},{900,BS_PEDAL,0,0,0,0},{1000,BS_PARAMETER,0,0,BS_DRIVE,4},{1499,BS_NOTE_OFF,0,64,0,0},{2300,BS_NOTE_OFF,0,67,0,0}};
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
  Synth s; CHECK(bs_prepare(s.p,8000)); bs_set_parameter(s.p,BS_GAIN,1); bs_set_parameter(s.p,BS_DRIVE,12); bs_set_parameter(s.p,BS_DRIFT_CENTS,40); bs_set_parameter(s.p,BS_PITCH_DROP_CENTS,2400); bs_set_parameter(s.p,BS_PULSE_WIDTH,.1f); bs_reset(s.p);
  for(unsigned i=0;i<40;++i) bs_note_on(s.p,i%16,88+i,1); CHECK(bs_active_voices(s.p)==16); clean(render(s.p,16000,23));
  float l[8],r[8]; const bs_event bad[]={note(4,60),note(2,61)}; CHECK(bs_render(s.p,l,r,8,bad,2)==-1); for(float x:l) CHECK(x==0);
  const bs_event invalid={0,BS_PARAMETER,0,0,999,2}; CHECK(bs_render(s.p,l,r,8,&invalid,1)==1);
 }
 CHECK(allocations==0); std::puts("PASS fixed polyphony, invalid event handling, bounded finite output and zero render allocations");
 return 0;
}
