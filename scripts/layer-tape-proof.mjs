// Capture-boundary regression through real app handlers in isolated headless Chrome.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { browserSession, delay } from './browser-session.mjs';

const url = process.env.BLOCKS_PROOF_URL || 'http://127.0.0.1:41714/Blocks/';
const out = resolve(process.env.BLOCKS_TAPE_PROOF_DIR || process.env.BLOCKS_PROOF_DIR || '../layer-tape-evidence');
mkdirSync(out, { recursive: true });
const report = { url, started: new Date().toISOString(), kind: 'isolated Chrome synthetic mouse and touch input; no physical-device or listening claim', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), checks: [], screenshots: [] };
const b = await browserSession(), q = JSON.stringify;
const label = name => `[aria-label=${q(name)}]`;
async function rect(selector) { return b.evaluate(`(()=>{const e=document.querySelector(${q(selector)});if(!e)throw Error('Missing '+${q(selector)});(e.closest('[data-roll],[data-touch-keyboard]')||e).scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})()`); }
async function mouse(type, x, y) { await b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }); }
async function click(selector) { const r = await rect(selector); await mouse('mousePressed', r.x + r.w / 2, r.y + r.h / 2); await mouse('mouseReleased', r.x + r.w / 2, r.y + r.h / 2); await delay(70); }
const button = name => click(label(name));
const layer = number => click(`[aria-label^="Layer ${number}, Warm EP"]`);
async function state() { return b.evaluate(`(()=>{const r=document.querySelector('[data-roll]'),s=document.querySelector('[data-boundary="start"]'),e=document.querySelector('[data-boundary="end"]');return{bpm:Number(r.dataset.gridBpm),bounds:s&&e?{start:s.dataset.boundaryTime,end:e.dataset.boundaryTime}:null,view:{start:r.dataset.viewStart,end:r.dataset.viewEnd},layers:document.querySelectorAll('[aria-label^="Layer "][aria-label*="Warm EP"]').length,notes:[...r.querySelectorAll('[data-note]')].map(n=>({id:n.dataset.note,start:n.dataset.start,end:n.dataset.end,pitch:Number(n.dataset.pitch),velocity:Number(n.dataset.velocity)})).sort((a,b)=>BigInt(a.start)<BigInt(b.start)?-1:BigInt(a.start)>BigInt(b.start)?1:a.id.localeCompare(b.id))};})()`); }
async function keyPoint(pitch) { const r = await rect(`[data-key="${pitch}"]`); return { x: r.x + r.w / 2, y: r.y + r.h * .8 }; }
async function phrase(pitches, spacing = 250) {
  const points = []; for (const pitch of pitches) points.push(await keyPoint(pitch));
  const start = performance.now();
  for (let i = 0; i < points.length; i++) {
    await delay(Math.max(0, start + i * spacing - performance.now()));
    const p = points[i]; await mouse('mousePressed', p.x, p.y); await delay(85); await mouse('mouseReleased', p.x, p.y);
  }
  await delay(50);
}
async function select(name, value) { await b.evaluate(`(()=>{const e=document.querySelector(${q(label(name))});if(!e||![...e.options].some(o=>o.value===${q(value)}))throw Error('Missing select option');e.value=${q(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await delay(80); }
async function boundary(edge, time) {
  const h = await rect(`[data-boundary-handle="${edge}"]`), line = await rect(`[data-boundary="${edge}"]`);
  const target = await b.evaluate(`(()=>{const e=document.querySelector('[data-roll]'),r=e.getBoundingClientRect();return r.x+Number(BigInt(${q(String(time))})-BigInt(e.dataset.viewStart))/Number(BigInt(e.dataset.viewEnd)-BigInt(e.dataset.viewStart))*e.clientWidth;})()`);
  const x = h.x + h.w / 2, y = h.y + h.h / 2, to = x + target - line.x;
  await mouse('mousePressed', x, y); await mouse('mouseMoved', to, y); await delay(60); await mouse('mouseReleased', to, y); await delay(100);
}
async function screenshot(name) { const path = join(out, name + '.png'); await b.screenshot(path); report.screenshots.push(path); }
async function check(name, run) { await run(); report.checks.push({ name, passed: true }); console.log('PASS ' + name); }
const pitches = notes => notes.map(n => n.pitch);
let first, second, restored;
try {
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await b.navigate(url); await delay(350); report.scripts = await b.evaluate('Array.from(document.scripts,s=>s.src).filter(Boolean)');
  if (!await b.evaluate(`!!document.querySelector('[data-key="60"]')`)) await button('Show keyboard');
  await check('Capture preserves the first phrase and opens an empty next-layer live tape', async () => {
    await phrase([60, 62, 64, 65]); const live = await state(); assert.deepEqual(pitches(live.notes), [60, 62, 64, 65]);
    await button('Capture'); first = await state(); assert.equal(first.layers, 1); assert.deepEqual(first.notes, live.notes);
    await button('Next capture'); const next = await state(); assert.deepEqual(next.notes, []); assert.equal(next.layers, 1); report.first = first;
  });
  await check('empty repeated Capture cannot duplicate the previous layer', async () => {
    await button('Capture'); const empty = await state(); assert.equal(empty.layers, 1); assert.deepEqual(empty.notes, []);
  });
  await check('a rapid new phrase captures only its own notes and retains its session timestamps', async () => {
    await phrase([67, 69, 71, 72]); const live = await state(); assert.deepEqual(pitches(live.notes), [67, 69, 71, 72]);
    const gap = BigInt(live.notes[0].start) - BigInt(first.notes.at(-1).end); assert.ok(gap > 0n && gap < 1500000n, `fixture gap ${gap} must be shorter than the phrase-gap threshold`); report.phraseGapUs = String(gap);
    await button('Capture'); second = await state(); assert.equal(second.layers, 2); assert.deepEqual(second.notes, live.notes); assert.ok(BigInt(second.bounds.start) > BigInt(first.bounds.start), 'new loop must not retain the old phrase origin'); assert.ok(BigInt(second.bounds.start) >= BigInt(second.notes[0].start) - BigInt(Math.ceil(60000000 / second.bpm)), 'loop origin must be within one master beat of the new phrase'); report.second = second;
    await button('Next capture'); assert.deepEqual((await state()).notes, []); await screenshot('second-tape-empty-after-capture');
  });
  await check('earlier captured layers remain byte-identical after the next tape is captured', async () => {
    await layer(1); const unchanged = await state(); assert.deepEqual(unchanged.notes, first.notes); assert.deepEqual(unchanged.bounds, first.bounds); assert.equal(unchanged.bpm, first.bpm);
    await layer(2); assert.deepEqual((await state()).notes, second.notes);
  });
  await check('Undo capture restores its tape and merges newer input, including a note held across Undo', async () => {
    await phrase([77]); const newer = await state(); assert.deepEqual(pitches(newer.notes), [77], 'new playing must automatically reveal the fresh Live tape rather than the selected captured layer');
    const p = await keyPoint(79); await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: p.x, y: p.y, radiusX: 4, radiusY: 4, force: 1 }] }); await delay(70);
    assert.equal(await b.evaluate(`document.querySelector('[data-key="79"]').getAttribute('aria-pressed')`), 'true');
    await button('Undo capture'); const held = await state(); assert.equal(held.layers, 1); assert.deepEqual(pitches(held.notes), [67, 69, 71, 72, 77, 79]); assert.deepEqual(held.notes.slice(0, 4), second.notes); assert.deepEqual(held.notes[4], newer.notes[0]); assert.equal(await b.evaluate(`document.querySelector('[data-key="79"]').getAttribute('aria-pressed')`), 'true', 'Undo must not stop an independently held key');
    await delay(80); await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await b.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await delay(100);
    restored = await state(); assert.deepEqual(pitches(restored.notes), [67, 69, 71, 72, 77, 79]); assert.equal(restored.notes.at(-1).id, held.notes.at(-1).id); assert.equal(restored.notes.at(-1).start, held.notes.at(-1).start); assert.ok(BigInt(restored.notes.at(-1).end) > BigInt(held.notes.at(-1).end), 'release must close the same restored held note'); assert.equal(await b.evaluate(`document.querySelector('[data-key="79"]').getAttribute('aria-pressed')`), 'false'); report.restored = restored; await screenshot('undo-merged-tape');
  });
  await check('recapture saves the restored and newer notes exactly once, then starts another empty tape', async () => {
    await button('Capture'); const recaptured = await state(); assert.equal(recaptured.layers, 2); assert.deepEqual(recaptured.notes, restored.notes); assert.equal(new Set(recaptured.notes.map(n => n.id)).size, 6);
    await button('Next capture'); assert.deepEqual((await state()).notes, []); await layer(1); assert.deepEqual((await state()).notes, first.notes); assert.deepEqual((await state()).bounds, first.bounds);
  });
  await check('Full take recovers the first layer view beyond a narrowed loop without importing later tapes', async () => {
    await click('[data-editor-entry="dock"]'); await select('Snap division', 'off'); await boundary('start', BigInt(first.notes[2].start)); const narrowed = await state(); assert.deepEqual(narrowed.notes, first.notes); assert.ok(BigInt(narrowed.bounds.start) > BigInt(first.notes[0].start));
    await button('View settings'); await click('[data-editor-panel="view"] ' + label('Later \u2192')); await click('[data-editor-panel="view"] ' + label('Close settings')); const panned = await state(); assert.ok(BigInt(panned.view.start) > BigInt(first.notes[0].start), 'fixture must hide the earliest retained note');
    await button('View settings'); await button('Show full take'); const full = await state(); assert.deepEqual(full.notes, first.notes); assert.deepEqual(full.bounds, narrowed.bounds); assert.ok(BigInt(full.view.start) <= BigInt(first.notes[0].start)); assert.ok(BigInt(full.view.end) >= BigInt(first.notes.at(-1).end)); report.fullTake = full; await screenshot('first-layer-full-take-recovered');
  });
  await check('Bar snap can recover a retained prefix before its later grid phase by drag and ArrowLeft', async () => {
    await b.navigate(url); await delay(350); await phrase([60]); await delay(1800); await phrase([67, 69, 71, 72]); await button('Capture'); const captured = await state();
    assert.deepEqual(pitches(captured.notes), [60, 67, 69, 71, 72]); const floor = BigInt(captured.notes[0].start); assert.ok(BigInt(captured.bounds.start) > floor, 'fixture needs retained notes before the captured phrase/grid origin');
    await click('[data-editor-entry="dock"]'); await button('View settings'); await button('Show full take'); await select('Snap division', 'bar');
    const lines = await b.evaluate(`Array.from(document.querySelectorAll('[data-snap-grid]'),e=>({time:e.dataset.snapGrid,x:e.getBoundingClientRect().x})).filter(p=>{const r=document.querySelector('[data-roll]').getBoundingClientRect();return p.x>r.left+24&&p.x<r.right-24})`);
    const target = lines.find(p => BigInt(p.time) > BigInt(captured.notes.at(-1).end)); assert.ok(target, 'a visible later bar is needed to verify normal End snapping');
    await boundary('end', BigInt(target.time)); const before = await state(); assert.equal(before.bounds.end, target.time); assert.deepEqual(before.notes, captured.notes);
    await boundary('start', floor); const dragged = await state(); assert.equal(dragged.bounds.start, String(floor), 'left-edge drag must reach retained history even before the first grid line'); assert.equal(dragged.bounds.end, target.time); assert.deepEqual(dragged.notes, captured.notes);
    await button('Undo'); assert.deepEqual((await state()).bounds, before.bounds);
    await b.evaluate(`document.querySelector('[data-boundary-handle="start"]').focus()`);
    for (let i = 0; i < 12 && BigInt((await state()).bounds.start) > floor; i++) { await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 }); await delay(50); }
    const keyboard = await state(); assert.equal(keyboard.bounds.start, String(floor), 'ArrowLeft must reach the retained history floor'); assert.equal(keyboard.bounds.end, target.time); assert.deepEqual(keyboard.notes, captured.notes); report.prefixRecovery = { captured, snappedEnd: target.time, recovered: keyboard }; await screenshot('late-phase-prefix-bar-recovery');
  });
  await check('a narrow left-edge range stays grabbable after dragging outside the grid', async () => {
    await b.navigate(url); await delay(350); await button('Draw MIDI'); await select('Snap division','off'); await boundary('end',125000n);
    const before = await state(); assert.ok(BigInt(before.bounds.end)>0n && BigInt(before.bounds.end)<500000n, 'fixture is narrower than the two grip targets');
    const reachable = await b.evaluate(`['start','end'].map(edge=>{const e=document.querySelector('[data-boundary-handle="'+edge+'"]'),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-boundary-handle]')?.dataset.boundaryHandle})`);
    assert.deepEqual(reachable,['start','end']);
    const h = await rect('[data-boundary-handle="start"]'), plot = await rect('[data-roll]');
    await mouse('mousePressed',h.x+h.w/2,h.y+h.h/2); await mouse('mouseMoved',plot.x-40,h.y+h.h/2); await delay(100);
    assert.equal(await b.evaluate(`document.querySelector('[data-roll]').dataset.activeRange`),'start');
    await mouse('mouseReleased',plot.x-40,h.y+h.h/2); await delay(80);
    assert.equal((await state()).bounds.start,'0');
    await boundary('start',50000n); const moved = await state();
    assert.ok(BigInt(moved.bounds.start)>0n,'left handle can be re-grabbed and moved right'); assert.equal(moved.bounds.end,before.bounds.end);
    report.edgeRegrab=moved; await screenshot('left-edge-regrab');
  });
  await check('automatic Capture prefers four bars near an attack while retaining the full source tape', async () => {
    await b.navigate(url); await delay(350); await button('Draw MIDI'); await button('Back to Play'); await button('Next capture');
    await phrase(Array.from({length:24},(_,i)=>[60,64,67,72][i%4]),400); const raw=await state();
    await button('Capture'); const captured=await state();
    assert.equal(captured.notes.length,24); assert.deepEqual(captured.notes,raw.notes);
    assert.ok(BigInt(captured.bounds.start)>BigInt(raw.notes[0].start),'a leading excess is excluded from the suggested loop');
    const length=Number(BigInt(captured.bounds.end)-BigInt(captured.bounds.start));
    assert.ok(Math.abs(length-8000000)<300000,'the120BPM master gives a soft four-bar preference');
    report.barPreference=captured;
  });
  assert.deepEqual(b.exceptions, []); report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack || String(error); process.exitCode = 1; console.error(report.failure);
  try { report.visibleText = await b.evaluate('document.body.innerText'); report.failedState = await state(); await screenshot('failure'); } catch {}
} finally {
  report.exceptions = b.exceptions; report.finished = new Date().toISOString(); writeFileSync(join(out, 'layer-tape-proof-report.json'), JSON.stringify(report, null, 2)); await b.close();
}
