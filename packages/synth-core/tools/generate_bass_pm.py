"""Original Bessel-series expansion of integer-ratio phase modulation.
Generate Fourier sine coefficients for sin(c*phase + beta*sin(r*phase)).
Negative-frequency terms fold with sign; DC/fundamental are omitted so the
separately rendered oscillator foundation stays invariant. No external DSP code.
"""
from pathlib import Path
import math

def bessel(k,x):
    n=abs(k)
    value=sum((-1)**m*(x/2)**(2*m+n)/(math.factorial(m)*math.factorial(m+n)) for m in range(40))
    return value*((-1)**n if k<0 else 1)

banks=[]
for carrier,ratio in [(3,2),(5,3)]:
    rows=[]
    for depth in range(33):
        harmonics=[0.]*33
        for k in range(-24,25):
            harmonic=carrier+k*ratio
            if 2<=abs(harmonic)<=32:
                harmonics[abs(harmonic)]+=bessel(k,depth/8)*(1 if harmonic>0 else -1)
        rows.append('{'+','.join(f'{v:.10e}f' for v in harmonics)+'}')
    banks.append('{'+',\n'.join(rows)+'}')
target=Path(__file__).resolve().parents[1]/'src/bass_pm_tables.h'
target.write_text('// Original Fourier coefficients of sin(c*phase + index*sin(r*phase)).\n// Integer ratios, negative frequencies folded, fundamental excluded.\n#ifndef BLOCKS_BASS_PM_TABLES_H\n#define BLOCKS_BASS_PM_TABLES_H\nnamespace blocks_detail { inline constexpr float bassPM[2][33][33]={'+',\n'.join(banks)+'}; }\n#endif\n',encoding='utf-8')
print(target)
