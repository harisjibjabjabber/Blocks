#include "blocks_synth.h"
#include "blocks_sound.h"
#include "blocks_harmonics.h"
#include "blocks_sauce.h"
#include "blocks_voicing.h"
#include "blocks_modulation.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <new>
#include <vector>
static bool watch=false;static unsigned allocations=0;
void*operator new(std::size_t n){if(watch)++allocations;if(auto*p=std::malloc(n?n:1))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}void operator delete(void*p,std::size_t)noexcept{std::free(p);}
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(0)
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));}~Synth(){bs_destroy(p);}};
struct Audio{std::vector<float>l,r;explicit Audio(unsigned n):l(n),r(n){}};
static Audio render(bs_synth*s,unsigned n,unsigned block=127){Audio a(n);for(unsigned at=0;at<n;at+=block){watch=true;const int status=bs_render(s,a.l.data()+at,a.r.data()+at,std::min(block,n-at),nullptr,0);watch=false;CHECK(!status);}for(unsigned i=0;i<n;++i)CHECK(std::isfinite(a.l[i])&&std::isfinite(a.r[i])&&std::abs(a.l[i])<=1&&std::abs(a.r[i])<=1);return a;}
static bool equal(const Audio&a,const Audio&b){return a.l==b.l&&a.r==b.r;}
static double energy(const Audio&a){double sum=0;for(unsigned i=0;i<a.l.size();++i)sum+=a.l[i]*a.l[i]+a.r[i]*a.r[i];return sum;}
static bs_harmonics_config settings(){bs_harmonics_config c{};bs_default_harmonics(&c);c.count=2;c.entries[0]={100,0,0,0,1,0};c.entries[1]={200,1,.2f,.4f,.8f,-2};return c;}
static bs_sauce_config rack(){bs_sauce_config c{};bs_default_sauce(&c);c.count=2;c.blocks[0]={100,BS_SAUCE_HARMONICS,0,1,4};c.blocks[1]={200,BS_SAUCE_HARMONICS,0,1,2};return c;}
static void setup(bs_synth*s){CHECK(bs_set_parameter(s,BS_OSC1_LEVEL,1)&&bs_set_parameter(s,BS_OSC2_LEVEL,0)&&bs_set_parameter(s,BS_DRIFT_CENTS,0)&&bs_set_parameter(s,BS_SETTLING_CENTS,0)&&bs_set_parameter(s,BS_VELOCITY_MOVEMENT,0)&&bs_set_parameter(s,BS_DRIVE_ENABLED,0)&&bs_set_parameter(s,BS_FULLNESS_ENABLED,0)&&bs_set_parameter(s,BS_SUSTAIN_LEVEL,1)&&bs_set_parameter(s,BS_RELEASE,.02f));bs_sound_config sound{1,BS_SOURCE_STUDIO,BS_FILTER_EXISTING,1};CHECK(bs_set_sound(s,&sound));auto h=settings();auto r=rack();CHECK(bs_set_harmonics(s,&h)&&bs_set_sauce(s,&r));bs_reset(s);}
int main(){
 {Synth s;setup(s.p);auto good=settings();bs_harmonics_config before{};CHECK(bs_get_harmonics(s.p,&before));bs_note_on(s.p,0,60,.7f);render(s.p,1000);for(unsigned field=0;field<4;++field){auto bad=good;if(field==0)bad.entries[1].mix=std::numeric_limits<float>::quiet_NaN();if(field==1)bad.entries[1].id=100;if(field==2)bad.entries[1].model=2;if(field==3)bad.count=17;CHECK(!bs_set_harmonics(s.p,&bad));bs_harmonics_config after{};CHECK(bs_get_harmonics(s.p,&after)&&std::memcmp(&before,&after,sizeof before)==0);CHECK(bs_active_voices(s.p)==1);}auto r=rack(),bad=r;bad.blocks[1].primary=1;CHECK(!bs_set_sauce(s.p,&bad));bs_sauce_config actual{};CHECK(bs_get_sauce(s.p,&actual)&&std::memcmp(&r,&actual,sizeof r)==0);CHECK(!bs_set_harmonics(nullptr,&good)&&!bs_set_harmonics(s.p,nullptr)&&!bs_get_harmonics(s.p,nullptr));}
 std::puts("PASS actual Harmonics API rejects whole invalid state without changing active ownership");
 {Synth a,b;setup(a.p);setup(b.p);for(auto*s:{a.p,b.p})bs_note_on(s,0,60,.7f);CHECK(equal(render(a.p,4000),render(b.p,4000)));auto h=settings();h.entries[0].model=1;h.entries[0].tone=-.7f;h.entries[0].output_db=-8;watch=true;CHECK(bs_set_harmonics(a.p,&h));watch=false;auto changed=render(a.p,6000),unchanged=render(b.p,6000);CHECK(!equal(changed,unchanged)&&energy(changed)>0);CHECK(bs_active_voices(a.p)==1&&bs_active_voices(b.p)==1);CHECK(bs_set_harmonics(b.p,&h));bs_panic(a.p);bs_panic(b.p);for(auto*s:{a.p,b.p})bs_note_on(s,0,67,.7f);CHECK(equal(render(a.p,6000),render(b.p,6000)));}
 std::puts("PASS live Harmonics edits change actual audio and new voices inherit identical requested settings");
 {Synth a,b;setup(a.p);setup(b.p);bs_sound_config sound{1,1,1,3};CHECK(bs_set_sound(a.p,&sound)&&bs_set_sound(b.p,&sound));bs_note_on(a.p,0,55,.7f);render(a.p,2000);CHECK(bs_prepare(a.p,96000)&&bs_prepare(b.p,96000));bs_harmonics_config h{};bs_sound_config q{};CHECK(bs_get_harmonics(a.p,&h)&&h.count==2&&h.entries[1].id==200);CHECK(bs_get_sound(a.p,&q)&&q.filter_model==1&&q.oscillator==1&&q.filter_drive==3);CHECK(bs_active_voices(a.p)==0);for(auto*s:{a.p,b.p})bs_note_on(s,0,55,.7f);CHECK(equal(render(a.p,6000,1),render(b.p,6000,256)));bs_panic(a.p);auto silent=render(a.p,3000);CHECK(energy(silent)==0);CHECK(bs_get_harmonics(a.p,&h)&&h.entries[1].model==1);}
 std::puts("PASS sample-rate prepare reinitializes DSP histories while preserving additive settings; panic clears delayed voices");
 {Synth a,b;setup(a.p);setup(b.p);bs_voicing_config voices{1,7,10,.8f};bs_modulation_config_v3 mod{};bs_default_modulation_v3(&mod);mod.source_count=1;auto&lfo=mod.sources[0];lfo.id=7;lfo.enabled=1;lfo.waveform=0;lfo.synced=0;lfo.rate_hz=3;lfo.intensity=.6f;lfo.route_count=1;lfo.routes[0]={1,100,0,.5f};for(auto*s:{a.p,b.p}){CHECK(bs_set_voicing(s,&voices)&&bs_set_modulation_v3(s,&mod));for(unsigned key=48;key<66;++key)bs_note_on(s,0,key,.5f);}CHECK(equal(render(a.p,1000,1),render(b.p,1000,127)));auto r=rack();std::swap(r.blocks[0],r.blocks[1]);for(auto*s:{a.p,b.p})CHECK(bs_set_sauce(s,&r));CHECK(equal(render(a.p,40,1),render(b.p,40,40)));auto h=settings();h.entries[0].tone=.8f;h.entries[1].dynamics=1;h.entries[1].model=0;r.blocks[0].enabled=0;for(auto*s:{a.p,b.p}){watch=true;CHECK(bs_set_harmonics(s,&h)&&bs_set_sauce(s,&r));watch=false;}CHECK(equal(render(a.p,3000,1),render(b.p,3000,128)));CHECK(bs_active_voices(a.p)==16);for(auto*s:{a.p,b.p}){bs_sustain(s,0,1);for(unsigned key=48;key<66;++key)bs_note_off(s,0,key);}CHECK(equal(render(a.p,500,1),render(b.p,500,127)));for(auto*s:{a.p,b.p})bs_sustain(s,0,0);CHECK(equal(render(a.p,5000,1),render(b.p,5000,256)));CHECK(bs_active_voices(a.p)==0);}
 std::puts("PASS type2 amount modulation, queued reorder/settings edits and seven-copy steals/pedal/release are block-exact");
 {Synth a,b;setup(a.p);setup(b.p);bs_modulation_config_v3 mod{};bs_default_modulation_v3(&mod);mod.source_count=1;auto&s=mod.sources[0];s.id=9;s.enabled=1;s.synced=0;s.rate_hz=5;s.intensity=1;s.route_count=1;s.routes[0]={1,100,0,.8f};CHECK(bs_set_modulation_v3(a.p,&mod));auto bad=mod;bad.sources[0].routes[0].parameter_id=1;CHECK(!bs_set_modulation_v3(a.p,&bad));bs_modulation_config_v3 actual{};CHECK(bs_get_modulation_v3(a.p,&actual)&&std::memcmp(&actual,&mod,sizeof mod)==0);for(auto*p:{a.p,b.p})bs_note_on(p,0,60,.7f);CHECK(!equal(render(a.p,6000),render(b.p,6000)));CHECK(bs_active_voices(a.p)==1&&allocations==0);}
 std::puts("PASS Harmonics amount routing has real audio effect, rejects unsupported target controls and allocates nothing in render/config edits");
}
