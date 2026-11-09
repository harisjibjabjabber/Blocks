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
function nearValues(actual,expected) { assert.equal(actual.length,expected.length);actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<=([19,20].includes(i)?0:1),`parameter ${i}: ${value} != ${expected[i]}`)); }
let defaults;
try {
  // Explicit test instrumentation; application module private state is never read.
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `const Context=window.AudioContext;window.AudioContext=class extends Context{createAnalyser(){const a=super.createAnalyser();window.__proofAnalyser=a;return a;}};const makeURL=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{if(blob.type==='application/json')blob.text().then(text=>window.__proofExport=text);return makeURL(blob);};` });
  await b.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:out});
  await size(1440); await b.navigate(url); await waitFor(`document.querySelectorAll('input[data-param]').length===35`);
  report.scripts = await b.evaluate(`Array.from(document.scripts,s=>s.src)`);
  await check('standalone modules expose descriptor controls before audio starts', async () => {
    assert.equal(await b.evaluate(`document.getElementById('status').textContent`), 'Sound stopped'); assert.ok(report.scripts.every(s => !s.includes('/assets/index-') && !s.includes('react')));
    assert.deepEqual(await b.evaluate(`Array.from(document.querySelectorAll('#module-tabs [data-module]'),e=>e.dataset.module)`), ['tone', 'envelope', 'character', 'drop']);
    const initial=await values(); assert.equal(initial.length, 35); assert.ok(initial.every(n => Number.isFinite(n) && n >= 0 && n <= 1000)); assert.equal(await b.evaluate(`document.getElementById('error').textContent`), '');
    for (const name of ['envelope', 'character', 'drop', 'tone']) { await module(name); assert.deepEqual(await values(), initial); }
    await click('.patch-files > summary');await click('#init');defaults=await values();assert.notDeepEqual(defaults,initial);await click('#undo');assert.deepEqual(await values(),initial);await click('#init');
  });
  await check('rotary edits before Start are restored by one Undo', async () => {
    const before = await values(), beforeUndo = await undoDisabled(); await drag('[data-knob="11"]', 0, -30); const changed = await values(); assert.notEqual(changed[11], before[11]); for (let i = 0; i < before.length; i++) if (i !== 11) assert.equal(changed[i], before[i]);
    await click('#undo'); assert.deepEqual(await values(), before); assert.equal(await undoDisabled(), beforeUndo);
  });
  await check('both oscillator popovers expose five discrete waves with one Undo',async()=>{
    await module('tone');
    for(const id of [19,20]){
      await click(`[data-waveosc="${id}"]`);assert.deepEqual(await b.evaluate(`Array.from(document.querySelectorAll('#wave-popover [data-wave]'),e=>e.textContent)`),['Sine','Triangle','Saw','Pulse','Square']);await key('Escape');
      for(const wave of [0,1,2,3,4]){
        const before=await values(),undoBefore=await undoDisabled();if(before[id]===wave)continue;
        await click(`[data-waveosc="${id}"]`);await click(`#wave-popover [data-wave="${wave}"]`);
        const changed=await values();assert.equal(changed[id],wave);for(let i=0;i<changed.length;i++)if(i!==id)assert.equal(changed[i],before[i]);assert.equal(await b.evaluate(`document.getElementById('wave-popover').hidden`),true);
        await click('#undo');assert.deepEqual(await values(),before);assert.equal(await undoDisabled(),undoBefore);
      }
    }
    await module('envelope');assert.equal(await b.evaluate(`document.getElementById('waveforms').hidden`),true);await module('tone');
  });
  await check('inline oscillator Mix dials are independent, mute directly and Undo exactly without a popup',async()=>{
    for(const id of [21,22]){
      const before=await values(),other=id===21?22:21;await b.evaluate(`document.querySelector('[data-osclevel="${id}"]').focus()`);await key('ArrowLeft');const changed=await values();assert.notEqual(changed[id],before[id]);assert.equal(changed[other],before[other]);for(let i=0;i<changed.length;i++)if(![1,id].includes(i))assert.equal(changed[i],before[i]);assert.ok(Math.abs(changed[1]-Math.round(1000*changed[22]/(changed[21]+changed[22])))<=1);assert.equal(await b.evaluate(`document.getElementById('wave-popover').hidden`),true);await click('#undo');nearValues(await values(),before);
      await b.evaluate(`document.querySelector('[data-osclevel="${id}"]').focus()`);await key('Home');assert.equal((await values())[id],0);assert.equal((await values())[other],before[other]);await click('#undo');nearValues(await values(),before);
      await drag(`[data-osclevel="${id}"]`,0,-20,true);nearValues(await values(),before);
    }
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
  await check('filter envelope has independent gestures and curves without changing amplitude ADSR',async()=>{
    const baseline=await values();await click('#envelope-tabs [data-envelope="filter"]');nearValues(await values(),baseline);assert.equal(await b.evaluate(`document.getElementById('module-title').textContent`),'Filter envelope');
    for(const[handle,ids,dx,dy]of [['attack',[25],18,0],['decay',[26,27],15,-15],['release',[28],18,0]]){const before=await values();await drag(`[data-handle="${handle}"]`,dx,dy);const changed=await values();assert.ok(ids.some(id=>changed[id]!==before[id]));for(let i=0;i<before.length;i++)if(!ids.includes(i))assert.equal(changed[i],before[i]);await click('#undo');nearValues(await values(),before);}
    await drag('[data-stage-readout][data-handle="sustain"]',0,-35);assert.ok((await values())[27]>0);
    for(const[name,id]of [['attack',29],['decay',30],['release',31]]){const before=await values();await drag(`[data-bend="${name}"]`,0,-22);assert.notEqual((await values())[id],before[id]);await click('#undo');nearValues(await values(),before);}
    await click('#undo');nearValues(await values(),baseline);
    const before=await values();await drag('[data-knob="24"]',0,-25);assert.notEqual((await values())[24],before[24]);await click('#undo');nearValues(await values(),before);await click('#envelope-tabs [data-envelope="amp"]');nearValues(await values(),baseline);
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
  await check('Character changes tone colour without changing Motion or Speed', async () => {
    await module('character'); const before = await values(), beforeUndo = await undoDisabled(); await drag('[data-knob="character"]', 0, -30); const changed = await values(); for (const id of [12]) assert.notEqual(changed[id], before[id]); for (let i = 0; i < before.length; i++) if (i!==12) assert.equal(changed[i], before[i]); await click('#undo'); assert.deepEqual(await values(), before); assert.equal(await undoDisabled(), beforeUndo);
  });
  await check('Motion changes only movement, stays finite and is independently undoable',async()=>{
    await module('character');const before=await values(),undoBefore=await undoDisabled();await drag('[data-knob="motion"]',0,-45);const changed=await values();for(const id of [13,32,34])assert.notEqual(changed[id],before[id]);for(let i=0;i<changed.length;i++)if(![13,32,33,34].includes(i))assert.equal(changed[i],before[i]);assert.doesNotMatch(await b.evaluate(`document.querySelector('[data-knob="motion"]').getAttribute('aria-valuetext')`),/NaN/);await click('#undo');nearValues(await values(),before);assert.equal(await undoDisabled(),undoBefore);
  });
  await check('Motion details separate Speed and note attacks from Character with exact Undo',async()=>{
    const original=await values();await b.evaluate(`document.querySelector('[data-knob="motion"]').focus()`);await key('Home');const base=await values();
    for(const id of [14,32,33,34]){
      await click('#motion-details-toggle');const before=await values(),tone=await b.evaluate(`document.querySelector('[data-knob="character"]').getAttribute('aria-valuetext')`),motion=await b.evaluate(`document.querySelector('[data-knob="motion"]').getAttribute('aria-valuetext')`);
      await b.evaluate(`document.querySelector('#motion-controls [data-knob="${id}"]').focus()`);await key('ArrowRight');const after=await values();assert.notEqual(after[id],before[id]);for(let i=0;i<after.length;i++)if(i!==id)assert.equal(after[i],before[i]);assert.equal(await b.evaluate(`document.querySelector('[data-knob="character"]').getAttribute('aria-valuetext')`),tone);
      const readout=await b.evaluate(`document.querySelector('[data-knob="motion"]').getAttribute('aria-valuetext')`);if(id===14)assert.equal(readout,motion);else assert.match(readout,/Custom/i);
      await click('#undo');nearValues(await values(),base);
    }
    await click('#undo');nearValues(await values(),original);await key('Escape');
  });
  await check('Precision changes individual character parameters and reports a Custom macro', async () => {
    await click('#parameters summary');
    for(const id of [13,14,12]) {const before=await values();await b.evaluate(`(()=>{const input=document.querySelector('input[data-param="${id}"]');input.value=${id===12?1000:"Math.min(1000,Number(input.value)+100)"};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(80);const changed=await values();assert.notEqual(changed[id],before[id]);for(let i=0;i<before.length;i++)if(i!==id)assert.equal(changed[i],before[i]);if(id===12)assert.match(await b.evaluate(`document.querySelector('[data-knob="character"]').getAttribute('aria-valuetext')`),/Custom/i);await click('#undo');assert.deepEqual(await values(),before);}
    await click('#parameters summary');
  });
  await check('Pitch Drop amount and time knobs edit their own parameters', async () => {
    await module('drop');await click('[data-sauce="drop"]'); for (const id of [15, 16]) { const before = await values(); await drag(`[data-knob="${id}"]`, 0, -25); const changed = await values(); assert.notEqual(changed[id], before[id]); for (let i = 0; i < before.length; i++) if (i !== id) assert.equal(changed[i], before[i]); await click('#undo'); assert.deepEqual(await values(), before); }
  });
  await check('presets apply complete bounded patches with one Undo; Init restores defaults', async () => {
    for (const name of ['velvet', 'glass', 'low']) { const before = await values(), beforeUndo = await undoDisabled(); await preset(name); const changed = await values(); assert.notDeepEqual(changed, before); assert.ok(changed.every(n => Number.isFinite(n) && n >= 0 && n <= 1000)); await click('#undo'); assert.deepEqual(await values(), before); assert.equal(await undoDisabled(), beforeUndo); }
    await preset('glass'); await click('#init'); assert.deepEqual(await values(), defaults);
  });
  await check('JSON v1/v2/v3 import defaults and canonical levels; v4 round-trip rejects invalid patches atomically',async()=>{
    await preset('velvet');const before=await values(),patch=await exportPatch();assert.equal(patch.version,4);assert.equal(patch.values.length,35);
    for(const[version,count]of [[1,18],[2,19],[3,21]]){
      await importPatch({...patch,version,values:patch.values.slice(0,count)},'legacy-v'+version);const migrated=await values();nearValues(migrated.slice(0,count),before.slice(0,count));if(version===1)assert.equal(migrated[18],0);if(version<3)assert.deepEqual(migrated.slice(19,21),[2,3]);assert.ok(Math.abs(migrated[21]-Math.round((1-patch.values[1])*1000))<=1);assert.ok(Math.abs(migrated[22]-Math.round(patch.values[1]*1000))<=1);nearValues(migrated.slice(23),defaults.slice(23));assert.equal(await b.evaluate(`document.getElementById('error').textContent`),'');await click('#undo');nearValues(await values(),before);
    }
    await click('#init');const init=await values();await importPatch(patch,'current-v4');nearValues(await values(),before);await click('#undo');nearValues(await values(),init);
    const undoBefore=await undoDisabled();await importPatch({...patch,version:999},'invalid-version');nearValues(await values(),init);assert.equal(await undoDisabled(),undoBefore);assert.match(await b.evaluate(`document.getElementById('error').textContent`),/invalid|unsupported/i);
    await importPatch({...patch,values:patch.values.map((v,i)=>i===34?null:v)},'invalid-value');nearValues(await values(),init);assert.equal(await undoDisabled(),undoBefore);await importPatch({...patch,values:patch.values.map((v,i)=>i===18?0:v)},'valid-again');assert.equal(await b.evaluate(`document.getElementById('error').textContent`),'');await click('#init');nearValues(await values(),defaults);
  });
  await check('Mono and performance controls edit only saved performance state with one-step Undo',async()=>{
    await click('#init');const before=await values();await click('#mono-toggle');assert.equal(await b.evaluate(`document.getElementById('mono-toggle').getAttribute('aria-pressed')`),'true');nearValues(await values(),before);await click('#undo');assert.equal(await b.evaluate(`document.getElementById('mono-toggle').getAttribute('aria-pressed')`),'false');
    await module('drop');await click('[data-sauce="arp"]');assert.equal(await b.evaluate(`document.getElementById('performance-panel').hidden`),false);
    await click('[data-performance-mode="arp"]');assert.equal((await exportPatch()).performance.mode,'arp');await click('#undo');assert.equal((await exportPatch()).performance.mode,'off');
    await click('[data-performance-mode="arp"]');const arp=(await exportPatch()).performance;
    await b.evaluate(`document.querySelector('[data-performance="curl"]').focus()`);await key('ArrowRight');assert((await exportPatch()).performance.curl>0);nearValues(await values(),before);await click('#undo');assert.deepEqual((await exportPatch()).performance,arp);
    await click('#performance-bpm-up');assert.equal((await exportPatch()).performance.bpm,121);await click('#undo');assert.equal((await exportPatch()).performance.bpm,120);
    const saved=await exportPatch();await click('#init');assert.equal((await exportPatch()).performance.mode,'off');await importPatch(saved,'performance-arp');assert.deepEqual((await exportPatch()).performance,saved.performance);
    const stable=await exportPatch();await importPatch({...saved,performance:{...saved.performance,mode:'bad-mode'},values:saved.values.map((v,i)=>i===0?.9:v)},'invalid-performance');nearValues(await values(),before);assert.deepEqual((await exportPatch()).performance,stable.performance);assert.match(await b.evaluate(`document.getElementById('error').textContent`),/performance/i);
    await click('#init');await module('tone');
  });
  await check('Start retains edited parameters and initializes the actual WASM AudioWorklet', async () => {
    await module('tone'); await drag('[data-knob="11"]', 0, -15); const before = await values(); await click('#start'); await waitFor(`document.getElementById('status').textContent.startsWith('Sound running')`); assert.deepEqual(await values(), before); assert.equal(await b.evaluate(`document.getElementById('error').textContent`), ''); await click('#init'); await delay(120);
  });
  await check('live touch produces a finite bounded signal through the portable core', async () => {
    const r = await rect('[data-pitch="60"]'), p = { x: r.x + r.w / 2, y: r.y + r.h - 20 };
    await mouse('mousePressed', p.x, p.y); await delay(400); report.signal = await meter(); assert.ok(report.signal.rms > .001); assert.ok(report.signal.finite && report.signal.peak <= 1); assert.match(await b.evaluate(`document.getElementById('monitor').textContent`), /1 voices/); await mouse('mouseReleased', p.x, p.y); await delay(900); assert.ok((await meter()).rms < .0001);
  });
  await check('Mono keeps one primary voice, restores held notes and releases cleanly',async()=>{
    await click('#mono-toggle');const first=await rect('[data-pitch="60"]'),second=await rect('[data-pitch="64"]');const a=point(1,first.x+first.w/2,first.y+first.h-20),z=point(2,second.x+second.w/2,second.y+second.h-20);
    await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3});await touch('touchStart',[a]);await delay(220);await touch('touchStart',[a,z]);await delay(260);assert.match(await b.evaluate(`document.getElementById('monitor').textContent`),/^1 voices$/);assert.ok((await meter()).rms>.001);
    await touch('touchEnd',[a]);await delay(260);assert.match(await b.evaluate(`document.getElementById('monitor').textContent`),/^1 voices$/);assert.ok((await meter()).rms>.001);await touch('touchEnd',[]);await delay(900);assert.ok((await meter()).rms<.0001);await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});await click('#undo');assert.equal(await b.evaluate(`document.getElementById('mono-toggle').getAttribute('aria-pressed')`),'false');assert.equal(await b.evaluate(`document.getElementById('error').textContent`),'');
  });
  await check('Arp and Strum process held chord input through the actual core and stop without queued notes',async()=>{
    for(const mode of ['arp','strum']){
      await module('drop');await click('[data-sauce="arp"]');await click(`[data-performance-mode="${mode}"]`);
      const points=[];for(const [i,pitch]of [60,64,67].entries()){const r=await rect(`[data-pitch="${pitch}"]`);points.push(point(i+1,r.x+r.w/2,r.y+r.h-20));}
      await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3});await touch('touchStart',points);await delay(850);const signal=await meter();assert(signal.finite&&signal.peak<=1&&signal.rms>.0001,mode+' audible');assert.equal(await b.evaluate(`document.querySelectorAll('.key.active').length`),3);
      await touch('touchEnd',[]);await delay(1000);assert.ok((await meter()).rms<.0001,mode+' releases');await delay(400);assert.ok((await meter()).rms<.0001,mode+' has no queued resurrection');await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});await click('#init');
    }
    await module('tone');assert.equal(await b.evaluate(`document.getElementById('error').textContent`),'');
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
    for(const wave of [0,1,3,4,2]){
      await click('[data-waveosc="19"]');await click(`#wave-popover [data-wave="${wave}"]`);await delay(200);
      const audio=await meter();assert.ok(audio.finite&&audio.peak<=1&&audio.rms>.0001);assert.equal(await b.evaluate(`document.querySelector('[data-pitch="60"]').classList.contains('active')`),true);waveSignals.push({wave,...audio});
    }
    assert.ok(waveSignals.some(s=>Math.abs(s.rms-before.rms)>.0002),'Wave selection should measurably change audio');report.waveSignals=waveSignals;
    await touch('touchEnd',[]);await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});await click('#init');
  });
  await check('independent oscillator level batches mute and restore actual held audio',async()=>{
    await click('#init');await module('tone');const r=await rect('[data-pitch="60"]'),p=point(1,r.x+r.w/2,r.y+r.h-20);await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await touch('touchStart',[p]);await delay(300);const sounding=await meter();assert.ok(sounding.rms>.001);
    for(const id of [21,22]){await b.evaluate(`document.querySelector('[data-osclevel="${id}"]').focus()`);await key('Home');}await delay(250);const silent=await meter();assert.equal((await values())[21],0);assert.equal((await values())[22],0);assert.ok(silent.rms<.0001);assert.equal(await b.evaluate(`document.querySelector('[data-pitch="60"]').classList.contains('active')`),true);
    await b.evaluate(`document.querySelector('[data-osclevel="21"]').focus()`);await key('End');await delay(250);const restored=await meter();assert.ok(restored.rms>.001);assert.equal((await values())[22],0);report.oscillatorLevels={sounding,silent,restored};await touch('touchEnd',[]);await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});await click('#init');
  });
  await check('independent filter envelope amount and dry mix reach the actual held-note DSP',async()=>{
    await click('#init');await module('tone');await b.evaluate(`(()=>{for(const[id,value]of [[1,0],[4,0],[6,1000],[11,300],[25,0],[27,1000],[24,500],[23,1000]]){const e=document.querySelector('input[data-param="'+id+'"]');e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}})()`);await delay(120);
    const r=await rect('[data-pitch="60"]'),p=point(1,r.x+r.w/2,r.y+r.h-20);await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await touch('touchStart',[p]);await delay(500);const base=await meter();
    await module('envelope');await click('#envelope-tabs [data-envelope="filter"]');await b.evaluate(`document.querySelector('[data-knob="24"]').focus()`);await key('End');await delay(300);const envelope=await meter();assert.ok(envelope.rms>base.rms*1.4,JSON.stringify({base,envelope}));assert.equal(await b.evaluate(`document.querySelector('[data-pitch="60"]').classList.contains('active')`),true);
    await b.evaluate(`(()=>{const e=document.querySelector('input[data-param="24"]');e.value=500;e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await module('tone');await b.evaluate(`document.querySelector('[data-knob="23"]').focus()`);await key('Home');await delay(300);const bypass=await meter();assert.ok(bypass.rms>base.rms*1.4);report.filterEnvelope={base,envelope,bypass};await touch('touchEnd',[]);await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});await module('envelope');await click('#envelope-tabs [data-envelope="amp"]');await click('#init');await module('tone');
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
