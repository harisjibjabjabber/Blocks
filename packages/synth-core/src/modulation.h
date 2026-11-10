#ifndef BLOCKS_MODULATION_ENGINE_H
#define BLOCKS_MODULATION_ENGINE_H
#include "blocks_modulation.h"
#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstring>
namespace blocks_detail {
inline bool modulationTarget(uint32_t id){switch(id){case 0:case 2:case 3:case 11:case 12:case 13:case 14:case 18:case 21:case 22:case 23:case 24:case BS_FILTER_RESONANCE:return true;default:return false;}}
inline bs_modulation_config defaultModulation(){bs_modulation_config c{};c.version=1;c.source_count=1;auto&s=c.sources[0];s.id=1;s.division=4;s.rate_hz=1;s.intensity=1;s.route_count=2;s.routes[0]={11,.3f};s.routes[1]={0,.2f};return c;}
inline void defaultLfoShape(bs_lfo_source_v2&s){s.retrigger=0;s.point_count=9;constexpr float h=.7071067811865475244f;const float y[]={0,h,1,h,0,-h,-1,-h,0};for(unsigned i=0;i<9;++i)s.points[i]={float(i)/8,y[i],0};}
inline bool hasDefaultLfoShape(const bs_lfo_source_v2&s){bs_lfo_source_v2 expected{};defaultLfoShape(expected);if(s.point_count!=expected.point_count)return false;for(unsigned i=0;i<s.point_count;++i)if(s.points[i].x!=expected.points[i].x||s.points[i].y!=expected.points[i].y||s.points[i].bend!=expected.points[i].bend)return false;return true;}
inline bs_modulation_config_v2 upgradeModulation(const bs_modulation_config&legacy){
 bs_modulation_config_v2 c{};c.version=BS_MODULATION_V2_VERSION;c.source_count=legacy.source_count;
 for(unsigned i=0;i<BS_MAX_LFOS;++i){std::memcpy(&c.sources[i],&legacy.sources[i],sizeof(bs_lfo_source));defaultLfoShape(c.sources[i]);}return c;
}
inline bs_modulation_config_v2 defaultModulationV2(){return upgradeModulation(defaultModulation());}
class Modulation {
 struct Clock{double phase=0,lastPhase=0;uint64_t cycle=0;};
 struct Shape{std::array<double,BS_MAX_LFO_POINTS-1> inverseWidth{},delta{};};
 bs_modulation_config legacy_=defaultModulation();
 bs_modulation_config_v2 config_=defaultModulationV2();
 std::array<Clock,BS_MAX_LFOS> clocks_{};
 std::array<Shape,BS_MAX_LFOS> shapes_{};
 bool retriggerPending_=false;
 // UI order is not arithmetic order. Stable-ID reduction is an exact sonic
 // no-op when sources are reordered, even with shared/signed target routes.
 std::array<uint32_t,BS_MAX_LFOS> executionOrder_{};
 std::array<bool,BS_PARAMETER_COUNT> targets_{};
 static uint32_t hash(uint32_t x){x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;return x^(x>>16);}
 static double random(uint32_t id,uint64_t cycle){return double(hash(id^hash(uint32_t(cycle))^hash(uint32_t(cycle>>32)^0xa511e9b3u)))/4294967295.*2-1;}
 template<class Source>static bool validSource(const Source&s,uint32_t maximumWaveform){
  if(s.enabled>1||s.synced>1||s.triplet>1||s.waveform>maximumWaveform||!std::isfinite(s.rate_hz)||s.rate_hz<.05f||s.rate_hz>20||!std::isfinite(s.intensity)||s.intensity<0||s.intensity>1||s.route_count>BS_MAX_LFO_ROUTES)return false;
  if(!(s.division==1||s.division==2||s.division==4||s.division==8||s.division==16||s.division==32||s.division==64)||(s.triplet&&s.division>16))return false;
  for(uint32_t j=0;j<s.route_count;++j){const auto&r=s.routes[j];if(!modulationTarget(r.parameter_id)||!std::isfinite(r.depth)||r.depth< -1||r.depth>1)return false;for(uint32_t k=0;k<j;++k)if(r.parameter_id==s.routes[k].parameter_id)return false;}
  return true;
 }
 static double custom(const bs_lfo_source_v2&s,const Shape&shape,double phase){
  // At most4 binary-search comparisons for16 points. Phase is half-open[0,1):
  // the final y is approached, then the first y is used at the exact wrap.
  unsigned lo=0,hi=s.point_count-1;
  while(lo+1<hi){const unsigned mid=(lo+hi)/2;if(phase>=s.points[mid].x)lo=mid;else hi=mid;}
  const double t=std::max(0.,std::min(1.,(phase-s.points[lo].x)*shape.inverseWidth[lo]));
  const double q=t+double(s.points[lo].bend)*t*(1-t);
  return double(s.points[lo].y)+shape.delta[lo]*q;
 }
 static double waveform(const bs_lfo_source_v2&s,const Clock&c,const Shape&shape){
  const double p=c.phase;
  switch(s.waveform){case BS_LFO_SINE:return std::sin(6.2831853071795864769*p);case BS_LFO_TRIANGLE:return 1-4*std::abs(p-.5);case BS_LFO_SAW:return 2*p-1;case BS_LFO_SQUARE:return p<.5?1:-1;case BS_LFO_CUSTOM:return custom(s,shape,p);default:{const double t=p*p*p*(p*(p*6-15)+10),a=random(s.id,c.cycle),b=random(s.id,c.cycle+1);return a+(b-a)*t;}}
 }
 void updateTargets(){targets_.fill(false);for(uint32_t i=0;i<config_.source_count;++i){const auto&s=config_.sources[i];if(s.enabled)for(uint32_t j=0;j<s.route_count;++j)targets_[s.routes[j].parameter_id]=true;}}
 void prepareShapes(){for(unsigned i=0;i<config_.source_count;++i){const auto&s=config_.sources[i];for(unsigned j=0;j+1<s.point_count;++j){shapes_[i].inverseWidth[j]=1/(double(s.points[j+1].x)-s.points[j].x);shapes_[i].delta[j]=double(s.points[j+1].y)-s.points[j].y;}}}
public:
 Modulation(){prepareShapes();}
 static bool valid(const bs_modulation_config&c){
  if(c.version!=BS_MODULATION_VERSION||c.source_count>BS_MAX_LFOS)return false;
  for(uint32_t i=0;i<c.source_count;++i){if(!validSource(c.sources[i],BS_LFO_SMOOTH_RANDOM))return false;for(uint32_t k=0;k<i;++k)if(c.sources[i].id==c.sources[k].id)return false;}return true;
 }
 static bool valid(const bs_modulation_config_v2&c){
  if(c.version!=BS_MODULATION_V2_VERSION||c.source_count>BS_MAX_LFOS)return false;
  for(unsigned i=0;i<c.source_count;++i){const auto&s=c.sources[i];if(!validSource(s,BS_LFO_CUSTOM)||s.retrigger>1||s.point_count<2||s.point_count>BS_MAX_LFO_POINTS)return false;
   for(unsigned k=0;k<i;++k)if(s.id==c.sources[k].id)return false;
   if(s.points[0].x!=0||s.points[s.point_count-1].x!=1)return false;
   for(unsigned j=0;j<s.point_count;++j){const auto&p=s.points[j];if(!std::isfinite(p.x)||!std::isfinite(p.y)||!std::isfinite(p.bend)||p.x<0||p.x>1||p.y< -1||p.y>1||p.bend< -1||p.bend>1)return false;if(j&&double(p.x)-s.points[j-1].x<1./1024)return false;}
  }return true;
 }
 bool configure(const bs_modulation_config&c){return valid(c)&&configure(upgradeModulation(c));}
 bool configure(const bs_modulation_config_v2&c){
  if(!valid(c))return false;std::array<Clock,BS_MAX_LFOS> next{};
  for(unsigned i=0;i<c.source_count;++i)for(unsigned j=0;j<config_.source_count;++j)if(c.sources[i].id==config_.sources[j].id)next[i]=clocks_[j];
  config_=c;clocks_=next;legacy_.version=BS_MODULATION_VERSION;legacy_.source_count=c.source_count;
  for(unsigned i=0;i<BS_MAX_LFOS;++i)std::memcpy(&legacy_.sources[i],&c.sources[i],sizeof(bs_lfo_source));
  for(uint32_t i=0;i<c.source_count;++i){executionOrder_[i]=i;uint32_t j=i;while(j&&c.sources[executionOrder_[j-1]].id>c.sources[executionOrder_[j]].id){const auto previous=executionOrder_[j-1];executionOrder_[j-1]=executionOrder_[j];executionOrder_[j]=previous;--j;}}
  prepareShapes();updateTargets();return true;
 }
 const bs_modulation_config&config()const{return legacy_;}
 const bs_modulation_config_v2&configV2()const{return config_;}
 bool getLegacy(bs_modulation_config&out)const{for(unsigned i=0;i<config_.source_count;++i)if(config_.sources[i].waveform==BS_LFO_CUSTOM||config_.sources[i].retrigger||!hasDefaultLfoShape(config_.sources[i]))return false;out=legacy_;return true;}
 const std::array<bool,BS_PARAMETER_COUNT>&targets()const{return targets_;}
 void reset(){clocks_={};retriggerPending_=false;}
 void noteOn(){retriggerPending_=true;}
 bool retriggerPending()const{return retriggerPending_;}
 void cancelRetrigger(){retriggerPending_=false;}
 double phase(uint32_t id)const{for(unsigned i=0;i<config_.source_count;++i)if(config_.sources[i].id==id)return clocks_[i].lastPhase;return -1;}
 std::array<double,BS_PARAMETER_COUNT> tick(double sampleRate,double bpm){
  std::array<double,BS_PARAMETER_COUNT> offsets{};
  if(!std::isfinite(sampleRate)||sampleRate<8000||sampleRate>384000||!std::isfinite(bpm)||bpm<40||bpm>240)return offsets;
  const bool restart=retriggerPending_;retriggerPending_=false;
  for(uint32_t position=0;position<config_.source_count;++position){const uint32_t i=executionOrder_[position];const auto&s=config_.sources[i];auto&c=clocks_[i];if(restart&&s.retrigger)c={};c.lastPhase=c.phase;
   if(s.enabled&&s.intensity!=0){const double value=waveform(s,c,shapes_[i])*s.intensity;for(uint32_t j=0;j<s.route_count;++j)offsets[s.routes[j].parameter_id]+=value*s.routes[j].depth;}
   const double hz=s.synced?(bpm/60)*(double(s.division)/4)*(s.triplet?1.5:1):s.rate_hz;
   c.phase+=hz/sampleRate;const double cycles=std::floor(c.phase);c.phase-=cycles;c.cycle+=uint64_t(cycles);
  }return offsets;
 }
};
static_assert(sizeof(bs_lfo_route)==8,"LFO route ABI");
static_assert(sizeof(bs_lfo_source)==100&&sizeof(bs_modulation_config)==408,"LFO v1 ABI");
static_assert(sizeof(bs_lfo_point)==12&&sizeof(bs_lfo_source_v2)==300&&sizeof(bs_modulation_config_v2)==1208,"LFO v2 ABI");
static_assert(offsetof(bs_lfo_source_v2,retrigger)==100&&offsetof(bs_lfo_source_v2,point_count)==104&&offsetof(bs_lfo_source_v2,points)==108&&offsetof(bs_modulation_config_v2,sources)==8,"LFO v2 offsets");
}
#endif
