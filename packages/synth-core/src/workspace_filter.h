#ifndef BLOCKS_WORKSPACE_FILTER_H
#define BLOCKS_WORKSPACE_FILTER_H
#include "resonant_filter.h"
#include "ladder_filter.h"
#include "filter_route.h"
#include <array>
namespace blocks_detail {
struct WorkspaceFilter {
 std::array<double,2> low{};
 std::array<ResonantFilter,2> resonant;
 std::array<LadderFilter,2> ladder;
 std::array<FilterRouteAlignment,2> alignment;
 bool warm=false;
 void clear(){low={};for(auto&v:resonant)v.clear();for(auto&v:ladder)v.clear();for(auto&v:alignment)v.clear();warm=false;}
 std::array<double,2>process(double l,double r,bool stereo,const std::array<double,4>&p,const std::array<double,3>&weights,double otherLadder,double rate){
  warm=true;const double fc=std::min(p[0],rate*.45),alpha=1-std::exp(-6.283185307179586*fc/rate),aligned=std::max(otherLadder,weights[2]);ResonantCoefficients rc;LadderCoefficients lc;if(weights[1]>0)rc.set(fc,1/ResonantCoefficients::q(p[1]),rate);if(weights[2]>0)lc.set(fc,p[1],rate);const double input[]={l,r};std::array<double,2>out{};
  for(unsigned ch=0;ch<(stereo?2u:1u);++ch){low[ch]+=alpha*(input[ch]-low[ch]);if(std::abs(low[ch])<1e-20)low[ch]=0;double lp=low[ch];if(weights[1]>0){double reson=resonant[ch].process(input[ch],rc);const double denominator=weights[0]+weights[1];if(denominator>0)lp+=(reson-lp)*weights[1]/denominator;}else resonant[ch].clear();double base=p[2]==1?lp:input[ch]+p[2]*(lp-input[ch]);if(aligned>0){double delayed=alignment[ch].process(base);base+=aligned*(delayed-base);}if(weights[2]>0){double wet=ladder[ch].processRaw(input[ch],lc,p[3],p[2]);base+=weights[2]*(wet-base);}else ladder[ch].clear();out[ch]=base;
  }return out;
 }
};
}
#endif
