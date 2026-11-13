#ifndef BLOCKS_SUB_NOTES_H
#define BLOCKS_SUB_NOTES_H
#include "blocks_bass_support.h"
#include <array>
#include <cmath>
#include <limits>
namespace blocks_detail {
inline bs_sub_config defaultSub(){return {1,0,0,-1,0,0,.25f,0};}
inline bool validSub(const bs_sub_config&c){return c.version==1&&c.enabled<=1&&c.waveform<=4&&c.octave>=-3&&c.octave<=3&&c.priority<=1&&c.routing<=1&&std::isfinite(c.level)&&c.level>=0&&c.level<=1&&c.reserved==0;}
class SubNotes{
 struct Note{uint32_t count=0;uint64_t order=0;float velocity=1;bool pedal=false;};
 std::array<Note,2048>notes_{};std::array<bool,16>pedals_{};uint64_t sequence_=0;bool dirty_=true;int selected_=-1;
public:
 bs_sub_config config=defaultSub();
 void clear(){notes_={};pedals_={};sequence_=0;selected_=-1;dirty_=true;}
 void on(unsigned ch,unsigned key,float velocity){if(ch>=16||key>=128)return;auto&n=notes_[ch*128+key];if(n.count==std::numeric_limits<uint32_t>::max()||sequence_==std::numeric_limits<uint64_t>::max())clear();++n.count;n.order=++sequence_;n.velocity=velocity;n.pedal=false;dirty_=true;}
 void off(unsigned ch,unsigned key){if(ch>=16||key>=128)return;auto&n=notes_[ch*128+key];if(n.count){--n.count;if(!n.count)n.pedal=pedals_[ch];dirty_=true;}}
 void pedal(unsigned ch,bool down){if(ch>=16)return;pedals_[ch]=down;if(!down)for(unsigned key=0;key<128;++key)notes_[ch*128+key].pedal=false;dirty_=true;}
 bool configure(const bs_sub_config&c){if(!validSub(c))return false;config=c;dirty_=true;return true;}
 int selected(){if(!dirty_)return selected_;selected_=-1;for(unsigned i=0;i<2048;++i){const auto&n=notes_[i];if(!n.count&&!n.pedal)continue;if(selected_<0){selected_=int(i);continue;}const auto&old=notes_[unsigned(selected_)];const bool choose=config.priority?n.order>old.order:(i%128<unsigned(selected_)%128||(i%128==unsigned(selected_)%128&&n.order>old.order));if(choose)selected_=int(i);}dirty_=false;return selected_;}
 float velocity(int i)const{return i>=0?notes_[unsigned(i)].velocity:0;}
};
static_assert(sizeof(bs_sub_config)==32&&sizeof(bs_clock_config)==12,"Sub/clock ABI");
}
#endif
