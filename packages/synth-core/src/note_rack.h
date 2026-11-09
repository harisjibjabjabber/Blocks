#ifndef BLOCKS_NOTE_RACK_H
#define BLOCKS_NOTE_RACK_H
#include "blocks_notes.h"
#include "performance.h"
#include <array>
#include <cmath>
#include <cstddef>
namespace blocks_detail {
class NoteRack {
public:
 struct Hooks{void*context=nullptr;void(*on)(void*,uint32_t,uint32_t,float)=nullptr;void(*off)(void*,uint32_t,uint32_t)=nullptr;void(*pedal)(void*,uint32_t,bool)=nullptr;void(*panic)(void*)=nullptr;};
 static bs_notes_config defaults(){bs_notes_config c{};c.version=BS_NOTES_VERSION;return c;}
 static bool valid(const bs_notes_config&c){
  if(c.version!=BS_NOTES_VERSION||c.count>BS_NOTES_CAPACITY)return false;unsigned primary=0;
  for(uint32_t i=0;i<c.count;++i){const auto&b=c.blocks[i];if(!b.id||b.type>BS_NOTE_DROP||b.enabled>1||b.primary>1)return false;for(uint32_t j=0;j<i;++j)if(b.id==c.blocks[j].id)return false;
   if(b.type==BS_NOTE_DROP){if(!std::isfinite(b.drop_amount)||b.drop_amount<0||b.drop_amount>2400||!std::isfinite(b.drop_time)||b.drop_time<.001f||b.drop_time>4||!std::isfinite(b.drop_bend)||b.drop_bend< -2||b.drop_bend>2)return false;if(b.primary&&++primary>1)return false;}
   else if(b.primary||!Performance::valid(b.perf)||b.perf.mono||b.perf.mode!=(b.type==BS_NOTE_ARP?BS_ARP:BS_STRUM))return false;
  }return true;
 }
 NoteRack(){for(unsigned i=0;i<BS_NOTES_CAPACITY;++i){links_[i]={this,i+1};stages_[i].bind({&links_[i],[](void*p,uint32_t ch,uint32_t key,float velocity,bool,bool){auto&l=*static_cast<Link*>(p);l.rack->forwardOn(l.next,ch,key,velocity);},[](void*p,uint32_t ch,uint32_t key){auto&l=*static_cast<Link*>(p);l.rack->forwardOff(l.next,ch,key);}});stages_[i].prepare(rate_);}}
 NoteRack(const NoteRack&)=delete;NoteRack&operator=(const NoteRack&)=delete;
 void bind(Hooks h){hooks_=h;}
 bool configure(const bs_notes_config&c,double rate){
  if(!valid(c)||!std::isfinite(rate)||rate<8000||rate>384000)return false;
  bool topology=c.count!=config_.count;for(uint32_t i=0;i<c.count&&!topology;++i){const auto&a=c.blocks[i];const auto&b=config_.blocks[i];topology=a.id!=b.id||a.type!=b.type||a.enabled!=b.enabled;}
  if(topology||rate!=rate_){if(hooks_.panic)hooks_.panic(hooks_.context);for(auto&s:stages_)s.clear();}
  config_=c;
  for(uint32_t i=0;i<c.count;++i)if(c.blocks[i].type!=BS_NOTE_DROP)stages_[i].configure(c.blocks[i].perf);
  if(rate!=rate_)prepare(rate);return true;
 }
 void prepare(double rate){if(!std::isfinite(rate)||rate<8000||rate>384000)return;rate_=rate;for(auto&s:stages_)s.prepare(rate);}
 void clear(){if(hooks_.panic)hooks_.panic(hooks_.context);for(auto&s:stages_)s.clear();}
 void on(uint32_t ch,uint32_t key,float velocity){if(ch>=16||key>=128||!std::isfinite(velocity))return;if(velocity<=0){off(ch,key);return;}forwardOn(0,ch,key,std::min(1.f,velocity));}
 void off(uint32_t ch,uint32_t key){if(ch<16&&key<128)forwardOff(0,ch,key);}
 void pedal(uint32_t ch,bool down){if(ch>=16)return;const unsigned next=generator(0);if(next<config_.count)stages_[next].pedal(ch,down);else if(hooks_.pedal)hooks_.pedal(hooks_.context,ch,down);}
 void tick(){for(auto&s:stages_)s.tick();}
 bool hasGenerators()const{return generator(0)<config_.count;}
 bool hasEnabledNodes()const{for(uint32_t i=0;i<config_.count;++i)if(config_.blocks[i].enabled)return true;return false;}
 uint32_t pendingMask()const{uint32_t mask=0;for(uint32_t i=0;i<config_.count;++i)if(config_.blocks[i].enabled&&config_.blocks[i].type==BS_NOTE_ARP&&stages_[i].pending())mask|=uint32_t(1)<<i;return mask;}
 const bs_notes_config&config()const{return config_;}
private:
 struct Link{NoteRack*rack=nullptr;unsigned next=0;};
 Hooks hooks_{};bs_notes_config config_=defaults();double rate_=48000;
 std::array<Performance,BS_NOTES_CAPACITY>stages_{};std::array<Link,BS_NOTES_CAPACITY>links_{};
 unsigned generator(unsigned start)const{for(unsigned i=start;i<config_.count;++i)if(config_.blocks[i].enabled&&config_.blocks[i].type!=BS_NOTE_DROP)return i;return config_.count;}
 void forwardOn(unsigned start,uint32_t ch,uint32_t key,float velocity){const unsigned next=generator(start);if(next<config_.count)stages_[next].on(ch,key,velocity);else if(hooks_.on)hooks_.on(hooks_.context,ch,key,velocity);}
 void forwardOff(unsigned start,uint32_t ch,uint32_t key){const unsigned next=generator(start);if(next<config_.count)stages_[next].off(ch,key);else if(hooks_.off)hooks_.off(hooks_.context,ch,key);}
};
static_assert(sizeof(bs_note_block)==76&&offsetof(bs_note_block,perf)==16&&offsetof(bs_note_block,drop_amount)==64,"Note block ABI");
static_assert(sizeof(bs_notes_config)==1224,"Note rack ABI");
}
#endif
