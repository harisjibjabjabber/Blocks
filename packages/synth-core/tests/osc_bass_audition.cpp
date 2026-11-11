#include "blocks_synth.h"
#include "blocks_sound.h"
#include "blocks_osc_bass.h"
#include <array>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <fstream>
#include <string>
static void little(std::ostream&o,uint32_t n,unsigned bytes){for(unsigned i=0;i<bytes;++i)o.put(char(n>>(8*i)));}
int main(int argc,char**argv){if(argc!=2)return 1;constexpr unsigned frames=48000*6;for(unsigned mode=0;mode<3;++mode){auto*s=bs_create();if(!s||!bs_prepare(s,48000))return 2;bs_sound_config sound{1,1,0,1};bs_set_sound(s,&sound);bs_set_parameter(s,BS_OSC1_WAVE,2);bs_set_parameter(s,BS_OSC1_LEVEL,.7f);bs_set_parameter(s,BS_OSC2_LEVEL,0);bs_set_parameter(s,BS_DRIVE_ENABLED,0);bs_set_parameter(s,BS_FULLNESS_ENABLED,0);bs_set_parameter(s,BS_DRIFT_CENTS,0);bs_set_parameter(s,BS_SETTLING_CENTS,0);bs_set_parameter(s,BS_PITCH_DROP_ENABLED,0);bs_set_parameter(s,BS_FILTER_MIX,0);bs_set_parameter(s,BS_ATTACK,.01f);bs_set_parameter(s,BS_SUSTAIN_LEVEL,1);bs_set_parameter(s,BS_RELEASE,.1f);bs_set_parameter(s,BS_GAIN,.25f);bs_osc_bass_config c{};bs_default_osc_bass(&c);c.oscillators[0].enabled=mode?1:0;if(mode==2)c.oscillators[0]={1,10,1,1};bs_set_osc_bass(s,&c);bs_reset(s);const std::string file=std::string(argv[1])+"/"+(mode==0?"bass-off":mode==1?"bass-default":"bass-edge")+".wav";std::ofstream out(file,std::ios::binary);if(!out)return 3;out.write("RIFF",4);little(out,36+frames*4,4);out.write("WAVEfmt ",8);little(out,16,4);little(out,1,2);little(out,2,2);little(out,48000,4);little(out,48000*4,4);little(out,4,2);little(out,16,2);out.write("data",4);little(out,frames*4,4);std::array<float,128>l{},r{};double peak=0;for(unsigned start=0;start<frames;start+=128){unsigned n=std::min(128u,frames-start);std::array<bs_event,6>e{};unsigned count=0;for(unsigned note=0;note<3;++note){const unsigned on=note*96000,off=on+72000,key=24+12*note;if(on>=start&&on<start+n)e[count++]={on-start,BS_NOTE_ON,0,key,0,.7f};if(off>=start&&off<start+n)e[count++]={off-start,BS_NOTE_OFF,0,key,0,0};}if(bs_render(s,l.data(),r.data(),n,e.data(),count))return 4;for(unsigned i=0;i<n;++i)for(float x:{l[i],r[i]}){if(!std::isfinite(x)||std::abs(x)>=1)return 5;peak=std::max(peak,std::abs(double(x)));little(out,uint16_t(int16_t(std::lround(x*32767))),2);}}std::printf("audition=%s peak=%.9g gain=.25 level1=.7 velocity=.7 noNormalization\n",file.c_str(),peak);bs_destroy(s);}return 0;}
