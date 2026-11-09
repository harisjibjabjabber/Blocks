#ifndef BLOCKS_PERFORMANCE_H
#define BLOCKS_PERFORMANCE_H
#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <limits>
namespace blocks_detail {
inline bs_performance_config defaultPerformance(){return {1,BS_PERFORMANCE_OFF,BS_ORDER_UP,8,0,0xc0ffeeu,0,120,0,.7f,35,.25f};}
class Performance {
public:
 struct Hooks {void*context=nullptr;void(*on)(void*,uint32_t,uint32_t,float,bool)=nullptr;void(*off)(void*,uint32_t,uint32_t)=nullptr;};
 static constexpr unsigned capacity=128;
 static bool valid(const bs_performance_config&c){return c.version==1&&c.mode<=BS_STRUM&&c.order<=BS_ORDER_RANDOM&&(c.division==4||c.division==8||c.division==16||c.division==32||c.division==64)&&c.triplet<=1&&(!c.triplet||c.division<=16)&&c.mono<=1&&std::isfinite(c.bpm)&&c.bpm>=40&&c.bpm<=240&&std::isfinite(c.curl)&&c.curl>=-.8f&&c.curl<=.8f&&std::isfinite(c.gate)&&c.gate>=.1f&&c.gate<=.95f&&std::isfinite(c.strum_ms)&&c.strum_ms>=0&&c.strum_ms<=100&&std::isfinite(c.randomness)&&c.randomness>=0&&c.randomness<=1;}
 void bind(Hooks hooks){hooks_=hooks;}
 void prepare(double rate){rate_=rate;frame_=0;clear();}
 void clear(){held_={};pedals_={};queueCount_=0;collecting_=false;arp_=false;gateSlot_=-1;monoSlot_=-1;order_=0;arpIndex_=0;pending_=false;active_=requested_;rng_=active_.seed?active_.seed:1;}
 void configure(const bs_performance_config&c){requested_=c;if(arp_&&active_.mode==BS_ARP){pending_=std::memcmp(&active_,&requested_,sizeof c)!=0;}else{if(active_.seed!=c.seed)rng_=c.seed?c.seed:1;active_=c;pending_=false;}}
 const bs_performance_config&config()const{return requested_;}
 bool pending()const{return pending_;}
 bool enabled()const{return requested_.mode!=BS_PERFORMANCE_OFF||requested_.mono;}
 uint64_t frame()const{return frame_;}
 void on(unsigned channel,unsigned key,float velocity){
  if(channel>=16||key>=128||!std::isfinite(velocity))return;if(velocity<=0){off(channel,key);return;}
  int index=find(channel,key);if(index<0){for(unsigned i=0;i<capacity;++i)if(!held_[i].used){index=int(i);const auto generation=held_[i].generation+1;held_[i]=Held{};held_[i].generation=generation;held_[i].used=true;held_[i].channel=channel;held_[i].key=key;break;}}if(index<0)return;
  auto&h=held_[unsigned(index)];if(h.count==std::numeric_limits<uint32_t>::max())return;
  const bool added=h.count==0;++h.count;h.pedal=false;h.velocity=std::max(0.f,std::min(1.f,velocity));h.order=++order_;
  if(active_.mode==BS_PERFORMANCE_OFF){monoSync(true);return;}
  if(active_.mode==BS_ARP){if(!arp_||added)restartArp();return;}
  stop(index);++h.generation;h.pending=true;h.performed=false;
  if(active_.strum_ms==0){h.pending=false;emit(index);return;}
  if(!collecting_){collecting_=true;collectAt_=frame_+uint64_t(std::llround(rate_*.020));}
 }
 void off(unsigned channel,unsigned key){int i=find(channel,key);if(i<0)return;auto&h=held_[unsigned(i)];if(!h.count)return;--h.count;if(h.count==0){if(active_.mode==BS_STRUM&&!h.performed)remove(i);else{h.pedal=pedals_[channel];if(!h.pedal)remove(i);}}afterRelease(!h.used);}
 void pedal(unsigned channel,bool down){if(channel>=16)return;pedals_[channel]=down;if(!down){bool removed=false;for(unsigned i=0;i<capacity;++i)if(held_[i].used&&held_[i].channel==channel&&!held_[i].count&&held_[i].pedal){remove(int(i));removed=true;}afterRelease(removed);}}
 void tick(){
  if(active_.mode==BS_ARP&&arp_){
   if(gateSlot_>=0&&frame_>=gateOff_){stop(gateSlot_);gateSlot_=-1;}
   if(frame_>=nextOn_){
    if(step_==0&&phrase_>0&&pending_){const bool seedChanged=active_.seed!=requested_.seed;active_=requested_;pending_=false;epoch_=frame_;phrase_=0;if(seedChanged)rng_=active_.seed?active_.seed:1;}
    std::array<unsigned,capacity> notes{};const unsigned count=ordered(notes,false);
    if(!count){stopAll();arp_=false;}else{
     if(gateSlot_>=0)stop(gateSlot_);
     const unsigned selected=active_.order==BS_ORDER_RANDOM?random()%count:unsigned(arpIndex_%count);++arpIndex_;
     const int slot=int(notes[selected]);emit(slot);gateSlot_=slot;
     const unsigned steps=stepCount();++step_;if(step_>=steps){step_=0;++phrase_;}
     nextOn_=point(phrase_,step_);if(nextOn_<=frame_)nextOn_=frame_+1;
     gateOff_=frame_+std::max<uint64_t>(1,uint64_t(std::floor((nextOn_-frame_)*active_.gate)));
    }
   }
  }else if(active_.mode==BS_STRUM){
   if(collecting_&&frame_>=collectAt_)publishStrum();
   while(queueCount_&&queue_[0].when<=frame_){const auto e=queue_[0];for(unsigned i=1;i<queueCount_;++i)queue_[i-1]=queue_[i];--queueCount_;if(held_[e.slot].used&&held_[e.slot].generation==e.generation&&eligible(held_[e.slot]))emit(int(e.slot));}
  }
  ++frame_;
 }
private:
 struct Held {bool used=false,pedal=false,sounding=false,pending=false,performed=false;uint32_t channel=0,key=0,count=0;float velocity=0;uint64_t order=0,generation=0;};
 struct Queued {uint64_t when=0,generation=0;unsigned slot=0;};
 Hooks hooks_{};bs_performance_config requested_=defaultPerformance(),active_=defaultPerformance();double rate_=48000;
 std::array<Held,capacity>held_{};std::array<bool,16>pedals_{};std::array<Queued,capacity>queue_{};unsigned queueCount_=0;
 uint64_t frame_=0,order_=0,epoch_=0,chordRestart_=0,phrase_=0,arpIndex_=0,nextOn_=0,gateOff_=0,collectAt_=0;unsigned step_=0;uint32_t rng_=0xc0ffeeu;int gateSlot_=-1,monoSlot_=-1;bool arp_=false,collecting_=false,pending_=false;
 static bool eligible(const Held&h){return h.used&&(h.count||h.pedal);}
 int find(unsigned channel,unsigned key)const{for(unsigned i=0;i<capacity;++i)if(held_[i].used&&held_[i].channel==channel&&held_[i].key==key)return int(i);return -1;}
 uint32_t random(){rng_^=rng_<<13;rng_^=rng_>>17;rng_^=rng_<<5;return rng_;}
 unsigned stepCount()const{return active_.triplet?active_.division*3/2:active_.division;}
 uint64_t point(uint64_t phrase,unsigned index)const{const double n=stepCount(),u=double(index)/n,c=active_.curl,f=std::abs(c)<1e-7?u:std::expm1(-c*u)/std::expm1(-c),duration=rate_*240/active_.bpm;return epoch_+uint64_t(std::llround((double(phrase)+f)*duration));}
 unsigned ordered(std::array<unsigned,capacity>&notes,bool onlyPending){unsigned n=0;for(unsigned i=0;i<capacity;++i)if(eligible(held_[i])&&(!onlyPending||held_[i].pending))notes[n++]=i;
  std::sort(notes.begin(),notes.begin()+n,[&](unsigned a,unsigned b){const auto&x=held_[a];const auto&y=held_[b];if(active_.order==BS_ORDER_AS_PLAYED)return x.order<y.order;if(x.key!=y.key)return active_.order==BS_ORDER_DOWN?x.key>y.key:x.key<y.key;return x.channel<y.channel;});return n;}
 void stop(int i){if(i<0)return;auto&h=held_[unsigned(i)];if(h.sounding){hooks_.off(hooks_.context,h.channel,h.key);h.sounding=false;}if(monoSlot_==i)monoSlot_=-1;if(gateSlot_==i)gateSlot_=-1;}
 void stopAll(){for(unsigned i=0;i<capacity;++i)stop(int(i));}
 void emit(int i){auto&h=held_[unsigned(i)];if(active_.mono){for(unsigned j=0;j<capacity;++j)if(int(j)!=i)stop(int(j));monoSlot_=i;}if(h.sounding)stop(i);hooks_.on(hooks_.context,h.channel,h.key,h.velocity,active_.mono!=0);h.sounding=true;h.performed=true;if(active_.mono)monoSlot_=i;}
 void remove(int i){stop(i);auto&h=held_[unsigned(i)];h.pending=false;h.pedal=false;h.used=false;++h.generation;}
 // Input events at a sample are consumed before tick: repeated restarts here
 // emit no intermediate attacks and the first tick sees the complete chord.
 void restartArp(){if(arp_&&frame_-chordRestart_<uint64_t(std::llround(rate_*.020)))return;chordRestart_=frame_;stopAll();active_=requested_;pending_=false;arp_=true;epoch_=frame_;phrase_=0;step_=0;arpIndex_=0;nextOn_=frame_;rng_=active_.seed?active_.seed:1;}
 void afterRelease(bool membershipChanged){
  if(active_.mode==BS_PERFORMANCE_OFF&&active_.mono)monoSync(false);
  else if(active_.mode==BS_STRUM&&active_.mono&&monoSlot_<0)monoSync(false,true);
  if(active_.mode==BS_STRUM){bool any=false;for(const auto&h:held_)any|=eligible(h);if(!any){collecting_=false;queueCount_=0;}}
  if(active_.mode==BS_ARP){bool any=false;for(const auto&h:held_)any|=eligible(h);if(!any){stopAll();arp_=false;pending_=false;if(active_.seed!=requested_.seed)rng_=requested_.seed?requested_.seed:1;active_=requested_;}else if(membershipChanged)restartArp();}
 }
 void monoSync(bool retrigger,bool performedOnly=false){int newest=-1;for(unsigned i=0;i<capacity;++i)if(eligible(held_[i])&&(!performedOnly||held_[i].performed)&&(newest<0||(held_[i].count>0&&held_[unsigned(newest)].count==0)||((held_[i].count>0)==(held_[unsigned(newest)].count>0)&&held_[i].order>held_[unsigned(newest)].order)))newest=int(i);if(newest<0){stopAll();return;}if(newest!=monoSlot_||retrigger)emit(newest);}
 void publishStrum(){collecting_=false;unsigned kept=0;for(unsigned i=0;i<queueCount_;++i){const auto&e=queue_[i];if(eligible(held_[e.slot])&&held_[e.slot].generation==e.generation)queue_[kept++]=e;}queueCount_=kept;
  std::array<unsigned,capacity>notes{};const unsigned n=ordered(notes,true);if(!n)return;
  if(active_.order==BS_ORDER_RANDOM)for(unsigned i=n-1;i>0;--i)std::swap(notes[i],notes[random()%(i+1)]);
  std::array<double,capacity>intervals{};double total=0;for(unsigned i=1;i<n;++i){intervals[i]=1+active_.randomness*.75*(2*double(random())/4294967295.-1);total+=intervals[i];}
  double sum=0;for(unsigned i=0;i<n;++i){sum+=intervals[i];const auto slot=notes[i];held_[slot].pending=false;const double fraction=i==0?0:i==n-1?1:sum/total;const uint64_t when=frame_+uint64_t(std::llround(rate_*active_.strum_ms*.001*fraction));if(queueCount_<capacity)queue_[queueCount_++]={when,held_[slot].generation,slot};}
  for(unsigned i=1;i<queueCount_;++i){const auto value=queue_[i];unsigned j=i;while(j&&queue_[j-1].when>value.when){queue_[j]=queue_[j-1];--j;}queue_[j]=value;}
 }
};
}
#endif
