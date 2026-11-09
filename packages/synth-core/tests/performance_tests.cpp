#include "blocks_synth.h"
#include "../src/performance.h"
#include <array>
#include <vector>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <new>
#include <memory>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(void*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(...) do{if(!(__VA_ARGS__)){std::fprintf(stderr,"FAIL %s:%d %s\n",__FILE__,__LINE__,#__VA_ARGS__);std::exit(1);}}while(false)
struct Entry{uint64_t frame;unsigned channel,key;bool on,mono;};
struct Trace{
 std::unique_ptr<blocks_detail::Performance> storage=std::make_unique<blocks_detail::Performance>();blocks_detail::Performance&p=*storage;std::vector<Entry>log=std::vector<Entry>(512);unsigned size=0;
 Trace(){p.bind({this,[](void*x,uint32_t ch,uint32_t key,float,bool mono,bool){auto&t=*static_cast<Trace*>(x);CHECK(t.size<t.log.size());t.log[t.size++]={t.p.frame(),ch,key,true,mono};},[](void*x,uint32_t ch,uint32_t key){auto&t=*static_cast<Trace*>(x);CHECK(t.size<t.log.size());t.log[t.size++]={t.p.frame(),ch,key,false,false};}});p.prepare(48000);}
 void set(const bs_performance_config&c){CHECK(blocks_detail::Performance::valid(c));if(c.mode!=p.config().mode||c.mono!=p.config().mono)p.clear();p.configure(c);}
 void until(uint64_t end){watch=true;while(p.frame()<end)p.tick();watch=false;}
 void on(unsigned key,unsigned channel=0){watch=true;p.on(channel,key,.8f);watch=false;}
 void off(unsigned key,unsigned channel=0){watch=true;p.off(channel,key);watch=false;}
 std::vector<Entry>ons()const{std::vector<Entry>out;for(unsigned i=0;i<size;++i)if(log[i].on)out.push_back(log[i]);return out;}
};
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p);}~Synth(){bs_destroy(p);}};
struct Audio{std::vector<float>l,r;explicit Audio(unsigned n):l(n),r(n){}};
static Audio render(bs_synth*s,unsigned n,unsigned block,const std::vector<bs_event>&events={}){Audio a(n);std::vector<bs_event>local;local.reserve(events.size());for(unsigned start=0;start<n;start+=block){unsigned count=std::min(block,n-start);local.clear();for(auto e:events)if(e.sample_offset>=start&&e.sample_offset<start+count){e.sample_offset-=start;local.push_back(e);}watch=true;int result=bs_render(s,a.l.data()+start,a.r.data()+start,count,local.data(),unsigned(local.size()));watch=false;CHECK(result==0);}for(float x:a.l)CHECK(std::isfinite(x)&&std::abs(x)<=1);return a;}
static void same(const Audio&a,const Audio&b){CHECK(a.l==b.l&&a.r==b.r);}
static double frequency(const Audio&a){double first=0,last=0;unsigned count=0;for(unsigned i=1001;i<a.l.size();++i)if(a.l[i-1]<=0&&a.l[i]>0){double x=i-1-double(a.l[i-1])/(double(a.l[i])-a.l[i-1]);if(count++==0)first=x;last=x;}CHECK(count>3);return 48000*(count-1)/(last-first);}
int main(){
 bs_performance_config defaults{};bs_default_performance(&defaults);CHECK(sizeof defaults==48&&defaults.version==1&&defaults.mode==0&&defaults.mono==0&&defaults.bpm==120&&defaults.division==8);
 {Synth s;bs_performance_config before{},after{};CHECK(bs_get_performance(s.p,&before));for(unsigned field=0;field<7;++field){auto bad=before;if(field==0)bad.version=2;if(field==1)bad.bpm=std::numeric_limits<float>::quiet_NaN();if(field==2)bad.division=3;if(field==3)bad.strum_ms=101;if(field==4)bad.mono=2;if(field==5){bad.division=32;bad.triplet=1;}if(field==6){bad.division=64;bad.triplet=1;}CHECK(!bs_set_performance(s.p,&bad));CHECK(bs_get_performance(s.p,&after));CHECK(std::memcmp(&before,&after,sizeof before)==0);}CHECK(bs_parameter_count()==42&&bs_abi_version()==6);}
 std::puts("PASS performance48-byte API validation and independent tone ABI");
 {Trace t;auto c=defaults;c.mono=1;t.set(c);t.on(60);t.until(1);t.on(64);t.until(2);t.on(64);const auto size=t.size;t.off(64);CHECK(t.size==size);t.until(3);t.off(64);CHECK(t.log[t.size-1].on&&t.log[t.size-1].key==60);t.p.pedal(0,true);t.on(67);t.off(67);CHECK(t.log[t.size-1].on&&t.log[t.size-1].key==60);t.off(60);CHECK(t.log[t.size-1].on&&t.log[t.size-1].key==67);t.p.pedal(0,false);CHECK(!t.log[t.size-1].on);
  Trace channels;channels.set(c);channels.on(60,0);channels.on(60,1);channels.off(60,1);CHECK(channels.log[channels.size-1].on&&channels.log[channels.size-1].channel==0);channels.off(60,0);CHECK(!channels.log[channels.size-1].on);
 }
 std::puts("PASS Mono last-held priority, repeated/channel ownership, pedal restore and final release");
 {for(float curl:{-.8f,0.f,.8f})for(unsigned division:{4u,8u,16u,32u,64u})for(unsigned triplet:{0u,1u}){if(division>16&&triplet)continue;
   Trace t;auto c=defaults;c.mode=BS_ARP;c.curl=curl;c.bpm=123;c.division=division;c.triplet=triplet;t.set(c);t.on(67);t.on(60);t.on(64);const double span=48000.*240/c.bpm;unsigned steps=triplet?division*3/2:division;t.until(uint64_t(std::llround(2*span))+1);const auto notes=t.ons();CHECK(notes.size()==2*steps+1);
   for(unsigned i=0;i<notes.size();++i){const double u=double(i%steps)/steps,f=curl==0?u:std::expm1(-double(curl)*u)/std::expm1(-double(curl));const uint64_t expected=uint64_t(std::llround((i/steps+f)*span));CHECK(notes[i].frame==expected);CHECK(notes[i].key==std::array<unsigned,3>{60,64,67}[i%3]);}
   CHECK(notes[steps].frame==uint64_t(std::llround(span)));CHECK(notes[2*steps].frame==uint64_t(std::llround(2*span)));
  }
  for(unsigned order:{BS_ORDER_UP,BS_ORDER_DOWN,BS_ORDER_AS_PLAYED,BS_ORDER_RANDOM}){Trace a,b;auto c=defaults;c.mode=BS_ARP;c.order=order;c.seed=123;for(auto*t:{&a,&b}){t->set(c);t->on(67);t->on(60);t->on(64);t->until(48001);}const auto x=a.ons(),y=b.ons();CHECK(x.size()==y.size());for(unsigned i=0;i<x.size();++i){CHECK(x[i].frame==y[i].frame&&x[i].key==y[i].key);if(order==BS_ORDER_UP)CHECK(x[i].key==std::array<unsigned,3>{60,64,67}[i%3]);if(order==BS_ORDER_DOWN)CHECK(x[i].key==std::array<unsigned,3>{67,64,60}[i%3]);if(order==BS_ORDER_AS_PLAYED)CHECK(x[i].key==std::array<unsigned,3>{67,60,64}[i%3]);}}
 }
 {for(float curl:{-.8f,.8f}){Trace t;auto c=defaults;c.mode=BS_ARP;c.bpm=240;c.division=16;c.triplet=1;c.curl=curl;t.set(c);t.on(60);t.until(48001);const auto notes=t.ons();CHECK(notes.size()==25);for(unsigned i=1;i<notes.size();++i){const auto delta=notes[i].frame-notes[i-1].frame;CHECK(delta>1200&&delta<3000);}CHECK(notes.back().frame==48000);}}
 {for(float curl:{-.8f,0.f,.8f}){Trace t;auto c=defaults;c.mode=BS_ARP;c.bpm=240;c.division=64;c.curl=curl;t.set(c);t.on(60);t.until(48001);const auto notes=t.ons();CHECK(notes.size()==65);for(unsigned i=1;i<notes.size();++i){const auto delta=notes[i].frame-notes[i-1].frame;CHECK(delta>450&&delta<1150);}CHECK(notes.back().frame==48000);}}
 std::puts("PASS exact Curl frames/endpoints through straight64, allowed triplets, minimum spacing and seeded orders");
 {auto c=defaults;c.mode=BS_ARP;
  // Pending edits can be canceled; without chord edits they apply at the next bar.
  Trace seam;seam.set(c);seam.on(60);seam.until(10000);auto changed=c;changed.bpm=100;seam.set(changed);CHECK(seam.p.pending());seam.set(c);CHECK(!seam.p.pending());seam.until(12001);CHECK(seam.ons().back().frame==12000);seam.set(changed);auto orderChange=seam.p.config();orderChange.order=BS_ORDER_DOWN;seam.set(orderChange);CHECK(seam.p.pending()&&seam.p.config().bpm==100);seam.until(96001);CHECK(!seam.p.pending());seam.until(110401);CHECK(seam.ons().back().frame==110400);
  // Off-grid additions apply requested timing immediately, stop the old gate,
  // and reset both the four-beat epoch and note-order cursor.
  Trace t;t.set(c);t.on(64);t.on(67);t.until(10000);changed=c;changed.bpm=100;changed.order=BS_ORDER_DOWN;t.set(changed);t.on(72);t.on(60);CHECK(!t.p.pending());CHECK(!t.log[t.size-1].on);t.until(10001);auto notes=t.ons();CHECK(notes.size()==2&&notes.back().frame==10000&&notes.back().key==72);t.until(24401);CHECK(t.ons().back().frame==24400&&t.ons().back().key==67);
  t.until(25000);t.off(72);t.until(25001);CHECK(t.ons().back().frame==25000&&t.ons().back().key==67);
  // Same-key duplicate ownership does not restart or release the chord member.
  t.until(26000);const auto before=t.ons().size();t.on(67);t.off(67);t.until(26001);CHECK(t.ons().size()==before);
  t.p.pedal(0,true);t.off(67);t.until(26002);CHECK(t.ons().size()==before); // still pedal-eligible
  t.p.pedal(0,false);t.until(26003);CHECK(t.ons().back().frame==26002&&t.ons().back().key==64);
  t.off(64);t.off(60);const auto count=t.ons().size();t.until(300000);CHECK(t.ons().size()==count);
  // A physically new press of a pedal-latched key restarts; same-sample edits
  // emit one attack chosen from the final chord, not transient partial chords.
  Trace rehit;rehit.set(c);rehit.on(67);rehit.until(1);rehit.p.pedal(0,true);rehit.off(67);rehit.until(1000);rehit.on(67);rehit.on(60);rehit.on(64);rehit.until(1001);CHECK(rehit.ons().size()==2&&rehit.ons().back().frame==1000&&rehit.ons().back().key==60);
  // A non-sliding20ms window groups staggered chord changes, with the first
  // attack immediate. New source keys are visible at each scheduled step.
  Trace grouped;grouped.set(c);grouped.on(67);grouped.until(240);grouped.on(60);grouped.until(576);grouped.on(64);grouped.until(960);CHECK(grouped.ons().size()==1&&grouped.ons().front().frame==0);grouped.until(4800);grouped.on(72);grouped.until(4801);CHECK(grouped.ons().size()==2&&grouped.ons().back().frame==4800&&grouped.ons().back().key==60);
  Trace nonSliding;nonSliding.set(c);nonSliding.on(67);nonSliding.until(720);nonSliding.on(60);nonSliding.until(1000);nonSliding.on(64);nonSliding.until(1001);CHECK(nonSliding.ons().size()==2&&nonSliding.ons().back().frame==1000);
  Trace empty;empty.set(c);empty.on(60);empty.until(100);empty.off(60);empty.on(64);empty.until(101);CHECK(empty.ons().size()==2&&empty.ons().back().frame==100&&empty.ons().back().key==64);
  Trace removal;removal.set(c);removal.on(60);removal.on(64);removal.until(100);removal.off(60);removal.until(101);CHECK(removal.ons().size()==1);removal.until(12001);CHECK(removal.ons().back().frame==12000&&removal.ons().back().key==64);
  Trace dense;changed=c;changed.bpm=240;changed.division=64;dense.set(changed);dense.on(67);dense.until(240);dense.on(60);dense.until(576);dense.on(64);dense.until(1501);CHECK(dense.ons().size()==3&&dense.ons()[1].frame==750&&dense.ons()[1].key==64&&dense.ons()[2].frame==1500);
  Trace random;changed=c;changed.order=BS_ORDER_RANDOM;random.set(changed);random.on(60);random.on(64);random.until(1);const auto first=random.ons().front().key;random.until(5000);random.p.pedal(0,true);random.off(60);random.on(60);random.until(5001);CHECK(random.ons().back().key==first);
 }
 std::puts("PASS chord-change restart, immediate non-sliding20ms grouping, repeated/pedal ownership and pending timing semantics");
 {Trace t;auto c=defaults;c.mode=BS_STRUM;c.strum_ms=35;c.randomness=0;t.set(c);t.on(67);t.until(240);t.on(60);t.until(480);t.on(64);t.until(3000);auto notes=t.ons();CHECK(notes.size()==3);CHECK(notes[0].frame==960&&notes[1].frame==1800&&notes[2].frame==2640);CHECK(notes[0].key==60&&notes[1].key==64&&notes[2].key==67);t.until(96000);CHECK(t.ons().size()==3);t.off(60);t.off(64);t.off(67);CHECK(!t.log[t.size-1].on);
  for(bool pedal:{false,true}){Trace canceled;c.strum_ms=100;canceled.set(c);canceled.on(60);canceled.until(100);if(pedal)canceled.p.pedal(0,true);canceled.off(60);canceled.until(10000);CHECK(canceled.ons().empty());canceled.p.pedal(0,false);}
  {Trace canceled;c.strum_ms=100;canceled.set(c);canceled.on(60);canceled.on(67);canceled.until(1500);CHECK(canceled.ons().size()==1);canceled.p.pedal(0,true);canceled.off(67);canceled.until(7000);CHECK(canceled.ons().size()==1);}
  {Trace canceled;c.mono=1;c.strum_ms=100;canceled.set(c);canceled.on(60);canceled.until(1000);CHECK(canceled.ons().size()==1);canceled.on(60);canceled.p.pedal(0,true);canceled.off(60);canceled.off(60);canceled.until(10000);CHECK(canceled.ons().size()==1);c.mono=0;}
  Trace immediate;c.strum_ms=0;immediate.set(c);immediate.on(60);CHECK(immediate.ons().front().frame==0);
  Trace a,b;c.strum_ms=100;c.randomness=1;c.order=BS_ORDER_RANDOM;c.seed=99;for(auto*t:{&a,&b}){t->set(c);for(unsigned key:{60u,64u,67u,72u})t->on(key);t->until(6000);}const auto x=a.ons(),y=b.ons();CHECK(x.size()==4&&y.size()==4);CHECK(x.front().frame==960&&x.back().frame==5760);for(unsigned i=0;i<4;++i){CHECK(x[i].frame==y[i].frame&&x[i].key==y[i].key);if(i)CHECK(x[i].frame>=x[i-1].frame);}
  Trace rehit;c=defaults;c.mode=BS_STRUM;c.mono=1;rehit.set(c);rehit.on(60);rehit.until(1000);rehit.on(64);rehit.until(1200);rehit.on(60);rehit.until(1300);rehit.off(64);const auto n=rehit.ons().size();rehit.until(1960);CHECK(rehit.ons().size()==n);rehit.until(1961);CHECK(rehit.ons().size()==n+1);
 }
 std::puts("PASS one-shot Strum collection/spread/randomness, zero-spread immediacy and release/pedal/rehit cancellation");
 {Synth s;auto c=defaults;c.mono=1;CHECK(bs_set_performance(s.p,&c));bs_set_parameter(s.p,BS_OSC1_WAVE,BS_SINE);bs_set_parameter(s.p,BS_OSC1_LEVEL,1);bs_set_parameter(s.p,BS_OSC2_LEVEL,0);bs_set_parameter(s.p,BS_ATTACK,.001f);bs_set_parameter(s.p,BS_SUSTAIN_LEVEL,1);bs_set_parameter(s.p,BS_RELEASE,.001f);bs_reset(s.p);bs_note_on(s.p,0,60,.8f);bs_note_on(s.p,0,64,.8f);bs_note_on(s.p,0,67,.8f);CHECK(bs_active_voices(s.p)==1);CHECK(std::abs(frequency(render(s.p,8000,127))-391.995)<1);bs_note_off(s.p,0,67);CHECK(bs_active_voices(s.p)==1);CHECK(std::abs(frequency(render(s.p,8000,127))-329.628)<1);bs_note_off(s.p,0,64);CHECK(std::abs(frequency(render(s.p,8000,127))-261.626)<1);bs_note_off(s.p,0,60);render(s.p,1000,127);CHECK(bs_active_voices(s.p)==0);
  bs_note_on(s.p,0,60,.8f);c.mode=BS_ARP;CHECK(bs_set_performance(s.p,&c));CHECK(bs_active_voices(s.p)==0);auto silent=render(s.p,10000,128);for(float v:silent.l)CHECK(v==0);
 }
 std::puts("PASS actual mono audio pitch restore, one primary voice and mode-change panic");
 {for(unsigned mode:{BS_ARP,BS_STRUM}){Synth a,b;auto c=defaults;c.mode=mode;c.mono=1;c.curl=.8f;c.division=64;c.triplet=0;c.order=BS_ORDER_RANDOM;c.randomness=.8f;c.strum_ms=100;CHECK(bs_set_performance(a.p,&c)&&bs_set_performance(b.p,&c));const std::vector<bs_event>events={{0,BS_NOTE_ON,0,60,0,.8f},{0,BS_NOTE_ON,0,64,0,.8f},{0,BS_NOTE_ON,0,67,0,.8f},{24000,BS_NOTE_ON,1,72,0,.6f},{36000,BS_NOTE_OFF,0,64,0,0},{60000,BS_PEDAL,0,0,0,1},{65000,BS_NOTE_OFF,0,60,0,0},{65000,BS_NOTE_OFF,0,67,0,0},{70000,BS_NOTE_OFF,1,72,0,0},{75000,BS_PEDAL,0,0,0,0},{90000,BS_PANIC,0,0,0,0}};const auto x=render(a.p,120000,1,events),y=render(b.p,120000,127,events);same(x,y);for(unsigned i=90000;i<x.l.size();++i)CHECK(x.l[i]==0&&x.r[i]==0);CHECK(bs_active_voices(a.p)==0&&bs_active_voices(b.p)==0);}}
 CHECK(allocations==0);std::puts("PASS performance sample/block invariance, finite output, final panic and zero render allocations");return 0;
}
