"""Blocks hi-fi kit — PROPOSED visual design (not implemented). Emits HTML/CSS (editable vector source).
Two themes: A 'Graphite Studio' (dark instrument), B 'Paper Score' (light editorial)."""
import html, music
E=html.escape
THEMES={
 'A':dict(bg='#0A0C0F',surf='#14171C',surf2='#1B1F26',line='#272C35',text='#EEF0F3',mute='#A0A8B3',dim='#848C97',
          acc='#FF7442',accT='#1A0D07',well='#0E1014',
          lay=['#E8E1D1','#8FB3EA','#A8C8A0','#C9AEE6'],
          font="'Inter Tight','Inter',system-ui,sans-serif",mono="'Geist Mono','JetBrains Mono',monospace",disp="'Inter Tight','Inter',sans-serif"),
 'B':dict(bg='#F3EEE4',surf='#FBF8F2',surf2='#ECE6DA',line='#D9D1C1',text='#17150F',mute='#625D52',dim='#6A6458',
          acc='#B8321C',accT='#FFFFFF',well='#FBF8F2',
          lay=['#17150F','#2D4FB5','#4E7A3A','#7A3F8F'],
          font="'Instrument Sans','Inter',sans-serif",mono="'IBM Plex Mono',monospace",disp="'Instrument Serif','Newsreader',serif"),
}
# Rev 3.1 HYBRID (lead precedence): Graphite Studio structure + Paper Score editorial character, one system in dark and light.
THEMES['C']=dict(THEMES['A'],disp="'Instrument Serif','Newsreader',serif",hy=True,dark=True,ok='#58D68D',hit='#262B33',name='Hybrid · dark')
THEMES['D']=dict(bg='#F3EEE4',surf='#FBF8F2',surf2='#ECE6DA',line='#D9D1C1',text='#17150F',mute='#625D52',dim='#6A6458',
    acc='#B8321C',accT='#FFFFFF',well='#FFFDF8',lay=['#2A2621','#2D4FB5','#4E7A3A','#7A3F8F'],
    font=THEMES['A']['font'],mono=THEMES['A']['mono'],disp="'Instrument Serif','Newsreader',serif",hy=True,dark=False,ok='#2E7D4F',hit='#E3DCCD',name='Hybrid · light')
THEMES['A'].update(dark=True,ok='#58D68D',hit='#262B33'); THEMES['B'].update(dark=False,ok='#2E7D4F',hit='#E3DCCD')
def css(t):
    T=THEMES[t]; p=f'.th{t}'
    rules=f"""
{p}.f{{position:relative;overflow:hidden;background:{T['bg']};color:{T['text']};font-family:{T['font']};-webkit-font-smoothing:antialiased;font-feature-settings:'tnum' 1}}
{p} *,{p}.f{{box-sizing:border-box}}
{p} .ab{{position:absolute}}
{p} .mono{{font-family:{T['mono']};font-variant-numeric:tabular-nums}}
{p} .disp{{font-family:{T['disp']}}}
{p} .mute{{color:{T['mute']}}} {p} .dim{{color:{T['dim']}}} {p} .acc{{color:{T['acc']}}}
{p} .chip{{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:14px;border:1px solid {T['line']};font-size:12px;color:{T['mute']};background:{T['surf']};white-space:nowrap}}
{p} .btn{{display:flex;align-items:center;justify-content:center;border-radius:14px;border:1px solid {T['line']};background:{T['surf2']};color:{T['text']};font-size:14px;font-weight:600;height:48px;min-width:48px;white-space:nowrap}}
{p} .btn.pri{{background:{T['acc']};border-color:{T['acc']};color:{T['accT']}}}
{p} .btn.on{{border-color:{T['text']};box-shadow:inset 0 0 0 1px {T['text']}}}
{p} .lbl{{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:{T['mute']};font-weight:600}}
{p} .chord{{font-family:'Instrument Serif',serif;font-style:italic;letter-spacing:.01em}}
"""
    return rules
def T_(t): return THEMES[t]

def notes_html(notes,x,y,w,h,beats,lo,hi,col,minh=3,op=1.0,start=0,sel=None,ghost=False,radius=2,maxh=99):
    out=[]; rng=hi-lo+1; nh=min(maxh,max(minh,h/rng*0.9))
    for i,(s,d,p,v) in enumerate(notes):
        if s<start or s>=start+beats: continue
        xx=x+(s-start)/beats*w; ww=max(2.5,d/beats*w-1.2); yy=y+(hi-p)/rng*h
        o=op*(0.55+0.45*v/127)
        st=f"left:{xx:.1f}px;top:{yy:.1f}px;width:{ww:.1f}px;height:{nh:.1f}px;border-radius:{radius}px;background:{col};opacity:{o:.2f}"
        if ghost: st=f"left:{xx:.1f}px;top:{yy:.1f}px;width:{ww:.1f}px;height:{nh:.1f}px;border-radius:{radius}px;border:1px dashed {col};opacity:.7"
        if sel and i in sel: st+=";outline:2px solid #fff;outline-offset:1px"
        out.append(f'<div class="ab" style="{st}"></div>')
    return ''.join(out)

def drums_html(hits,x,y,w,h,beats,col,size=None):
    out=[]; rh=h/3
    for (b,row,v) in hits:
        if b>=beats: continue
        s=size or min(rh*0.62,7); xx=x+b/beats*w; yy=y+row*rh+rh/2-s/2
        shape='border-radius:50%' if row!=2 else 'border-radius:1.5px'
        if row==1: shape='border-radius:1.5px;transform:rotate(45deg)'
        out.append(f'<div class="ab" style="left:{xx:.1f}px;top:{yy:.1f}px;width:{s:.1f}px;height:{s:.1f}px;{shape};background:{col};opacity:{0.45+0.55*v:.2f}"></div>')
    return ''.join(out)

def bars_grid(x,y,w,h,bars,col,beatcol=None,sub=4):
    out=[]
    for i in range(bars*sub+1):
        xx=x+i/(bars*sub)*w; major=i%sub==0
        c=col if major else (beatcol or col)
        if not major and not beatcol: continue
        out.append(f'<div class="ab" style="left:{xx:.1f}px;top:{y}px;width:1px;height:{h}px;background:{c}"></div>')
    return ''.join(out)

def frame(t,w,h,body,label=None):
    return f'<div class="f th{t}" style="width:{w}px;height:{h}px">{body}</div>'

def page(t,inner,bg=None,extra_css=''):
    T=T_(t); bg=bg or ('#050608' if THEMES[t].get('dark') else '#E4DDCF')
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>Blocks — PROPOSED hi-fi</title><style>
html,body{{margin:0;background:{bg}}} {''.join(css(x) for x in THEMES)} {extra_css}</style></head><body>{inner}</body></html>"""
import math
def capglyph(size,ring,dot,sw=2.2):
    """Capture glyph: a counter-clockwise 'reach back' arc around a held note — deliberately NOT a record dot."""
    c=size/2; r=size*0.38; a0=math.radians(-60); a1=math.radians(220)
    p=lambda a:(c+r*math.cos(a),c-r*math.sin(a))
    x0,y0=p(a0); x1,y1=p(a1)
    # arrowhead at end (a1), pointing along counter-clockwise tangent
    tx,ty=-math.sin(a1),-math.cos(a1)  # tangent direction in screen coords for increasing angle
    hx,hy=x1+tx*size*0.13,y1+ty*size*0.13
    nx,ny=-ty,tx
    ah=size*0.12
    pts=f"{hx:.1f},{hy:.1f} {x1+nx*ah:.1f},{y1+ny*ah:.1f} {x1-nx*ah:.1f},{y1-ny*ah:.1f}"
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" aria-hidden="true">'
            f'<path d="M{x0:.1f},{y0:.1f} A{r:.1f},{r:.1f} 0 1 0 {x1:.1f},{y1:.1f}" fill="none" stroke="{ring}" stroke-width="{sw}" stroke-linecap="round"/>'
            f'<polygon points="{pts}" fill="{ring}"/>'
            f'<rect x="{c-size*0.15:.1f}" y="{c-size*0.07:.1f}" width="{size*0.3:.1f}" height="{size*0.14:.1f}" rx="{size*0.05:.1f}" fill="{dot}"/></svg>')
