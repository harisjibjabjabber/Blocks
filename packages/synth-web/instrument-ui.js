import {characterRecipe,motionRecipe,applyRecipe,readRecipe} from './recipes.js';
import {factoryPatch} from './presets.js';
import {timeFromUnit,timeToUnit} from './envelope-scale.js';
import {envelopeGeometry} from './envelope-geometry.js';
import {DEFAULT_PERFORMANCE,normalizePerformance,curlPhase,performanceSteps} from './performance-state.js';
import {createPerformanceUI} from './performance-ui.js';
// The instrument surface owns gestures, never voices or the audio clock.
export function createInstrumentUI({ parameters, getValues, applyValues, releaseVoices, getPerformance, applyPerformance, onViewChange=()=>{} }) {
  let localPerformance={...DEFAULT_PERFORMANCE};
  getPerformance??=()=>localPerformance;
  applyPerformance??=next=>{localPerformance={...next};};
  const performance=()=>normalizePerformance(getPerformance());
  const $ = id => document.getElementById(id);
  const history = [];
  let module = 'tone', sauce = 'drive', envelopeTarget='amp', gesture = null, preset = 'velvet';
  const svgNS = 'http://www.w3.org/2000/svg';
  const waveNames = ['Sine','Triangle','Saw','Pulse','Square'];
  const timingIds=[4,5,7,25,26,28];
  const envelopeSpec=()=>envelopeTarget==='filter'?{attack:25,decay:26,sustain:27,release:28,bends:{attack:29,decay:30,release:31}}:{attack:4,decay:5,sustain:6,release:7,bends:{attack:8,decay:9,release:10}};
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
    if ([...timingIds,16,33].includes(id)) return value < 1 ? Math.round(value * 1000) + ' ms' : value.toFixed(2) + ' s';
    if (id === 11) return value < 1000 ? Math.round(value) + ' Hz' : (value / 1000).toFixed(1) + ' kHz';
    if ([0,1,6,18,21,22,23,27,34].includes(id)) return Math.round(value * 100) + '%';
    if(id===24)return (value>0?'+':'')+Number(value.toFixed(1))+' st';
    if ([8,9,10,17,29,30,31].includes(id)) return Math.abs(value) < .01 ? 'Linear' : (value > 0 ? '+' : '') + value.toFixed(2);
    return Number(value.toFixed(id === 14 ? 2 : 1)) + (id === 14 ? ' Hz' : id === 12 ? '×' : id === 3 ? '' : ' ct');
  };
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const state = () => ({values: [...getValues()], performance:performance(), preset});
  const restorePerformance=next=>{if(JSON.stringify(next)!==JSON.stringify(performance()))applyPerformance(next);};
  function commit(before) {
    if (!same(before.values, getValues()) || JSON.stringify(before.performance)!==JSON.stringify(performance())) { history.push(before); if (history.length > 40) history.shift(); }
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
    gesture = null; preset = before.preset; restorePerformance(before.performance); apply(before.values, false);
  }
  function begin(e, type, data = {}) {
    if (gesture || (e.button !== undefined && e.button !== 0)) return false;
    gesture = {type, pointer: e.pointerId, before: state(), x: e.clientX, y: e.clientY, ...data};
    e.currentTarget.setPointerCapture(e.pointerId);
    return true;
  }
  function finish(e) {
    if (gesture?.pointer !== e.pointerId) return;
    const before = gesture.before; gesture = null; commit(before); update();
  }
  function bindCompletion(target) {
    target.addEventListener('pointerup', finish);
    target.addEventListener('pointercancel', e => { if (gesture?.pointer === e.pointerId) cancel(); });
    target.addEventListener('lostpointercapture', e => { if (gesture?.pointer === e.pointerId) cancel(); });
  }
  function character(n, values) {const next=applyRecipe(characterRecipe,n,values);for(const t of characterRecipe.targets)values[t.id]=next[t.id];}
  const characterN = () => readRecipe(characterRecipe,getValues()).amount;
  const characterCustom = () => readRecipe(characterRecipe,getValues()).custom;
  const motionN=()=>readRecipe(motionRecipe,getValues()).amount;
  const motionCustom=()=>readRecipe(motionRecipe,getValues()).custom;
  function closeMotion(focus=false){$('motion-details').hidden=true;$('motion-details-toggle').setAttribute('aria-expanded','false');if(focus&&module==='character')$('motion-details-toggle').focus();}
  function changeKnob(id, n) {
    const next = [...getValues()];
    if(id==='character')character(clamp(n),next);
    else if(id==='motion'){const changed=applyRecipe(motionRecipe,clamp(n),next);for(const t of motionRecipe.targets)next[t.id]=changed[t.id];}
    else next[id] = physical(Number(id), n);
    apply(next);
  }
  const knobN = id => id === 'character' ? characterN() : id==='motion'?motionN():norm(Number(id));
  function knob(id, name, mini=false) {
    const container=document.createElement('div'); container.className=mini?'osc-level-control':'macro';
    const button=document.createElement('button'); button.type='button';button.className=mini?'dial osc-mini-dial':'dial'; button.dataset.knob=id;
    if(mini)button.dataset.osclevel=id;
    button.setAttribute('role','slider'); button.setAttribute('aria-label',name);
    button.setAttribute('aria-valuemin','0'); button.setAttribute('aria-valuemax','100');
    const face=document.createElement('span');face.className='dial-face';face.setAttribute('aria-hidden','true');
    const needle=document.createElement('span'); needle.className='dial-needle';face.append(needle);button.append(face);
    const label=document.createElement('span'); label.className=mini?'mini-mix-label':'macro-name'; label.textContent=mini?'Mix':name;
    const value=document.createElement('output'); value.className=mini?'mix-value':'macro-value'; value.dataset.knobValue=id;
    button.addEventListener('pointerdown', e => {e.preventDefault();begin(e,'knob',{id,base:knobN(id),fine:e.shiftKey});});
    button.addEventListener('pointermove', e => {if(gesture?.type==='knob'&&gesture.pointer===e.pointerId)changeKnob(id,gesture.base+(gesture.y-e.clientY)/180*(gesture.fine?.1:1));});
    button.addEventListener('keydown', e => {
      if(gesture || !['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(e.key))return;
      e.preventDefault();const before=state(); const step=e.shiftKey?.001:.01;
      changeKnob(id,e.key==='Home'?0:e.key==='End'?1:knobN(id)+(['ArrowUp','ArrowRight'].includes(e.key)?step:-step));commit(before);
    });
    bindCompletion(button);if(mini){button.prepend(label);button.append(value);container.append(button);}else container.append(button,label,value);return container;
  }
  const macros={tone:[[11,'Cutoff'],[23,'Filter mix'],['character','Character']],envelope:[['character','Character']],character:[['character','Character'],['motion','Motion']],drop:[[15,'Amount'],[16,'Fall time'],['character','Character']]};
  if(parameters[18]) {macros.character.push([18,'Fullness']);}
  const titles={tone:'Oscillator + filter',envelope:'Amplitude envelope',character:'Character',drop:'Pitch Drop'};
  const descriptions={tone:'Across: cutoff · up/down: filter mix',envelope:'Drag points or stage labels · bend curves for shape',character:'Motion range is open for calibration · settling reacts to new notes',drop:'Per-note pitch fall · drag the curve to bend · new notes'};
  function select(next) {
    cancel(); module=next;
    document.querySelector('.instrument').dataset.module=module;
    document.querySelector('.instrument').dataset.envelope=envelopeTarget;
    document.querySelector('.instrument').dataset.sauce=sauce;
    closeOsc(false);
    closeMotion(false);$('motion-details-toggle').hidden=module!=='character';
    $('waveforms').hidden=module!=='tone'||!parameters[19];
    $('scope-wrapper').hidden=module!=='tone';
    $('sauce-tabs').hidden=module!=='drop';
    $('envelope-tabs').hidden=module!=='envelope';
    const isPerformance=module==='drop'&&sauce==='arp';
    $('performance-panel').hidden=!isPerformance;$('shape-surface').hidden=isPerformance;
    $('macros').hidden=isPerformance;$('module-description').hidden=isPerformance;
    for(const b of document.querySelectorAll('[data-envelope]'))if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.envelope===envelopeTarget));
    for(const b of document.querySelectorAll('[data-sauce]'))b.setAttribute('aria-pressed',String(b.dataset.sauce===sauce));
    svg.setAttribute('preserveAspectRatio',module==='tone'?'none':'xMidYMid meet');
    for(const b of document.querySelectorAll('#module-tabs [data-module]')) {const active=b.dataset.module===module;b.setAttribute('aria-pressed',String(active));b.classList.toggle('selected',active);}
    $('module-title').textContent=module==='envelope'?(envelopeTarget==='amp'?'Amplitude envelope':'Filter envelope'):module==='drop'&&sauce==='drive'?'Drive':titles[module]; $('module-description').textContent=module==='drop'&&sauce==='drive'?'Mixer warmth · turn up for more edge':descriptions[module];
    const selected=module==='envelope'&&envelopeTarget==='filter'?[[24,'Filter amount'],[11,'Base cutoff'],['character','Character']]:module==='drop'&&sauce==='drive'?[[12,'Drive'],['character','Character']]:macros[module];
    $('macros').replaceChildren(...(isPerformance?[]:selected.map(([id,name])=>knob(String(id),name))));
    update();
  }
  // Precision is generated from the same descriptors used by DSP and presets.
  const details=document.createElement('details'); details.id='precision';
  const summary=document.createElement('summary'); summary.textContent='Precision';details.append(summary);
  const bank=document.createElement('div');bank.className='controls';
  for(const p of parameters) {
    const label=document.createElement('label');label.className='control';if(p.id===1)label.style.display='none';
    const line=document.createElement('span'),name=document.createElement('span'),out=document.createElement('output');name.textContent=p.name;out.dataset.value=p.id;line.append(name,out);
    const input=document.createElement('input');input.type='range';input.min=p.mapping===2?p.min:0;input.max=p.mapping===2?p.max:1000;input.step=1;input.dataset.param=p.id;input.setAttribute('aria-label',p.name);
    input.addEventListener('pointerdown',e=>{if(!begin(e,'precision',{id:p.id}))e.preventDefault();});
    input.addEventListener('input',()=>{if(gesture&&!(gesture.type==='precision'&&gesture.id===p.id))return;const before=state(),next=[...getValues()];next[p.id]=p.mapping===2?Number(input.value):(timingIds.includes(p.id)?timeValue:physical)(p.id,Number(input.value)/1000);apply(next);if(!gesture)commit(before);});
    bindCompletion(input);label.append(line,input);bank.append(label);
  }
  details.append(bank);$('parameters').replaceChildren(details);
  let oscOpener=null,oscPanel=null;
  const popover=document.createElement('div');popover.id='wave-popover';popover.className='osc-popover';popover.hidden=true;popover.setAttribute('role','group');
  function closeOsc(focus=false){popover.hidden=true;if(oscOpener){oscOpener.setAttribute('aria-expanded','false');if(focus)oscOpener.focus();}oscPanel=null;}
  function openOsc(kind,id,opener){
    if(gesture)return;if(!popover.hidden&&oscOpener===opener){closeOsc(true);return;}
    closeOsc(false);oscOpener=opener;oscPanel={kind,id};opener.setAttribute('aria-expanded','true');popover.replaceChildren();popover.hidden=false;
    if(kind==='wave'){
      popover.setAttribute('aria-label','Oscillator '+(id===19?1:2)+' waveform');
      const options=document.createElement('div');options.className='wave-options';
      for(const[wave,name]of waveNames.entries()){
        const button=document.createElement('button');button.type='button';button.dataset.wave=wave;button.textContent=name;button.setAttribute('aria-pressed',String(getValues()[id]===wave));
        button.addEventListener('click',()=>{const before=state(),next=[...getValues()];next[id]=wave;apply(next);commit(before);closeOsc(true);});options.append(button);
      }
      popover.append(options);options.querySelector('button[aria-pressed=true]')?.focus();
    }
  }
  for(const id of [19,20]){
    const level=id===19?21:22,number=id===19?1:2,row=document.createElement('div');row.className='oscillator-row';
    const wave=document.createElement('button');wave.type='button';wave.className='wave-select-button';wave.dataset.waveosc=id;wave.setAttribute('aria-haspopup','true');wave.setAttribute('aria-controls','wave-popover');wave.setAttribute('aria-expanded','false');
    const label=document.createElement('span');label.className='osc-label';label.textContent='Osc '+number;const name=document.createElement('span');name.className='wave-name';wave.append(label,name);wave.addEventListener('click',()=>openOsc('wave',id,wave));
    const mix=knob(String(level),'Oscillator '+number+' mix',true);
    row.append(wave,mix);$('waveforms').append(row);
  }
  $('waveforms').append(popover);
  const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 420 210');svg.setAttribute('aria-label','Sound shape editor');
  $('shape-surface').replaceChildren(svg);
  function node(tag,attrs={},text) {const el=document.createElementNS(svgNS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text)el.textContent=text;svg.append(el);return el;}
  let yTop=29,yBottom=169;
  let interactionPoints=[],interactionBends=[];
  function geometry(){
    const v=getValues(),spec=envelopeSpec(),scale=svg.getBoundingClientRect().width/420;
    return envelopeGeometry({attack:v[spec.attack],decay:v[spec.decay],sustain:v[spec.sustain],release:v[spec.release],height:svg.viewBox.baseVal.height,footerHeight:44/scale,span:gesture?.type==='shape'?gesture.span:undefined});
  }
  const curve=(x,y,endX,endY,bend)=>Array.from({length:33},(_,i)=>{const p=i/32;return `${i?'L':'M'}${x+(endX-x)*p},${y+(endY-y)*Math.pow(p,2**bend)}`;}).join(' ');
  function hit(attrs,label,x,y){
    const matrix=svg.getScreenCTM(),sx=matrix?.a||1,sy=matrix?.d||1;
    const outside=module==='envelope'&&(x<18||x>402);
    if(!outside)node('ellipse',{cx:x,cy:y,rx:5/sx,ry:5/sy,class:'plot-handle'});
    else node('path',{d:`M${x<18?18:402} ${y-5/sy}l${x<18?7/sx:-7/sx} ${5/sy}l${x<18?-7/sx:7/sx} ${5/sy}`,class:'plot-line'});
    const cx=clamp(x,22/sx,420-22/sx),cy=clamp(y,22/sy,svg.viewBox.baseVal.height-22/sy);
    const h=node('ellipse',{cx,cy,rx:22/sx,ry:22/sy,class:'plot-hit',tabindex:0,role:'slider','aria-label':label,...attrs});
    h.setAttribute('aria-valuemin','0');h.setAttribute('aria-valuemax','100');
    if(module==='envelope')interactionPoints.push({name:attrs['data-handle'],x,y});return h;
  }
  function draw(){
    const box=svg.getBoundingClientRect();if(!box.width||!box.height)return;
    const height=module==='envelope'?420*box.height/box.width:210;
    svg.setAttribute('viewBox',`0 0 420 ${height}`);svg.replaceChildren();node('title',{},module==='envelope'?(envelopeTarget==='filter'?'Filter envelope':'Amplitude envelope'):titles[module]);interactionPoints=[];interactionBends=[];
    const g=module==='envelope'?geometry():null;yTop=g?g.yTop:29;yBottom=g?g.yBottom:169;
    for(const y of [yTop,(yTop+yBottom)/2,yBottom])node('path',{d:`M18 ${y}H402`,class:'plot-grid'});
    if(module==='envelope'){
      const v=getValues(),spec=envelopeSpec(),scale=box.width/420;
      const clip=node('clipPath',{id:'envelope-clip'});const rect=document.createElementNS(svgNS,'rect');for(const[k,value]of Object.entries({x:18,y:yTop-5,width:384,height:yBottom-yTop+10}))rect.setAttribute(k,value);clip.append(rect);
      const segments=[['attack',18,yBottom,g.a,yTop,v[spec.bends.attack]],['decay',g.a,yTop,g.d,g.sy,v[spec.bends.decay]],['release',g.releaseStart,g.sy,g.r,yBottom,v[spec.bends.release]]];
      for(const[name,x,y,ex,ey,bend]of segments){
        const d=curve(x,y,ex,ey,bend);node('path',{d,class:'plot-line','clip-path':'url(#envelope-clip)'});
        const midX=(x+ex)/2,midY=y+(ey-y)*Math.pow(.5,2**bend);
        node('path',{d,class:'curve-hit','data-bend':name,tabindex:0,role:'slider','aria-label':name+' curve','aria-valuemin':-2,'aria-valuemax':2,'aria-valuenow':bend,'clip-path':'url(#envelope-clip)'});
        if(midX>=18&&midX<=402)node('circle',{cx:midX,cy:midY,r:3,class:'curve-dot'});
        interactionBends.push({name,x:midX,y:midY});
      }
      node('path',{d:`M${g.d} ${g.sy}H${g.releaseStart}`,class:'plot-line','clip-path':'url(#envelope-clip)'});
      if(g.releaseStart<402){node('path',{d:`M${g.releaseStart} ${yTop}V${yBottom}`,class:'plot-grid','stroke-dasharray':'3 4'});node('text',{x:g.releaseStart,y:yTop+11,class:'plot-label','text-anchor':'middle',style:`font-size:${8/scale}px`},'Key up');}
      hit({'data-handle':'attack','aria-valuenow':timeUnit(spec.attack)*100,'aria-valuetext':format(spec.attack)},'Attack time',g.a,yTop);
      hit({'data-handle':'decay','aria-valuenow':timeUnit(spec.decay)*100,'aria-valuetext':format(spec.decay)+', sustain '+format(spec.sustain)},'Decay time and sustain level',g.d,g.sy);
      hit({'data-handle':'release','aria-valuenow':timeUnit(spec.release)*100,'aria-valuetext':format(spec.release)},'Release time',g.r,yBottom);
      for(const[name,label,x,id]of[['attack','A',62,spec.attack],['decay','D',162,spec.decay],['sustain','S',262,spec.sustain],['release','R',362,spec.release]]){
        node('rect',{x:x-44,y:g.footerTop,width:88,height:height-g.footerTop,class:'plot-hit','data-handle':name,'data-stage-readout':'true',tabindex:0,role:'slider','aria-label':label+' stage control','aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':norm(id)*100,'aria-valuetext':format(id)});
        node('text',{x,y:g.footerTop+(height-g.footerTop)/2+4/scale,class:'plot-label','text-anchor':'middle',style:`font-size:${10/scale}px`},label+' '+format(id));
      }
    } else if(module==='tone') {
      const cutoff=getValues()[11],filterMix=getValues()[23],rate=48000,alpha=1-Math.exp(-2*Math.PI*Math.min(cutoff,rate*.45)/rate),points=[];
      for(let i=0;i<=96;i++){const f=20*1000**(i/96),w=2*Math.PI*f/rate,denominator=1+(1-alpha)**2-2*(1-alpha)*Math.cos(w),real=alpha*(1-(1-alpha)*Math.cos(w))/denominator,imag=-alpha*(1-alpha)*Math.sin(w)/denominator,mag=Math.hypot(1-filterMix+filterMix*real,filterMix*imag);points.push(`${i?'L':'M'}${18+i*4},${29+clamp(-20*Math.log10(mag)/60)*140}`);}
      node('path',{d:points.join(' '),class:'plot-line'});
      hit({'data-handle':'tone','aria-valuenow':norm(11)*100,'aria-valuetext':format(11)},'Cutoff and filter mix',18+norm(11)*384,169-norm(23)*140);
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
      node('text',{x:210,y:201,class:'plot-label','text-anchor':'middle'},'Tone colour · drive '+format(12));
    }
  }
  function position(e) {return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
  svg.addEventListener('pointerdown',e=>{
    const target=e.target.closest('[data-handle],[data-bend]');if(!target)return;e.preventDefault();
    const p=position(e);let handle=target.dataset.handle,bend=target.dataset.bend;
    const stageReadout=target.dataset.stageReadout==='true';
    if(module==='envelope'&&!stageReadout){
      const m=svg.getScreenCTM(),distance=item=>Math.hypot((p.x-item.x)*m.a,(p.y-item.y)*m.d);
      const point=interactionPoints.toSorted((a,b)=>distance(a)-distance(b))[0],curvePoint=interactionBends.toSorted((a,b)=>distance(a)-distance(b))[0];
      if(point&&distance(point)<=10){handle=point.name;bend=undefined;}
      else if(curvePoint&&distance(curvePoint)<=14){bend=curvePoint.name;handle=undefined;}
    }
    begin(e,'shape',{handle,bend,start:p,fine:e.shiftKey,stageReadout,span:module==='envelope'?geometry().span:undefined});
  });
  svg.addEventListener('pointermove',e=>{
    if(gesture?.type!=='shape'||gesture.pointer!==e.pointerId)return;
    const p=position(e),next=[...getValues()],g=gesture,spec=envelopeSpec();
    if(g.bend){const id=g.bend==='drop'?17:spec.bends[g.bend],direction=g.bend==='attack'?-1:1;next[id]=clamp(g.before.values[id]+direction*(g.start.y-p.y)/45,-2,2);}
    else if(['attack','decay','release'].includes(g.handle)){
      const id=spec[g.handle],delta=(e.clientX-g.x)/(svg.getBoundingClientRect().width*1.2)*(g.fine?.2:1);next[id]=timeValue(id,timeUnit(id,g.before.values[id])+delta);
      if(g.handle==='decay'&&!g.stageReadout)next[spec.sustain]=clamp(g.before.values[spec.sustain]+(g.start.y-p.y)/(yBottom-yTop));
    }else if(g.handle==='sustain')next[spec.sustain]=clamp(g.before.values[spec.sustain]+(g.start.y-p.y)/(yBottom-yTop));
    else if(g.handle==='tone'){next[11]=physical(11,norm(11,g.before.values[11])+(p.x-g.start.x)/384);next[23]=clamp(g.before.values[23]+(g.start.y-p.y)/140);}
    else if(g.handle==='drop')next[16]=physical(16,(p.x-100)/290);
    else if(g.handle==='character')character(clamp(readRecipe(characterRecipe,g.before.values).amount+(p.x-g.start.x)/100),next);
    apply(next);
  });
  svg.addEventListener('keydown',e=>{
    if(gesture||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    const target=e.target.closest('[data-handle],[data-bend]');if(!target)return;e.preventDefault();
    const before=state(),next=[...getValues()],spec=envelopeSpec(),positive=['ArrowUp','ArrowRight'].includes(e.key),step=e.shiftKey?.002:.01;
    const id=target.dataset.bend?(target.dataset.bend==='drop'?17:spec.bends[target.dataset.bend]):({...spec,tone:11,drop:16})[target.dataset.handle];
    if(typeof id==='number'){const timing=timingIds.includes(id);next[id]=(timing?timeValue:physical)(id,e.key==='Home'?0:e.key==='End'?1:(timing?timeUnit(id):norm(id))+(positive?step:-step));}
    else character(e.key==='Home'?0:e.key==='End'?1:characterN()+(positive?step:-step),next);
    apply(next);commit(before);
    svg.querySelector(target.dataset.bend?`[data-bend="${target.dataset.bend}"]`:`[data-handle="${target.dataset.handle}"]`)?.focus();
  });
  bindCompletion(svg);
  $('volume-toggle').addEventListener('click',()=>{const open=$('volume-panel').hidden;$('volume-panel').hidden=!open;$('volume-toggle').setAttribute('aria-expanded',String(open));});
  $('volume-range').addEventListener('pointerdown',e=>{if(!begin(e,'volume'))e.preventDefault();});
  $('volume-range').addEventListener('input',()=>{if(gesture&&gesture.type!=='volume')return;const before=state(),next=[...getValues()];next[0]=Number($('volume-range').value)/100;apply(next);if(!gesture)commit(before);});
  bindCompletion($('volume-range'));
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#volume-panel,#volume-toggle')){$('volume-panel').hidden=true;$('volume-toggle').setAttribute('aria-expanded','false');}if(!e.target.closest('#waveforms'))closeOsc(false);if(!gesture&&!e.target.closest('#motion-details,#motion-details-toggle,.keyboard-section'))closeMotion(false);});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){const editing=!!gesture;cancel();closeOsc(true);if(!editing)closeMotion(true);$('volume-panel').hidden=true;$('volume-toggle').setAttribute('aria-expanded','false');}});window.addEventListener('blur',cancel);
  $('undo').addEventListener('click',()=>{cancel();const before=history.pop();if(before){preset=before.preset;restorePerformance(before.performance);apply(before.values,false);}$('undo').disabled=!history.length;});
  function loadPatch(next,name='custom',settings=DEFAULT_PERFORMANCE) {cancel();closeOsc(false);const before=state();releaseVoices();preset=name;applyPerformance(normalizePerformance(settings));apply(next,false);commit(before);}
  if(!$('presets').querySelector('[value="custom"]')){const option=document.createElement('option');option.value='custom';option.textContent='Custom patch';option.disabled=true;$('presets').append(option);}
  $('presets').addEventListener('change',e=>loadPatch(factoryPatch(e.target.value,parameters),e.target.value));
  $('init').addEventListener('click',()=>loadPatch(parameters.map(p=>p.default)));
  for(const button of document.querySelectorAll('#module-tabs [data-module]'))button.addEventListener('click',()=>select(button.dataset.module));
  for(const button of document.querySelectorAll('[data-sauce]'))button.addEventListener('click',()=>{sauce=button.dataset.sauce;select('drop');});
  for(const button of document.querySelectorAll('#envelope-tabs [data-envelope]'))button.addEventListener('click',()=>{envelopeTarget=button.dataset.envelope;select('envelope');});
  function changePerformance(patch,commitNow=true){if(gesture&&(gesture.type!=='performance'||commitNow))return;const before=state();applyPerformance(normalizePerformance({...performance(),...patch}));preset='custom';update();if(commitNow)commit(before);}
  const performanceUI=createPerformanceUI({container:$('performance-panel'),getPerformance:performance,change:changePerformance,begin,getGesture:()=>gesture,bindCompletion});
  $('mono-toggle').addEventListener('click',()=>changePerformance({mono:!performance().mono}));
  $('motion-controls').replaceChildren(...[[14,'Speed'],[32,'Attack settling'],[33,'Settle time'],[34,'Velocity']].map(([id,name])=>knob(String(id),name)));
  $('motion-details-toggle').addEventListener('click',()=>{if(gesture)return;const open=$('motion-details').hidden;$('motion-details').hidden=!open;$('motion-details-toggle').setAttribute('aria-expanded',String(open));if(open)$('motion-controls').querySelector('[data-knob]').focus();});
  $('motion-details-close').addEventListener('click',()=>{if(!gesture)closeMotion(true);});
  window.addEventListener('resize',()=>{cancel();update();});
  function update() {
    for(const p of parameters){const input=document.querySelector(`[data-param="${p.id}"]`);input.value=p.mapping===2?getValues()[p.id]:Math.round((timingIds.includes(p.id)?timeUnit: norm)(p.id)*1000);input.setAttribute('aria-valuetext',format(p.id));document.querySelector(`[data-value="${p.id}"]`).textContent=format(p.id);}
    for(const chooser of document.querySelectorAll('[data-waveosc]')){const id=Number(chooser.dataset.waveosc),number=id===19?1:2;chooser.querySelector('.wave-name').textContent=format(id);chooser.setAttribute('aria-label','Oscillator '+number+' waveform '+format(id));}

    $('volume-range').value=Math.round(getValues()[0]*100);$('volume-value').textContent=Math.round(getValues()[0]*100)+'%';$('volume-toggle').setAttribute('aria-label','Volume '+Math.round(getValues()[0]*100)+'%');
    for(const dial of document.querySelectorAll('[data-knob]')){const id=dial.dataset.knob,n=knobN(id),text=id==='character'?(characterCustom()?'Custom · ':'')+Math.round(n*100)+'%':id==='motion'?(motionCustom()?'Custom. ':'')+'Drift '+format(13)+', attack settling '+format(32):format(Number(id));dial.style.setProperty('--rotation',(-135+n*270)+'deg');dial.setAttribute('aria-valuenow',String(Math.round(n*100)));dial.setAttribute('aria-valuetext',text);const output=document.querySelector(`[data-knob-value="${id}"]`);if(id==='motion'){output.classList.add('motion-value');const drift=document.createElement('span'),hit=document.createElement('span');drift.textContent='Drift '+format(13);hit.textContent='Hit '+format(32);output.replaceChildren(drift,hit);dial.closest('.macro').querySelector('.macro-name').textContent=motionCustom()?'Motion · Custom':'Motion';}else output.textContent=text;}
    $('presets').value=preset;
    $('value-summary').textContent=module==='tone'?format(11)+' · filter '+format(23):module==='envelope'?(envelopeTarget==='filter'?format(24):'New notes'):module==='drop'?(sauce==='drive'?format(12):'+'+format(15)):characterCustom()?'Custom':Math.round(characterN()*100)+'%';
    if(module==='envelope'&&envelopeTarget==='filter')$('module-description').textContent=getValues()[24]===0?'Raise Filter amount to add movement':'Each note has its own filter envelope';
    const p=performance();$('mono-toggle').setAttribute('aria-pressed',String(p.mono));
    const count=performanceSteps(p);
    const preview=p.mode==='strum'?Array.from({length:4},(_,i)=>i/3*p.strum/100):Array.from({length:count},(_,i)=>curlPhase(i/count,p.curl));
    performanceUI.update(preview);
    draw();
    onViewChange();
  }
  // Factory selection changes the patch, not the captured performance.
  applyValues(factoryPatch('velvet',parameters)); select('tone');
  return {update,updatePerformance:update,setPerformancePending:performanceUI.setPending,loadPatch,cancel};
}
