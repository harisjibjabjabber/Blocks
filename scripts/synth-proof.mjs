// UI sound routing and envelope regression in an isolated browser profile.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { browserSession, delay } from './browser-session.mjs';

const url = process.env.BLOCKS_PROOF_URL || 'http://127.0.0.1:41714/Blocks/';
const out = resolve(process.env.BLOCKS_SYNTH_PROOF_DIR || process.env.BLOCKS_PROOF_DIR || '../synth-evidence');
mkdirSync(out, { recursive: true });
const report = { url, started: new Date().toISOString(), kind: 'isolated Chrome synthetic input; UI state/routing assertions, no listening or physical-device claim', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), checks: [], screenshots: [] };
const b = await browserSession(), q = JSON.stringify;
const label = name => `[aria-label=${q(name)}]`, dial = name => `[data-envelope-dial=${q(name)}]`;
const EP = 'blocks.ep.fm.v1', PAD = 'blocks.pad.warm.v1';
const padEnvelope = { attackMs: 160, decayMs: 1000, sustain: .72, releaseMs: 700 };
async function rect(selector) { return b.evaluate(`(()=>{const e=document.querySelector(${q(selector)});if(!e)throw Error('Missing '+${q(selector)});(e.closest('[data-roll]')||e).scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})()`); }
async function mouse(type, x, y) { await b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }); }
async function click(selector) { const r = await rect(selector); await mouse('mousePressed', r.x + r.w / 2, r.y + r.h / 2); await mouse('mouseReleased', r.x + r.w / 2, r.y + r.h / 2); await delay(90); }
const button = name => click(label(name));
async function select(value) { await b.evaluate(`(()=>{const e=document.querySelector('[aria-label="Synth preset"]');if(!e||![...e.options].some(o=>o.value===${q(value)}))throw Error('Missing preset');e.value=${q(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await delay(90); }
async function sound() { return b.evaluate(`({preset:document.querySelector('[aria-label="Synth preset"]').value,envelope:Object.fromEntries([...document.querySelectorAll('[data-envelope-dial]')].map(e=>[e.dataset.envelopeDial,Number(e.getAttribute('aria-valuenow'))]))})`); }
async function state() { return b.evaluate(`(()=>{const r=document.querySelector('[data-roll]'),s=document.querySelector('[data-boundary="start"]'),e=document.querySelector('[data-boundary="end"]');return{bpm:r.dataset.gridBpm,bounds:s&&e?{start:s.dataset.boundaryTime,end:e.dataset.boundaryTime}:null,notes:[...r.querySelectorAll('[data-note]')].map(n=>({id:n.dataset.note,start:n.dataset.start,end:n.dataset.end,pitch:n.dataset.pitch,velocity:n.dataset.velocity})).sort((a,b)=>a.id.localeCompare(b.id))};})()`); }
async function layerCount() { return b.evaluate(`document.querySelectorAll('[aria-label^="Layer "][aria-label$=" actions"]').length`); }
async function key(name, code = name) { await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code }); await delay(70); }
async function focusDial(name) { await b.evaluate(`document.querySelector(${q(dial(name))}).focus()`); }
async function dragDial(name, delta, cancel = false) {
  const r = await rect(dial(name)), x = r.x + r.w / 2, y = r.y + r.h / 2;
  await mouse('mousePressed', x, y); await mouse('mouseMoved', x, y - delta); await delay(70); const preview = await sound();
  if (cancel) await key('Escape'); await mouse('mouseReleased', x, y - delta); await delay(90); return preview;
}
async function drawNote() { await button('Draw'); const r = await rect('[data-roll]'); const y = r.y + 48 + (r.h - 98) * .45; await mouse('mousePressed', r.x + r.w * .3, y); await mouse('mouseMoved', r.x + r.w * .4, y); await mouse('mouseReleased', r.x + r.w * .4, y); await delay(100); }
async function screenshot(name) { const path = join(out, name + '.png'); await b.screenshot(path); report.screenshots.push(path); }
async function check(name, run) { await run(); report.checks.push({ name, passed: true }); console.log('PASS ' + name); }
let chosenPad, firstNotes, firstEP, secondNotes, secondSound;
try {
  await b.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await b.navigate(url); await delay(350); report.scripts = await b.evaluate('Array.from(document.scripts,s=>s.src).filter(Boolean)');
  await check('Choose sound exposes both synths and Warm Pad applies its envelope defaults', async () => {
    await button('Choose sound'); const options = await b.evaluate(`Array.from(document.querySelector('[aria-label="Synth preset"]').options,o=>({value:o.value,label:o.textContent}))`); assert.deepEqual(options, [{ value: EP, label: 'Warm EP' }, { value: PAD, label: 'Warm Pad' }]);
    await select(PAD); assert.deepEqual(await sound(), { preset: PAD, envelope: padEnvelope }); await screenshot('warm-pad-defaults');
  });
  await check('envelope drag commits and Escape restores the exact pre-drag value', async () => {
    await dragDial('attackMs', 30); const committed = await sound(); assert.ok(committed.envelope.attackMs > padEnvelope.attackMs); const preview = await dragDial('attackMs', 25, true); assert.ok(preview.envelope.attackMs > committed.envelope.attackMs); assert.ok(await b.evaluate(`!!document.querySelector('[aria-label="Synth preset"]')`), 'Escape during a dial drag must keep the settings open'); assert.deepEqual(await sound(), committed);
  });
  await check('all four envelope dials support exact keyboard minimum and maximum', async () => {
    for (const name of ['attackMs', 'decayMs', 'sustain', 'releaseMs']) {
      await focusDial(name); const limits = await b.evaluate(`(()=>{const e=document.querySelector(${q(dial(name))});return{min:Number(e.getAttribute('aria-valuemin')),max:Number(e.getAttribute('aria-valuemax'))};})()`);
      await key('Home'); assert.equal((await sound()).envelope[name], limits.min); await key('End'); assert.equal((await sound()).envelope[name], limits.max);
    }
    await select(EP); await select(PAD); await dragDial('attackMs', 20); chosenPad = await sound(); assert.equal(chosenPad.preset, PAD); assert.ok(chosenPad.envelope.attackMs > 160);
  });
  await check('Preview sound never creates live notes or a captured layer', async () => {
    await button('Preview sound'); await delay(250); await button('Stop preview'); await button('Close sound settings'); assert.deepEqual((await state()).notes, []); await button('Capture'); assert.equal(await layerCount(), 0); assert.deepEqual((await state()).notes, []);
  });
  await check('Draw inherits the selected Pad and envelope; sound edits preserve notes and range', async () => {
    await button('Draw MIDI'); await button('Sound for selected layer'); assert.deepEqual(await sound(), chosenPad); await button('Close sound settings'); await drawNote(); firstNotes = await state(); assert.equal(firstNotes.notes.length, 1);
    await button('Play'); await delay(120); assert.ok(await b.evaluate(`!!document.querySelector('[data-playhead]')`)); await button('Sound for selected layer'); await select(EP); await dragDial('decayMs', -18); firstEP = await sound(); assert.equal(firstEP.preset, EP); assert.notEqual(firstEP.envelope.decayMs, 2200); await button('Close sound settings'); assert.deepEqual(await state(), firstNotes); await button('Stop');
    await button('Sound for selected layer'); assert.deepEqual(await sound(), firstEP); await screenshot('layer-one-ep-custom-envelope'); await button('Close sound settings');
  });
  await check('next-capture sound sets a second Draw without modifying the first layer sound', async () => {
    await button('Back to Play'); await button('Sound for next capture'); assert.deepEqual(await sound(), chosenPad, 'editing Layer 1 must not replace the next-capture sound'); await select(PAD); await button('Close sound settings'); await button('Next capture'); await button('Draw MIDI'); await button('Sound for selected layer'); assert.deepEqual(await sound(), { preset: PAD, envelope: padEnvelope }); await button('Close sound settings'); await drawNote(); secondNotes = await state(); assert.equal(secondNotes.notes.length, 1);
    await button('Back to Play'); assert.equal(await layerCount(), 2); await button('Sound for layer 1'); assert.deepEqual(await sound(), firstEP); await button('Close sound settings'); await button('Sound for layer 2'); assert.deepEqual(await sound(), { preset: PAD, envelope: padEnvelope }); await button('Close sound settings');
  });
  await check('selected-layer editor sound changes are isolated and survive layer switching', async () => {
    await button('Open editor layer 2'); await button('Sound for selected layer'); await dragDial('releaseMs', 22); secondSound = await sound(); assert.equal(secondSound.preset, PAD); assert.ok(secondSound.envelope.releaseMs > padEnvelope.releaseMs); await button('Close sound settings'); assert.deepEqual(await state(), secondNotes);
    await click('[aria-label^="Layer 1, "]'); assert.deepEqual(await state(), firstNotes); await button('Sound for selected layer'); assert.deepEqual(await sound(), firstEP); await button('Close sound settings');
    await click('[aria-label^="Layer 2, "]'); assert.deepEqual(await state(), secondNotes); await button('Sound for selected layer'); assert.deepEqual(await sound(), secondSound); await screenshot('layer-two-pad-custom-envelope'); await button('Close sound settings');
  });
  await check('layer previews and playback leave the fresh capture tape empty', async () => {
    await button('Play'); await delay(200); await button('Sound for selected layer'); await button('Preview sound'); await delay(200); await button('Close sound settings'); assert.deepEqual(await state(), secondNotes); await button('Stop'); await button('Back to Play'); await button('Sound for next capture'); assert.deepEqual(await sound(), { preset: PAD, envelope: padEnvelope }, 'Layer 2 envelope edits must not alter the next-capture sound'); await button('Close sound settings'); await button('Next capture'); assert.deepEqual((await state()).notes, []); await button('Capture'); assert.equal(await layerCount(), 2); assert.deepEqual((await state()).notes, []); await screenshot('preview-keeps-next-tape-empty');
  });
  assert.deepEqual(b.exceptions, []); report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack || String(error); process.exitCode = 1; console.error(report.failure);
  try { report.visibleText = await b.evaluate('document.body.innerText'); report.failedState = await state(); await screenshot('failure'); } catch {}
} finally {
  report.exceptions = b.exceptions; report.finished = new Date().toISOString(); writeFileSync(join(out, 'synth-proof-report.json'), JSON.stringify(report, null, 2)); await b.close();
}
