#include "../src/note_rack.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <new>
#include <vector>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d: %s\n",__LINE__,#x);std::exit(1);}}while(false)
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(void*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
struct Entry{uint64_t frame;uint32_t ch,key;bool on;};
struct Trace{
 std::unique_ptr<blocks_detail::NoteRack>rack=std::make_unique<blocks_detail::NoteRack>();uint64_t frame=0;unsigned count=0,panics=0,pedals=0;std::vector<Entry>log=std::vector<Entry>(8192);
 Trace(){rack->bind({this,[](void*p,uint32_t ch,uint32_t key,float){auto&t=*static_cast<Trace*>(p);CHECK(t.count<t.log.size());t.log[t.count++]={t.frame,ch,key,true};},[](void*p,uint32_t ch,uint32_t key){auto&t=*static_cast<Trace*>(p);CHECK(t.count<t.log.size());t.log[t.count++]={t.frame,ch,key,false};},[](void*p,uint32_t,bool){++static_cast<Trace*>(p)->pedals;},[](void*p){++static_cast<Trace*>(p)->panics;}});}
 void until(uint64_t n){watch=true;while(frame<n){rack->tick();++frame;}watch=false;}
 std::vector<Entry>ons()const{std::vector<Entry>x;for(unsigned i=0;i<count;++i)if(log[i].on)x.push_back(log[i]);return x;}
};
static bs_note_block block(unsigned id,unsigned type){bs_note_block b{};b.id=id;b.type=type;b.enabled=1;b.perf=blocks_detail::defaultPerformance();b.perf.mode=type==BS_NOTE_ARP?BS_ARP:BS_STRUM;b.perf.randomness=0;b.drop_time=.12f;return b;}
static bs_notes_config pair(unsigned type){auto c=blocks_detail::NoteRack::defaults();c.count=2;c.blocks[0]=block(1,type);c.blocks[1]=block(2,type);return c;}
int main(){
 {
  Trace t;CHECK(blocks_detail::NoteRack::valid(t.rack->config()));CHECK(!t.rack->hasGenerators()&&!t.rack->hasEnabledNodes());t.rack->on(1,60,.7f);t.rack->off(1,60);t.rack->pedal(1,true);CHECK(t.count==2&&t.log[0].on&&!t.log[1].on&&t.pedals==1);
  auto c=pair(BS_NOTE_ARP);c.blocks[0].enabled=c.blocks[1].enabled=0;CHECK(t.rack->configure(c,48000));CHECK(!t.rack->hasGenerators());t.rack->on(0,64,.8f);CHECK(t.log[t.count-1].on&&t.log[t.count-1].key==64);
  c.count=1;c.blocks[0]=block(3,BS_NOTE_DROP);c.blocks[0].primary=1;CHECK(t.rack->configure(c,48000));CHECK(t.rack->hasEnabledNodes()&&!t.rack->hasGenerators());t.rack->on(0,67,.8f);CHECK(t.log[t.count-1].key==67);const auto saved=t.rack->config();const unsigned panic=t.panics;
  auto reject=[&](bs_notes_config bad){CHECK(!t.rack->configure(bad,48000));CHECK(std::memcmp(&saved,&t.rack->config(),sizeof saved)==0);CHECK(t.panics==panic);};auto b=c;b.count=17;reject(b);b=c;b.blocks[0].id=0;reject(b);b=c;b.blocks[0].drop_time=0;reject(b);b=c;b.count=2;b.blocks[1]=b.blocks[0];reject(b);b.blocks[1].id=2;reject(b);b=pair(BS_NOTE_ARP);b.blocks[0].perf.mono=1;reject(b);b=pair(BS_NOTE_STRUM);b.blocks[0].perf.mode=BS_ARP;reject(b);CHECK(!t.rack->configure(c,0));
 }
 std::puts("PASS NoteRack fixed ABI, empty/disabled/Drop passthrough and atomic typed validation");
 {
  Trace t;auto c=pair(BS_NOTE_ARP);c.blocks[0].perf.division=4;c.blocks[0].perf.gate=.95f;c.blocks[1].perf.division=8;c.blocks[1].perf.gate=.5f;CHECK(t.rack->configure(c,48000));t.rack->on(0,60,.8f);t.rack->on(0,64,.8f);t.until(40000);auto ons=t.ons();CHECK(ons.size()==4);for(unsigned i=0;i<4;++i){CHECK(ons[i].frame==i*12000);CHECK(ons[i].key==(i<2?60u:64u));}
  t.rack->off(0,60);t.rack->off(0,64);const auto count=t.ons().size();t.until(100000);CHECK(t.ons().size()==count);
 }
 std::puts("PASS cascaded Arp clocks emit sequential downstream gates, not parallel copies, and release fully");
 {
  Trace t;auto c=pair(BS_NOTE_STRUM);c.blocks[0].perf.strum_ms=100;c.blocks[1].perf.strum_ms=20;CHECK(t.rack->configure(c,48000));for(unsigned key:{60u,64u,67u})t.rack->on(0,key,.8f);t.until(7000);const auto ons=t.ons();CHECK(ons.size()==3);for(unsigned i=0;i<3;++i){CHECK(ons[i].key==60+unsigned(i==1?4:i==2?7:0));CHECK(ons[i].frame==1920+i*2400);}
  for(unsigned key:{60u,64u,67u})t.rack->off(0,key);CHECK(!t.log[t.count-1].on);t.until(15000);CHECK(t.ons().size()==3);
  Trace cancel;CHECK(cancel.rack->configure(c,48000));cancel.rack->on(0,60,.8f);cancel.until(1000);cancel.rack->pedal(0,true);cancel.rack->off(0,60);cancel.rack->pedal(0,false);cancel.until(5000);CHECK(cancel.ons().empty());
 }
 std::puts("PASS cascaded Strum collection/spread and release/pedal cancellation before downstream attacks");
 {
  Trace t;auto c=pair(BS_NOTE_ARP);CHECK(t.rack->configure(c,48000));t.rack->on(0,60,.8f);t.until(100);const unsigned initial=t.panics;c.blocks[0].perf.bpm=100;CHECK(t.rack->configure(c,48000));CHECK(t.panics==initial);CHECK(t.rack->pendingMask()==1);t.until(12001);CHECK(t.ons().back().frame==12000); // pending edit kept existing bar
  std::swap(c.blocks[0],c.blocks[1]);CHECK(t.rack->configure(c,48000));CHECK(t.panics==initial+1);CHECK(t.rack->pendingMask()==0);const auto count=t.count;t.until(50000);CHECK(t.count==count);t.rack->on(0,64,.8f);t.until(50001);CHECK(t.ons().back().key==64);t.rack->clear();CHECK(t.panics==initial+2);const auto cleared=t.count;t.until(100000);CHECK(t.count==cleared);
 }
 std::puts("PASS same-topology edits preserve pending clocks; reorder and clear panic once with no stranded schedules");
 {
  Trace t;auto c=blocks_detail::NoteRack::defaults();c.count=16;for(unsigned i=0;i<16;++i){c.blocks[i]=block(i+1,BS_NOTE_STRUM);c.blocks[i].perf.strum_ms=0;}CHECK(t.rack->configure(c,48000));watch=true;t.rack->on(0,60,.8f);t.rack->on(1,60,.5f);t.rack->off(0,60);t.rack->off(1,60);watch=false;CHECK(t.count==4&&t.log[0].ch==0&&t.log[1].ch==1&&!t.log[2].on&&!t.log[3].on);t.until(100);CHECK(allocations==0);
 }
 std::puts("PASS maximum16-node cascade, channel ownership and allocation-free event/tick path");
}
