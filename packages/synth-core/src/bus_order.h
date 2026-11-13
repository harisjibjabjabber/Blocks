#ifndef BLOCKS_BUS_ORDER_ENGINE_H
#define BLOCKS_BUS_ORDER_ENGINE_H
#include "blocks_bus_order.h"
#include <algorithm>
#include <cmath>
namespace blocks_detail {
class BusOrder {
 bs_bus_order_config requested_{1,{0,1,2}},active_=requested_;
 unsigned fadeSamples_=240,position_=240;
 bool outgoing_=false,processed_=false;
 static bool same(const bs_bus_order_config&a,const bs_bus_order_config&b){return a.order[0]==b.order[0]&&a.order[1]==b.order[1]&&a.order[2]==b.order[2];}
public:
 static bs_bus_order_config defaults(){return{1,{0,1,2}};}
 static bool valid(const bs_bus_order_config&c){return c.version==1&&c.order[0]<3&&c.order[1]<3&&c.order[2]<3&&c.order[0]!=c.order[1]&&c.order[0]!=c.order[2]&&c.order[1]!=c.order[2];}
 void prepare(double rate){fadeSamples_=std::max(1u,unsigned(std::ceil(rate*.005)));reset();}
 void reset(){active_=requested_;position_=fadeSamples_;outgoing_=processed_=false;}
 bool configure(const bs_bus_order_config&c){if(!valid(c))return false;if(same(c,requested_))return true;requested_=c;if(!processed_){active_=c;position_=fadeSamples_;outgoing_=false;}else outgoing_=!same(active_,c);return true;}
 const bs_bus_order_config&config()const{return requested_;}
 const bs_bus_order_config&active()const{return active_;}
 // Called before processing the three groups. The switch sample is muted.
 double tick(){processed_=true;if(outgoing_){if(position_)--position_;if(!position_){active_=requested_;outgoing_=false;}return double(position_)/fadeSamples_;}if(position_<fadeSamples_)++position_;return double(position_)/fadeSamples_;}
};
}
#endif
