#include "../src/harmonics_suite.h"
#include <cstdio>
#include <cstdlib>
#include <vector>
#include <limits>
#include <cstring>
using H=blocks_detail::HarmonicsSuite;
constexpr double pi=3.14159265358979323846, fs=48000;
#define CHECK(x) do{if(!(x)){std::fprintf(stderr,"FAIL %d: %s\n",__LINE__,#x);std::exit(1);}}while(false)
static H make(bs_harmonics_suite_config c){H h;h.prepare(fs);CHECK(h.configure(c,true));return h;}
static double energy(const std::vector<double>&v,unsigned first=0,unsigned last=0){if(!last)last=unsigned(v.size());double e=0;for(unsigned i=first;i<last;++i)e+=v[i]*v[i];return e/std::max(1u,last-first);}
static double crest(const std::vector<double>&v){double p=0;for(double x:v)p=std::max(p,std::abs(x));return p/std::sqrt(energy(v));}
static std::vector<double> render(bs_harmonics_suite_config c,const std::vector<double>&in){auto h=make(c);std::vector<double>out;out.reserve(in.size());for(double x:in){auto y=h.process(x,x*.37,x,x*.37);CHECK(std::isfinite(y.left)&&std::isfinite(y.right));out.push_back(y.left);}return out;}
static std::vector<double> sine(double amplitude,double frequency,unsigned n){std::vector<double>v(n);for(unsigned i=0;i<n;++i)v[i]=amplitude*std::sin(2*pi*frequency*i/fs);return v;}
static double difference(const std::vector<double>&a,const std::vector<double>&b,bool matched=false){double scale=matched?std::sqrt(energy(a)/energy(b)):1,e=0;for(unsigned i=0;i<a.size();++i)e+=std::pow(a[i]-scale*b[i],2);return std::sqrt(e/a.size());}
int main(){
 {auto c=H::defaults();CHECK(sizeof c==204&&sizeof(bs_harmonics_suite_meters)==44&&H::valid(c));auto h=make(c);auto bad=c;bad.drive_db=37;CHECK(!h.configure(bad)&&!std::memcmp(&h.config(),&c,sizeof c));bad=c;bad.comp_attack_ms=NAN;CHECK(!H::valid(bad));bad=c;bad.reserved=1;CHECK(!H::valid(bad));}
 {auto c=H::defaults();c.comp_makeup_db=-24;CHECK(H::valid(c));c.comp_makeup_db=-25;CHECK(!H::valid(c));c.comp_makeup_db=-12;c.enabled=c.comp_enabled=1;c.colour_enabled=0;c.comp_ratio=1;c.comp_auto_makeup=0;auto out=render(c,sine(.2,440,12000));CHECK(std::abs(10*std::log10(energy(out,6000)/energy(sine(.2,440,12000),6000))+12)<.1);}
 std::puts("PASS config validation is atomic, and signed compressor trim supports level matching");
 {auto input=sine(.3,997,10000);auto c=H::defaults();for(int mode=0;mode<4;++mode){c.enabled=mode!=0;c.mix=mode==2?0:1;c.colour_enabled=mode!=3;c.comp_enabled=c.crush_enabled=c.ott_enabled=1;c.comp_ratio=1;c.ott_amount=0;auto out=render(c,input);for(unsigned i=0;i<out.size();++i)CHECK(out[i]==(i<24?0:input[i-24]));}}
 std::puts("PASS fixed24 exact bypass, Mix0 and stage-neutral paths");
 {auto input=sine(.12,130.8128,48000);auto c=H::defaults();c.enabled=1;c.drive_db=18;std::vector<double>styles[5];for(unsigned s=0;s<5;++s){c.colour_style=s;styles[s]=render(c,input);}for(unsigned a=0;a<5;++a)for(unsigned b=a+1;b<5;++b){double d=difference(styles[a],styles[b],true)/std::sqrt(energy(styles[a]));std::printf("style %u/%u matched difference %.3f\n",a,b,d);CHECK(d>.12);}for(unsigned s=0;s<5;++s){c.colour_style=s;c.tone=-1;auto dark=render(c,input);c.tone=1;auto bright=render(c,input);CHECK(difference(dark,bright,true)>.01);}}
 std::puts("PASS five styles and Tone produce distinct matched-level waveforms");
 {auto c=H::defaults();c.enabled=1;c.colour_enabled=0;c.comp_enabled=1;c.comp_threshold_db=-24;c.comp_ratio=8;c.comp_knee_db=0;c.comp_attack_ms=1;c.comp_release_ms=100;auto h=make(c);double l=0,r=0;for(unsigned i=0;i<48000;++i){auto y=h.process(.5,.1,.5,.1);if(i>24000){l+=y.left;r+=y.right;}}double expected=(20*std::log10(.5)+24)*.875;std::printf("Comp reduction %.3f expected %.3f\n",h.meters().comp_reduction_db,expected);CHECK(std::abs(h.meters().comp_reduction_db-expected)<.01);CHECK(std::abs(l/r-5)<1e-10);}
 std::puts("PASS compressor calibrated ratio and stereo link");
 {auto c=H::defaults();c.enabled=1;c.colour_enabled=0;c.crush_enabled=1;c.crush_amount=1;c.crush_recovery=.1;auto h=make(c);for(unsigned i=0;i<48000;++i)h.process(.5,.2,.5,.2);double loaded=h.meters().crush_reduction_db;for(unsigned i=0;i<4800;++i)h.process(.0001,.00004,.0001,.00004);std::printf("Crush loaded %.2f remaining after base recovery %.2f\n",loaded,h.meters().crush_reduction_db);CHECK(loaded>25&&h.meters().crush_reduction_db>loaded*.6);}
 std::puts("PASS Crush gain reduction has load-dependent recovery memory");
 {auto c=H::defaults();c.enabled=1;c.colour_enabled=0;c.ott_enabled=1;c.ott_amount=1;auto quiet=sine(.001,440,96000);auto loud=sine(.4,440,96000);auto q=render(c,quiet),l=render(c,loud);double qg=10*std::log10(energy(q,48000)/energy(quiet,48000)),lg=10*std::log10(energy(l,48000)/energy(loud,48000));std::printf("OTT quiet gain %.2f loud gain %.2f dB\n",qg,lg);CHECK(qg>6&&lg<-1);auto silence=render(c,std::vector<double>(20000));CHECK(energy(silence)==0);}
 std::puts("PASS OTT upward/downward density, bounded silence");
 {auto c=H::defaults();c.enabled=1;c.colour_enabled=0;c.ott_enabled=1;c.ott_amount=.8f;std::vector<double>pluck(48000);for(unsigned i=0;i<pluck.size();++i){double t=i/fs,amp=.1*(1-std::exp(-t/.002))*std::exp(-t/.10),x=0;for(unsigned k=1;k<=12;++k)x+=std::sin(2*pi*130.8128*k*t)/k;pluck[i]=amp*x*.6;}auto out=render(c,pluck);std::printf("OTT pluck crest dry %.3f wet %.3f body ratio %.3f\n",crest(pluck),crest(out),energy(out,4800,14400)/energy(pluck,4800,14400));}
 {auto c=H::defaults();c.enabled=1;auto h=make(c);for(unsigned i=0;i<4096;++i)h.process(.25,.25,.25,.25);c.drive_db=36;h.configure(c);auto first=h.process(.25,.25,.25,.25);CHECK(std::abs(first.left-.25)<.005);for(unsigned i=0;i<24000;++i){auto y=h.process(.25,.25,.25,.25);CHECK(std::isfinite(y.left));}c.enabled=0;h.configure(c);for(unsigned i=0;i<24000;++i)h.process(.25,.25,.25,.25);CHECK(h.process(.25,.25,.25,.25).left==.25);h.reset();CHECK(h.process(0,0,0,0).left==0);}
 std::puts("PASS neutral-to-max activation is smoothed; bypass settles exactly; reset clears state");
 {auto c=H::defaults();float preview[256];CHECK(H::previewColour(c,375,48000,preview,256));double error=0;for(unsigned i=0;i<256;++i)error=std::max(error,std::abs(preview[i]-.25*std::sin(2*pi*i/256)));CHECK(error<.0001);c.drive_db=36;for(unsigned style=0;style<5;++style){c.colour_style=style;CHECK(H::previewColour(c,130.8128f,48000,preview,256));for(float x:preview)CHECK(std::isfinite(x));}CHECK(!H::previewColour(c,10,48000,preview,256));}
 std::puts("PASS deterministic Colour settings preview, aligned reference phase, bounds");
 {auto c=H::defaults();c.enabled=1;c.colour_style=1;c.drive_db=24;
  std::vector<double>in(48000);for(unsigned i=0;i<in.size();++i){double t=i/fs;in[i]=.12*(1-std::exp(-t/.002))*std::exp(-t/.12)*std::sin(2*pi*440*t);}
  c.dynamics=0;auto neutral=render(c,in);c.dynamics=-1;auto tight=render(c,in);c.dynamics=1;auto bloom=render(c,in);
  auto ratio=[](const std::vector<double>&v){return energy(v,480,1920)/energy(v,7200,14400);};
  double tightDb=10*std::log10(ratio(tight)/ratio(neutral)),bloomDb=10*std::log10(ratio(bloom)/ratio(neutral));
  std::printf("Audio Dynamics attack/body relative to neutral: Tight %.2fdB Bloom %.2fdB\n",tightDb,bloomDb);CHECK(tightDb>6&&bloomDb<-6);
  float dry[128],wet[128];CHECK(H::previewDynamics(c,48000,dry,wet,128));for(unsigned i=0;i<128;++i)CHECK(std::isfinite(wet[i]));
 }
 std::puts("PASS audio-only Dynamics remains effective afterhardClip, with opposite attack/body shaping");
 {auto c=H::defaults();c.enabled=1;c.drive_db=12;auto input=sine(.15,130.8128,24000);auto first=render(c,input);c.colour2_enabled=1;c.colour2_style=2;c.colour2_drive_db=18;auto layered=render(c,input);CHECK(difference(first,layered,true)>.03);c.colour2_mix=0;CHECK(render(c,input)==first);c.colour2_enabled=0;c.colour_output_db=-12;auto trimmed=render(c,input);CHECK(std::abs(10*std::log10(energy(trimmed)/energy(first))+12)<.1);}
 std::puts("PASS serial Colour2 changes sound; Mix0 removes itscolour; independent outputtrim");
 {auto c=H::defaults();c.enabled=1;c.colour_enabled=0;c.dynamics=-1;auto loud=sine(.2,440,48000),quiet=loud;for(auto&x:quiet)x*=.1;auto a=render(c,loud),b=render(c,quiet);for(unsigned i=0;i<a.size();++i)CHECK(std::abs(a[i]*.1-b[i])<1e-10);
  c.dynamics=1;auto h=make(c);for(double x:loud)h.process(x,x,x,x);H::Stereo y{};for(unsigned i=0;i<96000;++i)y=h.process(0,0,0,0);CHECK(std::abs(y.left)<1e-12&&std::abs(y.right)<1e-12);}
 std::puts("PASS Dynamics is level-independent above floor and cannot sustain an absent input");
 {auto c=H::defaults();c.enabled=1;c.colour_enabled=0;c.ott_enabled=1;c.ott_amount=0;c.ott_low_hz=60;c.ott_high_hz=10000;auto input=sine(.1,440,24000),out=render(c,input);for(unsigned i=24;i<out.size();++i)CHECK(out[i]==input[i-24]);c.ott_amount=1;c.ott_up=c.ott_down=0;auto baseline=render(c,input);c.bands[1].gain_db=-12;auto changed=render(c,input);CHECK(energy(changed,12000)<energy(baseline,12000)*.5);c.ott_output_db=-12;auto trimmed=render(c,input);CHECK(std::abs(10*std::log10(energy(trimmed,12000)/energy(changed,12000))+12)<.01);}
 std::puts("PASS crossover neutral reconstruction, band gain and OTT output trim are independent");
 {for(double rate:{8000.,44100.,48000.,96000.,192000.})for(unsigned style=0;style<5;++style){auto c=H::defaults();c.enabled=c.comp_enabled=c.crush_enabled=c.ott_enabled=c.colour2_enabled=1;c.colour_style=style;c.colour2_style=(style+1)%5;c.drive_db=36;c.colour2_drive_db=24;c.tone=1;c.colour2_tone=-1;c.crush_amount=1;c.crush_crunch_db=36;c.ott_amount=1;c.dynamics=-1;H h;h.prepare(rate);CHECK(h.configure(c,true));for(unsigned i=0;i<4096;++i){double x=.2*std::sin(2*pi*130*i/rate);auto y=h.process(x,x*.4,x,x*.4);CHECK(std::isfinite(y.left)&&std::isfinite(y.right)&&std::abs(y.left)<1e6);}h.reset();for(unsigned i=0;i<128;++i)CHECK(h.process(0,0,0,0).left==0);}}
 std::puts("PASS five styles and full chain finite at8k–192k; reset removes all residual signal");
 return 0;
}
