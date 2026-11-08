from kit import THEMES
def lum(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=[x/12.92 if x<=0.03928 else ((x+0.055)/1.055)**2.4 for x in c]; return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def cr(a,b):
    la,lb=sorted([lum(a),lum(b)],reverse=True); return (la+0.05)/(lb+0.05)
def report():
    rows=[]
    for t,T in THEMES.items():
        for fg in ['text','mute','dim','acc']:
            for bg in ['bg','surf','surf2']:
                rows.append((t,fg,bg,T[fg],T[bg],round(cr(T[fg],T[bg]),2)))
        rows.append((t,'accT','acc',T['accT'],T['acc'],round(cr(T['accT'],T['acc']),2)))
        for i,c in enumerate(T['lay']): rows.append((t,f'layer{i+1}','surf',c,T['surf'],round(cr(c,T['surf']),2)))
    return rows
if __name__=='__main__':
    for r in report(): print(*r, 'OK' if r[5]>=4.5 else ('UI≥3' if r[5]>=3 else 'FAIL'))
