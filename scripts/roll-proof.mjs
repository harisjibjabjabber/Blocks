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
const report = { kind: 'synthetic Chrome mouse and DOM-cancellation regression; no hardware/touch/listening claim', url, started: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), dirty: execFileSync('git', ['status','--porcelain'], {encoding:'utf8'}).trim(), checks: [], screenshots: [] };
const b = await browserSession();
let target;
const q = JSON.stringify;
async function check(name, fn) { await fn(); report.checks.push({name, passed:true}); console.log('PASS ' + name); }
async function size(width, height) { await b.send('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:1,mobile:false}); await delay(180); }
async function rect(selector, index=0, scroll=true) {
  return b.evaluate(`(() => { const e=[...document.querySelectorAll(${q(selector)})][${index}]; if(!e) throw new Error('Missing '+${q(selector)}); ${scroll ? "(e.closest('[data-roll], [data-keyboard]') || e).scrollIntoView({block:'center',inline:'nearest'});" : ''} const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
}
async function mouse(type,x,y) { await b.send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1}); }
async function click(selector,index=0) {const r=await rect(selector,index); await mouse('mousePressed',r.x+r.w/2,r.y+r.h/2); await mouse('mouseReleased',r.x+r.w/2,r.y+r.h/2); await delay(100);}
const label = text => `[aria-label=${q(text)}]`;
const button = (text,index=0) => click(label(text),index);
async function key(key,code=key,modifiers=0) { await b.send('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers,windowsVirtualKeyCode:key==='z'?90:key==='Escape'?27:0}); await b.send('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers:0}); await delay(80); }
async function gesture(x,y,toX,toY,finish=true) { await mouse('mousePressed',x,y); await mouse('mouseMoved',toX,toY); await delay(60); if(finish) { await mouse('mouseReleased',toX,toY); await delay(100); } }
async function notes() { return b.evaluate(`Array.from(document.querySelectorAll('[data-note]'),e=>({id:e.dataset.note,start:e.dataset.start,end:e.dataset.end,velocity:e.dataset.velocity,pitch:e.dataset.pitch})).sort((a,b)=>a.id.localeCompare(b.id))`); }
async function noteBox(id) { return rect(`[data-note=${q(id)}]`); }
async function screenshot(name) {const file=join(out,name+'.png');await b.screenshot(file);report.screenshots.push(file);}
async function disabled(name) {return b.evaluate(`document.querySelector(${q(label(name))})?.getAttribute('aria-disabled')==='true'`);}
async function playInput(pitch,hold=110) {const r=await rect(`[data-key="${pitch}"]`);await mouse('mousePressed',r.x+r.w/2,r.y+r.h/2);await delay(hold);await mouse('mouseReleased',r.x+r.w/2,r.y+r.h/2);await delay(90);}
async function theme(name) {await button('Back to Play');await button('Settings');await button(name);await button('Settings');await button('Edit');}
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
  await button('Enable');
  for(const pitch of [60,64,67,64,60]) await playInput(pitch);
  await button('Capture');await button('Edit');
  const initial=await notes();
  assert.equal(initial.length,5,'UI keyboard must capture exactly five synthetic notes');
  await check('populated initial editor and empty undo history',async()=>{assert.equal(await disabled('Undo'),true);assert.equal(await disabled('Redo'),true);});
  await check('draw and no-op gesture creates no extra undo',async()=>{
    await button('Draw');const row=await rect('[data-pitch-row="55"]');const roll=await rect('[data-roll]',0,false);
    await gesture(roll.x+roll.w*.38,row.y+row.h/2,roll.x+roll.w*.55,row.y+row.h/2);
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
    await button('Velocity');r=await noteBox(target);const resizedState=await notes();await gesture(r.x+5,r.y+r.h/2,r.x+5,r.y+r.h/2-20);
    assert.notEqual((await notes()).find(n=>n.id===target).velocity,resized.velocity);await button('Undo');assert.deepEqual(await notes(),resizedState);await button('Redo');
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
    const before=await notes();await button('Set grid');await button('Confirm grid');assert.deepEqual(await notes(),before);
    await button('Quantise…');assert.notDeepEqual(await notes(),before);assert.ok(await b.evaluate(`document.querySelectorAll('[data-ghost]').length>0`));await button('Cancel');assert.deepEqual(await notes(),before);await button('Undo');assert.notDeepEqual(await notes(),before);await button('Redo');assert.deepEqual(await notes(),before);
    await button('Quantise…');await button('Apply quantise');const after=await notes();assert.notDeepEqual(after,before);await button('Undo');assert.deepEqual(await notes(),before);await button('Redo');assert.deepEqual(await notes(),after);await button('Undo');
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
  // Re-capture unchanged raw history after audition: edited notes and audition must not leak into it.
  await check('recapture proves editor audition and edits did not enter capture history',async()=>{
    await button('Back to Play');await button('Capture');await button('Edit');assert.deepEqual(await notes(),initial);
  });
  for(const [width,height,name] of [[1440,900,'desktop'],[390,844,'phone']]) {
    await size(width,height);
    await check(name+' original note hit-testing after resize',async()=>{await button('Select');const middle=initial[2];const r=await noteBox(middle.id);await mouse('mousePressed',r.x+Math.min(4,r.w/3),r.y+r.h/2);await mouse('mouseReleased',r.x+Math.min(4,r.w/3),r.y+r.h/2);await delay(100);assert.ok(await b.evaluate(`document.body.innerText.includes('1 note selected')`));assert.equal(await b.evaluate(`document.querySelector('[data-roll]').scrollTop`),0);});
    for(const appearance of ['Dark','Light']) {await theme(appearance);await layout(`${name}-${appearance.toLowerCase()}`);}
  }
  assert.deepEqual(b.exceptions,[],'Uncaught browser exceptions');
  report.passed=true;
} catch(error) { report.passed=false;report.failure=error.stack||String(error);process.exitCode=1;console.error(report.failure);try{await screenshot('failure');report.visibleText=await b.evaluate('document.body.innerText');report.events=await b.evaluate('window.__proofEvents');report.scroll=await b.evaluate(`(()=>{const r=document.querySelector('[data-roll]');return {top:r.scrollTop,left:r.scrollLeft,rect:r.getBoundingClientRect().toJSON(),notes:[...r.querySelectorAll('[data-note]')].map(n=>({pitch:n.dataset.pitch,top:n.style.top,rect:n.getBoundingClientRect().toJSON()}))};})()`);}catch{} }
finally {report.exceptions=b.exceptions;report.finished=new Date().toISOString();writeFileSync(join(out,'roll-proof-report.json'),JSON.stringify(report,null,2));await b.close();}
