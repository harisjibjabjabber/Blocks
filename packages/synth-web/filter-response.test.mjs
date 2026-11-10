import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterResponse} from './filter-response.js';

const close=(a,b,tolerance=1e-9)=>assert(Math.abs(a-b)<tolerance,`${a} != ${b}`);
// DFT of an independently stepped TPT state-variable impulse response.
function impulseResponse({frequency,cutoff,resonance,sampleRate,mix}){
  const g=Math.tan(Math.PI*Math.min(cutoff,sampleRate*.45)/sampleRate),q=Math.SQRT1_2*Math.exp(Math.log(8/Math.SQRT1_2)*resonance),k=1/q;
  const a1=1/(1+g*(g+k)),a2=g*a1,a3=g*a2;
  let s1=0,s2=0,real=0,imag=0;
  for(let n=0;n<32768;n++){
    const input=n===0?1:0,v3=input-s2,v1=a1*s1+a2*v3,v2=s2+a2*s1+a3*v3;
    s1=2*v1-s1;s2=2*v2-s2;
    const out=input*(1-mix)+v2*mix,phase=2*Math.PI*frequency*n/sampleRate;
    real+=out*Math.cos(phase);imag-=out*Math.sin(phase);
  }
  return{real,imag};
}

test('both filters have unity DC and dry mix is flat at every frequency',()=>{
  for(const mode of[0,1])for(const resonance of[0,.5,1]){
    close(filterResponse({frequency:0,cutoff:1800,mode,resonance}).magnitude,1);
    for(const frequency of[20,1000,12000,20000])close(filterResponse({frequency,cutoff:1800,mode,resonance,mix:0}).db,0);
  }
});
test('Soft response retains its original recurrence and ignores stored resonance',()=>{
  for(const frequency of[30,2000,18000]){
    const a=filterResponse({frequency,cutoff:2000,mode:0,resonance:0}),b=filterResponse({frequency,cutoff:2000,mode:0,resonance:1});
    assert.deepEqual(a,b);
    const alpha=1-Math.exp(-2*Math.PI*2000/48000),pole=1-alpha;
    close(a.magnitude,alpha/Math.sqrt(1+pole*pole-2*pole*Math.cos(2*Math.PI*frequency/48000)));
  }
});
test('resonant response agrees with sampled TPT impulse, including complex dry mix',()=>{
  for(const sampleRate of[44100,48000,96000])for(const resonance of[0,.55,1])for(const mix of[.35,1])for(const frequency of[100,1800,8000]){
    const args={frequency,cutoff:1800,resonance,sampleRate,mix},actual=filterResponse({...args,mode:1}),expected=impulseResponse(args);
    close(actual.real,expected.real,1e-8);close(actual.imag,expected.imag,1e-8);
  }
});
test('cutoff resonance gain follows Q and is not clipped at zero dB',()=>{
  close(filterResponse({frequency:2000,cutoff:2000,mode:1,resonance:0}).magnitude,Math.SQRT1_2);
  close(filterResponse({frequency:2000,cutoff:2000,mode:1,resonance:1}).magnitude,8);
  assert(filterResponse({frequency:2000,cutoff:2000,mode:1,resonance:1}).db>18);
});
test('frequency and cutoff bounds remain finite close to Nyquist',()=>{
  for(const sampleRate of[8000,44100,48000,192000])for(const frequency of[0,20,sampleRate/2,20000])for(const cutoff of[20,20000])for(const mode of[0,1]){
    const out=filterResponse({frequency,cutoff,mode,resonance:1,sampleRate});assert(Number.isFinite(out.db));assert(Number.isFinite(out.real));assert(Number.isFinite(out.imag));
  }
});
