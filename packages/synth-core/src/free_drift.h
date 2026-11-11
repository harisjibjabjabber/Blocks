#ifndef BLOCKS_FREE_DRIFT_H
#define BLOCKS_FREE_DRIFT_H
#include <cmath>
#include <cstdint>
namespace blocks_detail {
inline uint32_t driftHash(uint32_t x){x^=x>>16;x*=0x7feb352du;x^=x>>15;x*=0x846ca68bu;return x^(x>>16);}
inline double driftUnit(uint32_t x){return double(x)/4294967295.;}
// One host-independent clock; note identity changes the path, never its age.
// Speed changes alter clock velocity, not position. No NoteOn RNG/state reset.
inline double freeDrift(double phase,uint32_t channel,uint32_t key){
 const uint32_t seed=driftHash(0xa511e9b3u^(key+128u*channel));
 const double rate=.8+.4*driftUnit(driftHash(seed^0x63d83595u)),offset=16*driftUnit(driftHash(seed^0x9e3779b9u));
 const double position=phase*rate+offset,whole=std::floor(position),fraction=position-whole;
 const uint64_t index=uint64_t(whole);
 const auto target=[&](uint64_t i){return 2*driftUnit(driftHash(seed^uint32_t(i)^driftHash(uint32_t(i>>32))))-1;};
 const double mix=fraction*fraction*fraction*(fraction*(fraction*6-15)+10);
 return target(index)+(target(index+1)-target(index))*mix;
}
}
#endif
