#include "blocks_synth.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>
static void u16(FILE*f,unsigned v){unsigned char b[]={static_cast<unsigned char>(v),static_cast<unsigned char>(v>>8)};std::fwrite(b,1,2,f);}
static void u32(FILE*f,unsigned v){u16(f,v);u16(f,v>>16);}
static bool wav(const std::string&path,const std::vector<float>&l,const std::vector<float>&r,double gain){FILE*f=std::fopen(path.c_str(),"wb");if(!f)return false;std::fwrite("RIFF",1,4,f);u32(f,36+unsigned(l.size())*8);std::fwrite("WAVEfmt ",1,8,f);u32(f,16);u16(f,3);u16(f,2);u32(f,48000);u32(f,384000);u16(f,8);u16(f,32);std::fwrite("data",1,4,f);u32(f,unsigned(l.size())*8);for(unsigned i=0;i<l.size();++i){float x=float(l[i]*gain),y=float(r[i]*gain);std::fwrite(&x,4,1,f);std::fwrite(&y,4,1,f);}return std::fclose(f)==0;}
int main(int argc,char**argv){
 if(argc!=2)return 1;const unsigned frames=48000*5;const char*phrases[]={"bass-pluck","arpeggio","chord","bright-lead"};const char*modes[]={"dry","moving-space","fractured-space","impact","impact-hard","impact-then-space"};
 for(unsigned phrase=0;phrase<4;++phrase)for(unsigned mode=0;mode<6;++mode){
  bs_synth*s=bs_create();if(!s||!bs_prepare(s,48000))return 2;
  for(auto p:{std::pair<unsigned,float>{BS_OSC1_WAVE,BS_SAW},{BS_OSC1_LEVEL,.8f},{BS_OSC2_LEVEL,0},{BS_GAIN,.5f},{BS_CUTOFF,phrase==0?1800.f:8000.f},{BS_DRIFT_CENTS,8},{BS_DRIFT_HZ,.4f},{BS_SETTLING_CENTS,4},{BS_ATTACK,phrase==2?.05f:.002f},{BS_DECAY,phrase==0?.2f:.4f},{BS_SUSTAIN_LEVEL,phrase==2?.7f:0.f},{BS_RELEASE,.3f}})bs_set_parameter(s,p.first,p.second);
  bs_creative_fx_config fx{};bs_default_creative_fx(&fx);fx.count=mode?1:0;
  if(mode){bs_default_creative_fx_block(mode>=3?BS_CREATIVE_IMPACT:BS_CREATIVE_MOVING_SPACE,&fx.blocks[0]);fx.blocks[0].id=1;}
  if(mode==2){fx.blocks[0].mix=.85f;fx.blocks[0].motion=1;fx.blocks[0].space=.3f;fx.blocks[0].shimmer=1;fx.blocks[0].pitch=7;}
  if(mode==4||mode==5){fx.blocks[0].mix=1;fx.blocks[0].tight=1;fx.blocks[0].click=1;fx.blocks[0].body=.65f;fx.blocks[0].output_db=-6;}
  if(mode==5){fx.count=2;bs_default_creative_fx_block(0,&fx.blocks[1]);fx.blocks[1].id=2;fx.blocks[1].mix=.65f;fx.blocks[1].motion=.8f;fx.blocks[1].shimmer=.8f;}
  if(!bs_set_creative_fx(s,&fx))return 6;bs_reset(s);
  std::vector<bs_event> events;
  if(phrase==2){for(unsigned key:{48u,55u,60u,64u}){events.push_back({0,BS_NOTE_ON,0,key,0,.6f});events.push_back({96000,BS_NOTE_OFF,0,key,0,0});}}
  else{const unsigned bass[]={36,36,43,39,36,46,43,39},arp[]={60,64,67,72,67,64,60,55},lead[]={79,76,74,72,76,79,83,79};const unsigned*notes=phrase==0?bass:phrase==1?arp:lead;for(unsigned i=0;i<8;++i){unsigned at=i*12000;events.push_back({at,BS_NOTE_ON,0,notes[i],0,i%2?.6f:.85f});events.push_back({at+9000,BS_NOTE_OFF,0,notes[i],0,0});}}
  std::stable_sort(events.begin(),events.end(),[](const bs_event&a,const bs_event&b){return a.sample_offset<b.sample_offset;});
  std::vector<float>l(frames),r(frames);std::vector<bs_event>local;local.reserve(events.size());
  for(unsigned at=0;at<frames;at+=128){local.clear();for(auto e:events)if(e.sample_offset>=at&&e.sample_offset<at+128){e.sample_offset-=at;local.push_back(e);}if(bs_render(s,l.data()+at,r.data()+at,128,local.data(),unsigned(local.size())))return 3;}
  double energy=0,peak=0;for(unsigned i=0;i<frames;++i){if(!std::isfinite(l[i])||!std::isfinite(r[i]))return 4;energy+=double(l[i])*l[i]+double(r[i])*r[i];peak=std::max(peak,std::max(std::abs(double(l[i])),std::abs(double(r[i]))));}
  double rms=std::sqrt(energy/(2*frames)),matched=rms>0?std::pow(10.,-42/20.)/rms:1;
  if(peak*matched>=1)return 7;
  std::string stem=std::string(argv[1])+"/"+phrases[phrase]+"-"+modes[mode];if(!wav(stem+"-fixed.wav",l,r,1)||!wav(stem+"-matched.wav",l,r,matched))return 5;
  std::printf("%s-%s rms=%.9g peak=%.9g match_gain=%.9g matched_peak=%.9g matched_target_dbfs=-42 latency=%u\n",phrases[phrase],modes[mode],rms,peak,matched,peak*matched,bs_output_latency(s));bs_destroy(s);
 }
}
