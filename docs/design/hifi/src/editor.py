"""Rev 3.3 — Expanded full-screen piano-roll editor storyboard (frames 17–27 + Fold + desktop). PROPOSED; design/example data.
Hybrid structure (Graphite base, selective Paper character). Nothing here implies the engine or capture works today.
All dp sizes are provisional until device testing."""
from large import *
import frames as FM, music
from frames import nn

# ---- example data: Piano layer, bars 1–2 visible (beats 0–8). Played offsets make the quantise preview honest.
def piano_notes():
    out=[]
    for (s,d,p,v) in music.piano():
        if s<8: out.append([s,d,p,v])
    return out
PN=piano_notes()
PLAYOFF=[0.16,-0.12,0.2,-0.14,0.18,-0.16]
def idx(pred): return {i for i,n in enumerate(PN) if pred(n)}
CHORD1=idx(lambda n:n[0]==0)                         # Dm9 stack (chord-select)
MEL1=idx(lambda n:n[3]==92 and n[0]<4)                 # bar-1 melody
MEL=idx(lambda n:n[3]==92)                             # bars 1–2 melody
UP2=idx(lambda n:n[0]==6.5 and n[3]==70)               # bar-2 upper voicing
BAR1CH=idx(lambda n:n[0]<4 and n[3]!=92)
LO,HI=50,72
# phone geometry
KX,KW=16,34; GX=KX+KW; GW=390-16-GX
def geo(gy,gh,b0=0,b1=8): 
    row=gh/(HI-LO+1)
    return dict(gy=gy,gh=gh,row=row,b0=b0,b1=b1,X=lambda b:GX+(b-b0)/(b1-b0)*GW,Y=lambda p:gy+(HI-p)*row)

def topbar(T,title='Piano',sub='Layer 1 · Warm EP · chord + melody'):
    return f'''<div class="ab" style="left:16px;top:50px"><div class="btn" data-role="back" style="width:76px;gap:4px">‹ Play</div></div>
<div class="ab" style="left:100px;top:50px;width:174px;text-align:center"><div class="disp" style="font-size:24px;line-height:1.05">Edit · {title}</div><div class="mute" style="font-size:10.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{sub}</div></div>
<div class="ab" style="right:16px;top:50px;display:flex;gap:6px"><div class="btn" data-role="undo" aria-label="Undo" style="width:48px;font-size:18px">↶</div><div class="btn" data-role="redo" aria-label="Redo" style="width:48px;font-size:18px">↷</div></div>'''

def layerstrip(T,ghost=True,y=106):
    chip=lambda g,n,col,on: f'<div class="btn{" on" if on else ""}" style="height:40px;padding:0 10px;gap:6px;font-size:12.5px;border-radius:12px"><span style="color:{col}">{g}</span>{n}</div>'
    return f'''<div class="ab" style="left:16px;top:{y}px;width:358px;display:flex;gap:6px;align-items:center">{chip('◆','1 Piano',T['lay'][0],True)}{chip('▬','2 Bass',T['lay'][1],False)}{chip('●','3 Drums',T['lay'][2],False)}
<div class="btn" data-role="ghost" style="height:40px;padding:0 10px;margin-left:auto;font-size:12px;border-radius:12px;background:transparent">{'◐ Others shown' if ghost else '○ Others hidden'}</div></div>'''

def infobar(T,y=152,snap='1/16'):
    return f'''<div class="ab" style="left:16px;top:{y}px;width:358px;display:flex;gap:6px;align-items:center">
<span class="chip" style="color:{T['text']}"><span style="width:7px;height:7px;border-radius:50%;background:{T['acc']}"></span>▶ looping · 2.3 / 4</span>
<span class="chip mono">Snap {snap}</span>
<span class="chip" data-role="loopinfo" style="margin-left:auto">🔒 Loop · on Play</span></div>'''

def ruler(T,G,y):
    X=G['X']; o=[f'<div class="ab" style="left:{GX}px;top:{y}px;width:{GW}px;height:26px;background:{T["surf"]};border-radius:8px 8px 0 0;border:1px solid {T["line"]};border-bottom:none"></div>']
    for bt in range(int(G['b0']),int(G['b1'])+1):
        xx=X(bt)
        if bt%4==0 and bt<G['b1']: o.append(f'<div class="ab mono" style="left:{xx+4:.1f}px;top:{y+6}px;font-size:11px;font-weight:600;color:{T["text"]}">{bt//4+1}</div>')
        elif bt<G['b1']: o.append(f'<div class="ab mono dim" style="left:{xx+3:.1f}px;top:{y+8}px;font-size:9px">.{bt%4+1}</div>')
    # loop bracket: read-only here
    o.append(f'<div class="ab" style="left:{GX}px;top:{y+22}px;width:{GW}px;height:3px;background:{T["acc"]};opacity:.55"></div>')
    o.append(f'<div class="ab" style="left:{KX}px;top:{y+5}px;width:{KW-2}px;text-align:center;font-size:12px" title="loop read-only">🔒</div>')
    return ''.join(o)

def grid(T,G,notes=None,sel=(),ghost=True,ph=5.2,label_sel=True,dim=None,erased=(),ghost_orig=None,preview=None,handles=True,qattrs=None):
    notes=notes if notes is not None else PN
    X,Y,row,gy,gh=G['X'],G['Y'],G['row'],G['gy'],G['gh']
    o=[f'<div class="ab" data-role="grid" data-gx="{GX}" data-gy="{gy}" data-row="{row:.3f}" data-col="{GW/32:.3f}" style="left:{GX}px;top:{gy}px;width:{GW}px;height:{gh}px;background:{T["well"]};border:1px solid {T["line"]};overflow:hidden"></div>']
    for p in range(HI,LO-1,-1):
        yy=Y(p); blk=(p%12) in (1,3,6,8,10)
        o.append(f'<div class="ab" style="left:{KX}px;top:{yy:.1f}px;width:{KW-2}px;height:{row-1:.1f}px;background:{T["surf2"] if blk else T["surf"]};border-radius:3px"></div>')
        if blk: o.append(f'<div class="ab" style="left:{GX+1}px;top:{yy:.1f}px;width:{GW-2}px;height:{row:.1f}px;background:{"rgba(255,255,255,.025)" if T.get("dark") else "rgba(0,0,0,.03)"}"></div>')
        if p%12==0: o.append(f'<div class="ab mono" style="left:{KX+3}px;top:{yy+row/2-6:.1f}px;font-size:9.5px;color:{T["mute"]}">C{p//12-1}</div>')
    for bt in range(int(G['b0']),int(G['b1'])+1):
        for sub in (0,.25,.5,.75):
            b=bt+sub
            if b>=G['b1']: continue
            op=1 if sub==0 and bt%4==0 else (.55 if sub==0 else .18)
            o.append(f'<div class="ab" style="left:{X(b):.1f}px;top:{gy}px;width:1px;height:{gh}px;background:{T["line"] if op<1 else T["mute"]};opacity:{op}"></div>')
    if ghost:  # other layers: bass is below the visible range → edge indicator (honest, no fake overlap)
        o.append(f'<div class="ab mono" style="left:{GX+6}px;top:{gy+gh-20}px;font-size:10px;padding:2px 6px;border-radius:6px;border:1px dashed {T["lay"][1]};color:{T["mute"]};background:{T["well"]}">▾ Bass · 8 notes below · ghost</div>')
    for i,(s,d,p,v) in enumerate(notes):
        if s+d<G['b0'] or s>G['b1'] or p<LO or p>HI: continue
        xx=X(s); w=max(6,X(min(s+d,G['b1']))-xx-1.5); yy=Y(p)+1; h=row-2
        if ghost_orig and i in ghost_orig:
            gs,gp=ghost_orig[i]
            o.append(f'<div class="ab" style="left:{X(gs):.1f}px;top:{Y(gp)+1:.1f}px;width:{w:.1f}px;height:{h:.1f}px;border:1.5px dashed {T["mute"]};border-radius:3px;opacity:.9"></div>')
        if i in erased:
            o.append(f'<div class="ab" style="left:{xx:.1f}px;top:{yy:.1f}px;width:{w:.1f}px;height:{h:.1f}px;border:1.5px dashed {T["mute"]};border-radius:3px;opacity:.7;background:repeating-linear-gradient(135deg,transparent 0 4px,{T["line"]} 4px 6px)"></div>')
            continue
        on=i in sel
        op=(0.55+0.45*v/127) if not (dim and i not in dim) else .35
        if on:
            lab=f'<span style="position:absolute;left:5px;top:{max(0,(h-12)/2):.0f}px;font-size:9.5px;font-weight:700;color:{T["bg"] if T.get("dark") else T["surf"]};font-family:{T["mono"]}">{nn(p)}</span>' if (label_sel and w>26) else ''
            qa=(f' data-q0="{X(qattrs[i][0]):.1f}" data-qg="{X(qattrs[i][1]):.1f}"' if qattrs and i in qattrs else '')
            o.append(f'<div class="ab" data-note="{i}" data-sel="1"{qa} style="left:{xx:.1f}px;top:{yy:.1f}px;width:{w:.1f}px;height:{h:.1f}px;border-radius:3px;background:{T["lay"][0]};box-shadow:0 0 0 2px {T["well"]},0 0 0 3.5px {T["text"]}">{lab}</div>')
            if handles:
                o.append(f'<div class="ab" style="left:{xx+w-3:.1f}px;top:{yy+h/2-6:.1f}px;width:6px;height:12px;border-radius:2px;background:{T["text"]};border:1.5px solid {T["well"]}"></div>')
        else:
            o.append(f'<div class="ab" data-note="{i}" style="left:{xx:.1f}px;top:{yy:.1f}px;width:{w:.1f}px;height:{h:.1f}px;border-radius:3px;background:{T["lay"][0]};opacity:{op:.2f}"></div>')
    if preview:
        s,d,p=preview; xx=X(s); w=X(s+d)-xx-1.5
        o.append(f'<div class="ab" style="left:{xx:.1f}px;top:{Y(p)+1:.1f}px;width:{w:.1f}px;height:{row-2:.1f}px;border-radius:3px;border:2px dashed {T["acc"]};background:{T["acc"]}33"></div>')
    if ph is not None and G['b0']<=ph<=G['b1']:
        o.append(f'<div class="ab" style="left:{X(ph)-1:.1f}px;top:{gy-26}px;width:2px;height:{gh+26}px;background:{T["acc"]};box-shadow:0 0 8px {T["acc"]}"></div><div class="ab" style="left:{X(ph)-6:.1f}px;top:{gy-30}px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid {T["acc"]}"></div>')
    return ''.join(o)

def vel_lane(T,G,y,h,sel,notes=None,expanded=False,scale=None):
    notes=notes if notes is not None else PN; X=G['X']
    o=[f'<div class="ab" style="left:{KX}px;top:{y}px;width:{358}px;height:{h}px;border-radius:0 0 12px 12px;background:{T["surf"]};border:1px solid {T["line"]}"></div>']
    vs=[notes[i][3] for i in sel] if sel else []
    rd=(f'{len(sel)} selected · {round(sum(vs)/len(vs))} avg · {min(vs)}–{max(vs)}' if vs else 'tap notes to select')
    o.append(f'<div class="ab lbl" style="left:{KX+8}px;top:{y+7}px;font-size:9.5px">Velocity</div><div class="ab mono" style="right:24px;top:{y+6}px;font-size:10.5px;color:{T["text"]}">{rd}</div>')
    bh=h-34; base=y+h-8; seen={}
    for i,(s,d,p,v) in enumerate(notes):
        if s>=G['b1']: continue
        vv=v if (scale is None or i not in sel) else round(v*scale)
        on=i in sel; hh=bh*vv/127; k=seen.get(s,0); seen[s]=k+1; ox=k*3
        o.append(f'<div class="ab" style="left:{X(s)+1+ox:.1f}px;top:{base-hh:.1f}px;width:{5 if not on else 7}px;height:{hh:.1f}px;border-radius:2px;background:{T["lay"][0] if on else T["dim"]};opacity:{1 if on else .45};{("box-shadow:0 0 0 1.5px "+T["text"]) if on else ""}"></div>')
        if on: o.append(f'<div class="ab" style="left:{X(s)-1+ox:.1f}px;top:{base-hh-4:.1f}px;width:11px;height:4px;border-radius:2px;background:{T["text"]}"></div>')
    return ''.join(o)

def toolbar(T,tool='select',y=756,ctx=None):
    t=lambda key,g,lab: f'<div class="btn{" on" if tool==key else ""}" data-role="tool-{key}" style="flex:1;height:56px;flex-direction:column;gap:2px;{("background:"+T["text"]+";color:"+T["bg"]) if tool==key else ""}"><span style="font-size:16px;line-height:1">{g}</span><span style="font-size:11px">{lab}{" ✓" if tool==key else ""}</span></div>'
    return f'''<div class="ab" style="left:16px;top:{y}px;width:358px;display:flex;gap:6px">{t('draw','✎','Draw')}{t('select','⬚','Select')}{t('erase','⌫','Erase')}
<div class="btn" style="width:64px;height:56px;border:1.5px solid {T['acc']};flex-direction:column;gap:1px">{capglyph(22,T['acc'],T['acc'],2)}<span style="font-size:9.5px">Capture</span></div></div>'''

def ctxbar(T,label,y=700,items=('Velocity','Quantise…'),active=None):
    b=''.join(f'<div class="btn{" on" if active==x else ""}" data-role="ctx-{x.lower().strip(".…")}" style="padding:0 12px;height:44px;font-size:12.5px">{x}</div>' for x in items)
    return f'''<div class="ab" style="left:16px;top:{y}px;width:358px;height:48px;border-radius:14px;background:{T['surf2']};border:1px solid {T['line']};display:flex;align-items:center;gap:6px;padding:0 2px 0 12px">
<div style="flex:1;font-size:12.5px;font-weight:650;white-space:nowrap">{label}</div>{b}<div class="btn{" on" if active=="more" else ""}" data-role="ctx-more" aria-label="More actions" style="width:44px;height:44px;font-size:18px">⋯</div></div>'''

def hint(T,x,y,txt,w=None):
    return f'<div class="ab" style="left:{x}px;top:{y}px;{("width:"+str(w)+"px;") if w else ""}font-size:11px;font-weight:600;padding:6px 10px;border-radius:10px;background:{T["text"]};color:{T["bg"]};box-shadow:0 8px 20px rgba(0,0,0,.3);white-space:nowrap">{txt}</div>'
def finger(T,x,y,r=22):
    return f'<div class="ab" style="left:{x-r}px;top:{y-r}px;width:{2*r}px;height:{2*r}px;border-radius:50%;border:2px solid {T["text"]};background:{"rgba(255,255,255,.12)" if T.get("dark") else "rgba(0,0,0,.08)"}"></div>'
def loupe(T,x,y,l1,l2,inner=''):
    x=max(16,min(x,390-16-196))
    return f'''<div class="ab" style="left:{x}px;top:{y}px;width:196px;height:96px;border-radius:16px;background:{T['surf2']};border:1.5px solid {T['text']};box-shadow:0 14px 30px rgba(0,0,0,.35);overflow:hidden">{inner}
<div class="ab" style="left:0;top:52px;width:196px;height:44px;background:{T['surf']};border-top:1px solid {T['line']};padding:5px 10px;font-size:11px;line-height:1.3"><b>{l1}</b><br><span class="mute">{l2}</span></div></div>'''
def toast(T,y,txt,act='↶ Undo'):
    return f'<div class="ab" style="left:16px;top:{y}px;width:358px;height:48px;border-radius:14px;background:{T["text"]};color:{T["bg"]};display:flex;align-items:center;padding:0 6px 0 14px;font-size:13px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.35)"><span style="flex:1">{txt}</span><span data-role="undo" style="height:40px;padding:0 14px;border-radius:10px;display:flex;align-items:center;border:1.5px solid {T["bg"]}">{act}</span></div>'

FOOT='PROPOSED · design / example data · not implemented · 48 dp targets provisional'
def foot(T,y=822): return f'<div class="ab mono dim" style="left:0;width:390px;top:{y}px;text-align:center;font-size:8.5px;letter-spacing:.04em">{FOOT}</div>'

def phone_ed(T,parts,tool='select'):
    return frame(FM.CUR[0],390,844,statusbar(T)+topbar(T)+layerstrip(T)+infobar(T)+parts)

STD=dict(gy=222,gh=376)
def std(T,sel,ctxlabel,tool='select',extra='',ghost=True,vel=True,ctx_items=('Velocity','Quantise…'),ctx_active=None,**gk):
    G=geo(**STD)
    p=ruler(T,G,196)+grid(T,G,sel=sel,ghost=ghost,**gk)
    if vel: p+=vel_lane(T,G,604,90,sel)
    p+=(ctxbar(T,ctxlabel,items=ctx_items,active=ctx_active) if ctxlabel else '')+toolbar(T,tool)+extra+foot(T)
    return phone_ed(T,p,tool)

# ---- frames
def e_entry():
    T=FM.TA; s=FM.FR['04-bass-over-loop'](); html=phone(s,FM.CUR[0])
    ov=(f'<div class="ab" data-role="edit-entry" style="left:12px;top:462px;width:366px;height:70px;border-radius:18px;border:2px dashed {T["text"]}"></div>'+finger(T,256,497,24)
        +hint(T,96,410,'Tap a layer’s notes to edit · loop keeps playing')+f'<div class="ab" style="left:250px;top:440px;width:2px;height:30px;background:{T["text"]}"></div>')
    return dict(html=_overlay(html,ov))
def _overlay(html,ov):
    k=html.rfind('</div>'); return html[:k]+ov+html[k:]
def e_select():
    T=FM.TA
    return dict(html=std(T,CHORD1,'Chord · Dm9 · 4 notes',extra=hint(T,GX+60,250,'Double-tap = select chord · tap = one note')))
def e_move():
    T=FM.TA; notes=[list(n) for n in PN]; orig={}
    for i in MEL1: orig[i]=(notes[i][0],notes[i][2]); notes[i][0]+=0.5; notes[i][2]+=2
    G=geo(**STD)
    lz=''
    for i in MEL1:
        s,d,p,v=notes[i]; lz+=f'<div class="ab" style="left:{18+(s-2.0)*40:.0f}px;top:{8+(74-p)*5:.0f}px;width:{d*40:.0f}px;height:7px;border-radius:2px;background:{T["lay"][0]}"></div>'
    p=ruler(T,G,196)+grid(T,G,notes=notes,sel=MEL1,ghost_orig=orig)+vel_lane(T,G,604,90,MEL1,notes=notes)+finger(T,int(G['X'](3.6)),int(G['Y'](67))+9)
    p+=loupe(T,int(G['X'](2.2))-10,236,'+2 semitones · +⅛ beat','F4→G4 · A4→B4 · snaps 1/16',lz)
    p+=ctxbar(T,'Moving · 3 notes',items=())+toolbar(T)+hint(T,GX+8,560,'Second finger cancels and reverts')+foot(T)
    return dict(html=phone_ed(T,p))
def e_marquee():
    T=FM.TA; G=geo(**STD); X,Y=G['X'],G['Y']
    sel=UP2|idx(lambda n:n[3]==92 and n[0]>=6)
    mq=f'<div class="ab" style="left:{X(6.3):.0f}px;top:{Y(72)+2:.0f}px;width:{X(7.95)-X(6.3):.0f}px;height:{Y(58)-Y(72):.0f}px;border:1.5px dashed {T["text"]};background:{"rgba(255,255,255,.06)" if T.get("dark") else "rgba(0,0,0,.05)"};border-radius:4px"></div>'
    p=ruler(T,G,196)+grid(T,G,sel=sel,handles=False)+mq+finger(T,int(X(7.95)),int(Y(58)))+vel_lane(T,G,604,90,sel)
    p+=hint(T,GX+6,232,'Drag on empty grid = marquee (Select tool)')+hint(T,GX+6,268,'Two fingers: pan · pinch to zoom')
    p+=ctxbar(T,'5 selected')+toolbar(T)+foot(T)
    return dict(html=phone_ed(T,p))
def e_resize():
    T=FM.TA; notes=[list(n) for n in PN]; k=[i for i in MEL1 if notes[i][0]==3][0]; notes[k][1]=1.5
    G=geo(**STD); X,Y=G['X'],G['Y']
    p=ruler(T,G,196)+grid(T,G,notes=notes,sel={k},ghost_orig={k:(3,65)})+finger(T,int(X(4.5)),int(Y(65))+9)+vel_lane(T,G,604,90,{k},notes=notes)
    zin=''.join(f'<div class="ab" style="left:{10+j*22}px;top:6px;width:1px;height:42px;background:{T["line"]}"></div>' for j in range(9))
    zin+=f'<div class="ab" style="left:10px;top:20px;width:88px;height:14px;border:1.5px dashed {T["mute"]};border-radius:3px"></div><div class="ab" style="left:10px;top:20px;width:132px;height:14px;background:{T["lay"][0]};border-radius:3px;box-shadow:0 0 0 2px {T["surf2"]},0 0 0 3.5px {T["text"]}"></div><div class="ab" style="left:139px;top:17px;width:6px;height:20px;border-radius:2px;background:{T["text"]}"></div>'
    p+=loupe(T,int(X(2.6)),Y(65)-118,'Length 1 beat → 1½ beats','end handle · start fixed · snaps 1/16',zin)
    p+=ctxbar(T,'F4 · 1 note')+toolbar(T)+foot(T)
    return dict(html=phone_ed(T,p))
def e_draw():
    T=FM.TA; G=geo(**STD); X,Y=G['X'],G['Y']
    p=ruler(T,G,196)+grid(T,G,sel=(),preview=(7.5,0.5,65))+finger(T,int(X(7.75)),int(Y(65))+9)+vel_lane(T,G,604,90,set())
    zin=''.join(f'<div class="ab" style="left:{10+j*22}px;top:6px;width:1px;height:42px;background:{T["line"]}"></div>' for j in range(9))
    zin+=''.join(f'<div class="ab" style="left:4px;top:{8+r*9}px;width:188px;height:1px;background:{T["line"]};opacity:.6"></div>' for r in range(5))
    zin+=f'<div class="ab" style="left:98px;top:21px;width:44px;height:12px;border:2px dashed {T["acc"]};border-radius:3px;background:{T["acc"]}33"></div><div class="ab mono" style="left:146px;top:19px;font-size:10px;color:{T["text"]}">F4</div>'
    p+=loupe(T,int(X(5.6))-30,Y(65)-118,'+ F4 · bar 2, beat 4.3','length ⅛ (last used) · velocity 84',zin)
    p+=ctxbar(T,'Draw · tap adds · drag sets length',items=('Length ⅛',))+toolbar(T,'draw')+foot(T)
    return dict(html=phone_ed(T,p))
def e_erase():
    T=FM.TA
    return dict(html=std(T,set(),None,tool='erase',erased=UP2,extra=toast(T,700,'3 notes erased · Erase stays on')))
def e_vel():
    T=FM.TA; G=geo(gy=222,gh=320); sel=BAR1CH
    p=ruler(T,G,196)+grid(T,G,sel=sel)
    X=G['X']; y0=550; h=150
    p+=f'<div class="ab" style="left:16px;top:{y0}px;width:358px;height:{h+46}px;border-radius:16px;background:{T["surf"]};border:1px solid {T["text"]}"></div>'
    p+=f'<div class="ab lbl" style="left:28px;top:{y0+10}px">Velocity · 7 selected</div><div class="ab mono" style="right:28px;top:{y0+9}px;font-size:12px;color:{T["text"]}" data-role="vread">avg 78 → <b>66</b> · ×0.85</div>'
    base=y0+h-14; bh=h-62; seen={}
    for i,(s_,d,pp,v) in enumerate(PN):
        on=i in sel; vv=round(v*0.85) if on else v; hh=bh*vv/127; k=seen.get(s_,0); seen[s_]=k+1
        ox=X(s_)+k*(11 if on else 4)
        va=(f' data-vsel="1" data-v="{v}" data-base="{base:.1f}" data-bh="{bh:.2f}"' if on else '')
        p+=f'<div class="ab"{va} style="left:{ox:.1f}px;top:{base-hh:.1f}px;width:{8 if on else 4}px;height:{hh:.1f}px;border-radius:2px;background:{T["lay"][0] if on else T["dim"]};opacity:{1 if on else .4};{("box-shadow:0 0 0 1.5px "+T["text"]) if on else ""}"></div>'
        if on:
            p+=f'<div class="ab" style="left:{ox-1:.1f}px;top:{base-bh*v/127-1:.1f}px;width:10px;height:0;border-top:1.5px dashed {T["mute"]}"></div>'
            p+=f'<div class="ab mono" style="left:{ox-3:.1f}px;top:{base-hh-28:.1f}px;font-size:8.5px;color:{T["text"]}">{vv}</div>' if k==0 else ''
    gy=base-bh*76/127-24
    p+=f'<div class="ab" style="left:{X(0)-4:.1f}px;top:{gy:.1f}px;width:{X(2.5)+40-X(0):.1f}px;height:3px;background:{T["text"]};border-radius:2px"></div><div class="ab" style="left:{X(4.3):.1f}px;top:{gy-18:.1f}px;height:38px;padding:0 10px;border-radius:12px;background:{T["text"]};color:{T["bg"]};display:flex;align-items:center;font-size:11.5px;font-weight:700;cursor:ns-resize;touch-action:none" data-role="vscale">⇕ drag bar to scale group</div>'
    p+=f'''<div class="ab" style="left:28px;top:{y0+h+0}px;display:flex;gap:6px;align-items:center"><div class="btn" style="width:48px;height:36px">−</div><div class="mono" style="font-size:13px;width:64px;text-align:center">×0.85</div><div class="btn" style="width:48px;height:36px">+</div><div class="btn" style="height:36px;padding:0 12px;font-size:12px">Set all…</div><div class="btn" style="height:36px;padding:0 12px;font-size:12px">Done</div></div>'''
    p+=toolbar(T)+foot(T)
    return dict(html=phone_ed(T,p))
def qorig():
    o={}; notes=[list(n) for n in PN]
    for j,i in enumerate(sorted(MEL)):
        off=PLAYOFF[j%len(PLAYOFF)]; o[i]=(notes[i][0]+off,notes[i][2])
    return o
def e_quant():
    T=FM.TA; G=geo(gy=222,gh=268); orig=qorig(); notes=[list(n) for n in PN]
    qa={}
    for i,(s,pp) in orig.items(): g=round(s*4)/4; notes[i][0]=s+(g-s)*0.5; qa[i]=(s,g)   # 1/16 grid, 50 %
    p=ruler(T,G,196)+grid(T,G,notes=notes,sel=MEL,ghost_orig=orig,handles=False,label_sel=False,qattrs=qa)
    seg=lambda opts,sel_: ''.join(f'<div class="btn{" on" if o_==sel_ else ""}" style="flex:1;height:40px;font-size:12px;{("background:"+T["text"]+";color:"+T["bg"]) if o_==sel_ else ""}">{o_}</div>' for o_ in opts)
    y=500
    p+=f'''<div class="ab" style="left:12px;top:{y}px;width:366px;height:318px;border-radius:22px;background:{T['surf']};border:1px solid {T['text']};box-shadow:0 -10px 30px rgba(0,0,0,.25);padding:14px 16px">
<div style="display:flex;align-items:baseline;gap:8px"><div class="disp" style="font-size:22px">Quantise preview</div><div class="mute" style="font-size:11px">dashed = as played (kept)</div></div>
<div class="lbl" style="margin-top:10px">Scope</div><div style="display:flex;gap:6px;margin-top:5px">{seg(['Selected · 6 notes','Whole layer · 20'],'Selected · 6 notes')}</div>
<div class="lbl" style="margin-top:10px">Grid</div><div style="display:flex;gap:6px;margin-top:5px">{seg(['1/4','1/8','1/16','1/8T'],'1/16')}</div>
<div style="display:grid;grid-template-columns:62px 1fr 40px;gap:8px;align-items:center;margin-top:12px;font-size:12px">
<span class="lbl">Strength</span><div data-role="qstr" style="height:6px;border-radius:3px;background:{T['line']};position:relative;cursor:pointer;touch-action:none"><div data-role="qfill" style="width:50%;height:6px;border-radius:3px;background:{T['acc']}"></div><div data-role="qknob" style="position:absolute;left:calc(50% - 12px);top:-9px;width:24px;height:24px;border-radius:50%;background:{T['text']}"></div></div><span class="mono" data-role="qval">50%</span>
<span class="lbl">Swing</span><div style="height:6px;border-radius:3px;background:{T['line']};position:relative"><div style="position:absolute;left:-4px;top:-9px;width:24px;height:24px;border-radius:50%;border:2px solid {T['text']};background:{T['surf']}"></div></div><span class="mono">0%</span></div>
<div style="display:flex;gap:8px;margin-top:14px"><div class="btn" data-role="q-cancel" style="flex:1">Cancel</div><div class="btn pri" data-role="q-apply" style="flex:1.4">Apply to 6 notes</div></div></div>'''
    p+=foot(T,826)
    return dict(html=phone_ed(T,p))
def e_overflow():
    T=FM.TA
    menu=f'''<div class="ab" style="right:16px;top:476px;width:230px;border-radius:16px;background:{T['surf2']};border:1px solid {T['text']};box-shadow:0 14px 34px rgba(0,0,0,.35);overflow:hidden;font-size:13.5px">'''+''.join(f'<div style="height:48px;display:flex;align-items:center;gap:10px;padding:0 14px;border-top:{0 if k==0 else 1}px solid {T["line"]}"><span style="flex:1">{a}</span><span class="mono dim" style="font-size:10px">{s}</span></div>' for k,(g,a,s) in enumerate([('⧉','Duplicate after','4 notes'),('⎘','Copy',''),('⎗','Paste at playhead','bar 2.2'),('▦','Select all in layer','20'),('⌫','Delete','')]))+'</div>'
    return dict(html=std(T,CHORD1,'Chord · Dm9 · 4 notes',ctx_active='more',extra=menu))
def e_return():
    T=FM.TA; s=FM.FR['04-bass-over-loop'](); html=phone(s,FM.CUR[0])
    return dict(html=_overlay(html,toast(T,600,'Piano: 4 edits · loop kept playing')))

ESTEPS=[('17-editor-entry','Enter from Play','Tap a layer’s notes on its card. The loop keeps playing; no new button is added to the play screen.','1 touch'),
 ('18-editor-select','A legible full editor','Pitch keys, bar ruler, layer identity and the other layers one tap away. Select tool: tap one note, double-tap a chord. Outline, handles and labels mark the selection, not colour alone.','1 touch'),
 ('19-editor-move','Move pitch and time','In Select, drag selected notes: +2 semitones, +⅛ beat. A loupe above the finger reads out the change; dashed outlines show where they were.','1 drag'),
 ('20-editor-marquee','Marquee, and who owns the touch','Select tool: one finger on empty grid draws a marquee. Two fingers always pan or pinch-zoom, in every tool.','1 drag'),
 ('21-editor-resize','Resize with the end handle','The end handle changes length; the start stays fixed. Readout: 1 beat → 1½ beats.','1 drag'),
 ('22-editor-draw','Draw adds notes','Draw tool: tap adds a note at the last-used length; drag sets the length. The loupe names pitch, position and velocity.','1 touch'),
 ('23-editor-erase','Erase, with Undo','Erase tool: tap or swipe across notes. Erase stays on until you switch tools; every stroke is one undo step.','1 swipe'),
 ('24-editor-velocity','Velocity for the selection','Bars for the selected notes, a numeric readout, and a group bar that scales them together (×0.85). Dashed ticks show the previous values.','1 drag'),
 ('25-editor-quantise','Quantise preview','Never automatic. Scope is explicit (selected notes or whole layer). Grid, strength and optional swing; the as-played notes stay as dashed ghosts and are kept.','2–3 touches'),
 ('26-editor-overflow','Secondary actions in ⋯','Duplicate, copy, paste, select all and delete live in the contextual ⋯ menu, keeping the toolbar to three tools.','2 touches'),
 ('27-editor-return','Back to Play, loop still running','‹ Play returns to the same sketch. The loop never stopped; a toast offers Undo for the whole edit session.','1 touch')]

# ---- Fold expanded
def fold_editor():
    T=FM.TA; W,H=840,1000; o=[]
    G=dict(geo(gy=230,gh=520)); 
    left=statusbar(T)+topbar(T)+layerstrip(T)+infobar(T)+ruler(T,G,204)+grid(T,G,sel=MEL1)+vel_lane(T,G,756,96,MEL1)+toolbar(T,'select',y=870)
    o.append(wrap(9,0,390,1000,left))
    X0=440
    sec=lambda t,y: f'<div class="ab lbl" style="left:{X0}px;top:{y}px">{t}</div>'
    o.append(sec('Selection',60)+f'<div class="ab" style="left:{X0}px;top:84px;width:380px;border-radius:18px;background:{T["surf"]};border:1px solid {T["line"]};padding:14px"><div class="disp" style="font-size:24px">3 notes · bar 1 melody</div><div class="mute" style="font-size:12px;margin-top:4px">F4 · A4 · G4 · velocity 92 · all actions visible here, no ⋯ needed</div><div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">'+''.join(f'<div class="btn" style="padding:0 12px;font-size:12.5px">{a}</div>' for a in ['Duplicate','Copy','Paste','Delete','Select all'])+'</div></div>')
    o.append(sec('Quantise (preview before apply)',290)+f'''<div class="ab" style="left:{X0}px;top:314px;width:380px;border-radius:18px;background:{T["surf"]};border:1px solid {T["line"]};padding:14px;font-size:12.5px">
<div style="display:flex;gap:6px">{''.join(f'<div class="btn{" on" if i==0 else ""}" style="flex:1;font-size:12px">{x}</div>' for i,x in enumerate(['Selected · 3','Whole layer · 20']))}</div>
<div style="display:flex;gap:6px;margin-top:8px">{''.join(f'<div class="btn{" on" if x=="1/16" else ""}" style="flex:1;font-size:12px">{x}</div>' for x in ['1/4','1/8','1/16','1/8T'])}</div>
<div class="mute" style="margin-top:10px">Strength 50% · Swing 0% · original kept as ghost</div>
<div style="display:flex;gap:8px;margin-top:10px"><div class="btn" style="flex:1">Preview</div><div class="btn pri" style="flex:1">Apply</div></div></div>''')
    o.append(sec('Layers',560)+''.join(big_lane(T,X0,584+i*84,380,76,i,L,None) for i,L in enumerate([dict(kind='piano',name='Piano · editing',sound='Warm EP',state='loop',ltxt='4 bars'),dict(kind='bass',name='Bass',sound='Bass (placeholder)',state='loop',ltxt='4 bars')])))
    o.append(f'<div class="ab mono dim" style="left:{X0}px;top:770px;width:380px;font-size:11px;line-height:1.6">🔒 Loop 4 bars · beat one = bar 1 · loop and phase are changed on Play, never here.<br>{FOOT}</div>')
    o.append(f'<div class="ab" style="left:419px;top:0;width:2px;height:{H}px;background:{T["line"]};opacity:.5"></div><div class="ab" style="left:355px;top:{H-14}px;width:130px;height:5px;border-radius:3px;background:{T["text"]};opacity:.5"></div>')
    return dict(html=frame(FM.CUR[0],W,H,''.join(o)),W=W,H=H)

# ---- Desktop
def desktop_editor():
    T=FM.TA; W,H=1440,900; o=[]
    o.append(f'<div class="ab" style="left:0;top:0;width:{W}px;height:64px;border-bottom:1px solid {T["line"]};background:{T["surf"]};display:flex;align-items:center;gap:12px;padding:0 20px"><div class="btn" style="padding:0 14px">‹ Play <span class="mono dim" style="margin-left:8px;font-size:11px">Esc</span></div><div class="disp" style="font-size:26px">Edit · Piano</div><span class="mute" style="font-size:12px">Layer 1 · Warm EP · chord + melody</span><span class="chip" style="margin-left:24px;color:{T["text"]}"><span style="width:7px;height:7px;border-radius:50%;background:{T["acc"]}"></span>▶ looping · 2.3 / 4 · 92 BPM</span><span class="chip">🔒 Loop · on Play</span><div style="margin-left:auto;display:flex;gap:6px"><div class="btn" style="padding:0 12px">↶ <span class="mono dim" style="font-size:11px;margin-left:6px">Ctrl/Cmd+Z</span></div><div class="btn" style="padding:0 12px">↷ <span class="mono dim" style="font-size:11px;margin-left:6px">⇧+Ctrl/Cmd+Z</span></div></div></div>')
    o.append(f'<div class="ab" style="left:20px;top:80px;width:200px">'+''.join(f'<div class="btn{" on" if i==0 else ""}" style="height:48px;margin-bottom:8px;justify-content:flex-start;padding:0 12px;gap:8px;font-size:13px"><span style="color:{T["lay"][i]}">{g}</span>{n}</div>' for i,(g,n) in enumerate([('◆','1 Piano · editing'),('▬','2 Bass'),('●','3 Drums')]))+f'<div class="mute" style="font-size:12px;margin-top:8px">◐ Others shown as ghosts</div></div>')
    o.append(f'<div class="ab" style="left:20px;top:300px;width:200px"><div class="lbl" style="margin-bottom:8px">Tools</div>'+''.join(f'<div class="btn{" on" if k=="S" else ""}" style="height:44px;margin-bottom:6px;justify-content:space-between;padding:0 12px;font-size:13px">{n}<span class="mono dim" style="font-size:11px">{k}</span></div>' for n,k in [('✎ Draw','D'),('⬚ Select','S'),('⌫ Erase','E')])+'</div>')
    # big grid: 4 bars
    gx,gy,gw,gh=280,108,880,560; lo,hi=LO,HI; row=gh/(hi-lo+1); X=lambda b: gx+b/16*gw; Y=lambda p: gy+(hi-p)*row
    o.append(f'<div class="ab" style="left:{gx}px;top:{gy-28}px;width:{gw}px;height:28px;background:{T["surf"]};border:1px solid {T["line"]};border-bottom:none;border-radius:8px 8px 0 0"></div>')
    for b in range(16):
        o.append(f'<div class="ab mono" style="left:{X(b)+4:.0f}px;top:{gy-22}px;font-size:{11 if b%4==0 else 9}px;color:{T["text"] if b%4==0 else T["dim"]}">{b//4+1 if b%4==0 else "."+str(b%4+1)}</div>')
    o.append(f'<div class="ab" style="left:{gx}px;top:{gy}px;width:{gw}px;height:{gh}px;background:{T["well"]};border:1px solid {T["line"]}"></div>')
    for p in range(hi,lo-1,-1):
        blk=(p%12) in (1,3,6,8,10)
        o.append(f'<div class="ab" style="left:{gx-46}px;top:{Y(p):.1f}px;width:44px;height:{row-1:.1f}px;background:{T["surf2"] if blk else T["surf"]};border-radius:3px"></div>')
        if p%12==0: o.append(f'<div class="ab mono" style="left:{gx-42}px;top:{Y(p)+row/2-6:.1f}px;font-size:10px;color:{T["mute"]}">C{p//12-1}</div>')
    for b in range(64):
        bb=b/4; op=1 if b%16==0 else (.5 if b%4==0 else .15)
        o.append(f'<div class="ab" style="left:{X(bb):.1f}px;top:{gy}px;width:1px;height:{gh}px;background:{T["mute"] if op==1 else T["line"]};opacity:{op}"></div>')
    allp=[n for n in music.piano()]; sel={i for i,n in enumerate(allp) if n[3]==92 and 4<=n[0]<8}
    for i,(s,d,p,v) in enumerate(allp):
        if p<lo or p>hi: continue
        on=i in sel; xx=X(s); w=d/16*gw-2
        o.append(f'<div class="ab" style="left:{xx:.1f}px;top:{Y(p)+1:.1f}px;width:{w:.1f}px;height:{row-2:.1f}px;border-radius:3px;background:{T["lay"][0]};opacity:{1 if on else 0.55+0.4*v/127:.2f};{("box-shadow:0 0 0 2px "+T["well"]+",0 0 0 3.5px "+T["text"]) if on else ""}">'+(f'<span class="mono" style="font-size:9.5px;font-weight:700;margin-left:4px;color:{T["bg"] if T.get("dark") else T["surf"]}">{nn(p)}</span>' if on else '')+'</div>')
    o.append(f'<div class="ab" style="left:{X(9.2)-1:.0f}px;top:{gy-28}px;width:2px;height:{gh+28}px;background:{T["acc"]}"></div>')
    # mouse cursor + tooltip
    cx,cy=X(6.0)+20,Y(69)+6
    o.append(f'<div class="ab" style="left:{cx}px;top:{cy}px;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:18px solid {T["text"]};transform:rotate(-30deg)"></div>')
    o.append(f'<div class="ab" style="left:{cx+18}px;top:{cy+16}px;font-size:11.5px;padding:6px 10px;border-radius:8px;background:{T["text"]};color:{T["bg"]};white-space:nowrap">A4 · bar 2.3 · vel 92 · drag = move · edge = resize · Alt+drag = no snap</div>')
    # velocity lane
    vy=gy+gh+16; vh=110
    o.append(f'<div class="ab" style="left:{gx}px;top:{vy}px;width:{gw}px;height:{vh}px;border-radius:0 0 10px 10px;background:{T["surf"]};border:1px solid {T["line"]}"></div><div class="ab lbl" style="left:{gx+10}px;top:{vy+8}px">Velocity · 3 selected · 92 avg</div>')
    for i,(s,d,p,v) in enumerate(allp):
        on=i in sel; hh=(vh-36)*v/127
        o.append(f'<div class="ab" style="left:{X(s)+1:.1f}px;top:{vy+vh-8-hh:.1f}px;width:{6 if on else 4}px;height:{hh:.1f}px;background:{T["lay"][0] if on else T["dim"]};opacity:{1 if on else .45}"></div>')
    # right inspector
    rx=1190
    o.append(f'''<div class="ab" style="left:{rx}px;top:80px;width:230px;border-radius:16px;background:{T['surf']};border:1px solid {T['line']};padding:14px;font-size:12.5px">
<div class="lbl">Quantise (Q)</div><div style="margin-top:8px">Scope: <b>Selected · 3</b> / Whole layer</div><div style="margin-top:6px">Grid 1/16 · Strength 50% · Swing 0%</div><div class="mute" style="margin-top:6px">Preview first; originals kept as ghosts.</div>
<div style="display:flex;gap:6px;margin-top:10px"><div class="btn" style="flex:1;font-size:12px">Preview</div><div class="btn pri" style="flex:1;font-size:12px">Apply ↵</div></div></div>
<div class="ab" style="left:{rx}px;top:300px;width:230px;font-size:12px;line-height:1.85"><div class="lbl" style="margin-bottom:6px">Keyboard (proposed)</div>
<span class="mono">D S E</span> Draw · Select · Erase<br><span class="mono">↑ ↓</span> pitch ±1 · <span class="mono">⇧↑↓</span> octave<br><span class="mono">← →</span> move by grid · <span class="mono">Alt</span> no snap<br><span class="mono">⇧← →</span> shorten / lengthen<br><span class="mono">Ctrl/Cmd+A C V D</span> all · copy · paste · dup<br><span class="mono">Del</span> delete · <span class="mono">Q</span> quantise preview<br><span class="mono">V</span> then <span class="mono">↑ ↓</span> velocity ±5<br><span class="mono">Space</span> play / stop · <span class="mono">Esc</span> back to Play<br><span class="mono">Ctrl/Cmd+wheel</span> zoom · <span class="mono">wheel</span> scroll</div>''')
    o.append(f'<div class="ab mono dim" style="left:{gx}px;top:{H-26}px;font-size:10px">{FOOT} · mouse: drag empty = marquee · Shift+click add · double-click chord</div>')
    return dict(html=frame(FM.CUR[0],W,H,''.join(o)),W=W,H=H)

EALT={'18-editor-select':[('fold-18-editor','Fold expanded'),('desktop-18-editor','Desktop browser')]}
FM.FR.update({'17-editor-entry':e_entry,'18-editor-select':e_select,'19-editor-move':e_move,'20-editor-marquee':e_marquee,'21-editor-resize':e_resize,
 '22-editor-draw':e_draw,'23-editor-erase':e_erase,'24-editor-velocity':e_vel,'25-editor-quantise':e_quant,'26-editor-overflow':e_overflow,'27-editor-return':e_return,
 'fold-18-editor':fold_editor,'desktop-18-editor':desktop_editor})

EROLES={**{n:{'tool-draw':'22-editor-draw','tool-select':'18-editor-select','tool-erase':'23-editor-erase','back':'27-editor-return'} for n,*_ in ESTEPS[1:-1]}}
EROLES['17-editor-entry']={'edit-entry':'18-editor-select'}
EROLES['18-editor-select'].update({'ctx-velocity':'24-editor-velocity','ctx-quantise':'25-editor-quantise','ctx-more':'26-editor-overflow'})
EROLES['21-editor-resize'].update({'ctx-velocity':'24-editor-velocity','ctx-quantise':'25-editor-quantise','ctx-more':'26-editor-overflow'})
EROLES['26-editor-overflow'].update({'ctx-more':'18-editor-select','ctx-velocity':'24-editor-velocity','ctx-quantise':'25-editor-quantise'})
EROLES['25-editor-quantise']={'q-cancel':'18-editor-select','q-apply':'27-editor-return','back':'27-editor-return'}
EROLES['27-editor-return']={'undo':'17-editor-entry'}
_G=geo(**STD)
def egeom(n):
    mode={'22-editor-draw':'draw','23-editor-erase':'erase'}.get(n,'select')
    if n in ('17-editor-entry','27-editor-return'): return None
    return dict(editor=True,mode=mode,vel=(n=='24-editor-velocity'),quant=(n=='25-editor-quantise'))
