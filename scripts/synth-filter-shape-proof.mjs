import{browserSession,delay}from'./browser-session.mjs';import{mkdirSync,writeFileSync}from'node:fs';import{resolve}from'node:path';
const out=resolve(process.env.SYNTH_PROOF_DIR||'../filter-shape-evidence');mkdirSync(out,{recursive:true});const b=await browserSession(),checks=[];let failure;
const ev=s=>b.evaluate(s),check=(value,name)=>{if(!value)throw Error(name);checks.push(name);console.log('PASS',name);};
const click=async s=>{await ev(`document.querySelector(${JSON.stringify(s)}).click()`);await delay(40);};
const key=async(s,key)=>{await ev(`document.querySelector(${JSON.stringify(s)}).focus()`);for(const type of['keyDown','keyUp'])await b.send('Input.dispatchKeyEvent',{type,key});};
const shape=()=>ev(`document.querySelector('.filter-bank-response').getAttribute('d')`);
try{
 await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`const old=URL.createObjectURL;URL.createObjectURL=function(blob){window.__blob=blob;return old(blob)};HTMLAnchorElement.prototype.click=function(){};`});
 await b.navigate(process.env.SYNTH_PROOF_URL||'http://127.0.0.1:41821/');for(let i=0;i<100&&!await ev(`!!document.querySelector('[data-control="filter:0:cutoff"]')`);i++)await delay(100);await ev('document.fonts.ready.then(()=>true)');
 const patch=await ev(`(async()=>{document.querySelector('#export').click();return JSON.parse(await window.__blob.text())})()`);patch.values[11]=880;patch.values[42]=0;patch.values[23]=.78;patch.sound.filterModel='ladder';Object.assign(patch.filterBank.filters[0],{model:'ladder',cutoff:880,resonance:0,mix:.78});
 const file=resolve(out,'ladder-880-input.json');writeFileSync(file,JSON.stringify(patch));const{root}=await b.send('DOM.getDocument');const{nodeId}=await b.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#import'});await b.send('DOM.setFileInputFiles',{nodeId,files:[file]});await delay(80);
 check(await ev(`document.querySelector('.filter-bank-response')&&document.querySelector('.filter-bank-editor svg').getAttribute('aria-label').includes('small-signal')`),'Ladder renders its labelled shape curve');
 check(await ev(`document.querySelector('.filter-bank-editor svg').getAttribute('aria-label').includes('drive-dependent distortion')`),'Nonlinear preview limits are accessible');
 for(const width of[320,390,1440]){
  await b.send('Emulation.setDeviceMetricsOverride',{width,height:width===320?740:width===390?844:900,deviceScaleFactor:1,mobile:false});await delay(80);await ev(`document.querySelector('#tone-filter').scrollIntoView({block:'start'})`);
  check(await ev(`(()=>{const p=document.querySelector('.filter-bank-response'),r=p.getBoundingClientRect(),g=document.querySelector('.filter-bank-editor svg').getBoundingClientRect();return getComputedStyle(p).stroke!=='none'&&r.width>100&&r.height>2&&r.left>=g.left&&r.right<=g.right&&r.top>=g.top&&r.bottom<=g.bottom})()`),'880Hz resonance0 mix78 curve visible and contained '+width);
  await b.screenshot(resolve(out,`ladder-880-${width}.png`));
 }
 const original=await shape();await key('[data-control="filter:0:resonance"]','ArrowRight');check(await shape()!==original,'Resonance edits update Ladder curve');await click('#undo');check(await shape()===original,'Curve returns exactly on Undo');
 await key('[data-control="filter:0:cutoff"]','ArrowLeft');check(await shape()!==original,'Cutoff edits update Ladder curve');await click('#undo');
 await key('[data-control="filter:0:mix"]','Home');check(await ev(`document.querySelector('.filter-bank-response').getBBox().height<.001`),'Dry normalized shape is flat');await click('#undo');check(await shape()===original,'Mix Undo restores partial-wet shape');
 await key('[data-control="filter:0:drive"]','ArrowRight');check(await shape()===original,'Preview does not pretend to measure drive-dependent distortion');await click('#undo');
 for(const model of['soft','resonant']){await ev(`(()=>{const e=document.querySelector('.filter-bank-mode select');e.value=${JSON.stringify(model)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(60);check(await ev(`document.querySelector('.filter-bank-editor svg').getAttribute('aria-label').includes('Base filter response')`),'Exact base response retained for '+model);}
 check(!b.exceptions.length&&await ev(`document.querySelector('#error').textContent===''`),'No runtime errors');
}catch(error){failure=error;}finally{writeFileSync(resolve(out,'filter-shape-report.json'),JSON.stringify({checks,failure:failure?String(failure):null,exceptions:b.exceptions},null,2));await b.close();}if(failure)throw failure;
