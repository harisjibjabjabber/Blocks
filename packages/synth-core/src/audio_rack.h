#ifndef BLOCKS_AUDIO_RACK_H
#define BLOCKS_AUDIO_RACK_H
#include "blocks_sauce.h"
#include "blocks_modulation.h"
#include "fullness.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
namespace blocks_detail {
class AudioRack {
public:
 struct Modulation {struct Offset{uint32_t id=0;double value=0;};std::array<Offset,BS_MAX_LFOS*BS_MAX_LFO_ROUTES+BS_SAUCE_CAPACITY> offsets{};unsigned count=0;double at(uint32_t id)const{for(unsigned i=0;i<count;++i)if(offsets[i].id==id)return offsets[i].value;return 0;}};
private:
 const Modulation*modulation_=nullptr;
 struct State {FullnessPath fullness;double amount=0,enabled=0,modulation=0;};
 struct Graph {bs_sauce_config config{};std::array<State,BS_SAUCE_CAPACITY> states{};FullnessPath base;bool includeBase=false,primaryFullness=false;};
 Graph active_{},old_{};bs_sauce_config requested_{};bool pending_=false,includeBase_=false;uint32_t position_=0,length_=0,sharedPrefix_=0;bool sharedBase_=false;double rate_=48000,smoothing_=1-std::exp(-1.0/240);
 static bool equal(const bs_sauce_config&a,const bs_sauce_config&b){if(a.version!=b.version||a.count!=b.count)return false;for(unsigned i=0;i<a.count;++i){const auto&x=a.blocks[i];const auto&y=b.blocks[i];if(x.id!=y.id||x.type!=y.type||x.primary!=y.primary||x.enabled!=y.enabled||x.amount!=y.amount)return false;}return true;}
 void begin(const bs_sauce_config&config,bool immediate){
  old_=active_;Graph next{};next.config=config;next.base=active_.base;next.includeBase=includeBase_;
  for(unsigned i=0;i<config.count;++i){const auto&b=config.blocks[i];if(b.primary){next.primaryFullness=true;}auto&state=next.states[i];state.amount=b.amount;state.enabled=b.enabled;
   for(unsigned j=0;j<active_.config.count;++j)if(active_.config.blocks[j].id==b.id&&active_.config.blocks[j].type==b.type){state=active_.states[j];break;}
   if(immediate){state.amount=b.amount;state.enabled=b.enabled;}
  }
  active_=next;position_=0;length_=immediate?0:uint32_t(std::max(1.0,std::ceil(rate_*.005)));
  sharedBase_=active_.includeBase==old_.includeBase&&(!active_.includeBase||(active_.primaryFullness==old_.primaryFullness));
  sharedPrefix_=0;
  if(sharedBase_)while(sharedPrefix_<std::min(active_.config.count,old_.config.count)){
   const auto&a=active_.config.blocks[sharedPrefix_];const auto&b=old_.config.blocks[sharedPrefix_];
   if(a.id!=b.id||a.type!=b.type||a.primary!=b.primary||a.enabled!=b.enabled||a.amount!=b.amount)break;
   ++sharedPrefix_;
  }
 }
 static double body(FullnessPath&state,double input,double amount,double dcPole,double alpha){const double residual=state.process(input,dcPole),colour=amount>0?input+amount*residual:input;const double low=state.body(colour,alpha);return amount>0?colour+amount*low:colour;}
 double base(Graph&g,double input,double,double fullnessAmount,double,double fullnessEnabled,double dcPole,double alpha,double){return g.includeBase?body(g.base,input,g.primaryFullness?0:fullnessAmount*fullnessEnabled,dcPole,alpha):input;}
 double stages(Graph&g,double input,unsigned start,unsigned end,double,double fullnessAmount,double,double fullnessEnabled,double dcPole,double alpha){
  for(unsigned i=start;i<end;++i){const auto&b=g.config.blocks[i];auto&state=g.states[i];double amount,enabled;
   if(b.primary){amount=fullnessAmount;enabled=fullnessEnabled;}
   else{state.amount+=smoothing_*(b.amount-state.amount);state.enabled+=smoothing_*(b.enabled-state.enabled);if(std::abs(state.amount-b.amount)<1e-12)state.amount=b.amount;if(std::abs(state.enabled-b.enabled)<1e-12)state.enabled=b.enabled;amount=state.amount;enabled=state.enabled;}
   const double modTarget=modulation_?modulation_->at(b.id):0;
   if(modTarget!=0||state.modulation!=0){state.modulation+=smoothing_*(modTarget-state.modulation);if(std::abs(state.modulation-modTarget)<1e-12)state.modulation=modTarget;amount=std::clamp(amount+state.modulation,0.,1.);}
   input=body(state.fullness,input,amount*enabled,dcPole,alpha);
  }
  return input;
 }
 double graph(Graph&g,double input,double driveAmount,double fullnessAmount,double driveEnabled,double fullnessEnabled,double dcPole,double alpha,double baseOrder){
  input=base(g,input,driveAmount,fullnessAmount,driveEnabled,fullnessEnabled,dcPole,alpha,baseOrder);
  return stages(g,input,0,g.config.count,driveAmount,fullnessAmount,driveEnabled,fullnessEnabled,dcPole,alpha);
 }

public:
 static bs_sauce_config defaults(){bs_sauce_config c{};c.version=BS_SAUCE_VERSION;return c;}
 static bool valid(const bs_sauce_config&c){if(c.version!=BS_SAUCE_VERSION||c.count>BS_SAUCE_CAPACITY)return false;bool primary=false;for(unsigned i=0;i<c.count;++i){const auto&b=c.blocks[i];if(!b.id||b.type!=BS_SAUCE_FULLNESS||b.primary>1||b.enabled>1||!std::isfinite(b.amount)||b.amount<0||b.amount>1||(b.primary&&primary))return false;if(b.primary)primary=true;for(unsigned j=0;j<i;++j)if(c.blocks[j].id==b.id)return false;}return true;}
 AudioRack(){requested_=defaults();begin(requested_,true);}
 bool configure(const bs_sauce_config&config,double rate,bool immediate=false,bool includeBase=false){if(!valid(config)||!std::isfinite(rate)||rate<8000||rate>384000)return false;rate_=rate;includeBase_=includeBase;smoothing_=1-std::exp(-1/(.005*rate));requested_=config;if(immediate){pending_=false;begin(config,true);}else if(length_){pending_=!equal(config,active_.config)||includeBase_!=active_.includeBase;}else if(!equal(config,active_.config)||includeBase_!=active_.includeBase)begin(config,false);return true;}
 const bs_sauce_config&config()const{return requested_;}
 bool transitioning()const{return length_!=0||pending_;}
 double process(double input,double driveAmount,double fullnessAmount,double driveEnabled,double fullnessEnabled,double dcPole,double alpha,double baseOrder=0,const Modulation*modulation=nullptr,double linkedMagnitude=-1,double amplitudeContext=1){
  modulation_=modulation;(void)linkedMagnitude;(void)amplitudeContext;
  if(!length_)return graph(active_,input,driveAmount,fullnessAmount,driveEnabled,fullnessEnabled,dcPole,alpha,baseOrder);
  double current,prior;
  if(sharedBase_){
   // Both graphs start with identical state, controls and input. Evaluate the
   // common base/prefix once; only the active state must survive this fade.
   // Old prefix state is never read again: pending edits begin from active_.
   input=base(active_,input,driveAmount,fullnessAmount,driveEnabled,fullnessEnabled,dcPole,alpha,baseOrder);
   input=stages(active_,input,0,sharedPrefix_,driveAmount,fullnessAmount,driveEnabled,fullnessEnabled,dcPole,alpha);
   current=stages(active_,input,sharedPrefix_,active_.config.count,driveAmount,fullnessAmount,driveEnabled,fullnessEnabled,dcPole,alpha);
   prior=stages(old_,input,sharedPrefix_,old_.config.count,driveAmount,fullnessAmount,driveEnabled,fullnessEnabled,dcPole,alpha);
  }else{
   current=graph(active_,input,driveAmount,fullnessAmount,driveEnabled,fullnessEnabled,dcPole,alpha,baseOrder);
   prior=graph(old_,input,driveAmount,fullnessAmount,driveEnabled,fullnessEnabled,dcPole,alpha,baseOrder);
  }
  const double mix=double(position_)/length_,output=prior+mix*(current-prior);
  if(++position_>=length_){length_=0;position_=0;if(pending_){pending_=false;begin(requested_,false);}}
  return output;
 }
};
static_assert(sizeof(bs_sauce_block)==20&&offsetof(bs_sauce_block,amount)==16,"Sauce block ABI");
static_assert(sizeof(bs_sauce_config)==328&&offsetof(bs_sauce_config,blocks)==8,"Sauce config ABI");
}
#endif
