"""Rev 3.1 HYBRID — Graphite Studio structure (IA, separate layer cards, controls) + Paper Score editorial character
(serif headings, italic chord names, stave hairlines inside layer cards, serif capture-proposal headlines). Dark + light. PROPOSED."""
import os,sys,json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import frames, rangeview, editor
from large import *
from build import STEPS,ALT,standalone,present,font_css,D,TAGLINE
from render import shot
VAR={'C':'dark','D':'light'}
def frames_for(t):
    frames.set_theme(t); out={}
    for n,*_ in STEPS:
        s=FR[n](); out[n]=(s['html'] if 'html' in s else phone(s,t),390,844)
    for n,_ in ALT.values():
        s=FR[n](); out[n]=(s['html'],s['W'],s['H'])
    for n,*_ in [rangeview.SET]+rangeview.RSTEPS:
        s=FR[n](); out[n]=(s['html'] if 'html' in s else phone(s,t),390,844)
    for n,ff in RALTS['11-range-drag-start']:
        s=FR[n](); out[n]=(s['html'],s['W'],s['H'])
    for n,*_ in editor.ESTEPS:
        s=FR[n](); out[n]=(s['html'],390,844)
    for n,ff in editor.EALT['18-editor-select']:
        s=FR[n](); out[n]=(s['html'],s['W'],s['H'])
    return out
RALTS={'11-range-drag-start':[('fold-11-range-drag','Fold expanded'),('desktop-11-range-drag','Desktop browser')],**editor.EALT}
ALLSTEPS=STEPS+[rangeview.SET]+rangeview.RSTEPS+editor.ESTEPS
ROLES={**{n:{'menu':'08-settings-appearance'} for n,*_ in STEPS},
  '08-settings-appearance':{'done':'01-free-play','ap-system':'tone:system','ap-light':'tone:light','ap-dark':'tone:dark'},
  '09-range-auto-success':{'menu':'08-settings-appearance'},
  '11-range-drag-start':{'live':'09-range-auto-success'},
  '12-range-four-chords':{'undo':'10-range-auto-too-short','live':'09-range-auto-success'},
  '13a-range-boundaries':{'mslide':'13b-range-slide-phase'},'13b-range-slide-phase':{'mbound':'13a-range-boundaries'},
  '15-range-free-time':{'live':'09-range-auto-success'},'16-range-zoom-snap':{'live':'09-range-auto-success'}}
GEOMS={n:rangeview.geom(n) for n,*_ in rangeview.RSTEPS if rangeview.geom(n)}
GEOMS.update({n:editor.egeom(n) for n,*_ in editor.ESTEPS if editor.egeom(n)})
for k,v in editor.EROLES.items(): ROLES.setdefault(k,{}).update(v)
def editor_overview(t,fr,path,png):
    T=T_(t); sc=0.5; cw=int(390*sc); seq=editor.ESTEPS; per=6; ph=int(844*sc)
    W=60*2+per*cw+(per-1)*28; rows=2; H=170+rows*(ph+230)+490
    dk=T['dark']; bez='#22262D' if dk else '#1E1C17'; cells=''
    for i,(n,title,body,touch) in enumerate(seq):
        r,c=divmod(i,per); x=60+c*(cw+28); y=170+r*(ph+230)
        cells+=f'''<div class="ab" style="left:{x}px;top:{y}px;width:{cw}px"><div style="width:{cw}px;height:{ph}px;border-radius:24px;overflow:hidden;box-shadow:0 0 0 3px {bez}"><div style="transform:scale({sc});transform-origin:0 0">{fr[n][0]}</div></div>
<div class="mono acc" style="font-size:11px;margin-top:12px">{n[:2]} · est. {E(touch)}</div><div class="disp" style="font-size:19px;margin-top:3px;line-height:1.1">{E(title)}</div><div class="mute" style="font-size:11px;line-height:1.4;margin-top:5px">{E(body)}</div></div>'''
    # last cell of row 2: quick-quantise recommendation
    x=60+5*(cw+28); y=170+(ph+230)
    cells+=f'''<div class="ab" style="left:{x}px;top:{y}px;width:{cw}px;height:{ph}px;border-radius:24px;border:1.5px dashed {T['line']};padding:16px;font-size:11.5px;line-height:1.5"><div class="lbl">Evaluated</div><div class="disp" style="font-size:22px;line-height:1.1;margin-top:6px">Quick Quantise on Play: not recommended</div>
<div class="mute" style="margin-top:8px">Scope is ambiguous on a multi-layer screen, strength needs a preview, it adds a control to the screen we keep simple, and it invites “fixing” takes mid-performance. Quantise stays two taps away: tap a layer → Quantise…, with preview, explicit scope and Undo. Revisit only if testing shows people hunt for it.</div></div>'''
    by=170+rows*(ph+230)+10; fs=.42; ds=.36
    fh,fw,fhh=fr['fold-18-editor']; dh,dw,dhh=fr['desktop-18-editor']
    cells+=f'''<div class="ab" style="left:60px;top:{by}px"><div class="mono acc" style="font-size:12px;margin-bottom:10px">18 · FOLD EXPANDED ≈840×1000 dp (assumed)</div><div style="width:{int(fw*fs)}px;height:{int(fhh*fs)}px;border-radius:16px;overflow:hidden;box-shadow:0 0 0 3px {bez}"><div style="transform:scale({fs});transform-origin:0 0">{fh}</div></div></div>
<div class="ab" style="left:{60+int(fw*fs)+50}px;top:{by}px"><div class="mono acc" style="font-size:12px;margin-bottom:10px">18 · DESKTOP BROWSER 1440×900 · KEYBOARD + MOUSE</div><div style="width:{int(dw*ds)}px;height:{int(dhh*ds)}px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 3px {bez}"><div style="transform:scale({ds});transform-origin:0 0">{dh}</div></div></div>'''
    bg='radial-gradient(1600px 900px at 30% 0%,#15181D,#060708)' if dk else 'radial-gradient(1600px 900px at 30% 0%,#FBF7EF,#E2DACB)'
    html=page(t,f'''<div class="th{t}" style="position:relative;width:{W}px;height:{H}px;background:{bg};color:{T['text']};font-family:{T['font']}">
<div class="ab" style="left:60px;top:36px"><div class="mono acc" style="font-size:12px;letter-spacing:.12em">REV 3.3 · FULL-SCREEN PIANO-ROLL EDITOR · HYBRID ({VAR[t].upper()})</div><div class="disp" style="font-size:44px;margin-top:8px;line-height:1">Edit the notes without stopping the loop.</div></div>
<div class="ab mono mute" style="left:60px;top:112px;font-size:10.5px;letter-spacing:.06em">PROPOSED · NOT IMPLEMENTED · DESIGN/EXAMPLE DATA · NO CLAIM THAT CAPTURE OR EDITING WORKS TODAY · 48 DP TARGETS PROVISIONAL</div>{cells}</div>''')
    open(path,'w').write(html); shot(path,png,W,H)

def range_overview(t,fr,path,png):
    T=T_(t); sc=0.5; cw=int(390*sc); seq=[rangeview.SET]+rangeview.RSTEPS; per=5
    W=60*2+per*cw+(per-1)*28; H=170+2*(int(844*sc)+240)
    dk=T['dark']; bez='#22262D' if dk else '#1E1C17'; cells=''
    for i,(n,title,body,touch) in enumerate(seq):
        r,c=divmod(i,per); x=60+c*(cw+28); y=170+r*(int(844*sc)+240)
        cells+=f'''<div class="ab" style="left:{x}px;top:{y}px;width:{cw}px"><div style="width:{cw}px;height:{int(844*sc)}px;border-radius:24px;overflow:hidden;box-shadow:0 0 0 3px {bez}"><div style="transform:scale({sc});transform-origin:0 0">{fr[n][0]}</div></div>
<div class="mono acc" style="font-size:11px;margin-top:12px">{n[:3].strip('-').upper()} · est. {E(touch)}</div><div class="disp" style="font-size:19px;margin-top:3px;line-height:1.1">{E(title)}</div><div class="mute" style="font-size:11px;line-height:1.4;margin-top:5px">{E(body)}</div></div>'''
    bg='radial-gradient(1600px 900px at 30% 0%,#15181D,#060708)' if dk else 'radial-gradient(1600px 900px at 30% 0%,#FBF7EF,#E2DACB)'
    html=page(t,f'''<div class="th{t}" style="position:relative;width:{W}px;height:{H}px;background:{bg};color:{T['text']};font-family:{T['font']}">
<div class="ab" style="left:60px;top:36px"><div class="mono acc" style="font-size:12px;letter-spacing:.12em">REV 3.2 · TAKE HISTORY + CAPTURE RANGE · SETTINGS · HYBRID ({VAR[t].upper()})</div><div class="disp" style="font-size:44px;margin-top:8px;line-height:1">The engine picks the phrase. Handles are for effortless correction.</div></div>
<div class="ab mono mute" style="left:60px;top:112px;font-size:10.5px;line-height:1.7;letter-spacing:.06em">PROPOSED · NOT IMPLEMENTED · DESIGN/EXAMPLE DATA · CHORD NAMES + ROLE TAGS = MOCK DATA, RECOGNITION UNDER RESEARCH</div>{cells}</div>''')
    open(path,'w').write(html); shot(path,png,W,H)

def overview(t,fr,path,png):
    T=T_(t); sc=0.56; cw=int(390*sc); W=60*2+7*cw+6*28; H=1500
    dk=T['dark']; bez='#22262D' if dk else '#1E1C17'
    cells=''
    for i,(n,title,body,touch) in enumerate(STEPS):
        cells+=f'''<div class="ab" style="left:{60+i*(cw+28)}px;top:150px;width:{cw}px"><div style="width:{cw}px;height:{int(844*sc)}px;border-radius:26px;overflow:hidden;box-shadow:0 0 0 3px {bez}"><div style="transform:scale({sc});transform-origin:0 0">{fr[n][0]}</div></div>
<div class="mono acc" style="font-size:12px;margin-top:16px">{i+1:02d} · est. {E(touch)}</div><div class="disp" style="font-size:22px;margin-top:4px;line-height:1.1">{E(title)}</div><div class="mute" style="font-size:12px;line-height:1.45;margin-top:6px">{E(body)}</div></div>'''
    fh,fw,fhh=fr['fold-05-bass-captured']; dh,dw,dhh=fr['desktop-07-edit-quantise']; fs=.5; ds=.52
    cells+=f'''<div class="ab" style="left:60px;top:880px"><div class="mono acc" style="font-size:12px;margin-bottom:10px">05 · FOLD EXPANDED ≈840×1000 dp</div><div style="width:{int(fw*fs)}px;height:{int(fhh*fs)}px;border-radius:18px;overflow:hidden;box-shadow:0 0 0 3px {bez}"><div style="transform:scale({fs});transform-origin:0 0">{fh}</div></div></div>
<div class="ab" style="left:{60+int(fw*fs)+60}px;top:880px"><div class="mono acc" style="font-size:12px;margin-bottom:10px">07 · DESKTOP BROWSER 1440×900</div><div style="width:{int(dw*ds)}px;height:{int(dhh*ds)}px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 3px {bez}"><div style="transform:scale({ds});transform-origin:0 0">{dh}</div></div></div>'''
    bg='radial-gradient(1600px 900px at 30% 0%,#15181D,#060708)' if dk else 'radial-gradient(1600px 900px at 30% 0%,#FBF7EF,#E2DACB)'
    html=page(t,f'''<div class="th{t}" style="position:relative;width:{W}px;height:{H}px;background:{bg};color:{T['text']};font-family:{T['font']}">
<div class="ab" style="left:60px;top:40px"><div class="mono acc" style="font-size:12px;letter-spacing:.12em">BLOCKS · STORYBOARD · HYBRID ({VAR[t].upper()}) — GRAPHITE STRUCTURE + PAPER CHARACTER</div><div class="disp" style="font-size:50px;margin-top:8px;line-height:1">From noodling to a three-layer sketch — no arm, no record, no stop.</div></div>
<div class="ab mono mute" style="right:60px;top:46px;font-size:11px;text-align:right;line-height:1.7;letter-spacing:.06em">{TAGLINE.upper()}<br>INTERACTION COUNTS ARE ESTIMATES, NOT TEST RESULTS</div>{cells}</div>''')
    open(path,'w').write(html); shot(path,png,W,H)
def pair_board(frc,frd,path,png):
    W,H=1760,1120
    a=frc['04-bass-over-loop'][0]; b=frd['04-bass-over-loop'][0]; a2=frc['02-capture-proposal'][0]; b2=frd['02-capture-proposal'][0]
    ph=lambda x,bz: f'<div style="padding:4px;border-radius:48px;background:{bz}"><div style="border-radius:44px;overflow:hidden">{x}</div></div>'
    html=page('C',f'''<div class="thC" style="position:relative;width:{W}px;height:{H}px;background:linear-gradient(90deg,#08090B 50%,#ECE5D8 50%);font-family:'Inter Tight'">
<div class="ab" style="left:40px;top:44px;color:#EEF0F3"><div class="mono acc" style="font-size:12px;letter-spacing:.12em">HYBRID · DARK (default for playing)</div><div class="disp" style="font-size:46px;margin-top:6px;line-height:1">One instrument, two lights.</div></div>
<div class="thD ab" style="left:920px;top:44px;color:#17150F"><div class="mono acc" style="font-size:12px;letter-spacing:.12em">HYBRID · LIGHT (daylight, review, export)</div><div class="disp" style="font-size:46px;margin-top:6px;line-height:1">Same structure, paper finish.</div></div>
<div class="ab" style="left:32px;top:170px;display:flex;gap:20px">{ph(a,'#22262D')}{ph(a2,'#22262D')}</div>
<div class="ab" style="left:912px;top:170px;display:flex;gap:20px">{ph(b,'#1E1C17')}{ph(b2,'#1E1C17')}</div>
<div class="ab mono" style="left:60px;bottom:30px;font-size:11px;letter-spacing:.08em;color:#848C97">{TAGLINE.upper()} · STRUCTURE FROM GRAPHITE STUDIO (IA, LAYER CARDS, CONTROLS) · CHARACTER FROM PAPER SCORE (SERIF HEADINGS, ITALIC CHORDS, STAVES IN LAYER CARDS)</div></div>''')
    open(path,'w').write(html); shot(path,png,W,H)
def proto(frc,frd):
    import build
    src=open(D('prototype','index.html')).read()
    return src
if __name__=='__main__':
    only=sys.argv[1:]
    res={}
    for t in ('C','D'):
        fr=frames_for(t); res[t]=fr; v=VAR[t]
        if only and 'quick' in only:
            for n in ('02-capture-proposal','04-bass-over-loop','05-bass-captured-undo','07-edit-quantise'):
                h,w,hh=fr[n]; standalone(t,h,w,hh,f'/tmp/h-{v}-{n}.html',f'/tmp/h-{v}-{n}.png')
            continue
        os.makedirs(D('hybrid',v,'src'),exist_ok=True)
        todo=[x for x in ALLSTEPS if not only or any(o in x[0] for o in only)]
        for i,(n,title,body,touch) in enumerate(todo):
            h,w,hh=fr[n]; num=n[:3].strip('-').upper()
            standalone(t,h,w,hh,D('hybrid',v,'src',n+'.html'),D('hybrid',v,'src',n+'@2x.png'))
            present(t,h,w,hh,num,title,body,touch,D('hybrid',v,'src',n+'.board.html'),D('hybrid',v,n+'.png'),f'phone · 390×844 dp · hybrid {v}')
            for an,ff in ([ALT[n]] if n in ALT else [])+RALTS.get(n,[]):
                ah,aw,ahh=fr[an]
                standalone(t,ah,aw,ahh,D('hybrid',v,'src',an+'.html'),D('hybrid',v,'src',an+'@2x.png'))
                present(t,ah,aw,ahh,num,title+' — '+ff,body,touch,D('hybrid',v,'src',an+'.board.html'),D('hybrid',v,an+'.png'),ff+' · hybrid '+v)
        if only: continue
        range_overview(t,fr,D('hybrid',v,'range-overview.html'),D('hybrid',v,'range-overview.png'))
        editor_overview(t,fr,D('hybrid',v,'editor-overview.html'),D('hybrid',v,'editor-overview.png'))
        overview(t,fr,D('hybrid',v,'storyboard-overview.html'),D('hybrid',v,'storyboard-overview.png'))
    if not only:
        pair_board(res['C'],res['D'],D('hybrid','hybrid-dark-vs-light.html'),D('hybrid','hybrid-dark-vs-light.png'))
        import build
        build.prototype(res['C'],res['D'],label='Hybrid: Graphite Studio structure + Paper Score character · Dark / Light · rev 3.2 adds Settings (08) and Take history + capture range (09–16); rev 3.3 adds the full-screen editor (17–27)',steps=ALLSTEPS,alts={**{k:[v] for k,v in ALT.items()},**RALTS},roles=ROLES,geoms=GEOMS)
    print('ok')
