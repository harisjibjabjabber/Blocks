#include "blocks_synth.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <new>
#include <vector>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(void*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d: %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth{bs_synth*p=bs_create();Synth(bool mono=true,float enabled=1,float time=.2f){CHECK(p);bs_set_parameter(p,BS_OSC1_WAVE,BS_SINE);bs_set_parameter(p,BS_OSC1_LEVEL,1);bs_set_parameter(p,BS_OSC2_LEVEL,0);bs_set_parameter(p,BS_FILTER_MIX,0);bs_set_parameter(p,BS_DRIVE_ENABLED,0);bs_set_parameter(p,BS_GAIN,.5f);bs_set_parameter(p,BS_ATTACK,.001f);bs_set_parameter(p,BS_SUSTAIN_LEVEL,1);bs_set_parameter(p,BS_RELEASE,.005f);bs_set_parameter(p,BS_GLIDE_ENABLED,enabled);bs_set_parameter(p,BS_GLIDE_TIME,time);bs_performance_config c{};bs_default_performance(&c);c.mono=mono;CHECK(bs_set_performance(p,&c));bs_reset(p);}~Synth(){bs_destroy(p);}};
struct Audio{std::vector<float>l,r;explicit Audio(unsigned n):l(n),r(n){}};
static Audio render(bs_synth*s,unsigned n,unsigned block,const std::vector<bs_event>&events){Audio a(n);std::vector<bs_event>local;local.reserve(events.size());for(unsigned start=0;start<n;start+=block){unsigned count=std::min(block,n-start);local.clear();for(auto e:events)if(e.sample_offset>=start&&e.sample_offset<start+count){e.sample_offset-=start;local.push_back(e);}watch=true;int result=bs_render(s,a.l.data()+start,a.r.data()+start,count,local.data(),unsigned(local.size()));watch=false;CHECK(result==0);}for(unsigned i=0;i<n;++i)CHECK(std::isfinite(a.l[i])&&std::isfinite(a.r[i])&&std::abs(a.l[i])<=1&&std::abs(a.r[i])<=1);return a;}
static void same(const Audio&a,const Audio&b){CHECK(a.l==b.l&&a.r==b.r);}
// Fixture timing describes note-engine time. Align the probe with the declared
// 72-sample output bus latency at48kHz (asserted below), not an earlier pitch.
static double pitch(const Audio&a,unsigned center,unsigned radius=240){center+=72;double first=0,last=0;unsigned count=0;for(unsigned i=center-radius+1;i<center+radius;++i)if(a.l[i-1]<=0&&a.l[i]>0){const double x=i-1-double(a.l[i-1])/(double(a.l[i])-a.l[i-1]);if(count++==0)first=x;last=x;}CHECK(count>3);return 69+12*std::log2(48000*(count-1)/(last-first)/440);}
static bs_event on(unsigned t,unsigned key){return {t,BS_NOTE_ON,0,key,0,1};}static bs_event off(unsigned t,unsigned key){return {t,BS_NOTE_OFF,0,key,0,0};}
int main(){
 {Synth s;CHECK(bs_output_latency(s.p)==72);}
 {Synth s;CHECK(bs_abi_version()==7&&bs_parameter_count()==44&&sizeof(bs_patch)==180);bs_patch p{},q{};CHECK(bs_get_patch(s.p,&p));p.values[40]=1;p.values[41]=.35f;CHECK(bs_set_patch(s.p,&p));CHECK(bs_get_patch(s.p,&q));CHECK(std::memcmp(&p,&q,sizeof p)==0);p.values[41]=std::numeric_limits<float>::infinity();CHECK(!bs_set_patch(s.p,&p));bs_patch retained{};bs_get_patch(s.p,&retained);CHECK(std::memcmp(&retained,&q,sizeof q)==0);}
 std::puts("PASS current Glide schema, exact roundtrip and atomic invalid rejection");
 {Synth s;const auto a=render(s.p,24000,127,{on(0,72),on(9600,84)});CHECK(std::abs(pitch(a,4800)-72)<.01);CHECK(std::abs(pitch(a,12000)-75)<.07);CHECK(std::abs(pitch(a,14400)-78)<.07);CHECK(std::abs(pitch(a,16800)-81)<.07);CHECK(std::abs(pitch(a,21600)-84)<.01);CHECK(bs_active_voices(s.p)==1);std::printf("METRIC Glide quarter/mid/threequarter MIDI=%.5f/%.5f/%.5f\n",pitch(a,12000),pitch(a,14400),pitch(a,16800));}
 std::puts("PASS first Mono note immediate and overlapping octave Glide is constant-time in log frequency");
 {Synth s;const auto a=render(s.p,30000,127,{on(0,72),on(9600,84),on(12000,79),off(14400,79),off(16800,84)});CHECK(std::abs(pitch(a,13920)-75.8)<.08);CHECK(std::abs(pitch(a,16320)-77.6)<.08);CHECK(std::abs(pitch(a,19200)-76.5)<.08);CHECK(std::abs(pitch(a,28800)-72)<.01);}
 std::puts("PASS repeated retargeting starts from current gliding pitch and release restores the previous held note");
 {const std::vector<bs_event>events={on(0,72),on(9600,84),off(18000,84),off(22000,72)};Synth disabled(true,0,.2f),zero(true,1,0),reference(true,0,0);const auto expected=render(reference.p,24000,127,events);same(expected,render(disabled.p,24000,1,events));same(expected,render(zero.p,24000,256,events));Synth polyOn(false,1,.2f),polyOff(false,0,.2f);same(render(polyOn.p,24000,127,events),render(polyOff.p,24000,1,events));CHECK(allocations==0);}
 std::puts("PASS disabled/zero-time exact bypass, polyphony ignored and zero render allocations");
 {Synth s;const auto a=render(s.p,48000,127,{on(0,72),on(9600,76),{18000,BS_PEDAL,0,0,0,1},off(19200,76),off(30000,72),{42000,BS_PEDAL,0,0,0,0}});CHECK(std::abs(pitch(a,24000)-74)<.06);CHECK(std::abs(pitch(a,34800)-74)<.06);CHECK(bs_active_voices(s.p)==0);}
 std::puts("PASS Mono pedal ownership restores physical-held then latched pitch through Glide and releases cleanly");
 {Synth a,b;const std::vector<bs_event>events={on(0,72),off(4000,72),on(5000,84),off(9000,84),on(9000,79)};const auto x=render(a.p,14000,1,events),y=render(b.p,14000,127,events);same(x,y);CHECK(std::abs(pitch(x,7000)-84)<.01);CHECK(std::abs(pitch(x,12000)-79)<.01);}
 std::puts("PASS fresh phrases including same-frame empty-to-new attacks bypass Glide");
 {Synth a,b;bs_performance_config c{};bs_default_performance(&c);c.mode=BS_ARP;c.mono=1;CHECK(bs_set_performance(a.p,&c)&&bs_set_performance(b.p,&c));bs_set_parameter(b.p,BS_GLIDE_ENABLED,0);bs_reset(a.p);bs_reset(b.p);const std::vector<bs_event>events={on(0,72),on(0,84)};same(render(a.p,48000,127,events),render(b.p,48000,1,events));}
 std::puts("PASS gated Mono Arp gaps do not create unintended legato slides");
 {Synth a,b;const std::vector<bs_event>events={on(0,72),on(9600,84),{10000,BS_PARAMETER,0,0,BS_GLIDE_TIME,.8f},on(12000,79),{14000,BS_PARAMETER,0,0,BS_GLIDE_ENABLED,0},off(18000,79),off(22000,84),off(24000,72),{28000,BS_PANIC,0,0,0,0}};same(render(a.p,30000,1,events),render(b.p,30000,127,events));CHECK(allocations==0&&bs_active_voices(a.p)==0&&bs_active_voices(b.p)==0);}
 std::puts("PASS Glide parameter changes, transitions and panic are sample/block invariant without allocations");
}
