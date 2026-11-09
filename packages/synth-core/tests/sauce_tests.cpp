#include "blocks_synth.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d: %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth{bs_synth*p=bs_create();Synth(){CHECK(p);bs_set_parameter(p,BS_OSC1_WAVE,BS_SINE);bs_set_parameter(p,BS_OSC1_LEVEL,1);bs_set_parameter(p,BS_OSC2_LEVEL,0);bs_set_parameter(p,BS_ATTACK,.001f);bs_set_parameter(p,BS_SUSTAIN_LEVEL,1);bs_set_parameter(p,BS_RELEASE,.01f);bs_set_parameter(p,BS_CUTOFF,20000);bs_set_parameter(p,BS_GAIN,.35f);bs_set_parameter(p,BS_ENVELOPE_RESPONSE,0);}~Synth(){bs_destroy(p);}};
struct Audio{std::vector<float>l,r;explicit Audio(unsigned n):l(n),r(n){}};
static Audio render(bs_synth*s,unsigned n,unsigned block,const std::vector<bs_event>&events){Audio a(n);std::vector<bs_event>local;local.reserve(events.size());bs_reset(s);for(unsigned start=0;start<n;start+=block){const unsigned count=std::min(block,n-start);local.clear();for(auto e:events)if(e.sample_offset>=start&&e.sample_offset<start+count){e.sample_offset-=start;local.push_back(e);}CHECK(bs_render(s,a.l.data()+start,a.r.data()+start,count,local.data(),unsigned(local.size()))==0);}for(unsigned i=0;i<n;++i)CHECK(std::isfinite(a.l[i])&&std::isfinite(a.r[i])&&std::abs(a.l[i])<=1&&std::abs(a.r[i])<=1);return a;}
static void same(const Audio&a,const Audio&b){CHECK(a.l==b.l&&a.r==b.r);}
static double harmonic(const Audio&a,unsigned multiple){constexpr double pi=3.14159265358979323846;const unsigned begin=4800,n=unsigned(a.l.size())-begin;const double f=261.6255653005986*multiple;double real=0,imaginary=0;for(unsigned i=0;i<n;++i){const double window=.5-.5*std::cos(2*pi*i/(n-1)),angle=2*pi*f*(i+begin)/48000;real+=a.l[i+begin]*window*std::cos(angle);imaginary-=a.l[i+begin]*window*std::sin(angle);}return 4*std::hypot(real,imaginary)/n;}
int main(){
 const std::vector<bs_event> note={{0,BS_NOTE_ON,0,60,0,.8f}};
 {Synth driven,bypass;for(auto*s:{driven.p,bypass.p})bs_set_parameter(s,BS_DRIVE,8);bs_set_parameter(bypass.p,BS_DRIVE_ENABLED,0);const auto a=render(driven.p,48000,127,note),b=render(bypass.p,48000,256,note);CHECK(bs_get_parameter(bypass.p,BS_DRIVE)==8);const double distorted=harmonic(a,3)/harmonic(a,1),clean=harmonic(b,3)/harmonic(b,1);CHECK(distorted>.05&&clean<distorted*.1);CHECK(a.l!=b.l);std::printf("METRIC Drive H3/H1 enabled=%.6f bypass=%.6f\n",distorted,clean);}
 std::puts("PASS Drive bypass reduces actual distortion and preserves the stored amount");
 {Synth drop,bypass,neutral;bs_set_parameter(drop.p,BS_PITCH_DROP_CENTS,1200);bs_set_parameter(bypass.p,BS_PITCH_DROP_CENTS,1200);bs_set_parameter(bypass.p,BS_PITCH_DROP_ENABLED,0);for(auto*s:{drop.p,bypass.p})bs_set_parameter(s,BS_PITCH_DROP_TIME,.5f);const auto a=render(drop.p,24000,127,note),b=render(bypass.p,24000,256,note),c=render(neutral.p,24000,1,note);CHECK(a.l!=b.l);same(b,c);CHECK(bs_get_parameter(bypass.p,BS_PITCH_DROP_CENTS)==1200);}
 std::puts("PASS Pitch Drop bypass exactly matches neutral pitch while retaining its amount");
 {Synth body,bypass,neutral;for(auto*s:{body.p,bypass.p})bs_set_parameter(s,BS_FULLNESS,1);bs_set_parameter(bypass.p,BS_FULLNESS_ENABLED,0);const auto a=render(body.p,48000,127,note),b=render(bypass.p,48000,256,note),c=render(neutral.p,48000,1,note);CHECK(a.l!=b.l);same(b,c);CHECK(bs_get_parameter(bypass.p,BS_FULLNESS)==1);}
 std::puts("PASS Fullness bypass exactly matches amount0 while retaining its amount");
 {Synth after,before;for(auto*s:{after.p,before.p}){bs_set_parameter(s,BS_DRIVE,4);bs_set_parameter(s,BS_FULLNESS,1);}bs_set_parameter(before.p,BS_SAUCE_ORDER,1);const auto a=render(after.p,48000,127,note),b=render(before.p,48000,256,note);CHECK(a.l!=b.l);double difference=0;for(unsigned i=4800;i<a.l.size();++i)difference+=std::abs(a.l[i]-b.l[i]);CHECK(difference/(a.l.size()-4800)>.0001);}
 std::puts("PASS both actual audio rack orders produce distinct finite bounded signals");
 {Synth a,b;for(auto*s:{a.p,b.p}){bs_set_parameter(s,BS_DRIVE,8);bs_set_parameter(s,BS_FULLNESS,1);bs_set_parameter(s,BS_PITCH_DROP_CENTS,600);}const std::vector<bs_event>events={{0,BS_NOTE_ON,0,60,0,.8f},{3500,BS_PARAMETER,0,0,BS_SAUCE_ORDER,1},{5000,BS_PARAMETER,0,0,BS_SAUCE_ORDER,0},{5100,BS_PARAMETER,0,0,BS_SAUCE_ORDER,1},{7500,BS_PARAMETER,0,0,BS_DRIVE_ENABLED,0},{9000,BS_PARAMETER,0,0,BS_FULLNESS_ENABLED,0},{12000,BS_PARAMETER,0,0,BS_PITCH_DROP_ENABLED,0},{13000,BS_PARAMETER,0,0,BS_DRIVE_ENABLED,1},{15000,BS_PARAMETER,0,0,BS_FULLNESS_ENABLED,1},{17000,BS_PARAMETER,0,0,BS_PITCH_DROP_ENABLED,1},{22000,BS_NOTE_OFF,0,60,0,0}};const auto x=render(a.p,30000,1,events),y=render(b.p,30000,127,events);same(x,y);CHECK(bs_active_voices(a.p)==0&&bs_active_voices(b.p)==0);}
 std::puts("PASS live order retargeting and component bypass events are block invariant and release cleanly");
}
