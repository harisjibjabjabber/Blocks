"""Writes hifi/contrast-rev32.tsv: WCAG 2.x contrast for rev 3.2 text pairings in hybrid themes C (dark) and D (light)."""
import os,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from kit import THEMES
def L(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=[x/12.92 if x<=0.03928 else ((x+0.055)/1.055)**2.4 for x in c]; return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def cr(a,b): a,b=L(a),L(b); return (max(a,b)+0.05)/(min(a,b)+0.05)
rows=[]
for t in 'CD':
    T=THEMES[t]
    for fg in ('text','mute','dim','acc'):
        for bg in ('well','surf','surf2','bg'): rows.append((t,fg,bg,round(cr(T[fg],T[bg]),2)))
    rows.append((t,'bg-on-text(BackToLive)','text',round(cr(T['bg'],T['text']),2)))
    rows.append((t,'accT-on-acc(active handle)','acc',round(cr(T['accT'],T['acc']),2)))
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','contrast-rev32.tsv')
with open(out,'w') as f:
    f.write('theme\tfg\tbg\tratio\tAA_normal\n')
    for r in rows: f.write(f'{r[0]}\t{r[1]}\t{r[2]}\t{r[3]}\t{"pass" if r[3]>=4.5 else "fail"}\n')
print('fails:',[r for r in rows if r[3]<4.5])
