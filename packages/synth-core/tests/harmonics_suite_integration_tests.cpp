#include "blocks_synth.h"
#include "blocks_harmonics_suite.h"
#include "blocks_sauce.h"
#include "blocks_sound.h"
#include "blocks_bass_support.h"
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
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p&&bs_prepare(p,48000));}~Synth(){bs_destroy(p);}};
static void setup(bs_synth*s,float sustain=0){bs_set_parameter(s,BS_OSC1_WAVE,BS_SINE);bs_set_parameter(s,BS_OSC1_LEVEL,1);bs_set_parameter(s,BS_OSC2_LEVEL,0);bs_set_parameter(s,BS_GAIN,.2f);bs_set_parameter(s,BS_FILTER_MIX,0);bs_set_parameter(s,BS_ATTACK,.001f);bs_set_parameter(s,BS_DECAY,.05f);bs_set_parameter(s,BS_SUSTAIN_LEVEL,sustain);bs_set_parameter(s,BS_RELEASE,.05f);bs_set_parameter(s,BS_DRIFT_CENTS,0);bs_set_parameter(s,BS_SETTLING_CENTS,0);bs_set_parameter(s,BS_FULLNESS,0);bs_reset(s);}
static bs_harmonics_suite_config config(float d=0,float mix=1){bs_harmonics_suite_config c{};bs_default_harmonics_suite(&c);c.enabled=1;c.colour_enabled=0;c.dynamics=d;c.mix=mix;return c;}
static std::vector<float> render(bs_synth*s,unsigned n,unsigned block=127){std::vector<float>a(n*2);for(unsigned i=0;i<n;i+=block){watch=true;CHECK(!bs_render(s,a.data()+i,a.data()+n+i,std::min(block,n-i),nullptr,0));watch=false;}for(float x:a)CHECK(std::isfinite(x)&&std::abs(x)<=1);return a;}
static double energy(const std::vector<float>&a,unsigned from=0,unsigned end=0){if(!end)end=unsigned(a.size()/2);double v=0;for(unsigned i=from;i<end;++i)v+=double(a[i])*a[i];return v/std::max(1u,end-from);}
static double motifContrast(float dynamics){
 Synth s;for(auto p:{std::pair<unsigned,float>{BS_OSC1_WAVE,BS_SAW},{BS_OSC1_LEVEL,.8f},{BS_OSC2_LEVEL,0},{BS_GAIN,.3f},{BS_DRIFT_CENTS,0},{BS_SETTLING_CENTS,0},{BS_PITCH_DROP_ENABLED,0},{BS_FULLNESS_ENABLED,0},{BS_FILTER_MIX,0},{BS_ATTACK,.002f},{BS_DECAY,.24f},{BS_SUSTAIN_LEVEL,0},{BS_RELEASE,.15f}})CHECK(bs_set_parameter(s.p,p.first,p.second));
 bs_sound_config sound{1,1,1,1};CHECK(bs_set_sound(s.p,&sound));auto c=config(dynamics);CHECK(bs_set_harmonics_suite(s.p,&c));bs_reset(s.p);
 const unsigned keys[]={36,43,48,55};double attack=0,body=0;unsigned an=0,bn=0;
 for(unsigned k=0;k<4;++k){bs_note_on(s.p,0,keys[k],k%2?.6f:.9f);auto samples=render(s.p,14000);bs_note_off(s.p,0,keys[k]);render(s.p,4000);for(unsigned channel=0;channel<2;++channel){for(unsigned i=96;i<1200;++i){double x=samples[channel*14000+i];attack+=x*x;++an;}for(unsigned i=2880;i<9600;++i){double x=samples[channel*14000+i];body+=x*x;++bn;}}}
 return (attack/an)/(body/bn);
}
int main(){
 {Synth s;bs_harmonics_suite_config c{},before{},after{};bs_default_harmonics_suite(&c);CHECK(sizeof(c)==204&&sizeof(bs_harmonics_suite_meters)==44&&bs_harmonics_suite_latency()==24);CHECK(!c.enabled&&c.dynamics==0&&c.mix==1);CHECK(bs_get_harmonics_suite(s.p,&before));for(unsigned i=0;i<5;++i){auto bad=c;if(i==0)bad.reserved=1;if(i==1)bad.dynamics=1.1f;if(i==2)bad.drive_db=NAN;if(i==3)bad.colour_style=5;if(i==4)bad.ott_amount=-1;CHECK(!bs_set_harmonics_suite(s.p,&bad));CHECK(bs_get_harmonics_suite(s.p,&after)&&!std::memcmp(&before,&after,sizeof before));}}
 std::puts("PASS204/44-byte Suite validation, fixed24-sample latency");
 {Synth a,b,c;setup(a.p);setup(b.p);setup(c.p);auto neutral=config(),dry=config(1,0);CHECK(bs_set_harmonics_suite(b.p,&neutral)&&bs_set_harmonics_suite(c.p,&dry));bs_reset(b.p);bs_reset(c.p);for(auto*s:{a.p,b.p,c.p})bs_note_on(s,0,60,.8f);auto baseline=render(a.p,12000);CHECK(baseline==render(b.p,12000));CHECK(baseline==render(c.p,12000));for(unsigned i=0;i<25;++i)CHECK(baseline[i]==0);CHECK(energy(baseline)>1e-6);}
 std::puts("PASS Dynamics0 and Mix0 preserve original source envelope");
 {Synth shortNote,normal,longNote;for(auto*s:{shortNote.p,normal.p,longNote.p})setup(s,1);for(auto pair:{std::pair<bs_synth*,float>{shortNote.p,-1},{normal.p,0},{longNote.p,1}}){auto c=config(pair.second);CHECK(bs_set_harmonics_suite(pair.first,&c));bs_reset(pair.first);bs_note_on(pair.first,0,60,.8f);}const auto a=render(shortNote.p,5000),b=render(normal.p,5000),c=render(longNote.p,5000);CHECK(energy(a)>0&&energy(b)>0&&energy(c)>0);for(auto*s:{shortNote.p,normal.p,longNote.p})bs_note_off(s,0,60);render(shortNote.p,3000);render(normal.p,3000);auto tail=render(longNote.p,3000);CHECK(bs_active_voices(shortNote.p)==0&&bs_active_voices(normal.p)==0&&bs_active_voices(longNote.p)==0);render(longNote.p,10000);CHECK(bs_active_voices(longNote.p)==0);}
 std::puts("PASS signed audio Dynamics never changes original held/released voice lifetime");
 {Synth a,b;for(auto*s:{a.p,b.p}){setup(s,1);auto c=config(.6f);c.colour_enabled=1;c.drive_db=12;CHECK(bs_set_harmonics_suite(s,&c));bs_reset(s);bs_note_on(s,0,48,.7f);bs_note_on(s,1,60,.8f);}CHECK(render(a.p,2000,1)==render(b.p,2000,256));auto c=config(-.7f);c.comp_enabled=1;c.colour_enabled=1;c.drive_db=18;for(auto*s:{a.p,b.p}){watch=true;CHECK(bs_set_harmonics_suite(s,&c));watch=false;bs_sustain(s,0,1);bs_note_off(s,0,48);bs_note_off(s,1,60);}CHECK(render(a.p,3000,1)==render(b.p,3000,127));for(auto*s:{a.p,b.p})bs_sustain(s,0,0);CHECK(render(a.p,14000,1)==render(b.p,14000,256));bs_panic(a.p);CHECK(energy(render(a.p,512))==0);CHECK(allocations==0);}
 std::puts("PASS live Suite edits and original pedal/release ownership block-exact, panic silent and allocation-free");
 {Synth a,b;setup(a.p,1);setup(b.p,1);bs_set_parameter(b.p,BS_DRIVE,12);bs_set_parameter(b.p,BS_DRIVE_ENABLED,0);bs_set_parameter(b.p,BS_SAUCE_ORDER,1);bs_reset(b.p);for(auto*s:{a.p,b.p})bs_note_on(s,0,60,.7f);CHECK(render(a.p,3000)==render(b.p,3000));bs_sauce_config bad{1,1,{{1,0,0,1,4}}};CHECK(!bs_set_sauce(a.p,&bad));bad.blocks[0].type=2;CHECK(!bs_set_sauce(a.p,&bad));bad.blocks[0]={1,BS_SAUCE_FULLNESS,0,1,.5f};CHECK(bs_set_sauce(a.p,&bad));}
 std::puts("PASS reserved per-voice Drive controls are inert and Sauce accepts only Fullness");
 {Synth clean,processed;for(auto*p:{clean.p,processed.p}){setup(p,1);bs_set_parameter(p,BS_OSC1_LEVEL,0);bs_sub_config sub{};bs_default_sub(&sub);sub.enabled=1;sub.level=.5f;CHECK(bs_set_sub(p,&sub));}auto c=config(1);c.colour_enabled=c.comp_enabled=c.crush_enabled=c.ott_enabled=1;c.drive_db=24;c.crush_amount=.8f;c.ott_amount=.8f;c.output_db=6;CHECK(bs_set_harmonics_suite(processed.p,&c));for(auto*p:{clean.p,processed.p}){bs_reset(p);bs_note_on(p,0,48,.8f);}CHECK(render(clean.p,6000)==render(processed.p,6000));for(auto*p:{clean.p,processed.p})bs_note_off(p,0,48);CHECK(render(clean.p,3000)==render(processed.p,3000));CHECK(bs_get_sub_note(clean.p)==-1&&bs_get_sub_note(processed.p)==-1);for(auto*p:{clean.p,processed.p})bs_note_on(p,0,48,.8f);bs_sub_config sub{};CHECK(bs_get_sub(processed.p,&sub));sub.routing=1;CHECK(bs_set_sub(processed.p,&sub));CHECK(render(clean.p,6000)!=render(processed.p,6000));}
 std::puts("PASS Clean Sub bypasses all Suite stages/output gain with24-sample alignment; FX Sub enters the shaped bus");
 {Synth s;auto c=config(.4f);c.colour_enabled=1;c.colour_style=4;c.colour_mix=.6f;c.colour2_enabled=1;c.colour2_style=3;c.colour2_drive_db=18;c.colour2_tone=.3f;c.colour2_mix=.7f;c.comp_auto_makeup=0;c.ott_low_hz=220;c.ott_high_hz=3300;c.bands[2].gain_db=4;c.colour2_output_db=-3;CHECK(bs_set_harmonics_suite(s.p,&c));bs_harmonics_suite_config got{};CHECK(bs_get_harmonics_suite(s.p,&got)&&!std::memcmp(&c,&got,sizeof c));for(unsigned i=0;i<6;++i){auto bad=c;if(i==0)bad.version=1;if(i==1)bad.colour2_style=5;if(i==2)bad.ott_high_hz=300;if(i==3)bad.bands[1].up=2;if(i==4)bad.comp_auto_makeup=2;if(i==5)bad.colour_output_db=13;CHECK(!bs_set_harmonics_suite(s.p,&bad));CHECK(bs_get_harmonics_suite(s.p,&got)&&!std::memcmp(&c,&got,sizeof c));}float dry[128]{},wet[128]{},colour[128]{};watch=true;CHECK(bs_suite_dynamics_preview(&c,48000,dry,wet,128));CHECK(bs_suite_colour_preview(&c,130.8128f,48000,colour,128));watch=false;for(unsigned i=0;i<128;++i)CHECK(std::isfinite(dry[i])&&std::isfinite(wet[i])&&std::isfinite(colour[i]));CHECK(allocations==0);}
 std::puts("PASS two Colour slots and per-band OTT roundtrip atomically; native response previews allocate no heap");
 {Synth s;auto c=config();c.comp_enabled=1;c.comp_makeup_db=-24;CHECK(bs_set_harmonics_suite(s.p,&c));bs_harmonics_suite_config read{};CHECK(bs_get_harmonics_suite(s.p,&read)&&read.comp_makeup_db==-24);auto bad=c;bad.comp_makeup_db=-25;CHECK(!bs_set_harmonics_suite(s.p,&bad));CHECK(bs_get_harmonics_suite(s.p,&read)&&!std::memcmp(&read,&c,sizeof c));
 const double neutral=motifContrast(0),tight=10*std::log10(motifContrast(-1)/neutral),bloom=10*std::log10(motifContrast(1)/neutral);std::printf("METRIC actual four-note Dynamics Tight=%.6fdB Bloom=%.6fdB\n",tight,bloom);CHECK(tight>=3&&bloom<=-3);}
 std::puts("PASS manual compressor trim accepts attenuation; actual C2/G2/C3/G3 motif has opposite Tight/Bloom audio contrast");
 return 0;
}
