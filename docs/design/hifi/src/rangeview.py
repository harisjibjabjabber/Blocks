"""Rev 3.2 — Take history as a real piano roll on Play, with capture-range handles. PROPOSED; design/example data.
Order: one-action success first; then the failure (last chord only) and its effortless correction.
Harmony labels / role tags are a PROPOSED capability (recognition under research); every chord name is MOCK DATA."""
from large import *
import frames as FM
import music, random
LAB=['Dm9','G13(♭9)','Cmaj9/E','A7alt']; ALTLAB={1:'or Dm9/G'}
PRE=[(-1.5,0.45,67,70),(-1.0,0.45,69,74),(-0.45,0.4,72,84)]   # noodling; last note = pickup into bar 1
HIST=PRE+music.piano()
HELD=(15.0,1.9,76,82)   # melody note held across the loop end (example)
def roll(T,rh,rs,re_,mode='auto',x=16,y=152,w=358,free=False,mag=None,follow=True,title='TAKE HISTORY',
         labels=True,b0=None,b1=None,now=None,notes=None,pickup=False,linked=False,zoomchip=None,snapmenu=False,
         grid='est',edge=False,hint=None,rlab=None,ov=0.73,compact=False,nowlab=None):
    o=[f'<div class="ab" data-role="roll" style="left:{x}px;top:{y}px;width:{w}px;height:{rh}px;border-radius:20px;background:{T["well"]};border:1px solid {T["line"]};overflow:hidden">']
    kw=30; nx,nw=kw+4,w-kw-14; ny=56 if compact else 92; nh=rh-ny-96
    if free:
        nts,tot=music.rubato(); B0,B1=-1.2,tot+1.4; NOW=tot+0.5
    else:
        nts=HIST; B0,B1=-1.6,17.4; NOW=16.6
    nts=notes or nts; b0=B0 if b0 is None else b0; b1=B1 if b1 is None else b1; now=NOW if now is None else now
    X=lambda b: nx+(b-b0)/(b1-b0)*nw
    lo,hi=(48,77) if not free else (52,79)
    o.append(f'<div class="ab lbl" style="left:14px;top:15px">{title}</div>')
    if follow is None: pass
    elif follow:
        o.append(f'<div class="ab" style="right:10px;top:8px;height:28px;padding:0 10px;border-radius:14px;border:1px solid {T["line"]};display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:{T["mute"]}"><span style="width:7px;height:7px;border-radius:50%;background:{T["acc"]}"></span>Following live</div>')
    else:
        o.append(f'<div class="ab" data-role="live" style="right:8px;top:4px;height:36px;padding:0 12px;border-radius:18px;background:{T["text"]};color:{T["bg"]};display:flex;align-items:center;gap:6px;font-size:12px;font-weight:650">Back to live ›</div>')
    # overview: retained rolling history
    ox,ow,oy=50,w-150,46
    if compact: oy=-100
    o.append(f'<div class="ab" style="left:{ox}px;top:{oy}px;width:{ow}px;height:16px;border-radius:5px;background:{T["surf"]};border:1px solid {T["line"]};overflow:hidden">')
    random.seed(4)
    for i in range(70):
        hg=3+random.random()*9 if (i%9)<6 else 1.5
        o.append(f'<div class="ab" style="left:{2+i*(ow-6)/70:.1f}px;bottom:2px;width:{(ow-6)/70-1.2:.1f}px;height:{hg:.1f}px;background:{T["dim"]};opacity:.55;border-radius:1px"></div>')
    vw=ow*(0.27*(b1-b0)/19.0); vx=min(ow-4-vw,(ow-4)*ov+ow*0.27-vw) if ov<0.73 else ow-6-vw
    if ov<0.73: vx=(ow-4)*ov
    o.append(f'<div class="ab" style="left:{vx:.0f}px;top:0;width:{vw:.0f}px;height:14px;border:1.5px solid {T["text"]};border-radius:4px"></div></div>')
    o.append(f'<div class="ab mono dim" style="left:14px;top:{oy+2}px;font-size:9.5px">−1:12</div>')
    # keys + stripes
    rng=hi-lo+1; row=nh/rng
    for k,pn in enumerate(range(hi,lo-1,-1)):
        black=(pn%12) in (1,3,6,8,10)
        o.append(f'<div class="ab" style="left:0;top:{ny+k*row:.1f}px;width:{kw}px;height:{row:.1f}px;background:{(T["surf2"] if black else T["surf"])};border-bottom:1px solid {T["well"]}"></div>')
        if black: o.append(f'<div class="ab" style="left:{kw}px;top:{ny+k*row:.1f}px;width:{w-kw}px;height:{row:.1f}px;background:{"rgba(255,255,255,.02)" if T.get("dark") else "rgba(0,0,0,.025)"}"></div>')
        if pn%12==0: o.append(f'<div class="ab mono" style="left:3px;top:{ny+k*row+row/2-5:.1f}px;font-size:8.5px;color:{T["mute"]}">C{pn//12-1}</div>')
    # grid & ruler & labels
    foot=''
    if free:
        for sec in range(0,11,2):
            if sec<b0 or sec>b1: continue
            xx=X(sec); o.append(f'<div class="ab" style="left:{xx:.1f}px;top:{ny}px;width:1px;height:{nh}px;background:{T["line"]};opacity:.6"></div><div class="ab mono dim" style="left:{xx+3:.1f}px;top:{rh-30}px;font-size:10px">{sec}s</div>')
        o.append(f'<div class="ab mono mute" style="left:{nx}px;top:68px;font-size:10.5px">free time · no steady pulse · no bars invented</div>')
        foot='seconds ruler · snaps to note onsets only'
    else:
        dash='dashed' if grid=='est' else 'solid'
        for bt in range(int(b0)-1,int(b1)+2):
            if bt<b0 or bt>b1: continue
            xx=X(bt); bar=bt%4==0
            if bar: o.append(f'<div class="ab" style="left:{xx:.1f}px;top:{ny}px;width:0;height:{nh}px;border-left:1px {dash} {T["mute"] if grid=="est" else T["line"]};opacity:{.55 if grid=="est" else 1}"></div>')
            else: o.append(f'<div class="ab" style="left:{xx:.1f}px;top:{ny}px;width:1px;height:{nh}px;background:{T["line"]};opacity:.4"></div>')
            if bar and 0<=bt<16:
                o.append(f'<div class="ab mono" style="left:{xx+3:.1f}px;top:{rh-30}px;font-size:10.5px;color:{T["mute"]}">{bt//4+1}</div>')
                if labels:
                    k=bt//4
                    o.append(f'<div class="ab" style="left:{xx+4:.1f}px;top:66px;white-space:nowrap"><span class="chord" style="font-size:15px;color:{T["text"]}">{LAB[k]}</span>'+(f'<div class="chord" style="font-size:11px;color:{T["mute"]};margin-top:-2px">{ALTLAB[k]}</div>' if k in ALTLAB else '')+'</div>')
        foot=('bars est. 92 BPM · tentative' if grid=='est' else 'grid set · 92 BPM · 4/4')
    if labels and not free: foot+=' · chord names: mock data'
    o.append(f'<div class="ab mono dim" style="left:{nx}px;top:{rh-16}px;font-size:9px;white-space:nowrap">{foot}</div>')
    # range
    xs,xe=X(rs),X(re_)
    o.append(f'<div class="ab" data-role="rwash" style="left:{xs:.1f}px;top:{ny-4}px;width:{xe-xs:.1f}px;height:{nh+8}px;background:{T["acc"]};opacity:{.13 if T.get("dark") else .10};border-radius:6px"></div>')
    o.append(f'<div class="ab" data-role="rband" style="left:{xs:.1f}px;top:{ny-8}px;width:{xe-xs:.1f}px;height:3px;background:{T["acc"]};border-radius:2px"></div>')
    if pickup:
        px0=X(-0.45)
        o.append(f'<div class="ab" style="left:{px0:.1f}px;top:{ny-4}px;width:{xs-px0:.1f}px;height:{nh+8}px;border:1.5px dashed {T["acc"]};border-right:none;border-radius:6px 0 0 6px;opacity:.8"></div>')
        o.append(f'<div class="ab mono" style="left:{px0-2:.1f}px;top:{ny+nh-16}px;font-size:9px;color:{T["acc"]};background:{T["well"]};padding:1px 3px;border-radius:3px">pickup kept</div>')
    # notes
    for (s0,d,pn,v) in nts:
        if s0+d<b0 or s0>b1: continue
        inr=(rs-0.01<=s0<re_) or (pickup and -0.5<=s0<0)
        xx=X(max(s0,b0)); xend=X(min(s0+d,b1)); yy=ny+(hi-pn)*row
        if edge and (s0,d,pn,v)==HELD:
            xc=X(re_)
            o.append(f'<div class="ab" style="left:{xx:.1f}px;top:{yy+0.5:.1f}px;width:{xc-xx:.1f}px;height:{max(3,row-1.5):.1f}px;border-radius:2px 0 0 2px;background:{T["lay"][0]}"></div>')
            o.append(f'<div class="ab" style="left:{xc:.1f}px;top:{yy+0.5:.1f}px;width:{xend-xc:.1f}px;height:{max(3,row-1.5):.1f}px;border:1.5px dashed {T["lay"][0]};border-left:none;border-radius:0 2px 2px 0;opacity:.8"></div>')
            continue
        o.append(f'<div class="ab" data-on="{s0:.3f}" style="left:{xx:.1f}px;top:{yy+0.5:.1f}px;width:{max(3,xend-xx-1):.1f}px;height:{max(3,row-1.5):.1f}px;border-radius:2px;background:{T["lay"][0]};opacity:{(0.6+0.4*v/127) if inr else 0.32:.2f}"></div>')
    if labels and not free:  # role tags (PROPOSED)
        for (bx,py,t) in ((0.15,70,'melody'),(0.15,55,'chord')):
            if b0<=bx<=b1: o.append(f'<div class="ab mono" style="left:{X(bx)+2:.1f}px;top:{ny+(hi-py)*row-15:.1f}px;font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:{T["mute"]};border:1px solid {T["line"]};border-radius:4px;padding:0 3px;background:{T["well"]}">{t}</div>')
        o.append(f'<div class="ab" data-role="labels" style="right:10px;top:{oy-3}px;height:22px;padding:0 8px;border-radius:11px;border:1px solid {T["line"]};font-size:10.5px;font-weight:600;color:{T["mute"]};display:flex;align-items:center;background:{T["well"]}">Aa labels ✓</div>')
    elif not free:
        o.append(f'<div class="ab" data-role="labels" style="right:10px;top:{oy-3}px;height:22px;padding:0 8px;border-radius:11px;border:1px solid {T["line"]};font-size:10.5px;font-weight:600;color:{T["mute"]};display:flex;align-items:center">Aa labels off</div>')
    # live edge
    if b0<=now<=b1:
        o.append(f'<div class="ab" style="left:{X(now):.1f}px;top:{ny-6}px;width:2px;height:{nh+12}px;background:{T["acc"]};box-shadow:0 0 10px {T["acc"]}"></div><div class="ab mono acc" style="left:{X(now)-30:.1f}px;top:{rh-30}px;font-size:10px;width:60px;text-align:center;background:{T["well"]}">{nowlab or ("now" if follow else "live")}</div>')
    else:
        o.append(f'<div class="ab mono acc" style="right:8px;top:{ny+nh/2-8}px;font-size:10px;background:{T["well"]};padding:2px 4px;border-radius:4px">live ▸</div>')
    if edge:
        o.append(f'<div class="ab mono" style="left:{X(re_)+4:.1f}px;top:{ny+(hi-HELD[2])*row-16:.1f}px;font-size:9px;color:{T["acc"]};background:{T["well"]};padding:0 3px">clipped for playback · raw kept</div>')
    # handles
    hz=ny+nh+6
    for role,xx,glyph,lab in (('hs',xs,'⟦','Start'),('he',xe,'⟧','End')):
        active=(mode=='drag' and role=='hs') or linked
        o.append(f'<div class="ab" data-role="{role}" style="left:{xx-24:.1f}px;top:{ny-8}px;width:48px;height:{hz-ny+56:.0f}px;cursor:ew-resize">'
                 f'<div class="ab" style="left:23px;top:0;width:2px;height:{hz-ny+8:.0f}px;background:{T["acc"]}"></div>'
                 f'<div class="ab" style="left:0;top:{hz-ny+8:.0f}px;width:48px;height:48px;border-radius:14px;background:{T["acc"] if active else T["surf2"]};border:2px solid {T["acc"]};display:flex;flex-direction:column;align-items:center;justify-content:center;color:{T["accT"] if active else T["text"]};{"box-shadow:0 0 0 6px "+("rgba(255,116,66,.22)" if T.get("dark") else "rgba(184,50,28,.16)") if active else ""}">'
                 f'<span style="font-size:17px;line-height:1">{glyph}</span><span style="font-size:9px;font-weight:700;letter-spacing:.04em">{lab.upper()}</span></div></div>')
    if linked:
        o.append(f'<div class="ab" style="left:{xs+24:.1f}px;top:{hz+30:.0f}px;width:{xe-xs-48:.1f}px;height:2px;background:{T["acc"]}"></div><div class="ab mono" style="left:{(xs+xe)/2-60:.1f}px;top:{hz+12:.0f}px;width:120px;text-align:center;font-size:10px;color:{T["acc"]};font-weight:600;background:{T["well"]}">⟷ slide · length locked</div>')
    if rlab is None:
        rlab=f'{re_-rs:.1f} s' if free else f'{(re_-rs)/4:g} bar{"s" if (re_-rs)!=4 else ""}'
    o.append(f'<div class="ab mono" data-role="rlabel" style="left:{14+len(title)*7.2+8:.0f}px;top:9px;height:26px;padding:0 9px;border-radius:13px;border:1.5px solid {T["acc"]};display:flex;align-items:center;font-size:10.5px;color:{T["acc"]};font-weight:600;white-space:nowrap">{rlab}</div>')
    if hint:
        o.append(f'<div class="ab" style="left:{nx+4}px;top:{ny+nh-26}px;font-size:11px;font-weight:600;padding:4px 8px;border-radius:8px;background:{T["surf2"]};border:1px solid {T["line"]}">{hint}</div>')
    if zoomchip:
        o.append(f'<div class="ab mono" style="left:{nx+4}px;top:{ny+nh-26}px;font-size:10px;padding:3px 7px;border-radius:7px;background:{T["surf2"]};border:1px solid {T["line"]};color:{T["mute"]}">{zoomchip}</div>')
    if snapmenu:
        o.append(f'''<div class="ab" style="left:{w-170}px;top:{ny+6}px;width:160px;border-radius:14px;background:{T["surf2"]};border:1px solid {T["text"]};box-shadow:0 12px 30px rgba(0,0,0,.3);overflow:hidden;font-size:12.5px">
<div class="lbl" style="padding:8px 12px 4px">Snap handles to</div>'''+''.join(f'<div style="height:40px;display:flex;align-items:center;padding:0 12px;border-top:1px solid {T["line"]};font-weight:{650 if on else 500}">{"● " if on else "○ "}{n}</div>' for n,on in (('Note onsets',1),('Beats',0),('Bars',1),('Off (free)',0)))+f'<div class="mute" style="padding:6px 12px 9px;font-size:10.5px;line-height:1.35;border-top:1px solid {T["line"]}">Override while dragging: slide finger up · Ctrl/Cmd</div></div>')
    if mag:
        mx=min(max(xs-75,6),w-156); my=ny+14
        o.append(f'<div class="ab" data-role="loupe" style="left:{mx:.0f}px;top:{my}px;width:150px;height:100px;border-radius:16px;background:{T["surf2"]};border:1.5px solid {T["text"]};box-shadow:0 12px 30px rgba(0,0,0,.35);overflow:hidden">')
        z0,z1=rs-1.0,rs+1.0
        for (s0,d,pn,v) in nts:
            if s0+d<z0 or s0>z1: continue
            zx=(s0-z0)/(z1-z0)*150; zw=d/(z1-z0)*150; zy=8+(hi-pn)/rng*52
            o.append(f'<div class="ab" style="left:{zx:.1f}px;top:{zy:.1f}px;width:{zw:.1f}px;height:4px;border-radius:1.5px;background:{T["lay"][0]};opacity:{.95 if s0>=rs-0.01 else .35}"></div>')
        o.append(f'<div class="ab" style="left:74px;top:0;width:2px;height:64px;background:{T["acc"]}"></div>')
        o.append(f'<div class="ab" style="left:0;top:64px;width:150px;height:36px;background:{T["surf"]};border-top:1px solid {T["line"]};padding:4px 8px;font-size:10.5px;line-height:1.25"><b>{mag[0]}</b><br><span class="mute">{mag[1]}</span></div></div>')
    o.append('</div>')
    return ''.join(o)

def edges(T,rh):
    """Loop start (pickup) and loop end (held note) magnified side by side."""
    w=358; o=[f'<div class="ab" style="left:16px;top:152px;width:{w}px;height:{rh}px;border-radius:20px;background:{T["well"]};border:1px solid {T["line"]};overflow:hidden">',
       f'<div class="ab lbl" style="left:14px;top:15px">Layer 1 · loop edges</div><div class="ab mono mute" style="right:14px;top:14px;font-size:11px">grid set · 92 BPM</div>']
    def pane(px,pw,b0,b1,title,note_html):
        q=[f'<div class="ab" style="left:{px}px;top:44px;width:{pw}px;height:{rh-60}px;border-radius:14px;background:{T["surf"]};border:1px solid {T["line"]};overflow:hidden">',
           f'<div class="ab lbl" style="left:10px;top:10px">{title}</div>']
        X=lambda b: 8+(b-b0)/(b1-b0)*(pw-16)
        for bt in range(int(b0),int(b1)+1):
            if bt<b0: continue
            q.append(f'<div class="ab" style="left:{X(bt):.1f}px;top:34px;width:1px;height:{rh-196}px;background:{T["line"]};opacity:{1 if bt%4==0 else .45}"></div>')
            if bt%4==0: q.append(f'<div class="ab mono mute" style="left:{X(bt)+3:.1f}px;top:{rh-158}px;font-size:10px;white-space:nowrap">{"bar "+str(bt//4+1) if bt<16 else "1 ↺"}</div>')
        q.append(note_html(X)); q.append('</div>'); return ''.join(q)
    lo,hi=50,78; H=rh-200; Y=lambda p: 40+(hi-p)/(hi-lo)*(H-20)
    def start_notes(X):
        s=''
        for (s0,d,p,v) in HIST:
            if -1.2<=s0<2.0:
                pk=-0.5<=s0<0
                s+=f'<div class="ab" style="left:{X(s0):.1f}px;top:{Y(p):.1f}px;width:{max(4,X(s0+d)-X(s0)-1):.1f}px;height:6px;border-radius:2px;background:{T["lay"][0]};opacity:{1 if (s0>=0 or pk) else .3}"></div>'
        s+=f'<div class="ab" style="left:{X(0)-1:.1f}px;top:30px;width:3px;height:{H}px;background:{T["acc"]}"></div>'
        s+=f'<div class="ab" style="left:{X(-0.45)-2:.1f}px;top:{Y(72)-22:.1f}px;font-size:9.5px;font-weight:700;color:{T["acc"]};background:{T["surf"]};padding:0 3px;border-radius:3px;z-index:2">PICKUP</div>'
        s+=f'<div class="ab" style="left:8px;top:{H+66}px;right:8px;font-size:11px;line-height:1.35"><b>Pickup kept.</b> <span class="mute">It plays in the last beat before each repeat (wraps); the raw note keeps its time.</span></div>'
        return s
    def end_notes(X):
        s=''
        for (s0,d,p,v) in HIST+[HELD]:
            if 13<=s0<17.5:
                if (s0,d,p,v)==HELD:
                    s+=f'<div class="ab" style="left:{X(s0):.1f}px;top:{Y(p):.1f}px;width:{X(16)-X(s0):.1f}px;height:6px;border-radius:2px 0 0 2px;background:{T["lay"][0]}"></div>'
                    s+=f'<div class="ab" style="left:{X(16):.1f}px;top:{Y(p):.1f}px;width:{X(s0+d)-X(16):.1f}px;height:6px;border:1.5px dashed {T["lay"][0]};border-left:none;border-radius:0 2px 2px 0;opacity:.8"></div>'
                    s+=f'<div class="ab" style="left:{X(s0)-30:.1f}px;top:{Y(p)-16:.1f}px;font-size:9.5px;font-weight:700;color:{T["acc"]};white-space:nowrap;background:{T["surf"]};padding:0 3px;border-radius:3px;z-index:2">HELD ACROSS END</div>'
                else:
                    s+=f'<div class="ab" style="left:{X(s0):.1f}px;top:{Y(p):.1f}px;width:{max(4,X(s0+d)-X(s0)-1):.1f}px;height:6px;border-radius:2px;background:{T["lay"][0]}"></div>'
        s+=f'<div class="ab" style="left:{X(16)-1:.1f}px;top:30px;width:3px;height:{H}px;background:{T["acc"]}"></div>'
        s+=f'<div class="ab" style="left:8px;top:{H+66}px;right:8px;font-size:11px;line-height:1.35"><b>Clipped for playback.</b> <span class="mute">A synthetic release at the loop end; the raw note stays full length.</span></div>'
        return s
    o.append(pane(10,165,-1.4,2.2,'Loop start',start_notes)); o.append(pane(183,165,12.8,17.6,'Loop end',end_notes))
    o.append('</div>'); return ''.join(o)

TGT=dict(name='Layer 1 · next capture',sound='Warm EP',state='target')
LOOP1=dict(kind='piano',name='Piano',sound='Warm EP · chord + melody',state='loop',ltxt='4 bars')
def base(title='Sketch 14'):
    return dict(title=title,tempo=None,tempo_note='free play',hist='1:12',layers=FM.lay(TGT),sound='Warm EP',tgt='Layer 1',tp='▷')
def r_success():
    T=FM.TA; s=base()
    s['ribbon_html']=lambda rh: roll(T,rh,0,16,'auto',pickup=True,rlab='auto ✓ 4 bars')
    s['capture']=dict(sub='4 bars + pickup: Dm9 → A7alt → Layer 1'); return s
def r_fail():
    T=FM.TA; s=base()
    s['ribbon_html']=lambda rh: roll(T,rh,12,16,'auto',rlab='auto: 1 bar',hint='Only the last chord? Drag ⟦ back.')
    s['capture']=dict(sub='auto: 1 bar (A7alt only) → Layer 1'); return s
def r_drag():
    T=FM.TA; s=base()
    s['ribbon_html']=lambda rh: roll(T,rh,0,16,'drag',follow=False,labels=False,mag=('Snap · bar 1 · onset','slide up = no snap'),rlab='4 bars · end fixed')
    s['capture']=dict(sub='4 bars: Dm9 → A7alt → Layer 1'); return s
def r_fixed():
    T=FM.TA; s=base()
    s['ribbon_html']=lambda rh: roll(T,rh,0,16,'set',follow=False,pickup=True)
    s['card']='''<div style="display:flex;align-items:center;gap:12px;height:100%"><div style="flex:1"><div class="disp" style="font-size:22px;line-height:1">All four chords.</div><div class="mute" style="font-size:12px;margin-top:4px">Range 4 bars (was 1). Notes and timing untouched.</div></div><div class="btn" data-role="undo" style="width:96px">↶ Undo</div></div>'''
    s['card_h']=84; s['capture']=dict(sub='4 bars + pickup → Layer 1'); return s
def _loopframe(slide):
    T=FM.TA; s=dict(base(),tempo='92',chip3=f'<span class="chip" style="color:{T["text"]}">▶ 2.3 / 4</span>',layers=FM.lay(LOOP1,dict(name='Layer 2 · next capture',sound='Warm EP',state='target')),tgt='Layer 2',tp='■',ph=0.55)
    if slide:
        s['ribbon_html']=lambda rh: roll(T,rh,-1,15,'set',follow=None,linked=True,labels=False,grid='set',title='LAYER 1 · LOOP',rlab='4 bars · beat one −1',compact=True,b0=-5.2,b1=17.2,now=8.2,nowlab='▶')
    else:
        s['ribbon_html']=lambda rh: roll(T,rh,-4,16,'drag',follow=None,labels=False,grid='set',title='LAYER 1 · LOOP',rlab='5 bars · end fixed',compact=True,b0=-5.2,b1=17.2,now=8.2,nowlab='▶')
    s['card']=f'''<div style="display:flex;gap:6px">{''.join(f'<div class="btn{" on" if (i==1)==slide else ""}" data-role="{["mbound","mslide"][i]}" style="flex:1;font-size:12.5px;height:44px">{x}</div>' for i,x in enumerate(['⟦ Boundaries','⟷ Slide (phase)']))}</div>
<div style="font-size:11.5px;line-height:1.4;margin-top:8px" class="mute">'''+(f'<b style="color:{T["text"]}">Slide:</b> length kept at 4 bars, beat one shifts −1 beat (‹ › by beat). Notes untouched.' if slide else f'<b style="color:{T["text"]}">Boundaries:</b> start moved back 1 bar, end fixed, length 4 → 5 bars. Notes untouched.')+f' Cutting notes: Edit only.</div>'
    s['card_h']=112; s['capture']=dict(sub='next capture → Layer 2'); return s
def r_bound(): return _loopframe(False)
def r_slide(): return _loopframe(True)
def r_edges():
    T=FM.TA; s=dict(base(),tempo='92',chip3=f'<span class="chip" style="color:{T["text"]}">▶ 4.4 / 4</span>',layers=FM.lay(LOOP1,dict(name='Layer 2 · next capture',sound='Warm EP',state='target')),tgt='Layer 2',tp='■',ph=0.9)
    s['ribbon_html']=lambda rh: edges(T,rh); s['capture']=dict(sub='next capture → Layer 2'); return s
def r_free():
    T=FM.TA; s=base('Sketch 15'); s['tempo_note']='free time'; s['hist']='0:41'
    n,tot=music.rubato()
    s['ribbon_html']=lambda rh: roll(T,rh,0.0,tot,'drag',free=True,follow=False,mag=('Snap · note onset · 0.0 s','D4 · no bars invented'))
    s['capture']=dict(sub=f'{tot:.1f} s, free time → Layer 1'); return s
def r_zoom():
    T=FM.TA; s=base()
    s['ribbon_html']=lambda rh: roll(T,rh,0,16,'set',follow=False,b0=-1.4,b1=6.6,ov=0.30,zoomchip='pinch · 2 bars visible',snapmenu=True,labels=True,rlab='4 bars')
    s['capture']=dict(sub='4 bars: Dm9 → A7alt → Layer 1'); return s

def settings():
    T=FM.TA; dk=T.get('dark'); cur='Dark' if dk else 'Light'
    opt=lambda name,sub,on: f'''<div data-role="ap-{name.lower()}" style="cursor:pointer;display:flex;align-items:center;gap:14px;min-height:60px;padding:0 16px;border-top:1px solid {T['line']}">
<div style="width:22px;height:22px;border-radius:50%;border:2px solid {T['text'] if on else T['mute']};display:flex;align-items:center;justify-content:center">{f'<div style="width:10px;height:10px;border-radius:50%;background:{T["text"]}"></div>' if on else ''}</div>
<div style="flex:1"><div style="font-size:15px;font-weight:{650 if on else 500}">{name}</div><div class="mute" style="font-size:12px;margin-top:2px">{sub}</div></div>{'<span style="font-size:13px;font-weight:600">✓ Selected</span>' if on else ''}</div>'''
    sw=lambda lab,P,on: f'''<div style="flex:1;border-radius:14px;border:{2 if on else 1}px solid {T['text'] if on else T['line']};padding:8px;background:{T['surf']}"><div style="height:64px;border-radius:9px;background:{P['bg']};position:relative;overflow:hidden"><div style="position:absolute;left:8px;top:8px;font-family:'Instrument Serif',serif;font-size:14px;color:{P['text']}">Sketch 14</div><div style="position:absolute;left:8px;right:8px;top:30px;height:14px;border-radius:5px;background:{P['surf']};border:1px solid {P['line']}"></div><div style="position:absolute;left:8px;right:8px;bottom:6px;height:10px;border-radius:5px;border:1.5px solid {P['acc']}"></div></div><div style="font-size:11.5px;font-weight:600;margin-top:6px;text-align:center">{lab}</div></div>'''
    row=lambda a,b,first=False: f'<div style="display:flex;align-items:center;min-height:56px;padding:0 16px;border-top:{0 if first else 1}px solid {T["line"]}"><div style="flex:1"><div style="font-size:14.5px;font-weight:500">{a}</div><div class="mute" style="font-size:11.5px;margin-top:2px">{b}</div></div><span class="mute">›</span></div>'
    body=statusbar(T)+f'''
<div class="ab" style="left:16px;top:52px"><div class="btn" data-role="done" style="padding:0 14px;background:transparent">‹ Sketch 14</div></div>
<div class="ab disp" style="left:22px;top:114px;font-size:40px;line-height:1">Settings</div>
<div class="ab mute" style="left:22px;top:160px;font-size:12px">From the Blocks ⌄ menu (top-left on Play). Never on the play surface.</div>
<div class="ab" style="left:16px;top:192px;width:358px">
<div class="lbl" style="margin:0 6px 8px">Appearance</div>
<div style="border-radius:20px;background:{T['surf']};border:1px solid {T['line']};overflow:hidden">
<div style="display:flex;gap:8px;padding:12px">{sw('Dark',T_('C'),dk)}{sw('Light',T_('D'),not dk)}</div>
{opt('System','Default · follows the device or browser · now '+cur,True)}{opt('Light','Paper finish, for daylight and review',False)}{opt('Dark','Graphite, for dim rooms and stage',False)}</div>
<div class="mute" style="font-size:11.5px;line-height:1.5;margin:10px 6px 0">Switching applies instantly. Audio, playback and MIDI input keep running. The choice is saved on this device.</div>
<div class="lbl" style="margin:22px 6px 8px">More (proposed)</div>
<div style="border-radius:20px;background:{T['surf']};border:1px solid {T['line']};overflow:hidden">{row('MIDI devices','Connections and source tags',True)}{row('Capture','History target 120 s (proposed) · snapping · labels')}</div></div>
<div class="ab" style="left:16px;top:740px;width:358px;height:60px;border-radius:30px;background:{T['surf2']};border:1px solid {T['line']};display:flex;align-items:center;padding:0 8px 0 18px;gap:10px"><span style="width:8px;height:8px;border-radius:50%;background:{T['acc']}"></span><div style="flex:1"><div style="font-size:13.5px;font-weight:600">Sketch 14 still looping</div><div class="mute" style="font-size:11px">Layer 1 · 4 bars · design / example data</div></div><div class="btn" style="width:48px;border-radius:24px">■</div></div>
<div class="ab" style="left:130px;top:824px;width:130px;height:5px;border-radius:3px;background:{T['text']};opacity:.5"></div>'''
    return dict(html=frame(FM.CUR[0],390,844,body))

def fold_range():
    T=FM.TA; W,H=840,1000; o=[]; s=r_drag()
    left=statusbar(T)+header(T,s)+roll(T,640,0,16,'drag',follow=False,labels=False,mag=('Snap · bar 1 · onset','slide up = no snap'),rlab='4 bars · end fixed')
    o.append(wrap(9,0,390,1000,left)); o.append(wrap(9,0,390,1000,wrap(0,156,390,844,thumb(T,s))))
    step=lambda lab,val,sub: f'''<div style="display:flex;align-items:center;gap:8px;margin-top:10px"><div style="width:70px;font-size:13px;font-weight:600">{lab}</div><div class="btn" style="width:48px">−</div><div style="flex:1;text-align:center"><div class="mono" style="font-size:17px">{val}</div><div class="mute" style="font-size:10.5px">{sub}</div></div><div class="btn" style="width:48px">+</div></div>'''
    o.append(f'<div class="ab lbl" style="left:440px;top:64px">Capture range</div>')
    o.append(f'''<div class="ab" style="left:440px;top:88px;width:380px;border-radius:20px;background:{T['surf']};border:1px solid {T['line']};padding:16px">
<div class="disp" style="font-size:26px;line-height:1">Four bars, Dm9 to A7alt.</div><div class="mute" style="font-size:12px;margin-top:6px">The auto-selection was 1 bar. Drag a handle or step it here.</div>
{step('Start','bar 1.1','by note · beat · bar')}{step('End','bar 5.1','fixed while start moves')}
<div style="display:flex;gap:6px;margin-top:12px">{''.join(f'<div class="btn{" on" if i<2 else ""}" style="flex:1;font-size:12px">{x}</div>' for i,x in enumerate(['Onsets ✓','Bars ✓','Free']))}</div>
<div class="mute" style="font-size:11.5px;margin-top:12px;line-height:1.45">Boundary edits are non-destructive and undoable. Original timing kept; quantise and cutting live in Edit.</div></div>''')
    o.append(f'<div class="ab lbl" style="left:440px;top:476px">Layers</div>')
    o.append(big_lane(T,440,500,380,72,0,dict(TGT),None))
    o.append(f'<div class="ab" style="left:440px;top:582px;width:380px;height:48px;border-radius:14px;border:1.5px dashed {T["line"]};display:flex;align-items:center;padding:0 16px;font-size:12.5px;color:{T["mute"]}">+ 3 empty slots · each capture fills the next</div>')
    o.append(f'<div class="ab" style="left:419px;top:0;width:2px;height:{H}px;background:{T["line"]};opacity:.5"></div><div class="ab" style="left:355px;top:{H-14}px;width:130px;height:5px;border-radius:3px;background:{T["text"]};opacity:.5"></div>')
    return dict(html=frame(FM.CUR[0],W,H,''.join(o)),W=W,H=H)

def desktop_range():
    T=FM.TA; W,H=1440,900; o=[]
    o.append(f'<div class="ab" style="left:0;top:0;width:{W}px;height:84px;background:{T["surf"]};border-bottom:1px solid {T["line"]}"></div><div class="ab" style="left:90px;top:8px;width:240px;height:30px;border-radius:9px 9px 0 0;background:{T["bg"]};font-size:12px;display:flex;align-items:center;padding:0 12px">Blocks — Sketch 14</div>')
    o.append(f'<div class="ab mono" style="left:90px;top:46px;width:760px;height:28px;border-radius:8px;background:{T["well"]};border:1px solid {T["line"]};font-size:12px;color:{T["mute"]};display:flex;align-items:center;padding:0 12px">🔒 https://blocks.example/sketch/14 <span style="margin-left:auto" class="dim">example URL</span></div>')
    o.append(f'''<div class="ab" style="left:0;top:84px;width:{W}px;height:64px;border-bottom:1px solid {T['line']};display:flex;align-items:center;padding:0 24px;gap:14px"><div class="lbl">Blocks ⌄</div><div class="disp" style="font-size:26px">Sketch 14</div><span class="chip"><span style="width:7px;height:7px;border-radius:50%;background:{T['ok']}"></span>Web MIDI · Keystation 61 · receiving</span><span class="chip mono">◷ 1:12 kept</span><div style="margin-left:auto" class="mono mute">free play · bars estimated 92 · chord names = mock data</div></div>''')
    o.append(f'<div class="ab lbl" style="left:24px;top:166px">Layers</div>')
    o.append(big_lane(T,24,190,300,80,0,dict(TGT),None))
    o.append(f'<div class="ab" style="left:24px;top:280px;width:300px;height:48px;border-radius:14px;border:1.5px dashed {T["line"]};display:flex;align-items:center;padding:0 16px;font-size:12.5px;color:{T["mute"]}">+ 3 empty slots</div>')
    o.append(f'''<div class="ab" style="left:24px;top:350px;width:300px;font-size:12px;line-height:1.75"><div class="lbl" style="margin-bottom:6px">Keyboard (proposed)</div>
<span class="mono">[</span> / <span class="mono">]</span> focus start / end handle<br><span class="mono">← →</span> move by note onset<br><span class="mono">Alt+← →</span> by beat · <span class="mono">Shift+← →</span> by bar<br><span class="mono">Ctrl/Cmd</span> while dragging: no snap<br><span class="mono">S</span> slide (keep length) · <span class="mono">, .</span> beat one ±1<br><span class="mono">L</span> back to live · <span class="mono">C</span> Capture · <span class="mono">Ctrl/Cmd+Z</span> undo</div>''')
    o.append(roll(T,600,0,16,'drag',x=348,y=166,w=1068,follow=False,pickup=True,mag=('Snap · bar 1 · onset','Ctrl/Cmd = no snap'),rlab='4 bars + pickup · end fixed'))
    o.append(f'''<div class="ab" style="left:0;top:{H-96}px;width:{W}px;height:96px;border-top:1px solid {T['line']};background:{T['surf']};display:flex;align-items:center;padding:0 24px;gap:12px">
<div class="btn" style="width:56px">↶</div><div class="btn" style="width:56px">▷</div><div class="btn" style="padding:0 16px;background:transparent;gap:10px"><span class="mute">‹</span>Warm EP<span class="mute">›</span></div>
<div style="margin-left:auto;height:64px;width:440px;border-radius:32px;border:1.5px solid {T['acc']};background:{T['surf2']};display:flex;align-items:center;gap:14px;padding:0 20px">{capglyph(40,T['acc'],T['acc'],2.6)}<div style="flex:1"><div style="font-size:18px;font-weight:650">Capture</div><div class="mute" style="font-size:12px">4 bars + pickup: Dm9 → A7alt → Layer 1</div></div><span class="mono" style="font-size:12px;border:1px solid {T['line']};border-radius:6px;padding:4px 8px">C</span></div></div>''')
    return dict(html=frame(FM.CUR[0],W,H,''.join(o)),W=W,H=H)

RSTEPS=[('09-range-auto-success','One Capture, all four chords','The engine picks the whole phrase: four chords plus the pickup into bar 1. One action, no handles. Chord names are optional mock labels.','1 touch'),
 ('10-range-auto-too-short','When it guesses short','Failure case: the auto-selection covers only the last chord (A7alt). A quiet hint points to the start handle.','0 touches'),
 ('11-range-drag-start','Drag the start handle back','The ⟦ handle owns touches in its 48 dp zone. Start moves, end stays fixed, so the length changes. A magnifier above the finger shows the snap target. Following pauses; Back to live returns.','1 drag'),
 ('12-range-four-chords','Fixed, with Undo','Range is 4 bars (was 1). Notes and timing untouched; one tap undoes the range edit.','1 touch to undo'),
 ('13a-range-boundaries','Boundaries: length changes','On a captured loop, dragging ⟦ moves the start with the end fixed, so 4 bars become 5. Non-destructive; notes untouched.','1 drag'),
 ('13b-range-slide-phase','Slide: phase, same length','The dedicated Slide control locks the length at 4 bars and shifts beat one (here −1 beat). Cutting or deleting notes is a separate, explicit Edit action.','1 drag'),
 ('14-range-loop-edges','Pickups and held notes','The pickup before bar 1 is kept and wraps. A note held across the end is clipped for playback only; the raw note stays full length.','0 touches'),
 ('15-range-free-time','Free time: no bars invented','No steady pulse: a seconds ruler, handles snap to note onsets only.','1 drag'),
 ('16-range-zoom-snap','Zoom, pan, snap','Pinch to zoom, one finger to pan; panning pauses follow and shows Back to live. Snap: onsets, beats, bars or off; slide up while dragging to override.','pinch + pan')]
SET=('08-settings-appearance','Settings · Appearance','From the Blocks ⌄ menu: System (default), Light or Dark. Switching never interrupts audio, playback or MIDI; the choice persists.','2 touches')
FM.FR.update({'09-range-auto-success':r_success,'10-range-auto-too-short':r_fail,'11-range-drag-start':r_drag,'12-range-four-chords':r_fixed,
  '13a-range-boundaries':r_bound,'13b-range-slide-phase':r_slide,'14-range-loop-edges':r_edges,'15-range-free-time':r_free,'16-range-zoom-snap':r_zoom,
  '08-settings-appearance':settings,'fold-11-range-drag':fold_range,'desktop-11-range-drag':desktop_range})
RALT={'11-range-drag-start':('fold-11-range-drag','Fold expanded','desktop-11-range-drag','Desktop browser')}
# geometry for the prototype's drag simulation (roll-relative)
def geom(n):
    if n=='15-range-free-time':
        _,tot=music.rubato(); return dict(nx=34,nw=314,b0=-1.2,b1=tot+1.4,s=0.0,e=tot,free=True,snaps=[round(x[0],3) for x in music.rubato()[0]])
    if n in ('09-range-auto-success','10-range-auto-too-short','11-range-drag-start','12-range-four-chords'):
        st={'09-range-auto-success':0,'10-range-auto-too-short':12,'11-range-drag-start':0,'12-range-four-chords':0}[n]
        return dict(nx=34,nw=314,b0=-1.6,b1=17.4,s=st,e=16,free=False,snaps=sorted(set([0,4,8,12,16]+[round(x[0],3) for x in HIST])))
    return None
