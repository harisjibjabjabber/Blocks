// Timed performance through the actual UI in an isolated Chrome profile.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { browserSession, delay } from './browser-session.mjs';

const url = process.env.BLOCKS_PROOF_URL || 'http://127.0.0.1:41714/Blocks/';
const out = resolve(process.env.BLOCKS_CAPTURE_PROOF_DIR || process.env.BLOCKS_PROOF_DIR || '../capture-tempo-evidence');
mkdirSync(out, { recursive: true });
const report = { url, started: new Date().toISOString(), kind: 'isolated Chrome; timed synthetic mouse performance on actual keyboard UI; no physical-device or listening claim', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), checks: [], performances: [], screenshots: [] };
const b = await browserSession(), q = JSON.stringify;
const label = name => `[aria-label=${q(name)}]`;
async function rect(selector) {
  return b.evaluate(`(()=>{const e=document.querySelector(${q(selector)});if(!e)throw Error('Missing '+${q(selector)});(e.closest('[data-roll],[data-touch-keyboard]')||e).scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})()`);
}
async function mouse(type, x, y) { await b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }); }
async function click(selector) { const r = await rect(selector); await mouse('mousePressed', r.x + r.w / 2, r.y + r.h / 2); await mouse('mouseReleased', r.x + r.w / 2, r.y + r.h / 2); await delay(100); }
const button = name => click(label(name));
async function select(name, value) { await b.evaluate(`(()=>{const e=document.querySelector(${q(label(name))});if(!e||![...e.options].some(o=>o.value===${q(value)}))throw Error('Missing select option');e.value=${q(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await delay(100); }
async function state() {
  return b.evaluate(`(()=>{const r=document.querySelector('[data-roll]'),p=document.querySelector('[data-capture-bpm]'),s=document.querySelector('[data-boundary="start"]'),e=document.querySelector('[data-boundary="end"]');return{bpm:Number(r.dataset.gridBpm),prediction:p?.getAttribute('data-capture-bpm')??null,bounds:s&&e?{start:s.dataset.boundaryTime,end:e.dataset.boundaryTime}:null,notes:[...r.querySelectorAll('[data-note]')].map(n=>({id:n.dataset.note,start:n.dataset.start,end:n.dataset.end,pitch:n.dataset.pitch,velocity:n.dataset.velocity})).sort((a,b)=>a.id.localeCompare(b.id))};})()`);
}
async function visibleTempo(name = 'Capture grid settings') { return b.evaluate(`Number(document.querySelector(${q(label(name))}).innerText.match(/[0-9]+(?:[.][0-9]+)?/)[0])`); }
async function perform(spacing) {
  if (!await b.evaluate('!!document.querySelector("[data-key=\\"60\\"]")')) await button('Show keyboard');
  const pitches = [60, 64, 67, 72, 67, 64, 62, 60], points = [];
  for (const pitch of pitches) {
    const r = await rect(`[data-key="${pitch}"]`);
    // Lower white-key surface remains unobstructed by the black keys.
    points.push({ pitch, x: r.x + r.w / 2, y: r.y + r.h * .8 });
  }
  const started = performance.now(), onsets = [];
  for (let i = 0; i < points.length; i++) {
    await delay(Math.max(0, started + i * spacing - performance.now()));
    const p = points[i]; onsets.push(performance.now() - started);
    await mouse('mousePressed', p.x, p.y); await delay(140); await mouse('mouseReleased', p.x, p.y);
  }
  await delay(180); report.performances.push({ spacing, pitches, onsets });
}
async function screenshot(name) { const path = join(out, name + '.png'); await b.screenshot(path); report.screenshots.push(path); }
async function check(name, run) { await run(); report.checks.push({ name, passed: true }); console.log('PASS ' + name); }
function near(actual, expected) { assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
async function assertVisible(expected, name) { near(await visibleTempo(name), Number(expected.toFixed(2))); }
async function enterEditor() { const hasDock = await b.evaluate('!!document.querySelector("[data-editor-entry=\\"dock\\"]")'); await click(hasDock ? '[data-editor-entry="dock"]' : label('Edit MIDI')); }
async function moveEnd(fraction) {
  const before = await state(), target = BigInt(before.bounds.start) + BigInt(Math.round(Number(BigInt(before.bounds.end) - BigInt(before.bounds.start)) * fraction));
  const h = await rect('[data-boundary-handle="end"]'), line = await rect('[data-boundary="end"]');
  const x = await b.evaluate(`(()=>{const e=document.querySelector('[data-roll]'),r=e.getBoundingClientRect();return r.x+Number(BigInt(${q(String(target))})-BigInt(e.dataset.viewStart))/Number(BigInt(e.dataset.viewEnd)-BigInt(e.dataset.viewStart))*e.clientWidth;})()`);
  const fromX = h.x + h.w / 2, y = h.y + h.h / 2, toX = fromX + x - line.x;
  await mouse('mousePressed', fromX, y); await mouse('mouseMoved', toX, y); await delay(80); await mouse('mouseReleased', toX, y); await delay(120);
}

let prior, first, recaptured, edited;
try {
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await b.navigate(url); await delay(400); report.scripts = await b.evaluate('Array.from(document.scripts,s=>s.src).filter(Boolean)');
  await check('a pre-existing user tempo is visible before the first performance', async () => {
    await button('Decrease BPM'); prior = (await state()).bpm; assert.equal(prior, 119); await assertVisible(prior);
  });
  await check('first Capture adopts the actual performance prediction in the visible grid', async () => {
    await perform(600); const live = await state(); assert.equal(live.notes.length, 8, 'all eight physical UI key gestures must reach the live history'); report.liveNotes = live.notes;
    await button('Capture'); first = await state(); const prediction = Number(first.prediction);
    assert.ok(first.prediction && prediction > 0 && Number.isFinite(prediction), 'the captured performance must expose a real positive pulse prediction'); assert.ok(Math.abs(prediction - prior) > 1, 'fixture must distinguish prediction from prior settings'); near(first.bpm, prediction); await assertVisible(prediction); assert.deepEqual(first.notes, live.notes); report.firstCapture = first; await screenshot('first-capture-predicted-tempo');
  });
  await check('Undo capture restores the prior visible tempo and retains the raw performance', async () => {
    await button('Undo capture'); const undone = await state(); near(undone.bpm, prior); await assertVisible(prior); assert.deepEqual(undone.notes, report.liveNotes); assert.equal(await b.evaluate('document.querySelectorAll("[aria-label^=\\"Layer \\"][aria-label*=\\"Warm EP\\"]").length'), 0); await screenshot('undo-capture-prior-tempo');
  });
  await check('recapturing the same performance adopts its prediction again', async () => {
    await button('Capture'); recaptured = await state(); assert.ok(Number(recaptured.prediction) > 0); near(recaptured.bpm, Number(recaptured.prediction)); near(recaptured.bpm, first.bpm); await assertVisible(recaptured.bpm); assert.deepEqual(recaptured.notes, first.notes);
  });
  await check('first-layer Cut derives four-bar tempo; Undo restores capture tempo and notes', async () => {
    await enterEditor(); const entered = await state(); near(entered.bpm, recaptured.bpm); assert.deepEqual(entered.notes, recaptured.notes);
    await select('Snap division', 'off'); await moveEnd(.65); edited = await state(); assert.ok(BigInt(edited.bounds.end) < BigInt(entered.bounds.end), 'range drag must shorten the loop'); assert.deepEqual(edited.notes, entered.notes); near(edited.bpm, entered.bpm);
    await click('[data-loop-settings="true"]'); await button('Use 4 bars'); await click('[data-editor-panel="loop"] ' + label('Cut range'));
    const cut = await state(), expected = 960000000 / Number(BigInt(edited.bounds.end) - BigInt(edited.bounds.start)); near(cut.bpm, expected); await assertVisible(expected, 'Grid settings'); assert.deepEqual(cut.bounds, edited.bounds); assert.ok(cut.notes.length < edited.notes.length, 'fixture must trim at least one note'); report.cut = { expected, state: cut }; await screenshot('cut-recalculated-tempo');
    await button('Undo'); const restored = await state(); near(restored.bpm, recaptured.bpm); assert.deepEqual(restored.bounds, edited.bounds); assert.deepEqual(restored.notes, edited.notes); await assertVisible(recaptured.bpm, 'Grid settings');
  });
  await check('a later capture keeps the established master tempo despite a new prediction', async () => {
    await button('Back to Play'); await button('Next capture'); await delay(2400); await perform(430); await button('Capture');
    const second = await state(); assert.ok(Number(second.prediction) > 0, 'second phrase must still have a pulse prediction'); assert.ok(Math.abs(Number(second.prediction) - recaptured.bpm) > 1, 'second cadence must exercise a different proposed tempo'); near(second.bpm, recaptured.bpm); await assertVisible(recaptured.bpm); assert.equal(await b.evaluate('document.querySelectorAll("[aria-label^=\\"Layer \\"][aria-label*=\\"Warm EP\\"]").length'), 2); report.secondCapture = second; await screenshot('second-capture-master-preserved');
  });
  assert.deepEqual(b.exceptions, []); report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack || String(error); process.exitCode = 1; console.error(report.failure);
  try { report.visibleText = await b.evaluate('document.body.innerText'); report.failedState = await state(); await screenshot('failure'); } catch {}
} finally {
  report.exceptions = b.exceptions; report.finished = new Date().toISOString(); writeFileSync(join(out, 'capture-tempo-proof-report.json'), JSON.stringify(report, null, 2)); await b.close();
}
