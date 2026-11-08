#!/usr/bin/env bash
# Re-runnable package checks. Usage: bash checks/run_checks.sh  (from the package root). Writes checks/check-log.txt.
set -u; cd "$(dirname "$0")/.."; LOG=checks/check-log.txt; CH=${CHROME:-$(command -v google-chrome || command -v chromium || command -v chromium-browser)}
{
echo "# Blocks package checks — run $(date '+%Y-%m-%d %H:%M %Z')"; echo "python: $(python3 --version 2>&1)"; echo "chrome: $($CH --version 2>&1)"; echo "node: $(node --version 2>&1)"
echo "## 1. SVG wireframes parse (xml.etree)"; python3 -c "
import glob,xml.etree.ElementTree as E
fs=sorted(glob.glob('wireframes/*.svg')); bad=[]
for f in fs:
    try: E.parse(f)
    except Exception as e: bad.append((f,str(e)))
print(len(fs),'files; failures:',bad)"
echo "## 2. tokens.json parses"; python3 -c "import json;json.load(open('tokens.json'));print('ok')"
echo "## 3. Contrast (rev 3.2 pairings, themes C/D)"; python3 hifi/src/contrast_rev32.py; echo "contrast.tsv fails: $(grep -ci 'fail' hifi/contrast.tsv)"
echo "## 3b. Contrast (rev 3.3 editor pairings: text 4.5:1, non-text cues 3:1)"; python3 hifi/src/contrast_rev33.py | tail -1; echo "contrast-rev33.tsv fails: $(grep -c 'fail$' hifi/contrast-rev33.tsv)"
echo "## 3c. Rev 3.3 editor renders present (2x) in both themes"; python3 -c "
import os
from PIL import Image
names=['17-editor-entry','18-editor-select','19-editor-move','20-editor-marquee','21-editor-resize','22-editor-draw','23-editor-erase','24-editor-velocity','25-editor-quantise','26-editor-overflow','27-editor-return','fold-18-editor','desktop-18-editor']
miss=[];bad=[]
for v in ('dark','light'):
    for n in names:
        for f in ('hifi/hybrid/%s/%s.png'%(v,n),'hifi/hybrid/%s/src/%s@2x.png'%(v,n),'hifi/hybrid/%s/src/%s.html'%(v,n)):
            if not os.path.exists(f): miss.append(f)
        f='hifi/hybrid/%s/src/%s@2x.png'%(v,n)
        if os.path.exists(f):
            w,h=Image.open(f).size
            if n[0].isdigit() and (w,h)!=(780,1688): bad.append((f,w,h))
    if not os.path.exists('hifi/hybrid/%s/editor-overview.png'%v): miss.append('editor-overview '+v)
print(len(names)*2,'frames x3 files + 2 overviews; missing:',miss,'; wrong 2x size:',bad)"
echo "## 3d. PROPOSED label on every editor frame source"; for f in hifi/hybrid/*/src/*editor*.html; do grep -q PROPOSED "$f" || echo "missing PROPOSED: $f"; done; echo "checked $(ls hifi/hybrid/*/src/*editor*.html | wc -l) editor sources"
echo "## 4. Copy hygiene greps (expect 0)"; echo "Rhodes: $(grep -rIl 'Rhodes' --exclude-dir=fonts --exclude-dir=checks . | wc -l) files"; echo "Samsung Internet lines without 'not checked'/'have not': $(grep -rIn 'Samsung Internet' --include=*.md --include=*.json --include=*.svg . | grep -v -i 'not checked\|have not\|never recommend\|unless checked' | wc -l)"
echo "## 5. Prototype script syntax"; python3 -c "
import re;s=open('hifi/prototype/index.html').read();open('/tmp/_p.js','w').write(re.findall(r'<script>(.*?)</script>',s,re.S)[-1])"; node --check /tmp/_p.js && echo "node --check ok"
echo "## 6. Prototype interaction test (headless Chrome)"; python3 -c "
s=open('hifi/prototype/index.html').read();t=open('checks/prototype-test.js').read();open('/tmp/_pt.html','w').write(s.replace('</body>','<script>'+t+'</script></body>'))"
"$CH" --headless=new --disable-gpu --no-sandbox --window-size=1440,960 --virtual-time-budget=3000 --dump-dom file:///tmp/_pt.html 2>/dev/null | grep -o 'data-test="[^"]*"'
echo "## 7. Package fonts load for the generator"; (cd hifi/src && python3 -c "import build;print(build.font_css().count('@font-face'),'@font-face rules from',build.__file__)" 2>&1 | grep -v subset); rm -rf hifi/src/__pycache__
echo "## 8. Link check"; echo "Sources were opened with WebFetch and HTTP re-checked on 8 Nov 2026: link-check.tsv ($(awk 'NR>1' link-check.tsv | wc -l) rows; non-200: $(awk -F'\t' 'NR>1 && $2!=200' link-check.tsv | wc -l)). Not re-run by this script (needs network; some sites block scripted fetches)."
} > "$LOG" 2>&1; cat "$LOG"
