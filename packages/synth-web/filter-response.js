// Baseline small-signal response, excluding per-note envelopes and LFO modulation.
// Mix combines complex responses: mixing magnitudes would conceal phase cancellation.
export function filterResponse({frequency,cutoff,resonance=0,mode=0,mix=1,sampleRate=48000}) {
  const rate=Math.max(8000,Number(sampleRate)||48000);
  const f=Math.max(0,Math.min(rate*.499999,frequency));
  const fc=Math.max(20,Math.min(20000,rate*.45,cutoff));
  const wet=Math.max(0,Math.min(1,mix));
  let real,imag;
  if(mode===1){
    const q=Math.SQRT1_2*Math.exp(Math.log(8/Math.SQRT1_2)*Math.max(0,Math.min(1,resonance)));
    const u=Math.tan(Math.PI*f/rate)/Math.tan(Math.PI*fc/rate);
    const re=1-u*u,im=u/q,den=re*re+im*im;
    real=re/den;imag=-im/den;
  }else{
    const alpha=1-Math.exp(-2*Math.PI*fc/rate),a=1-alpha,w=2*Math.PI*f/rate;
    const re=1-a*Math.cos(w),im=a*Math.sin(w),den=re*re+im*im;
    real=alpha*re/den;imag=-alpha*im/den;
  }
  real=1-wet+wet*real;imag*=wet;
  const magnitude=Math.hypot(real,imag);
  return{real,imag,magnitude,db:20*Math.log10(Math.max(1e-12,magnitude))};
}
