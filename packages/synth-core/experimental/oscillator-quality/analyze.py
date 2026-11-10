import json,math,hashlib,sys
from pathlib import Path
import numpy as np
from scipy.signal import firwin,resample_poly
import soundfile as sf
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent/'out'
rows=[json.loads(x)for x in (root/'static.jsonl').read_text().splitlines()]
raw=np.memmap(root/'static.f32',dtype='<f4',mode='r').reshape(len(rows),65536)
def db(x):return float(10*np.log10(max(float(x),1e-30)))
metrics=[]
for row,x in zip(rows,raw):
 n=len(x);k=row['bin'];wave=row['wave'];pw=row['pw'];spec=np.fft.rfft(x)/n
 spec*=np.exp(2j*np.pi*np.arange(len(spec))*row['latency']/n)
 h=np.arange(1,(n//2-1)//k+1);bins=h*k
 if wave==0:c=np.zeros(len(h),complex);c[0]=-.5j
 elif wave==1:c=np.where(h%2,4/(np.pi**2*h*h),0).astype(complex)
 elif wave==2:c=1j/(np.pi*h)
 else:c=1j/(np.pi*h)*(np.exp(-2j*np.pi*h*pw)-1)
 c*=np.exp(2j*np.pi*h*row['warm']*k/n)
 active=np.abs(c)>1e-14
 mask=np.zeros(len(spec),bool);mask[bins[active]]=True
 audible=np.arange(len(spec))*48000/n<=20000;audible[0]=False
 desired=active&(bins*48000/n<=20000)
 power=np.sum(np.abs(spec[mask&audible])**2)
 refPower=np.sum(np.abs(c[desired])**2)
 harmonicError=np.sum((np.abs(spec[bins[desired]])-np.abs(c[desired]))**2)
 complexError=np.sum(np.abs(spec[bins[desired]]-c[desired])**2)+np.sum(np.abs(spec[audible&~mask])**2)
 high=desired&(bins*48000/n>=8000)
 metrics.append({**row,'alias_dBc_20k':db(np.sum(np.abs(spec[audible&~mask])**2)/max(power,1e-30)),'wanted_harmonic_error_dB':db(harmonicError/max(refPower,1e-30)),'total_complex_error_dB':db(complexError/max(refPower,1e-30)),'fundamental_error_dB':float(20*np.log10(abs(spec[k])/abs(c[0]))),'wanted_8k_20k_power_ratio_dB':db(np.sum(abs(spec[bins[high]])**2)/np.sum(abs(c[high])**2))if np.any(high)else None,'dc_error':float(spec[0].real-(2*pw-1 if wave==3 else 0))})
summary=[]
for wave in [2,3,0,1]:
 for mode in range(3):
  group=[r for r in metrics if r['wave']==wave and r['mode']==mode]
  summary.append({'wave':wave,'mode':mode,'count':len(group),'alias_median_dBc':float(np.median([r['alias_dBc_20k']for r in group])),'alias_worst_dBc':max(r['alias_dBc_20k']for r in group),'wanted_error_median_dB':float(np.median([r['wanted_harmonic_error_dB']for r in group])),'total_error_median_dB':float(np.median([r['total_complex_error_dB']for r in group])),'fundamental_error_min_dB':min(r['fundamental_error_dB']for r in group),'wanted_highband_worst_dB':min((r['wanted_8k_20k_power_ratio_dB']for r in group if r['wanted_8k_20k_power_ratio_dB']is not None),default=None)})
print(json.dumps(summary,indent=2),flush=True)
(root/'static-metrics.json').write_text(json.dumps({'method':'65536 coherent samples at48k; nearest odd FFT bin to each MIDI pitch, actualHz recorded. Delay7 samples phase-compensated. Alias excludes ALL desired harmonic bins; energy folding onto desired bins remains in harmonic error. Metrics0..20k, DC excluded. Exact Fourier coefficient reference, no level normalization.','summary':summary,'cases':metrics},indent=2))
frames=144000;t=np.arange(frames)/48000
scenarios=[(65.406391325*2**(6*t/3),np.full(frames,.5),2),(np.full(frames,440),.5+.4*np.sin(2*np.pi*7*t),3),(440*2**(50/1200*np.sin(2*np.pi*6*t)),np.full(frames,.5),2),(1760*2**(.5*np.sin(2*np.pi*31*t)),.5+.4*np.sin(2*np.pi*53*t),3)]
def reference(hz,pw,wave,factor):
 step=np.repeat(hz,factor)/(48000*factor);phase=np.remainder(np.concatenate(([0],np.cumsum(step[:-1]))),1)
 y=2*phase-1 if wave==2 else np.where(phase<np.repeat(pw,factor),1.,-1.)
 taps=firwin(128*factor+1,1/factor,window=('kaiser',12.))
 return resample_poly(y,1,factor,window=taps)[:frames]
def band_power(y):
 y=y[512:frames-512];spec=np.fft.rfft(y);f=np.fft.rfftfreq(len(y),1/48000);weights=np.full(len(spec),2.);weights[0]=1;weights[-1]=1
 return float(np.sum((abs(spec)**2*weights)[f<=20000])/len(y)**2)
dynamic=[]
for scenario,(hz,pw,wave)in enumerate(scenarios):
 r16=reference(hz,pw,wave,16);r32=reference(hz,pw,wave,32);sl=slice(512,frames-512);den=np.mean(r32[sl]**2);conv=db(np.mean((r16[sl]-r32[sl])**2)/den)
 aud=[]
 for mode in range(3):
  x=np.fromfile(root/f'dynamic-{scenario}-{mode}.f32',dtype='<f4');latency=7 if mode==1 else 0;x=np.roll(x,-latency);err=db(np.mean((x[sl]-r32[sl])**2)/den)
  dynamic.append({'scenario':scenario,'mode':mode,'aligned_error_vs32x_dB':err,'reference16_vs32_convergence_dB':conv,'latency_samples':latency,'peak':float(np.max(np.abs(x))),'error_0_20k_dB':db(band_power(x-r32)/band_power(r32)),'reference16_vs32_0_20k_dB':db(band_power(r16-r32)/band_power(r32))})
  fade=np.minimum(1,np.arange(len(x))/480)*np.minimum(1,np.arange(len(x))[::-1]/480)
  sf.write(root/f'audition-{scenario}-{mode}.wav',x*.2*fade,48000,subtype='PCM_24')
  aud.extend([x*.2*fade,np.zeros(12000)])
 sf.write(root/f'audition-{scenario}-ABC.wav',np.concatenate(aud),48000,subtype='PCM_24')
 print('dynamic',scenario,[r for r in dynamic if r['scenario']==scenario],flush=True)
(root/'dynamic-metrics.json').write_text(json.dumps({'method':'Source only;48k input controls held constant within each output sample for matched comparison.16x/32x naive analytic source followed by128*factor+1 Kaiser12 FIR decimation. Convergence is reported, not treated as exact reference. Discard512 endpoint samples; oversampledcandidate aligned7samples. Error includes intended spectrum/phase/PWM discrepancies, NOT pure alias-only metric. Fixedgain .2 WAVs,10ms endpoint fades,no per-file normalization. ABC=baseline/2x/table.','cases':dynamic},indent=2))
files=list(Path(__file__).resolve().parent.glob('*.h'))+list(Path(__file__).resolve().parent.glob('*.cpp'))+list(Path(__file__).resolve().parent.glob('*.py'))+[root/'table_bank.h',root/'render.wasm']
(root/'source-manifest.json').write_text(json.dumps({str(p.name):hashlib.sha256(p.read_bytes()).hexdigest()for p in files},indent=2))
