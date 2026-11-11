import {browserSession,delay} from './browser-session.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
const out=resolve(process.env.SYNTH_PROOF_DIR||'../osc-bass-ux-evidence');mkdirSync(out,{recursive:true});
const b=await browserSession(),checks=[];let failure;
const ev=s=>b.evaluate(s),check=(v,name)=>{if(!v)throw Error(name);checks.push(name);console.log('PASS',name);};
const click=async selector=>{const p=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden control');return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of['mousePressed','mouseReleased'])await b.send('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});await delay(40);};
const bass=i=>`[data-osc-bass="${i}"]`;
try{
 await b.navigate(process.env.SYNTH_PROOF_URL||'http://127.0.0.1:41821/');for(let i=0;i<100&&!await ev(`!!document.querySelector('[data-osc-bass="1"]')`);i++)await delay(100);await ev('document.fonts.ready.then(()=>true)');
 check(await ev(`[...document.querySelectorAll('[data-osc-bass]')].length===2&&[...document.querySelectorAll('[data-osc-bass]')].every(e=>e.getAttribute('aria-checked')==='false')`),'Independent Bass controls start off');
 for(const width of[320,390,1440]){
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:width===320?740:width===390?844:900,deviceScaleFactor:1,mobile:false});await delay(100);
  for(const i of[0,1])if(await ev(`document.querySelector('${bass(i)}').getAttribute('aria-checked')==='true'`))await click(bass(i));
  await ev('window.scrollTo(0,0)');await b.screenshot(resolve(out,`bass-off-${width}.png`));
  if(width===1440)check(await ev(`document.querySelector('#keyboard').getBoundingClientRect().bottom<=innerHeight`),'Desktop Bass-off layout retains keyboard at rest');
  await click(bass(0));check(await ev(`!document.querySelector('#osc-bass-controls-0').hidden&&document.querySelector('#osc-bass-controls-1').hidden`),'Opening Bass1 leaves Bass2 closed '+width);
  await click(bass(1));
  check(await ev(`document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('.osc-bass-controls')].every(p=>{const panel=p.closest('.oscillator-panel').getBoundingClientRect(),items=[...p.querySelectorAll('.config-control')].map(e=>e.getBoundingClientRect());return items.every(r=>r.left>=panel.left&&r.right<=panel.right)&&items.every((r,i)=>items.slice(i+1).every(s=>r.right<=s.left||s.right<=r.left))})`),'Both expanded Bass control rows fit without overlap '+width);
  check(await ev(`[...document.querySelectorAll('[data-osc-bass],.osc-bass-controls button')].every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44})`),'Bass touch targets remain44px '+width);
  check(await ev(`[...document.querySelectorAll('[data-osc-preview]')].every(e=>e.getAttribute('aria-label').includes('native shape preview'))`),'Both Bass previews identify native shape honestly '+width);
  await ev('window.scrollTo(0,0)');await b.screenshot(resolve(out,`bass-both-${width}.png`));
  await ev(`document.querySelector('.keyboard-section').scrollIntoView({block:'end'})`);check(await ev(`(()=>{const r=document.querySelector('#keyboard').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1})()`),'Keyboard reachable with both Bass panels expanded '+width);
 }
 await click('#start');for(let i=0;i<100&&!await ev(`document.querySelector('#status').textContent.includes('running')`);i++)await delay(100);
 await ev('document.activeElement.blur()');await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',text:'a'});await delay(100);const phase=await ev(`document.querySelector('[data-osc-preview="19"]').dataset.bassPhase`);await delay(170);check(await ev(`document.querySelector('[data-osc-preview="19"]').dataset.bassPhase!==${JSON.stringify(phase)}`),'Bass preview phase advances from running engine');await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA'});
 await b.send('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:false});await delay(100);await ev('window.scrollTo(0,0)');
 for(let i=0;i<30&&!await ev(`document.querySelector('#cpu-load').textContent.includes('~')`);i++)await delay(100);
 check(await ev(`document.querySelector('#cpu-load').textContent.includes('~')`),'CPU fit check uses numeric live telemetry');
 check(await ev(`(()=>{const cpu=document.querySelector('#cpu-load').getBoundingClientRect(),status=document.querySelector('#status').getBoundingClientRect(),voices=document.querySelector('#monitor').getBoundingClientRect();return cpu.left>=status.right-1&&cpu.right<=voices.left+1&&voices.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth})()`),'Live CPU meter fits320px without overlapping status or voices');
 await b.screenshot(resolve(out,'bass-running-320.png'));await click('#stop');
 check(!b.exceptions.length&&await ev(`document.querySelector('#error').textContent===''`),'No runtime errors');
}catch(error){failure=error;}finally{writeFileSync(resolve(out,'bass-ux-report.json'),JSON.stringify({checks,failure:failure?String(failure):null,exceptions:b.exceptions},null,2));await b.close();}if(failure)throw failure;
