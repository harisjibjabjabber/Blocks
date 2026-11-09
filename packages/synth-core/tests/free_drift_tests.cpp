#include "blocks_synth.h"
#include "../src/free_drift.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d: %s\n",__LINE__,#x);std::exit(1);}}while(false)
struct Synth {bs_synth*p=bs_create();Synth(){CHECK(p);CHECK(bs_prepare(p,48000));for(auto pair:std::vector<std::pair<unsigned,float>>{{BS_OSC1_WAVE,BS_SINE},{BS_OSC2_WAVE,BS_SINE},{BS_OSC1_LEVEL,1},{BS_OSC2_LEVEL,0},{BS_FILTER_MIX,0},{BS_FULLNESS,0},{BS_ATTACK,.001f},{BS_DECAY,.01f},{BS_SUSTAIN_LEVEL,1},{BS_RELEASE,.02f},{BS_DRIFT_CENTS,120},{BS_DRIFT_HZ,.58f},{BS_SETTLING_CENTS,0},{BS_VELOCITY_MOVEMENT,0},{BS_ENVELOPE_RESPONSE,0},{BS_GLIDE_ENABLED,0}})CHECK(bs_set_parameter(p,pair.first,pair.second));bs_reset(p);}~Synth(){bs_destroy(p);}};
std::vector<float> render(bs_synth*s,unsigned frames,unsigned block=127){std::vector<float> out(frames),right(block);for(unsigned at=0;at<frames;at+=block){unsigned n=std::min(block,frames-at);CHECK(bs_render(s,out.data()+at,right.data(),n,nullptr,0)==0);}for(float v:out)CHECK(std::isfinite(v)&&std::abs(v)<=1);return out;}
int main(){
 for(unsigned ch:{0u,7u,15u})for(unsigned key:{0u,36u,60u,69u,84u,127u})for(unsigned i=0;i<10000;++i){const double p=i*.0137,v=blocks_detail::freeDrift(p,ch,key);CHECK(std::isfinite(v)&&std::abs(v)<=1);CHECK(std::abs(v-blocks_detail::freeDrift(p+1e-8,ch,key))<1e-6);CHECK(v==blocks_detail::freeDrift(p,ch,key));}
 CHECK(blocks_detail::freeDrift(.35,0,60)!=blocks_detail::freeDrift(.35,0,64));CHECK(blocks_detail::freeDrift(.35,0,60)!=blocks_detail::freeDrift(.35,1,60));
 std::puts("PASS free drift has bounded continuous deterministic note/channel paths without note-trigger state");
 {Synth idle,panicked,fresh;render(idle.p,48000);render(panicked.p,48000,256);bs_panic(panicked.p);bs_note_on(idle.p,0,69,1);bs_note_on(panicked.p,0,69,1);bs_note_on(fresh.p,0,69,1);const auto a=render(idle.p,4800),b=render(panicked.p,4800,1),c=render(fresh.p,4800);CHECK(a==b);CHECK(a!=c);}
 std::puts("PASS actual audio drift advances through silence and panic retains its clock");
 {Synth retrigger,unplayed;bs_note_on(retrigger.p,0,69,1);render(retrigger.p,48000);bs_note_off(retrigger.p,0,69);render(retrigger.p,9600);render(unplayed.p,57600,256);CHECK(bs_active_voices(retrigger.p)==0);bs_note_on(retrigger.p,0,69,1);bs_note_on(unplayed.p,0,69,1);CHECK(render(retrigger.p,4800,1)==render(unplayed.p,4800,127));}
 std::puts("PASS repeated same-note attacks inherit the current free-running drift exactly, independent of note ordinal");
 {Synth a,b;render(a.p,7777);bs_reset(a.p);bs_note_on(a.p,0,72,1);bs_note_on(b.p,0,72,1);CHECK(render(a.p,4800,1)==render(b.p,4800,256));}
 std::puts("PASS explicit reset restores the deterministic drift origin and render block size is irrelevant");
}
