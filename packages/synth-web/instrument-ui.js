import {characterRecipe,applyRecipe,readRecipe} from './recipes.js';
// The instrument surface owns gestures, never voices or the audio clock.
export function createInstrumentUI({ parameters, getValues, applyValues, releaseVoices }) {
  const $ = id => document.getElementById(id);
  const history = [];
  let module = 'tone', gesture = null, preset = 'velvet';
  const svgNS = 'http://www.w3.org/2000/svg';
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const norm = (id, value = getValues()[id]) => {
    const p = parameters[id];
    return clamp(p.mapping === 1 ? Math.log(value / p.min) / Math.log(p.max / p.min) : (value - p.min) / (p.max - p.min));
  };
  const physical = (id, n) => {
    const p = parameters[id]; n = clamp(n);
    return p.mapping === 1 ? p.min * Math.pow(p.max / p.min, n) : p.min + (p.max - p.min) * n;
  };
  const format = (id, value = getValues()[id]) => {
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
    const bounded = next.map((v, id) => clamp(v, parameters[id].min, parameters[id].max));
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
  const descriptions={tone:'Drag across to open the filter · up for oscillator mix',envelope:'Drag points for timing · bend lines for shape',character:'Character blends warmth + drift · edit each in Precision',drop:'Per-note pitch fall · drag the curve to bend · new notes'};
  function select(next) {
    cancel(); module=next;
    for(const b of document.querySelectorAll('[data-module]')) {const active=b.dataset.module===module;b.setAttribute('aria-pressed',String(active));b.classList.toggle('selected',active);}
    $('module-title').textContent=titles[module]; $('module-description').textContent=descriptions[module];
    $('macros').replaceChildren(...macros[module].map(([id,name])=>knob(String(id),name)));
    update();
  }
  // Precision is generated from the same descriptors used by DSP and presets.
  const details=document.createElement('details'); details.id='precision';
  const summary=document.createElement('summary'); summary.textContent='Precision';details.append(summary);
  const bank=document.createElement('div');bank.className='controls';
  for(const p of parameters) {
    const label=document.createElement('label');label.className='control';
    const line=document.createElement('span'),name=document.createElement('span'),out=document.createElement('output');name.textContent=p.name;out.dataset.value=p.id;line.append(name,out);
    const input=document.createElement('input');input.type='range';input.min=0;input.max=1000;input.step=1;input.dataset.param=p.id;input.setAttribute('aria-label',p.name);
    input.addEventListener('pointerdown',e=>{if(!begin(e,'precision',{id:p.id}))e.preventDefault();});
    input.addEventListener('input',()=>{if(gesture&&!(gesture.type==='precision'&&gesture.id===p.id))return;const before=state(),next=[...getValues()];next[p.id]=physical(p.id,Number(input.value)/1000);apply(next);if(!gesture)commit(before);});
    bindCompletion(input);label.append(line,input);bank.append(label);
  }
  details.append(bank);$('parameters').replaceChildren(details);
  const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 420 210');svg.setAttribute('aria-label','Sound shape editor');
  $('shape-surface').replaceChildren(svg);
  function node(tag,attrs={},text) {const el=document.createElementNS(svgNS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text)el.textContent=text;svg.append(el);return el;}
  const x0=18,yTop=29,yBottom=169;
  function geometry() {return {a:54+norm(4)*70,d:170+norm(5)*74,r:326+norm(7)*74,sy:yBottom-getValues()[6]*(yBottom-yTop)};}
  const curve=(x,y,endX,endY,bend)=>Array.from({length:33},(_,i)=>{const p=i/32;return `${i?'L':'M'}${x+(endX-x)*p},${y+(endY-y)*Math.pow(p,2**bend)}`;}).join(' ');
  function hit(attrs,label,x,y) {node('circle',{cx:x,cy:y,r:7,class:'plot-handle'});const scale=svg.getScreenCTM()?.a||1;const h=node('circle',{cx:x,cy:y,r:Math.max(24,22/scale),class:'plot-hit',tabindex:0,role:'slider','aria-label':label,...attrs});h.setAttribute('aria-valuemin','0');h.setAttribute('aria-valuemax','100');return h;}
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
    const p=position(e);begin(e,'shape',{handle:target.dataset.handle,bend:target.dataset.bend,start:p});
  });
  svg.addEventListener('pointermove',e=>{
    if(gesture?.type!=='shape'||gesture.pointer!==e.pointerId)return;
    const p=position(e),next=[...getValues()],g=gesture;
    if(g.bend){const id={attack:8,decay:9,release:10,drop:17}[g.bend];const direction=g.bend==='attack'?-1:1;next[id]=clamp(g.before.values[id]+direction*(g.start.y-p.y)/45,-2,2);}
    else if(g.handle==='attack')next[4]=physical(4,(p.x-54)/70);
    else if(g.handle==='decay'){next[5]=physical(5,(p.x-170)/74);next[6]=clamp((169-p.y)/140);}
    else if(g.handle==='release')next[7]=physical(7,(p.x-326)/74);
    else if(g.handle==='tone'){next[11]=physical(11,(p.x-18)/384);next[1]=clamp((169-p.y)/140);}
    else if(g.handle==='drop')next[16]=physical(16,(p.x-100)/290);
    else if(g.handle==='character')character(clamp(g.before.values[13]/10+(p.x-g.start.x)/100),next);
    apply(next);
  });
  svg.addEventListener('keydown',e=>{
    if(gesture||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    const target=e.target.closest('[data-handle],[data-bend]');if(!target)return;e.preventDefault();
    const before=state(),next=[...getValues()],positive=['ArrowUp','ArrowRight'].includes(e.key),step=e.shiftKey?.1:.01;
    const id=target.dataset.bend?{attack:8,decay:9,release:10,drop:17}[target.dataset.bend]:{attack:4,decay:5,release:7,tone:11,drop:16}[target.dataset.handle];
    if(id!==undefined)next[id]=physical(id,e.key==='Home'?0:e.key==='End'?1:norm(id)+(positive?step:-step));
    else character(e.key==='Home'?0:e.key==='End'?1:characterN()+(positive?step:-step),next);
    apply(next);commit(before);
    svg.querySelector(target.dataset.bend?`[data-bend="${target.dataset.bend}"]`:`[data-handle="${target.dataset.handle}"]`)?.focus();
  });
  bindCompletion(svg);
  window.addEventListener('keydown',e=>{if(e.key==='Escape')cancel();});window.addEventListener('blur',cancel);
  $('undo').addEventListener('click',()=>{cancel();const before=history.pop();if(before){preset=before.preset;apply(before.values,false);}$('undo').disabled=!history.length;});
  function loadPatch(next,name='custom') {cancel();const before=state();releaseVoices();preset=name;apply(next,false);commit(before);}
  function factory(name) {
    const next=parameters.map(p=>p.default);
    if(name==='velvet'){next[4]=.12;next[5]=.7;next[6]=.72;next[7]=.8;next[11]=2800;next[2]=4;character(.32,next);if(parameters[18])next[18]=.28;}
    if(name==='glass'){next[4]=.004;next[5]=.48;next[6]=.16;next[7]=.45;next[11]=7500;next[1]=.15;next[2]=2;next[9]=-.65;character(.16,next);if(parameters[18])next[18]=.12;}
    if(name==='low'){next[4]=.008;next[5]=.3;next[6]=.68;next[7]=.18;next[11]=680;next[1]=.7;next[2]=-3;character(.6,next);if(parameters[18])next[18]=.5;}
    return next;
  }
  if(!$('presets').querySelector('[value="custom"]')){const option=document.createElement('option');option.value='custom';option.textContent='Custom patch';option.disabled=true;$('presets').append(option);}
  $('presets').addEventListener('change',e=>loadPatch(factory(e.target.value),e.target.value));
  $('init').addEventListener('click',()=>loadPatch(parameters.map(p=>p.default)));
  for(const button of document.querySelectorAll('[data-module]'))button.addEventListener('click',()=>select(button.dataset.module));
  function update() {
    for(const p of parameters){const input=document.querySelector(`[data-param="${p.id}"]`);input.value=Math.round(norm(p.id)*1000);input.setAttribute('aria-valuetext',format(p.id));document.querySelector(`[data-value="${p.id}"]`).textContent=format(p.id);}
    for(const dial of document.querySelectorAll('[data-knob]')){const id=dial.dataset.knob,n=knobN(id),text=id==='character'?(characterCustom()?'Custom · ':'')+Math.round(n*100)+'%':format(Number(id));dial.style.setProperty('--rotation',(-135+n*270)+'deg');dial.setAttribute('aria-valuenow',String(Math.round(n*100)));dial.setAttribute('aria-valuetext',text);document.querySelector(`[data-knob-value="${id}"]`).textContent=text;}
    $('presets').value=preset;
    $('value-summary').textContent=module==='tone'?format(11)+' · mix '+format(1):module==='envelope'?'New notes':module==='drop'?'+'+format(15):characterCustom()?'Custom':Math.round(characterN()*100)+'%';
    draw();
  }
  // Factory selection changes the patch, not the captured performance.
  applyValues(factory('velvet')); select('tone');
  return {update,loadPatch,cancel};
}
