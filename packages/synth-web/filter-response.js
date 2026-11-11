// Baseline small-signal response, excluding per-note envelopes and LFO modulation.
// Mode2 is the normalized linearization of the nonlinear Ladder topology. It
// intentionally excludes drive-dependent distortion and the oversampling FIRs.
// Mix combines complex responses: mixing magnitudes would conceal phase cancellation.
export function filterResponse({frequency,cutoff,resonance=0,mode=0,mix=1,sampleRate=48000}) {
  const rate=Math.max(8000,Number(sampleRate)||48000);
  const f=Math.max(0,Math.min(rate*.499999,frequency));
  const fc=Math.max(20,Math.min(20000,rate*.45,cutoff));
  const wet=Math.max(0,Math.min(1,mix));
  let real,imag;
  if(mode===2){
    // Four trapezoidal one-pole stages at the native Ladder's8x internal rate.
    // H=(1+k)*P^4/(1+k*P^4), P=1/(1+j*tan(w/2)/g), k=3.8*resonance.
    const u=Math.tan(Math.PI*f/(8*rate))/Math.tan(Math.PI*fc/(8*rate));
    const a=1/(1+u*u),b=-u*a,squareRe=a*a-b*b,squareIm=2*a*b;
    const pRe=squareRe*squareRe-squareIm*squareIm,pIm=2*squareRe*squareIm;
    const k=3.8*Math.max(0,Math.min(1,resonance)),denRe=1+k*pRe,denIm=k*pIm,den=denRe*denRe+denIm*denIm;
    real=(1+k)*(pRe*denRe+pIm*denIm)/den;imag=(1+k)*(pIm*denRe-pRe*denIm)/den;
  }else if(mode===1){
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
