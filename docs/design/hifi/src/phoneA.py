from kit import *
W,H=390,844
GLYPH={'piano':'◆','bass':'▬','drums':'●',None:'+'}
def statusbar(T):
    return f'''<div class="ab mono" style="left:28px;top:16px;font-size:14px;font-weight:600;color:{T['text']}">9:41</div>
<div class="ab" style="right:26px;top:18px;display:flex;gap:6px;align-items:center">
<div style="width:17px;height:11px;display:flex;gap:2px;align-items:flex-end">{''.join(f'<div style="width:3px;height:{h}px;background:{T["text"]};border-radius:1px"></div>' for h in (4,6,8,11))}</div>
<div style="width:25px;height:12px;border:1.5px solid {T['mute']};border-radius:4px;padding:1.5px"><div style="width:70%;height:100%;background:{T['text']};border-radius:1.5px"></div></div></div>'''

def header(T,s):
    tempo=s.get('tempo')
    tb=(f'<div class="mono" style="font-size:26px;font-weight:500;letter-spacing:-.02em;line-height:1">{tempo}</div>'
        f'<div class="mono mute" style="font-size:11px;margin-top:4px;text-align:right">BPM · {s.get("meter","4/4")}</div>') if tempo else \
       (f'<div class="mono" style="font-size:18px;font-weight:500;line-height:1;color:{T["mute"]}">— —</div>'
        f'<div class="mono dim" style="font-size:11px;margin-top:6px;text-align:right">{s.get("tempo_note","no tempo yet")}</div>')
    return f'''<div class="ab" style="left:20px;top:56px">
<div class="lbl" style="letter-spacing:.14em" data-role="menu">Blocks{' <span style="font-size:10px;letter-spacing:0">⌄</span>' if T.get('hy') else ''}</div>
{(f'<div class="disp" style="font-size:32px;line-height:1;letter-spacing:-.01em;margin-top:6px">{E(s.get("title","Sketch 14"))}</div>') if T.get('hy') else (f'<div style="font-size:22px;font-weight:650;letter-spacing:-.02em;margin-top:6px">{E(s.get("title","Sketch 14"))}</div>')}</div>
<div class="ab" style="right:20px;top:58px;text-align:right">{tb}</div>
<div class="ab" style="left:20px;top:112px;display:flex;gap:8px">
<span class="chip"><span style="width:7px;height:7px;border-radius:50%;background:{T['ok']}"></span>{E(s.get('dev','Keystation 61 · receiving'))}</span>
<span class="chip mono">◷ {E(s.get('hist','1:12'))} kept</span>
{s.get('chip3','')}</div>'''

def ribbon(T,s):
    r=s['ribbon']; x,y,w,h=s.get('_rg') or (16,152,358,s['_rh'])
    out=[f'<div class="ab" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:20px;background:{T["well"]};border:1px solid {T["line"]};overflow:hidden">']
    ix,iy,iw,ih=14,40,w-28,h-72
    kind=r.get('kind','free')
    out.append(f'<div class="ab lbl" style="left:14px;top:14px">{E(r.get("title","Now playing"))}</div>')
    if r.get('right'): out.append(f'<div class="ab mono mute" style="right:14px;top:13px;font-size:11px">{r["right"]}</div>')
    if kind=='grid':
        bars=r.get('bars',4)
        out.append(bars_grid(ix,iy-4,iw,ih+8,bars,T['line'],beatcol='rgba(255,255,255,.035)' if T.get('dark') else 'rgba(0,0,0,.04)'))
        ch=r.get('chords') or ['']*bars
        for b,c in enumerate(ch): out.append(f'<div style="position:absolute;left:{ix+b/bars*iw+5:.0f}px;top:{iy-5}px;font-size:16px;color:{T["text"]};" class="ab chord"><span class="mono dim" style="font-size:10px;margin-right:5px;font-style:normal">{b+1}</span>{E(c)}</div>')
    else:
        if kind=='loopfree':
            for sec in range(0,10,2): out.append(f'<div class="ab mono dim" style="left:{ix+sec/9.87*iw+3:.0f}px;top:{iy+ih+10}px;font-size:10px">{sec}s</div>')
        for i in range(6):
            xx=ix+i/5*iw
            out.append(f'<div class="ab" style="left:{xx:.0f}px;top:{iy}px;width:1px;height:{ih}px;background:{T["line"]};opacity:.45"></div>')
        if kind=='free': out.append(f'<div class="ab mono acc" style="right:8px;top:{iy+ih+10}px;font-size:10px">now</div>')
        if r.get('chords'):
            for (pos,c) in r['chords']: out.append(f'<div style="position:absolute;left:{ix+pos*iw:.0f}px;top:{iy-5}px;font-size:16px;color:{T["text"]};" class="ab chord">{E(c)}</div>')
    for layer in r.get('layers',[]):
        out.append(notes_html(layer['notes'],ix+layer.get('dx',0),iy+18,layer.get('w',iw),ih-20,layer['beats'],layer['lo'],layer['hi'],layer['col'],op=layer.get('op',1),minh=4,maxh=layer.get('maxh',7)))
    if r.get('bracket'):
        a,b,txt=r['bracket']; xa=ix+a*iw; xb=ix+b*iw
        out.append(f'<div class="ab" style="left:{xa:.0f}px;top:{iy+ih+2}px;width:{xb-xa:.0f}px;height:6px;border:1.5px solid {T["acc"]};border-top:none;border-radius:0 0 4px 4px"></div>')
        out.append(f'<div class="ab mono" style="left:{xa:.0f}px;width:{xb-xa:.0f}px;text-align:center;top:{iy+ih+12}px;font-size:10.5px;color:{T["acc"]}">{txt}</div>')
    if r.get('playhead') is not None:
        px=ix+r['playhead']*iw
        out.append(f'<div class="ab" style="left:{px:.0f}px;top:{iy+14}px;width:2px;height:{ih-8}px;background:{T["acc"]};box-shadow:0 0 12px {T["acc"]}"></div>')
    if kind=='free':
        out.append(f'<div class="ab" style="left:{ix}px;top:{iy}px;width:90px;height:{ih}px;background:linear-gradient(90deg,{T["well"]},transparent)"></div>')
        out.append(f'<div class="ab" style="left:{ix+iw-1:.0f}px;top:{iy-6}px;width:2px;height:{ih+12}px;background:{T["acc"]};box-shadow:0 0 14px {T["acc"]}"></div>')
    out.append('</div>'); return ''.join(out)

def lane_content(T,L,x,y,w,h,ph=None):
    k=L.get('kind'); col=T['lay'][L['i']]
    o=[]
    if L.get('custom'):
        n,bt,lo,hi=L['custom']; o.append(notes_html(n,x,y,w,h,bt,lo,hi,col,minh=2.2,maxh=3))
        if ph is not None: o.append(f'<div class="ab" style="left:{x+ph*w:.0f}px;top:{y-4}px;width:2px;height:{h+8}px;background:{T["acc"]};border-radius:1px"></div>')
        return ''.join(o)
    if k=='piano': o.append(notes_html(music.piano(),x,y,w,h,16,50,74,col,minh=2.2))
    elif k=='bass': o.append(notes_html(L.get('notes',music.bass()),x,y,w,h,16,34,54,col,minh=3,ghost=L.get('ghost',False)))
    elif k=='drums': o.append(drums_html(music.drums(),x,y,w,h,16,col,size=4.5))
    if k and T.get('hy'):
        o.insert(0,''.join(f'<div class="ab" style="left:{x}px;top:{y+h*j/4:.1f}px;width:{w}px;height:1px;background:{T["line"]};opacity:.9"></div>' for j in range(5)))
    if k: o.append(bars_grid(x,y-2,w,h+4,4,T['line']))
    if ph is not None and k and L.get('state')!='queued':
        o.append(f'<div class="ab" style="left:{x+ph*w:.0f}px;top:{y-4}px;width:2px;height:{h+8}px;background:{T["acc"]};border-radius:1px"></div>')
    return ''.join(o)

def lane_rows(s):
    rows=[]; empties=0; compact=bool(s.get('card_h'))
    for i,L in enumerate(s['layers']):
        st=L.get('state','empty')
        if st=='empty': empties+=1; continue
        rows.append(('L',i,dict(L,i=i),(52 if compact else 62) if L.get('kind') else 56))
    if empties: rows.append(('E',empties,None,48))
    return rows
def lanes(T,s,y0,gap=8):
    o=[]; ph=s.get('ph'); y=y0
    for kind,i,L,lh in lane_rows(s):
        if kind=='E':
            o.append(f'<div class="ab" style="left:16px;top:{y}px;width:358px;height:{lh}px;border-radius:14px;border:1.5px dashed {T["line"]};display:flex;align-items:center;padding:0 16px;gap:10px;color:{T["mute"]};font-size:12.5px"><span class="mono" style="font-size:14px">+</span>{i} empty slot{"s" if i>1 else ""} <span class="dim">· each capture fills the next</span></div>')
            y+=lh+gap; continue
        st=L.get('state','empty'); border=T['line']; bstyle='solid'; bg=T['surf']
        if st=='target': border=T['acc']; bg='transparent'
        if st=='queued': border=T['acc']; bstyle='dashed'
        o.append(f'<div class="ab" style="left:16px;top:{y}px;width:358px;height:{lh}px;border-radius:16px;background:{bg};border:1.5px {bstyle} {border}">')
        col=T['lay'][i] if L.get('kind') else T['acc']; bs=lh-22
        o.append(f'<div class="ab" style="left:10px;top:{(lh-3-bs)/2:.0f}px;width:{bs}px;height:{bs}px;border-radius:11px;background:{T["surf2"]};display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1px"><span class="mono" style="font-size:12px;font-weight:600">{i+1}</span><span style="font-size:9px;color:{col};line-height:1">{GLYPH[L.get("kind")]}</span></div>')
        tx=bs+22; ty=(lh-3)/2-17
        if L.get('kind'):
            o.append(f'<div class="ab" style="left:{tx}px;top:{ty:.0f}px;width:{168-tx}px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"><div style="font-size:14px;font-weight:600">{E(L["name"])}</div><div class="mute{' chord' if T.get('hy') else ''}" style="font-size:{13.5 if T.get('hy') else 11.5}px;margin-top:{1 if T.get('hy') else 3}px;overflow:hidden;text-overflow:ellipsis">{E(L["sound"])}</div></div>')
            o.append(lane_content(T,L,176,10,128,lh-23,ph))
        else:
            o.append(f'<div class="ab" style="left:{tx}px;top:{ty:.0f}px"><div style="font-size:14px;font-weight:600">{E(L.get("name","Empty"))}</div><div class="mute" style="font-size:11.5px;margin-top:3px">{E(L.get("sound",""))}</div></div>')
        stt={'loop':('▶',L.get('ltxt','Loop'),T['mute']),'target':('◎','Next',T['acc']),'queued':('◔',L.get('qtxt','Joins'),T['acc']),'muted':('⊘','Muted',T['mute'])}[st]
        o.append(f'<div class="ab" style="right:8px;top:0;height:{lh-3}px;width:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:{stt[2]}"><span style="font-size:13px">{stt[0]}</span><span style="font-size:10px;font-weight:600;letter-spacing:.02em">{stt[1]}</span></div>')
        o.append('</div>'); y+=lh+gap
    return ''.join(o)

def thumb(T,s):
    c=s.get('capture',{})
    snd=s.get('sound','Warm EP'); tgt=s.get('tgt','Layer 1')
    o=[f'''<div class="ab" style="left:16px;top:660px;display:flex;gap:8px;width:358px">
<div class="btn" style="width:56px" aria-label="Undo"><span style="font-size:18px">↶</span></div>
<div class="btn" style="flex:1;justify-content:space-between;padding:0 6px;background:{T['surf']}"><span class="mute" style="width:36px;text-align:center;font-size:16px">‹</span>
<span style="display:flex;flex-direction:column;align-items:center;line-height:1.15"><span style="font-size:14px">{E(snd)}</span><span class="mute" style="font-size:10.5px;font-weight:500">sound for {E(tgt)}</span></span><span class="mute" style="width:36px;text-align:center;font-size:16px">›</span></div>
<div class="btn" style="width:56px" aria-label="{s.get('tp_label','Play')}"><span style="font-size:15px">{s.get('tp','▷')}</span></div></div>''']
    sub=c.get('sub','last phrase → Layer 1'); lab=c.get('label','Capture')
    glow='0 0 0 1px rgba(255,116,66,.25),0 10px 40px -12px rgba(255,116,66,.55)' if T.get('dark') else '0 8px 30px -14px rgba(214,64,42,.6)'
    o.append(f'''<div class="ab" style="left:16px;top:720px;width:358px;height:84px;border-radius:42px;background:linear-gradient(180deg,{T['surf2']},{T['surf']});border:1.5px solid {T['acc']};box-shadow:{glow};display:flex;align-items:center;padding:0 24px 0 18px;gap:16px">
<div style="width:52px;height:52px;display:flex;align-items:center;justify-content:center">{capglyph(52,T['acc'],T['acc'],3)}</div>
<div style="flex:1"><div style="font-size:21px;font-weight:650;letter-spacing:-.01em">{E(lab)}</div><div class="mute" data-role="capsub" style="font-size:12.5px;margin-top:3px">{E(sub)}</div></div>
{c.get('right','')}</div>''')
    o.append(f'<div class="ab" style="left:130px;top:824px;width:130px;height:5px;border-radius:3px;background:{T["text"]};opacity:.5"></div>')
    return ''.join(o)

def phone(s,t='A'):
    T=T_(t); gap=8
    ch=s.get('card_h'); bottom=(712-ch-10) if ch else 648
    rows=lane_rows(s); tot=sum(r[3] for r in rows)+gap*(len(rows)-1)
    ly=bottom-tot; s['_rh']=ly-12-152
    th=s.get('thumb_html') or thumb(T,s)
    body=statusbar(T)+header(T,s)+(s['ribbon_html'](s['_rh']) if s.get('ribbon_html') else ribbon(T,s))+lanes(T,s,ly)+th+(card(712-ch,ch,s['card'],T) if ch else '')
    return frame(t,W,H,body)
def card(top,h,inner,T):
    sh='0 -10px 40px rgba(0,0,0,.55)' if T.get('dark') else '0 -8px 30px rgba(60,40,10,.12)'
    return f'<div class="ab" style="left:12px;top:{top}px;width:366px;height:{h}px;border-radius:24px;background:{T["surf2"]};border:1px solid {T["line"]};box-shadow:{sh};padding:16px 16px 14px">{inner}</div>'
