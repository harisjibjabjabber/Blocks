#include "oscillator_source.h"
#include <cstdio>
#include <cstdlib>
#include <new>
#include <cmath>
static unsigned allocations=0;
void*operator new(std::size_t n){++allocations;if(auto*p=std::malloc(n))return p;throw std::bad_alloc();}
void operator delete(void*p)noexcept{std::free(p);}
void operator delete(void*p,std::size_t)noexcept{std::free(p);}
int main(){using oscillator_spike::OscillatorSource;
 for(unsigned mode=0;mode<3;++mode)for(unsigned wave=0;wave<4;++wave){OscillatorSource a,b;a.prepare(48000,mode);b.prepare(48000,mode);unsigned before=allocations;double peak=0;for(unsigned block=0;block<400;++block)for(unsigned i=0;i<127;++i){unsigned frame=block*127+i;double hz=32.703*std::exp2(7.*frame/50800),pw=.5+.4*std::sin(frame*.001);double x=a.sample(wave,hz,pw),y=b.sample(wave,hz,pw);if(x!=y||!std::isfinite(x))return 1;peak=std::max(peak,std::abs(x));}if(allocations!=before||peak<.1||peak>2)return 2;a.reset();b.reset();for(unsigned i=0;i<2048;++i)if(a.sample(wave,440)!=b.sample(wave,440))return 3;}
 for(unsigned wave=0;wave<2;++wave){OscillatorSource a,b,c;a.prepare(48000,0);b.prepare(48000,1);c.prepare(48000,2);for(unsigned i=0;i<10000;++i){double x=a.sample(wave,440);if(x!=b.sample(wave,440)||x!=c.sample(wave,440))return 4;}}
 std::puts("PASS deterministic/reset source sweeps, finite bounded output, zero sample allocations, unchanged sine/triangle controls");}
