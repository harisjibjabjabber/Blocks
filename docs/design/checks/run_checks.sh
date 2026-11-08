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
echo "## 4. Copy hygiene greps (expect 0)"; echo "Rhodes: $(grep -rIl 'Rhodes' --exclude-dir=fonts --exclude-dir=checks . | wc -l) files"; echo "Samsung Internet lines without 'not checked'/'have not': $(grep -rIn 'Samsung Internet' --include=*.md --include=*.json --include=*.svg . | grep -v -i 'not checked\|have not\|never recommend\|unless checked' | wc -l)"
echo "## 5. Prototype script syntax"; python3 -c "
import re;s=open('hifi/prototype/index.html').read();open('/tmp/_p.js','w').write(re.findall(r'<script>(.*?)</script>',s,re.S)[-1])"; node --check /tmp/_p.js && echo "node --check ok"
echo "## 6. Prototype interaction test (headless Chrome)"; python3 -c "
s=open('hifi/prototype/index.html').read();t=open('checks/prototype-test.js').read();open('/tmp/_pt.html','w').write(s.replace('</body>','<script>'+t+'</script></body>'))"
"$CH" --headless=new --disable-gpu --no-sandbox --window-size=1440,960 --virtual-time-budget=3000 --dump-dom file:///tmp/_pt.html 2>/dev/null | grep -o 'data-test="[^"]*"'
echo "## 7. Package fonts load for the generator"; (cd hifi/src && python3 -c "import build;print(build.font_css().count('@font-face'),'@font-face rules from',build.__file__)" 2>&1 | grep -v subset); rm -rf hifi/src/__pycache__
echo "## 8. Link check"; echo "Sources were opened with WebFetch and HTTP re-checked on 8 Nov 2026: link-check.tsv ($(awk 'NR>1' link-check.tsv | wc -l) rows; non-200: $(awk -F'\t' 'NR>1 && $2!=200' link-check.tsv | wc -l)). Not re-run by this script (needs network; some sites block scripted fetches)."
} > "$LOG" 2>&1; cat "$LOG"
