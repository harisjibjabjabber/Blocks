import sys; sys.path.insert(0,'.'); from phoneB import *; from render import shot
for n,fn in [('B-hero',heroB),('B-proposal',proposalB)]:
    open(f'/tmp/{n}.html','w').write(page('B',fn())); shot(f'/tmp/{n}.html',f'/tmp/{n}.png',390,844)
