#ifndef BLOCKS_AUDIO_RACK_H
#define BLOCKS_AUDIO_RACK_H
#include "blocks_sauce.h"
#include "fullness.h"
#include "sauce.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
namespace blocks_detail {
class AudioRack {
 struct State {FullnessPath fullness;double amount=0,enabled=0;};
 struct Graph {bs_sauce_config config{};std::array<State,BS_SAUCE_CAPACITY> states{};SauceRack base;bool includeBase=false;};
 Graph active_{},old_{};bs_sauce_config requested_{};bool pending_=false,includeBase_=false;uint32_t position_=0,length_=0;double rate_=48000,smoothing_=1-std::exp(-1.0/240);
 static bool equal(const bs_sauce_config&a,const bs_sauce_config&b){if(a.version!=b.version||a.count!=b.count)return false;for(unsigned i=0;i<a.count;++i){const auto&x=a.blocks[i];const auto&y=b.blocks[i];if(x.id!=y.id||x.type!=y.type||x.primary!=y.primary||x.enabled!=y.enabled||x.amount!=y.amount)return false;}return true;}
 void begin(const bs_sauce_config&config,bool immediate){
  old_=active_;Graph next{};next.config=config;next.base=active_.base;next.includeBase=includeBase_;
  for(unsigned i=0;i<config.count;++i){const auto&b=config.blocks[i];auto&state=next.states[i];state.amount=b.amount;state.enabled=b.enabled;
   for(unsigned j=0;j<active_.config.count;++j)if(active_.config.blocks[j].id==b.id&&active_.config.blocks[j].type==b.type){state=active_.states[j];break;}
   if(immediate){state.amount=b.amount;state.enabled=b.enabled;}
  }
  active_=next;position_=0;length_=immediate?0:uint32_t(std::max(1.0,std::ceil(rate_*.005)));
 }
 double graph(Graph&g,double input,double driveAmount,double fullnessAmount,double driveEnabled,double fullnessEnabled,double dcPole,double alpha,double baseOrder){
  if(g.includeBase){bool primaryDrive=false,primaryFullness=false;for(unsigned i=0;i<g.config.count;++i)if(g.config.blocks[i].primary){primaryDrive|=g.config.blocks[i].type==BS_SAUCE_DRIVE;primaryFullness|=g.config.blocks[i].type==BS_SAUCE_FULLNESS;}input=g.base.process(input,driveAmount,fullnessAmount,baseOrder,primaryDrive?0:driveEnabled,primaryFullness?0:fullnessEnabled,dcPole,alpha);}
  for(unsigned i=0;i<g.config.count;++i){const auto&b=g.config.blocks[i];auto&state=g.states[i];double amount,enabled;
   if(b.primary){amount=b.type==BS_SAUCE_DRIVE?driveAmount:fullnessAmount;enabled=b.type==BS_SAUCE_DRIVE?driveEnabled:fullnessEnabled;}
   else{state.amount+=smoothing_*(b.amount-state.amount);state.enabled+=smoothing_*(b.enabled-state.enabled);if(std::abs(state.amount-b.amount)<1e-12)state.amount=b.amount;if(std::abs(state.enabled-b.enabled)<1e-12)state.enabled=b.enabled;amount=state.amount;enabled=state.enabled;}
   if(b.type==BS_SAUCE_DRIVE){if(enabled!=0){const double wet=std::tanh(input*amount);input=enabled==1?wet:input+enabled*(wet-input);}}
   else{const double depth=amount*enabled,residual=state.fullness.process(input,dcPole),colour=depth>0?input+depth*residual:input,body=state.fullness.body(colour,alpha);input=depth>0?colour+depth*body:colour;}
  }
  return input;
 }
public:
 static bs_sauce_config defaults(){bs_sauce_config c{};c.version=BS_SAUCE_VERSION;c.count=2;c.blocks[0]={1,BS_SAUCE_DRIVE,1,1,1};c.blocks[1]={2,BS_SAUCE_FULLNESS,1,1,0};return c;}
 static bool valid(const bs_sauce_config&c){if(c.version!=BS_SAUCE_VERSION||c.count>BS_SAUCE_CAPACITY)return false;bool primary[2]={false,false};for(unsigned i=0;i<c.count;++i){const auto&b=c.blocks[i];if(!b.id||b.type>BS_SAUCE_FULLNESS||b.primary>1||b.enabled>1||!std::isfinite(b.amount)||b.amount<(b.type==BS_SAUCE_DRIVE?1.f:0.f)||b.amount>(b.type==BS_SAUCE_DRIVE?12.f:1.f))return false;if(b.primary){if(primary[b.type])return false;primary[b.type]=true;}for(unsigned j=0;j<i;++j)if(c.blocks[j].id==b.id)return false;}return true;}
 AudioRack(){requested_=defaults();begin(requested_,true);}
 bool configure(const bs_sauce_config&config,double rate,bool immediate=false,bool includeBase=false){if(!valid(config)||!std::isfinite(rate)||rate<8000||rate>384000)return false;rate_=rate;includeBase_=includeBase;smoothing_=1-std::exp(-1/(.005*rate));requested_=config;if(immediate){pending_=false;begin(config,true);}else if(length_){pending_=!equal(config,active_.config)||includeBase_!=active_.includeBase;}else if(!equal(config,active_.config)||includeBase_!=active_.includeBase)begin(config,false);return true;}
 const bs_sauce_config&config()const{return requested_;}
 bool transitioning()const{return length_!=0||pending_;}
 double process(double input,double driveAmount,double fullnessAmount,double driveEnabled,double fullnessEnabled,double dcPole,double alpha,double baseOrder=0){
  const double current=graph(active_,input,driveAmount,fullnessAmount,driveEnabled,fullnessEnabled,dcPole,alpha,baseOrder);if(!length_)return current;
  const double prior=graph(old_,input,driveAmount,fullnessAmount,driveEnabled,fullnessEnabled,dcPole,alpha,baseOrder),mix=double(position_)/length_,output=prior+mix*(current-prior);
  if(++position_>=length_){length_=0;position_=0;if(pending_){pending_=false;begin(requested_,false);}}
  return output;
 }
};
static_assert(sizeof(bs_sauce_block)==20&&offsetof(bs_sauce_block,amount)==16,"Sauce block ABI");
static_assert(sizeof(bs_sauce_config)==328&&offsetof(bs_sauce_config,blocks)==8,"Sauce config ABI");
}
#endif
