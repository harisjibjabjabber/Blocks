"""Build all hi-fi assets: editable HTML sources + 2x PNGs + self-contained prototype. PROPOSED design only."""
import os,sys,json,base64,io
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from large import *
import phoneB
from render import shot
from contrast import report
ROOT=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..'))  # package-relative (rev 3.2.1)
D=lambda *p: os.path.join(ROOT,*p)
TAGLINE='PROPOSED — not implemented · design / example data'

STEPS=[
 ('01-free-play','Play freely','Nothing to arm. Haris noodles a ii–V–I in C on Warm EP; Blocks keeps a rolling history (proposed 120 s target) and shows the last phrase.','0 touches'),
 ('02-capture-proposal','Capture → loop at once','One tap on Capture (or an optional mapped CC/button). The phrase loops immediately and is already kept; tempo/loop proposal is nonblocking with ½ · ×2 · Set always present.','1 touch'),
 ('03-no-steady-pulse','Honest “no steady pulse”','A rubato phrase gets no fake tempo or confidence score: it loops in free time exactly as played. Tap or type a tempo only if wanted.','0–1 touches'),
 ('04-bass-over-loop','Bass over the looping piano','Change the next layer\'s sound to Bass (placeholder) and play along. Sketch tempo is locked at 92; the bracket shows what a capture would keep.','1 touch (sound)'),
 ('05-bass-captured-undo','Capture bass, in sync','Second Capture lands on the locked grid: phase accepted, joins at the next bar 1 (queued). Beat nudges and Undo sit in the thumb zone.','1 touch (+1 nudge/undo)'),
 ('06-drums','Drums','On-screen pads (touch events tagged “screen”, same capture pipeline) or a MIDI pad controller. Captured to Layer 3; every layer stays visible.','pads + 1 touch'),
 ('07-edit-quantise','Optional: edit & quantise','Select 4 notes, 1/8 at 50%. Dashed = where you played, solid = result. The original take is kept; Revert any time.','≈4 touches'),
]
ALT={'05-bass-captured-undo':('fold-05-bass-captured','Fold expanded'),'07-edit-quantise':('desktop-07-edit-quantise','Desktop browser')}

def font_css():
    from fontTools import subset
    from fontTools.ttLib import TTFont
    # Package-local copies (SIL OFL 1.1, licences beside each font) so the archive rebuilds without the original box.
    base=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','fonts')+'/'
    if not os.path.isdir(base): base='/usr/share/fonts/truetype/sand-box/google/'
    fonts=[('Inter Tight','Inter Tight/InterTight-VariableFont_wght.ttf','normal','100 900'),
           ('Geist Mono','Geist Mono/GeistMono-VariableFont_wght.ttf','normal','100 900'),
           ('Instrument Serif','Instrument Serif/InstrumentSerif-Regular.ttf','normal','400'),
           ('Instrument Serif','Instrument Serif/InstrumentSerif-Italic.ttf','italic','400'),
           ('Instrument Sans','Instrument Sans/InstrumentSans-VariableFont_wdth,wght.ttf','normal','100 900'),
           ('IBM Plex Mono','IBM Plex Mono/IBMPlexMono-Regular.ttf','normal','400')]
    out=[]
    for fam,path,style,wt in fonts:
        p=base+path
        if not os.path.exists(p): continue
        f=TTFont(p); o=subset.Options(); o.flavor='woff'; o.layout_features=['*']
        s=subset.Subsetter(o); s.populate(unicodes=list(range(0x20,0x7f))+list(range(0xa0,0x180))+[0x2013,0x2014,0x2018,0x2019,0x201c,0x201d,0x2022,0x2026,0x2192,0x2212,0x266d,0x266f,0x00bd,0x00d7])
        s.subset(f); b=io.BytesIO(); f.flavor='woff'; f.save(b)
        out.append(f"@font-face{{font-family:'{fam}';font-style:{style};font-weight:{wt};src:url(data:font/woff;base64,{base64.b64encode(b.getvalue()).decode()}) format('woff')}}")
    return '\n'.join(out)

def standalone(t,inner,w,h,path,png):
    open(path,'w').write(page(t,inner)); shot(path,png,w,h)

def present(t,inner,w,h,num,title,body,touch,path,png,ff):
    T=T_(t); PW=w+96; PH=h+250
    cap=f'''<div style="position:absolute;left:48px;top:{h+72}px;width:{w}px;font-family:{T['font']};color:{T['text']}">
<div style="display:flex;gap:10px;align-items:baseline"><span style="font-family:{T['mono']};font-size:13px;color:{T['acc']}">{num}</span><span style="font-size:20px;font-weight:650">{E(title)}</span></div><div style="font-family:{T['mono']};font-size:11px;color:{T['mute']};margin-top:6px">{ff} · est. {E(touch)}</div>
<div style="font-size:14px;line-height:1.5;color:{T['mute']};margin-top:8px">{E(body)}</div>
<div style="font-family:{T['mono']};font-size:10.5px;letter-spacing:.06em;color:{T['dim']};margin-top:10px;text-transform:uppercase">{TAGLINE}</div></div>'''
    rad=44 if w<500 else (28 if w<1000 else 14)
    dev=f'<div style="position:absolute;left:44px;top:44px;padding:4px;border-radius:{rad+4}px;background:#22262D;box-shadow:0 30px 80px -30px rgba(0,0,0,.8),0 0 0 1px #2E333B"><div style="border-radius:{rad}px;overflow:hidden">{inner}</div></div>'
    html=page(t,f'<div class="th{t}" style="position:relative;width:{PW}px;height:{PH}px;background:{"radial-gradient(1200px 700px at 30% 0%,#15181D,#07080A)" if T.get("dark") else "radial-gradient(1200px 700px at 30% 0%,#FBF7EF,#E2DACB)"}">{dev}{cap}</div>')
    open(path,'w').write(html); shot(path,png,PW,PH)

def board(t,name,title,sub,phones,bullets,extra=''):
    T=T_(t); W=1680; H=1180
    sw=''.join(f'<div style="display:flex;align-items:center;gap:10px;margin:6px 0"><div style="width:30px;height:30px;border-radius:8px;background:{T[k]};border:1px solid {T["line"]}"></div><div style="font-family:{T["mono"]};font-size:12px;color:{T["mute"]}">{lab} <span style="color:{T["text"]}">{T[k]}</span></div></div>' for k,lab in [('bg','Stage'),('surf','Surface'),('text','Ink'),('mute','Muted'),('acc','Accent · Capture & time')])
    lays=''.join(f'<div style="display:flex;align-items:center;gap:8px;margin:5px 0;font-size:12.5px;color:{T["mute"]}"><span style="width:22px;height:8px;border-radius:2px;background:{c}"></span>{n}</div>' for c,n in zip(T['lay'],['Layer 1 · Piano  ◆ / I','Layer 2 · Bass  ▬ / II','Layer 3 · Drums  ● / III','Layer 4  + / IV']))
    ph=''.join(f'<div style="padding:4px;border-radius:48px;background:{"#22262D" if t=="A" else "#1E1C17"};box-shadow:0 40px 90px -40px rgba(0,0,0,.7)"><div style="border-radius:44px;overflow:hidden">{p}</div></div>' for p in phones)
    bl=''.join(f'<li style="margin:0 0 10px">{b}</li>' for b in bullets)
    bgc='radial-gradient(1400px 900px at 20% 0%,#171A20,#060708)' if t=='A' else 'radial-gradient(1400px 900px at 20% 0%,#FBF7EF,#E2DACB)'
    html=page(t,f'''<div class="th{t}" style="position:relative;width:{W}px;height:{H}px;background:{bgc};font-family:{T['font']};color:{T['text']}">
<div style="position:absolute;left:64px;top:56px;right:64px;display:flex;justify-content:space-between;align-items:flex-end">
<div><div style="font-family:{T['mono']};font-size:12px;letter-spacing:.12em;color:{T['acc']};text-transform:uppercase">Blocks · visual direction {t}</div>
<div class="disp" style="font-size:{60 if t=='B' else 52}px;font-weight:{400 if t=='B' else 650};letter-spacing:-.02em;margin-top:10px;line-height:1">{title}</div>
<div style="font-size:17px;color:{T['mute']};margin-top:12px">{sub}</div></div>
<div style="font-family:{T['mono']};font-size:11px;letter-spacing:.08em;color:{T['mute']};text-transform:uppercase;text-align:right;line-height:1.7">{TAGLINE}<br>phone 390×844 dp · rendered @2x</div></div>
<div style="position:absolute;left:64px;top:220px;display:flex;gap:36px">{ph}</div>
<div style="position:absolute;left:{64+2*(398+36)+24}px;top:226px;width:{W-64-(64+2*(398+36)+24)}px">
<div class="lbl" style="margin-bottom:10px">Why it works</div><ul style="padding-left:18px;margin:0;font-size:15px;line-height:1.5">{bl}</ul>
<div class="lbl" style="margin:22px 0 6px">Palette</div>{sw}
<div class="lbl" style="margin:18px 0 6px">Layers · hue + glyph + number (never colour alone)</div>{lays}
<div class="lbl" style="margin:18px 0 6px">Type</div>
<div class="disp" style="font-size:30px;line-height:1.1">{'Sketch 14' if t=='B' else 'Sketch 14'}</div><div class="chord" style="font-size:24px;margin-top:2px">Dm9 · G13 · Cmaj9 · A7♭9</div><div class="mono" style="font-size:14px;color:{T['mute']};margin-top:4px">92 BPM · 4/4 · bar 3.4</div>
{extra}</div></div>''')
    p=D('directions',name+'.html'); open(p,'w').write(html); shot(p,D('directions',name+'.png'),W,H)

def build():
    os.makedirs(D('storyboard','src'),exist_ok=True); os.makedirs(D('directions'),exist_ok=True); os.makedirs(D('prototype'),exist_ok=True)
    frames={}
    for n,title,body,touch in STEPS:
        s=FR[n](); html=s['html'] if 'html' in s else phone(s,CUR[0]); frames[n]=(html,390,844)
    for n,_ in ALT.values():
        s=FR[n](); frames[n]=(s['html'],s['W'],s['H'])
    # storyboard sources + presentation PNGs
    for i,(n,title,body,touch) in enumerate(STEPS):
        html,w,h=frames[n]
        standalone('A',html,w,h,D('storyboard','src',n+'.html'),D('storyboard','src',n+'@2x.png'))
        present('A',html,w,h,f'{i+1:02d}',title,body,touch,D('storyboard','src',n+'.board.html'),D('storyboard',n+'.png'),'phone · 390×844 dp')
        if n in ALT:
            an,ff=ALT[n]; ah,aw,ahh=frames[an]
            standalone('A',ah,aw,ahh,D('storyboard','src',an+'.html'),D('storyboard','src',an+'@2x.png'))
            present('A',ah,aw,ahh,f'{i+1:02d}',title+' — '+ff,body,touch,D('storyboard','src',an+'.board.html'),D('storyboard',an+'.png'),ff+(' · ≈840×1000 dp' if 'Fold' in ff else ' · 1440×900'))
    # directions
    A1=frames['04-bass-over-loop'][0]; A2=frames['02-capture-proposal'][0]
    B1=phoneB.heroB(); B2=phoneB.proposalB()
    standalone('B',B1,390,844,D('directions','B-hero-bass-over-loop.html'),D('directions','B-hero-bass-over-loop@2x.png'))
    standalone('B',B2,390,844,D('directions','B-capture-proposal.html'),D('directions','B-capture-proposal@2x.png'))
    board('A','direction-A-graphite-studio','Graphite Studio','Dark instrument. Graphite stage, warm “ember” accent reserved for Capture and time.',[A1,A2],[
      'Built for dim rooms and stages: notes glow against graphite, nothing glares at arm’s length.',
      'Layers are always on screen as lanes with live mini-rolls; the next capture slot is outlined in the accent.',
      'Thumb zone owns the verbs: Capture capsule, Undo, sound, optional Stop.',
      'Chord names in a serif italic give the jazz sketch some voice without decoration.',
      'Accent means “now / Capture / time” only — never a status colour.'])
    board('B','direction-B-paper-score','Paper Score','Light editorial. Warm paper, ink staves, one vermilion mark for Capture and time.',[B1,B2],[
      'Reads like a lead sheet: Roman-numeral staves (I–IV) and serif chord names — calm and literate.',
      'Strong in daylight and for review / export sheets; prints well.',
      'Capture is a single ink disc; Undo and optional Stop flank it at thumb height.',
      'Trade-off: bright page at night, lower note contrast for faint layers, less “instrument”.',
      'Good candidate for a later light theme or the export / share view.'])
    # compare + recommendation
    T=T_('A'); W,H=1680,1100
    cmp=page('A',f'''<div class="thA" style="position:relative;width:{W}px;height:{H}px;background:linear-gradient(90deg,#08090B 50%,#ECE5D8 50%);font-family:{T['font']}">
<div style="position:absolute;left:60px;top:50px;color:#EEF0F3"><div class="mono acc" style="font-size:12px;letter-spacing:.12em">A · GRAPHITE STUDIO — RECOMMENDED</div><div style="font-size:40px;font-weight:650;margin-top:8px;letter-spacing:-.02em">The instrument.</div></div>
<div style="position:absolute;left:900px;top:50px;color:#17150F;font-family:'Instrument Sans'"><div style="font-family:'IBM Plex Mono';font-size:12px;letter-spacing:.12em;color:#B8321C">B · PAPER SCORE — ALTERNATIVE</div><div style="font-family:'Instrument Serif';font-size:46px;margin-top:6px">The lead sheet.</div></div>
<div style="position:absolute;left:60px;top:170px;display:flex;gap:28px"><div style="padding:4px;border-radius:48px;background:#22262D"><div style="border-radius:44px;overflow:hidden">{A1}</div></div>
<div style="width:300px;color:#A0A8B3;font-size:15px;line-height:1.55;padding-top:10px"><b style="color:#EEF0F3">Why A.</b> Haris plays in dim rooms and on stage; graphite keeps four layers legible at arm’s length with hue + glyph + number. It feels like hardware, the accent stays meaningful (Capture, playhead, next slot), and the dark stage suits OLED phones and Folds on a stand.<br><br><b style="color:#EEF0F3">Borrowed from B:</b> serif chord names and the calmer copy voice.</div></div>
<div style="position:absolute;left:900px;top:170px;display:flex;gap:28px"><div style="padding:4px;border-radius:48px;background:#1E1C17"><div style="border-radius:44px;overflow:hidden">{B1}</div></div>
<div style="width:300px;color:#625D52;font-size:15px;line-height:1.55;padding-top:10px;font-family:'Instrument Sans'"><b style="color:#17150F">Keep B for</b> a later light theme and for the review / export / share sheet, where reading beats playing.<br><br>Both directions keep 48 dp targets, WCAG AA text, non-colour cues and the same layout logic.</div></div>
<div class="mono" style="position:absolute;left:60px;bottom:28px;font-size:11px;letter-spacing:.08em;color:#848C97">{TAGLINE.upper()}</div></div>''')
    p=D('directions','A-vs-B-recommendation.html'); open(p,'w').write(cmp); shot(p,D('directions','A-vs-B-recommendation.png'),W,H)
    # storyboard overview sheet
    sc=0.56; cw=int(390*sc); W=60*2+7*cw+6*28; H=1560
    cells=''
    for i,(n,title,body,touch) in enumerate(STEPS):
        cells+=f'''<div style="position:absolute;left:{60+i*(cw+28)}px;top:150px;width:{cw}px"><div style="width:{cw}px;height:{int(844*sc)}px;border-radius:26px;overflow:hidden;box-shadow:0 0 0 3px #22262D"><div style="transform:scale({sc});transform-origin:0 0">{frames[n][0]}</div></div>
<div class="mono acc" style="font-size:12px;margin-top:16px">{i+1:02d} · est. {E(touch)}</div><div style="font-size:16px;font-weight:650;margin-top:4px;color:#EEF0F3">{E(title)}</div><div style="font-size:12px;line-height:1.45;color:#A0A8B3;margin-top:6px">{E(body)}</div></div>'''
        if i<6: cells+=f'<div class="ab" style="left:{60+i*(cw+28)+cw+6}px;top:{150+int(844*sc/2)-8}px;color:#848C97;font-size:16px">→</div>'
    fh,fw,fhh=frames['fold-05-bass-captured']; dh,dw,dhh=frames['desktop-07-edit-quantise']
    fs=0.5; ds=0.52
    cells+=f'''<div class="ab" style="left:60px;top:900px"><div class="mono acc" style="font-size:12px;margin-bottom:10px">05 · FOLD EXPANDED ≈840×1000 dp</div><div style="width:{int(fw*fs)}px;height:{int(fhh*fs)}px;border-radius:18px;overflow:hidden;box-shadow:0 0 0 3px #22262D"><div style="transform:scale({fs});transform-origin:0 0">{fh}</div></div></div>
<div class="ab" style="left:{60+int(fw*fs)+60}px;top:900px"><div class="mono acc" style="font-size:12px;margin-bottom:10px">07 · DESKTOP BROWSER 1440×900</div><div style="width:{int(dw*ds)}px;height:{int(dhh*ds)}px;border-radius:12px;overflow:hidden;box-shadow:0 0 0 3px #22262D"><div style="transform:scale({ds});transform-origin:0 0">{dh}</div></div></div>'''
    ov=page('A',f'''<div class="thA" style="position:relative;width:{W}px;height:{H}px;background:radial-gradient(1600px 900px at 30% 0%,#15181D,#060708);font-family:{T['font']}">
<div class="ab" style="left:60px;top:44px"><div class="mono acc" style="font-size:12px;letter-spacing:.12em">BLOCKS · STORYBOARD · DIRECTION A</div><div style="font-size:40px;font-weight:650;color:#EEF0F3;margin-top:8px;letter-spacing:-.02em">From noodling to a three-layer sketch — no arm, no record, no stop.</div></div>
<div class="ab mono" style="right:60px;top:52px;font-size:11px;color:#A0A8B3;text-align:right;line-height:1.7;letter-spacing:.06em">{TAGLINE.upper()}<br>INTERACTION COUNTS ARE ESTIMATES, NOT TEST RESULTS</div>{cells}</div>''')
    p=D('storyboard','storyboard-overview.html'); open(p,'w').write(ov); shot(p,D('storyboard','storyboard-overview.png'),W,H)
    return frames

def prototype(frames,light=None,label='Direction A · Graphite Studio',steps=None,alts=None,roles=None,geoms=None):
    fc=font_css()
    HOT={'01-free-play':[(16,720,358,84,'02-capture-proposal','Capture')],
         '02-capture-proposal':[(16,720,358,84,'04-bass-over-loop','Capture'),(300,520,70,40,'03-no-steady-pulse','Discard (shows no-pulse variant)')],
         '03-no-steady-pulse':[(16,720,358,84,'04-bass-over-loop','Capture')],
         '04-bass-over-loop':[(16,720,358,84,'05-bass-captured-undo','Capture')],
         '05-bass-captured-undo':[(279,656,82,48,'04-bass-over-loop','Undo'),(16,720,358,84,'06-drums','Capture')],
         '06-drums':[(16,720,358,84,'07-edit-quantise','Capture')],
         '07-edit-quantise':[(16,52,90,48,'06-drums','Done')]}
    slides=[]
    steps=steps or STEPS; alts=alts or {k:[v] for k,v in ALT.items()}
    for i,(n,title,body,touch) in enumerate(steps):
        al=[dict(id=a[0],label=a[1],w=frames[a[0]][1],h=frames[a[0]][2],html=frames[a[0]][0],html_l=(light[a[0]][0] if light else None)) for a in alts.get(n,[])]
        slides.append(dict(id=n,num=n[:3].strip('-').upper(),title=title,body=body,touch=touch,w=390,h=844,html=frames[n][0],html_l=(light[n][0] if light else None),hot=HOT.get(n,[]),roles=(roles or {}).get(n,{}),geom=(geoms or {}).get(n),alts=al))
    T=T_('A')
    html=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Blocks — storyboard prototype (simulation)</title><style>{fc}
html,body{{margin:0;height:100%;background:#060708;color:#EEF0F3;font-family:'Inter Tight',system-ui,sans-serif}}
{''.join(css(x) for x in THEMES)}
.app{{display:grid;grid-template-columns:1fr 360px;height:100vh}}
.stage{{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;background:radial-gradient(1200px 800px at 40% 10%,#15181D,#060708)}}
.dev{{padding:4px;border-radius:48px;background:#22262D;box-shadow:0 40px 100px -40px #000,0 0 0 1px #2E333B;transform-origin:center}}
.dev>.scr{{border-radius:44px;overflow:hidden;position:relative}}
.hot{{position:absolute;border-radius:24px;cursor:pointer;outline:2px dashed rgba(255,116,66,0);transition:outline-color .2s;background:transparent;border:0}}
.showhot .hot{{outline-color:rgba(255,116,66,.9)}}
.hot:focus-visible,.rolehot:focus-visible,[role=slider]:focus-visible{{outline:3px solid #fff}} .showhot .rolehot{{outline:2px dashed rgba(255,116,66,.9);outline-offset:2px}}
.side{{border-left:1px solid #272C35;padding:28px;overflow:auto;background:#0B0D10}}
.banner{{font:600 11px/1.5 'Geist Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#1A0D07;background:#FF7442;border-radius:10px;padding:10px 12px}}
.step{{display:flex;gap:10px;align-items:center;width:100%;min-height:48px;border-radius:12px;border:1px solid #272C35;background:transparent;color:#EEF0F3;font:inherit;font-size:14px;text-align:left;padding:8px 12px;margin:6px 0;cursor:pointer}}
.step[aria-current=true]{{background:#1B1F26;border-color:#EEF0F3}}
.step .n{{font-family:'Geist Mono',monospace;color:#FF7442;font-size:12px;width:22px}}
.nav{{display:flex;gap:8px;margin-top:16px}} .nav button,.seg button{{flex:1;min-height:48px;border-radius:12px;border:1px solid #272C35;background:#1B1F26;color:#EEF0F3;font:600 14px 'Inter Tight',sans-serif;cursor:pointer}}
.seg{{display:flex;gap:6px;margin-top:14px}} .seg button[aria-pressed=true]{{background:#EEF0F3;color:#0A0C0F}}
.cap{{color:#A0A8B3;font-size:14px;line-height:1.55;margin-top:10px}}
@media (max-width:900px){{.app{{grid-template-columns:1fr;grid-template-rows:auto auto}} .stage{{height:80vh}} .side{{border-left:0;border-top:1px solid #272C35}}}}
</style></head><body><div class="app"><main class="stage" id="stage" aria-live="polite"></main>
<aside class="side"><div class="banner">Simulation — not working MIDI/audio · PROPOSED design · design/example data</div>
<h1 style="font-size:22px;margin:20px 0 4px;letter-spacing:-.02em">Blocks storyboard</h1><div class="cap" style="margin-top:0">{label}. Click the highlighted hotspots (Capture, Undo, Done, Blocks ⌄ menu, Back to live, Boundaries/Slide, Appearance options), drag the range handles on 09–12 and 15, try the editor tools on 17–27, or use ← → keys.</div>
<div id="title" style="font-size:18px;font-weight:650;margin-top:20px"></div><div id="meta" class="mono" style="font-size:12px;color:#FF7442;margin-top:4px"></div><div id="body" class="cap"></div>
<div class="seg" id="seg"></div><div class="seg" id="tm"></div>
<div class="nav"><button id="prev">← Prev</button><button id="next">Next →</button></div>
<label style="display:flex;gap:10px;align-items:center;min-height:48px;margin-top:8px;color:#A0A8B3;font-size:13px"><input type="checkbox" id="hs" checked style="width:20px;height:20px"> Show hotspots</label>
<nav id="steps" aria-label="Storyboard steps" style="margin-top:8px"></nav>
<div class="cap" style="font-size:12px;margin-top:16px">Interaction counts are estimates, not test results. Sounds are placeholders (“Warm EP”, “Bass (placeholder)”, “Kit (placeholder)”). Device readiness shown is example data; the real app never shows MIDI as ready unless it is.</div></aside></div>
<script>
const S={json.dumps(slides)};
let i=0,view=0,tone=(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
const st=document.getElementById('stage');
function fit(w,h){{const r=st.getBoundingClientRect();return Math.min((r.width-48)/(w+8),(r.height-48)/(h+8),1.4);}}
function render(){{
 const s=S[i]; const v=(view>0&&s.alts[view-1])?s.alts[view-1]:s; const w=v.w,h=v.h;
 const rad=w<500?44:(w<1000?28:14);
 st.style.background=(tone==='light'&&s.html_l)?'radial-gradient(1200px 800px at 40% 10%,#FBF7EF,#DCD3C3)':'';
 st.innerHTML='<div class="dev" style="border-radius:'+(rad+4)+'px"><div class="scr" style="border-radius:'+rad+'px;width:'+w+'px;height:'+h+'px">'+((tone==='light'&&v.html_l)?v.html_l:v.html)+'</div></div>';
 const scr=st.querySelector('.scr');
 if(v===s) s.hot.forEach(([x,y,hw,hh,to,lab])=>{{const b=document.createElement('button');b.className='hot';b.style.cssText='left:'+x+'px;top:'+y+'px;width:'+hw+'px;height:'+hh+'px';b.setAttribute('aria-label',lab+' (simulated)');b.title=lab+' (simulated)';b.onclick=()=>go(S.findIndex(q=>q.id===to));scr.appendChild(b);}});
 if(v===s) Object.entries(s.roles).forEach(([role,to])=>{{scr.querySelectorAll('[data-role="'+role+'"]').forEach(el=>{{el.style.cursor='pointer';el.classList.add('rolehot');el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label',(el.textContent||role).trim()+' (simulated)');
   const act=()=>{{ if(to.startsWith('tone:')){{const t=to.slice(5);tone=(t==='system')?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;apl=t;render();}} else go(S.findIndex(q=>q.id===to)); }};
   el.addEventListener('click',act);el.addEventListener('keydown',e=>{{if(e.key==='Enter'||e.key===' '){{e.preventDefault();act();}}}});}});}});
 if(v===s&&s.geom) (s.geom.editor?edSim(scr,s.geom):dragSim(scr,s.geom));
 st.querySelector('.dev').style.transform='scale('+fit(w,h)+')';
 document.getElementById('title').textContent=s.num+' · '+s.title;
 document.getElementById('meta').textContent='est. '+s.touch+(view>0&&s.alts[view-1]?' · '+s.alts[view-1].label:' · phone')+(s.id.startsWith('08')?' · appearance: '+apl:'');
 document.getElementById('body').textContent=s.body+(s.geom?(s.geom.editor?(' Try it: '+(s.geom.vel?'drag the ⇕ pill up/down to scale the selected velocities.':s.geom.quant?'drag the Strength slider to move the preview between as-played and the grid; Apply or Cancel.':s.geom.mode==='draw'?'click empty grid to add a note.':s.geom.mode==='erase'?'click notes to erase them.':'tap a note to select (Shift adds), drag selected notes (snaps to rows and 1/16); switch tools in the toolbar.')):' Try it: drag the ⟦ Start or ⟧ End handle (snaps to onsets and bars; hold Shift for no snap; arrow keys when focused).'):'');
 const seg=document.getElementById('seg'); seg.innerHTML='';
 if(s.alts.length){{[['Phone'],...s.alts.map(a=>[a.label])].forEach(([l],k)=>{{const b=document.createElement('button');b.textContent=l;b.setAttribute('aria-pressed',view===k);b.onclick=()=>{{view=k;render();}};seg.appendChild(b);}});}}
 const tm=document.getElementById('tm'); tm.innerHTML=''; if(s.html_l){{[['dark','Dark'],['light','Light']].forEach(([k,l])=>{{const b=document.createElement('button');b.textContent=l;b.setAttribute('aria-pressed',tone===k);b.onclick=()=>{{tone=k;render();}};tm.appendChild(b);}});}}
 document.querySelectorAll('.step').forEach((b,k)=>b.setAttribute('aria-current',k===i));
}}
let apl='system';
function edSim(scr,g){{
 const gr=scr.querySelector('[data-role="grid"]'); if(!gr) return;
 const row=+gr.dataset.row,col=+gr.dataset.col; const sc=()=>scr.getBoundingClientRect().width/scr.offsetWidth;
 const notes=()=>[...scr.querySelectorAll('[data-note]')];
 const sel=n=>{{n.dataset.sel='1';n.style.boxShadow='0 0 0 2px transparent,0 0 0 3.5px currentColor';n.style.opacity=1;}};
 const uns=n=>{{delete n.dataset.sel;n.style.boxShadow='none';n.style.opacity=.8;}};
 let drag=null;
 if(g.mode==='select'&&!g.quant&&!g.vel){{
  notes().forEach(n=>{{n.style.cursor='grab';n.addEventListener('pointerdown',e=>{{e.preventDefault();e.stopPropagation();if(!n.dataset.sel){{if(!e.shiftKey)notes().forEach(uns);sel(n);}}
    drag={{x:e.clientX,y:e.clientY,it:notes().filter(m=>m.dataset.sel).map(m=>({{m,l:parseFloat(m.style.left),t:parseFloat(m.style.top)}}))}};}});}});
  gr.addEventListener('pointerdown',()=>notes().forEach(uns));
  scr.addEventListener('pointermove',e=>{{if(!drag)return;const k=sc();const dx=Math.round((e.clientX-drag.x)/k/col)*col,dy=Math.round((e.clientY-drag.y)/k/row)*row;drag.it.forEach(o=>{{o.m.style.left=(o.l+dx)+'px';o.m.style.top=(o.t+dy)+'px';}});
    document.getElementById('meta').textContent='moving '+drag.it.length+' note(s): '+(dy?((dy<0?'+':'−')+Math.round(Math.abs(dy)/row)+' st '):'')+(dx?((dx>0?'+':'−')+Math.round(Math.abs(dx)/col)+'/16'):'');}});
  scr.addEventListener('pointerup',()=>{{drag=null;}});
 }}
 if(g.mode==='erase') notes().forEach(n=>{{n.style.cursor='pointer';n.addEventListener('click',()=>{{n.style.opacity=.15;n.style.outline='1.5px dashed currentColor';}});}});
 if(g.mode==='draw'){{gr.style.cursor='crosshair';gr.addEventListener('click',e=>{{const r=gr.getBoundingClientRect(),k=sc();const x=Math.floor((e.clientX-r.left)/k/col)*col,y=Math.floor((e.clientY-r.top)/k/row)*row;
   const tpl=notes()[0];const d=document.createElement('div');d.className='ab';d.dataset.note='new';d.style.cssText=tpl.style.cssText;d.style.left=(+gr.dataset.gx+x)+'px';d.style.top=(+gr.dataset.gy+y+1)+'px';d.style.width=(col*2-1.5)+'px';d.style.height=(row-2)+'px';d.style.opacity=1;d.style.boxShadow='0 0 0 2px transparent,0 0 0 3.5px currentColor';gr.parentNode.appendChild(d);}});}}
 if(g.vel){{const pill=scr.querySelector('[data-role="vscale"]'),rd=scr.querySelector('[data-role="vread"]');const bars=[...scr.querySelectorAll('[data-vsel]')];let y0=null,f0=0.85,f=0.85;
   const apply=()=>{{let sum=0;bars.forEach(b=>{{const v=Math.min(127,Math.round(+b.dataset.v*f));sum+=v;const h=+b.dataset.bh*v/127;b.style.height=h+'px';b.style.top=(+b.dataset.base-h)+'px';}});rd.innerHTML='avg 78 → <b>'+Math.round(sum/bars.length)+'</b> · ×'+f.toFixed(2);}};
   pill.addEventListener('pointerdown',e=>{{y0=e.clientY;f0=f;e.preventDefault();}});scr.addEventListener('pointermove',e=>{{if(y0===null)return;f=Math.max(.3,Math.min(1.6,f0-(e.clientY-y0)/sc()/120));apply();}});scr.addEventListener('pointerup',()=>{{y0=null;}});}}
 if(g.quant){{const tr=scr.querySelector('[data-role="qstr"]'),fill=scr.querySelector('[data-role="qfill"]'),kn=scr.querySelector('[data-role="qknob"]'),val=scr.querySelector('[data-role="qval"]');let on=false;
   const set=e=>{{const r=tr.getBoundingClientRect();const p=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));fill.style.width=(p*100)+'%';kn.style.left='calc('+(p*100)+'% - 12px)';val.textContent=Math.round(p*100)+'%';
     scr.querySelectorAll('[data-q0]').forEach(n=>{{const a=+n.dataset.q0,b=+n.dataset.qg;n.style.left=(a+(b-a)*p)+'px';}});}};
   tr.addEventListener('pointerdown',e=>{{on=true;set(e);e.preventDefault();}});scr.addEventListener('pointermove',e=>{{if(on)set(e);}});scr.addEventListener('pointerup',()=>{{on=false;}});}}
}}
function dragSim(scr,g){{
 const roll=scr.querySelector('[data-role="roll"]'); if(!roll) return;
 const hs=roll.querySelector('[data-role="hs"]'),he=roll.querySelector('[data-role="he"]'),wash=roll.querySelector('[data-role="rwash"]'),band=roll.querySelector('[data-role="rband"]'),lab=roll.querySelector('[data-role="rlabel"]');
 let s0=g.s,e0=g.e; const X=b=>g.nx+(b-g.b0)/(g.b1-g.b0)*g.nw, B=x=>g.b0+(x-g.nx)/g.nw*(g.b1-g.b0);
 const snap=(b,free)=>{{if(free)return b;let best=b,d=g.free?0.5:0.75;g.snaps.forEach(q=>{{if(Math.abs(q-b)<d){{d=Math.abs(q-b);best=q;}}}});return best;}};
 const upd=()=>{{const xs=X(s0),xe=X(e0);hs.style.left=(xs-24)+'px';he.style.left=(xe-24)+'px';wash.style.left=band.style.left=xs+'px';wash.style.width=band.style.width=(xe-xs)+'px';
   const len=e0-s0; lab.textContent=g.free?(len.toFixed(1)+' s'):((Math.round(len/4*100)/100)+' bar'+(len===4?'':'s')+' · '+(drag==='hs'?'end fixed':drag==='he'?'start fixed':'edited'));
   roll.querySelectorAll('[data-on]').forEach(n=>{{const o=+n.dataset.on;n.style.opacity=(o>=s0-0.01&&o<e0)?0.95:0.32;}});}};
 let drag=null;
 [[hs,'hs'],[he,'he']].forEach(([el,k])=>{{el.setAttribute('tabindex','0');el.setAttribute('role','slider');el.setAttribute('aria-label',(k==='hs'?'Loop start':'Loop end')+' handle (simulated). Arrow keys: by note; Alt: beat; Shift: bar');
  el.addEventListener('pointerdown',e=>{{drag=k;el.setPointerCapture(e.pointerId);e.preventDefault();}});
  el.addEventListener('pointermove',e=>{{if(drag!==k)return;const r=roll.getBoundingClientRect();const sc=r.width/roll.offsetWidth;const b=snap(B((e.clientX-r.left)/sc),e.shiftKey);
    if(k==='hs')s0=Math.min(Math.max(b,g.b0),e0-(g.free?0.3:1)); else e0=Math.max(Math.min(b,g.b1),s0+(g.free?0.3:1)); upd();}});
  el.addEventListener('pointerup',()=>{{drag=null;}});
  el.addEventListener('keydown',e=>{{let st=0;if(e.key==='ArrowLeft')st=-1;if(e.key==='ArrowRight')st=1;if(!st)return;e.preventDefault();e.stopPropagation();drag=k;
    const step=g.free?0.25:(e.shiftKey?4:(e.altKey?1:null));let cur=k==='hs'?s0:e0;let nb;
    if(step)nb=cur+st*step; else {{const c=g.snaps.filter(q=>st>0?q>cur+0.01:q<cur-0.01);nb=c.length?(st>0?Math.min(...c):Math.max(...c)):cur;}}
    if(k==='hs')s0=Math.min(nb,e0-1); else e0=Math.max(nb,s0+1); upd();}});}});
}}
function go(k){{if(k<0||k>=S.length)return;i=k;view=0;render();}}
const nav=document.getElementById('steps');
S.forEach((s,k)=>{{const b=document.createElement('button');b.className='step';b.innerHTML='<span class="n">'+s.num+'</span>'+s.title+(s.alts.length?' <span style="margin-left:auto;color:#A0A8B3;font-size:11px">+ '+s.alts.map(a=>a.label).join(', ')+'</span>':'');b.onclick=()=>go(k);nav.appendChild(b);}});
document.getElementById('prev').onclick=()=>go(i-1);document.getElementById('next').onclick=()=>go(i+1);
document.getElementById('hs').onchange=e=>document.body.classList.toggle('showhot',e.target.checked);document.body.classList.add('showhot');
addEventListener('keydown',e=>{{if(e.target.getAttribute&&e.target.getAttribute('role')==='slider')return;if(e.key==='ArrowRight')go(i+1);if(e.key==='ArrowLeft')go(i-1);}});
addEventListener('resize',render);render();
</script></body></html>'''
    p=D('prototype','index.html'); open(p,'w').write(html)
    shot(p,D('prototype','prototype-preview.png'),1440,960)
    return p
    return p

if __name__=='__main__':
    fr=build(); prototype(fr)
    with open(D('contrast.tsv'),'w') as f:
        f.write('theme\tfg\tbg\tfg_hex\tbg_hex\tratio\tresult\n')
        for r in report(): f.write('\t'.join(map(str,r))+'\t'+('AA text' if r[5]>=4.5 else ('non-text 3:1' if r[5]>=3 else 'FAIL'))+'\n')
    print('built')
