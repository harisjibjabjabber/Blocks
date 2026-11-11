import {browserSession,delay} from './browser-session.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const out=resolve(process.env.SYNTH_PROOF_DIR||'../tone-layout-evidence');mkdirSync(out,{recursive:true});
const url=process.env.SYNTH_PROOF_URL||'http://127.0.0.1:41821/';
const b=await browserSession(),checks=[];let failure;
const ev=s=>b.evaluate(s),check=(v,name)=>{if(!v)throw Error(name);checks.push(name);console.log('PASS',name);};
const box=async s=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(s)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
const click=async s=>{const p=await box(s);for(const type of['mousePressed','mouseReleased'])await b.send('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});await delay(40);};
const key=async(s,key)=>{await ev(`document.querySelector(${JSON.stringify(s)}).focus()`);for(const type of['keyDown','keyUp'])await b.send('Input.dispatchKeyEvent',{type,key});};
const patch=()=>ev(`(async()=>{document.querySelector('#export').click();return JSON.parse(await window.__blob.text())})()`);
try{
 await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__soundMessages=[];const post=MessagePort.prototype.postMessage;MessagePort.prototype.postMessage=function(message,...rest){if(message?.kind==='sound')window.__soundMessages.push(structuredClone(message));return post.call(this,message,...rest)};const blob=URL.createObjectURL;URL.createObjectURL=function(value){window.__blob=value;return blob(value)};HTMLAnchorElement.prototype.click=function(){};`});
 await b.navigate(url);for(let i=0;i<100&&!await ev(`!!document.querySelector('#source-profile-toggle')`);i++)await delay(100);
 await ev('document.fonts.ready.then(()=>true)');
 check(await ev(`!!document.querySelector('#tone-layout')&&!document.querySelector('#tone-layout').hidden`),'New Tone shell initialized');
 for(const width of[320,390,600,760,1024,1280,1440,1888,1920]){
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:width===320?740:width<600?844:900,deviceScaleFactor:1,mobile:false});await delay(80);
  check(await ev(`(()=>{const r=document.querySelector('#tone-filter').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('#macros>*,#tone-filter-mode>div')].filter(e=>!e.hidden).every(e=>{const c=e.getBoundingClientRect();return c.x>=r.x&&c.right<=r.right})})()`),'Initial silent Tone controls fit '+width);
 }
 await click('#start');for(let i=0;i<100&&!await ev(`document.querySelector('#status').textContent.includes('running')`);i++)await delay(100);
 check(await ev(`document.querySelector('#status').textContent.includes('running')`),'Actual worklet starts');
 await click('#source-profile-toggle');await click('[data-source-profile=legacy]');
 check(await ev(`window.__soundMessages.at(-1)?.config.oscillator===0&&document.querySelector('#source-profile-toggle').textContent.includes('Legacy')`),'Legacy chooser sends oscillator0 through real worklet port');
 await click('#source-profile-toggle');await click('[data-source-profile=studio]');
 check(await ev(`window.__soundMessages.at(-1)?.config.oscillator===1&&document.querySelector('#source-profile-toggle').textContent.includes('Studio')`),'Studio chooser sends oscillator1 through real worklet port');
 await click('#filter-mode-toggle');await click('[data-filter-mode="2"]');
 for(const width of[320,390,600,760,1024,1280,1440,1888,1920]){
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:width===320?740:width<600?844:900,deviceScaleFactor:1,mobile:false});await delay(140);await ev('window.scrollTo(0,0)');
  const geometry=await ev(`(()=>{const r=e=>{const a=e.getBoundingClientRect();return{x:a.x,y:a.y,w:a.width,h:a.height,right:a.right,bottom:a.bottom}},filter=document.querySelector('#tone-filter'),fr=r(filter),controls=[...document.querySelectorAll('#tone-filter #macros>*,#tone-filter-mode>div')].filter(e=>!e.hidden).map(r),osc=[...document.querySelectorAll('.oscillator-panel')].map(r);return{overflow:document.documentElement.scrollWidth>innerWidth,filter:fr,osc,controls,inside:controls.every(a=>a.x>=fr.x&&a.right<=fr.right&&a.w>=44),collision:controls.some((a,i)=>controls.slice(i+1).some(c=>Math.min(a.right,c.right)-Math.max(a.x,c.x)>1&&Math.min(a.bottom,c.bottom)-Math.max(a.y,c.y)>1)),dials:[...filter.querySelectorAll('#macros button')].map(r)}})()`);
  check(!geometry.overflow&&geometry.inside&&!geometry.collision,'All filter controls contained without overlap '+width);
  check(geometry.dials.every(r=>r.w>=44&&r.h>=44),'All filter dial hit targets at least44px '+width);
  check(geometry.osc.every(r=>r.w>=220),'Independent oscillator cards have readable width '+width);
  check(width<1180||geometry.filter.w>=360,'Desktop filter never squeezed into old rail '+width);
  writeFileSync(resolve(out,`tone-geometry-${width}.json`),JSON.stringify(geometry,null,2));
  await b.screenshot(resolve(out,`tone-${width}.png`));
  if(width>=1280){const rest=await ev(`(()=>{const r=document.querySelector('#keyboard').getBoundingClientRect();return {y:r.y,bottom:r.bottom,height:innerHeight}})()`);writeFileSync(resolve(out,`keyboard-rest-${width}.json`),JSON.stringify(rest));check(rest.bottom<=rest.height,'Desktop keyboard visible at rest '+width);}
  await click('#filter-mode-toggle');
  check(await ev(`(()=>{const p=document.querySelector('#filter-mode-options'),r=p.getBoundingClientRect();return !p.hidden&&r.x>=0&&r.right<=innerWidth&&[...p.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=44)})()`),'Filter chooser fully readable '+width);
  await b.screenshot(resolve(out,`filter-menu-${width}.png`));await key('[data-filter-mode="2"]','Escape');
  for(const id of[19,20]){
   await click('[data-waveosc="'+id+'"]');
   check(await ev(`(()=>{const p=document.querySelector('#wave-popover'),r=p.getBoundingClientRect();return !p.hidden&&r.x>=0&&r.right<=innerWidth&&p.closest('.oscillator-panel').dataset.oscillator===${JSON.stringify(id===19?'1':'2')}})()`),'Wave chooser anchors to its own oscillator '+id+' at '+width);
   await click('[data-wave="'+(id===19?4:1)+'"]');
  }
  check(await ev(`document.querySelector('[data-osc-preview="19"]').getAttribute('aria-label').includes('Square')&&document.querySelector('[data-osc-preview="20"]').getAttribute('aria-label').includes('Triangle')`),'Both individual shape previews follow actual waveform choices '+width);
  await click('#source-profile-toggle');check(await ev(`(()=>{const p=document.querySelector('#source-profile-options'),r=p.getBoundingClientRect();return !p.hidden&&r.x>=0&&r.right<=innerWidth&&!p.closest('.voicing-panel')})()`),'Global source chooser outside Unison fits '+width);await key('[data-source-profile=studio]','Escape');
  await ev(`document.querySelector('.keyboard-section').scrollIntoView({block:'end'})`);const keyboard=await ev(`(()=>{const r=document.querySelector('#keyboard').getBoundingClientRect();return {y:r.y,bottom:r.bottom,width:r.width,height:r.height,innerHeight}})()`);writeFileSync(resolve(out,`keyboard-${width}.json`),JSON.stringify(keyboard));check(keyboard.width>0&&keyboard.height>0&&keyboard.y>=0&&keyboard.bottom<=keyboard.innerHeight+1,'Keyboard remains reachable by scrolling '+width);
  if(width<600){await ev(`document.querySelector('#tone-filter').scrollIntoView({block:'start'})`);await b.screenshot(resolve(out,`filter-${width}.png`));}
 }
 await b.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});await delay(100);
 const before=await patch();await key('[data-osclevel="21"]','ArrowDown');let after=await patch();check(after.values[21]<before.values[21]&&after.values[22]===before.values[22],'Osc1 Mix remains independent');await click('#undo');check(JSON.stringify((await patch()).values)===JSON.stringify(before.values),'Oscillator edit Undo restores values');
 for(const module of['envelope','character','lfo','tone']){await click('#module-tabs [data-module="'+module+'"]');check(await ev(`document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.instrument').dataset.module===${JSON.stringify(module)}`),'Module switch preserves layout '+module);}
 check(await ev(`document.querySelector('#tone-filter').contains(document.querySelector('#shape-surface'))&&document.querySelector('#tone-filter').contains(document.querySelector('#macros'))`),'Returning to Tone restores shared filter surface');
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(100);
 const touchBefore=await patch(),p=await box('[data-osclevel="22"]');await b.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]});await b.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y-28,id:1}]});await b.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 check((await patch()).values[22]>touchBefore.values[22]&&(await patch()).values[21]===touchBefore.values[21],'Touch drag changes only Osc2 Mix');await click('#undo');check(JSON.stringify((await patch()).values)===JSON.stringify(touchBefore.values),'Touch Mix Undo is atomic');
 check(!b.exceptions.length&&await ev(`document.querySelector('#error').textContent===''`),'No runtime or native error');
}catch(error){failure=error;}finally{writeFileSync(resolve(out,'tone-layout-report.json'),JSON.stringify({checks,failure:failure?String(failure):null,exceptions:b.exceptions},null,2));await b.close();}
if(failure)throw failure;
