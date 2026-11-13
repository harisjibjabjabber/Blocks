#ifndef BLOCKS_WORKSPACE_CONFIG_H
#define BLOCKS_WORKSPACE_CONFIG_H
#include "blocks_envelopes.h"
#include "blocks_tuning.h"
#include "blocks_filter_bank.h"
#include "workspace_targets.h"
#include <cstring>
namespace blocks_detail {
inline bs_envelopes_config defaultEnvelopes(){bs_envelopes_config c{};c.version=2;c.count=3;for(unsigned e=0;e<3;++e){auto&s=c.sources[e];s.id=e+1;const unsigned first=e==0?4:25;float values[7];for(unsigned i=0;i<7;++i)values[i]=bs_parameter_info(first+i)->default_value;std::memcpy(&s.attack,values,sizeof values);}return c;}
inline bool validEnvelopes(const bs_envelopes_config&c){if(c.version!=2||c.count!=3)return false;for(unsigned e=0;e<3;++e){const auto&s=c.sources[e];if(s.id!=e+1||s.route_count>BS_MAX_LFO_ROUTES)return false;const float v[]={s.attack,s.decay,s.sustain,s.release,s.attack_bend,s.decay_bend,s.release_bend};for(unsigned i=0;i<7;++i){const auto*d=workspaceTarget(4,40+e,i);if(!std::isfinite(v[i])||v[i]<d->minimum||v[i]>d->maximum)return false;}for(unsigned i=0;i<s.route_count;++i){const auto&r=s.routes[i];if(!workspaceRoute(r))return false;for(unsigned j=0;j<i;++j){const auto&b=s.routes[j];if(r.target_kind==b.target_kind&&r.target_id==b.target_id&&r.parameter_id==b.parameter_id)return false;}}}return true;}
inline bs_tuning_config defaultTuning(){return{1,{{0,0},{0,0},{-1,0}}};}
inline bool validTuning(const bs_tuning_config&c){if(c.version!=1)return false;for(const auto&o:c.oscillators)if(o.octave< -3||o.octave>3||!std::isfinite(o.fine_cents)||std::abs(o.fine_cents)>100)return false;return true;}
inline bs_filter_bank_config defaultFilterBank(){return{1,0,{{1,0,3,6000,0,1,1,0},{0,0,3,6000,0,1,1,0}}};}
inline bool validFilterBank(const bs_filter_bank_config&c){if(c.version!=1||c.reserved)return false;for(const auto&f:c.filters){if(f.enabled>1||f.model>2||f.mask>3||f.reserved)return false;const float v[]={f.cutoff,f.resonance,f.mix,f.drive};for(unsigned i=0;i<4;++i){const auto*d=workspaceTarget(4,10,i);if(!std::isfinite(v[i])||v[i]<d->minimum||v[i]>d->maximum)return false;}}return true;}
template<class T>inline float wordFloat(const T&c,unsigned word){float value=0;std::memcpy(&value,reinterpret_cast<const char*>(&c)+word*4,4);return value;}
template<class T>inline void wordFloat(T&c,unsigned word,float value){std::memcpy(reinterpret_cast<char*>(&c)+word*4,&value,4);}
static_assert(sizeof(bs_envelope_source)==676&&sizeof(bs_envelopes_config)==2036&&sizeof(bs_tuning_config)==28&&sizeof(bs_filter_bank_config)==72,"Workspace config ABI");
}
#endif
