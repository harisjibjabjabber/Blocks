// Independent fixed-bar integration proof. Synthetic input in an isolated browser.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { browserSession, delay } from './browser-session.mjs';

const url = process.env.BLOCKS_PROOF_URL || 'http://127.0.0.1:41714/Blocks/';
const out = resolve(process.env.BLOCKS_LOOP_PROOF_DIR || process.env.BLOCKS_PROOF_DIR || '../loop-assist-evidence');
mkdirSync(out, { recursive: true });
const report = { url, started: new Date().toISOString(), kind: 'isolated Chrome synthetic pointer/control integration; no physical-device or listening claim', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), checks: [], screenshots: [] };
const b = await browserSession();
const q = JSON.stringify;
const label = name => `[aria-label=${q(name)}]`;
async function rect(selector) {
  return b.evaluate(`(()=>{const e=document.querySelector(${q(selector)});if(!e)throw Error('Missing '+${q(selector)});(e.closest('[data-roll],[data-keyboard]')||e).scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);
}
async function mouse(type, x, y) { await b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }); }
async function click(selector) { const r = await rect(selector); await mouse('mousePressed', r.x + r.w / 2, r.y + r.h / 2); await mouse('mouseReleased', r.x + r.w / 2, r.y + r.h / 2); await delay(100); }
const button = name => click(label(name));
const panelButton = name => click(`[data-editor-panel="loop"] ${label(name)}`);
async function select(name, value) {
  await b.evaluate(`(()=>{const e=document.querySelector(${q(label(name))});if(!e||![...e.options].some(o=>o.value===${q(value)}))throw Error('Missing select value');e.value=${q(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await delay(90);
}
async function state() {
  return b.evaluate(`(()=>{const r=document.querySelector('[data-roll]');return {bpm:Number(r.dataset.gridBpm),bounds:{start:document.querySelector('[data-boundary="start"]').dataset.boundaryTime,end:document.querySelector('[data-boundary="end"]').dataset.boundaryTime},notes:[...document.querySelectorAll('[data-note]')].map(e=>({id:e.dataset.note,start:e.dataset.start,end:e.dataset.end,pitch:e.dataset.pitch,velocity:e.dataset.velocity})).sort((a,b)=>a.id.localeCompare(b.id))};})()`);
}
async function view() { return b.evaluate(`({start:document.querySelector('[data-roll]').dataset.viewStart,end:document.querySelector('[data-roll]').dataset.viewEnd})`); }
async function timeX(time) {
  return b.evaluate(`(()=>{const e=document.querySelector('[data-roll]'),r=e.getBoundingClientRect();return r.x+Number(BigInt(${q(String(time))})-BigInt(e.dataset.viewStart))/Number(BigInt(e.dataset.viewEnd)-BigInt(e.dataset.viewStart))*e.clientWidth;})()`);
}
async function drag(x, y, nextX, nextY) { await mouse('mousePressed', x, y); await mouse('mouseMoved', nextX, nextY); await delay(70); await mouse('mouseReleased', nextX, nextY); await delay(120); }
async function boundary(edge, time) {
  const h = await rect(`[data-boundary-handle="${edge}"]`), line = await rect(`[data-boundary="${edge}"]`), target = await timeX(time);
  await drag(h.x + h.w / 2, h.y + h.h / 2, h.x + h.w / 2 + target - line.x, h.y + h.h / 2);
}
async function draw(pitch, start, end) {
  await button('Draw'); const row = await rect(`[data-pitch-row="${pitch}"]`); await drag(await timeX(start), row.y + row.h / 2, await timeX(end), row.y + row.h / 2);
}
async function screenshot(name) { const path = join(out, name + '.png'); await b.screenshot(path); report.screenshots.push(path); }
async function check(name, run) { await run(); report.checks.push({ name, passed: true }); console.log('PASS ' + name); }
const near = (actual, expected) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
let original, dragged, cut, master, anchor;

try {
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await b.navigate(url); await delay(400); report.scripts = await b.evaluate('Array.from(document.scripts,s=>s.src).filter(Boolean)');
  await button('Draw MIDI');
  await check('first Draw opens an empty four-bar loop at 120 BPM', async () => {
    original = await state(); assert.equal(original.bpm, 120); assert.deepEqual(original.bounds, { start: '0', end: '8000000' }); assert.deepEqual(original.notes, []);
    await click('[data-loop-settings]'); assert.equal(await b.evaluate(`document.querySelector('[aria-label="Use 4 bars"]').getAttribute('aria-pressed')`), 'true'); await panelButton('Close settings');
  });
  await check('drawing and adjusting loop bounds preserve the original note data', async () => {
    await select('Snap division', '1/16'); await button('Fit editor loop'); await draw(64, 1000000n, 1500000n); await draw(67, 6500000n, 7000000n); original = await state(); assert.equal(original.notes.length, 2);
    await boundary('end', 4250000n); dragged = await state(); assert.deepEqual(dragged.bounds, { start: '0', end: '4250000' }); assert.equal(dragged.bpm, 120); assert.deepEqual(dragged.notes, original.notes); await screenshot('selected-range-before-cut');
  });
  await check('Cut as four bars derives exact tempo from the selected duration', async () => {
    await click('[data-loop-settings]'); await button('Use 4 bars'); assert.deepEqual(await state(), dragged); await panelButton('Cut range'); cut = await state(); master = 960000000 / Number(BigInt(dragged.bounds.end) - BigInt(dragged.bounds.start));
    near(cut.bpm, master); assert.deepEqual(cut.bounds, dragged.bounds); assert.deepEqual(cut.notes, original.notes.filter(n => BigInt(n.start) < BigInt(cut.bounds.end))); assert.equal(cut.notes.length, 1); report.inferredTempo = { duration: String(BigInt(cut.bounds.end) - BigInt(cut.bounds.start)), expected: master, actual: cut.bpm }; await screenshot('cut-four-bars-tempo');
  });
  await check('Undo and Redo restore tempo, range and notes in the correct order', async () => {
    await button('Undo'); assert.deepEqual(await state(), dragged); await button('Undo'); assert.deepEqual(await state(), original); await button('Redo'); assert.deepEqual(await state(), dragged); await button('Redo'); assert.deepEqual(await state(), cut);
  });
  await check('Reset four and eight bars keeps its start, tempo and note timing', async () => {
    await select('Snap division', 'off'); await boundary('start', 500000n); const before = await state(); anchor = BigInt(before.bounds.start); assert.ok(anchor > 0n); assert.deepEqual(before.notes, cut.notes); near(before.bpm, master);
    for (const bars of [4, 8]) {
      await click('[data-loop-settings]'); await button(`Use ${bars} bars`); assert.deepEqual(await state(), bars === 4 ? before : report.resetFour); await panelButton('Reset loop');
      const after = await state(), duration = BigInt(Math.round(60000000 * 4 * bars / master)); assert.deepEqual(after.bounds, { start: String(anchor), end: String(anchor + duration) }); near(after.bpm, master); assert.deepEqual(after.notes, cut.notes); if (bars === 4) report.resetFour = after; else report.resetEight = after;
    }
  });
  await check('Free preserves the selected range and tempo without resetting notes', async () => {
    const before = await state(); await click('[data-loop-settings]'); await button('Use free range'); assert.deepEqual(await state(), before); assert.equal(await b.evaluate(`document.querySelector('[data-editor-panel="loop"] [aria-label="Reset loop"]').getAttribute('aria-disabled')`), 'true'); await panelButton('Cut range'); assert.deepEqual(await state(), before); await screenshot('free-range-preserved');
  });
  await check('a new blank layer follows the derived master tempo', async () => {
    await button('Back to Play'); await button('Next capture'); await button('Draw MIDI'); const next = await state(); near(next.bpm, master); assert.deepEqual(next.notes, []); assert.deepEqual(next.bounds, { start: '0', end: String(Math.round(960000000 / master)) }); assert.equal(await b.evaluate(`document.querySelectorAll('[aria-label^="Layer "][aria-label*="Warm EP"]').length`), 2); report.newLayer = next; await screenshot('second-layer-master-tempo');
  });
  await check('left-edge touch hold reveals history; commit is atomic and cancellation restores the view', async () => {
    await select('Snap division', '1/4'); const step = BigInt(Math.round(60000000 / master)); await boundary('start', step * 8n);
    await button('View settings'); await click(`[data-editor-panel="view"] ${label('Zoom in time')}`); await click(`[data-editor-panel="view"] ${label('← Earlier')}`); await click(`[data-editor-panel="view"] ${label('Close settings')}`);
    const before = await state(), beforeView = await view(); assert.ok(BigInt(beforeView.start) > 0n, 'older history must exist to the left');
    const point = (id, x, y) => ({ id, x, y, radiusX: 4, radiusY: 4, force: 1 });
    async function holdLeft() {
      const h = await rect('[data-boundary-handle="start"]'), roll = await rect('[data-roll]'), y = h.y + h.h / 2, x = roll.x + 3;
      await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
      await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, h.x + h.w / 2, y)] });
      await b.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, x, y)] }); await delay(550);
      return { x, y };
    }
    async function release() { await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await b.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await delay(90); }
    await holdLeft(); const preview = await state(), panned = await view(); report.leftTouchAttempt = { before, beforeView, preview, panned }; assert.ok(BigInt(panned.start) < BigInt(beforeView.start)); assert.ok(BigInt(preview.bounds.start) < BigInt(before.bounds.start)); assert.equal(BigInt(preview.bounds.start) % step, 0n); await release(); const committed = await state(), committedView = await view(); assert.ok(BigInt(committed.bounds.start) < BigInt(before.bounds.start)); assert.equal(BigInt(committed.bounds.start) % step, 0n); assert.equal(committed.bounds.end, before.bounds.end); assert.deepEqual(committed.notes, before.notes); near(committed.bpm, before.bpm); await delay(100); assert.deepEqual(await view(), committedView);
    await button('Undo'); assert.deepEqual(await state(), before);
    const cancelView = await view(); await holdLeft(); assert.ok(BigInt((await view()).start) < BigInt(cancelView.start));
    await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }); await delay(80); assert.deepEqual(await state(), before); assert.deepEqual(await view(), cancelView); await release();
    const active = await holdLeft(); assert.ok(BigInt((await view()).start) < BigInt(cancelView.start)); await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, active.x, active.y), point(2, active.x + 130, active.y - 60)] }); await delay(90); assert.deepEqual(await state(), before); assert.deepEqual(await view(), cancelView); await release();
    assert.notEqual(await b.evaluate(`document.querySelector('[aria-label="Redo"]').getAttribute('aria-disabled')`), 'true'); await button('Redo'); assert.deepEqual(await state(), committed); await button('Undo'); assert.deepEqual(await state(), before); report.leftTouch = { beforeView, panned, committedRange: committed.bounds, cancelledView: cancelView }; await screenshot('left-touch-cancel-restored');
  });
  assert.deepEqual(b.exceptions, []); report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack || String(error); process.exitCode = 1; console.error(report.failure);
  try { report.visibleText = await b.evaluate('document.body.innerText'); report.failedState = await state(); await screenshot('failure'); } catch {}
} finally {
  report.exceptions = b.exceptions; report.finished = new Date().toISOString(); writeFileSync(join(out, 'loop-assist-proof-report.json'), JSON.stringify(report, null, 2)); await b.close();
}
