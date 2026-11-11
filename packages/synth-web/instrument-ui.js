import {createOutputUI} from './output-ui.js';
import {DEFAULT_SOUND,LEGACY_SOUND,normalizeSound} from './sound-state.js';
import {createSourceUI} from './sound-ui.js';
import {createVoicingUI} from './voicing-ui.js';
import {DEFAULT_VOICING,normalizeVoicing} from './voicing-state.js';
import {DEFAULT_FILTER_ROUTING,normalizeFilterRouting} from './filter-routing-state.js';
import {DEFAULT_DELAY,normalizeDelay} from './delay-state.js';
import {resetValue,neutralValues} from './neutral-state.js';
import {configDial} from './config-dial.js';
import {normalizeStereoWidth} from './stereo-state.js';
import {bindDoubleTap,markDialDefault} from './tap-gesture.js';
import {characterRecipe,motionRecipe,applyRecipe,readRecipe} from './recipes.js';
import {factoryPatch} from './presets.js';
import {timeFromUnit,timeToUnit} from './envelope-scale.js';
import {envelopeGeometry} from './envelope-geometry.js';
import {filterResponse} from './filter-response.js';
import {DEFAULT_PERFORMANCE,normalizePerformance,curlPhase,performanceSteps} from './performance-state.js';
import {createPerformanceUI} from './performance-ui.js';
import {createSauceRack} from './sauce-rack-ui.js';
import {createRackEditor} from './rack-editor.js';
import {createLfoUI} from './lfo-ui.js';
import {DEFAULT_RACK,normalizeRack,legacyRack,newSauceBlock,reorderRack,syncRackOrder} from './sauce-state.js';
import {DEFAULT_MODULATION,normalizeModulation,defaultLfo,modulationDestinations} from './modulation-state.js';
// The instrument surface owns gestures, never voices or the audio clock.
export function createInstrumentUI({ parameters, getValues, applyValues, releaseVoices, getPerformance, applyPerformance, getRack, applyRack, getModulation, applyModulation, getSound=()=>DEFAULT_SOUND,applySound=()=>{},getStereoWidth=()=>1,applyStereoWidth=()=>{},getVoicing=()=>DEFAULT_VOICING,applyVoicing=()=>{},getFilterRouting=()=>DEFAULT_FILTER_ROUTING,applyFilterRouting=()=>{},getDelay=()=>DEFAULT_DELAY,applyDelay=()=>{},getSampleRate=()=>48000, onViewChange=()=>{} }) {
  let localPerformance={...DEFAULT_PERFORMANCE};
  getPerformance??=()=>localPerformance;
  applyPerformance??=next=>{localPerformance={...next};};
  const performance=()=>normalizePerformance(getPerformance());
  let localRack=normalizeRack(),localModulation=normalizeModulation();
  getRack??=()=>localRack;applyRack??=next=>{localRack=normalizeRack(next);};
  getModulation??=()=>localModulation;applyModulation??=next=>{localModulation=normalizeModulation(next);};
  const rack=()=>normalizeRack(getRack()),modulation=()=>normalizeModulation(getModulation());
  const $ = id => document.getElementById(id);
  const history = [];
  const modulationPhases=new Map();
  let sauceKeyboard=false;
  let filterDriveControl;
  let module = 'tone', sauce = null, envelopeTarget='amp', gesture = null, preset = 'velvet';
  const svgNS = 'http://www.w3.org/2000/svg';
  const waveNames = ['Sine','Triangle','Saw','Pulse','Square'];
  const sauceTitles={drive:'Drive',drop:'Pitch Drop',fullness:'Fullness',arp:'Arpeggiator',strum:'Strum'};
  const timingIds=[4,5,7,25,26,28];
  const envelopeSpec=()=>envelopeTarget==='filter'?{attack:25,decay:26,sustain:27,release:28,bends:{attack:29,decay:30,release:31}}:{attack:4,decay:5,sustain:6,release:7,bends:{attack:8,decay:9,release:10}};
  const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
  const timeUnit=(id,value=getValues()[id])=>timeToUnit(value,parameters[id].min,parameters[id].max);
  const timeValue=(id,unit)=>timeFromUnit(unit,parameters[id].min,parameters[id].max);
  const norm = (id, value = getValues()[id]) => {
    const p = parameters[id];
    if(id===41)return clamp(Math.sqrt(Math.max(0,value)/p.max));
    return clamp(p.mapping === 1 ? Math.log(value / p.min) / Math.log(p.max / p.min) : (value - p.min) / (p.max - p.min));
  };
  const physical = (id, n) => {
    const p = parameters[id]; n = clamp(n);
    if(id===41)return p.max*n*n;
    const value=p.mapping === 1 ? p.min * Math.pow(p.max / p.min, n) : p.min + (p.max - p.min) * n;
    return p.mapping===2?Math.round(value):value;
  };
  const format = (id, value = getValues()[id]) => {
    if([36,37,39,40].includes(id))return value>=.5?'On':'Off';
    if(id===43)return Math.round(value)===1?'Resonant LP12':'Soft';
    if(id===38)return value>=.5?'Fullness → Drive':'Drive → Fullness';
    if (id===19||id===20) return waveNames[Math.round(value)]||'Unknown';
    if ([...timingIds,16,33,41].includes(id)) return value < 1 ? Math.round(value * 1000) + ' ms' : value.toFixed(2) + ' s';
    if (id === 11) return value < 1000 ? Math.round(value) + ' Hz' : (value / 1000).toFixed(1) + ' kHz';
    if ([0,1,6,18,21,22,23,27,34,35,42].includes(id)) return Math.round(value * 100) + '%';
    if(id===24)return (value>0?'+':'')+Number(value.toFixed(1))+' st';
    if ([8,9,10,17,29,30,31].includes(id)) return Math.abs(value) < .01 ? 'Linear' : (value > 0 ? '+' : '') + value.toFixed(2);
    return Number(value.toFixed(id === 14 ? 2 : 1)) + (id === 14 ? ' Hz' : id === 12 ? '×' : id === 3 ? '' : ' ct');
  };
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const state = () => ({values: [...getValues()], performance:performance(), rack:rack(), modulation:modulation(),stereoWidth:getStereoWidth(),voicing:normalizeVoicing(getVoicing()),filterRouting:normalizeFilterRouting(getFilterRouting()),delay:normalizeDelay(getDelay()),sound:normalizeSound(getSound()), preset});
  const restorePerformance=next=>{if(JSON.stringify(next)!==JSON.stringify(performance()))applyPerformance(next);};
  function commit(before) {
    if (JSON.stringify(before.filterRouting)!==JSON.stringify(getFilterRouting()) || JSON.stringify(before.sound)!==JSON.stringify(getSound()) || JSON.stringify(before.voicing)!==JSON.stringify(getVoicing()) || JSON.stringify(before.delay)!==JSON.stringify(getDelay()) || before.stereoWidth!==getStereoWidth() || !same(before.values, getValues()) || JSON.stringify(before.performance)!==JSON.stringify(performance()) || JSON.stringify(before.rack)!==JSON.stringify(rack()) || JSON.stringify(before.modulation)!==JSON.stringify(modulation())) { history.push(before); if (history.length > 40) history.shift(); }
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
    gesture = null; restore(before);
  }
  function restore(before){preset=before.preset;applyValues(before.values);restorePerformance(before.performance);applyRack(before.rack);applyModulation(before.modulation);applyStereoWidth(before.stereoWidth??1);applyVoicing(normalizeVoicing(before.voicing));applyFilterRouting(normalizeFilterRouting(before.filterRouting));applyDelay(normalizeDelay(before.delay));applySound(normalizeSound(before.sound));update();}
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
  function closeGlide(focus=false){$('glide-panel').hidden=true;$('glide-time-toggle').setAttribute('aria-expanded','false');if(focus&&!$('glide-time-toggle').hidden)$('glide-time-toggle').focus();}
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
    bindCompletion(button);const def=id==='character'||id==='motion'?0:norm(Number(id),resetValue(parameters[Number(id)]));markDialDefault(button,def,id==='character'||id==='motion'?'0%':format(Number(id),resetValue(parameters[Number(id)])));bindDoubleTap(button,()=>{if(gesture)return;const before=state();changeKnob(id,def);commit(before);});if(mini){button.prepend(label);button.append(value);container.append(button);}else container.append(button,label,value);return container;
  }
  function closeFilter(focus=false){const panel=$('filter-mode-options'),button=$('filter-mode-toggle'),wasOpen=panel&&!panel.hidden;if(panel)panel.hidden=true;button?.setAttribute('aria-expanded','false');if(focus&&wasOpen)button?.focus();}
  function filterModeControl(){
    const wrap=document.createElement('div');wrap.className='macro filter-mode-control';
    const button=document.createElement('button');button.id='filter-mode-toggle';button.type='button';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','filter-mode-options');button.setAttribute('aria-haspopup','true');
    const name=document.createElement('span');name.className='filter-mode-name';button.append(name);const label=document.createElement('span');label.className='macro-name';label.textContent='Mode';const value=document.createElement('output');value.className='macro-value';value.id='filter-mode-value';wrap.append(button,label,value);
    const panel=document.createElement('div');panel.id='filter-mode-options';panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-label','Filter mode');
    for(const[mode,title,description]of[[0,'Soft','Gentle · 6 dB/oct'],[1,'Resonant LP12','Resonant · 12 dB/oct'],[2,'Ladder LP24','Nonlinear · 24 dB/oct']]){const choice=document.createElement('button');choice.type='button';choice.dataset.filterMode=mode;const strong=document.createElement('strong');strong.textContent=title;const detail=document.createElement('span');detail.textContent=description;choice.append(strong,detail);choice.addEventListener('click',()=>{if(gesture)return;const before=state(),next=[...getValues()];applySound(normalizeSound({...getSound(),filterModel:mode===2?'ladder':'existing'}));if(mode!==2)next[43]=mode;apply(next);commit(before);closeFilter(true);});panel.append(choice);}
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeFilter(true);}});
    button.addEventListener('click',()=>{if(gesture)return;const open=panel.hidden;closeOsc(false);closeMotion(false);closeGlide(false);panel.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open)panel.querySelector('[aria-pressed=true]')?.focus();});
    wrap.append(panel);return wrap;
  }
  const macros={tone:[[11,'Cutoff'],[42,'Resonance'],[23,'Filter mix']],envelope:[['character','Character']],character:[['character','Character'],['motion','Pitch'],[14,'Speed']],drop:[[15,'Amount'],[16,'Fall time'],['character','Character']]};
  if(parameters[18]) {macros.character.push([18,'Fullness']);}
  const titles={tone:'Oscillator + filter',envelope:'Amplitude envelope',character:'Character',drop:'Sauce',lfo:'LFO'};
  const descriptions={tone:'Across: cutoff · up/down: filter mix',envelope:'Drag points or stage labels · bend curves for shape',character:'Movement follows the amplitude envelope',drop:'Per-note pitch fall · drag the curve to bend · new notes'};
  const visualPanel=document.querySelector('#sound-editor > .visual-panel');
  $('tone-oscillators').append($('waveforms'));
  $('tone-shared').append($('scope-wrapper'));
  function layoutTone(){
    const tone=module==='tone';$('tone-layout').hidden=!tone;visualPanel.hidden=tone;
    if(tone){$('tone-filter').append($('shape-surface'),$('macros'),$('module-description'));}
    else{visualPanel.insertBefore($('shape-surface'),$('performance-panel'));visualPanel.append($('module-description'));$('sound-editor').append($('macros'));}
  }
  function select(next) {
    cancel();rackUI.cancel();closeGlide(false);closeFilter(false); module=next;
    document.querySelector('.instrument').dataset.module=module;
    document.querySelector('.instrument').dataset.envelope=envelopeTarget;
    document.querySelector('.instrument').dataset.sauce=sauce||'none';
    closeOsc(false);
    closeMotion(false);$('motion-details-toggle').hidden=module!=='character';
    $('waveforms').hidden=module!=='tone'||!parameters[19];
    $('scope-wrapper').hidden=module!=='tone';
    $('sauce-rack').hidden=module!=='drop';$('sauce-output').hidden=module!=='drop';
    $('sound-editor').hidden=module==='drop';
    $('sound-editor').setAttribute('aria-label',module==='drop'&&sauce?sauceTitles[sauce]+' settings':'Sound editing');
    $('envelope-tabs').hidden=module!=='envelope';
    const isPerformance=false;
    $('lfo-panel').hidden=module!=='lfo';
    $('performance-panel').hidden=!isPerformance;$('shape-surface').hidden=isPerformance||module==='lfo'||module==='drop';
    $('macros').hidden=isPerformance||module==='lfo';$('module-description').hidden=module==='drop'||module==='lfo';
    for(const b of document.querySelectorAll('[data-envelope]'))if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.envelope===envelopeTarget));
    svg.setAttribute('preserveAspectRatio',module==='tone'?'none':'xMidYMid meet');
    for(const b of document.querySelectorAll('#module-tabs [data-module]')) {const active=b.dataset.module===module;b.setAttribute('aria-pressed',String(active));b.classList.toggle('selected',active);}
    $('module-title').textContent=module==='envelope'?(envelopeTarget==='amp'?'Amplitude envelope':'Filter envelope'):module==='drop'?(sauceTitles[sauce]||'Sauce'):titles[module]; $('module-description').textContent=module==='drop'&&sauce==='drive'?'Mixer warmth · turn up for more edge':descriptions[module];
    const selected=module==='envelope'&&envelopeTarget==='filter'?[[24,'Filter amount'],[11,'Base cutoff'],['character','Character']]:module==='drop'?(sauce==='drive'?[[12,'Drive']]:sauce==='fullness'?[[18,'Fullness']]:sauce==='drop'?[[15,'Amount'],[16,'Fall time']]:[]):(macros[module]||[]);
    $('macros').replaceChildren(...(module==='tone'&&parameters[43]?[filterModeControl()]:[]),...(isPerformance?[]:selected.filter(([id])=>typeof id!=='number'||parameters[id]).map(([id,name])=>knob(String(id),name))));
    $('tone-filter-mode').replaceChildren();if(module==='tone'&&parameters[43])$('tone-filter-mode').append($('macros').querySelector('.filter-mode-control'));
    filterDriveControl=null;if(module==='tone'){filterDriveControl=configDial({begin,getGesture:()=>gesture,bindCompletion,key:'sound:filterDrive',label:'Drive',min:1,max:12,defaultValue:1,getValue:()=>getSound().filterDrive,change:(filterDrive,commit)=>changeConfig(()=>applySound(normalizeSound({...getSound(),filterDrive})),commit),format:v=>Number(v.toFixed(1))+'\u00d7'});filterDriveControl.element.classList.add('sound-filter-drive');$('macros').append(filterDriveControl.element);}
    layoutTone();
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
    closeOsc(false);oscOpener=opener;oscPanel={kind,id};opener.closest('.oscillator-panel').append(popover);opener.setAttribute('aria-expanded','true');popover.replaceChildren();popover.hidden=false;
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
    row.append(wave,mix);
    const panel=document.createElement('section');panel.className='oscillator-panel';panel.dataset.oscillator=number;panel.setAttribute('aria-label','Oscillator '+number);
    const preview=document.createElementNS(svgNS,'svg');preview.classList.add('oscillator-wave-preview');preview.dataset.oscPreview=id;preview.setAttribute('viewBox','0 0 320 112');preview.setAttribute('preserveAspectRatio','none');preview.setAttribute('role','img');
    const caption=document.createElement('div');caption.className='oscillator-preview-caption';caption.textContent='Wave shape';
    const unison=document.createElement('div');unison.id='oscillator-unison-'+number;
    panel.append(row,preview,caption,unison);$('waveforms').append(panel);
  }
  $('waveforms').append(popover);
  const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 420 210');svg.setAttribute('aria-label','Sound shape editor');
  $('shape-surface').replaceChildren(svg);const responseCaption=document.createElement('div');responseCaption.className='filter-response-caption';responseCaption.innerHTML='<span>Base response</span><span id="filter-preview-rate">48 kHz</span>';$('shape-surface').append(responseCaption);
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
    svg.setAttribute('viewBox',`0 0 420 ${height}`);svg.setAttribute('aria-label',module==='envelope'?'Interactive envelope shape':'Sound shape editor');svg.replaceChildren();node('title',{},module==='envelope'?(envelopeTarget==='filter'?'Filter envelope':'Amplitude envelope'):module==='drop'?(sauceTitles[sauce]||'Sauce'):titles[module]);interactionPoints=[];interactionBends=[];
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
      const v=getValues(),rate=getSampleRate()||48000,maxFrequency=Math.min(20000,rate*.49),points=[];
      const ladder=getSound().filterModel==='ladder';
      if(!ladder)for(let i=0;i<=160;i++){const frequency=20*(maxFrequency/20)**(i/160),response=filterResponse({frequency,cutoff:v[11],resonance:v[42]||0,mode:Math.round(v[43]||0),mix:v[23],sampleRate:rate});points.push((i?'L':'M')+(18+i*384/160)+','+(29+(24-clamp(response.db,-60,24))/84*140));}
      node('path',{d:'M18 69H402',class:'plot-grid','stroke-dasharray':'3 4'});
      if(!ladder)node('path',{d:points.join(' '),class:'plot-line','data-filter-response':'true'});
      hit({'data-handle':'tone','aria-valuenow':norm(11)*100,'aria-valuetext':format(11)+', filter mix '+format(23)},'Cutoff and filter mix',18+norm(11)*384,169-norm(23)*140);
      svg.setAttribute('aria-label',ladder?'Ladder LP24 nonlinear filter. Across sets cutoff; up and down sets mix. Response varies with input.':'Base filter response, '+format(43,v[43]||0)+', '+Number((rate/1000).toFixed(1))+' kHz sample rate. Excludes envelope and LFO movement. Vertical range plus24 to minus60 decibels.');
      responseCaption.firstElementChild.textContent=ladder?'Ladder LP24 · nonlinear':'Base response';
      $('shape-surface').dataset.frequencyMax=maxFrequency>=1000?Number((maxFrequency/1000).toFixed(1))+' kHz':Math.round(maxFrequency)+' Hz';
      $('filter-preview-rate').textContent=Number((rate/1000).toFixed(1))+' kHz';
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
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#volume-panel,#volume-toggle')){$('volume-panel').hidden=true;$('volume-toggle').setAttribute('aria-expanded','false');}if(!e.target.closest('#waveforms'))closeOsc(false);if(!e.target.closest('#filter-mode-toggle,#filter-mode-options'))closeFilter(false);if(!gesture&&!e.target.closest('#motion-details,#motion-details-toggle,.keyboard-section'))closeMotion(false);if(!gesture&&!e.target.closest('.keyboard-section'))closeGlide(false);});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){const editing=!!gesture;cancel();closeOsc(true);closeFilter(true);if(!editing){closeMotion(true);closeGlide(true);}$('volume-panel').hidden=true;$('volume-toggle').setAttribute('aria-expanded','false');}});window.addEventListener('blur',cancel);
  $('undo').addEventListener('click',()=>{cancel();rackUI.cancel();const before=history.pop();if(before)restore(before);$('undo').disabled=!history.length;});
  function loadPatch(next,name='custom',settings=DEFAULT_PERFORMANCE,extras={}) {cancel();rackUI.cancel();closeOsc(false);closeFilter(false);lfoUI.close();const before=state();releaseVoices();preset=name;applyValues(next);applyPerformance(normalizePerformance(settings));applyRack(extras.rack?normalizeRack(extras.rack):legacyRack(next,settings));applyModulation(extras.modulation?normalizeModulation(extras.modulation):normalizeModulation());applyStereoWidth(normalizeStereoWidth(extras.stereoWidth));applyVoicing(normalizeVoicing(extras.voicing));applyFilterRouting(normalizeFilterRouting(extras.filterRouting));applyDelay(normalizeDelay(extras.delay));applySound(normalizeSound(extras.sound??(name==='init'?DEFAULT_SOUND:LEGACY_SOUND)));update();commit(before);}
  if(!$('presets').querySelector('[value="custom"]')){const option=document.createElement('option');option.value='custom';option.textContent='Custom patch';option.disabled=true;$('presets').append(option);}
  const initOption=document.createElement('option');initOption.value='init';initOption.textContent='Init';$('presets').prepend(initOption);
  $('presets').addEventListener('change',e=>loadPatch(e.target.value==='init'?neutralValues(parameters):factoryPatch(e.target.value,parameters),e.target.value));
  $('init').addEventListener('click',()=>loadPatch(neutralValues(parameters),'init'));
  for(const button of document.querySelectorAll('#module-tabs [data-module]'))button.addEventListener('click',()=>select(button.dataset.module));
  for(const button of document.querySelectorAll('#envelope-tabs [data-envelope]'))button.addEventListener('click',()=>{envelopeTarget=button.dataset.envelope;select('envelope');});
  function changePerformance(patch,commitNow=true){if(gesture&&(gesture.type!=='performance'||commitNow))return;const before=state();applyPerformance(normalizePerformance({...performance(),...patch}));preset='custom';update();if(commitNow)commit(before);}
  $('mono-toggle').addEventListener('click',()=>changePerformance({mono:!performance().mono}));
  function changeConfig(action,commitNow=true){if(gesture&&(commitNow||!['config','performance'].includes(gesture.type)))return;const before=state();action();preset='custom';update();if(commitNow)commit(before);}
  function getNode(key){const[lane,id]=key.split(':');return lane==='lfo'?modulation().sources.find(n=>n.id===Number(id)):rack()[lane].find(n=>n.id===Number(id));}
  function changeNode(key,patch,commitNow=true){changeConfig(()=>{const[lane,id]=key.split(':');if(lane==='lfo'){const m=modulation();m.sources=m.sources.map(n=>n.id===Number(id)?{...n,...patch}:n);applyModulation(normalizeModulation(m));}else{const r=rack();r[lane]=r[lane].map(n=>n.id===Number(id)?{...n,...patch}:n);applyRack(normalizeRack(r));}},commitNow);}
  const commonControls={parameters,getDestinations:()=>modulationDestinations(parameters,rack(),modulation()),begin,getGesture:()=>gesture,bindCompletion,getPhase:id=>modulationPhases.get(id)??null,getTempo:()=>performance().bpm,changeTempo:delta=>changePerformance({bpm:performance().bpm+delta})};
  const outputUI=createOutputUI({...commonControls,container:$('sauce-output'),getKeyboardVisible:()=>sauceKeyboard,onKeyboardToggle:()=>{sauceKeyboard=!sauceKeyboard;document.querySelector('.instrument').dataset.sauceKeyboard=String(sauceKeyboard);outputUI.update();},getWidth:getStereoWidth,changeWidth:(value,commit)=>changeConfig(()=>applyStereoWidth(value),commit),getDelay,changeDelay:(patch,commit)=>changeConfig(()=>applyDelay(normalizeDelay({...getDelay(),...patch})),commit)});
  const voicingUIs=[0,1].map(oscillator=>createVoicingUI({...commonControls,oscillator,container:$('oscillator-unison-'+(oscillator+1)),getVoicing,changeVoicing:(index,patch,commit)=>changeConfig(()=>{const next=normalizeVoicing(getVoicing());Object.assign(next.oscillators[index],patch);applyVoicing(normalizeVoicing(next));},commit)}));
  const sourceUI=createSourceUI({container:$('tone-source'),getSound,getGesture:()=>gesture,changeSound:(patch,commit)=>changeConfig(()=>applySound(normalizeSound({...getSound(),...patch})),commit)});
  for(const button of document.querySelectorAll('[data-filter-osc]'))button.addEventListener('click',()=>{if(gesture)return;const key=button.dataset.filterOsc;changeConfig(()=>applyFilterRouting(normalizeFilterRouting({...getFilterRouting(),[key]:!getFilterRouting()[key]})),true);});
  $('scope-wrapper').querySelector('.waveform-caption').firstElementChild.textContent='Combined output';
  const rackUI=createSauceRack({container:$('sauce-rack'),canDrag:()=>!gesture,
    createEditor:(item,body,extra)=>createRackEditor({...commonControls,item,body,extra,getNode:()=>getNode(item.key),changeNode:(patch,commit)=>changeNode(item.key,patch,commit)}),
    onToggle:key=>changeNode(key,{enabled:!getNode(key).enabled}),
    onRemove:key=>changeConfig(()=>{const[lane,id]=key.split(':');if(lane==='lfo'){const m=modulation();m.sources=m.sources.filter(n=>n.id!==Number(id));m.sources.forEach(source=>source.routes=source.routes.filter(route=>!(route.kind==='lfo'&&route.targetId===Number(id))));applyModulation(m);applyRack(syncRackOrder(rack(),m));}else{const r=rack();r[lane]=r[lane].filter(n=>n.id!==Number(id));applyRack(r);if(lane==='audio'){const m=modulation();m.sources.forEach(source=>source.routes=source.routes.filter(route=>!(route.kind==='sauce'&&route.targetId===Number(id))));applyModulation(m);}}}),
    onAdd:type=>changeConfig(()=>{if(type==='lfo'){const m=modulation();if(m.sources.length>=4)return;const id=Math.max(...m.sources.map(s=>s.id))+1;m.sources.push({...defaultLfo(id),enabled:true});applyModulation(m);applyRack(syncRackOrder(rack(),m));}else{const r=rack(),lane=['drive','fullness','harmonics'].includes(type)?'audio':'notes';if(r[lane].length>=16)return;r[lane].push(newSauceBlock(r,type));applyRack(r);}}),
    onReorder:keys=>changeConfig(()=>applyRack(reorderRack(rack(),modulation(),keys)))
  });
  const lfoUI=createLfoUI({...commonControls,container:$('lfo-panel'),getSource:()=>getNode('lfo:1'),changeSource:(patch,commit)=>changeNode('lfo:1',patch,commit)});
  $('motion-controls').replaceChildren(...[[32,'Attack settling'],[33,'Settle time'],[34,'Velocity']].map(([id,name])=>knob(String(id),name)));
  $('motion-details-toggle').addEventListener('click',()=>{if(gesture)return;const open=$('motion-details').hidden;$('motion-details').hidden=!open;$('motion-details-toggle').setAttribute('aria-expanded',String(open));if(open){closeGlide(false);$('motion-controls').querySelector('[data-knob]').focus();}});
  $('motion-details-close').addEventListener('click',()=>{if(!gesture)closeMotion(true);});
  if(parameters[41])$('glide-panel').replaceChildren(knob('41','Glide time'));
  $('glide-toggle').addEventListener('click',()=>{if(gesture||!parameters[40])return;const before=state(),next=[...getValues()];next[40]=next[40]>=.5?0:1;apply(next);commit(before);});
  $('glide-time-toggle').addEventListener('click',()=>{if(gesture||!parameters[41])return;const open=$('glide-panel').hidden;$('glide-panel').hidden=!open;$('glide-time-toggle').setAttribute('aria-expanded',String(open));if(open){closeMotion(false);$('glide-panel').querySelector('[data-knob]').focus();}});
  window.addEventListener('resize',()=>{cancel();update();});
  function update() {
    outputUI.update();voicingUIs.forEach(ui=>ui.update());sourceUI.update();for(const button of document.querySelectorAll('[data-filter-osc]')){const on=getFilterRouting()[button.dataset.filterOsc];button.setAttribute('aria-pressed',String(on));button.title=on?'Oscillator passes through Tone filter':'Oscillator bypasses Tone filter; mixer and Sauce remain active';}const ladder=getSound().filterModel==='ladder';document.querySelector('.instrument').dataset.filterModel=module==='tone'&&ladder?'ladder':'existing';if(filterDriveControl){filterDriveControl.element.hidden=!ladder;filterDriveControl.update();}
    for(const p of parameters){const input=document.querySelector(`[data-param="${p.id}"]`);input.value=p.mapping===2?getValues()[p.id]:Math.round((timingIds.includes(p.id)?timeUnit: norm)(p.id)*1000);input.setAttribute('aria-valuetext',format(p.id));document.querySelector(`[data-value="${p.id}"]`).textContent=format(p.id);}
    for(const chooser of document.querySelectorAll('[data-waveosc]')){const id=Number(chooser.dataset.waveosc),number=id===19?1:2;chooser.querySelector('.wave-name').textContent=format(id);chooser.setAttribute('aria-label','Oscillator '+number+' waveform '+format(id));}
    for(const preview of document.querySelectorAll('[data-osc-preview]')){
      const id=Number(preview.dataset.oscPreview),wave=Math.round(getValues()[id]),duty=getValues()[3],shape=t=>wave===0?Math.sin(t*Math.PI*2):wave===1?4*Math.abs(t-.5)-1:wave===2?2*t-1:t<(wave===4?.5:duty)?1:-1;
      preview.setAttribute('aria-label','Oscillator '+(id===19?1:2)+' '+format(id)+' wave shape, illustrative');
      const grid=document.createElementNS(svgNS,'path');grid.setAttribute('d','M8 56H312 M160 10V102');grid.setAttribute('class','oscillator-wave-grid');
      const path=document.createElementNS(svgNS,'path');path.setAttribute('d',Array.from({length:257},(_,i)=>(i?'L':'M')+(8+i/256*304).toFixed(2)+' '+(56-shape(i/256)*38).toFixed(2)).join(' '));path.setAttribute('class','oscillator-wave-line');preview.replaceChildren(grid,path);
    }

    $('volume-range').value=Math.round(getValues()[0]*100);$('volume-value').textContent=Math.round(getValues()[0]*100)+'%';$('volume-toggle').setAttribute('aria-label','Volume '+Math.round(getValues()[0]*100)+'%');
    for(const dial of document.querySelectorAll('[data-knob]')){const id=dial.dataset.knob,n=knobN(id),text=id==='character'?(characterCustom()?'Custom · ':'')+Math.round(n*100)+'%':id==='motion'?(motionCustom()?'Custom. ':'')+'Drift up to '+format(13)+', attack settling up to '+format(32):format(Number(id));dial.style.setProperty('--rotation',(-135+n*270)+'deg');dial.setAttribute('aria-valuenow',String(Math.round(n*100)));dial.setAttribute('aria-valuetext',text);const output=document.querySelector(`[data-knob-value="${id}"]`);if(id==='motion'){output.classList.add('motion-value');const drift=document.createElement('span'),hit=document.createElement('span');drift.textContent='≤ '+format(13);hit.textContent='Hit '+format(32);output.replaceChildren(drift,hit);dial.closest('.macro').querySelector('.macro-name').textContent=motionCustom()?'Pitch · Custom':'Pitch';}else output.textContent=text;}
    const resonant=ladder||Math.round(getValues()[43]||0)===1,modeButton=$('filter-mode-toggle');
    if(modeButton){modeButton.querySelector('.filter-mode-name').textContent=ladder?'Ladder':resonant?'LP12':'Soft';modeButton.setAttribute('aria-label','Filter mode, '+(ladder?'Ladder LP24':resonant?'Resonant LP12':'Soft'));$('filter-mode-value').textContent=ladder?'24 dB/oct':resonant?'12 dB/oct':'6 dB/oct';for(const option of document.querySelectorAll('[data-filter-mode]'))option.setAttribute('aria-pressed',String(Number(option.dataset.filterMode)===(ladder?2:resonant?1:0)));}
    const legacyMode=document.querySelector('[data-param="43"]');legacyMode.disabled=ladder;legacyMode.title=ladder?'Stored legacy mode; choose Soft or LP12 in the filter model selector to use it.':'';
    for(const control of document.querySelectorAll('[data-knob="42"],[data-param="42"]')){control.disabled=!resonant;control.title=resonant?'Resonance':'Choose Resonant LP12 to use resonance; stored amount is retained.';if(!resonant)control.setAttribute('aria-describedby','filter-resonance-help');else control.removeAttribute('aria-describedby');}
    $('presets').value=preset;
    $('value-summary').textContent=module==='tone'?format(11)+' · filter '+format(23):module==='envelope'?(envelopeTarget==='filter'?format(24):'New notes'):module==='drop'?(sauce==='drive'?format(12):'+'+format(15)):characterCustom()?'Custom':Math.round(characterN()*100)+'%';
    if(module==='envelope'&&envelopeTarget==='filter')$('module-description').textContent=getValues()[24]===0?'Raise Filter amount to add movement':'Each note has its own filter envelope';
    if(module==='character')$('module-description').textContent=getValues()[35]>0?'Movement follows the amplitude envelope':'Envelope response off';
    const p=performance();$('mono-toggle').setAttribute('aria-pressed',String(p.mono));
    const glide=parameters[40]&&getValues()[40]>=.5;$('glide-toggle').disabled=!parameters[40];$('glide-toggle').setAttribute('aria-pressed',String(Boolean(glide)));$('glide-time-toggle').hidden=!glide;
    if(parameters[41]){$('glide-time-toggle').textContent=format(41);$('glide-time-toggle').setAttribute('aria-label','Glide time '+format(41));}if(!glide)closeGlide(false);
    rackUI.update({rack:rack(),modulation:modulation()});
    lfoUI.update();
    draw();
    onViewChange();
  }
  // Factory selection changes the patch, not the captured performance.
  preset='init';applyValues(neutralValues(parameters)); select('tone');
  return {update,updatePerformance:update,setModulationPhases:entries=>{modulationPhases.clear();for(const entry of entries||[])if(Number.isFinite(entry.phase)&&entry.phase>=0&&entry.phase<1)modulationPhases.set(entry.id,entry.phase);lfoUI.updatePhase();rackUI.updatePhases();},setPerformancePending:()=>{},setRackPending:rackUI.setPending,loadPatch,cancel};
}
