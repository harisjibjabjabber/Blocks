"""Original Fourier sums and scipy FIR design; no third-party DSP source copied."""
from pathlib import Path
import numpy as np
import sys
from scipy.signal import firwin
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent/'out'
root.mkdir(parents=True,exist_ok=True)
limits=[1,2,3,4,5,6,8,10,13,17,22,28,36,46,59,76,98,126,162,208,267,343,440,565,725,931]
size=4096
rows=[]
for limit in limits:
 spectrum=np.zeros(size//2+1,complex)
 k=np.arange(1,limit+1)
 spectrum[k]=1j*size/(np.pi*k)
 rows.append(np.fft.irfft(spectrum))
def number(x):
 s=format(float(x),'.9g')
 return s if '.' in s or 'e' in s else s+'.0'
text='#pragma once\nnamespace oscillator_spike {\ninline constexpr unsigned tableSize=4096,tableCount=26;\n'
text+='inline constexpr unsigned limits[26]={'+','.join(map(str,limits))+'};\n'
text+='inline constexpr float sawBank[26][4096]={\n'+',\n'.join('{'+','.join(number(v)+'f' for v in row)+'}' for row in rows)+'};\n'
taps=firwin(31,.5,window=('kaiser',8.6),scale=True)
text+='inline constexpr double halfband[31]={'+','.join(format(v,'.17g') for v in taps)+'};\n}\n'
(root/'table_bank.h').write_text(text)
print('Generated',root/'table_bank.h')
