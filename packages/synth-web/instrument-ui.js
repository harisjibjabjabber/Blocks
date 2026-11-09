import {characterRecipe,applyRecipe,readRecipe} from './recipes.js';
import {factoryPatch} from './presets.js';
import {timeFromUnit,timeToUnit} from './envelope-scale.js';
// The instrument surface owns gestures, never voices or the audio clock.
export function createInstrumentUI({ parameters, getValues, applyValues, releaseVoices, onViewChange=()=>{} }) {
  const $ = id => document.getElementById(id);
  const history = [];
  let module = 'tone', sauce = 'drive', gesture = null, preset = 'velvet';
  const svgNS = 'http://www.w3.org/2000/svg';
  const waveNames = ['Sine','Triangle','Saw','Pulse'];
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const timeUnit=(id,value=getValues()[id])=>timeToUnit(value,parameters[id].min,parameters[id].max);
  const timeValue=(id,unit)=>timeFromUnit(unit,parameters[id].min,parameters[id].max);
  const norm = (id, value = getValues()[id]) => {
    const p = parameters[id];
    return clamp(p.mapping === 1 ? Math.log(value / p.min) / Math.log(p.max / p.min) : (value - p.min) / (p.max - p.min));
  };
  const physical = (id, n) => {
    const p = parameters[id]; n = clamp(n);
    const value=p.mapping === 1 ? p.min * Math.pow(p.max / p.min, n) : p.min + (p.max - p.min) * n;
    return p.mapping===2?Math.round(value):value;
  };
  const format = (id, value = getValues()[id]) => {
    if (id===19||id===20) return waveNames[Math.round(value)]||'Unknown';
    if ([4,5,7,16].includes(id)) return value < 1 ? Math.round(value * 1000) + ' ms' : value.toFixed(2) + ' s';
    if (id === 11) return value < 1000 ? Math.round(value) + ' Hz' : (value / 1000).toFixed(1) + ' kHz';
    if ([0,1,6,18].includes(id)) return Math.round(value * 100) + '%';
    if ([8,9,10,17].includes(id)) return Math.abs(value) < .01 ? 'Linear' : (value > 0 ? '+' : '') + value.toFixed(2);
    return Number(value.toFixed(id === 14 ? 2 : 1)) + (id === 14 ? ' Hz' : id === 12 ? '×' : id === 3 ? '' : ' ct');
  };
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const state = () => ({values: [...getValues()], preset});
  function commit(before) {
    if (!same(before.values, getValues())) { history.push(before); if (history.length > 40) history.shift(); }
    $('undo').disabled = !history.length;
  }
  function apply(next, markCustom = true) {
    const bounded = next.map((v, id) => {const p=parameters[id],value=clamp(v,p.min,p.max);return p.mapping===2?Math.round(value):value;});
    applyValues(bounded);
    if (markCustom) preset = 'custom';
    update();
  }
  function cancel() {
    if (!gesture) return;
    const before = gesture.before;
    gesture = null; preset = before.preset; apply(before.values, false);
  }
  function begin(e, type, data = {}) {
    if (gesture || (e.button !== undefined && e.button !== 0)) return false;
    gesture = {type, pointer: e.pointerId, before: state(), x: e.clientX, y: e.clientY, ...data};
    e.currentTarget.setPointerCapture(e.pointerId);
    return true;
  }
  function finish(e) {
    if (gesture?.pointer !== e.pointerId) return;
    const before = gesture.before; gesture = null; commit(before);
  }
  function bindCompletion(target) {
    target.addEventListener('pointerup', finish);
    target.addEventListener('pointercancel', e => { if (gesture?.pointer === e.pointerId) cancel(); });
    target.addEventListener('lostpointercapture', e => { if (gesture?.pointer === e.pointerId) cancel(); });
  }
  function character(n, values) {const next=applyRecipe(characterRecipe,n,values);for(const t of characterRecipe.targets)values[t.id]=next[t.id];}
  const characterN = () => readRecipe(characterRecipe,getValues()).amount;
  const characterCustom = () => readRecipe(characterRecipe,getValues()).custom;
  function changeKnob(id, n) {
    const next = [...getValues()];
    if (id === 'character') character(clamp(n), next); else next[id] = physical(Number(id), n);
    apply(next);
  }
  const knobN = id => id === 'character' ? characterN() : norm(Number(id));
  function knob(id, name) {
    const container=document.createElement('div'); container.className='macro';
    const button=document.createElement('button'); button.className='dial'; button.dataset.knob=id;
    button.setAttribute('role','slider'); button.setAttribute('aria-label',name);
    button.setAttribute('aria-valuemin','0'); button.setAttribute('aria-valuemax','100');
    const face=document.createElement('span');face.className='dial-face';face.setAttribute('aria-hidden','true');
    const needle=document.createElement('span'); needle.className='dial-needle';face.append(needle);button.append(face);
    const label=document.createElement('span'); label.className='macro-name'; label.textContent=name;
    const value=document.createElement('output'); value.className='macro-value'; value.dataset.knobValue=id;
    button.addEventListener('pointerdown', e => {e.preventDefault();begin(e,'knob',{id,base:knobN(id)});});
    button.addEventListener('pointermove', e => {if(gesture?.type==='knob'&&gesture.pointer===e.pointerId)changeKnob(id,gesture.base+(gesture.y-e.clientY)/180);});
    button.addEventListener('keydown', e => {
      if(gesture || !['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(e.key))return;
      e.preventDefault();const before=state(); const step=e.shiftKey?.1:.01;
      changeKnob(id,e.key==='Home'?0:e.key==='End'?1:knobN(id)+(['ArrowUp','ArrowRight'].includes(e.key)?step:-step));commit(before);
    });
    bindCompletion(button);container.append(button,label,value);return container;
  }
  const macros={tone:[[11,'Cutoff'],[1,'Oscillator mix'],['character','Character']],envelope:[['character','Character']],character:[['character','Character']],drop:[[15,'Amount'],[16,'Fall time'],['character','Character']]};
  if(parameters[18]) {macros.character.push([18,'Fullness']);}
  const titles={tone:'Oscillator + filter',envelope:'Amplitude envelope',character:'Character',drop:'Pitch Drop'};
  const descriptions={tone:'Drag across to open the filter · up for oscillator mix',envelope:'Drag for time · up/down for sustain · bend curves for shape',character:'Character blends warmth + drift · edit each in Precision',drop:'Per-note pitch fall · drag the curve to bend · new notes'};
  function select(next) {
    cancel(); module=next;
    document.querySelector('.instrument').dataset.module=module;
    $('waveforms').hidden=module!=='tone'||!parameters[19];
    $('scope-wrapper').hidden=module!=='tone';
    $('sauce-tabs').hidden=module!=='drop';
    for(const b of document.querySelectorAll('[data-sauce]'))b.setAttribute('aria-pressed',String(b.dataset.sauce===sauce));
    svg.setAttribute('preserveAspectRatio',module==='tone'?'none':'xMidYMid meet');
    for(const b of document.querySelectorAll('#module-tabs [data-module]')) {const active=b.dataset.module===module;b.setAttribute('aria-pressed',String(active));b.classList.toggle('selected',active);}
    $('module-title').textContent=module==='drop'&&sauce==='drive'?'Drive':titles[module]; $('module-description').textContent=module==='drop'&&sauce==='drive'?'Mixer warmth · turn up for more edge':descriptions[module];
    const selected=module==='drop'&&sauce==='drive'?[[12,'Drive'],['character','Character']]:macros[module];
    $('macros').replaceChildren(...selected.map(([id,name])=>knob(String(id),name)));
    update();
  }
  // Precision is generated from the same descriptors used by DSP and presets.
  const details=document.createElement('details'); details.id='precision';
  const summary=document.createElement('summary'); summary.textContent='Precision';details.append(summary);
  const bank=document.createElement('div');bank.className='controls';
  for(const p of parameters) {
    const label=document.createElement('label');label.className='control';
    const line=document.createElement('span'),name=document.createElement('span'),out=document.createElement('output');name.textContent=p.name;out.dataset.value=p.id;line.append(name,out);
    const input=document.createElement('input');input.type='range';input.min=p.mapping===2?p.min:0;input.max=p.mapping===2?p.max:1000;input.step=1;input.dataset.param=p.id;input.setAttribute('aria-label',p.name);
    input.addEventListener('pointerdown',e=>{if(!begin(e,'precision',{id:p.id}))e.preventDefault();});
    input.addEventListener('input',()=>{if(gesture&&!(gesture.type==='precision'&&gesture.id===p.id))return;const before=state(),next=[...getValues()];next[p.id]=p.mapping===2?Number(input.value):([4,5,7].includes(p.id)?timeValue:physical)(p.id,Number(input.value)/1000);apply(next);if(!gesture)commit(before);});
    bindCompletion(input);label.append(line,input);bank.append(label);
  }
  details.append(bank);$('parameters').replaceChildren(details);
  for(const id of [19,20]) {
    if(!parameters[id])continue;
    const label=document.createElement('label');label.className='wave-choice';
    const name=document.createElement('span');name.textContent=id===19?'Osc 1':'Osc 2';
    const chooser=document.createElement('select');chooser.dataset.waveosc=id;chooser.setAttribute('aria-label',`Oscillator ${id===19?1:2} waveform`);
    for(const [value,text]of waveNames.entries()){const option=document.createElement('option');option.value=value;option.textContent=text;chooser.append(option);}
    chooser.addEventListener('change',()=>{if(gesture){update();return;}const before=state(),next=[...getValues()];next[id]=Number(chooser.value);apply(next);commit(before);});
    label.append(name,chooser);$('waveforms').append(label);
  }
  const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 420 210');svg.setAttribute('aria-label','Sound shape editor');
  $('shape-surface').replaceChildren(svg);
  function node(tag,attrs={},text) {const el=document.createElementNS(svgNS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text)el.textContent=text;svg.append(el);return el;}
  const x0=18,yTop=29,yBottom=169;
  function geometry() {return {a:54+timeUnit(4)*70,d:170+timeUnit(5)*74,r:326+timeUnit(7)*74,sy:yBottom-getValues()[6]*(yBottom-yTop)};}
  const curve=(x,y,endX,endY,bend)=>Array.from({length:33},(_,i)=>{const p=i/32;return `${i?'L':'M'}${x+(endX-x)*p},${y+(endY-y)*Math.pow(p,2**bend)}`;}).join(' ');
  function hit(attrs,label,x,y) {const matrix=svg.getScreenCTM(),sx=matrix?.a||1,sy=matrix?.d||1;node('ellipse',{cx:x,cy:y,rx:5/sx,ry:5/sy,class:'plot-handle'});const h=node('ellipse',{cx:x,cy:y,rx:Math.max(24,22/sx),ry:Math.max(24,22/sy),class:'plot-hit',tabindex:0,role:'slider','aria-label':label,...attrs});h.setAttribute('aria-valuemin','0');h.setAttribute('aria-valuemax','100');return h;}
  function draw() {
    svg.replaceChildren();node('title',{},titles[module]);
    for(const y of [29,99,169])node('path',{d:`M18 ${y}H402`,class:'plot-grid'});
    if(module==='envelope') {
      const g=geometry(),v=getValues();
      const segments=[['attack',18,yBottom,g.a,yTop,v[8]],['decay',g.a,yTop,g.d,g.sy,v[9]],['release',276,g.sy,g.r,yBottom,v[10]]];
      for(const[name,x,y,ex,ey,b]of segments) {
        const d=curve(x,y,ex,ey,b);node('path',{d,class:'plot-line'});
        const midX=(x+ex)/2,midY=y+(ey-y)*Math.pow(.5,2**b);
        node('path',{d,class:'curve-hit','data-bend':name,tabindex:0,role:'slider','aria-label':name+' curve','aria-valuemin':'-2','aria-valuemax':'2','aria-valuenow':b,'aria-valuetext':format({attack:8,decay:9,release:10}[name])});
        node('circle',{cx:midX,cy:midY,r:3,class:'curve-dot'});
      }
      node('path',{d:`M${g.d} ${g.sy}H276`,class:'plot-line'});
      hit({'data-handle':'attack','aria-valuenow':norm(4)*100,'aria-valuetext':format(4)},'Attack time',g.a,yTop);
      hit({'data-handle':'decay','aria-valuenow':norm(5)*100,'aria-valuetext':format(5)+', sustain '+format(6)},'Decay time and sustain level',g.d,g.sy);
      hit({'data-handle':'release','aria-valuenow':norm(7)*100,'aria-valuetext':format(7)},'Release time',g.r,yBottom);
      for(const[label,x,id]of [['A',54,4],['D',166,5],['S',270,6],['R',368,7]])node('text',{x,y:201,class:'plot-label','text-anchor':'middle'},label+' '+format(id));
    } else if(module==='tone') {
      const cutoff=getValues()[11],rate=48000,alpha=1-Math.exp(-2*Math.PI*Math.min(cutoff,rate*.45)/rate),points=[];
      for(let i=0;i<=96;i++){const f=20*1000**(i/96),w=2*Math.PI*f/rate,mag=alpha/Math.sqrt(1+(1-alpha)**2-2*(1-alpha)*Math.cos(w));points.push(`${i?'L':'M'}${18+i*4},${29+clamp(-20*Math.log10(mag)/60)*140}`);}
      node('path',{d:points.join(' '),class:'plot-line'});
      hit({'data-handle':'tone','aria-valuenow':norm(11)*100,'aria-valuetext':format(11)},'Cutoff and oscillator mix',18+norm(11)*384,169-norm(1)*140);
      node('text',{x:18,y:201,class:'plot-label'},'20 Hz');node('text',{x:402,y:201,class:'plot-label','text-anchor':'end'},'20 kHz');
    } else if(module==='drop'&&sauce==='drive') {
      const drive=getValues()[12],points=[];
      for(let i=0;i<=96;i++){const x=-1+2*i/96;points.push(`${i?'L':'M'}${18+i*4},${99-Math.tanh(x*drive)*70}`);}
      node('path',{d:points.join(' '),class:'plot-line'});
      node('text',{x:18,y:201,class:'plot-label'},'Soft drive');node('text',{x:402,y:201,class:'plot-label','text-anchor':'end'},format(12));
    } else if(module==='drop') {
      const v=getValues(),end=100+norm(16)*290,start=169-norm(15)*140,d=curve(18,start,end,169,v[17]);
      node('path',{d:d+` L402 169`,class:'plot-line'});
      node('path',{d,class:'curve-hit','data-bend':'drop',tabindex:0,role:'slider','aria-label':'Pitch drop curve','aria-valuemin':'-2','aria-valuemax':'2','aria-valuenow':v[17]});
      hit({'data-handle':'drop','aria-valuenow':norm(16)*100,'aria-valuetext':format(16)},'Pitch drop fall time',end,169);
      node('text',{x:18,y:201,class:'plot-label'},'+'+format(15));node('text',{x:402,y:201,class:'plot-label','text-anchor':'end'},format(16)+' → played note');
    } else {
      const n=characterN(),x=210,y=99,radius=24+n*54;
      node('ellipse',{cx:x,cy:y,rx:radius*1.9,ry:radius,fill:'none',class:'plot-line'});
      node('path',{d:`M${x-150} ${y}H${x+150}`,class:'plot-grid'});
      hit({'data-handle':'character','aria-valuenow':n*100,'aria-valuetext':Math.round(n*100)+'%'},'Character amount',x+radius*1.9,y);
      node('text',{x:210,y:201,class:'plot-label','text-anchor':'middle'},'Drift ±'+format(13)+' · '+format(14)+' · Warmth '+format(12));
    }
  }
  function position(e) {return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
  svg.addEventListener('pointerdown',e=>{
    const target=e.target.closest('[data-handle],[data-bend]');if(!target)return;e.preventDefault();
    const p=position(e);begin(e,'shape',{handle:target.dataset.handle,bend:target.dataset.bend,start:p,fine:e.shiftKey});
  });
  svg.addEventListener('pointermove',e=>{
    if(gesture?.type!=='shape'||gesture.pointer!==e.pointerId)return;
    const p=position(e),next=[...getValues()],g=gesture;
    if(g.bend){const id={attack:8,decay:9,release:10,drop:17}[g.bend];const direction=g.bend==='attack'?-1:1;next[id]=clamp(g.before.values[id]+direction*(g.start.y-p.y)/45,-2,2);}
    else if(['attack','decay','release'].includes(g.handle)){
      const id={attack:4,decay:5,release:7}[g.handle],delta=(e.clientX-g.x)/(svg.getBoundingClientRect().width*1.2)*(g.fine?.2:1);
      next[id]=timeValue(id,timeUnit(id,g.before.values[id])+delta);
      if(g.handle==='decay')next[6]=clamp((169-p.y)/140);
    }
    else if(g.handle==='tone'){next[11]=physical(11,(p.x-18)/384);next[1]=clamp((169-p.y)/140);}
    else if(g.handle==='drop')next[16]=physical(16,(p.x-100)/290);
    else if(g.handle==='character')character(clamp(readRecipe(characterRecipe,g.before.values).amount+(p.x-g.start.x)/100),next);
    apply(next);
  });
  svg.addEventListener('keydown',e=>{
    if(gesture||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    const target=e.target.closest('[data-handle],[data-bend]');if(!target)return;e.preventDefault();
    const before=state(),next=[...getValues()],positive=['ArrowUp','ArrowRight'].includes(e.key),step=e.shiftKey?.1:.01;
    const id=target.dataset.bend?{attack:8,decay:9,release:10,drop:17}[target.dataset.bend]:{attack:4,decay:5,release:7,tone:11,drop:16}[target.dataset.handle];
    if(id!==undefined){const timing=[4,5,7].includes(id);next[id]=(timing?timeValue:physical)(id,e.key==='Home'?0:e.key==='End'?1:(timing?timeUnit(id):norm(id))+(positive?step:-step));}
    else character(e.key==='Home'?0:e.key==='End'?1:characterN()+(positive?step:-step),next);
    apply(next);commit(before);
    svg.querySelector(target.dataset.bend?`[data-bend="${target.dataset.bend}"]`:`[data-handle="${target.dataset.handle}"]`)?.focus();
  });
  bindCompletion(svg);
  $('volume-toggle').addEventListener('click',()=>{const open=$('volume-panel').hidden;$('volume-panel').hidden=!open;$('volume-toggle').setAttribute('aria-expanded',String(open));});
  $('volume-range').addEventListener('pointerdown',e=>{if(!begin(e,'volume'))e.preventDefault();});
  $('volume-range').addEventListener('input',()=>{if(gesture&&gesture.type!=='volume')return;const before=state(),next=[...getValues()];next[0]=Number($('volume-range').value)/100;apply(next);if(!gesture)commit(before);});
  bindCompletion($('volume-range'));
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#volume-panel,#volume-toggle')){$('volume-panel').hidden=true;$('volume-toggle').setAttribute('aria-expanded','false');}});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){cancel();$('volume-panel').hidden=true;$('volume-toggle').setAttribute('aria-expanded','false');}});window.addEventListener('blur',cancel);
  $('undo').addEventListener('click',()=>{cancel();const before=history.pop();if(before){preset=before.preset;apply(before.values,false);}$('undo').disabled=!history.length;});
  function loadPatch(next,name='custom') {cancel();const before=state();releaseVoices();preset=name;apply(next,false);commit(before);}
  if(!$('presets').querySelector('[value="custom"]')){const option=document.createElement('option');option.value='custom';option.textContent='Custom patch';option.disabled=true;$('presets').append(option);}
  $('presets').addEventListener('change',e=>loadPatch(factoryPatch(e.target.value,parameters),e.target.value));
  $('init').addEventListener('click',()=>loadPatch(parameters.map(p=>p.default)));
  for(const button of document.querySelectorAll('#module-tabs [data-module]'))button.addEventListener('click',()=>select(button.dataset.module));
  for(const button of document.querySelectorAll('[data-sauce]'))button.addEventListener('click',()=>{sauce=button.dataset.sauce;select('drop');});
  function update() {
    for(const p of parameters){const input=document.querySelector(`[data-param="${p.id}"]`);input.value=p.mapping===2?getValues()[p.id]:Math.round(([4,5,7].includes(p.id)?timeUnit: norm)(p.id)*1000);input.setAttribute('aria-valuetext',format(p.id));document.querySelector(`[data-value="${p.id}"]`).textContent=format(p.id);}
    for(const chooser of document.querySelectorAll('[data-waveosc]'))chooser.value=getValues()[Number(chooser.dataset.waveosc)];
    $('volume-range').value=Math.round(getValues()[0]*100);$('volume-value').textContent=Math.round(getValues()[0]*100)+'%';$('volume-toggle').setAttribute('aria-label','Volume '+Math.round(getValues()[0]*100)+'%');
    for(const dial of document.querySelectorAll('[data-knob]')){const id=dial.dataset.knob,n=knobN(id),text=id==='character'?(characterCustom()?'Custom · ':'')+Math.round(n*100)+'%':format(Number(id));dial.style.setProperty('--rotation',(-135+n*270)+'deg');dial.setAttribute('aria-valuenow',String(Math.round(n*100)));dial.setAttribute('aria-valuetext',text);document.querySelector(`[data-knob-value="${id}"]`).textContent=text;}
    $('presets').value=preset;
    $('value-summary').textContent=module==='tone'?format(11)+' · mix '+format(1):module==='envelope'?'New notes':module==='drop'?(sauce==='drive'?format(12):'+'+format(15)):characterCustom()?'Custom':Math.round(characterN()*100)+'%';
    draw();
    onViewChange();
  }
  // Factory selection changes the patch, not the captured performance.
  applyValues(factoryPatch('velvet',parameters)); select('tone');
  return {update,loadPatch,cancel};
}
