import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { browserSession, delay } from './browser-session.mjs';
const out = resolve(process.env.SYNTH_PROOF_DIR || '../standalone-synth-evidence');
mkdirSync(out, { recursive: true });
const url = process.env.SYNTH_PROOF_URL || 'http://127.0.0.1:41821/';
const report = { url, started: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), checks: [], screenshots: [], kind: 'Isolated Chrome, actual C++ WASM AudioWorklet signal; synthetic input, no physical MIDI/phone or listening claim' };
const b = await browserSession(), q = JSON.stringify;
async function check(name, fn) { await fn(); report.checks.push({ name, passed: true }); console.log('PASS ' + name); }
async function waitFor(expression) { for (let i = 0; i < 100; i++) { if (await b.evaluate(expression)) return; await delay(100); } throw Error('Timed out: ' + expression); }
async function rect(selector) { return b.evaluate(`(()=>{const e=document.querySelector(${q(selector)});if(!e)throw Error('Missing '+${q(selector)});e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})()`); }
async function mouse(type, x, y) { await b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }); }
async function click(selector) { const r = await rect(selector); await mouse('mousePressed', r.x + r.w / 2, r.y + r.h / 2); await mouse('mouseReleased', r.x + r.w / 2, r.y + r.h / 2); await delay(80); }
async function key(name) { await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name }); await delay(60); }
async function values() { return b.evaluate(`Array.from(document.querySelectorAll('input[data-param]'),e=>({id:Number(e.dataset.param),value:Number(e.value)})).sort((a,b)=>a.id-b.id).map(e=>e.value)`); }
async function undoDisabled() { return b.evaluate(`document.getElementById('undo').disabled`); }
async function module(name) { await click(`#module-tabs [data-module="${name}"]`); }
async function drag(selector, dx, dy, cancel = false) {
  const r = await rect(selector), x = r.x + r.w / 2, y = r.y + r.h / 2;
  assert.ok(r.w > 0 && r.h > 0, selector + ' must be visible');
  await mouse('mousePressed', x, y); await mouse('mouseMoved', x + dx, y + dy); await delay(70); const preview = await values();
  if (cancel) await key('Escape'); await mouse('mouseReleased', x + dx, y + dy); await delay(80); return preview;
}
async function meter() { return b.evaluate(`(()=>{const a=window.__proofAnalyser;if(!a)throw Error('Audio analyser not created');const v=new Float32Array(a.fftSize);a.getFloatTimeDomainData(v);return{rms:Math.sqrt(v.reduce((s,x)=>s+x*x,0)/v.length),peak:Math.max(...v.map(Math.abs)),finite:v.every(Number.isFinite)};})()`); }
async function screenshot(name) { const path = resolve(out, name + '.png'); await b.screenshot(path); report.screenshots.push(path); }
async function preset(name) { await b.evaluate(`(()=>{const e=document.getElementById('presets');if(![...e.options].some(o=>o.value===${q(name)}))throw Error('Preset missing');e.value=${q(name)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await delay(100); }
async function size(width, height = 900) { await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await delay(100); }
const point = (id, x, y) => ({ id, x, y, radiusX: 4, radiusY: 4, force: 1 });
async function touch(type, points) { await b.send('Input.dispatchTouchEvent', { type, touchPoints: points }); await delay(70); }
async function exportPatch() { await b.evaluate(`window.__proofExport=null`); await click('#export'); await waitFor(`typeof window.__proofExport==='string'`); return JSON.parse(await b.evaluate(`window.__proofExport`)); }
async function importPatch(patch, name) { const path=resolve(out,name+'.json');writeFileSync(path,JSON.stringify(patch));const {root}=await b.send('DOM.getDocument',{});const {nodeId}=await b.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#import'});await b.send('DOM.setFileInputFiles',{nodeId,files:[path]});await delay(160); }
function nearValues(actual,expected) { assert.equal(actual.length,expected.length);actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<=(i>=19?0:1),`parameter ${i}: ${value} != ${expected[i]}`)); }
let defaults;
try {
  // Explicit test instrumentation; application module private state is never read.
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `const Context=window.AudioContext;window.AudioContext=class extends Context{createAnalyser(){const a=super.createAnalyser();window.__proofAnalyser=a;return a;}};const makeURL=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{if(blob.type==='application/json')blob.text().then(text=>window.__proofExport=text);return makeURL(blob);};` });
  await b.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:out});
  await size(1440); await b.navigate(url); await waitFor(`document.querySelectorAll('input[data-param]').length===21`);
  report.scripts = await b.evaluate(`Array.from(document.scripts,s=>s.src)`);
  await check('standalone modules expose descriptor controls before audio starts', async () => {
    assert.equal(await b.evaluate(`document.getElementById('status').textContent`), 'Sound stopped'); assert.ok(report.scripts.every(s => !s.includes('/assets/index-') && !s.includes('react')));
    assert.deepEqual(await b.evaluate(`Array.from(document.querySelectorAll('#module-tabs [data-module]'),e=>e.dataset.module)`), ['tone', 'envelope', 'character', 'drop']);
    const initial=await values(); assert.equal(initial.length, 21); assert.ok(initial.every(n => Number.isFinite(n) && n >= 0 && n <= 1000)); assert.equal(await b.evaluate(`document.getElementById('error').textContent`), '');
    for (const name of ['envelope', 'character', 'drop', 'tone']) { await module(name); assert.deepEqual(await values(), initial); }
    await click('.patch-files > summary');await click('#init');defaults=await values();assert.notDeepEqual(defaults,initial);await click('#undo');assert.deepEqual(await values(),initial);await click('#init');
  });
  await check('rotary edits before Start are restored by one Undo', async () => {
    const before = await values(), beforeUndo = await undoDisabled(); await drag('[data-knob="11"]', 0, -30); const changed = await values(); assert.notEqual(changed[11], before[11]); for (let i = 0; i < before.length; i++) if (i !== 11) assert.equal(changed[i], before[i]);
    await click('#undo'); assert.deepEqual(await values(), before); assert.equal(await undoDisabled(), beforeUndo);
  });
  await check('both oscillators expose four discrete waves with independent single-step Undo',async()=>{
    await module('tone');
    for(const id of [19,20]){
      const selector=`[data-waveosc="${id}"]`;
      assert.deepEqual(await b.evaluate(`Array.from(document.querySelector('${selector}').options,o=>o.textContent)`),['Sine','Triangle','Saw','Pulse']);
      for(const wave of [0,1,2,3]){
        const before=await values(),undoBefore=await undoDisabled();if(before[id]===wave)continue;
        await b.evaluate(`(()=>{const e=document.querySelector('${selector}');e.value=${wave};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
        const changed=await values();assert.equal(changed[id],wave);for(let i=0;i<changed.length;i++)if(i!==id)assert.equal(changed[i],before[i]);
        await click('#undo');assert.deepEqual(await values(),before);assert.equal(await undoDisabled(),undoBefore);
      }
    }
    await module('envelope');assert.equal(await b.evaluate(`document.getElementById('waveforms').hidden`),true);await module('tone');
  });
  await check('top-right Volume and visible Sauce Drive each edit the existing patch with one Undo',async()=>{
    const before=await values(),undoBefore=await undoDisabled();await click('#volume-toggle');assert.equal(await b.evaluate(`document.getElementById('volume-panel').hidden`),false);await b.evaluate(`document.getElementById('volume-range').focus()`);await key('ArrowRight');assert.notEqual((await values())[0],before[0]);await key('Escape');assert.equal(await b.evaluate(`document.getElementById('volume-panel').hidden`),true);await click('#undo');assert.deepEqual(await values(),before);assert.equal(await undoDisabled(),undoBefore);
    await module('drop');await click('[data-sauce="drive"]');await drag('[data-knob="12"]',0,-25);assert.notEqual((await values())[12],before[12]);await click('#undo');assert.deepEqual(await values(),before);await module('tone');
  });
  await check('oscillator preview is visible beneath the selectors before audio starts',async()=>{
    const osc=await rect('#waveforms'),scope=await rect('#scope');assert(scope.y>=osc.y+osc.h&&scope.w>200&&scope.h>=25);assert.match(await b.evaluate(`document.getElementById('scope-label').textContent`),/Preview/);assert.ok(await b.evaluate(`(()=>{const c=document.getElementById('scope'),v=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<v.length;i+=4)if(v[i])n++;return n>100;})()`));
  });
  await check('attack, decay/sustain and release gestures each commit one undoable edit', async () => {
    await module('envelope');
    for (const [handle, ids, dx, dy] of [['attack', [4], 16, 0], ['decay', [5, 6], 14, -12], ['release', [7], 16, 0]]) {
      const before = await values(), beforeUndo = await undoDisabled(); await drag(`[data-handle="${handle}"]`, dx, dy); const changed = await values(); assert.ok(ids.some(id => changed[id] !== before[id]), handle + ' must edit its parameters');
      for (let i = 0; i < before.length; i++) if (!ids.includes(i)) assert.equal(changed[i], before[i]); await click('#undo'); assert.deepEqual(await values(), before); assert.equal(await undoDisabled(), beforeUndo);
    }
  });
  await check('bend gestures alter curvature without changing ADSR endpoints', async () => {
    for (const [name, id] of [['attack', 8], ['decay', 9], ['release', 10]]) {
      const before = await values(); await drag(`[data-bend="${name}"]`, 0, -22); const changed = await values(); assert.notEqual(changed[id], before[id]); for (let i = 0; i < before.length; i++) if (i !== id) assert.equal(changed[i], before[i]); await click('#undo'); assert.deepEqual(await values(), before);
    }
  });
  await check('Escape and touch cancellation restore exact envelope values without history', async () => {
    const before = await values(), beforeUndo = await undoDisabled(); const preview = await drag('[data-handle="attack"]', 18, 0, true); assert.notEqual(preview[4], before[4]); assert.deepEqual(await values(), before); assert.equal(await undoDisabled(), beforeUndo);
    const r = await rect('[data-handle="release"]'), p = point(1, r.x + r.w / 2, r.y + r.h / 2);
    await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 }); await touch('touchStart', [p]); await touch('touchMove', [{ ...p, x: p.x - 18 }]); assert.notDeepEqual(await values(), before); await touch('touchCancel', []); await b.send('Emulation.setTouchEmulationEnabled', { enabled: false }); assert.deepEqual(await values(), before); assert.equal(await undoDisabled(), beforeUndo);
  });
  await check('first envelope pointer owns the transaction while a second is ignored', async () => {
    const before = await values(), beforeUndo = await undoDisabled(), a = await rect('[data-handle="attack"]'), r = await rect('[data-handle="release"]');
    const p = point(1, a.x + a.w / 2, a.y + a.h / 2), second = point(2, r.x + r.w / 2, r.y + r.h / 2), moved = { ...p, x: p.x + 18 };
    await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 }); await touch('touchStart', [p]); await touch('touchMove', [moved]); const preview = await values(); assert.notDeepEqual(preview, before);
    const secondMoved={...second,x:second.x-22};await touch('touchStart', [moved, second]); await touch('touchMove', [moved, secondMoved]); assert.deepEqual(await values(), preview); await touch('touchEnd', [secondMoved]); assert.deepEqual(await values(), preview);await touch('touchMove',[{...moved,x:moved.x+10}]);const continued=await values();assert.notEqual(continued[4],preview[4],'original owner must keep editing after secondary finger lifts'); await touch('touchEnd', []); await b.send('Emulation.setTouchEmulationEnabled', { enabled: false }); assert.deepEqual(await values(), continued); await click('#undo'); assert.deepEqual(await values(), before); assert.equal(await undoDisabled(), beforeUndo);
  });
  await check('Character changes drift amount, speed and drive as one undoable gesture', async () => {
    await module('character'); const before = await values(), beforeUndo = await undoDisabled(); await drag('[data-knob="character"]', 0, -30); const changed = await values(); for (const id of [12, 13, 14]) assert.notEqual(changed[id], before[id]); for (let i = 0; i < before.length; i++) if (![12, 13, 14].includes(i)) assert.equal(changed[i], before[i]); await click('#undo'); assert.deepEqual(await values(), before); assert.equal(await undoDisabled(), beforeUndo);
  });
  await check('Precision changes individual character parameters and reports a Custom macro', async () => {
    await click('#parameters summary');
    for(const id of [13,14,12]) {const before=await values();await b.evaluate(`(()=>{const input=document.querySelector('input[data-param="${id}"]');input.value=Math.min(1000,Number(input.value)+100);input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(80);const changed=await values();assert.notEqual(changed[id],before[id]);for(let i=0;i<before.length;i++)if(i!==id)assert.equal(changed[i],before[i]);assert.match(await b.evaluate(`document.querySelector('[data-knob="character"]').getAttribute('aria-valuetext')`),/Custom/i);await click('#undo');assert.deepEqual(await values(),before);}
    await click('#parameters summary');
  });
  await check('Pitch Drop amount and time knobs edit their own parameters', async () => {
    await module('drop');await click('[data-sauce="drop"]'); for (const id of [15, 16]) { const before = await values(); await drag(`[data-knob="${id}"]`, 0, -25); const changed = await values(); assert.notEqual(changed[id], before[id]); for (let i = 0; i < before.length; i++) if (i !== id) assert.equal(changed[i], before[i]); await click('#undo'); assert.deepEqual(await values(), before); }
  });
  await check('presets apply complete bounded patches with one Undo; Init restores defaults', async () => {
    for (const name of ['velvet', 'glass', 'low']) { const before = await values(), beforeUndo = await undoDisabled(); await preset(name); const changed = await values(); assert.notDeepEqual(changed, before); assert.ok(changed.every(n => Number.isFinite(n) && n >= 0 && n <= 1000)); await click('#undo'); assert.deepEqual(await values(), before); assert.equal(await undoDisabled(), beforeUndo); }
    await preset('glass'); await click('#init'); assert.deepEqual(await values(), defaults);
  });
  await check('JSON v1/v2 imports retain old waves; v3 exports round-trip with atomic rejection', async () => {
    await preset('velvet');const before=await values(),patch=await exportPatch();assert.equal(patch.version,3);assert.equal(patch.values.length,21);assert.ok(before[18]>0);
    await importPatch({...patch,version:1,values:patch.values.slice(0,18)},'legacy-v1');const migrated=await values();nearValues(migrated.slice(0,18),before.slice(0,18));assert.equal(migrated[18],0);assert.deepEqual(migrated.slice(19),[2,3]);assert.equal(await b.evaluate(`document.getElementById('error').textContent`),'');await click('#undo');nearValues(await values(),before);
    await click('#init');const legacyBefore=await values();await importPatch({...patch,version:2,values:patch.values.slice(0,19)},'legacy-v2');nearValues((await values()).slice(0,19),before.slice(0,19));assert.deepEqual((await values()).slice(19),[2,3]);await click('#undo');nearValues(await values(),legacyBefore);await preset('velvet');
    await click('#init');const init=await values();await importPatch(patch,'current-v3');nearValues(await values(),before);await click('#undo');nearValues(await values(),init);
    const undoBefore=await undoDisabled();await importPatch({...patch,version:999},'invalid-version');nearValues(await values(),init);assert.equal(await undoDisabled(),undoBefore);assert.match(await b.evaluate(`document.getElementById('error').textContent`),/invalid|unsupported/i);
    await importPatch({...patch,values:patch.values.map((v,i)=>i===18?null:v)},'invalid-value');nearValues(await values(),init);assert.equal(await undoDisabled(),undoBefore);await importPatch({...patch,values:patch.values.map((v,i)=>i===18?0:v)},'valid-again');assert.equal(await b.evaluate(`document.getElementById('error').textContent`),'');await click('#init');nearValues(await values(),defaults);
  });
  await check('Start retains edited parameters and initializes the actual WASM AudioWorklet', async () => {
    await module('tone'); await drag('[data-knob="11"]', 0, -15); const before = await values(); await click('#start'); await waitFor(`document.getElementById('status').textContent.startsWith('Sound running')`); assert.deepEqual(await values(), before); assert.equal(await b.evaluate(`document.getElementById('error').textContent`), ''); await click('#init'); await delay(120);
  });
  await check('live touch produces a finite bounded signal through the portable core', async () => {
    const r = await rect('[data-pitch="60"]'), p = { x: r.x + r.w / 2, y: r.y + r.h - 20 };
    await mouse('mousePressed', p.x, p.y); await delay(400); report.signal = await meter(); assert.ok(report.signal.rms > .001); assert.ok(report.signal.finite && report.signal.peak <= 1); assert.match(await b.evaluate(`document.getElementById('monitor').textContent`), /1 voices/); await mouse('mouseReleased', p.x, p.y); await delay(900); assert.ok((await meter()).rms < .0001);
  });
  await check('Volume mutes actual stereo output while preserving a held note and reports genuine peak telemetry',async()=>{
    const before=await values(),r=await rect('[data-pitch="60"]'),p=point(1,r.x+r.w/2,r.y+r.h-20);await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await touch('touchStart',[p]);await delay(350);assert.ok((await meter()).rms>.001);assert.match(await b.evaluate(`document.getElementById('scope-label').textContent`),/Output/);assert.match(await b.evaluate(`document.getElementById('peak-readout').textContent`),/dBFS/);
    await b.evaluate(`document.getElementById('volume-toggle').click();document.getElementById('volume-range').focus()`);await key('Home');await delay(180);assert.equal((await values())[0],0);assert.ok((await meter()).rms<.0001);assert.equal(await b.evaluate(`document.querySelector('[data-pitch="60"]').classList.contains('active')`),true);
    await b.evaluate(`(()=>{const i=document.getElementById('volume-range');i.value=${before[0]/10};i.dispatchEvent(new Event('input',{bubbles:true}));})()`);await key('Escape');await delay(150);assert.ok((await meter()).rms>.001);await touch('touchEnd',[]);await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});await click('#init');
  });
  await check('held touch remains active while a rotary filter change reaches DSP', async () => {
    const r = await rect('[data-pitch="64"]'), p = point(1, r.x + r.w / 2, r.y + r.h - 20); await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 }); await touch('touchStart', [p]); await delay(400); const before = await meter();
    await b.evaluate(`document.querySelector('[data-knob="11"]').focus()`); await key('Home'); await delay(350); const after = await meter(); assert.ok(after.rms < before.rms * .6, JSON.stringify({ before, after })); assert.equal(await b.evaluate(`document.querySelector('[data-pitch="64"]').classList.contains('active')`), true); report.filter = { before, after }; await touch('touchEnd', []); await b.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await delay(900); assert.ok((await meter()).rms < .0001); await click('#init');
  });
  await check('held waveform edits reach audio immediately and remain finite without dropping ownership',async()=>{
    await click('#init');await module('tone');
    const r=await rect('[data-pitch="60"]'),p=point(1,r.x+r.w/2,r.y+r.h-20);
    await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await touch('touchStart',[p]);await delay(400);
    const before=await meter();const waveSignals=[];
    for(const wave of [0,1,3,2]){
      await b.evaluate(`(()=>{const e=document.querySelector('[data-waveosc="19"]');e.value=${wave};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(200);
      const audio=await meter();assert.ok(audio.finite&&audio.peak<=1&&audio.rms>.0001);assert.equal(await b.evaluate(`document.querySelector('[data-pitch="60"]').classList.contains('active')`),true);waveSignals.push({wave,...audio});
    }
    assert.ok(waveSignals.some(s=>Math.abs(s.rms-before.rms)>.0002),'Wave selection should measurably change audio');report.waveSignals=waveSignals;
    await touch('touchEnd',[]);await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});await click('#init');
  });
  await check('Fullness adds harmonic colour without attenuating the held-note foundation', async () => {
    await click('#init');await module('character');
    await b.evaluate(`(()=>{for(const[id,value]of [[1,0],[2,500],[11,1000],[19,0],[20,0]]){const i=document.querySelector('input[data-param="'+id+'"]');i.value=value;i.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
    await delay(150);const beforeValues=await values(),r=await rect('[data-pitch="60"]'),p=point(1,r.x+r.w/2,r.y+r.h-20);
    await b.evaluate(`window.__proofAnalyser.fftSize=8192`);
    const harmonics=()=>b.evaluate(`(()=>{const a=window.__proofAnalyser,v=new Float32Array(a.fftSize),rate=a.context.sampleRate;a.getFloatTimeDomainData(v);const amplitude=f=>{let real=0,imaginary=0,weight=0;for(let i=0;i<v.length;i++){const w=.5-.5*Math.cos(2*Math.PI*i/(v.length-1)),angle=2*Math.PI*f*i/rate;real+=v[i]*w*Math.cos(angle);imaginary-=v[i]*w*Math.sin(angle);weight+=w;}return 2*Math.hypot(real,imaginary)/weight;};return{fundamentalAmplitude:amplitude(261.625565),secondAmplitude:amplitude(523.25113)};})()`);
    await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await touch('touchStart',[p]);await delay(700);const before=await harmonics(),dry=await meter();await b.evaluate(`document.querySelector('[data-knob="18"]').focus()`);await key('End');await delay(900);const after=await harmonics(),fat=await meter();
    assert.equal((await values())[18],1000);assert.ok(fat.finite&&fat.peak<=1&&fat.rms>.001);assert.ok(after.secondAmplitude>before.secondAmplitude*2&&after.secondAmplitude>.0001);const ratio=after.fundamentalAmplitude/before.fundamentalAmplitude;assert.ok(ratio>.84&&ratio<1.19,JSON.stringify({before,after}));assert.ok(fat.rms/dry.rms>.84&&fat.rms/dry.rms<1.19);report.fullness={before,after,dry,fat};
    await touch('touchEnd',[]);await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});await click('#undo');nearValues(await values(),beforeValues);await click('#init');await module('tone');
  });
  await check('preset changes release touch ownership and Stop silences before resume', async () => {
    const r = await rect('[data-pitch="60"]'), p = point(1, r.x + r.w / 2, r.y + r.h - 20); await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 }); await touch('touchStart', [p]); await delay(150); await preset('velvet'); assert.equal(await b.evaluate(`document.querySelectorAll('.key.active').length`), 0); await touch('touchEnd', []); await b.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await click('#stop'); await waitFor(`document.getElementById('status').textContent==='Sound stopped'`); assert.equal(await b.evaluate(`document.querySelectorAll('.key.active').length`), 0); await click('#start'); await waitFor(`document.getElementById('status').textContent.startsWith('Sound running')`); await delay(100); assert.ok((await meter()).rms < .0001);
  });
  await check('320, 390 and 1440 layouts retain modules and visible envelope handles', async () => {
    for (const width of [320, 390, 1440]) { await size(width, width < 500 ? 844 : 900); await module('envelope'); assert.ok(await b.evaluate(`document.documentElement.scrollWidth<=innerWidth+1`)); for (const selector of ['#shape-surface', '[data-handle="attack"]', '[data-handle="decay"]', '[data-handle="release"]']) { const r = await rect(selector); assert.ok(r.w > 0 && r.h > 0 && r.x >= -1 && r.x + r.w <= width + 1, selector + ' visible at ' + width); } await b.evaluate(`window.scrollTo(0,0)`); await screenshot('standalone-' + width); }
  });
  await click('#stop'); assert.deepEqual(b.exceptions, []); report.passed = true;
} catch (error) { report.passed = false; report.error = error.stack || String(error); process.exitCode = 1; console.error(report.error); try { report.ui = await b.evaluate(`({status:document.getElementById('status')?.textContent,error:document.getElementById('error')?.textContent,inputs:document.querySelectorAll('input[data-param]').length,text:document.body.innerText})`); await screenshot('failure'); } catch {} }
finally { report.exceptions = b.exceptions; report.finished = new Date().toISOString(); writeFileSync(resolve(out, 'standalone-report.json'), JSON.stringify(report, null, 2)); await b.close(); }
