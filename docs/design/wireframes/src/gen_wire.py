import json, html, os
HERE=os.path.dirname(os.path.abspath(__file__))  # wireframes/src (rev 3.2.1: package-relative paths)
# Primitive DSL: r=rect [x,y,w,h,role,label,size], t=text [x,y,text,size,role,anchor], l=line [x1,y1,x2,y2,role], k=marker [x,y,n]
S={}
def scr(id,title,w,h): S[id]={"id":id,"title":title,"w":w,"h":h,"p":[],"a":[]}; return S[id]
def R(s,x,y,w,h,role="c",label="",size=13): s["p"].append(["r",x,y,w,h,role,label,size])
def T(s,x,y,txt,size=12,role="t",anchor="s"): s["p"].append(["t",x,y,txt,size,role,anchor])
def L(s,x1,y1,x2,y2,role="lg"): s["p"].append(["l",x1,y1,x2,y2,role])
def K(s,x,y,n,txt): s["p"].append(["k",x,y,n]); s["a"].append([n,txt])
def frame(s,label="PROPOSED"):
    R(s,0,0,s["w"],s["h"],"f")
    T(s,s["w"]-8,s["h"]-8,label+" · not implemented · sizes are proposals pending measurement",9,"tm","e")
def notes(s,x0,y0,w,h,seq,role="n",lane=8):
    for (bx,row,bl) in seq: R(s,x0+bx*w,y0+row*lane,max(bl*w,4),lane-2,role)

# 1 PLAY / CAPTURE — phone portrait (most detailed)
s=scr("play-portrait","Play & Capture — phone portrait (compact width)",360,780); frame(s)
R(s,8,8,148,48,"c","Sketch 14 ▾",14); R(s,164,8,92,48,"c","92 · 4/4",13); T(s,210,52,"grid inferred",8,"tm","m")
R(s,260,8,44,48,"c","↶",18); R(s,308,8,44,48,"c","⋮",18)
K(s,16,12,1,"Sketch menu: library, rename, save state, export. One sketch = one shared tempo/meter + its parts (first slice: one part; four is a milestone, not a max).")
K(s,170,12,2,"Grid chip shows the inferred grid (tempo · meter). Tap = re-open grid review. Never changes playback speed.")
K(s,266,12,3,"Undo is always visible (48dp). Label read aloud: 'Undo Capture layer 2'.")
R(s,8,64,176,40,"p","● Keystation 61 · receiving",11); R(s,190,64,80,40,"p","🔊 Sound on",11); R(s,276,64,76,40,"p","⏺ 1:58 kept",11)
K(s,12,66,4,"Input chip: device name + 'receiving' only after a real message arrived. Shape: filled dot = live, ring = connected-silent, ✕ = none.")
K(s,194,66,5,"Audio chip: 'Sound on' / 'Tap to start sound' / 'Interrupted – tap to resume'. Text + icon, not colour alone.")
K(s,280,66,6,"History chip: how much recent playing Capture can reach (proposed 120 s rolling + hard event/byte cap). Shows 'gap' if events were dropped under overload. No arming.")
R(s,8,112,48,56,"c","◀",16); R(s,60,112,240,56,"c","Layer 2 · Warm EP",14); R(s,304,112,48,56,"c","▶",16)
K(s,64,116,7,"Sound pill targets the selected layer. ◀ ▶ step sounds while you keep playing; centre opens the Sound browser sheet.")
R(s,8,176,344,236,"p"); T(s,16,194,"Recent playing · last 30 s",11,"tm")
for i in range(9): L(s,16+i*40,200,16+i*40,404,"lg")
notes(s,16,210,40,0,[(0.2,20,0.6),(0.9,16,0.4),(1.4,18,0.9),(2.6,14,0.5),(3.1,22,0.4),(3.5,17,1.2),(4.9,15,0.4),(5.3,19,0.7),(6.2,13,0.5),(6.8,21,0.8),(7.7,16,0.4)],"n",8)
R(s,92,204,248,200,"ld"); T(s,216,400,"likely phrase (preview)",9,"tm","m")
L(s,342,200,342,404,"la"); T(s,338,214,"now",9,"tm","e")
K(s,20,214,8,"Ribbon = the buffer made visible: what Capture will take. Dashed bracket previews the likely phrase so the result is predictable.")
for i,(lab,role) in enumerate([("1 Bass ▶","c"),("2 ◎ next","s"),("3 empty","c"),("4 empty","c")]): R(s,8+i*87,420,82,56,role,lab,12)
K(s,96,424,9,"Layer strip: ◎ marks the capture target (text 'next', ring shape). Tap any layer to retarget. Long-press → layer actions.")
R(s,8,484,64,56,"c","▶︎ Play",12); R(s,78,484,100,56,"c","Click: off",12); R(s,184,484,168,56,"c","Layers  ▦",12)
K(s,12,488,10,"Transport is secondary: capture never needs Play first. Click (metronome) is opt-in.")
R(s,8,552,344,112,"a","",14); T(s,180,600,"Capture",26,"tob","m"); T(s,180,628,"last phrase → Layer 2",12,"to","m"); T(s,180,648,"optional mapping: CC 67",10,"to","m")
K(s,20,560,11,"Capture: 112dp (proposed) tall, full width, bottom-centre. Optionally mapped to any spare CC/button/pad (no spare pedal required); sustain and playing keys are never taken by default.")
R(s,8,676,344,56,"c","Touch keys (on screen) ▴",13)
K(s,20,680,12,"Touch keys open as a drawer. Always labelled 'on screen' and never appear in the MIDI device list.")
T(s,180,760,"Live region: 'Captured 8 bars at 92 BPM into layer 2. Looping.'",9,"tm","m")

# 2 PLAY landscape
s=scr("play-landscape","Play & Capture — phone landscape (compact height)",780,360); frame(s)
R(s,8,8,140,44,"c","Sketch 14 ▾",13); R(s,152,8,90,44,"c","92 · 4/4",12); R(s,248,8,170,44,"p","● Keystation · receiving",11); R(s,424,8,100,44,"p","🔊 Sound on",11); R(s,528,8,44,44,"c","↶",16)
R(s,8,60,48,48,"c","◀",14); R(s,60,60,400,48,"c","Layer 2 · Warm EP",13); R(s,464,60,48,48,"c","▶",14)
R(s,8,116,560,180,"p"); T(s,16,132,"Recent playing · last 30 s",10,"tm")
for i in range(14): L(s,16+i*40,138,16+i*40,288,"lg")
notes(s,16,146,40,0,[(0.5,10,0.6),(1.4,8,0.5),(2.2,12,0.9),(3.6,6,0.5),(4.4,11,1.1),(6.0,7,0.5),(7.1,13,0.8),(8.6,9,0.6),(10.2,5,0.9),(11.6,10,0.6),(12.6,8,0.5)],"n",8)
R(s,180,140,380,152,"ld")
for i,lab in enumerate(["1 Bass","2 ◎ next","3 empty","4 empty"]): R(s,8+i*142,304,136,48,"s" if i==1 else "c",lab,12)
R(s,580,8,192,236,"a"); T(s,676,120,"Capture",26,"tob","m"); T(s,676,148,"→ Layer 2",12,"to","m")
R(s,580,252,94,100,"c","▶︎ Play",12); R(s,678,252,94,100,"c","Touch keys",12)
K(s,586,14,1,"Landscape: Capture becomes a tall right-hand rail (192×236dp) under the thumb; ribbon keeps the width.")
K(s,14,122,2,"Height < 480dp (compact height): status collapses into one 44dp row; no bottom sheets taller than 60% of height.")
K(s,14,308,3,"Layer strip moves to the bottom-left so hands on the controller never reach across the screen.")

# 3 FOLD cover (narrow)
s=scr("fold-narrow","Fold folded / cover screen (narrow compact)",320,780); frame(s)
R(s,8,8,200,48,"c","Sketch 14 ▾",13); R(s,212,8,48,48,"c","↶",16); R(s,264,8,48,48,"c","⋮",16)
R(s,8,64,304,40,"p","● Keystation · receiving · 🔊 on",11)
R(s,8,112,48,56,"c","◀",14); R(s,60,112,200,56,"c","L2 · Warm EP",13); R(s,264,112,48,56,"c","▶",14)
R(s,8,176,304,236,"p"); T(s,16,194,"Recent playing",11,"tm")
notes(s,16,210,36,0,[(0.2,20,0.6),(1.0,16,0.5),(1.8,18,0.9),(3.0,14,0.5),(3.6,22,0.4),(4.4,17,1.2),(5.8,15,0.4),(6.6,19,0.7),(7.4,13,0.4)],"n",8)
R(s,8,420,304,56,"s","Target: Layer 2 of 4  ▾",13)
R(s,8,484,148,56,"c","▶︎ Play",12); R(s,164,484,148,56,"c","Layers ▦",12)
R(s,8,552,304,112,"a"); T(s,160,604,"Capture",26,"tob","m"); T(s,160,630,"→ Layer 2",12,"to","m")
R(s,8,676,304,56,"c","Touch keys (on screen) ▴",13)
K(s,14,424,1,"Below 360dp wide the 4-chip layer strip collapses into one 'Target' chip (opens a 4-row picker). Capture keeps full height.")
K(s,14,68,2,"Status chips merge into one row; tapping it opens the full readiness panel.")
K(s,14,556,3,"Folding/unfolding must not stop sound, close the review, or drop the selection (window size classes change at runtime).")

# 4 FOLD open (medium) two-pane
s=scr("fold-open","Fold open (medium width, flat) — Play + Layers side by side",720,812); frame(s)
R(s,8,8,180,48,"c","Sketch 14 ▾",14); R(s,196,8,100,48,"c","92 · 4/4",13); R(s,304,8,220,48,"p","● Keystation 61 · receiving",11); R(s,532,8,110,48,"p","🔊 Sound on",11); R(s,648,8,64,48,"c","↶",16)
R(s,8,64,404,728,"p"); T(s,16,84,"PLAY",11,"tm")
R(s,16,92,48,56,"c","◀",14); R(s,68,92,288,56,"c","Layer 2 · Warm EP",13); R(s,360,92,44,56,"c","▶",14)
R(s,16,156,388,300,"c"); T(s,24,174,"Recent playing · last 60 s",10,"tm")
notes(s,24,186,36,0,[(0.2,20,0.6),(1.0,16,0.5),(1.8,24,0.9),(3.0,14,0.5),(3.6,28,0.4),(4.4,17,1.2),(5.8,25,0.4),(6.6,19,0.7),(7.4,13,0.4),(8.6,22,0.9),(9.6,18,0.5)],"n",8)
R(s,16,464,388,120,"a"); T(s,210,520,"Capture",28,"tob","m"); T(s,210,548,"last phrase → Layer 2",12,"to","m")
R(s,16,592,190,56,"c","▶︎ Play",12); R(s,214,592,190,56,"c","Click: off",12)
R(s,16,656,388,128,"c","Touch keys (on screen)",13)
R(s,420,64,292,728,"p"); T(s,428,84,"LAYERS",11,"tm")
for i,(lab,role) in enumerate([("1 · Bass · 4 bars","c"),("2 · Warm EP · ◎ next","s"),("3 · empty","c"),("4 · empty","c")]):
    R(s,428,96+i*120,276,112,role,""); T(s,440,118+i*120,lab,13,"tb")
    if i<2: notes(s,440,128+i*120,24,0,[(0.2,1,0.8),(1.4,3,0.6),(2.6,2,1.1),(4.2,4,0.6),(5.6,1,0.9),(7.0,3,0.7),(8.6,2,0.6)],"n",10)
    R(s,600,152+i*120,48,48,"c","M",12); R(s,652,152+i*120,48,48,"c","S",12)
K(s,22,96,1,"Medium width (600–840dp): two panes. Layers are always visible, so retargeting capture is one tap with no navigation.")
K(s,426,98,2,"Each layer row 112dp: name, sound, length, note thumbnail, Mute/Solo with letters (not colour) and pressed state.")
K(s,22,468,3,"Capture stays in the Play pane at the bottom of the left half, inside the natural reach of the hand nearest the keyboard.")

# 5 FOLD tabletop
s=scr("fold-tabletop","Fold half-open, tabletop posture (horizontal hinge)",720,800); frame(s)
R(s,8,8,704,48,"p","Sketch 14 · 92 · 4/4 · ● Keystation receiving · 🔊 on",12)
R(s,8,64,704,316,"p"); T(s,16,84,"Recent playing + layers (view only half)",11,"tm")
for i in range(4): R(s,16,96+i*68,688,60,"s" if i==1 else "c",""); T(s,28,130+i*68,["1 Bass","2 Warm EP ◎","3 empty","4 empty"][i],12,"tb")
notes(s,140,104,30,0,[(0.2,1,0.8),(1.4,3,0.6),(2.6,2,1.1),(4.2,4,0.6),(5.6,1,0.9),(7.0,3,0.7),(8.6,2,0.6),(10,4,1),(12,1,.8),(14,3,.9),(16,2,1)],"n",9)
L(s,0,400,720,400,"ld"); T(s,360,396,"hinge — no controls within ±24dp",10,"tm","m")
R(s,8,424,704,120,"a"); T(s,360,484,"Capture",28,"tob","m"); T(s,360,512,"→ Layer 2",12,"to","m")
R(s,8,552,170,56,"c","▶︎ Play",12); R(s,186,552,170,56,"c","↶ Undo",12); R(s,364,552,170,56,"c","Sound ▾",12); R(s,542,552,170,56,"c","Layers ▦",12)
R(s,8,616,704,176,"c","Touch keys (on screen)",13)
K(s,14,70,1,"Tabletop (HALF_OPENED + horizontal fold): top half shows; bottom half takes all touch controls, like the media-player tabletop pattern.")
K(s,14,404,2,"Nothing interactive inside the fold bounds when isSeparating is true; layout re-flows when the posture changes.")

# 6 DESKTOP browser
s=scr("desktop","Desktop browser (expanded / large width) — three regions",1280,760); frame(s)
R(s,8,8,1264,48,"p",""); T(s,20,38,"Blocks · Sketch 14 ▾",14,"tb"); R(s,260,12,120,40,"c","92 · 4/4 grid",12); R(s,388,12,260,40,"p","● Keystation 61 (Web MIDI) · receiving",11); R(s,656,12,150,40,"p","🔊 Sound on",11); R(s,1120,12,72,40,"c","↶ ⌘Z",12); R(s,1196,12,72,40,"c","Export",12)
R(s,8,64,280,688,"p"); T(s,16,84,"LAYERS",11,"tm")
for i,lab in enumerate(["1 · Bass · 4 bars","2 · Warm EP ◎ next","3 · empty","4 · empty"]): R(s,16,96+i*92,264,84,"s" if i==1 else "c",lab,13)
R(s,296,64,680,688,"p"); T(s,304,84,"PLAY / EDIT (centre)",11,"tm")
R(s,304,96,664,260,"c"); T(s,312,114,"Recent playing · last 60 s",10,"tm")
notes(s,312,124,40,0,[(0.2,20,0.6),(1.0,16,0.5),(1.8,24,0.9),(3.0,14,0.5),(3.6,26,0.4),(4.4,17,1.2),(5.8,25,0.4),(6.6,19,0.7),(7.4,13,0.4),(8.6,22,0.9),(9.6,18,0.5),(11,15,1),(12.5,21,.7),(14,16,.9)],"n",8)
R(s,304,364,664,100,"a"); T(s,636,410,"Capture   (C or mapped control)",24,"tob","m"); T(s,636,438,"last phrase → Layer 2",12,"to","m")
R(s,304,472,664,272,"c","Touch keys (on screen) — or computer keys A–K when enabled",13)
R(s,984,64,288,688,"p"); T(s,992,84,"INSPECTOR",11,"tm")
R(s,992,96,272,180,"c","Sound: Warm EP  (browse ⌘K)",12); R(s,992,284,272,220,"c","Last capture review",12); R(s,992,512,272,232,"c","Controller map",12)
K(s,24,100,1,"Expanded/large: layers left, play/edit centre, inspector right (sound, review, controller). Nothing is hidden behind sheets.")
K(s,312,370,2,"Every touch action has a key: C capture, Space play, ⌘Z undo, 1–4 target layer, E/D/R tools, ⌘K sounds. Shown in tooltips.")
K(s,400,16,3,"Web: chip names the transport ('Web MIDI'). Unsupported/denied browsers show the reason here, never a fake 'connected'.")

# 7 FIRST RUN
s=scr("first-run","First run — connect sound + keyboard (readiness)",360,780); frame(s)
T(s,20,48,"Let's make sound",24,"tb"); T(s,20,74,"Two things, then just play.",13,"tm")
R(s,8,96,344,172,"c"); T(s,24,124,"1  Sound",16,"tb"); T(s,24,148,"Status: Not started",13,"t"); T(s,24,168,"One tap starts audio, then asks for MIDI.",11,"tm")
R(s,24,184,312,64,"a","Start (sound, then MIDI)",15)
R(s,8,280,344,212,"c"); T(s,24,308,"2  MIDI keyboard",16,"tb"); T(s,24,332,"✓ Keystation 61 connected (USB)",13,"t"); T(s,24,352,"Not yet heard — play any key to test",12,"tm")
R(s,24,368,312,56,"p","Waiting for a note…  ◌",13); R(s,24,432,152,48,"c","Choose device ▾",12); R(s,184,432,152,48,"c","Help connecting",12)
R(s,8,504,344,132,"c"); T(s,24,532,"No keyboard?",16,"tb"); T(s,24,556,"Play the on-screen touch keys instead.",12,"tm"); T(s,24,574,"They are a touch instrument, not a MIDI device.",11,"tm")
R(s,24,584,312,44,"c","Use touch keys",13)
R(s,8,660,344,72,"c","Start playing →",18)
T(s,180,752,"Start playing enables once Sound is on (keyboard optional).",10,"tm","m")
K(s,14,100,1,"Web: one explicit enable gesture resumes audio and then requests MIDI. The browser's own prompt varies by browser/state, so the touch count is not fixed. Native: auto-starts.")
K(s,14,284,2,"Connected ≠ receiving. The card only says 'Receiving ✓ C4 vel 72' after a real Note On arrives (proves the cable, channel, and permission).")
K(s,14,508,3,"Touch keys are offered as an equal path, labelled as on-screen; choosing them never marks the MIDI card ready.")
K(s,14,664,4,"One primary action per card; the final CTA is plain once sound is on. Order: sound first, so the first key press is heard.")

# 8 READINESS ERRORS board
s=scr("readiness-errors","Readiness & error states (input + audio)",1080,620); frame(s)
cards=[("Web MIDI not supported","This browser can't read MIDI keyboards.","Use Chrome/Edge/Firefox desktop or Chrome on Android, or play touch keys.","Use touch keys","Copy link"),
("MIDI access blocked","You (or a policy) blocked MIDI for this site.","Open the site settings (lock icon) → MIDI → Allow, then retry.","Retry","How to allow"),
("Sound is paused","The browser or OS paused audio (call, other app).","If your keyboard is still sending, playing is kept. Tap to resume.","Resume sound","—"),
("Keystation 61 disconnected","Held notes stopped (marked, not in your take). History kept.","Reconnect and keep playing — we'll pick it up automatically.","Use touch keys","Choose device"),
("No keyboard found","Nothing is plugged in or paired.","Plug in USB (OTG) or pair Bluetooth MIDI.","Scan Bluetooth","Use touch keys"),
("Connected, silent","Device present, but no notes for 10 s while you're on this screen.","Check MIDI channel/local control or try another port.","Choose port","Test again"),
("Not a secure page","MIDI and audio need https.","Open the https address.","Open https","—"),
("Audio output error","No output device could start.","Check volume/headphones, then retry.","Retry","Settings")]
for i,(h,a,b,p1,p2) in enumerate(cards):
    x=8+(i%4)*268; y=8+(i//4)*300
    R(s,x,y,260,288,"w" if i in (0,1,4,7) else "c"); T(s,x+14,y+30,h,14,"tb"); import textwrap as _tw
    for j,ln in enumerate(_tw.wrap(a,42)): T(s,x+14,y+56+j*16,ln,11,"t")
    for j,ln in enumerate(_tw.wrap(b,40)): T(s,x+14,y+104+j*16,ln,11,"tm")
    R(s,x+14,y+164,232,52,"a" if i in (2,3) else "c",p1,13)
    if p2!="—": R(s,x+14,y+224,232,48,"c",p2,12)
K(s,20,14,1,"Every state: title says what happened, line 2 says what is still safe, button says the next action. Icon + text, never colour alone.")
K(s,288,14,2,"Denied permission cannot be re-prompted by script once blocked by policy; the card gives the manual route instead of a dead button.")
K(s,556,14,3,"Audio paused: Capture continues only while MIDI delivery continues (A1). Hidden tab / background: delivery not guaranteed; on return, gaps are flagged.")

# 9 CAPTURE REVIEW
s=scr("capture-review","Capture review & grid corrections (sheet over Play, loop keeps playing)",360,780); frame(s)
R(s,8,8,344,160,"p","(Play screen dimmed but live — keys still play)",11)
R(s,0,176,360,604,"c"); R(s,156,184,48,6,"p")
T(s,16,214,"Captured → Layer 1",16,"tb"); T(s,16,236,"8 bars · 92 BPM · 4/4 · looping ▶",12,"tm")
R(s,240,196,112,48,"c","Discard",13)
R(s,16,252,328,120,"p")
for i in range(9): L(s,24+i*39,260,24+i*39,364,"lg")
notes(s,8,268,39,0,[(0.0,2,0.5),(0.3,6,0.4)],"ng",9)
notes(s,24,268,39,0,[(0.4,4,0.6),(1.1,1,0.5),(1.8,5,0.9),(3.0,2,0.5),(3.6,7,0.4),(4.4,3,1.2),(5.8,0,0.4),(6.6,6,0.7),(7.4,2,0.4)],"n",9)
L(s,40,256,40,368,"la"); T(s,44,270,"1",12,"tb"); R(s,30,348,22,22,"s","◆",10)
T(s,24,384,"Your timing is unchanged — only the grid moves.",11,"tm")
T(s,16,412,"Loop length",12,"tb")
for i,lab in enumerate(["½","4 bars","8 bars ✓","16","×2"]): R(s,16+i*66,420,62,48,"s" if i==2 else "c",lab,12)
T(s,16,494,"Beat one",12,"tb")
R(s,16,502,64,48,"c","◀ beat",11); R(s,84,502,176,48,"c","Tap a note to set '1'",11); R(s,264,502,80,48,"c","beat ▶",11)
T(s,16,576,"Count it as",12,"tb")
for i,lab in enumerate(["92 ✓","×2 (184)","½ (46)","Set BPM…"]): R(s,16+i*82,584,78,48,"s" if i==0 else "c",lab,12)
T(s,16,652,"Hear",12,"tb"); R(s,16,660,160,48,"s","Loop ✓",12); R(s,184,660,160,48,"c","Original take",12)
R(s,16,720,160,48,"c","Fine shift ±",12); R(s,184,720,160,48,"a","Keep  ✓",14)
K(s,340,222,1,"Sheet is non-blocking: the loop keeps playing and the controller keeps sounding. Undo reverts the capture. For later layers the tempo is locked to the sketch.")
K(s,60,262,2,"Notes played before the loop start stay in the take (greyed, dashed). Moving the loop brings them back — nothing is cropped.")
K(s,340,420,3,"Loop length chips re-map bars; never stretch audio or notes. Selected chip has ✓ + filled shape.")
K(s,340,502,4,"Beat one: step by beat, or tap any note in the mini-timeline to make it '1'. Moves bar lines, not notes.")
K(s,340,584,5,"'Count it as': inferred tempo plus ½ / ×2 / manual controls, always shown. Extra alternatives only when inference justifies them; no confidence %. Meter 4/4 at first. Re-maps bars; never speeds playback.")
K(s,340,660,6,"Original take = hear the raw, unlooped performance exactly as played. Always one tap away, in review and later from the layer menu.")
K(s,340,712,7,"Keep is the default: dismissing the sheet, playing on, or capturing again keeps it. Discard is explicit and undoable.")

# 10 SOUND BROWSER
s=scr("sound-browser","Sound browser (sheet) — audition by playing",360,780); frame(s)
R(s,8,8,344,80,"p","Play screen (live)",11)
R(s,0,96,360,684,"c"); T(s,16,130,"Sound for Layer 2",16,"tb"); R(s,300,104,48,48,"c","✕",14)
R(s,16,156,328,48,"c","🔍  Search sounds",13)
for i,lab in enumerate(["Keys","Bass","Pads","Leads","Drums","Texture"]): R(s,16+(i%3)*110,212+(i//3)*56,104,48,"s" if i==0 else "c",lab,12)
T(s,16,344,"Play your keyboard to try a sound — it loads instantly.",11,"tm")
rows=[("Warm EP","keys · placeholder name","✓ current"),("Keys sound B","keys · placeholder",""),("Keys sound C","keys · placeholder",""),("Keys sound D","keys · placeholder",""),("Keys sound E","keys · placeholder",""),("Keys sound F","keys · placeholder","")]
for i,(a,b,c) in enumerate(rows):
    y=356+i*64; R(s,16,y,328,60,"s" if i==0 else "c",""); T(s,28,y+26,a,14,"tb"); T(s,28,y+46,b,11,"tm"); T(s,280,y+26,c,10,"tm","e"); R(s,292,y+6,48,48,"c","☆",14)
R(s,16,744,160,32,"c","↶ Back to previous",11); R(s,184,744,160,32,"c","Recent ▾",11)
K(s,20,348,1,"Audition is playing: tapping a row loads it on the target layer while you keep playing. No separate preview mode to forget.")
K(s,20,160,2,"Categories are large chips (48dp, proposed); search for names. Sound names are PLACEHOLDERS until the sound set is chosen — no asset is promised.")
K(s,296,362,3,"Favourite star is its own 48dp target, separated from the row action by 8dp; state read as 'Favourite, on'.")
K(s,20,748,4,"Every sound change is one undo step ('Back to previous'). Controller ◀ ▶ sound steps are learnable.")

# 11 LAYERS OVERVIEW
s=scr("layers","Four-layer overview — phone portrait",360,780); frame(s)
R(s,8,8,48,48,"c","←",16); T(s,68,40,"Layers · Sketch 14",16,"tb"); R(s,304,8,48,48,"c","⋮",16)
R(s,8,64,344,40,"p","Grid 92 · 4/4 · from Layer 1 · Review grid",11)
lay=[("1","Bass (placeholder)","4 bars · playing","c"),("2","Keys · Warm EP","8 bars · ◎ capture target","s"),("3","Pad (placeholder)","8 bars · MUTED","h"),("4","empty","Capture goes here next if 2 is full","c")]
for i,(n,a,b,role) in enumerate(lay):
    y=112+i*150; R(s,8,y,344,142,role,"")
    R(s,16,y+8,44,44,"p",n,16); T(s,68,y+28,a,14,"tb"); T(s,68,y+46,b,11,"tm")
    if i<3: notes(s,16,y+60,30,0,[(0.2,1,0.8),(1.4,3,0.6),(2.6,2,1.1),(4.2,4,0.6),(5.6,1,0.9),(7.0,3,0.7),(8.6,2,0.6),(9.6,4,.6)],"n" if role!="h" else "ng",10)
    R(s,16,y+88 if i<3 else y+60,48,48,"c","M",13); R(s,70,y+88 if i<3 else y+60,48,48,"c","S",13); R(s,124,y+88 if i<3 else y+60,108,48,"c","Edit notes",12); R(s,238,y+88 if i<3 else y+60,106,48,"c","Sound",12)
K(s,20,68,1,"The grid belongs to the sketch (set by the first capture). 'Review grid' re-opens corrections; notes never move.")
K(s,22,268,2,"Selected/target layer: thick outline + ◎ + text 'capture target'. Tap the row body to retarget; no colour-only state.")
K(s,22,418,3,"Muted: dashed outline, hollow notes, the word MUTED, and M shown pressed. Screen reader: 'Layer 3, Pad, muted'.")
K(s,22,568,4,"Empty layer explains what will happen. Four parts is a milestone, not a max; the first slice ships one part. All full → Capture asks (never replaces).")

# 12 PIANO ROLL portrait
s=scr("piano-roll","Touch piano roll — phone (edit tool, chord selected, dragging with loupe)",360,820); frame(s)
R(s,8,8,48,48,"c","←",16); T(s,64,30,"Layer 2 · Warm EP",14,"tb"); T(s,64,48,"Edit · drag notes · 2 fingers navigate",10,"tm"); R(s,256,8,48,48,"c","↶",16); R(s,304,8,48,48,"c","↷",16)
for i,(lab) in enumerate(["Edit ✓","Draw","Range"]): R(s,8+i*84,64,80,48,"s" if i==0 else "c",lab,12)
R(s,260,64,92,48,"c","▶︎ Loop",12)
R(s,8,120,344,24,"p"); R(s,60,122,140,20,"c","",9); T(s,130,136,"view",9,"tm","m")
R(s,56,150,296,32,"p"); T(s,64,170,"1",11,"tb"); T(s,138,170,"2",11,"t"); T(s,212,170,"3",11,"t"); T(s,286,170,"4",11,"t")
R(s,58,150,24,32,"s","["); R(s,326,150,24,32,"s","]")
for r in range(14):
    y=188+r*32; R(s,8,y,44,30,"p" if r%12 in (1,3,6,8,10) else "c",["B3","A#","A3","G#","G3","F#","F3","E3","D#","D3","C#","C3","B2","A#"][r],9)
    L(s,56,y,352,y,"lg")
for c in range(17): L(s,56+c*18.5,188,56+c*18.5,636,"lg" if c%4 else "ls")
nts=[(0,4,2,"s"),(0,7,2,"s"),(0,11,2,"s"),(2.5,4,1,"n"),(4,2,3,"n"),(8,7,2,"n"),(8,4,2,"n"),(10.5,9,1,"n"),(12,6,3,"n")]
for (bx,row,ln,role) in nts: R(s,56+bx*18.5,190+row*32,ln*18.5,28,role)
R(s,56,414,8,28,"s"); R(s,92,414,8,28,"s")
R(s,148,236,180,120,"c"); T(s,156,252,"loupe ×2.5",9,"tm")
for c in range(5): L(s,160+c*40,258,160+c*40,348,"lg")
R(s,176,286,80,40,"s"); T(s,238,344,"G3 · 1.1.1 · ⅛",11,"tb","m")
R(s,96,470,64,64,"ld"); T(s,128,506,"finger",9,"tm","m")
R(s,8,640,344,40,"p"); for_v=[(0,40),(0,64),(0,76),(2.5,30),(4,50),(8,58),(8,46),(10.5,70),(12,36)]
for (bx,v) in for_v: L(s,60+bx*18.5,678,60+bx*18.5,678-v*0.45,"ls")
T(s,16,656,"Vel",10,"tm")
R(s,8,688,344,112,"c")
for i,lab in enumerate(["Delete","Duplicate","Len −","Len +"]): R(s,14+i*84,694,80,48,"c",lab,11)
for i,lab in enumerate(["Vel 84 ±","Quantise…","Chord"]): R(s,14+i*112,746,108,48,"c",lab,11)
K(s,12,68,1,"Explicit tools with text labels. Current tool shown 3 ways: pressed chip, subtitle text, and grid hint. Delete/duplicate are actions, not modes.")
K(s,62,124,2,"Overview strip: 1-finger drag pans; the box is the visible window. Rulers: drag time ruler = pan time; drag keys = pan pitch.")
K(s,60,154,3,"Loop brace handles [ ] are 48dp hit targets on the time ruler; they snap to beats and edit the loop, never notes.")
K(s,150,240,4,"Loupe appears 96dp above the finger during any drag (flips below near the top edge): ×2.5 view + pitch · position · length readout.")
K(s,60,418,5,"Selected notes: thick outline + side handle tabs (outside short notes so they stay ≥48dp to hit) + count in action bar.")
K(s,12,644,6,"Velocity lane: stem height (not colour) shows velocity; selected notes' stems are bold. Drag a stem, or use 'Vel ±' stepper.")
K(s,18,738,7,"Action bar works on the selection — every drag has a tap alternative (Len ±, nudge by arrows in the overflow, Vel ±).")

# 13 PIANO ROLL STATES board
s=scr("piano-roll-states","Piano roll interaction states (selection, resize, marquee, range, draw, ambiguity)",1080,560); frame(s)
def mini(x,y,title,sub):
    R(s,x,y,256,256,"c"); T(s,x+10,y+22,title,13,"tb"); T(s,x+10,y+40,sub,10,"tm")
    for r in range(6): L(s,x+8,y+56+r*32,x+248,y+56+r*32,"lg")
    for c in range(9): L(s,x+8+c*30,y+56,x+8+c*30,y+248,"lg")
mini(8,8,"A · Idle (Edit)","tap note = select; drag empty = marquee")
R(s,38,90,60,26,"n"); R(s,128,154,90,26,"n"); R(s,98,122,30,26,"n")
mini(272,8,"B · Selected + handles","handles outside short notes; 48dp hit")
R(s,302,90,60,26,"s"); R(s,286,90,14,26,"s"); R(s,364,90,14,26,"s"); R(s,392,154,90,26,"n")
mini(536,8,"C · Resizing (right edge)","loupe + ghost of old length")
R(s,566,122,120,26,"s"); R(s,566,118,60,34,"ld"); T(s,690,116,"len ¼ → ½",10,"tb")
mini(800,8,"D · Marquee selecting","dashed box; notes inside get outline")
R(s,830,80,150,110,"ld"); R(s,850,90,60,26,"s"); R(s,900,154,60,26,"s"); R(s,990,218,40,26,"n")
mini(8,280,"E · Range tool","time span across all pitches")
R(s,68,336,90,192,"ld"); R(s,38,370,60,26,"s"); R(s,128,434,60,26,"s")
R(s,16,500,240,30,"p","Duplicate range · Delete range · Loop to range",9)
mini(272,280,"F · Draw tool","tap empty = add (last length); tap note = select")
R(s,332,402,60,26,"n"); R(s,422,434,30,26,"ld"); T(s,440,428,"+",14,"tb","m")
mini(536,280,"G · Ambiguous tap","two notes within 48dp → pick")
R(s,596,370,40,22,"n"); R(s,600,394,40,22,"n"); R(s,650,360,130,96,"c"); R(s,658,370,114,36,"c","E3",12); R(s,658,412,114,36,"c","D#3",12)
mini(800,280,"H · Two-finger = navigate","any 2nd finger cancels the edit")
R(s,880,370,30,30,"ld"); R(s,960,420,30,30,"ld"); T(s,940,520,"pan + pinch; edit reverted",10,"tm","m")
K(s,14,12,1,"States are visually distinct without colour: outline weight, handles, dashed ghosts and on-canvas text.")
K(s,542,12,2,"Ghost (dashed) shows the pre-edit state until release; release commits one undo step; 2nd finger or drag back to origin cancels.")
K(s,542,284,3,"Hit-testing picks the nearest note centre within 24dp; if two candidates are within 8dp of each other, a picker appears instead of guessing.")

# 14 CONTROLLER LEARN
s=scr("controller-learn","Controller learn — map a pedal/button to Capture",360,780); frame(s)
R(s,8,8,48,48,"c","←",16); T(s,64,40,"Controller · Keystation 61",15,"tb")
T(s,16,84,"Hands stay on the keys: map the actions you use most.",11,"tm")
acts=[("Capture","CC 67 · spare button ✓","s"),("Keep / Discard last","not set","c"),("Play / Stop","Note 0 (pad 1)","c"),("Undo","not set","c"),("Next / previous sound","CC 20 / CC 21","c"),("Target / new layer","not set","c")]
for i,(a,b,role) in enumerate(acts):
    y=100+i*68; R(s,8,y,344,60,role,""); T(s,20,y+26,a,14,"tb"); T(s,20,y+46,b,11,"tm"); R(s,264,y+6,80,48,"c","Learn",12)
R(s,8,516,344,256,"w"); T(s,20,546,"Listening for Undo…",16,"tb"); T(s,20,570,"Press a button, pad or pedal. 10 s left.",12,"tm")
R(s,20,584,320,56,"p","Last message:  CC 64  ·  ch 1  ·  127 → 0",13)
T(s,20,664,"CC 64 is usually your sustain pedal; mapping it",11,"t"); T(s,20,682,"to Undo stops it sustaining. Press another control?",11,"t")
R(s,20,700,152,56,"c","Map CC 64 anyway",12); R(s,180,700,160,56,"a","Press another control",12)
K(s,14,104,1,"Learnable actions are a short list (not every control). Each row says its current mapping in words.")
K(s,14,520,2,"Learn shows live incoming messages so you can see the controller works; it times out after 10 s and cancels cleanly.")
K(s,14,668,3,"Defaults never take over sustain (CC 64) or playable keys. An optional command zone is off unless you enable it. Conflicts explained before overwriting.")

# 15 SAVE / RECOVERY / EXPORT board
s=scr("save-export","Save, recovery and export",1080,640); frame(s)
R(s,8,8,344,604,"c"); T(s,20,38,"Recovered sketch",16,"tb"); T(s,20,62,"Blocks closed unexpectedly. 'Sketch 14' was",11,"t"); T(s,20,78,"restored from 2 min ago (4 layers, 3 edits).",11,"t")
R(s,20,100,320,120,"p","preview: layers 1–4 thumbnails",11); R(s,20,236,320,56,"a","Open restored sketch",14); R(s,20,300,320,48,"c","Open last saved version instead",12); T(s,20,380,"Both versions are kept until you choose.",11,"tm")
R(s,368,8,344,604,"c"); R(s,368,8,344,88,"w"); T(s,380,38,"Couldn't save — storage full",14,"tb"); T(s,380,60,"Your sketch is safe while Blocks stays open.",11,"t"); R(s,380,68,100,24,"c","Retry",10); R(s,488,68,120,24,"c","Export now",10)
T(s,380,130,"Autosave status (sketch menu)",12,"tb"); T(s,380,152,"● Saved on this device · 14:02 (UTC)",11,"t"); T(s,380,172,"Saving… / Not saved – retrying in 5 s",11,"tm")
T(s,380,212,"Version history",12,"tb")
for i,lab in enumerate(["14:02 · captured layer 2","13:58 · changed sound","13:51 · first capture"]): R(s,380,224+i*56,320,48,"c",lab,11)
R(s,728,8,344,604,"c"); T(s,740,38,"Export Sketch 14",16,"tb")
for i,(lab,role) in enumerate([("MIDI file · all layers ✓","s"),("MIDI · one file per layer","c"),("Audio stems · WAV, aligned ✓","s"),("Mixdown · WAV","c")]): R(s,740,56+i*56,320,48,role,lab,12)
T(s,740,302,"Timing",12,"tb"); R(s,740,312,156,48,"s","As edited ✓",12); R(s,904,312,156,48,"c","Original take",12)
T(s,740,384,"Length",12,"tb"); R(s,740,394,320,48,"c","Length: Loop × 4 (32 bars) · change ▾",12)
T(s,740,466,"Stems share start + one length; tail follows the sound's release.",11,"tm")
R(s,740,488,320,56,"a","Export & share…",14); R(s,740,552,320,48,"c","Cancel",12)
K(s,14,12,1,"Recovery never silently picks: restored vs last-saved are both offered, and both are kept until one is chosen.")
K(s,374,12,2,"Save failure is a persistent banner (not a toast) with Retry and an escape hatch: export.")
K(s,734,12,3,"Export: MIDI + aligned stems (stems = later milestone). Length visible/changeable. Raw CC64/bend/pressure kept; synthetic note-offs not exported.")

# 0 NAV MAP
s=scr("nav-map","Navigation & hierarchy map",1080,420); frame(s)
R(s,440,16,200,64,"a","PLAY (home)",16)
for i,(lab,sub) in enumerate([("Readiness panel","from status chips"),("Sound browser","sheet, from sound pill"),("Capture review","sheet, after Capture"),("Layers","view toggle / pane"),("Sketch menu","library · export · history")]):
    x=16+i*212; R(s,x,140,196,72,"c",""); T(s,x+98,170,lab,14,"tb","m"); T(s,x+98,192,sub,10,"tm","m"); L(s,540,80,x+98,140,"ls")
R(s,652,272,196,72,"c",""); T(s,750,302,"Piano roll",14,"tb","m"); T(s,750,324,"full screen, from a layer",10,"tm","m"); L(s,750,212,750,272,"ls")
R(s,864,272,196,72,"c",""); T(s,962,302,"Export",14,"tb","m"); T(s,962,324,"sheet",10,"tm","m"); L(s,962,212,962,272,"ls")
R(s,16,272,196,72,"c",""); T(s,114,302,"Controller learn",14,"tb","m"); T(s,114,324,"from readiness / menu",10,"tm","m"); L(s,114,212,114,272,"ls")
T(s,540,396,"Max depth 2 from Play. Sheets keep the loop and the keyboard live; only the piano roll takes the full screen.",12,"t","m")
K(s,446,20,1,"Hierarchy: Capture > what you're hearing (layers/sound) > repair. Settings never interrupt playing.")

# 16 CAPTURE EDGE STATES board
s=scr("capture-edge-states","Capture edge states — no pulse, capture while playing, overload gap, all layers full",1080,640); frame(s)
pan=[(8,"A · No steady pulse"),(276,"B · Capture while playing"),(544,"C · History gap (overload)"),(812,"D · All layers full")]
for x,h in pan: R(s,x,8,260,600,"c"); T(s,x+14,34,h,14,"tb")
x=8
T(s,x+14,58,"Captured → Layer 1 · free time",11,"tm"); R(s,x+14,70,232,100,"p")
notes(s,x+20,80,20,0,[(0.0,1,0.8),(1.2,4,0.5),(2.9,2,1.3),(5.0,6,0.4),(6.4,3,1.1),(8.6,5,0.6)],"n",12)
T(s,x+14,190,"No steady pulse found.",12,"tb"); T(s,x+14,208,"Looping the whole phrase (12.4 s).",11,"t")
R(s,x+14,222,232,48,"s","Keep as free-time take ✓",12); R(s,x+14,278,232,48,"c","Set BPM…",12); R(s,x+14,334,112,48,"c","½",12); R(s,x+134,334,112,48,"c","×2",12)
T(s,x+14,400,"½ / ×2 apply once a tempo is set.",10,"tm"); R(s,x+14,412,232,48,"c","Original take",12); R(s,x+14,540,232,56,"a","Keep ✓",14)
K(s,x+250,196,1,"'No pulse' is a valid result: keep a free-time loop of the phrase, or set a tempo manually. No fabricated alternatives or confidence numbers.")
x=276
T(s,x+14,58,"Layer 2 · tempo locked to sketch (92)",11,"tm"); R(s,x+14,70,232,140,"p")
for i in range(5): L(s,x+20+i*56,74,x+20+i*56,206,"lg")
notes(s,x+20,84,14,0,[(0.5,1,1.5),(4.4,3,1.2),(8.1,2,2.0),(12.0,4,1.0)],"n",14)
R(s,x+188,140,52,12,"n"); R(s,x+228,136,14,20,"ld"); T(s,x+236,168,"held",9,"tm","m")
L(s,x+244,70,x+244,210,"la"); T(s,x+240,224,"now",9,"tm","e")
T(s,x+14,248,"Takes the last 4 bars you have played,",11,"t"); T(s,x+14,264,"ending at the last bar line already passed.",11,"t")
T(s,x+14,288,"Held note: released at loop end for",11,"t"); T(s,x+14,304,"playback only (marked); raw take unchanged.",11,"t")
R(s,x+14,322,232,48,"c","Joins at next loop start · 2.1 s",12); R(s,x+14,378,112,48,"c","◀ bar",12); R(s,x+134,378,112,48,"c","bar ▶",12)
R(s,x+14,540,232,56,"a","Keep ✓",14)
K(s,x+250,250,2,"While playing: selects only bounded history already played on the existing transport — never future notes or a bar line not yet reached.")
K(s,x+250,330,3,"Queued join: the new layer starts at the next loop boundary. Held/active notes get synthetic releases for playback only, stored apart from raw events.")
x=544
R(s,x+14,52,232,44,"w","⚠ Some notes dropped at 0:41",12)
R(s,x+14,104,232,120,"p")
notes(s,x+20,114,16,0,[(0.2,2,0.6),(1.4,4,0.5),(2.6,1,0.9),(8.8,3,0.6),(10.0,5,0.8),(12.2,2,0.5)],"n",12)
R(s,x+80,108,56,112,"d",""); T(s,x+108,168,"gap",10,"tb","m")
T(s,x+14,248,"Input overload: Blocks could not keep",11,"t"); T(s,x+14,264,"every event between 0:41 and 0:43.",11,"t")
T(s,x+14,288,"Older playing beyond 2:00 leaves",11,"tm"); T(s,x+14,304,"history normally (not an error).",11,"tm")
R(s,x+14,322,232,48,"c","Capture anyway (gap marked)",12); R(s,x+14,378,232,48,"c","Hear original take",12)
K(s,x+250,60,4,"Overload is a different state from normal age eviction: gaps/drops are flagged in the ribbon, the review and the take. Capture may fail or be partial; the UI never promises otherwise.")
x=812
T(s,x+14,58,"Layers 1–4 all have parts.",11,"t"); T(s,x+14,76,"Where should this capture go?",12,"tb")
R(s,x+14,92,232,56,"a","New layer (when supported)",12); R(s,x+14,156,232,56,"c","Replace layer… (choose, undoable)",12); R(s,x+14,220,232,56,"c","Keep as take only",12); R(s,x+14,284,232,56,"c","Cancel",12)
T(s,x+14,370,"Nothing is merged or replaced silently.",11,"tm")
K(s,x+250,100,5,"All slots full → an explicit choice. Default target is always an empty/new layer; never a silent destructive replace or merge.")

json.dump([{k:v for k,v in x.items()} for x in S.values()],open(os.path.join(HERE,"wire.json"),"w"),separators=(",",":"))
# SVG rendering (light palette from tokens)
P={"bg":"#FFFFFF","frame":"#1F2328","panel":"#F3F4F6","ctl":"#FFFFFF","ctlS":"#9AA1AB","acc":"#2F6FEB","sel":"#F2B705","note":"#7FA6F5","ghost":"#C9D1DC","warn":"#FFF4D6","dang":"#FDE2E1","txt":"#1F2328","mut":"#5B6470","grid":"#E3E6EA","mark":"#0E7C86"}
def esc(x): return html.escape(str(x),quote=True)
import textwrap
DARK={"play-portrait","fold-open","desktop","capture-review","piano-roll","capture-edge-states"}
D={"page":"#F4F5F7","bezel":"#05060A","bg":"#0D0F13","panel":"#14171C","ctl":"#1B1F25","ctlS":"#2A3038","acc":"#FF6A3D","accHi":"#FF8A63","accLo":"#E2512A","onAcc":"#120C0A",
   "txt":"#ECEEF2","mut":"#9AA3AF","grid":"#20242B","gridS":"#363D47","note":"#C9D1DC","ghost":"#6B7480","sel":"#FFFFFF","warnF":"#2A2312","warnS":"#E0A43A","dangF":"#2C1617","dangS":"#E5484D","mark":"#0E7C86"}
def svg(sc):
    w,h=sc["w"],sc["h"]; side=w<800; dark=sc["id"] in DARK
    lines=[]
    wrapw=58 if side else int(w/6.6)
    for n,txt in sc["a"]:
        ws=textwrap.wrap(txt,wrapw); lines.append((n,ws))
    nlines=sum(len(x[1]) for x in lines)
    W=w+440 if side else w; H=max(h, 40+nlines*16+len(lines)*6) if side else h+40+nlines*16+len(lines)*6
    o=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Inter, Roboto, Arial, sans-serif" role="img" aria-labelledby="t">',f'<title id="t">{esc(sc["title"])} (PROPOSED{" · visual north star style" if dark else ""})</title>']
    if dark:
        o.append(f'<defs><linearGradient id="cap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{D["accHi"]}"/><stop offset="1" stop-color="{D["accLo"]}"/></linearGradient>'
                 f'<linearGradient id="ctl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#20252C"/><stop offset="1" stop-color="#181B21"/></linearGradient></defs>')
        o.append(f'<rect width="100%" height="100%" fill="{D["page"]}"/>')
    else:
        o.append(f'<rect width="100%" height="100%" fill="{P["bg"]}"/>')
    sc["_lines"]=lines; sc["_side"]=side
    for p in sc["p"]:
        if p[0]=="r":
            _,x,y,ww,hh,role,lab,sz=p
            if dark:
                rx={"n":3,"ng":3,"f":28}.get(role,12 if hh>=40 else 6)
                tc=D["txt"]; fw=500; extra=""
                if role=="f": fill,st,sw,da=D["bg"],D["bezel"],6,""
                elif role=="p": fill,st,sw,da=D["panel"],"none",0,""
                elif role=="c": fill,st,sw,da="url(#ctl)",D["ctlS"],1,""
                elif role=="a": fill,st,sw,da="url(#cap)","none",0,""; tc=D["onAcc"]; fw=700
                elif role=="s":
                    if hh<40 and ww<200 and lab=="": fill,st,sw,da=D["acc"],D["sel"],2,""
                    else: fill,st,sw,da="#262B33",D["sel"],2,""; fw=650
                elif role=="n": fill,st,sw,da=D["note"],"none",0,""
                elif role=="ng": fill,st,sw,da="none",D["ghost"],1.2,"3 2"
                elif role=="ld": fill,st,sw,da="none",D["mut"],1.2,"5 4"
                elif role=="h": fill,st,sw,da=D["panel"],D["ghost"],1.5,"6 4"
                elif role=="w": fill,st,sw,da=D["warnF"],D["warnS"],1.5,""
                elif role=="d": fill,st,sw,da=D["dangF"],D["dangS"],1.5,""
                o.append(f'<rect x="{x}" y="{y}" width="{ww}" height="{hh}" rx="{rx}" fill="{fill}" stroke="{st}" stroke-width="{sw}"'+(f' stroke-dasharray="{da}"' if da else "")+"/>")
                if role in ("c","a") and hh>=40: o.append(f'<line x1="{x+rx}" y1="{y+1}" x2="{x+ww-rx}" y2="{y+1}" stroke="#FFFFFF" stroke-opacity="{0.35 if role=="a" else 0.06}" stroke-width="1"/>')
                if lab: o.append(f'<text x="{x+ww/2}" y="{y+hh/2+sz*0.35}" font-size="{sz}" text-anchor="middle" fill="{tc}" font-weight="{fw}" letter-spacing="0.2">{esc(lab)}</text>')
                continue
            fill,st,sw,da={"f":(P["bg"],P["frame"],2,""),"p":(P["panel"],P["grid"],1,""),"c":(P["ctl"],P["ctlS"],1,""),"a":(P["acc"],P["acc"],1,""),"s":(P["ctl"],P["frame"],3,""),"n":(P["note"],"#3D6FD8",1,""),"ng":(P["ghost"],P["mut"],1,"3 2"),"ld":("none",P["mut"],1.5,"6 4"),"h":(P["panel"],P["mut"],1.5,"6 4"),"w":(P["warn"],"#B7791F",1.5,""),"d":(P["dang"],"#C0392B",1.5,"")}[role]
            if role=="s" and hh<40 and ww<200 and lab=="" : fill="#FFE59A"
            o.append(f'<rect x="{x}" y="{y}" width="{ww}" height="{hh}" rx="{2 if role in ("n","ng") else 8}" fill="{fill}" stroke="{st}" stroke-width="{sw}"'+(f' stroke-dasharray="{da}"' if da else "")+"/>")
            if lab: o.append(f'<text x="{x+ww/2}" y="{y+hh/2+sz*0.35}" font-size="{sz}" text-anchor="middle" fill="{"#FFFFFF" if role=="a" else P["txt"]}" font-weight="{600 if role in ("a","s") else 400}">{esc(lab)}</text>')
        elif p[0]=="t":
            _,x,y,txt,sz,role,anc=p
            if dark:
                col={"t":D["txt"],"tb":D["txt"],"tm":D["mut"],"to":D["onAcc"],"tob":D["onAcc"]}[role]
                fw={"tb":650,"tob":750}.get(role,400); ls=' letter-spacing="0.8"' if (role=="tm" and sz<=11 and txt.isupper()) else (' letter-spacing="-0.4"' if sz>=24 else "")
            else:
                col={"t":P["txt"],"tb":P["txt"],"tm":P["mut"],"to":"#FFFFFF","tob":"#FFFFFF"}[role]; fw=600 if role in ("tb","tob") else 400; ls=""
            o.append(f'<text x="{x}" y="{y}" font-size="{sz}" text-anchor="{ {"s":"start","m":"middle","e":"end"}[anc]}" fill="{col}" font-weight="{fw}"{ls}>{esc(txt)}</text>')
        elif p[0]=="l":
            _,x1,y1,x2,y2,role=p
            if dark: st,sw,da={"lg":(D["grid"],1,""),"ls":(D["gridS"],1.5,""),"ld":(D["mut"],1.2,"5 4"),"la":(D["acc"],2,"")}[role]
            else: st,sw,da={"lg":(P["grid"],1,""),"ls":(P["mut"],1.5,""),"ld":(P["mut"],1.5,"6 4"),"la":(P["acc"],2.5,"")}[role]
            o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{st}" stroke-width="{sw}"'+(f' stroke-dasharray="{da}"' if da else "")+"/>")
        elif p[0]=="k":
            _,x,y,n=p
            o.append(f'<circle cx="{x}" cy="{y}" r="9" fill="{P["mark"]}" stroke="#FFFFFF" stroke-width="{1.5 if dark else 0}"/><text x="{x}" y="{y+4}" font-size="11" text-anchor="middle" fill="#FFFFFF" font-weight="700">{n}</text>')
    x0,y=(w+24,28) if sc["_side"] else (0,h+28)
    for n,ws in sc["_lines"]:
        o.append(f'<circle cx="{x0+14}" cy="{y-4}" r="8" fill="{P["mark"]}"/><text x="{x0+14}" y="{y}" font-size="10" text-anchor="middle" fill="#FFFFFF" font-weight="700">{n}</text>')
        for wl in ws:
            o.append(f'<text x="{x0+28}" y="{y}" font-size="11" fill="{P["txt"]}">{esc(wl)}</text>'); y+=16
        y+=6
    o.append("</svg>"); return "\n".join(o)
for i,sc in enumerate(S.values()):
    open(os.path.join(HERE,"..",f"{i:02d}-{sc['id']}.svg"),"w").write(svg(sc))
print(len(S), sum(len(s['p']) for s in S.values()))
