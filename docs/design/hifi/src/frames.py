from phoneA import *
P=music.piano(); B=music.bass()
EMPTY=[dict(name='Empty',sound=''),dict(name='Empty'),dict(name='Empty'),dict(name='Empty')]
def lay(*ls):
    out=[]
    for i in range(4): out.append(ls[i] if i<len(ls) and ls[i] else dict(name='Empty',sound='',state='empty'))
    return out
PIANO=dict(kind='piano',name='Piano',sound='Warm EP',state='loop',ltxt='4 bars')
BASS=dict(kind='bass',name='Bass',sound='Bass (placeholder)',state='loop',ltxt='4 bars')
DRUMS=dict(kind='drums',name='Drums',sound='Kit (placeholder)',state='loop',ltxt='4 bars')
def f1():  # free play
    return dict(title='Sketch 14',tempo=None,tempo_note='free play',hist='1:12',
      ribbon=dict(kind='free',title='Now playing · Layer 1',right='always listening',
        chords=[(0.02,'Dm9'),(0.26,'G13'),(0.50,'Cmaj9'),(0.74,'A7♭9')],
        layers=[dict(notes=P,beats=16.6,lo=50,hi=74,col=T_('A')['lay'][0],maxh=9)],bracket=(0.0,0.98,'last phrase · 10.4 s')),
      layers=lay(dict(name='Layer 1 · next capture',sound='Warm EP',state='target')),
      capture=dict(sub='keep the last phrase → Layer 1'),tp='▷')
FR={'01-free-play':f1}
TA=T_('A'); CUR=['A']
def set_theme(t):
    global TA
    TA=T_(t); CUR[0]=t
    import large; large.TA=TA
def seg(opts,sel,T=None,h=44,fs=13):
    T=T or TA
    o=[f'<div style="display:flex;gap:6px">']
    for i,op in enumerate(opts):
        on=i==sel
        o.append(f'<div style="flex:1;height:{h}px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:{fs}px;font-weight:600;'
                 f'background:{T["text"] if on else T["surf2"]};color:{T["bg"] if on else T["text"]};border:1px solid {T["text"] if on else T["line"]};line-height:1.15">{op}</div>')
    o.append('</div>'); return ''.join(o)
def card(top,h,inner,T=None,left=16,w=358):
    T=T or TA
    return f'<div class="ab" style="left:{left}px;top:{top}px;width:{w}px;height:{h}px;border-radius:22px;background:{T["surf2"]};border:1px solid {T["line"]};box-shadow:0 -10px 40px rgba(0,0,0,.55);padding:16px 16px 14px">{inner}</div>'
def small(t,T=None): return f'<span style="display:block;font-size:10px;font-weight:500;opacity:.7">{t}</span>'

def f2():
    inner=f'''<div style="display:flex;justify-content:space-between;align-items:flex-start">
<div>{('<div class="disp" style="font-size:25px;line-height:1">Four bars, at ninety-two.</div>') if TA.get('hy') else '<div style="font-size:17px;font-weight:650">Captured · 4 bars, looping</div>'}<div class="mute" style="font-size:12px;margin-top:3px">92 BPM · 4/4 inferred · your timing unchanged</div></div>
<div class="btn" style="height:40px;min-width:0;padding:0 12px;font-size:12.5px;background:transparent">Discard</div></div>
<div class="lbl" style="margin:12px 0 6px">Tempo</div>{seg(['92 ✓'+small('as played'),'½'+small('46'),'×2'+small('184'),'Set…'+small('BPM / tap')],0)}
<div class="lbl" style="margin:12px 0 6px">Loop length · beat one</div>
<div style="display:flex;gap:6px"><div style="flex:1">{seg(['2 bars','4 bars ✓','8 bars'],1,h=44)}</div><div class="btn" style="width:48px;height:44px" aria-label="beat one earlier">‹</div><div class="btn" style="width:48px;height:44px" aria-label="beat one later">›</div></div>'''
    return dict(title='Sketch 14',tempo='92',hist='1:12',chip3=f'<span class="chip" style="color:{TA["text"]}">▶ 1.3 / 4</span>',ph=0.08,
      ribbon=dict(kind='grid',title='Layer 1 · Piano · looping',right='grid-aligned',chords=music.CHORDS,
        layers=[dict(notes=P,beats=16,lo=50,hi=74,col=TA['lay'][0])],playhead=0.08),
      layers=lay(PIANO,dict(name='Layer 2 · next capture',sound='Warm EP',state='target')),
      card=inner,card_h=206,sound='Warm EP',tgt='Layer 2',capture=dict(sub='keep playing — next capture → Layer 2'),tp='■',tp_label='Stop (optional)')

def f3():
    rn,tot=music.rubato()
    inner=f'''<div style="display:flex;gap:12px;align-items:flex-start"><div style="width:40px;height:40px;border-radius:12px;background:{TA['surf']};border:1px solid {TA['line']};display:flex;align-items:center;justify-content:center;font-size:18px">∿</div>
<div>{('<div class="disp" style="font-size:25px;line-height:1">No steady pulse.</div>') if TA.get('hy') else '<div style="font-size:17px;font-weight:650">No steady pulse found</div>'}<div class="mute" style="font-size:12px;margin-top:3px;line-height:1.4">This phrase is rubato. It loops exactly as you played it — 9.9 s, no bar grid.</div></div></div>
<div class="lbl" style="margin:14px 0 6px">Keep it as</div>{seg(['Free ✓'+small('as played'),'Tap'+small('tempo'),'Set…'+small('BPM'),'½'+small('of set'),'×2'+small('of set')],0,fs=12.5)}
<div class="mute" style="font-size:11.5px;margin-top:12px;line-height:1.45">No guessed tempo, no confidence score. ½ and ×2 stay here and act on any tempo you tap or set. Later layers follow this loop.</div>'''
    return dict(title='Sketch 15',tempo=None,tempo_note='free time',hist='0:41',ph=0.42,
      ribbon=dict(kind='loopfree',title='Layer 1 · Piano · free-time loop',right='9.9 s · no grid',
        layers=[dict(notes=rn,beats=tot,lo=55,hi=76,col=TA['lay'][0])],playhead=0.42,bracket=None),
      layers=lay(dict(PIANO,ltxt='9.9 s',custom=(rn,tot,55,76)),dict(name='Layer 2 · next capture',sound='Warm EP',state='target')),
      card=inner,card_h=206,tgt='Layer 2',capture=dict(sub='next capture → Layer 2 (free time)'),tp='■',tp_label='Stop (optional)')

def f4():
    live=[n for n in B if n[0]<15.2]
    return dict(title='Sketch 14',tempo='92',hist='1:12',chip3=f'<span class="chip" style="color:{TA["text"]}">▶ 4.2 / 4</span>',ph=0.80,
      ribbon=dict(kind='grid',title='Now playing · Bass over loop',right='tempo locked · 92',chords=music.CHORDS,
        layers=[dict(notes=P,beats=16,lo=34,hi=76,col=TA['lay'][0],op=.28),dict(notes=live,beats=16,lo=34,hi=76,col=TA['lay'][1])],
        playhead=0.80,bracket=(0.0,0.80,'last 4 bars · lands on bar 1')),
      layers=lay(PIANO,dict(name='Layer 2 · next capture',sound='Bass (placeholder)',state='target')),
      sound='Bass (placeholder)',tgt='Layer 2',capture=dict(sub='last 4 bars → Layer 2 · in sync'),tp='■',tp_label='Stop (optional)')

def f5():
    inner=f'''<div style="display:flex;justify-content:space-between;align-items:center">
<div>{('<div class="disp" style="font-size:24px;line-height:1">Bass, in time.</div>') if TA.get('hy') else '<div style="font-size:16px;font-weight:650">Bass captured in sync</div>'}<div class="mute" style="font-size:12px;margin-top:3px">4 bars on the locked 92 grid · joins at bar 1</div></div>
<div class="mono acc" style="font-size:22px;font-weight:500">1.3<span style="font-size:12px">s</span></div></div>
<div style="display:flex;gap:6px;margin-top:12px">
<div class="btn" style="flex:1;height:48px;font-size:13px">‹ beat</div><div class="btn on" style="flex:1.4;height:48px;font-size:13px">✓ Phase OK</div><div class="btn" style="flex:1;height:48px;font-size:13px">beat ›</div>
<div class="btn" style="flex:1.2;height:48px;font-size:13px;border-color:{TA['text']}">↶ Undo</div></div>'''
    return dict(title='Sketch 14',tempo='92',hist='1:12',chip3=f'<span class="chip" style="color:{TA["text"]}">▶ 4.4 / 4</span>',ph=0.86,
      ribbon=dict(kind='grid',title='Layer 2 · Bass · queued',right='original timing kept',chords=music.CHORDS,
        layers=[dict(notes=P,beats=16,lo=34,hi=76,col=TA['lay'][0],op=.28),dict(notes=B,beats=16,lo=34,hi=76,col=TA['lay'][1])],playhead=0.86),
      layers=lay(PIANO,dict(BASS,state='queued',qtxt='bar 1'),dict(name='Layer 3 · next capture',sound='Bass (placeholder)',state='target')),
      card=inner,card_h=124,sound='Bass (placeholder)',tgt='Layer 3',capture=dict(sub='next capture → Layer 3'),tp='■',tp_label='Stop (optional)')

def pads(rh):
    names=[('Kick','C1'),('Snare','D1'),('Closed hat','F♯1'),('Open hat','A♯1'),('Rim','C♯1'),('Clap','D♯1'),('Low tom','A1'),('Ride','D♯2')]
    o=[f'<div class="ab" style="left:16px;top:152px;width:358px;height:{rh}px;border-radius:20px;background:{TA["well"]};border:1px solid {TA["line"]}">',
       f'<div class="ab lbl" style="left:14px;top:14px">Drum pads · this screen</div><div class="ab mono mute" style="right:14px;top:13px;font-size:11px">touch · tagged “screen”</div>']
    for i,(n,k) in enumerate(names):
        r,c=divmod(i,4); ph_=(rh-52)/2; x=14+c*84; y=40+r*(ph_+6); hit=i in (0,2)
        o.append(f'<div class="ab" style="left:{x}px;top:{y}px;width:78px;height:{ph_:.0f}px;border-radius:14px;background:{TA["hit"] if hit else TA["surf2"]};border:1px solid {TA["lay"][2] if hit else TA["line"]};padding:9px 10px">'
                 f'<div style="font-size:12.5px;font-weight:600">{n}</div><div class="mono dim" style="font-size:10px;margin-top:3px">{k}</div>'
                 + (f'<div class="ab" style="right:9px;bottom:9px;width:8px;height:8px;border-radius:50%;background:{TA["lay"][2]}"></div>' if hit else '')+'</div>')
    o.append('</div>'); return ''.join(o)
def f6():
    return dict(title='Sketch 14',tempo='92',hist='1:12',chip3=f'<span class="chip" style="color:{TA["text"]}">▶ 2.1 / 4</span>',ph=0.28,ribbon_html=pads,
      layers=lay(PIANO,BASS,dict(DRUMS,ltxt='New ✓'),dict(name='Layer 4 · next capture',sound='Kit (placeholder)',state='target')),
      sound='Kit (placeholder)',tgt='Layer 4',capture=dict(sub='next capture → Layer 4'),tp='■',tp_label='Stop (optional)')
FR.update({'02-capture-proposal':f2,'03-no-steady-pulse':f3,'04-bass-over-loop':f4,'05-bass-captured-undo':f5,'06-drums':f6})
NAMES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B']
def nn(p): return f"{NAMES[p%12]}{p//12-1}"
OFF=[0,0.11,-0.08,0.14,0.02,-0.12,0.09,0.13,-0.05,0.1,0.07,-0.13,0.03,0.12,-0.09,0.15]
def bass_played(): return [(s+OFF[i]-(0.04 if i%2 else 0),d,p,v) for i,(s,d,p,v) in enumerate(B)]
def q(n,strength=.5,grid=1.0):
    s,d,p,v=n; t=round(s/grid)*grid; return (s+(t-s)*strength,d,p,v)
def roll_html(T,x,y,w,h,start,beats,lo,hi,sel,strength=.5,keys=True,bg_notes=None,lab=True,ruler=True):
    o=[f'<div class="ab" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:18px;background:{T["well"]};border:1px solid {T["line"]};overflow:hidden">']
    kw=46 if keys else 0; rh=26 if ruler else 0; gx,gy,gw,gh=kw,rh,w-kw,h-rh; rng=hi-lo+1; row=gh/rng
    for k,p in enumerate(range(hi,lo-1,-1)):
        black=(p%12) in (1,3,6,8,10)
        if black: o.append(f'<div class="ab" style="left:{gx}px;top:{gy+k*row:.1f}px;width:{gw}px;height:{row:.1f}px;background:rgba(255,255,255,.025)"></div>' if T.get('dark') else f'<div class="ab" style="left:{gx}px;top:{gy+k*row:.1f}px;width:{gw}px;height:{row:.1f}px;background:rgba(0,0,0,.035)"></div>')
        if keys:
            o.append(f'<div class="ab" style="left:0;top:{gy+k*row:.1f}px;width:{kw}px;height:{row:.1f}px;background:{"#20242B" if black else "#2E333B"};border-bottom:1px solid {T["well"]}"></div>' if T.get('dark') else f'<div class="ab" style="left:0;top:{gy+k*row:.1f}px;width:{kw}px;height:{row:.1f}px;background:{"#D8D0BF" if black else "#FFFDF8"};border-bottom:1px solid {T["line"]}"></div>')
            if p%12==0 or p in (lo,): o.append(f'<div class="ab mono" style="left:6px;top:{gy+k*row+row/2-6:.1f}px;font-size:10px;color:{T["mute"]}">{nn(p)}</div>')
    steps=int(beats*2)
    for i in range(steps+1):
        xx=gx+i/steps*gw; c=T['line'] if i%8==0 else (T['line'] if i%2==0 else None)
        if c: o.append(f'<div class="ab" style="left:{xx:.1f}px;top:{gy}px;width:1px;height:{gh}px;background:{c};opacity:{1 if i%8==0 else .45}"></div>')
        if ruler and i%8==0 and i<steps: o.append(f'<div class="ab mono" style="left:{xx+6:.1f}px;top:7px;font-size:10.5px;color:{T["mute"]}">{int(start//4+1+i//8)}</div>')
        elif ruler and i%2==0 and i<steps: o.append(f'<div class="ab mono dim" style="left:{xx+3:.1f}px;top:9px;font-size:9px">.{(i//2)%4+1}</div>')
    if bg_notes:
        o.append(notes_html(bg_notes,gx,gy,gw,gh,beats,lo,hi,T['lay'][0],op=.22,start=start,minh=row*.8,maxh=row*.8))
    played=bass_played(); col=T['lay'][1]
    for i,n in enumerate(played):
        if not(start-0.3<=n[0]<start+beats): continue
        isel=i in sel; m=q(n,strength,0.5) if isel else n
        if isel:  # ghost of played timing
            xx=gx+(n[0]-start)/beats*gw; yy=gy+(hi-n[2])*row
            o.append(f'<div class="ab" style="left:{xx:.1f}px;top:{yy+1:.1f}px;width:{n[1]/beats*gw-2:.1f}px;height:{row-2:.1f}px;border:1.5px dashed {col};border-radius:5px;opacity:.65"></div>')
        xx=gx+(m[0]-start)/beats*gw; yy=gy+(hi-m[2])*row; ww=m[1]/beats*gw-2
        o.append(f'<div class="ab" style="left:{xx:.1f}px;top:{yy+1:.1f}px;width:{ww:.1f}px;height:{row-2:.1f}px;background:{col};border-radius:5px;{"box-shadow:0 0 0 2px "+T["text"]+",0 6px 18px rgba(0,0,0,.4)" if isel else "opacity:.85"}">'
                 + (f'<span class="mono" style="position:absolute;left:6px;top:{row/2-7:.0f}px;font-size:10px;color:{T["bg"]};font-weight:600">{nn(m[2])}</span>' if lab and ww>26 else '')
                 + (f'<div style="position:absolute;right:-1px;top:{row/2-9:.0f}px;width:6px;height:18px;border-radius:3px;background:{T["text"]}"></div>' if isel else '')+'</div>')
    o.append('</div>'); return ''.join(o)

def f7(T=None,t=None):
    T=T or TA; t=t or CUR[0]
    sel=[8,9,10,11]
    tabs=''.join(f'<div style="flex:1;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12.5px;font-weight:600;'
       f'background:{T["surf2"] if i==1 else "transparent"};border:1.5px solid {T["text"] if i==1 else T["line"]};color:{T["text"] if i<3 else T["mute"]}"><span style="color:{T["lay"][i] if i<3 else T["mute"]};font-size:10px">{g}</span>{n}</div>'
       for i,(n,g) in enumerate([('Piano','◆'),('Bass','▬'),('Drums','●'),('Empty','+')]))
    body=statusbar(T)+f'''
<div class="ab" style="left:16px;top:52px;width:358px;display:flex;align-items:center;justify-content:space-between">
<div class="btn" style="padding:0 14px;background:transparent">‹ Done</div>
<div style="text-align:center"><div style="font-size:16px;font-weight:650">Edit · Bass</div><div class="mono mute" style="font-size:11px;margin-top:2px">bars 3–4 of 4 · 92 BPM</div></div>
<div class="btn" style="padding:0 12px;font-size:12.5px;background:transparent">⊙ Played</div></div>
<div class="ab" style="left:16px;top:112px;width:358px;display:flex;gap:6px">{tabs}</div>
{roll_html(T,16,172,358,368,8,8,34,52,sel)}
<div class="ab" style="left:16px;top:548px;width:358px;height:20px;border-radius:6px;background:{T['surf']};border:1px solid {T['line']};overflow:hidden">{notes_html(B,4,3,350,14,16,34,54,T['lay'][1],minh=2,maxh=3)}<div class="ab" style="left:178px;top:0;width:178px;height:18px;border:1.5px solid {T['text']};border-radius:5px"></div></div>'''
    sheet=f'''<div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-size:15px;font-weight:650">Quantise · 4 notes selected</div><div class="mono acc" style="font-size:13px">50%</div></div>
<div style="display:flex;gap:6px;margin-top:10px">{''.join(f'<div style="flex:1;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:600;background:{T["text"] if i==1 else T["surf"]};color:{T["bg"] if i==1 else T["text"]};border:1px solid {T["text"] if i==1 else T["line"]}">{g}</div>' for i,g in enumerate(['1/4','1/8 ✓','1/16','1/8T']))}</div>
<div style="position:relative;height:40px;margin-top:8px"><div class="ab" style="left:0;right:0;top:18px;height:4px;border-radius:2px;background:{T['line']}"></div><div class="ab" style="left:0;width:50%;top:18px;height:4px;border-radius:2px;background:{T['acc']}"></div>
<div class="ab" style="left:calc(50% - 14px);top:6px;width:28px;height:28px;border-radius:50%;background:{T['text']};box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>
<div class="ab mute" style="left:0;top:28px;font-size:10px">played</div><div class="ab mute" style="right:0;top:28px;font-size:10px">on grid</div></div>'''
    body+=f'<div class="ab" style="left:12px;top:578px;width:366px;height:136px;border-radius:24px;background:{T["surf2"]};border:1px solid {T["line"]};padding:14px 16px">{sheet}</div>'
    body+=f'''<div class="ab" style="left:16px;top:724px;width:358px;display:flex;gap:8px;height:80px">
<div class="btn" style="width:64px;height:80px;border-radius:24px;font-size:18px">↶</div><div class="btn" style="width:64px;height:80px;border-radius:24px;font-size:18px;color:{T['mute']}">↷</div>
<div class="btn" style="flex:1;height:80px;border-radius:40px;gap:10px;border:1.5px solid {T['acc']}">{capglyph(30,T['acc'],T['acc'],2.4)}Capture</div>
<div class="btn pri" style="width:104px;height:80px;border-radius:24px;font-size:15px">Apply</div></div>
<div class="ab" style="left:130px;top:824px;width:130px;height:5px;border-radius:3px;background:{T['text']};opacity:.5"></div>'''
    return dict(html=frame(t,390,844,body))
FR['07-edit-quantise']=f7
