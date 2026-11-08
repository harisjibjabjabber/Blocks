import sys; from large import *; from render import shot
for name in sys.argv[1:]:
    s=FR[name](); h=s.get('H',844); w=s.get('W',390)
    open(f'/tmp/{name}.html','w').write(page('A',s['html'] if 'html' in s else phone(s)))
    shot(f'/tmp/{name}.html',f'/tmp/{name}.png',w,h)
