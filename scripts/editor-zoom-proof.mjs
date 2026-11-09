import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {browserSession,delay} from './browser-session.mjs';
const out=resolve(process.env.BLOCKS_PROOF_DIR || "../zoom-edit-evidence");mkdirSync(out,{recursive:true});
const b=await browserSession();
try {
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 await b.navigate(process.env.BLOCKS_PROOF_URL || 'http://127.0.0.1:41713/'); await delay(250);
 assert.equal(await b.evaluate(`document.querySelector('[aria-label="Capture snap division"]').value`),'1/4');
 await b.evaluate(`document.querySelector('[aria-label="Draw MIDI"]').click()`);await delay(250);
 const before=await b.evaluate(`(()=>{const r=document.querySelector('[data-roll]');return +r.dataset.viewEnd-+r.dataset.viewStart})()`);
 await b.evaluate(`(()=>{let e=document.querySelector('[aria-label="Snap division"]');e.value='1/64t';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(200);
 const after=await b.evaluate(`(()=>{const r=document.querySelector('[data-roll]');return {span:+r.dataset.viewEnd-+r.dataset.viewStart,lines:document.querySelectorAll('[data-snap-line]').length}})()`);
 assert.ok(after.span<before,JSON.stringify({before,after}));
 const row=await b.evaluate(`document.querySelector('[data-keyboard="room"]').dataset.rowHeight`);
 await b.evaluate(`(()=>{const e=document.querySelector('[aria-label="Keys zoom"]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,'80');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(150);
 assert.notEqual(await b.evaluate(`document.querySelector('[data-keyboard="room"]').dataset.rowHeight`),row);
 for(const width of [320,390,1440]) {
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:width===1440?900:844,deviceScaleFactor:1,mobile:false});await delay(200);
  assert.ok(await b.evaluate(`document.documentElement.scrollWidth <= innerWidth+1`));
  for(const name of ['Time zoom','Keys zoom']) assert.ok(await b.evaluate(`(()=>{const r=document.querySelector('[aria-label="${name}"]').getBoundingClientRect();return r.width>=48&&r.left>=0&&r.right<=innerWidth})()`),name+' '+width);
  await b.screenshot(resolve(out,'zoom-'+width+'.png'));
 }
 await b.evaluate(`document.querySelector('[aria-label="Back to Play"]').click()`);await delay(150);
 await b.evaluate(`document.querySelector('[aria-label="Layer 1 actions"]').click()`);await delay(150);
 assert.ok(await b.evaluate(`!!document.querySelector('[aria-label="Layer 1 volume"]')`));
 await b.evaluate(`document.querySelector('[aria-label="Cut range"]').click()`);await delay(150);
 const clipped=await b.evaluate(`(()=>{const r=document.querySelector('[data-roll]');return {start:r.dataset.viewStart,end:r.dataset.viewEnd,zoomOut:document.querySelector('[aria-label="Zoom out time"]').getAttribute('aria-disabled'),slider:!!document.querySelector('[aria-label="Timeline zoom"]')}})()`);
 assert.equal(clipped.zoomOut,'true');assert.equal(clipped.slider,false);
 await b.evaluate(`document.querySelector('[aria-label="Fit clip"]').click()`);await delay(100);
 assert.deepEqual(await b.evaluate(`(()=>{const r=document.querySelector('[data-roll]');return {start:r.dataset.viewStart,end:r.dataset.viewEnd}})()`),{start:clipped.start,end:clipped.end});
 assert.equal(b.exceptions.length,0);
 console.log('PASS quarter default, fine triplet autozoom, pitch slider, 320/390/1440 controls and layer volume');
} finally {await b.close();}
