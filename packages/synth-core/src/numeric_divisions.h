#ifndef BLOCKS_NUMERIC_DIVISIONS_H
#define BLOCKS_NUMERIC_DIVISIONS_H
#include <algorithm>
#include <functional>
#include <array>
#include <cmath>
#include <cstdint>
namespace blocks_detail {
struct NumericDivision {uint32_t division,triplet;double beats()const{return 4./division*(triplet?2./3.:1.);}};
inline constexpr std::array<NumericDivision,10> lfoDivisions{{{1,0},{2,0},{4,0},{4,1},{8,0},{8,1},{16,0},{16,1},{32,0},{64,0}}};
inline constexpr std::array<NumericDivision,8> delayDivisions{{{4,0},{4,1},{8,0},{8,1},{16,0},{16,1},{32,0},{64,0}}};
template<std::size_t N>inline unsigned divisionIndex(const std::array<NumericDivision,N>&list,unsigned division,unsigned triplet){const double beats=4./division*(triplet?2./3.:1.);unsigned best=0;for(unsigned i=1;i<N;i++)if(std::abs(list[i].beats()-beats)<std::abs(list[best].beats()-beats))best=i;return best;}
inline unsigned steppedIndex(double base,double offset,unsigned count){return unsigned(std::llround(std::max(0.,std::min(double(count-1),base+offset*(count-1)))));}
struct BassDivisionList {std::array<double,24>beats{};unsigned count=0;};
inline BassDivisionList bassDivisions(unsigned meter){BassDivisionList list;const auto add=[&](double value){if(value<.03125||value>64)return;for(unsigned i=0;i<list.count;i++)if(std::abs(list.beats[i]-value)<1e-8)return;list.beats[list.count++]=value;};for(unsigned bars:{4u,2u,1u})add(meter*bars);for(unsigned d:{2u,4u,8u,16u,32u,64u,128u})for(double factor:{1.,2./3.,1.5})add(4./d*factor);std::sort(list.beats.begin(),list.beats.begin()+list.count,std::greater<double>());return list;}
inline unsigned bassDivisionIndex(const BassDivisionList&list,double beats){unsigned best=0;for(unsigned i=1;i<list.count;i++)if(std::abs(list.beats[i]-beats)<std::abs(list.beats[best]-beats))best=i;return best;}
}
#endif
