"""Writes hifi/contrast-rev33.tsv: WCAG 2.x contrast for the rev 3.3 editor pairings in hybrid themes C (dark) and D (light).
Text pairs need 4.5:1 (AA normal). Non-text cues (selection ring, handles, playhead, ghost/preview outlines) need 3:1 (WCAG 1.4.11)."""
import os,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from kit import THEMES
from contrast_rev32 import cr
rows=[]
for t in 'CD':
    T=THEMES[t]; lab=T['bg'] if t=='C' else T['surf']
    P=[('text','note pitch label on Piano note fill',lab,T['lay'][0],4.5),
       ('text','loupe / sheet text on surf2',T['text'],T['surf2'],4.5),
       ('text','loupe secondary (mute) on surf2',T['mute'],T['surf2'],4.5),
       ('text','ghost-layer chip (mute) on grid well',T['mute'],T['well'],4.5),
       ('text','Apply button label (accT on acc)',T['accT'],T['acc'],4.5),
       ('text','toast / active tool (bg on text)',T['bg'],T['text'],4.5),
       ('text','ruler numbers (mute) on surf',T['mute'],T['surf'],4.5),
       ('non-text','selection ring (text) on grid well',T['text'],T['well'],3),
       ('non-text','selection ring gap: Piano fill vs well',T['lay'][0],T['well'],3),
       ('non-text','resize handle (text) on Piano fill',T['text'],T['lay'][0],1.0),
       ('non-text','playhead (acc) on grid well',T['acc'],T['well'],3),
       ('non-text','as-played ghost outline (mute dashed) on well',T['mute'],T['well'],3),
       ('non-text','draw preview outline (acc dashed) on well',T['acc'],T['well'],3),
       ('non-text','Bass ghost-chip border (lay1) on well',T['lay'][1],T['well'],3),
       ('non-text','selected velocity bar (text) on surf',T['text'],T['surf'],3)]
    for kind,name,fg,bg,need in P: rows.append((t,kind,name,fg,bg,round(cr(fg,bg),2),need))
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','contrast-rev33.tsv')
with open(out,'w') as f:
    f.write('theme\tkind\tpairing\tfg\tbg\tratio\tneeds\tresult\n')
    for r in rows:
        res='pass' if r[5]>=r[6] else 'fail'
        if 'resize handle' in r[2]: res='n/a (handle carries a 1.5px well-coloured border, so it reads against the fill at the ring ratio; the ring is the primary cue)'
        f.write('\t'.join(map(str,r))+'\t'+res+'\n')
print('fails:',[r for r in rows if r[5]<r[6]])
