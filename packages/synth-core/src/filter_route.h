#ifndef BLOCKS_FILTER_ROUTE_H
#define BLOCKS_FILTER_ROUTE_H
#include "ladder_filter.h"
#include <array>
namespace blocks_detail {
// Linear-only counterpart of Ladder's reconstruction path. No solver, poles,
// voice ownership or allocation. Identical coefficient/sample order and phase.
struct FilterRouteAlignment {
 std::array<double,16>up{};std::array<double,LadderFilter::filterTaps>down{};
 unsigned upPosition=0,downPosition=0,remaining=0;
 double process(double input){
  if(input!=0)remaining=32;
  else if(!remaining)return 0;
  else --remaining;
  up[upPosition]=input;double result=0;const auto&h=LadderFilter::taps();
  for(unsigned phase=0;phase<LadderFilter::oversampling;++phase){double sum=0;unsigned j=upPosition;
   for(unsigned tap=phase;tap<LadderFilter::filterTaps;tap+=LadderFilter::oversampling){sum+=h[tap]*up[j];j=j?j-1:15;}
   down[downPosition]=LadderFilter::oversampling*sum;
   if(phase==0){unsigned i=0;for(unsigned at=downPosition+1;at>0;)result+=h[i++]*down[--at];for(unsigned at=LadderFilter::filterTaps;i<LadderFilter::filterTaps;)result+=h[i++]*down[--at];}
   downPosition=downPosition+1==LadderFilter::filterTaps?0:downPosition+1;
  }
  upPosition=(upPosition+1)&15u;return result;
 }
 void clear(){*this=FilterRouteAlignment{};}
};
}
#endif
