#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <vector>
#ifndef BS_FIXTURE_FULLNESS
#define BS_FIXTURE_FULLNESS .55f
#endif
static void little(std::ostream &out,uint32_t value,unsigned bytes) { for(unsigned i=0;i<bytes;++i) out.put(char(value>>(8*i))); }
int main(int argc,char **argv) {
 if(argc!=2) { std::cerr<<"Usage: blocks_synth_render output.wav\n"; return 1; }
 constexpr unsigned rate=48000,frames=rate*3;
 bs_synth*s=bs_create(); if(!s||!bs_prepare(s,rate)) return 2;
 bs_set_parameter(s,BS_DRIFT_CENTS,7); bs_set_parameter(s,BS_PITCH_DROP_CENTS,120); bs_set_parameter(s,BS_PITCH_DROP_TIME,.15f); bs_set_parameter(s,BS_FULLNESS,BS_FIXTURE_FULLNESS); bs_reset(s);
 std::vector<float> l(frames),r(frames); std::vector<bs_event> events;
 for(unsigned key:{60u,64u,67u}) events.push_back({0,BS_NOTE_ON,0,key,0,.7f});
 for(unsigned key:{60u,64u,67u}) events.push_back({rate*2,BS_NOTE_OFF,0,key,0,0});
 for(unsigned start=0;start<frames;start+=256) {
  const unsigned n=std::min(256u,frames-start); std::array<bs_event,6> local{}; unsigned count=0;
  for(auto e:events) if(e.sample_offset>=start&&e.sample_offset<start+n) { e.sample_offset-=start; local[count++]=e; }
  if(bs_render(s,l.data()+start,r.data()+start,n,local.data(),count)!=0) return 3;
 }
 bs_destroy(s); std::ofstream out(argv[1],std::ios::binary); if(!out) return 4;
 out.write("RIFF",4); little(out,36+frames*4,4); out.write("WAVEfmt ",8); little(out,16,4); little(out,1,2); little(out,2,2); little(out,rate,4); little(out,rate*4,4); little(out,4,2); little(out,16,2); out.write("data",4); little(out,frames*4,4);
 for(unsigned i=0;i<frames;++i) for(float x:{l[i],r[i]}) little(out,uint16_t(int16_t(std::lround(std::max(-1.f,std::min(1.f,x))*32767))),2);
 if(!out) return 5; std::cout<<"Wrote 3 seconds of stereo PCM16 at 48000 Hz\n"; return 0;
}
