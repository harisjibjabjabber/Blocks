#include "../src/audio_rack.h"
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

 std::puts("PASS ADAA primitive cache agrees exactly including tiny changes and resets");
 {AudioRack rack;bs_sauce_config c{1,0,{}};CHECK(rack.configure(c,rate,true));for(unsigned i=0;i<2000;++i)CHECK(run(rack,i)==input(i));auto before=rack.config();for(unsigned type:{0u,2u,3u}){c.count=1;c.blocks[0]={1,type,0,1,.5f};CHECK(!rack.configure(c,rate));CHECK(!std::memcmp(&before,&rack.config(),sizeof before));}c.blocks[0]={1,BS_SAUCE_FULLNESS,0,1,2};CHECK(!rack.configure(c,rate));}
 std::puts("PASS Fullness-only atomic validation and exact empty bypass");
 {AudioRack base,bound;bs_sauce_config empty{1,0,{}},primary{1,1,{{4,BS_SAUCE_FULLNESS,1,1,.1f}}};CHECK(base.configure(empty,rate,true,true)&&bound.configure(primary,rate,true,true));for(unsigned i=0;i<10000;++i)CHECK(run(base,i)==run(bound,i));}
 std::puts("PASS primary Fullness binding suppresses base processing exactly once");
 {AudioRack a,b;bs_sauce_config c{1,2,{{7,BS_SAUCE_FULLNESS,0,1,.2f},{8,BS_SAUCE_FULLNESS,0,1,.8f}}};CHECK(a.configure(c,rate,true)&&b.configure(c,rate,true));for(unsigned i=0;i<1000;++i)CHECK(run(a,i)==run(b,i));auto next=c;std::swap(next.blocks[0],next.blocks[1]);CHECK(a.configure(next,rate));CHECK(run(a,1000)==run(b,1000));next.blocks[1].amount=.4f;CHECK(a.configure(next,rate));for(unsigned i=1001;i<1800;++i)CHECK(std::isfinite(run(a,i)));CHECK(!a.transitioning()&&a.config().blocks[1].amount==.4f);}
 std::puts("PASS stable-ID reorder starts on previous audio and queued retarget completes bounded5ms fades");
 {AudioRack a,b;bs_sauce_config c{1,16,{}};for(unsigned i=0;i<16;++i)c.blocks[i]={i+1,BS_SAUCE_FULLNESS,0,i%2,.2f};CHECK(a.configure(c,rate,true)&&b.configure(c,rate,true));for(unsigned i=0;i<4000;++i){if(i%137==0){std::swap(c.blocks[3],c.blocks[15]);c.blocks[7].enabled=1-c.blocks[7].enabled;watch=true;CHECK(a.configure(c,rate)&&b.configure(c,rate));watch=false;}CHECK(run(a,i)==run(b,i));}CHECK(allocations==0);}
 std::puts("PASS16-node enabled/bypass history and repeated graph edits remain finite/exact without allocations");
 return 0;
}
