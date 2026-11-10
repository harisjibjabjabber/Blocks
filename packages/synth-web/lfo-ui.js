import {LFO_WAVES,MOD_DIVISIONS,MOD_TARGETS} from './modulation-state.js';
import {configDial} from './config-dial.js';
import {createLfoTimingDial} from './lfo-timing.js';
import {createLfoCurve} from './lfo-curve.js';
export function createLfoUI({container,parameters,getSource,getTempo,changeSource,changeTempo,begin,getGesture,bindCompletion,getPhase=()=>null,instance="main"}) {
  container.className='lfo-panel';const lifecycle=new AbortController();
  container.innerHTML=`<div class="lfo-toolbar"><button type="button" id="lfo-wave-toggle" aria-expanded="false" aria-controls="lfo-wave-options"><span id="lfo-wave-name"></span><span aria-hidden="true">⌄</span></button><button type="button" id="lfo-delete-point" aria-label="Delete selected LFO point" title="Delete selected point" disabled>Delete</button><button type="button" id="lfo-enabled" role="switch" aria-checked="false">Off</button></div><div id="lfo-wave-options" role="group" aria-label="LFO waveform" hidden></div>
    <div id="lfo-curve"></div>
    <div class="lfo-primary-controls"><div id="lfo-rate-slot"></div><div id="lfo-intensity-slot"></div><button type="button" id="lfo-sync" aria-pressed="false">Sync</button><button type="button" id="lfo-retrigger" aria-pressed="false" title="Restart on played or generated note attacks; shared by all voices">Retrigger</button></div>
    <div class="lfo-tempo"><span>Global tempo</span><button type="button" id="lfo-bpm-down" aria-label="Decrease global tempo">−</button><output id="lfo-bpm"></output><button type="button" id="lfo-bpm-up" aria-label="Increase global tempo">+</button></div>
    <details class="lfo-routing"><summary id="lfo-routes-toggle">Routes</summary><div id="lfo-routes" aria-label="Modulation destinations"></div><select id="lfo-add-route" aria-label="Add modulation parameter"></select></details>`;
  for(const el of container.querySelectorAll('[id]')){el.dataset.lfoRef=el.id;if(instance!=='main')el.id=instance+'-'+el.id;}
  const $=s=>container.querySelector(s.startsWith('#')?'[data-lfo-ref="'+s.slice(1).split(' ')[0]+'"]'+s.slice(s.indexOf(' ')<0?s.length:s.indexOf(' ')):s),label=id=>id===0?'Sound level':id===11?'Cutoff':parameters[id]?.name||'Parameter '+id;
  $('#lfo-wave-toggle').setAttribute('aria-controls',$('#lfo-wave-options').id);
  const controlOptions={begin,getGesture,bindCompletion};
  const rate=createLfoTimingDial({...controlOptions,key:instance+':lfo:rate',getSource,changeSource});
  const intensity=configDial({...controlOptions,key:instance+':lfo:intensity',label:'Intensity',getValue:()=>getSource().intensity,change:(intensity,commit)=>changeSource({intensity},commit),format:v=>Math.round(v*100)+'%'});
  $('#lfo-rate-slot').append(rate.element);$('#lfo-intensity-slot').append(intensity.element);
  for(const wave of LFO_WAVES){const button=document.createElement('button');button.type='button';button.dataset.lfoWave=wave;button.textContent=wave[0].toUpperCase()+wave.slice(1);button.addEventListener('click',()=>{if(getGesture())return;changeSource({waveform:wave},true);closeWaves(true);});$('#lfo-wave-options').append(button);}
  function closeWaves(focus=false){$('#lfo-wave-options').hidden=true;$('#lfo-wave-toggle').setAttribute('aria-expanded','false');if(focus)$('#lfo-wave-toggle').focus();}
  $('#lfo-wave-toggle').addEventListener('click',()=>{if(getGesture())return;const open=$('#lfo-wave-options').hidden;$('#lfo-wave-options').hidden=!open;$('#lfo-wave-toggle').setAttribute('aria-expanded',String(open));if(open)$('#lfo-wave-options [aria-pressed=true]')?.focus();});
  $('#lfo-enabled').addEventListener('click',()=>{if(!getGesture())changeSource({enabled:!getSource().enabled},true);});
  $('#lfo-sync').addEventListener('click',()=>{if(!getGesture())changeSource({synced:!getSource().synced},true);});
  $('#lfo-retrigger').addEventListener('click',()=>{if(!getGesture())changeSource({retrigger:!getSource().retrigger},true);});
  const curve=createLfoCurve({...controlOptions,container:$('#lfo-curve'),instance,getSource,changeSource,onSelection:selection=>{$('#lfo-delete-point').disabled=!selection.deletable;}});
  $('#lfo-delete-point').addEventListener('click',()=>curve.removeSelected());
  $('#lfo-bpm-down').addEventListener('click',()=>{if(!getGesture())changeTempo(-1);});$('#lfo-bpm-up').addEventListener('click',()=>{if(!getGesture())changeTempo(1);});
  $('#lfo-add-route').addEventListener('change',e=>{if(getGesture()||e.target.value==='')return;const s=getSource();if(s.routes.length<8)changeSource({routes:[...s.routes,{parameter:Number(e.target.value),depth:.2}]},true);});
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-lfo-ref=lfo-wave-toggle],[data-lfo-ref=lfo-wave-options]'))closeWaves();},{signal:lifecycle.signal});window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#lfo-wave-options').hidden){closeWaves(true);e.preventDefault();}},{signal:lifecycle.signal});
  let routeKey='',routeDials=[];
  function update(){
    const s=getSource();if(!s)return;container.dataset.lfoId=s.id;rate.update();intensity.update();curve.update();curve.setPhase(getPhase(s.id));
    $('#lfo-enabled').setAttribute('aria-label','LFO '+s.id+' enabled');$('#lfo-enabled').setAttribute('aria-checked',String(s.enabled));$('#lfo-enabled').textContent=s.enabled?'On':'Off';$('#lfo-sync').setAttribute('aria-pressed',String(s.synced));$('#lfo-retrigger').setAttribute('aria-pressed',String(Boolean(s.retrigger)));$('#lfo-retrigger').setAttribute('aria-label','Restart shared LFO on played or generated note attacks');$('.lfo-tempo').hidden=!s.synced;$('#lfo-routes-toggle').textContent='Routes · '+s.routes.length;
    $('#lfo-bpm').textContent=Math.round(getTempo())+' BPM';$('#lfo-bpm-down').disabled=getTempo()<=40;$('#lfo-bpm-up').disabled=getTempo()>=240;
    $('#lfo-wave-name').textContent=s.waveform[0].toUpperCase()+s.waveform.slice(1);for(const b of container.querySelectorAll('[data-lfo-wave]'))b.setAttribute('aria-pressed',String(b.dataset.lfoWave===s.waveform));
    const nextKey=s.id+':'+s.routes.map(r=>r.parameter).join(',');
    if(nextKey!==routeKey){routeKey=nextKey;routeDials=[];$('#lfo-routes').replaceChildren();for(const route of s.routes){const row=document.createElement('div');row.className='lfo-route';const title=document.createElement('span');title.textContent=label(route.parameter);const dial=configDial({...controlOptions,key:instance+':lfo:route:'+route.parameter,label:label(route.parameter)+' depth',min:-1,max:1,compact:true,getValue:()=>getSource().routes.find(r=>r.parameter===route.parameter)?.depth||0,change:(depth,commit)=>changeSource({routes:getSource().routes.map(r=>r.parameter===route.parameter?{...r,depth}:r)},commit),format:v=>(v>0?'+':'')+Math.round(v*100)+'%'});dial.button.dataset.lfoRoute=route.parameter;const remove=document.createElement('button');remove.type='button';remove.className='lfo-route-remove';remove.textContent='×';remove.dataset.lfoRemove=route.parameter;remove.setAttribute('aria-label','Remove '+label(route.parameter)+' modulation');remove.addEventListener('click',()=>{if(!getGesture())changeSource({routes:getSource().routes.filter(r=>r.parameter!==route.parameter)},true);});row.append(title,dial.element,remove);$('#lfo-routes').append(row);routeDials.push(dial);}
      $('#lfo-add-route').replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='+ Parameter · '+s.routes.length+'/8';$('#lfo-add-route').append(placeholder);for(const id of MOD_TARGETS.filter(id=>!s.routes.some(r=>r.parameter===id))){const option=document.createElement('option');option.value=id;option.textContent=label(id);$('#lfo-add-route').append(option);}}
    for(const dial of routeDials)dial.update();$('#lfo-add-route').value='';$('#lfo-add-route').disabled=s.routes.length>=8;
  }
  return{update,updatePhase:()=>curve.setPhase(getPhase(getSource().id)),close:closeWaves,destroy:()=>{lifecycle.abort();curve.destroy();}};
}
