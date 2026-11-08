from frames import *
def wrap(x,y,w,h,inner): return f'<div class="ab" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px">{inner}</div>'
def big_lane(T,x,y,w,h,i,L,ph):
    st=L.get('state','empty'); border={'loop':T['line'],'target':T['acc'],'queued':T['acc'],'empty':T['line']}[st]
    bs='dashed' if st in('queued','empty') else 'solid'; bg=T['surf'] if L.get('kind') else 'transparent'
    o=[f'<div class="ab" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:20px;background:{bg};border:1.5px {bs} {border}">']
    col=T['lay'][i] if L.get('kind') else T['dim']
    o.append(f'<div class="ab" style="left:14px;top:14px;display:flex;gap:12px;align-items:center"><div style="width:40px;height:40px;border-radius:12px;background:{T["surf2"]};display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="mono" style="font-size:13px;font-weight:600">{i+1}</span><span style="font-size:9px;color:{col}">{GLYPH[L.get("kind")]}</span></div>'
             f'<div><div style="font-size:15px;font-weight:650">{E(L["name"])}</div><div class="mute" style="font-size:12px;margin-top:2px">{E(L.get("sound",""))}{(" · <span style=\'color:"+T["acc"]+"\'>◔ "+L.get("qtxt","")+"</span>") if st=="queued" else (" · ▶ 4 bars" if st=="loop" else "")}</div></div></div>')
    if L.get('kind'):
        o.append(f'<div class="ab" style="right:12px;top:10px;display:flex;gap:6px">'+''.join(f'<div class="btn" style="width:48px;height:48px;font-size:13px;background:transparent">{b}</div>' for b in ('M','S'))+'</div>')
        o.append(lane_content(T,dict(L,i=i),14,72,w-28,h-84,ph))
        stt={'loop':'▶ Looping · 4 bars','queued':'◔ '+L.get('qtxt','')}.get(st,'')
        o.append(f'<div class="ab" style="left:68px;top:52px;font-size:0;font-weight:600;color:{T["acc"] if st=="queued" else T["mute"]}">{stt}</div>')
    else:
        o.append(f'<div class="ab" style="right:16px;top:24px;font-size:12px;font-weight:600;color:{T["acc"] if st=="target" else T["mute"]}">{"◎ Next capture" if st=="target" else "Empty"}</div>')
    o.append('</div>'); return ''.join(o)

def fold_f5():
    T=TA; s=f5(); W,H=840,1000
    s['_rg']=(16,152,358,640)
    left=statusbar(T)+header(T,s)+ribbon(T,s)
    th=wrap(0,156,390,844,thumb(T,s))
    o=[wrap(9,0,390,1000,left),wrap(9,0,390,1000,th)]
    o.append(f'<div class="ab" style="left:419px;top:0;width:2px;height:{H}px;background:linear-gradient(180deg,transparent,{T['line']},transparent)"></div>')
    o.append(f'<div class="ab lbl" style="left:440px;top:64px">Layers · Sketch 14</div><div class="ab mono mute" style="right:24px;top:62px;font-size:11px">shared 92 BPM · 4/4 · 4 bars</div>')
    L=s['layers']; hs=[150,150,96,72]; y=92
    for i in range(4):
        L_=L[i] if i<3 else dict(name='Empty',sound='after Layer 3',state='empty')
        o.append(big_lane(T,440,y,380,hs[i],i,L_,0.86)); y+=hs[i]+10
    o.append(card(H-176,124,s['card'],T,left=440,w=380))
    o.append(f'<div class="ab" style="left:440px;top:{y+6}px;width:380px;font-size:12px;line-height:1.45"><span class="mute">Layers stay visible on the right pane; Capture and Undo stay on the bottom edge of each pane, clear of the hinge.</span></div>')
    o.append(f'<div class="ab" style="left:355px;top:{H-14}px;width:130px;height:5px;border-radius:3px;background:{T["text"]};opacity:.5"></div>')
    return dict(html=frame(CUR[0],W,H,''.join(o)),W=W,H=H)

def desktop_f7():
    T=TA; W,H=1440,900
    o=[]
    # browser chrome (generic, unbranded)
    o.append(f'<div class="ab" style="left:0;top:0;width:{W}px;height:84px;background:{T['surf']};border-bottom:1px solid {T['line']}"></div>')
    o.append('<div class="ab" style="left:18px;top:16px;display:flex;gap:8px">'+''.join(f'<div style="width:12px;height:12px;border-radius:50%;background:{c}"></div>' for c in (T['line'],T['line'],T['line']))+'</div>')
    o.append(f'<div class="ab" style="left:90px;top:8px;width:240px;height:30px;border-radius:9px 9px 0 0;background:{T["bg"]};font-size:12px;display:flex;align-items:center;padding:0 12px;gap:8px"><span style="color:{T["acc"]}">◖</span>Blocks — Sketch 14</div>')
    o.append(f'<div class="ab mono" style="left:90px;top:46px;width:760px;height:28px;border-radius:8px;background:{T['well']};border:1px solid {T['line']};font-size:12px;color:{T["mute"]};display:flex;align-items:center;padding:0 12px">🔒 https://blocks.example/sketch/14 <span style="margin-left:auto" class="dim">example URL · secure context required for Web MIDI</span></div>')
    y0=84
    # top bar
    o.append(f'''<div class="ab" style="left:0;top:{y0}px;width:{W}px;height:64px;border-bottom:1px solid {T['line']};display:flex;align-items:center;padding:0 24px;gap:14px">
<div class="lbl" style="letter-spacing:.14em">Blocks</div><div style="font-size:18px;font-weight:650">Sketch 14</div>
<span class="chip"><span style="width:7px;height:7px;border-radius:50%;background:#58D68D"></span>Web MIDI · Keystation 61 · receiving</span><span class="chip">Audio · running</span><span class="chip mono">◷ 1:12 kept</span>
<div style="margin-left:auto;display:flex;align-items:baseline;gap:8px"><span class="mono" style="font-size:26px">92</span><span class="mono mute" style="font-size:12px">BPM · 4/4 · ▶ 3.2 / 4</span></div></div>''')
    # left layers rail
    y=y0+84; L=[PIANO,BASS,DRUMS,dict(name='Layer 4 · next capture',sound='Kit (placeholder)',state='target')]
    o.append(f'<div class="ab lbl" style="left:24px;top:{y0+82}px">Layers</div>')
    y=y0+104
    for i,l in enumerate(L):
        h=118 if l.get('kind') else 78
        lane=big_lane(T,24,y,320,h,i,dict(l,state='loop' if l.get('kind') else 'target'),0.55)
        if i==1: lane=lane.replace(f'border:1.5px solid {T["line"]}',f'border:1.5px solid {T["text"]}',1)
        o.append(lane); y+=h+10
    o.append(f'<div class="ab mute" style="left:24px;top:{y+6}px;width:320px;font-size:12px;line-height:1.5">Keys <span class="mono" style="color:{T["text"]}">1–4</span> target a layer · <span class="mono" style="color:{T["text"]}">C</span> Capture · <span class="mono" style="color:{T["text"]}">Space</span> play/stop · <span class="mono" style="color:{T["text"]}">Q</span> quantise · <span class="mono" style="color:{T["text"]}">Ctrl/Cmd+Z</span> undo</div>')
    # centre: piano roll all 4 bars
    cx=368; cw=740
    o.append(f'<div class="ab" style="left:{cx}px;top:{y0+80}px;display:flex;gap:10px;align-items:center"><div style="font-size:16px;font-weight:650">Edit · Bass</div><span class="chip">4 notes selected</span><span class="chip">⊙ show played timing</span></div>')
    o.append(f'<div class="ab" style="left:{cx}px;top:{y0+120}px;width:{cw}px;display:flex;gap:0">'+''.join(f'<div class="chord" style="position:absolute;left:{46+(cw-46)*k/4+8:.0f}px;font-size:18px">{c}</div>' for k,c in enumerate(music.CHORDS))+'</div>')
    o.append(roll_html(T,cx,y0+150,cw,520,0,16,33,55,[8,9,10,11],bg_notes=None))
    o.append(f'<div class="ab" style="left:{cx}px;top:{y0+680}px;width:{cw}px;height:36px;border-radius:10px;background:{T["surf"]};border:1px solid {T["line"]};overflow:hidden">{drums_html(music.drums(),52,4,cw-60,28,16,T["lay"][2],size=5)}<div class="ab mono dim" style="left:10px;top:11px;font-size:10px">DRUMS</div></div>')
    # right inspector
    ix=1132; iw=284
    sel=lambda opts,k: '<div style="display:flex;gap:6px">'+''.join(f'<div style="flex:1;height:44px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;background:{T["text"] if j==k else T["surf"]};color:{T["bg"] if j==k else T["text"]};border:1px solid {T["text"] if j==k else T["line"]}">{g}</div>' for j,g in enumerate(opts))+'</div>'
    o.append(f'''<div class="ab" style="left:{ix}px;top:{y0+80}px;width:{iw}px;height:640px;border-radius:22px;background:{T['surf2']};border:1px solid {T['line']};padding:20px">
<div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-size:16px;font-weight:650">Quantise</div><div class="mono acc">50%</div></div>
<div class="mute" style="font-size:12px;margin-top:4px">4 notes · bar 3 · Bass</div>
<div class="lbl" style="margin:18px 0 8px">Grid</div>{sel(['1/4','1/8 ✓','1/16','1/8T'],1)}
<div class="lbl" style="margin:18px 0 8px">Strength</div>
<div style="position:relative;height:44px"><div class="ab" style="left:0;right:0;top:20px;height:4px;border-radius:2px;background:{T['line']}"></div><div class="ab" style="left:0;width:50%;top:20px;height:4px;border-radius:2px;background:{T['acc']}"></div><div class="ab" style="left:calc(50% - 13px);top:9px;width:26px;height:26px;border-radius:50%;background:{T['text']}"></div></div>
<div style="display:flex;justify-content:space-between;font-size:11px" class="mute"><span>played</span><span>on grid</span></div>
<div class="lbl" style="margin:18px 0 8px">Velocity</div>{sel(['Keep ✓','Even','Humanise'],0)}
<div style="margin-top:22px;padding:14px;border-radius:14px;background:{T['surf']};border:1px solid {T['line']};font-size:12px;line-height:1.5" class="mute">Original take is kept. Dashed outlines show where you played; solid notes show the result. Revert any time.</div>
<div style="display:flex;gap:8px;margin-top:18px"><div class="btn" style="flex:1">Revert to played</div><div class="btn pri" style="flex:1">Apply · Q</div></div></div>''')
    # bottom transport
    o.append(f'''<div class="ab" style="left:0;top:{H-96}px;width:{W}px;height:96px;border-top:1px solid {T['line']};background:{T['surf']};display:flex;align-items:center;padding:0 24px;gap:12px">
<div class="btn" style="width:56px">↶</div><div class="btn" style="width:56px;color:{T['mute']}">↷</div><div class="btn" style="width:56px">■</div>
<div class="btn" style="padding:0 16px;background:transparent;gap:10px"><span class="mute">‹</span>Bass (placeholder)<span class="mute">›</span></div>
<div style="margin-left:auto;height:64px;width:420px;border-radius:32px;border:1.5px solid {T['acc']};background:linear-gradient(180deg,{T['surf2']},{T['surf']});display:flex;align-items:center;gap:14px;padding:0 20px;box-shadow:{'0 10px 40px -14px rgba(255,116,66,.55)' if T.get('dark') else '0 8px 26px -14px rgba(184,50,28,.5)'}">{capglyph(40,T['acc'],T['acc'],2.6)}<div style="flex:1"><div style="font-size:18px;font-weight:650">Capture</div><div class="mute" style="font-size:12px">last 4 bars → Layer 4</div></div><span class="mono" style="font-size:12px;border:1px solid {T['line']};border-radius:6px;padding:4px 8px">C</span></div></div>''')
    return dict(html=frame(CUR[0],W,H,''.join(o)),W=W,H=H)
FR['fold-05-bass-captured']=fold_f5
FR['desktop-07-edit-quantise']=desktop_f7
