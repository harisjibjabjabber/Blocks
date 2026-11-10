#ifndef BLOCKS_UNISON_H
#define BLOCKS_UNISON_H
#include "blocks_voicing.h"
#include <array>
#include <cmath>
namespace blocks_detail {
class Unison {
 bs_voicing_config config_{1,1,0,0};double detune_=0,spread_=0;
public:
 struct Copy{double ratio=1,left=1,right=1;};
 std::array<std::array<Copy,4>,5> copies{};
 static bs_voicing_config defaults(){return {1,1,0,0};}
 static bool valid(const bs_voicing_config&c){return c.version==1&&c.count>=1&&c.count<=4&&std::isfinite(c.detune_cents)&&c.detune_cents>=0&&c.detune_cents<=50&&std::isfinite(c.spread)&&c.spread>=0&&c.spread<=1;}
 bool configure(const bs_voicing_config&c){if(!valid(c))return false;config_=c;return true;}
 const bs_voicing_config&config()const{return config_;}
 Unison(){rebuild();}
 void rebuild(){for(unsigned n=2;n<=4;++n)for(unsigned i=0;i<n;++i){const double position=double(2*int(i)-int(n)+1)/(n-1);copies[n][i]={std::exp2(position*detune_/1200),std::sqrt(1-position*spread_)/n,std::sqrt(1+position*spread_)/n};}}
 void reset(){detune_=config_.detune_cents;spread_=config_.spread;rebuild();}
 void tick(double smoothing){const double oldDetune=detune_,oldSpread=spread_;detune_+=smoothing*(config_.detune_cents-detune_);spread_+=smoothing*(config_.spread-spread_);if(std::abs(detune_-config_.detune_cents)<1e-12)detune_=config_.detune_cents;if(std::abs(spread_-config_.spread)<1e-12)spread_=config_.spread;if(detune_!=oldDetune||spread_!=oldSpread)rebuild();}
};
static_assert(sizeof(bs_voicing_config)==16,"Voicing ABI");
}
#endif
