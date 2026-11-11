#ifndef BLOCKS_MODULATION_ENGINE_H
#define BLOCKS_MODULATION_ENGINE_H
#include "blocks_modulation.h"
#include "blocks_synth.h"
#include "workspace_targets.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstring>
namespace blocks_detail {
inline bool modulationTarget(uint32_t id){return workspaceTarget(0,0,id)!=nullptr;}
template<class Source>inline void defaultLfoShape(Source&s){s.retrigger=0;s.point_count=9;constexpr float h=.7071067811865475244f;const float y[]={0,h,1,h,0,-h,-1,-h,0};for(unsigned i=0;i<9;++i)s.points[i]={float(i)/8,y[i],0};}
inline bs_modulation_config_v3 defaultModulationV3(){bs_modulation_config_v3 c{};c.version=3;c.source_count=1;auto&s=c.sources[0];s.id=1;s.division=4;s.rate_hz=1;s.intensity=1;s.route_count=2;s.routes[0]={0,0,11,.3f};s.routes[1]={0,0,0,.2f};defaultLfoShape(s);return c;}
class Modulation {
 struct Clock{double phase=0,lastPhase=0;uint64_t cycle=0;double previous=0,smoothedValue=0,rateOffset=0,intensityOffset=0,hz=1,intensity=1;};
 struct Shape{std::array<double,BS_MAX_LFO_POINTS_V3-1> inverseWidth{},delta{};};
 bs_modulation_config_v3 config_=defaultModulationV3();
 std::array<Clock,BS_MAX_LFOS> clocks_{};
 std::array<Shape,BS_MAX_LFOS> shapes_{};
 bool retriggerPending_=false;double smoothingRate_=0,smoothing_=0;
 // UI order is not arithmetic order. Stable-ID reduction is an exact sonic
 // no-op when sources are reordered, even with shared/signed target routes.
 std::array<uint32_t,BS_MAX_LFOS> executionOrder_{};
 std::array<bool,BS_PARAMETER_COUNT> targets_{};
 static uint32_t hash(uint32_t x){x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;return x^(x>>16);}
 static double random(uint32_t id,uint64_t cycle){return double(hash(id^hash(uint32_t(cycle))^hash(uint32_t(cycle>>32)^0xa511e9b3u)))/4294967295.*2-1;}
 template<class Source>static bool validSource(const Source&s,uint32_t maximumWaveform){
  if(s.enabled>1||s.synced>1||s.triplet>1||s.waveform>maximumWaveform||!std::isfinite(s.rate_hz)||s.rate_hz<.05f||s.rate_hz>20||!std::isfinite(s.intensity)||s.intensity<0||s.intensity>1||s.route_count>BS_MAX_LFO_ROUTES)return false;
  if(!(s.division==1||s.division==2||s.division==4||s.division==8||s.division==16||s.division==32||s.division==64)||(s.triplet&&s.division>16))return false;
  for(uint32_t j=0;j<s.route_count;++j){const auto&r=s.routes[j];if(!validRoute(r))return false;for(uint32_t k=0;k<j;++k)if(sameRoute(r,s.routes[k]))return false;}
  return true;
 }
 static bool validRoute(const bs_lfo_route_v3&r){return workspaceRoute(r);}
 static bool sameRoute(const bs_lfo_route_v3&a,const bs_lfo_route_v3&b){return a.target_kind==b.target_kind&&a.target_id==b.target_id&&a.parameter_id==b.parameter_id;}
 static double custom(const bs_lfo_source_v3&s,const Shape&shape,double phase){
  // At most5 binary-search comparisons for32 points. Phase is half-open[0,1):
  // the final y is approached, then the first y is used at the exact wrap.
  unsigned lo=0,hi=s.point_count-1;
  while(lo+1<hi){const unsigned mid=(lo+hi)/2;if(phase>=s.points[mid].x)lo=mid;else hi=mid;}
  const double t=std::max(0.,std::min(1.,(phase-s.points[lo].x)*shape.inverseWidth[lo]));
  const double q=t+double(s.points[lo].bend)*t*(1-t);
  return double(s.points[lo].y)+shape.delta[lo]*q;
 }
 static double waveform(const bs_lfo_source_v3&s,const Clock&c,const Shape&shape){
  const double p=c.phase;
  switch(s.waveform){case BS_LFO_SINE:return std::sin(6.2831853071795864769*p);case BS_LFO_TRIANGLE:return 1-4*std::abs(p-.5);case BS_LFO_SAW:return 2*p-1;case BS_LFO_SQUARE:return p<.5?1:-1;case BS_LFO_CUSTOM:return custom(s,shape,p);default:{const double t=p*p*p*(p*(p*6-15)+10),a=random(s.id,c.cycle),b=random(s.id,c.cycle+1);return a+(b-a)*t;}}
 }
 void updateTargets(){targets_.fill(false);for(uint32_t i=0;i<config_.source_count;++i){const auto&s=config_.sources[i];if(s.enabled)for(uint32_t j=0;j<s.route_count;++j)if(s.routes[j].target_kind==0)targets_[s.routes[j].parameter_id]=true;}}
 void prepareShapes(){for(unsigned i=0;i<config_.source_count;++i){const auto&s=config_.sources[i];for(unsigned j=0;j+1<s.point_count;++j){shapes_[i].inverseWidth[j]=1/(double(s.points[j+1].x)-s.points[j].x);shapes_[i].delta[j]=double(s.points[j+1].y)-s.points[j].y;}}}
public:
 Modulation(){prepareShapes();}
 template<class Config>static bool validShapeConfig(const Config&c,unsigned version,unsigned capacity){
  if(c.version!=version||c.source_count>BS_MAX_LFOS)return false;
  for(unsigned i=0;i<c.source_count;++i){const auto&s=c.sources[i];if(!validSource(s,BS_LFO_CUSTOM)||s.retrigger>1||s.point_count<2||s.point_count>capacity)return false;
   for(unsigned k=0;k<i;++k)if(s.id==c.sources[k].id)return false;
   if(s.points[0].x!=0||s.points[s.point_count-1].x!=1)return false;
   for(unsigned j=0;j<s.point_count;++j){const auto&p=s.points[j];if(!std::isfinite(p.x)||!std::isfinite(p.y)||!std::isfinite(p.bend)||p.x<0||p.x>1||p.y< -1||p.y>1||p.bend< -1||p.bend>1)return false;if(j&&double(p.x)-s.points[j-1].x<1./1024)return false;}
  }return true;
 }
 static bool valid(const bs_modulation_config_v3&c){return validShapeConfig(c,3,BS_MAX_LFO_POINTS_V3);}
 bool configure(const bs_modulation_config_v3&c){
  if(!valid(c))return false;std::array<Clock,BS_MAX_LFOS> next{};
  for(unsigned i=0;i<c.source_count;++i)for(unsigned j=0;j<config_.source_count;++j)if(c.sources[i].id==config_.sources[j].id)next[i]=clocks_[j];
  config_=c;clocks_=next;
  for(uint32_t i=0;i<c.source_count;++i){executionOrder_[i]=i;uint32_t j=i;while(j&&c.sources[executionOrder_[j-1]].id>c.sources[executionOrder_[j]].id){const auto previous=executionOrder_[j-1];executionOrder_[j-1]=executionOrder_[j];executionOrder_[j]=previous;--j;}}
  prepareShapes();updateTargets();return true;
 }
 const bs_modulation_config_v3&configV3()const{return config_;}
 const std::array<bool,BS_PARAMETER_COUNT>&targets()const{return targets_;}
 void reset(){clocks_={};retriggerPending_=false;sauceCount_=effectCount_=0;}
 void noteOn(){retriggerPending_=true;}
 bool retriggerPending()const{return retriggerPending_;}
 void cancelRetrigger(){retriggerPending_=false;}
 double phase(uint32_t id)const{for(unsigned i=0;i<config_.source_count;++i)if(config_.sources[i].id==id)return clocks_[i].lastPhase;return -1;}
 double value(uint32_t id)const{for(unsigned i=0;i<config_.source_count;++i)if(config_.sources[i].id==id)return clocks_[i].previous;return 0;}
 double control(uint32_t id,unsigned parameter)const{for(unsigned i=0;i<config_.source_count;++i)if(config_.sources[i].id==id)return parameter?clocks_[i].intensity:clocks_[i].hz;return 0;}
 double targetOffset(uint32_t kind,uint32_t id,uint32_t parameter)const{double sum=0;for(unsigned order=0;order<config_.source_count;++order){unsigned i=executionOrder_[order];const auto&s=config_.sources[i];if(!s.enabled)continue;for(unsigned j=0;j<s.route_count;++j){const auto&r=s.routes[j];if(r.target_kind==kind&&r.target_id==id&&r.parameter_id==parameter)sum+=(kind>=4?clocks_[i].smoothedValue:clocks_[i].previous)*r.depth;}}return sum;}
 bool hasTarget(uint32_t kind,uint32_t id,uint32_t parameter)const{for(unsigned i=0;i<config_.source_count;++i){const auto&s=config_.sources[i];if(!s.enabled)continue;for(unsigned j=0;j<s.route_count;++j){const auto&r=s.routes[j];if(r.target_kind==kind&&r.target_id==id&&r.parameter_id==parameter&&r.depth!=0)return true;}}return false;}
 struct SauceOffset{uint32_t id=0;double value=0;};
 std::array<SauceOffset,BS_MAX_LFOS*BS_MAX_LFO_ROUTES>sauceOffsets_{},effectOffsets_{};unsigned sauceCount_=0,effectCount_=0;
 double effectOffset(uint32_t id)const{for(unsigned i=0;i<effectCount_;++i)if(effectOffsets_[i].id==id)return effectOffsets_[i].value;return 0;}
 double sauceOffset(uint32_t id)const{for(unsigned i=0;i<sauceCount_;++i)if(sauceOffsets_[i].id==id)return sauceOffsets_[i].value;return 0;}
 bool hasSauceOffsets()const{return sauceCount_!=0;}
 std::array<double,BS_PARAMETER_COUNT> tick(double sampleRate,double bpm,const std::array<double,4>&externalRate={},const std::array<double,4>&externalIntensity={}){
  std::array<double,BS_PARAMETER_COUNT> offsets{};
  if(!std::isfinite(sampleRate)||sampleRate<8000||sampleRate>384000||!std::isfinite(bpm)||bpm<40||bpm>240)return offsets;
  const bool restart=retriggerPending_;retriggerPending_=false;
  std::array<double,BS_MAX_LFOS> rateOffsets{},intensityOffsets{},values{};
  for(unsigned i=0;i<config_.source_count;++i){unsigned id=config_.sources[i].id;if(id>=1&&id<=4){rateOffsets[i]=externalRate[id-1];intensityOffsets[i]=externalIntensity[id-1];}}
  // Feedback reads a complete prior-sample snapshot: no order-dependent graph
  // traversal, algebraic loop, recursion or unbounded evaluation.
  for(unsigned p=0;p<config_.source_count;++p){unsigned i=executionOrder_[p];const auto&s=config_.sources[i];if(!s.enabled)continue;
   for(unsigned j=0;j<s.route_count;++j){const auto&r=s.routes[j];if(r.target_kind!=2)continue;for(unsigned k=0;k<config_.source_count;++k)if(config_.sources[k].id==r.target_id){(r.parameter_id==0?rateOffsets[k]:intensityOffsets[k])+=clocks_[i].previous*r.depth;break;}}
  }
  if(smoothingRate_!=sampleRate){smoothingRate_=sampleRate;smoothing_=1-std::exp(-1/(.005*sampleRate));}const double smoothing=smoothing_;sauceCount_=effectCount_=0;
  for(uint32_t position=0;position<config_.source_count;++position){const uint32_t i=executionOrder_[position];const auto&s=config_.sources[i];auto&c=clocks_[i];if(restart&&s.retrigger){c.phase=0;c.cycle=0;}c.lastPhase=c.phase;
   c.rateOffset+=smoothing*(rateOffsets[i]-c.rateOffset);c.intensityOffset+=smoothing*(intensityOffsets[i]-c.intensityOffset);
   if(std::abs(c.rateOffset-rateOffsets[i])<1e-12)c.rateOffset=rateOffsets[i];if(std::abs(c.intensityOffset-intensityOffsets[i])<1e-12)c.intensityOffset=intensityOffsets[i];
   const double intensity=c.intensity=std::max(0.,std::min(1.,double(s.intensity)+c.intensityOffset));
   if(s.enabled&&intensity!=0){const double value=waveform(s,c,shapes_[i])*intensity;values[i]=value;for(uint32_t j=0;j<s.route_count;++j){const auto&r=s.routes[j];if(r.target_kind==0)offsets[r.parameter_id]+=value*r.depth;else if(r.target_kind==1){unsigned k=0;while(k<sauceCount_&&sauceOffsets_[k].id!=r.target_id)++k;if(k==sauceCount_){sauceOffsets_[k]={r.target_id,0};++sauceCount_;}sauceOffsets_[k].value+=value*r.depth;}else if(r.target_kind==3){unsigned k=0;while(k<effectCount_&&effectOffsets_[k].id!=r.target_id)++k;if(k==effectCount_){effectOffsets_[k]={r.target_id,0};++effectCount_;}effectOffsets_[k].value+=value*r.depth;}}}
   const double baseHz=s.synced?(bpm/60)*(double(s.division)/4)*(s.triplet?1.5:1):s.rate_hz;
   const double hz=c.hz=c.rateOffset==0?baseHz:std::max(.003125,std::min(1280.,baseHz*std::exp(std::log(400.)*std::max(-4.,std::min(4.,c.rateOffset)))));
   c.phase+=hz/sampleRate;const double cycles=std::floor(c.phase);c.phase-=cycles;c.cycle+=uint64_t(cycles);
  }
  for(unsigned i=0;i<config_.source_count;++i){clocks_[i].previous=values[i];clocks_[i].smoothedValue+=smoothing*(values[i]-clocks_[i].smoothedValue);}return offsets;
 }

};
static_assert(sizeof(bs_lfo_route_v3)==16&&sizeof(bs_lfo_source_v3)==556&&sizeof(bs_modulation_config_v3)==2232&&offsetof(bs_lfo_source_v3,retrigger)==164&&offsetof(bs_lfo_source_v3,point_count)==168&&offsetof(bs_lfo_source_v3,points)==172,"LFO v3 ABI");
}
#endif
