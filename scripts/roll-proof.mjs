// Synthetic mouse/browser regression evidence, not a real touch/device or listening test.
// Run against a local Vite server; Chrome uses an isolated temporary profile.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { browserSession, delay } from './browser-session.mjs';

const out = resolve(process.env.BLOCKS_PROOF_DIR || '../qa-evidence');
mkdirSync(out, { recursive: true });
const url = process.env.BLOCKS_PROOF_URL || 'http://127.0.0.1:41713/';
const report = { kind: 'synthetic Chrome mouse, emulated touch, DOM cancellation and control events; no physical-device or listening claim', url, started: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), dirty: execFileSync('git', ['status','--porcelain'], {encoding:'utf8'}).trim(), checks: [], screenshots: [] };
const b = await browserSession();
let target;
const q = JSON.stringify;
async function check(name, fn) { await fn(); report.checks.push({name, passed:true}); console.log('PASS ' + name); }
async function size(width, height) { await b.send('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:false}); await delay(180); }
async function rect(selector, index=0, scroll=true) {
  return b.evaluate(`(() => { const e=[...document.querySelectorAll(${q(selector)})][${index}]; if(!e) throw new Error('Missing '+${q(selector)}); ${scroll ? "(e.closest('[data-roll], [data-keyboard], [data-velocity-lane]') || e).scrollIntoView({block:'center',inline:'nearest'});" : ''} const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
}
async function mouse(type,x,y) { await b.send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1}); }
async function click(selector,index=0) {const r=await rect(selector,index); await mouse('mousePressed',r.x+r.w/2,r.y+r.h/2); await mouse('mouseReleased',r.x+r.w/2,r.y+r.h/2); await delay(100);}
const label = text => `[aria-label=${q(text)}]`;
const button = (text,index=0) => click(label(text),index);
const panelButton = (panel,text) => click(`[data-editor-panel="${panel}"] ${label(text)}`);
async function quantiseSettings() {await button('Selection actions');await panelButton('selection','Quantise settings');}
async function input(text,value) { await click(label(text)); await key('a','KeyA',2); await b.send('Input.insertText',{text:value}); await delay(80); }
// Native select changes are synthetic DOM control events; note editing below uses CDP pointer input.
async function select(text,value) { await b.evaluate(`(()=>{const e=document.querySelector(${q(label(text))});if(!e||![...e.options].some(o=>o.value===${q(value)}))throw Error('Missing select option');e.value=${q(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(100); }
async function key(key,code=key,modifiers=0) { await b.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers,windowsVirtualKeyCode:key.length===1?key.toUpperCase().charCodeAt(0):({Delete:46,Escape:27,ArrowLeft:37,ArrowRight:39,Tab:9}[key]??0)}); await b.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers:0}); await delay(80); }
async function doubleClick(x,y) {for(const clickCount of [1,2]) {await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount});await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount});await delay(50);}await delay(100);}
async function selectNotes(ids) {await button('Select');const roll=await rect('[data-roll]');const bottom=await b.evaluate(`Number(document.querySelector('[data-roll]').dataset.rulerHeight)+Number(document.querySelector('[data-roll]').dataset.gridHeight)`);await mouse('mousePressed',roll.x+roll.w-8,roll.y+bottom-8);await mouse('mouseReleased',roll.x+roll.w-8,roll.y+bottom-8);await delay(80);for(let i=0;i<ids.length;i++){const r=await noteBox(ids[i]);const x=r.x+Math.min(4,r.w/4),y=r.y+r.h/2;for(const type of ['mousePressed','mouseReleased'])await b.send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1,modifiers:i?8:0});await delay(100);}}
async function gesture(x,y,toX,toY,finish=true) { await mouse('mousePressed',x,y); await mouse('mouseMoved',toX,toY); await delay(60); if(finish) { await mouse('mouseReleased',toX,toY); await delay(100); } }
async function notes() { return b.evaluate(`Array.from(document.querySelectorAll('[data-note]'),e=>({id:e.dataset.note,start:e.dataset.start,end:e.dataset.end,velocity:e.dataset.velocity,pitch:e.dataset.pitch})).sort((a,b)=>a.id.localeCompare(b.id))`); }
async function bounds() {return b.evaluate(`({start:document.querySelector('[data-boundary="start"]')?.dataset.boundaryTime,end:document.querySelector('[data-boundary="end"]')?.dataset.boundaryTime})`);}
async function bpm(center='Grid settings') {return b.evaluate(`Number(document.querySelector(${q(label(center))})?.textContent.match(/[0-9]+(?:[.][0-9]+)?/)?.[0])`);}
async function markerVisibility() {return b.evaluate(`Array.from(document.querySelectorAll('[data-boundary-handle]'),e=>{const r=e.getBoundingClientRect(),plot=e.closest('[data-roll]'),p=plot.getBoundingClientRect(),line=document.querySelector('[data-boundary="'+e.dataset.boundaryHandle+'"]').getBoundingClientRect(),x=Math.max(p.left+1,Math.min(p.right-1,line.x+line.width/2)),hit=document.elementFromPoint(x,r.y+r.height/2);return {edge:e.dataset.boundaryHandle,top:r.top,bottom:r.bottom,height:r.height,visible:r.top>=0&&r.bottom<=innerHeight&&hit?.closest('[data-roll]')===plot};})`);}
async function noteBox(id) { return rect(`[data-note=${q(id)}]`); }
async function screenshot(name) {const file=join(out,name+'.png');await b.screenshot(file);report.screenshots.push(file);}
async function disabled(name) {return b.evaluate(`document.querySelector(${q(label(name))})?.getAttribute('aria-disabled')==='true'`);}
async function playInput(pitch,hold=180) {const r=await rect(`[data-key="${pitch}"]`);await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x+r.w/2,y:r.y+r.h/2,buttons:0});await mouse('mousePressed',r.x+r.w/2,r.y+r.h/2);await delay(hold);await mouse('mouseReleased',r.x+r.w/2,r.y+r.h/2);await delay(200);}
async function editMidi() {
  const r=await b.evaluate(`(()=>{const entries=[...document.querySelectorAll('[aria-label="Edit MIDI"]')];const e=entries.find(e=>e.dataset.editorEntry==='dock')??entries.at(-1);if(!e)throw Error('Missing visible Edit MIDI entry');const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(!e.textContent.includes('Edit MIDI')||r.top<0||r.bottom>innerHeight||hit?.closest('[aria-label="Edit MIDI"]')!==e)throw Error('Dock Edit MIDI must be visible and unobstructed without scrolling');return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await mouse('mousePressed',r.x,r.y);await mouse('mouseReleased',r.x,r.y);await delay(100);assert.ok(await b.evaluate(`!!document.querySelector('[data-editor="storyboard-18"]')`),'Edit MIDI opens the large editor');
}
async function theme(name) {await button('Back to Play');await button('Settings');await button(name);await button('Settings');await editMidi();}
async function layout(name) {
  const result=await b.evaluate(`(() => {const root=document.documentElement; const capture=document.querySelector('[aria-label="Capture"]').getBoundingClientRect(); const back=document.querySelector('[aria-label="Back to Play"]').getBoundingClientRect(); const roll=document.querySelector('[data-roll]').getBoundingClientRect(); return {width:innerWidth,height:innerHeight,scrollWidth:root.scrollWidth,scrollHeight:root.scrollHeight,capture:{top:capture.top,bottom:capture.bottom},back:{top:back.top,bottom:back.bottom},roll:{top:roll.top,bottom:roll.bottom,width:roll.width}};})()`);
  assert.ok(result.scrollWidth<=result.width+1,JSON.stringify(result));
  assert.ok(result.scrollHeight<=result.height+1,JSON.stringify(result));
  assert.ok(result.back.top>=0&&result.back.bottom<150,JSON.stringify(result));
  assert.ok(result.capture.top>=0&&result.capture.bottom<=result.height,JSON.stringify(result));
  assert.ok(result.roll.width>180,JSON.stringify(result));
  await b.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:result.width/2,y:result.height/2,deltaX:0,deltaY:500});await delay(100);
  const pinned=await b.evaluate(`(()=>{const c=document.querySelector('[aria-label="Capture"]').getBoundingClientRect();const h=document.querySelector('[aria-label="Back to Play"]').getBoundingClientRect();return {header:h.top,dock:c.top};})()`);
  assert.ok(Math.abs(pinned.header-result.back.top)<1&&Math.abs(pinned.dock-result.capture.top)<1,'header and dock must stay pinned while content scrolls');
  report.checks.push({name,passed:true,geometry:result});await screenshot(name);
}
try {
  await size(1440,900);await b.navigate(url);await delay(300);await b.evaluate(`window.__proofEvents=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture','keydown'])window.addEventListener(type,e=>window.__proofEvents.push({type,id:e.pointerId,key:e.key,ctrl:e.ctrlKey,x:e.clientX,y:e.clientY,target:e.target.dataset?.roll??e.target.getAttribute?.('aria-label')}),true);`);
  report.scripts=await b.evaluate(`Array.from(document.scripts,s=>s.src).filter(Boolean)`);
  await check('Draw MIDI opens an empty editor and plays drawn notes without capturing fake input',async()=>{
    await button('Draw MIDI');assert.equal((await notes()).length,0);const plot=await rect('[data-roll]');await gesture(plot.x+plot.w*.3,plot.y+plot.h*.45,plot.x+plot.w*.4,plot.y+plot.h*.45);assert.equal((await notes()).length,1);await button('Play');await delay(150);assert.ok(await b.evaluate(`!!document.querySelector('[data-playhead]')`));await button('Stop');await button('Undo');assert.equal((await notes()).length,0);await button('Redo');assert.equal((await notes()).length,1);await button('Back to Play');await button('Capture');assert.equal(await b.evaluate(`document.querySelectorAll('[aria-label^="Layer "][aria-label$=" actions"]').length`),1);await b.navigate(url);await delay(300);
  });
  // Editing fixtures use an explicit 120 BPM drawing master. First-performance
  // tempo adoption is tested separately in capture-tempo-proof.mjs.
  await button('Draw MIDI');await button('Back to Play');await button('Next capture');
  await button('Enable');await delay(500);
  for(const pitch of [60,64,67,64,60]) await playInput(pitch);
  let capturedRange;
  await check('front BPM plus/minus changes the grid without changing raw notes or capture bounds',async()=>{
    const raw=await notes(),range=await bounds(),tempo=await bpm('Capture grid settings');assert.ok(Number.isFinite(tempo));await button('Increase BPM');assert.equal(await bpm('Capture grid settings'),tempo+1);assert.deepEqual(await notes(),raw);assert.deepEqual(await bounds(),range);await button('Decrease BPM');assert.equal(await bpm('Capture grid settings'),tempo);assert.deepEqual(await notes(),raw);assert.deepEqual(await bounds(),range);
  });
  await check('front range snaps to bars; marker arrow keys move by the chosen grid step',async()=>{
    const raw=await notes(),before=await bounds();await select('Capture snap division','bar');assert.deepEqual(await notes(),raw);
    const points=await b.evaluate(`Array.from(document.querySelectorAll('[data-snap-grid]'),e=>({time:e.dataset.snapGrid,x:e.getBoundingClientRect().x}))`);const target=points.filter(p=>BigInt(p.time)>BigInt(before.end)).at(-1);assert.ok(target,'a visible later bar for extending the loop');
    const h=await rect('[data-boundary-handle="end"]'),line=await rect('[data-boundary="end"]',0,false),x=h.x+h.w/2,y=h.y+h.h/2,to=x+target.x-line.x;
    await gesture(x,y,to,y,false);assert.equal((await bounds()).end,target.time);assert.equal(await b.evaluate(`document.querySelector('[data-snap-target]')?.dataset.snapTarget`),target.time);await mouse('mouseReleased',to,y);await delay(100);assert.equal((await bounds()).end,target.time);
    const extended=await bounds(),startPoint=points.find(p=>BigInt(p.time)>BigInt(before.start)&&BigInt(p.time)<BigInt(target.time));assert.ok(startPoint);const lineStart=await rect('[data-boundary="start"]'),startHandle=await rect('[data-boundary-handle="start"]'),sx=startHandle.x+startHandle.w/2,sy=startHandle.y+startHandle.h/2,st=sx+startPoint.x-lineStart.x;await gesture(sx,sy,st,sy,false);assert.equal((await bounds()).start,startPoint.time,'dedicated Start grip snaps to a bar');assert.equal(await b.evaluate(`document.querySelector('[data-snap-target]')?.dataset.snapTarget`),startPoint.time);await key('Escape');await mouse('mouseReleased',st,sy);await delay(100);assert.deepEqual(await bounds(),extended);await button('Undo range');assert.deepEqual(await bounds(),before);
    await select('Capture snap division','1/4');await b.evaluate(`(()=>{const e=document.querySelector('[data-boundary-handle="start"]');if(e.tabIndex<0)throw Error('Marker must accept keyboard focus');e.focus();})()`);await key('ArrowRight');assert.equal(BigInt((await bounds()).start)-BigInt(before.start),500000n);await key('ArrowLeft');assert.deepEqual(await bounds(),before);assert.deepEqual(await notes(),raw);
  });
  await check('front-page capture markers snap, preview, cancel and preserve raw notes',async()=>{
    const raw=await notes();assert.equal(raw.length,5);await select('Capture snap division','1/4');assert.deepEqual(await notes(),raw);
    const before=await bounds();assert.ok(before.start!==undefined&&before.end!==undefined);
    const lattice=await b.evaluate(`Array.from(document.querySelectorAll('[data-snap-grid]'),e=>({time:e.dataset.snapGrid,x:e.getBoundingClientRect().x}))`);
    const target=lattice.filter(p=>BigInt(p.time)>BigInt(before.start)&&BigInt(p.time)<=BigInt(before.end)-500000n).at(-1);assert.ok(target,'a quarter-note grid point at least one beat inside the phrase, beyond the drag threshold');
    const handle=await rect('[data-boundary-handle="end"]'),line=await rect('[data-boundary="end"]',0,false);const x=handle.x+handle.w/2,y=handle.y+handle.h/2,to=x+target.x-line.x;
    await gesture(x,y,to,y,false);assert.equal((await bounds()).end,target.time);assert.equal(await b.evaluate(`document.querySelector('[data-snap-target]')?.dataset.snapTarget`),target.time);assert.deepEqual(await notes(),raw);
    await mouse('mouseReleased',to,y);await delay(100);capturedRange=await bounds();assert.equal(capturedRange.end,target.time);
    const again=await rect('[data-boundary-handle="end"]');await gesture(again.x+again.w/2,again.y+again.h/2,again.x+again.w/2-50,again.y+again.h/2,false);await key('Escape');await mouse('mouseReleased',again.x+again.w/2-50,again.y+again.h/2);await delay(100);assert.deepEqual(await bounds(),capturedRange);assert.deepEqual(await notes(),raw);await screenshot('capture-range-snap');await select('Capture snap division','1/16');assert.deepEqual(await bounds(),capturedRange);
  });
  await button('Capture');await button('Layer 1 actions');await button('Delete Layer 1');await editMidi();
  const initial=await notes();
  assert.equal(initial.length,5,'UI keyboard must capture exactly five synthetic notes');
  assert.deepEqual(await bounds(),capturedRange,'Capture inherits the adjusted live range');
  await check('populated initial editor and empty undo history',async()=>{assert.equal(await disabled('Undo'),true);assert.equal(await disabled('Redo'),true);});
  await check('editor opens with a musical grid without quantising captured notes',async()=>{
    assert.ok(await b.evaluate(`!!document.querySelector('[aria-label="Grid settings"]')`));
    assert.ok(await b.evaluate(`document.querySelectorAll('[data-snap-grid]').length>0`));
    assert.equal(await b.evaluate(`document.querySelector('[aria-label="Snap division"]').value`),'1/16');
    assert.ok(initial.some(n=>BigInt(n.start)%125000n!==0n),'captured timing remains expressive rather than automatically quantised to 120 BPM sixteenths');
    assert.deepEqual(await notes(),initial);await select('Snap division','off');assert.deepEqual(await notes(),initial);assert.equal(await disabled('Undo'),true);
  });
  await check('editor BPM plus/minus preserves exact notes, bounds and edit history',async()=>{
    const range=await bounds(),tempo=await bpm();assert.equal(tempo,120);await button('Increase BPM');assert.equal(await bpm(),121);assert.deepEqual(await notes(),initial);assert.deepEqual(await bounds(),range);await button('Decrease BPM');assert.equal(await bpm(),120);assert.deepEqual(await notes(),initial);assert.deepEqual(await bounds(),range);assert.equal(await disabled('Undo'),true);assert.equal(await disabled('Redo'),true);
  });
  await check('editor ruler ranges and note edits share exact ordered undo; stopped edits stay stopped',async()=>{
    const original=await bounds();await select('Snap division','1/16');const points=await b.evaluate(`Array.from(document.querySelectorAll('[data-snap-grid]'),e=>({time:e.dataset.snapGrid,x:e.getBoundingClientRect().x}))`);const inside=points.filter(p=>BigInt(p.time)>BigInt(original.start)&&BigInt(p.time)<BigInt(original.end));assert.ok(inside.length>=2);const first=inside[0],last=inside.at(-1),handle=await rect('[data-roll]'),y=handle.y+24;
    await gesture(first.x+2,y,last.x+2,y,false);const created={start:first.time,end:last.time};assert.deepEqual(await bounds(),created);assert.deepEqual(await notes(),initial);await mouse('mouseReleased',last.x+2,y);await delay(100);assert.deepEqual(await bounds(),created);
    await button('Undo');assert.deepEqual(await bounds(),original);assert.deepEqual(await notes(),initial);await button('Redo');assert.deepEqual(await bounds(),created);
    const end=await rect('[data-boundary-handle="end"]'),line=await rect('[data-boundary="end"]',0,false),target=points.find(p=>p.time===original.end);assert.ok(target);const x=end.x+end.w/2,ey=end.y+end.h/2,to=x+target.x-line.x;await gesture(x,ey,to,ey);const adjusted={start:created.start,end:original.end};assert.deepEqual(await bounds(),adjusted);assert.deepEqual(await notes(),initial);
    const cancel=await rect('[data-boundary-handle="end"]');await gesture(cancel.x+cancel.w/2,cancel.y+cancel.h/2,cancel.x+cancel.w/2-40,cancel.y+cancel.h/2,false);await key('Escape');await mouse('mouseReleased',cancel.x+cancel.w/2-40,cancel.y+cancel.h/2);await delay(100);assert.deepEqual(await bounds(),adjusted);
    await select('Snap division','off');await selectNotes([initial[2].id]);const n=await noteBox(initial[2].id);await gesture(n.x+Math.min(4,n.w/4),n.y+n.h/2,n.x+39,n.y+n.h/2-24);assert.notDeepEqual(await notes(),initial);await button('Undo');assert.deepEqual(await notes(),initial);assert.deepEqual(await bounds(),adjusted);await button('Undo');assert.deepEqual(await bounds(),created);await button('Undo');assert.deepEqual(await bounds(),original);await button('Redo');assert.deepEqual(await bounds(),created);await button('Undo');assert.deepEqual(await bounds(),original);
    await button('Stop');await select('Snap division','1/16');await gesture(first.x+2,y,last.x+2,y);assert.deepEqual(await bounds(),created);assert.ok(await b.evaluate(`!!document.querySelector('[aria-label="Play"]')`));assert.equal(await b.evaluate(`document.querySelectorAll('[data-playhead]').length`),0);await button('Undo');assert.deepEqual(await bounds(),original);await button('Play');await select('Snap division','off');assert.deepEqual(await notes(),initial);
  });
  await check('smart mouse gestures add and delete one note with exact undo',async()=>{
    await button('Select');const row=await rect('[data-pitch-row="55"]');const roll=await rect('[data-roll]',0,false);const x=roll.x+roll.w*.3,y=row.y+row.h/2;
    await doubleClick(x,y);const drawn=await notes();assert.equal(drawn.length,initial.length+1);const added=drawn.find(n=>!initial.some(o=>o.id===n.id));assert.ok(added);
    const r=await noteBox(added.id);await doubleClick(r.x+Math.min(4,r.w/4),r.y+r.h/2);assert.deepEqual(await notes(),initial);
    await button('Undo');assert.deepEqual(await notes(),drawn);await button('Undo');assert.deepEqual(await notes(),initial);
  });
  await check('B toggles Draw and Select; Draw moves existing notes; Delete is reversible',async()=>{
    await key('b','KeyB');assert.equal(await b.evaluate(`document.querySelector('[aria-label="Draw"]').innerText.includes('✓')`),true);
    const n=initial[2],r=await noteBox(n.id);await gesture(r.x+Math.min(4,r.w/4),r.y+r.h/2,r.x+39,r.y+r.h/2-24);
    const moved=await notes();assert.equal(moved.length,initial.length);assert.notDeepEqual(moved,initial);assert.equal(BigInt(moved.find(v=>v.id===n.id).end)-BigInt(moved.find(v=>v.id===n.id).start),BigInt(n.end)-BigInt(n.start));
    await key('b','KeyB');assert.equal(await b.evaluate(`document.querySelector('[aria-label="Select"]').innerText.includes('✓')`),true);
    await key('Delete','Delete');assert.equal((await notes()).length,initial.length-1);await button('Undo');assert.deepEqual(await notes(),moved);await button('Undo');assert.deepEqual(await notes(),initial);
  });
  await check('emulated touch double tap never deletes an existing note',async()=>{
    const before=await notes(),r=await noteBox(initial[2].id),point={id:1,x:r.x+Math.min(4,r.w/4),y:r.y+r.h/2,radiusX:4,radiusY:4,force:1};
    await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    for(let i=0;i<2;i++){await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(70);}
    await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});assert.deepEqual(await notes(),before);
  });
  await check('multi-selection moves, resizes and changes velocity as single reversible transactions',async()=>{
    const ids=[initial[0].id,initial[2].id];await selectNotes(ids);let r=await noteBox(ids[0]);await gesture(r.x+Math.min(4,r.w/4),r.y+r.h/2,r.x+44,r.y+r.h/2-24);
    const moved=await notes();const delta=BigInt(moved.find(n=>n.id===ids[0]).start)-BigInt(initial.find(n=>n.id===ids[0]).start);assert.notEqual(delta,0n);
    for(const n of initial){const m=moved.find(v=>v.id===n.id);if(ids.includes(n.id)){assert.equal(BigInt(m.start)-BigInt(n.start),delta);assert.equal(BigInt(m.end)-BigInt(n.end),delta);assert.equal(Number(m.pitch),Number(n.pitch)+1);}else assert.deepEqual(m,n);}
    r=await noteBox(ids[0]);await gesture(r.x+r.w-2,r.y+r.h/2,r.x+r.w+25,r.y+r.h/2);const resized=await notes();const endDelta=BigInt(resized.find(n=>n.id===ids[0]).end)-BigInt(moved.find(n=>n.id===ids[0]).end);assert.notEqual(endDelta,0n);
    for(const n of moved){const m=resized.find(v=>v.id===n.id);if(ids.includes(n.id)){assert.equal(m.start,n.start);assert.equal(BigInt(m.end)-BigInt(n.end),endDelta);}else assert.deepEqual(m,n);}
    await button('Velocity');await input('Note velocity','63');await panelButton('velocity','Apply velocity');const changed=await notes();for(const n of resized){const m=changed.find(v=>v.id===n.id);assert.deepEqual(m,ids.includes(n.id)?{...n,velocity:'63'}:n);}
    await button('Undo');assert.deepEqual(await notes(),resized);await button('Undo');assert.deepEqual(await notes(),moved);await button('Undo');assert.deepEqual(await notes(),initial);
  });
  await check('selected group quantise and Delete affect only selected notes and undo exactly',async()=>{
    const ids=[initial[0].id,initial[2].id];await selectNotes(ids);await select('Snap division','1/16');await button('Quantise');const quantised=await notes();assert.notDeepEqual(quantised,initial);for(const n of initial.filter(n=>!ids.includes(n.id)))assert.deepEqual(quantised.find(v=>v.id===n.id),n);assert.ok(quantised.filter(n=>ids.includes(n.id)).every(n=>BigInt(n.start)%125000n===0n),'direct Quantise aligns selected starts completely');await button('Undo');assert.deepEqual(await notes(),initial);await select('Snap division','off');
    await selectNotes(ids);await key('Delete','Delete');assert.deepEqual(await notes(),initial.filter(n=>!ids.includes(n.id)));await button('Undo');assert.deepEqual(await notes(),initial);
  });
  await check('marquee selects intersecting notes without adding a history step',async()=>{
    await button('Select');const a=await noteBox(initial[0].id),c=await noteBox(initial[1].id),roll=await rect('[data-roll]',0,false);
    await gesture(roll.x+1,a.y+a.h+5,c.x+c.w+3,c.y-4);assert.deepEqual(await notes(),initial);
    await key('Delete','Delete');assert.deepEqual(await notes(),initial.filter(n=>![initial[0].id,initial[1].id].includes(n.id)));await button('Undo');assert.deepEqual(await notes(),initial);
  });
  await check('group copy/paste, duplicate and context delete preserve originals and undo exactly',async()=>{
    const ids=[initial[0].id,initial[2].id];await selectNotes(ids);await key('c','KeyC',2);await key('v','KeyV',2);const pasted=await notes();assert.equal(pasted.length,initial.length+2);for(const n of initial)assert.deepEqual(pasted.find(v=>v.id===n.id),n);
    const added=pasted.filter(n=>!initial.some(o=>o.id===n.id)).sort((a,b)=>Number(a.pitch)-Number(b.pitch));const source=initial.filter(n=>ids.includes(n.id)).sort((a,b)=>Number(a.pitch)-Number(b.pitch));for(let i=0;i<2;i++){assert.equal(added[i].pitch,source[i].pitch);assert.equal(added[i].velocity,source[i].velocity);assert.equal(BigInt(added[i].end)-BigInt(added[i].start),BigInt(source[i].end)-BigInt(source[i].start));}assert.equal(BigInt(added[1].start)-BigInt(added[0].start),BigInt(source[1].start)-BigInt(source[0].start));await button('Undo');assert.deepEqual(await notes(),initial);
    await selectNotes(ids);await key('d','KeyD',2);const duplicated=await notes();assert.equal(duplicated.length,initial.length+2);await button('Undo');assert.deepEqual(await notes(),initial);
    await button('Selection actions');await panelButton('selection','Select all in layer');await button('Selection actions');await panelButton('selection','Delete notes');assert.deepEqual(await notes(),[]);await button('Undo');assert.deepEqual(await notes(),initial);
  });
  await check('draw and no-op gesture creates no extra undo',async()=>{
    await button('Draw');const row=await rect('[data-pitch-row="55"]');const roll=await rect('[data-roll]',0,false);
    await gesture(roll.x+roll.w*.38,row.y+row.h/2,roll.x+roll.w*.55,row.y+row.h/2,false);assert.equal(await b.evaluate(`document.querySelectorAll('[data-snap-target]').length`),0);await mouse('mouseReleased',roll.x+roll.w*.55,row.y+row.h/2);await delay(100);
    const drawn=await notes();assert.equal(drawn.length,initial.length+1);
    target=drawn.find(n=>!initial.some(i=>i.id===n.id)).id;
    await button('Select');const r=await noteBox(target);
    await gesture(r.x+5,r.y+r.h/2,r.x+35,r.y+r.h/2,false);await mouse('mouseMoved',r.x+5,r.y+r.h/2);await mouse('mouseReleased',r.x+5,r.y+r.h/2);await delay(100);
    assert.deepEqual(await notes(),drawn);
    await button('Undo');assert.deepEqual(await notes(),initial);await button('Redo');assert.deepEqual(await notes(),drawn);
  });
  await check('escape and pointercancel discard active edits exactly',async()=>{
    const before=await notes();let r=await noteBox(target);
    await gesture(r.x+5,r.y+r.h/2,r.x+45,r.y+r.h/2,false);await key('Escape');await mouse('mouseReleased',r.x+45,r.y+r.h/2);await delay(80);assert.deepEqual(await notes(),before);
    r=await noteBox(target);await gesture(r.x+5,r.y+r.h/2,r.x+40,r.y+r.h/2,false);
    await b.evaluate(`window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))`);
    await mouse('mouseReleased',r.x+40,r.y+r.h/2);await delay(80);assert.deepEqual(await notes(),before);
  });
  await check('move preserves duration, resize fixes start, velocity is reversible',async()=>{
    let before=await notes();let n=before.find(n=>n.id===target);let r=await noteBox(target);
    await gesture(r.x+5,r.y+r.h/2,r.x+45,r.y+r.h/2-24);
    let moved=(await notes()).find(n=>n.id===target);assert.notEqual(moved.start,n.start);assert.equal(BigInt(moved.end)-BigInt(moved.start),BigInt(n.end)-BigInt(n.start));assert.equal(Number(moved.pitch),Number(n.pitch)+1);
    r=await noteBox(target);await gesture(r.x+r.w-2,r.y+r.h/2,r.x+r.w+35,r.y+r.h/2);
    let resized=(await notes()).find(n=>n.id===target);assert.equal(resized.start,moved.start);assert.notEqual(resized.end,moved.end);
    const resizedState=await notes();await button('Velocity');await input('Note velocity','57');await panelButton('velocity','Apply velocity');
    assert.notEqual((await notes()).find(n=>n.id===target).velocity,resized.velocity);await button('Undo');assert.deepEqual(await notes(),resizedState);await button('Redo');
  });
  await check('velocity lane drag commits once; Escape cancels without history',async()=>{
    const before=await notes();let r=await rect(`[data-velocity-note=${q(target)}]`);
    await gesture(r.x+r.w/2,r.y+Math.min(5,r.h/2),r.x+r.w/2,r.y-10);
    const edited=await notes();assert.notEqual(edited.find(n=>n.id===target).velocity,before.find(n=>n.id===target).velocity);
    assert.deepEqual(edited.map(n=>({...n,velocity:0})),before.map(n=>({...n,velocity:0})));
    r=await rect(`[data-velocity-note=${q(target)}]`);await gesture(r.x+r.w/2,r.y+3,r.x+r.w/2,r.y+15,false);await key('Escape');await mouse('mouseReleased',r.x+r.w/2,r.y+15);await delay(100);assert.deepEqual(await notes(),edited);
    await button('Undo');assert.deepEqual(await notes(),before);await button('Redo');assert.deepEqual(await notes(),edited);
  });
  await check('erase is one reversible exact transaction',async()=>{const before=await notes();await button('Erase');const r=await noteBox(target);await gesture(r.x+5,r.y+r.h/2,r.x+10,r.y+r.h/2);const erased=await notes();assert.equal(erased.length,before.length-1);await button('Undo');assert.deepEqual(await notes(),before);await button('Redo');assert.deepEqual(await notes(),erased);await button('Undo');});
  await check('Ctrl+Z cancels a drag before applying history',async()=>{await button('Select');const before=await notes();const r=await noteBox(target);await gesture(r.x+5,r.y+r.h/2,r.x+45,r.y+r.h/2,false);await key('z','KeyZ',2);const undone=await notes();report.ctrlz={before,undone};await mouse('mouseReleased',r.x+45,r.y+r.h/2);await delay(100);assert.deepEqual(await notes(),undone);await button('Redo');report.ctrlz.afterRedo=await notes();assert.deepEqual(await notes(),before);});
  await check('emulated second touch cancels a note edit without a history entry',async()=>{
    const before=await notes();const r=await noteBox(target);const x=r.x+5,y=r.y+r.h/2;
    await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    const point=(id,x,y)=>({id,x,y,radiusX:4,radiusY:4,force:1});
    await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,x,y)]});
    await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,x+45,y)]});await delay(70);
    assert.notDeepEqual(await notes(),before,'first touch must actually preview an edit');
    await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,x+45,y),point(2,x+90,y+45)]});await delay(70);
    assert.deepEqual(await notes(),before);
    await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});await delay(80);
    await button('Undo');assert.notDeepEqual(await notes(),before);await button('Redo');assert.deepEqual(await notes(),before);
  });
  await check('grid keeps exact notes; quantise preview/cancel/apply/undo',async()=>{
    const before=await notes();await button('Grid settings');await select('Meter','4');await button('Confirm grid');await select('Snap division','1/16');assert.deepEqual(await notes(),before);
    await quantiseSettings();assert.notDeepEqual(await notes(),before);assert.ok(await b.evaluate(`document.querySelectorAll('[data-ghost]').length>0`));await panelButton('quantise','Cancel');await panelButton('quantise','Close settings');assert.deepEqual(await notes(),before);await button('Undo');assert.notDeepEqual(await notes(),before);await button('Redo');assert.deepEqual(await notes(),before);
    await quantiseSettings();await panelButton('quantise','Apply quantise');const after=await notes();assert.notDeepEqual(after,before);await button('Undo');assert.deepEqual(await notes(),before);await button('Redo');assert.deepEqual(await notes(),after);await button('Undo');
  });
  await check('snap presets and custom settings preserve exact working notes and history',async()=>{
    const before=await notes();
    for(const value of ['bar','1/4','1/8t','off','1/16']) {await select('Snap division',value);assert.deepEqual(await notes(),before);}
    await select('Snap division','custom');await input('Custom fraction','1/12');await panelButton('grid','Confirm grid');assert.deepEqual(await notes(),before);
    await button('Undo');assert.notDeepEqual(await notes(),before);await button('Redo');assert.deepEqual(await notes(),before);
  });
  await check('custom settings cancel and focused Escape restore the chosen snap label',async()=>{
    await select('Snap division','1/16');const before=await notes();
    await select('Snap division','custom');await input('Custom fraction','3/8');await key('Escape');
    assert.equal(await b.evaluate(`document.querySelector('[data-editor-panel]')===null`),true);assert.equal(await b.evaluate(`document.querySelector('[aria-label="Snap division"]').value`),'1/16');assert.deepEqual(await notes(),before);
    await select('Snap division','custom');await panelButton('grid','Close settings');
    assert.equal(await b.evaluate(`document.querySelector('[aria-label="Snap division"]').value`),'1/16');assert.deepEqual(await notes(),before);
  });
  await check('quantise preview cancels when opening View or switching to phone layout',async()=>{
    const before=await notes();await button('Preview');assert.ok(await b.evaluate(`document.querySelectorAll('[data-ghost]').length>0`));
    await button('View settings');assert.equal(await b.evaluate(`document.querySelectorAll('[data-ghost]').length`),0);assert.deepEqual(await notes(),before);await panelButton('view','Close settings');
    await button('Preview');assert.ok(await b.evaluate(`document.querySelectorAll('[data-ghost]').length>0`));await size(390,844);
    assert.equal(await b.evaluate(`document.querySelectorAll('[data-ghost]').length`),0);assert.deepEqual(await notes(),before);await size(1440,900);
  });
  await check('Bar, quarter, eighth-triplet and custom draws and moves land on visible exact grid',async()=>{
    const baseline=await notes();
    await button('View settings');await panelButton('view','Zoom in time');await panelButton('view','Zoom in time');await panelButton('view','Close settings');assert.deepEqual(await notes(),baseline);
    // The live fixture duration varies with scheduling. Show more than one bar
    // before targeting an interior bar line rather than relying on host timing.
    await button('View settings');await panelButton('view','Zoom out time');await panelButton('view','Close settings');
    for(const [division,numerator,denominator] of [['bar',2000000n,1n],['1/4',500000n,1n],['1/8t',500000n,3n],['custom',500000n,3n]]) {
      if(division==='custom') {await select('Snap division','custom');await input('Custom fraction','1/12');await panelButton('grid','Confirm grid');}
      else await select('Snap division',division);
      await button('Draw');const row=await rect('[data-pitch-row="55"]');
      const lines=await b.evaluate(`Array.from(document.querySelectorAll('[data-snap-grid]'),e=>({time:e.dataset.snapGrid,x:e.getBoundingClientRect().x})).filter(p=>p.x>document.querySelector('[data-roll]').getBoundingClientRect().left+2&&p.x<document.querySelector('[data-roll]').getBoundingClientRect().right-10)`);
      assert.ok(lines.length>0,division+' needs a visible grid point');
      for(let i=1;i<lines.length;i++) {const diff=BigInt(lines[i].time)-BigInt(lines[i-1].time);assert.ok(diff===numerator/denominator||diff===(numerator+denominator-1n)/denominator,division+' rational lattice spacing');}
      const point=lines[Math.floor(lines.length/2)];
      await mouse('mousePressed',point.x+3,row.y+row.h/2);await delay(70);assert.equal(await b.evaluate(`document.querySelector('[data-snap-target]')?.dataset.snapTarget`),point.time,division+' draw guide matches preview edge');await mouse('mouseReleased',point.x+3,row.y+row.h/2);await delay(100);
      let after=await notes();let added=after.find(n=>!baseline.some(o=>o.id===n.id));assert.ok(added,division+' draw adds a note');assert.equal(added.start,point.time,division+' draw snaps absolute start');
      await button('Select');let r=await noteBox(added.id);const dest=lines[0];await gesture(r.x+Math.min(4,r.w/4),r.y+r.h/2,dest.x+Math.min(4,r.w/4)+2,r.y+r.h/2-24,false);assert.equal(await b.evaluate(`document.querySelector('[data-snap-target]')?.dataset.snapTarget`),dest.time,division+' move guide matches preview edge');assert.equal((await notes()).find(n=>n.id===added.id).start,dest.time);await mouse('mouseReleased',dest.x+Math.min(4,r.w/4)+2,r.y+r.h/2-24);await delay(100);
      after=await notes();const moved=after.find(n=>n.id===added.id);assert.equal(moved.start,dest.time,division+' move lands on grid');assert.equal(BigInt(moved.end)-BigInt(moved.start),BigInt(added.end)-BigInt(added.start));
      await button('Undo');assert.equal((await notes()).find(n=>n.id===added.id).start,added.start);await button('Undo');assert.deepEqual(await notes(),baseline);
    }
    await select('Snap division','1/16');
  });
  await check('editor keyboard audition changes neither working notes nor undo',async()=>{
    const before=await notes();const r=await rect('[data-pitch-row="55"]');const keyboard=await rect('[data-keyboard="room"]',0,false);
    await mouse('mousePressed',keyboard.x+keyboard.w/2,r.y+r.h/2);await delay(160);await mouse('mouseReleased',keyboard.x+keyboard.w/2,r.y+r.h/2);await delay(120);assert.deepEqual(await notes(),before);
    await button('Undo');const undone=await notes();assert.notDeepEqual(undone,before);await button('Redo');assert.deepEqual(await notes(),before);
  });
  await check('selected layer playhead moves and hides when stopped',async()=>{
    const samples=[];for(let i=0;i<5;i++){samples.push(await b.evaluate(`document.querySelector('[data-playhead]')?.dataset.playhead??null`));await delay(100);}
    assert.ok(samples.every(Boolean),q(samples));assert.ok(new Set(samples).size>1,q(samples));await button('Stop');await delay(80);assert.equal(await b.evaluate(`document.querySelector('[data-playhead]')`),null);await button('Play');
  });
  // A successful Capture consumes its tape. Editor input must never refill it.
  await check('editor audition and edits leave the next tape empty and cannot duplicate Capture',async()=>{
    const edited=await notes();await button('Back to Play');const count=await b.evaluate(`document.querySelectorAll('[aria-label^="Layer "][aria-label$=" actions"]').length`);await button('Next capture');assert.deepEqual(await notes(),[]);await button('Capture');assert.deepEqual(await notes(),[]);assert.equal(await b.evaluate(`document.querySelectorAll('[aria-label^="Layer "][aria-label$=" actions"]').length`),count);await editMidi();assert.deepEqual(await notes(),edited);
  });
  for(const [width,height,name] of [[1440,900,'desktop'],[390,844,'phone']]) {
    await size(width,height);
    if(name==='phone') await check('visible phone dock Edit MIDI opens the large editor without scrolling',async()=>{await button('Back to Play');await b.evaluate(`document.querySelectorAll('*').forEach(e=>{if(e.scrollHeight>e.clientHeight)e.scrollTop=0})`);assert.ok(await b.evaluate(`!!document.querySelector('[data-touch-keyboard]')`),'keyboard stays open');await editMidi();});
    await check(name+' original note hit-testing after resize',async()=>{await button('Select');const middle=initial[2];const r=await noteBox(middle.id);await mouse('mousePressed',r.x+Math.min(4,r.w/3),r.y+r.h/2);await mouse('mouseReleased',r.x+Math.min(4,r.w/3),r.y+r.h/2);await delay(100);assert.equal(await b.evaluate(`document.querySelector(${q(`[data-note=${q(middle.id)}]`)})?.dataset.selected`),'true');assert.equal(await b.evaluate(`document.querySelector('[data-roll]').scrollTop`),0);});
    for(const appearance of ['Dark','Light']) {await theme(appearance);await layout(`${name}-${appearance.toLowerCase()}`);}
  }
  // Start a fresh in-memory performance to prove keyboard input separately from editor audition.
  await size(1440,900);await b.navigate(url);await delay(500);
  await check('performance keyboard exposes chromatic keys and playable scale/root/octave controls',async()=>{
    const pitches=()=>b.evaluate(`Array.from(document.querySelectorAll('[data-touch-keyboard] [data-key]'),e=>Number(e.dataset.key)).sort((a,b)=>a-b)`);
    assert.deepEqual(await pitches(),Array.from({length:24},(_,i)=>60+i));
    await select('Keyboard scale','minor-pentatonic');await select('Scale root','2');assert.deepEqual(await pitches(),[62,65,67,69,72,74,77,79,81,84]);
    await button('Keyboard octave up');assert.deepEqual(await pitches(),[74,77,79,81,84,86,89,91,93,96]);await screenshot('keyboard-pentatonic');
    await button('Keyboard octave down');await select('Keyboard scale','chromatic');assert.deepEqual(await pitches(),Array.from({length:24},(_,i)=>60+i));await screenshot('keyboard-chromatic');
  });
  await check('emulated keyboard chord and black key enter Capture; pointercancel releases ownership',async()=>{
    const a=await rect('[data-key="60"]'),c=await rect('[data-key="61"]');const point=(id,x,y)=>({id,x,y,radiusX:4,radiusY:4,force:1});
    await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,a.x+a.w/2,a.y+a.h-18),point(2,c.x+c.w/2,c.y+c.h/2)]});await delay(160);
    assert.equal(await b.evaluate(`document.querySelectorAll('[data-key][aria-pressed="true"]').length`),2);assert.ok(await b.evaluate(`document.body.innerText.includes('Sound · running')`),'playing a key enables sound without the MIDI Enable action');await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});await delay(100);
    assert.equal(await b.evaluate(`document.querySelectorAll('[data-key][aria-pressed="true"]').length`),0);
    const g=await rect('[data-key="67"]');await mouse('mousePressed',g.x+g.w/2,g.y+g.h-18);await delay(100);await b.evaluate(`window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))`);await mouse('mouseReleased',g.x+g.w/2,g.y+g.h-18);await delay(100);
    assert.equal(await b.evaluate(`document.querySelectorAll('[data-key][aria-pressed="true"]').length`),0);await button('Capture');await editMidi();
    const captured=await notes();assert.equal(captured.length,3);assert.deepEqual(captured.map(n=>Number(n.pitch)).sort((a,b)=>a-b),[60,61,67]);
    const first=captured.find(n=>n.pitch==='60'),black=captured.find(n=>n.pitch==='61');assert.ok(BigInt(first.start)<BigInt(black.end)&&BigInt(black.start)<BigInt(first.end),'captured chord overlaps in time');assert.ok(captured.every(n=>BigInt(n.end)>BigInt(n.start)));
  });
  await check('changing keyboard scale during a held gesture releases the recorded note',async()=>{
    await button('Back to Play');const r=await rect('[data-key="60"]');await mouse('mousePressed',r.x+r.w/2,r.y+r.h-18);await delay(100);await select('Keyboard scale','major');assert.equal(await b.evaluate(`document.querySelectorAll('[data-key][aria-pressed="true"]').length`),0);await mouse('mouseReleased',r.x+r.w/2,r.y+r.h-18);await delay(100);
    await button('Capture');await editMidi();const captured=await notes();assert.equal(captured.length,1);assert.equal(captured[0].pitch,'60');assert.ok(captured.every(n=>BigInt(n.end)>BigInt(n.start)));
  });
  await check('two emulated fingers sharing a key produce one note until the last release',async()=>{
    await button('Back to Play');await select('Keyboard scale','chromatic');const r=await rect('[data-key="60"]');const p=id=>({id,x:r.x+r.w*(id===1?.3:.7),y:r.y+r.h-15,radiusX:3,radiusY:3,force:1});
    await b.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p(1)]});await delay(80);await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p(1),p(2)]});await delay(80);assert.equal(await b.evaluate(`document.querySelectorAll('[data-key][aria-pressed="true"]').length`),1);
    await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p(2)]});await delay(80);assert.equal(await b.evaluate(`document.querySelectorAll('[data-key][aria-pressed="true"]').length`),1);await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await b.send('Emulation.setTouchEmulationEnabled',{enabled:false});await delay(100);assert.equal(await b.evaluate(`document.querySelectorAll('[data-key][aria-pressed="true"]').length`),0);
    await button('Capture');await editMidi();const captured=await notes();assert.equal(captured.length,1,'fresh tape contains one shared-pitch note until the last release');assert.equal(captured[0].pitch,'60');assert.ok(BigInt(captured[0].end)-BigInt(captured[0].start)>=200000n,'the first finger release must not close the shared note');
  });
  await check('keyboard glissando releases outside the keys and resumes on re-entry',async()=>{
    await button('Back to Play');const c=await rect('[data-key="60"]'),d=await rect('[data-key="62"]');await mouse('mousePressed',c.x+c.w/2,c.y+c.h-15);await delay(90);await mouse('mouseMoved',c.x+c.w/2,c.y-15);await delay(70);assert.equal(await b.evaluate(`document.querySelectorAll('[data-key][aria-pressed="true"]').length`),0);
    await mouse('mouseMoved',d.x+d.w/2,d.y+d.h-15);await delay(90);assert.equal(await b.evaluate(`document.querySelector('[data-key="62"]').getAttribute('aria-pressed')`),'true');await mouse('mouseReleased',d.x+d.w/2,d.y+d.h-15);await delay(100);assert.equal(await b.evaluate(`document.querySelectorAll('[data-key][aria-pressed="true"]').length`),0);
    await button('Capture');await editMidi();const captured=await notes();assert.equal(captured.length,2);assert.deepEqual(captured.map(n=>n.pitch).sort(),['60','62']);assert.ok(captured.every(n=>BigInt(n.end)>BigInt(n.start)));
  });
  await check('capture deletion and Undo restore the complete working layer',async()=>{
    const before=await notes();await button('Back to Play');const count=await b.evaluate(`document.querySelectorAll('[aria-label^="Layer "][aria-label$=" actions"]').length`);assert.ok(count>=2);await button(`Layer ${count} actions`);await button(`Delete Layer ${count}`);assert.equal(await b.evaluate(`document.querySelectorAll('[aria-label^="Layer "][aria-label$=" actions"]').length`),count-1);
    await button('Undo delete capture');assert.equal(await b.evaluate(`document.querySelectorAll('[aria-label^="Layer "][aria-label$=" actions"]').length`),count);await editMidi();assert.deepEqual(await notes(),before);
  });
  await check('125ms range remains exact in playback; desktop and phone markers remain reachable at rest',async()=>{
    await size(1440,900);await b.navigate(url);await delay(400);await playInput(60);await select('Capture snap division','1/16');
    const point=await rect('[data-snap-grid="125000"]'),h=await rect('[data-boundary-handle="end"]'),line=await rect('[data-boundary="end"]',0,false),x=h.x+h.w/2,y=h.y+h.h/2;
    await gesture(x,y,x+point.x-line.x,y);assert.deepEqual(await bounds(),{start:'0',end:'125000'});await button('Capture');
    await b.evaluate(`document.querySelectorAll('*').forEach(e=>{if(e.scrollHeight>e.clientHeight)e.scrollTop=0})`);await delay(120);
    report.desktopRange=await markerVisibility();
    assert.equal(report.desktopRange.length,2);assert.ok(report.desktopRange.every(r=>r.visible&&r.height>=48),JSON.stringify(report.desktopRange));await screenshot('desktop-capture-at-rest');
    await size(390,844);await b.evaluate(`document.querySelectorAll('*').forEach(e=>{if(e.scrollHeight>e.clientHeight)e.scrollTop=0})`);await delay(120);
    report.phoneRange=await markerVisibility();
    assert.equal(report.phoneRange.length,2);assert.ok(report.phoneRange.every(r=>r.visible&&r.height>=48),JSON.stringify(report.phoneRange));await screenshot('phone-capture-at-rest');
    await size(1440,900);await editMidi();assert.deepEqual(await bounds(),{start:'0',end:'125000'});const samples=[];for(let i=0;i<40;i++){samples.push(await b.evaluate(`Number(document.querySelector('[data-playhead]')?.dataset.playhead??NaN)`));await delay(10);}report.shortLoopSamples=samples;
    assert.ok(samples.every(n=>Number.isFinite(n)&&n>=0&&n<.126),JSON.stringify(samples));assert.ok(samples.some((n,i)=>i>0&&n<samples[i-1]-.02),'125ms loop clock wraps at the selected period');
  });
  await check('new playing clears an old live range and zoom never restricts the next capture',async()=>{
    await size(1440,900);await b.navigate(url);await delay(300);await button('Zoom in time');await button('Zoom in time');await button('Zoom in time');await playInput(60);await select('Capture snap division','1/16');const point=await rect('[data-snap-grid="125000"]'),handle=await rect('[data-boundary-handle="end"]'),line=await rect('[data-boundary="end"]',0,false);await gesture(handle.x+handle.w/2,handle.y+handle.h/2,handle.x+handle.w/2+point.x-line.x,handle.y+handle.h/2);assert.equal((await bounds()).end,'125000');await delay(1700);await playInput(67);const live=await notes(),last=live.find(n=>n.pitch==='67');assert.ok(last);assert.ok(BigInt((await bounds()).end)>=BigInt(last.end));await button('Capture');await editMidi();assert.ok(BigInt((await bounds()).end)>=BigInt(last.end));assert.equal((await notes()).length,2);
  });
  let recordingFixture,recordingBounds;
  await check('Record and Stop keep leading silence, a long internal rest and trailing silence',async()=>{
    await size(1440,900);await b.navigate(url);await delay(400);await button('Record');assert.equal(await disabled('Capture'),true);await delay(650);await playInput(60);await delay(1250);await playInput(67);await delay(650);await button('Stop recording');await editMidi();
    recordingFixture=await notes();recordingBounds=await bounds();assert.equal(recordingFixture.length,2);const ordered=[...recordingFixture].sort((a,b)=>Number(BigInt(a.start)-BigInt(b.start)));assert.equal(recordingBounds.start,'0');assert.ok(BigInt(ordered[0].start)>=650000n,'leading rest retained');assert.ok(BigInt(ordered[1].start)-BigInt(ordered[0].end)>=1250000n,'phrase finder must not drop the earlier phrase');assert.ok(BigInt(recordingBounds.end)-BigInt(ordered[1].end)>=650000n,'trailing rest retained');assert.deepEqual(ordered.map(n=>Number(n.pitch)),[60,67]);
  });
  await check('Cut range edits the same working layer and Undo restores complete notes and bounds',async()=>{
    await select('Snap division','1/4');const ordered=[...recordingFixture].sort((a,b)=>Number(BigInt(a.start)-BigInt(b.start)));const points=await b.evaluate(`Array.from(document.querySelectorAll('[data-snap-grid]'),e=>({time:e.dataset.snapGrid,x:e.getBoundingClientRect().x}))`);const first=points.find(p=>BigInt(p.time)>0n&&BigInt(p.time)<BigInt(ordered[0].start)),last=points.find(p=>BigInt(p.time)>BigInt(ordered[0].end)&&BigInt(p.time)<BigInt(ordered[1].start));assert.ok(first&&last);const h=await rect('[data-roll]'),y=h.y+24;await gesture(first.x+2,y,last.x+2,y);const range=await bounds();assert.deepEqual(range,{start:first.time,end:last.time});
    await click('[data-loop-settings]');await button('Use free range');await button('Close settings');const count=await b.evaluate(`document.querySelectorAll('[aria-label^="Layer "][aria-label*="Warm EP"]').length`);await button('Cut range');const clipped=recordingFixture.filter(n=>BigInt(n.end)>BigInt(range.start)&&BigInt(n.start)<BigInt(range.end)).map(n=>({...n,start:String(BigInt(n.start)<BigInt(range.start)?BigInt(range.start):BigInt(n.start)),end:String(BigInt(n.end)>BigInt(range.end)?BigInt(range.end):BigInt(n.end))}));assert.deepEqual(await notes(),clipped);assert.ok(clipped.length<recordingFixture.length);assert.equal(await b.evaluate(`document.querySelectorAll('[aria-label^="Layer "][aria-label*="Warm EP"]').length`),count);
    await button('Undo');assert.deepEqual(await notes(),recordingFixture);assert.deepEqual(await bounds(),range);await button('Redo');assert.deepEqual(await notes(),clipped);await button('Undo');await button('Undo');assert.deepEqual(await notes(),recordingFixture);assert.deepEqual(await bounds(),recordingBounds);
  });
  await check('Show full take recovers earlier recorded notes without changing the chosen range',async()=>{
    await button('Back to Play');await button('Zoom in time');await button('Zoom in time');await button('Zoom in time');await delay(120);const plot=await rect('[data-roll]');await gesture(plot.x+plot.w*.75,plot.y+plot.h*.6,plot.x+plot.w*.25,plot.y+plot.h*.6);const earliest=recordingFixture.reduce((t,n)=>BigInt(n.start)<t?BigInt(n.start):t,BigInt(recordingFixture[0].start));assert.ok(BigInt(await b.evaluate(`document.querySelector('[data-roll]').dataset.viewStart`))>earliest);await button('Fit clip');const frame=await b.evaluate(`({start:document.querySelector('[data-roll]').dataset.viewStart,end:document.querySelector('[data-roll]').dataset.viewEnd})`);assert.ok(BigInt(frame.start)<=earliest);assert.ok(recordingFixture.every(n=>BigInt(n.end)<=BigInt(frame.end)));assert.ok(BigInt(frame.end)>=BigInt(recordingBounds.end),'Full take retains recorded tail');assert.deepEqual(await notes(),recordingFixture);assert.deepEqual(await bounds(),recordingBounds);
  });
  await check('bundled typography is loaded without external font dependency',async()=>{
    report.fonts=await b.evaluate(`(async()=>{await document.fonts.ready;return [...document.fonts].map(f=>({family:f.family,status:f.status}));})()`);
    for(const name of ['Instrument Serif','Inter Tight','Geist Mono']) assert.ok(report.fonts.some(f=>f.family.replaceAll('"','')===name&&f.status==='loaded'),name+' loaded');
  });
  assert.deepEqual(b.exceptions,[],'Uncaught browser exceptions');
  report.passed=true;
} catch(error) { report.passed=false;report.failure=error.stack||String(error);process.exitCode=1;console.error(report.failure);try{await screenshot('failure');report.visibleText=await b.evaluate('document.body.innerText');report.events=await b.evaluate('window.__proofEvents');report.scroll=await b.evaluate(`(()=>{const r=document.querySelector('[data-roll]');return {top:r.scrollTop,left:r.scrollLeft,rect:r.getBoundingClientRect().toJSON(),notes:[...r.querySelectorAll('[data-note]')].map(n=>({pitch:n.dataset.pitch,top:n.style.top,rect:n.getBoundingClientRect().toJSON()}))};})()`);}catch{} }
finally {report.exceptions=b.exceptions;report.finished=new Date().toISOString();writeFileSync(join(out,'roll-proof-report.json'),JSON.stringify(report,null,2));await b.close();}
