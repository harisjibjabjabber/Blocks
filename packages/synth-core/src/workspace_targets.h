#ifndef BLOCKS_WORKSPACE_TARGETS_H
#define BLOCKS_WORKSPACE_TARGETS_H
#include "blocks_synth.h"
#include <algorithm>
#include <array>
#include <cmath>
namespace blocks_detail {
inline const bs_modulation_target_descriptor* workspaceTarget(unsigned kind,unsigned id,unsigned p){
 using D=bs_modulation_target_descriptor;
 static const D unit{0,1,0,0,0,"Amount","ratio"},width{0,2,1,0,0,"Width","ratio"},fine{-100,100,0,0,1,"Fine pitch","cents"},movement{-1,1,.45f,0,0,"Envelope depth","ratio"};
 static const D envelope[]={{.001f,5,.015f,1,1,"Attack","seconds"},{.001f,8,.3f,1,1,"Decay","seconds"},{0,1,.65f,0,1,"Sustain","ratio"},{.001f,10,.35f,1,1,"Release","seconds"},{-2,2,0,0,1,"Attack bend","octaves"},{-2,2,0,0,1,"Decay bend","octaves"},{-2,2,0,0,1,"Release bend","octaves"}};
 static const auto modulationEnvelope=[&](){std::array<D,7>e{};std::copy(std::begin(envelope),std::end(envelope),e.begin());e[0].default_value=.005f;e[1].default_value=.25f;e[2].default_value=0;e[3].default_value=.15f;return e;}();
 static const D filter[]={{20,20000,6000,1,1,"Cutoff","Hz"},{0,1,0,0,1,"Resonance","ratio"},{0,1,1,0,1,"Filter mix","ratio"},{1,12,1,1,1,"Filter drive","gain"}};
 static const D creative[]={{0,1,.35f,0,0,"Mix","ratio"},{-1,1,.45f,0,0,"Envelope depth","ratio"},{0,1,.35f,0,0,"Space","ratio"},{0,1,.45f,0,0,"Shimmer","ratio"},{-12,12,12,0,0,"Pitch","semitones"},{0,1,.6f,0,0,"Tight","ratio"},{0,1,.35f,0,0,"Click","ratio"},{0,1,.5f,0,0,"Body","ratio"},{-24,12,0,0,0,"Output","dB"}};
 static const D lfo[]={{.05f,20,1,1,0,"Rate","Hz"},{0,1,1,0,0,"Intensity","ratio"}};
 if(kind==0){if(id||p>=BS_PARAMETER_COUNT||p==12)return nullptr;const auto*d=bs_parameter_info(p);if(!d||d->mapping==BS_DISCRETE)return nullptr;static const auto all=[](){std::array<D,BS_PARAMETER_COUNT>a{};for(unsigned i=0;i<a.size();++i){const auto*d=bs_parameter_info(i);a[i]={d->minimum,d->maximum,d->default_value,d->mapping,i==0?0u:1u,d->name,d->unit};}return a;}();return &all[p];}
 if(kind==1)return id&&p==0?&unit:nullptr;
 if(kind==2)return id>=1&&id<=4&&p<2?&lfo[p]:nullptr;
 if(kind==3)return id&&p==0?&movement:nullptr;
 if(kind==5)return id&&p<9?&creative[p]:nullptr;
 if(kind!=4)return nullptr;
 if((id==10||id==11)&&p<4)return &filter[p];
 if(id>=40&&id<=42&&p<7)return id==40?&envelope[p]:&modulationEnvelope[p];
 if((id==30||id==31)&&p==0)return &fine;
 if(id==28)return p==0?&unit:p==1?&fine:nullptr;
 if(id==23)return p==0?&width:nullptr;
 if(id==26||id==27){static const D detune{0,50,0,0,0,"Unison detune","cents"};return p==0?&detune:p==1?&unit:nullptr;}
 if(id==24||id==25){static const D bass[]={{.1f,20,1,1,0,"Spin","Hz"},{0,1,.35f,0,0,"Motion","ratio"},{0,1,0,0,0,"Grit","ratio"},{.03125f,64,1,1,0,"Cycle","beats"},{-.8f,.8f,0,0,0,"Curl","ratio"}};return p>=4&&p<=8?&bass[p-4]:nullptr;}
 if(id==21){static const D delay[]={{.01f,2,.25f,1,0,"Time","seconds"},{0,.9f,0,0,0,"Feedback","ratio"},{0,1,0,0,0,"Mix","ratio"},{20,20000,20000,1,0,"Damping","Hz"}};return p>=6&&p<=9?&delay[p-6]:nullptr;}
 if(id==22){static const D reverb[]={{0,.25f,.015f,0,0,"Predelay","seconds"},{.2f,30,2.5f,1,0,"Decay","seconds"},{.5f,2,1,0,0,"Size","ratio"},{0,1,.75f,0,0,"Diffusion","ratio"},{20,2000,120,1,0,"Low cut","Hz"},{200,20000,7000,1,0,"Tone","Hz"},{.05f,2,.3f,1,0,"Movement rate","Hz"},{0,1,.2f,0,0,"Movement","ratio"},{0,1,.35f,0,0,"Shimmer","ratio"},{0,1,.25f,0,0,"Mix","ratio"},{-24,12,0,0,0,"Output","dB"},{-12,12,12,0,0,"Pitch","semitones"},{0,2,1,0,0,"Wet width","ratio"},{0,1,0,0,0,"Ducking","ratio"}};return p>=3&&p<=16?&reverb[p-3]:nullptr;}
 if(id==20){static const std::array<D,51>suite=[](){std::array<D,51>x{};const D floats[]={{0,36,0,0,0,"Drive","dB"},{-1,1,0,0,0,"Tone","ratio"},{-1,1,0,0,0,"Dynamics","ratio"},{0,1,1,0,0,"Mix","ratio"},{-24,12,0,0,0,"Output","dB"},{-60,0,-30,0,0,"Threshold","dB"},{1,20,4,0,0,"Ratio","ratio"},{.1f,100,3,1,0,"Attack","ms"},{10,2000,150,1,0,"Release","ms"},{0,24,6,0,0,"Knee","dB"},{-24,24,0,0,0,"Trim","dB"},{0,1,0,0,0,"Crush","ratio"},{.05f,4,.15f,1,0,"Recovery","seconds"},{0,36,0,0,0,"Crunch","dB"},{0,1,.5f,0,0,"Depth","ratio"},{.25f,4,1,1,0,"Time","ratio"},{0,1,1,0,0,"Upward","ratio"},{0,1,1,0,0,"Downward","ratio"},{0,1,1,0,0,"Colour mix","ratio"}};for(unsigned i=0;i<19;++i)x[8+i]=floats[i];x[29]=x[8];x[30]=x[9];x[31]=x[26];x[32]={60,1000,88.3f,1,0,"Low crossover","Hz"};x[33]={1000,10000,2500,1,0,"High crossover","Hz"};for(unsigned b=0;b<3;++b){x[34+4*b]={-60,0,b==0?-38.9401f:b==1?-34.8204f:-41.6879f,0,0,"Band threshold","dB"};x[35+4*b]={-24,24,0,0,0,"Band gain","dB"};x[36+4*b]=floats[16];x[37+4*b]=floats[17];}for(unsigned i=47;i<=50;++i)x[i]=floats[4];return x;}();return p<suite.size()&&suite[p].name?&suite[p]:nullptr;}
 return nullptr;
}
inline double workspaceModulate(double base,double offset,const bs_modulation_target_descriptor&d){if(offset==0)return base;double value=d.mapping==BS_LOGARITHMIC?base*std::exp(std::log(double(d.maximum)/d.minimum)*offset):base+(d.maximum-d.minimum)*offset;return std::max(double(d.minimum),std::min(double(d.maximum),value));}
inline bool workspaceRoute(const bs_lfo_route_v3&r){return std::isfinite(r.depth)&&r.depth>=-1&&r.depth<=1&&workspaceTarget(r.target_kind,r.target_id,r.parameter_id);}
}
#endif
