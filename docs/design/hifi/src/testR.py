import sys; sys.path.insert(0,'.')
import frames as FM, rangeview, editor
from large import *
from render import shot
for t in sys.argv[1].split(','):
    FM.set_theme(t)
    for n in sys.argv[2:]:
        s=FM.FR[n](); h=s['html'] if 'html' in s else phone(s,t); w=s.get('W',390); hh=s.get('H',844)
        open(f'/tmp/{t}-{n}.html','w').write(page(t,h)); shot(f'/tmp/{t}-{n}.html',f'/tmp/{t}-{n}.png',w,hh)
