# Direction B — 'Paper Score': light editorial, score-like staves, ink + one vermilion accent. PROPOSED.
from kit import *
import music
T=T_('B'); W,H=390,844
ROMAN=['I','II','III','IV']
def status():
    return f'''<div class="ab mono" style="left:28px;top:16px;font-size:14px;font-weight:600">9:41</div>
<div class="ab" style="right:26px;top:18px;display:flex;gap:6px;align-items:center"><div style="display:flex;gap:2px;align-items:flex-end">{''.join(f'<div style="width:3px;height:{h}px;background:{T["text"]};border-radius:1px"></div>' for h in (4,6,8,11))}</div>
<div style="width:25px;height:12px;border:1.5px solid {T['text']};border-radius:4px;padding:1.5px"><div style="width:70%;height:100%;background:{T['text']};border-radius:1px"></div></div></div>'''
def head(title,sub,right):
    return f'''<div class="ab" style="left:22px;top:50px;right:22px;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid {T['text']};padding-bottom:10px">
<div><div class="disp" style="font-size:42px;line-height:1;letter-spacing:-.01em">{E(title)}</div><div class="disp" style="font-size:17px;font-style:italic;color:{T['mute']};margin-top:4px">{sub}</div></div>
<div style="text-align:right">{right}</div></div>'''
def stave(y,h,i,name,sound,content,state,bars=4,label_right=''):
    lines=''.join(f'<div class="ab" style="left:52px;right:0;top:{h*(k+1)/6:.1f}px;height:1px;background:{T["line"]}"></div>' for k in range(5))
    bl=''.join(f'<div class="ab" style="left:{52+(306)*b/bars:.1f}px;top:{h/6:.1f}px;width:1px;height:{h*4/6:.1f}px;background:{T["dim"]}"></div>' for b in range(bars+1))
    stc={'loop':T['text'],'target':T['acc'],'queued':T['acc'],'empty':T['dim']}[state]
    mark={'loop':'','target':'<span style="color:%s">●</span> '%T['acc'],'queued':'◔ ','empty':''}[state]
    return f'''<div class="ab" style="left:16px;top:{y}px;width:358px;height:{h}px">
<div class="ab disp" style="left:0;top:{h/2-16:.0f}px;width:40px;text-align:center;font-size:26px;color:{stc}">{ROMAN[i]}</div>
{lines}{bl}{content}
<div class="ab" style="left:58px;top:-2px;font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:{stc};background:{T['bg']};padding-right:6px">{mark}{E(name)} <span style="font-weight:400;letter-spacing:.02em;text-transform:none;color:{T['mute']}">· {E(sound)}</span></div>
<div class="ab mono" style="right:0;top:-2px;font-size:10px;color:{stc};background:{T['bg']};padding-left:6px">{label_right}</div></div>'''
def disc(sub,y=708):
    return f'''<div class="ab disp" style="left:0;right:0;top:{y-34}px;text-align:center;font-size:15px;font-style:italic;color:{T['mute']}">{sub}</div>
<div class="ab" style="left:24px;top:{y+18}px;width:64px;height:64px;border-radius:50%;border:1px solid {T['text']};display:flex;align-items:center;justify-content:center;font-size:20px" aria-label="Undo">↶</div>
<div class="ab" style="left:147px;top:{y}px;width:96px;height:96px;border-radius:50%;background:{T['text']};display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px -10px rgba(23,21,15,.55)">{capglyph(60,T['bg'],T['acc'],3.2)}</div>
<div class="ab" style="left:302px;top:{y+18}px;width:64px;height:64px;border-radius:50%;border:1px solid {T['text']};display:flex;align-items:center;justify-content:center;font-size:18px" aria-label="Stop (optional)">■</div>
<div class="ab" style="left:0;right:0;top:{y+104}px;text-align:center;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase">Capture</div>
<div class="ab" style="left:130px;top:832px;width:130px;height:4px;border-radius:2px;background:{T['text']};opacity:.6"></div>'''
def piano_c(h,op=1,ph=None): 
    o=notes_html(music.piano(),56,h*0.12,300,h*0.76,16,50,74,T['lay'][0],minh=2.5,maxh=4,op=op,radius=2)
    return o+(f'<div class="ab" style="left:{56+300*ph:.0f}px;top:0;width:2px;height:{h}px;background:{T["acc"]}"></div>' if ph is not None else '')
def bass_c(h,ph=None,notes=None,ghost=False):
    o=notes_html(notes or music.bass(),56,h*0.14,300,h*0.72,16,34,54,T['lay'][1],minh=4,maxh=5,radius=3,ghost=ghost)
    return o+(f'<div class="ab" style="left:{56+300*ph:.0f}px;top:0;width:2px;height:{h}px;background:{T["acc"]}"></div>' if ph is not None else '')
def heroB():  # bass over looping piano
    live=[n for n in music.bass() if n[0]<12.9]
    right=f'<div class="mono" style="font-size:11px;color:{T["mute"]}">BAR</div><div class="disp" style="font-size:34px;line-height:1">3<span style="font-size:20px">.4</span></div>'
    b=status()+head('Sketch 14','92 bpm · 4/4 · Keystation 61 receiving',right)
    b+=f'<div class="ab" style="left:22px;top:150px;font-size:11px;color:{T["mute"]};display:flex;gap:14px" class="mono"><span>◷ 1:12 kept</span><span>always listening</span><span style="color:{T["text"]}">design / example data</span></div>'
    chords=''.join(f'<div class="ab disp" style="left:{16+56+75*i}px;top:176px;font-size:19px;font-style:italic">{c}</div>' for i,c in enumerate(music.CHORDS))
    b+=chords
    b+=stave(210,96,0,'Piano','Warm EP',piano_c(96,ph=0.80),'loop',label_right='LOOP · 4 BARS')
    b+=stave(330,96,1,'Bass','now playing → next capture',bass_c(96,ph=0.80,notes=live),'target',label_right='LAST 4 BARS')
    b+=stave(450,60,2,'Empty','capture fills next','', 'empty')
    b+=stave(530,60,3,'Empty','after III','', 'empty')
    b+=f'<div class="ab" style="left:22px;right:22px;top:612px;height:1px;background:{T["text"]}"></div>'
    b+=f'<div class="ab" style="left:22px;right:22px;top:626px;display:flex;justify-content:space-between;align-items:flex-start;font-size:12.5px"><span style="width:48px;height:48px;margin-top:-14px;display:flex;align-items:center;justify-content:center;font-size:18px">‹</span><span><b>Bass</b> <span style="color:{T["mute"]}">(placeholder) — sound for II</span></span><span style="width:48px;height:48px;margin-top:-14px;display:flex;align-items:center;justify-content:center;font-size:18px">›</span></div>'
    b+=disc('the last four bars, in time, to II',y=696)
    return frame('B',W,H,b)
def proposalB():
    right=f'<div class="mono" style="font-size:11px;color:{T["mute"]}">BAR</div><div class="disp" style="font-size:34px;line-height:1">1<span style="font-size:20px">.3</span></div>'
    b=status()+head('Sketch 14','captured just now · looping',right)
    b+=''.join(f'<div class="ab disp" style="left:{16+56+75*i}px;top:156px;font-size:19px;font-style:italic">{c}</div>' for i,c in enumerate(music.CHORDS))
    b+=stave(190,110,0,'Piano','Warm EP',piano_c(110,ph=0.08),'loop',label_right='LOOP · 4 BARS')
    opt=lambda t,s,on: f'<div style="flex:1;height:56px;border-radius:4px;border:1px solid {T["text"] if on else T["line"]};background:{T["text"] if on else T["surf"]};color:{T["bg"] if on else T["text"]};display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="disp" style="font-size:22px;line-height:1">{t}</span><span style="font-size:10px;margin-top:3px;opacity:.75">{s}</span></div>'
    b+=f'''<div class="ab" style="left:22px;right:22px;top:330px">
<div class="disp" style="font-size:30px;line-height:1.05">Four bars, at ninety-two.</div>
<div style="font-size:13px;color:{T['mute']};margin-top:8px;line-height:1.45">4/4 inferred. Looping now, already kept — your playing is untouched; only the grid moves.</div>
<div style="font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;margin:18px 0 8px">Tempo</div>
<div style="display:flex;gap:6px">{opt('92','as played',1)}{opt('½','46',0)}{opt('×2','184',0)}{opt('Set','bpm / tap',0)}</div>
<div style="font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;margin:16px 0 8px">Loop · beat one</div>
<div style="display:flex;gap:6px">{opt('2','bars',0)}{opt('4','bars',1)}{opt('8','bars',0)}{opt('‹','earlier',0)}{opt('›','later',0)}</div>
<div style="display:flex;justify-content:space-between;margin-top:14px;font-size:13px"><span style="text-decoration:underline;text-underline-offset:3px">Discard</span><span style="color:{T['mute']}">II is next · Undo any time</span></div></div>'''
    b+=disc('keep playing — the next capture goes to II',y=696)
    return frame('B',W,H,b)
