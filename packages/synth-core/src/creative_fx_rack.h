#ifndef BLOCKS_CREATIVE_FX_RACK_H
#define BLOCKS_CREATIVE_FX_RACK_H
#include "blocks_creative_fx.h"
#include "creative_processors.h"
#include <array>
#include <algorithm>
#include <cmath>
#include <cstddef>
namespace blocks_detail {
class CreativeFXRack {
 struct Slot {uint32_t id=0,type=0;MovingSpace space;Impact impact;};
 std::array<Slot,BS_CREATIVE_FX_CAPACITY> slots_;
 std::array<unsigned,BS_CREATIVE_FX_CAPACITY> order_{};
 bs_creative_fx_config active_{1,0,{}},requested_{1,0,{}};
 enum Phase {stable,out,in};Phase phase_=stable;
 double fade_=1,step_=1./480,rate_=0;bool processed_=false;
 static bool topology(const bs_creative_fx_config&a,const bs_creative_fx_config&b){if(a.count!=b.count)return false;for(unsigned i=0;i<a.count;++i)if(a.blocks[i].id!=b.blocks[i].id||a.blocks[i].type!=b.blocks[i].type)return false;return true;}
 void apply(const bs_creative_fx_config&c,bool now){
  std::array<bool,BS_CREATIVE_FX_CAPACITY> used{};std::array<int,BS_CREATIVE_FX_CAPACITY> indices{};indices.fill(-1);
  for(unsigned i=0;i<c.count;++i)for(unsigned j=0;j<slots_.size();++j)if(slots_[j].id==c.blocks[i].id&&slots_[j].type==c.blocks[i].type){indices[i]=int(j);used[j]=true;break;}
  for(unsigned i=0;i<c.count;++i){bool fresh=indices[i]<0;if(fresh){unsigned j=0;while(used[j])++j;indices[i]=int(j);used[j]=true;auto&s=slots_[j];s.id=c.blocks[i].id;s.type=c.blocks[i].type;s.space.clear();s.impact.clear();}
   const unsigned j=unsigned(indices[i]);order_[i]=j;auto&s=slots_[j];if(s.type==BS_CREATIVE_MOVING_SPACE)s.space.configure(c.blocks[i],now||fresh);else s.impact.configure(c.blocks[i],now||fresh);
  }
  for(unsigned j=0;j<slots_.size();++j)if(!used[j]&&slots_[j].id){slots_[j].id=0;slots_[j].space.clear();slots_[j].impact.clear();}
  active_=c;
 }
public:
 static bs_creative_fx_config defaults(){return{1,0,{}};}
 static bs_creative_fx_block blockDefaults(unsigned type){return{1,type,1,type==BS_CREATIVE_IMPACT?.7f:.35f,.45f,.35f,.45f,12,.6f,.35f,.5f,0};}
 static bool valid(const bs_creative_fx_config&c){
  if(c.version!=BS_CREATIVE_FX_VERSION||c.count>BS_CREATIVE_FX_CAPACITY)return false;
  for(unsigned i=0;i<c.count;++i){const auto&b=c.blocks[i];if(!b.id||b.id>0x7fffffffu||b.type>BS_CREATIVE_IMPACT||b.enabled>1)return false;for(unsigned j=0;j<i;++j)if(c.blocks[j].id==b.id)return false;
   const float fields[]={b.mix,b.motion,b.space,b.shimmer,b.tight,b.click,b.body};for(float x:fields)if(!std::isfinite(x)||x<0||x>1)return false;
   if(!std::isfinite(b.pitch)||b.pitch< -12||b.pitch>12||!std::isfinite(b.output_db)||b.output_db< -24||b.output_db>12)return false;
  }return true;
 }
 bool prepare(double rate){if(!std::isfinite(rate)||rate<8000||rate>384000)return false;for(auto&s:slots_)if(!s.space.prepare(rate)||!s.impact.prepare(rate))return false;rate_=rate;step_=1/(.01*rate);clear();return true;}
 double rate()const{return rate_;}
 bool configure(const bs_creative_fx_config&c){if(!valid(c))return false;requested_=c;if(!processed_){apply(c,true);phase_=stable;fade_=1;}else if(phase_==stable&&topology(active_,c)){apply(c,false);}else if(phase_!=out){phase_=out;}return true;}
 const bs_creative_fx_config&config()const{return requested_;}
 void clear(){for(auto&s:slots_){s.space.clear();s.impact.clear();}apply(requested_,true);phase_=stable;fade_=1;processed_=false;}
 void process(double&l,double&r){
  processed_=true;if(phase_==out){fade_=std::max(0.,fade_-step_);if(fade_==0){apply(requested_,false);phase_=in;}}
  else if(phase_==in){fade_=std::min(1.,fade_+step_);if(fade_==1)phase_=stable;}
  const double dryL=l,dryR=r;
  for(unsigned i=0;i<active_.count;++i){auto&s=slots_[order_[i]];if(s.type==BS_CREATIVE_MOVING_SPACE)s.space.process(l,r);else s.impact.process(l,r);}
  if(fade_!=1){l=dryL+fade_*(l-dryL);r=dryR+fade_*(r-dryR);}
 }
};
static_assert(sizeof(bs_creative_fx_block)==48&&offsetof(bs_creative_fx_block,mix)==12&&sizeof(bs_creative_fx_config)==776,"Creative FX ABI");
}
#endif
