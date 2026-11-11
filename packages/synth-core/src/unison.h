#ifndef BLOCKS_UNISON_H
#define BLOCKS_UNISON_H
#include "blocks_voicing.h"
#include <array>
#include <cmath>
#include <cstdint>
namespace blocks_detail {
class Unison {
 bs_voicing_config config_{1,1,0,0};double detune_=0,spread_=0;
public:
 struct Copy{double ratio=1,left=1,right=1;};
 std::array<std::array<Copy,BS_MAX_UNISON>,BS_MAX_UNISON+1> copies{};
 static bs_voicing_config defaults(){return {1,1,0,0};}
 static bool valid(const bs_voicing_config&c){return c.version==1&&c.count>=1&&c.count<=BS_MAX_UNISON&&std::isfinite(c.detune_cents)&&c.detune_cents>=0&&c.detune_cents<=50&&std::isfinite(c.spread)&&c.spread>=0&&c.spread<=1;}
 bool configure(const bs_voicing_config&c){if(!valid(c))return false;config_=c;return true;}
 const bs_voicing_config&config()const{return config_;}
 bool sameSmoothing(const Unison&other)const{return detune_==other.detune_&&spread_==other.spread_;}
 Unison(){rebuild();}
 static void startPhases(uint64_t sequence,unsigned key,unsigned channel,unsigned count,std::array<double,BS_MAX_UNISON>&first,std::array<double,BS_MAX_UNISON>&second){
  if(count<=1)return;
  uint32_t seed=0x5a17c9e3u^uint32_t(sequence*747796405u)^uint32_t((key+channel*128)*2891336453u);
  if(!seed)seed=0x5a17c9e3u;
  first[count/2]=second[count/2]=0;
  auto phase=[&](){seed^=seed<<13;seed^=seed>>17;seed^=seed<<5;return double(seed)/4294967296.0;};
  for(unsigned i=0;i<count;++i){const double p1=phase(),p2=phase();if(i!=count/2){first[i]=p1;second[i]=p2;}}
 }
 void rebuild(){for(unsigned n=2;n<=BS_MAX_UNISON;++n)for(unsigned i=0;i<n;++i){const double position=double(2*int(i)-int(n)+1)/(n-1);
  // Keep the listened C profile exactly at >=2ct. Below this, a dominant
  // central body prevents equal-frequency copies from cancelling the note.
  if(detune_>=2){copies[n][i]={std::exp2(position*detune_/1200),std::sqrt(1-position*spread_)/n,std::sqrt(1+position*spread_)/n};continue;}
  const double t=detune_/2,g=1-t*t*(3-2*t);const bool anchor=i==n/2;
  const double weight=(1-g)/n+g*(anchor?.75:.25/(n-1));const double pan=position*(anchor?1-g:1);
  copies[n][i]={std::exp2(position*detune_/1200),std::sqrt(1-pan*spread_)*weight,std::sqrt(1+pan*spread_)*weight};
 }}
 void reset(){detune_=config_.detune_cents;spread_=config_.spread;rebuild();}
 void tick(double smoothing){const double oldDetune=detune_,oldSpread=spread_;detune_+=smoothing*(config_.detune_cents-detune_);spread_+=smoothing*(config_.spread-spread_);if(std::abs(detune_-config_.detune_cents)<1e-12)detune_=config_.detune_cents;if(std::abs(spread_-config_.spread)<1e-12)spread_=config_.spread;if(detune_!=oldDetune||spread_!=oldSpread)rebuild();}
};
static_assert(sizeof(bs_voicing_config)==16,"Voicing ABI");
static_assert(sizeof(bs_voicing_config_v2)==32,"Independent voicing ABI");
}
#endif
