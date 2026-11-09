#ifndef BLOCKS_MODULATION_ENGINE_H
#define BLOCKS_MODULATION_ENGINE_H
#include "blocks_modulation.h"
#include "blocks_synth.h"
#include <array>
#include <cmath>
#include <cstdint>
namespace blocks_detail {
inline bool modulationTarget(uint32_t id){switch(id){case 0:case 2:case 3:case 11:case 12:case 13:case 14:case 18:case 21:case 22:case 23:case 24:return true;default:return false;}}
inline bs_modulation_config defaultModulation(){bs_modulation_config c{};c.version=1;c.source_count=1;auto&s=c.sources[0];s.id=1;s.division=4;s.rate_hz=1;s.intensity=1;s.route_count=2;s.routes[0]={11,.3f};s.routes[1]={0,.2f};return c;}
class Modulation {
 struct Clock{double phase=0;uint64_t cycle=0;};
 bs_modulation_config config_=defaultModulation();
 std::array<Clock,BS_MAX_LFOS> clocks_{};
 std::array<bool,BS_PARAMETER_COUNT> targets_{};
 static uint32_t hash(uint32_t x){x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;return x^(x>>16);}
 static double random(uint32_t id,uint64_t cycle){return double(hash(id^hash(uint32_t(cycle))^hash(uint32_t(cycle>>32)^0xa511e9b3u)))/4294967295.*2-1;}
 static double waveform(const bs_lfo_source&s,const Clock&c){
  const double p=c.phase;
  switch(s.waveform){case BS_LFO_SINE:return std::sin(6.2831853071795864769*p);case BS_LFO_TRIANGLE:return 1-4*std::abs(p-.5);case BS_LFO_SAW:return 2*p-1;case BS_LFO_SQUARE:return p<.5?1:-1;default:{const double t=p*p*p*(p*(p*6-15)+10),a=random(s.id,c.cycle);return a+(random(s.id,c.cycle+1)-a)*t;}}
 }
 void updateTargets(){targets_.fill(false);for(uint32_t i=0;i<config_.source_count;++i){const auto&s=config_.sources[i];if(s.enabled)for(uint32_t j=0;j<s.route_count;++j)targets_[s.routes[j].parameter_id]=true;}}
public:
 static bool valid(const bs_modulation_config&c){
  if(c.version!=BS_MODULATION_VERSION||c.source_count>BS_MAX_LFOS)return false;
  for(uint32_t i=0;i<c.source_count;++i){const auto&s=c.sources[i];if(s.enabled>1||s.synced>1||s.triplet>1||s.waveform>BS_LFO_SMOOTH_RANDOM||!std::isfinite(s.rate_hz)||s.rate_hz<.05f||s.rate_hz>20||!std::isfinite(s.intensity)||s.intensity<0||s.intensity>1||s.route_count>BS_MAX_LFO_ROUTES)return false;
   if(!(s.division==1||s.division==2||s.division==4||s.division==8||s.division==16||s.division==32||s.division==64)||(s.triplet&&s.division>16))return false;
   for(uint32_t k=0;k<i;++k)if(s.id==c.sources[k].id)return false;
   for(uint32_t j=0;j<s.route_count;++j){const auto&r=s.routes[j];if(!modulationTarget(r.parameter_id)||!std::isfinite(r.depth)||r.depth< -1||r.depth>1)return false;for(uint32_t k=0;k<j;++k)if(r.parameter_id==s.routes[k].parameter_id)return false;}
  }return true;
 }
 bool configure(const bs_modulation_config&c){if(!valid(c))return false;std::array<Clock,BS_MAX_LFOS> next{};for(uint32_t i=0;i<c.source_count;++i)for(uint32_t j=0;j<config_.source_count;++j)if(c.sources[i].id==config_.sources[j].id)next[i]=clocks_[j];config_=c;clocks_=next;updateTargets();return true;}
 const bs_modulation_config&config()const{return config_;}
 const std::array<bool,BS_PARAMETER_COUNT>&targets()const{return targets_;}
 void reset(){clocks_={};}
 std::array<double,BS_PARAMETER_COUNT> tick(double sampleRate,double bpm){
  std::array<double,BS_PARAMETER_COUNT> offsets{};
  if(!std::isfinite(sampleRate)||sampleRate<8000||sampleRate>384000||!std::isfinite(bpm)||bpm<40||bpm>240)return offsets;
  for(uint32_t i=0;i<config_.source_count;++i){const auto&s=config_.sources[i];auto&c=clocks_[i];if(s.enabled&&s.intensity!=0){const double value=waveform(s,c)*s.intensity;for(uint32_t j=0;j<s.route_count;++j)offsets[s.routes[j].parameter_id]+=value*s.routes[j].depth;}
   const double hz=s.synced?(bpm/60)*(double(s.division)/4)*(s.triplet?1.5:1):s.rate_hz;
   c.phase+=hz/sampleRate;const double cycles=std::floor(c.phase);c.phase-=cycles;c.cycle+=uint64_t(cycles);
  }return offsets;
 }
};
static_assert(sizeof(bs_lfo_route)==8,"LFO route ABI");
static_assert(sizeof(bs_lfo_source)==100,"LFO source ABI");
static_assert(sizeof(bs_modulation_config)==408,"LFO config ABI");
}
#endif
