#include "../src/audio_rack.h"
#include "../src/sauce.h"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <new>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(void*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d: %s\n",__LINE__,#x);std::exit(1);}}while(false)
constexpr double rate=48000,dc=.9986918594237979,alpha=.0232865296252325;
static double input(unsigned i){return .2*std::sin(i*.071)+.13*std::sin(i*.037);}
static double run(blocks_detail::AudioRack&r,unsigned i,double drive=4,double full=.6){watch=true;double result=r.process(input(i),drive,full,1,1,dc,alpha);watch=false;CHECK(std::isfinite(result));return result;}
int main(){using blocks_detail::AudioRack;
 {blocks_detail::AntialiasedResidual cached;double previous=0;for(unsigned i=0;i<40000;++i){if(i%999==0){previous=1.7*std::sin(i*.09);cached.reset(previous);}double x=i%7==0?previous+1e-7:i%11==0?previous:i%13==0?0:2.7*std::sin(i*.071);const double delta=x-previous;const double expected=std::abs(delta)>1e-5?(blocks_detail::harmonicPrimitive(x)-blocks_detail::harmonicPrimitive(previous))/delta:blocks_detail::harmonicResidual((x+previous)*.5);CHECK(cached.process(x)==expected);previous=x;if(i%101==0){auto copy=cached;CHECK(copy.process(x+.001)==cached.process(x+.001));previous=x+.001;}}}
 {blocks_detail::AntialiasedResidual cached;cached.reset(.7);CHECK(cached.primitiveValid);cached.process(.7);CHECK(cached.primitiveValid);cached.process(.7000001);CHECK(!cached.primitiveValid);auto copy=cached;cached.process(.7000001);CHECK(!cached.primitiveValid);const double expected=(blocks_detail::harmonicPrimitive(.8)-blocks_detail::harmonicPrimitive(.7000001))/(.8-.7000001);CHECK(cached.process(.8)==expected&&copy.process(.8)==expected);CHECK(cached.primitiveValid&&copy.primitiveValid);cached.reset(-.9);CHECK(cached.primitiveValid&&cached.previousPrimitive==blocks_detail::harmonicPrimitive(-.9));}
 std::puts("PASS cached Fullness primitive exactly matches uncached ADAA through thresholds, clamps and copied history");
 {AudioRack rack;const auto good=rack.config();CHECK(sizeof(bs_sauce_config)==328&&sizeof(bs_sauce_block)==20);for(unsigned badcase=0;badcase<9;++badcase){auto bad=good;if(badcase==0)bad.version=2;if(badcase==1)bad.count=17;if(badcase==2)bad.blocks[1].id=bad.blocks[0].id;if(badcase==3)bad.blocks[0].amount=0;if(badcase==4)bad.blocks[1].amount=std::numeric_limits<float>::quiet_NaN();if(badcase==5)bad.blocks[1].type=2;if(badcase==6)bad.blocks[1].primary=2;if(badcase==7)bad.blocks[1].enabled=2;if(badcase==8){bad.blocks[1].type=0;bad.blocks[1].amount=1;}CHECK(!rack.configure(bad,rate));CHECK(std::memcmp(&rack.config(),&good,sizeof good)==0);}CHECK(!rack.configure(good,0));}
 std::puts("PASS rack ABI, capacity and atomic whole-config rejection");
 {for(double full:{0.,.6,1.})for(double drive:{1.,4.,12.}){AudioRack rack;blocks_detail::SauceRack legacy;for(unsigned i=0;i<10000;++i){const double a=run(rack,i,drive,full),b=legacy.process(input(i),drive,full,0,1,1,dc,alpha);CHECK(a==b);}}}
 std::puts("PASS default primary rack matches legacy Drive-then-Fullness exactly including Fullness0");
 {AudioRack rack;auto c=AudioRack::defaults();c.blocks[0]={10,0,0,1,2};c.blocks[1]={11,0,0,1,3};CHECK(rack.configure(c,rate,true));for(unsigned i=0;i<2000;++i)CHECK(run(rack,i)==std::tanh(std::tanh(input(i)*2)*3));c.count=0;CHECK(rack.configure(c,rate,true));for(unsigned i=0;i<2000;++i)CHECK(run(rack,i)==input(i));}
 std::puts("PASS independent duplicates execute serially and an empty rack bypasses exactly");
 {AudioRack changed,reference;auto c=AudioRack::defaults();c.blocks[0]={1,0,0,0,1};c.blocks[1]={2,1,0,1,.8f};CHECK(changed.configure(c,rate,true)&&reference.configure(c,rate,true));for(unsigned i=0;i<4000;++i){if(i==1000){std::swap(c.blocks[0],c.blocks[1]);CHECK(changed.configure(c,rate));}CHECK(run(changed,i)==run(reference,i));}}
 std::puts("PASS stable block IDs preserve Fullness history across a transparent reorder");
 {AudioRack changed,reference;auto original=AudioRack::defaults(),first=original,latest=original;first.count=0;latest.count=3;latest.blocks[2]={3,0,0,1,2};for(unsigned i=0;i<2000;++i){if(i==100){CHECK(changed.configure(first,rate)&&reference.configure(first,rate));}if(i==120){CHECK(changed.configure(latest,rate));auto intermediate=latest;intermediate.blocks[2].amount=12;CHECK(changed.configure(intermediate,rate));CHECK(changed.configure(latest,rate));}const double a=run(changed,i),b=run(reference,i);if(i<340)CHECK(a==b);if(i==100)CHECK(changed.transitioning());}CHECK(!changed.transitioning());CHECK(changed.config().count==3&&changed.config().blocks[2].amount==2);}
 std::puts("PASS rapid config retargets finish the current fade and apply only the latest queued graph");
 {AudioRack rack;auto c=AudioRack::defaults();c.count=16;for(unsigned i=0;i<16;++i)c.blocks[i]={i+1,i%2,0,1,i%2?1.f:12.f};CHECK(rack.configure(c,rate,true));for(unsigned i=0;i<10000;++i)CHECK(std::abs(run(rack,i))<10000);for(auto&b:c.blocks)b.enabled=0;CHECK(rack.configure(c,rate));for(unsigned i=0;i<10000;++i)run(rack,i);for(unsigned i=10000;i<11000;++i)CHECK(run(rack,i)==input(i));}
 {for(double full:{0.,.6,1.})for(double drive:{1.,4.,12.}){AudioRack empty,bound;blocks_detail::SauceRack legacy;auto none=AudioRack::defaults();none.count=0;CHECK(empty.configure(none,rate,true,true));CHECK(bound.configure(AudioRack::defaults(),rate,true,true));for(unsigned i=0;i<10000;++i){const double original=legacy.process(input(i),drive,full,0,1,1,dc,alpha);CHECK(run(empty,i,drive,full)==original);CHECK(run(bound,i,drive,full)==original);}}}
 std::puts("PASS synth base colour with empty custom rack or two bound primaries applies each effect exactly once");
 {AudioRack changing,reference;auto none=AudioRack::defaults();none.count=0;CHECK(changing.configure(none,rate,true,true)&&reference.configure(none,rate,true,true));double previous=0,worst=0;for(unsigned i=0;i<23000;++i){if(i==20000)CHECK(changing.configure(AudioRack::defaults(),rate,false,true));if(i==20120)CHECK(changing.configure(none,rate,false,true));watch=true;const double a=changing.process(.2,4,1,1,1,dc,alpha),b=reference.process(.2,4,1,1,1,dc,alpha);watch=false;if(i==20000)CHECK(a==b);if(i>=20000)worst=std::max(worst,std::abs(a-previous));previous=a;CHECK(std::isfinite(a));}CHECK(worst<.02);CHECK(!changing.transitioning());std::printf("METRIC primary add/remove max_sample_delta=%.9f\n",worst);}
 std::puts("PASS primary add/remove crossfades the entire colour-plus-rack chain without a missing/doubled-stage discontinuity");
 CHECK(allocations==0);std::puts("PASS all16 blocks remain finite, bypass settles exactly and process allocates nothing");
}
