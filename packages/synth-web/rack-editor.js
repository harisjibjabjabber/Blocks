import {DEFAULT_CREATIVE_FX_SETTINGS} from './sauce-state.js';
import {configDial} from './config-dial.js';
import {createPerformanceUI} from './performance-ui.js';
import {createLfoUI} from './lfo-ui.js';
import {createLfoTimingDial} from './lfo-timing.js';
import {curlPhase,performanceSteps} from './performance-state.js';
// Each block owns its controls. Closing another card cannot interrupt this instance.
export function createRackEditor({item,body,extra,getNode,changeNode,getModulation,changeSource,openLfo,parameters,getTempo,changeTempo,getPhase,getDestinations,begin,getGesture,bindCompletion}) {
  const dials=[],options={begin,getGesture,bindCompletion};
  function dial(field,label,min,max,format,extraOptions={},target=body){
    const defaults={fullness:{amount:0},drop:{amount:0,time:.12,bend:0},lfo:{intensity:1}};
    const control=configDial({...options,key:item.key+':'+field,label,min,max,defaultValue:DEFAULT_CREATIVE_FX_SETTINGS[item.type]?.[field]??defaults[item.type]?.[field]??0,getValue:()=>getNode()?.[field]??min,change:(value,commit)=>changeNode({[field]:value},commit),format,...extraOptions});target.append(control.element);dials.push(control);return control;
  }
  let performanceUI,lfoUI,contour,curve,updateMovementRoutes;
  const time=v=>v<1?Math.round(v*1000)+' ms':v.toFixed(2)+' s';
  if(item.type==='fullness')dial('amount','Fullness',0,1,v=>Math.round(v*100)+'%');
  else if(item.type==='moving-space'||item.type==='impact'){
    const percent=v=>Math.round(v*100)+'%',db=v=>(v>0?'+':'')+Number(v.toFixed(1))+' dB';
    const described=(field,label,text,target=body)=>{const d=dial(field,label,0,1,percent,{},target);d.button.title=text;d.button.setAttribute('aria-description',text);return d;};
    described('mix','Mix','Blend the processed sound with the dry signal.');
    if(item.type==='moving-space'){
      const env=dial('motion','Env',-1,1,v=>(v>0?'+':'')+Math.round(v*100)+'%');env.button.title='Signed sound-reactive movement; negative values reverse its direction.';env.button.setAttribute('aria-description',env.button.title);
      described('space','Space','Size and decay of the short reverberant space.');
      described('shimmer','Shimmer','Amount of the pitch-shifted wash.',extra);
      const pitch=dial('pitch','Pitch',-12,12,v=>(v>0?'+':'')+Number(v.toFixed(1))+' st',{},extra);pitch.button.title='Pitch interval of the shimmer wash.';
    }else{
      described('tight','Tight','Contain the body with hard compression.');
      described('click','Click','Accent the upper transient of the incoming sound.');
      const bodyDial=described('body','Body','Balance the low foundation; 50% is neutral.');bodyDial.button.title='Low foundation balance; 50% is neutral.';
    }
    dial('outputDb','Trim',-24,12,db,{},extra);
  }else if(item.type==='drop'){
    dial('amount','Amount',0,2400,v=>Math.round(v)+' ct');
    dial('time','Fall',.001,4,time,{toUnit:v=>Math.log(v/.001)/Math.log(4000),fromUnit:n=>.001*4000**n});
    dial('bend','Curve',-2,2,v=>Math.abs(v)<.01?'Linear':(v>0?'+':'')+v.toFixed(2),{},extra);
  }else if(item.type==='arp'||item.type==='strum'){
    performanceUI=createPerformanceUI({container:body,getPerformance:()=>getNode().performance,change:(patch,commit=true)=>changeNode({performance:{...getNode().performance,...patch}},commit),...options,instance:item.key});

  }else if(item.type==='lfo'){
    const rate=createLfoTimingDial({...options,key:item.key+':rate',getSource:getNode,changeSource:changeNode});body.append(rate.element);dials.push(rate);
    dial('intensity','Intensity',0,1,v=>Math.round(v*100)+'%');
    const badge=document.createElement('span');badge.className='rack-route-badge';body.append(badge);
    const panel=document.createElement('div');extra.append(panel);lfoUI=createLfoUI({container:panel,parameters,getSource:getNode,getTempo,getPhase,getDestinations,changeSource:changeNode,changeTempo,...options,instance:item.key});
    // Rate and Intensity stay on the compact card; deeper view owns routing and sync.
    panel.querySelector('[data-lfo-ref=lfo-rate-slot]').hidden=true;panel.querySelector('[data-lfo-ref=lfo-intensity-slot]').hidden=true;
    curve=()=>{badge.textContent=getNode().routes.length+' routes'+(getNode().synced?' · '+getNode().division:'');};
  }
  if(item.type==='moving-space'){
    const section=document.createElement('section');section.className='fx-lfo-movement';section.dataset.fxLfo=String(item.id);
    const heading=document.createElement('h4');heading.textContent='LFO movement';
    const list=document.createElement('div');list.className='fx-lfo-routes';
    const add=document.createElement('select');add.dataset.fxLfoAdd=String(item.id);add.setAttribute('aria-label','Add shared LFO to Moving Space '+item.id);
    section.append(heading,list,add);extra.append(section);
    const matches=r=>r.kind==='effects'&&r.targetId===item.id&&r.parameter===0;
    const source=id=>getModulation().sources.find(s=>s.id===id);
    const rows=new Map();let pickerKey='';
    add.addEventListener('change',()=>{if(getGesture()||!add.value)return;const s=source(Number(add.value));if(s&&s.routes.length<8&&!s.routes.some(matches))changeSource(s.id,{routes:[...s.routes,{kind:'effects',targetId:item.id,parameter:0,depth:0}]},true);});
    updateMovementRoutes=()=>{
      const sources=getModulation().sources,assigned=sources.filter(s=>s.routes.some(matches));
      for(const[id,row]of rows)if(!assigned.some(s=>s.id===id)){row.element.remove();rows.delete(id);}
      for(const s of assigned){
        if(!rows.has(s.id)){
          const row=document.createElement('div');row.className='fx-lfo-route';row.dataset.fxLfoSource=String(s.id);
          const label=document.createElement('span');label.className='fx-lfo-label';label.textContent='LFO '+s.id+' · Shared';
          const power=document.createElement('button');power.type='button';power.setAttribute('role','switch');power.dataset.fxLfoPower=String(s.id);power.setAttribute('aria-label','Shared LFO '+s.id+' enabled');power.title='Shared source: switching it changes all its routes.';
          power.addEventListener('click',()=>{if(!getGesture()){const current=source(s.id);changeSource(s.id,{enabled:!current.enabled},true);}});
          const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.dataset.fxLfoEdit=String(s.id);edit.setAttribute('aria-label','Edit shared LFO '+s.id);edit.addEventListener('click',()=>{if(!getGesture())openLfo(s.id);});
          const depth=configDial({...options,key:item.key+':lfo:'+s.id+':depth',label:'Depth',min:-1,max:1,defaultValue:0,getValue:()=>source(s.id)?.routes.find(matches)?.depth??0,change:(value,commit)=>{const current=source(s.id);if(current)changeSource(s.id,{routes:current.routes.map(r=>matches(r)?{...r,depth:value}:r)},commit);},format:v=>(v>0?'+':'')+Math.round(v*100)+'%'});
          const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.dataset.fxLfoRemove=String(s.id);remove.setAttribute('aria-label','Remove LFO '+s.id+' movement route');remove.addEventListener('click',()=>{if(!getGesture()){const current=source(s.id);changeSource(s.id,{routes:current.routes.filter(r=>!matches(r))},true);}});
          row.append(label,power,edit,depth.element,remove);list.append(row);rows.set(s.id,{element:row,power,depth});
        }
        const row=rows.get(s.id);row.power.textContent=s.enabled?'On':'Off';row.power.setAttribute('aria-checked',String(s.enabled));row.depth.update();
      }
      const nextKey=sources.map(s=>s.id+':'+s.routes.length+':'+s.routes.some(matches)).join('|');
      if(nextKey!==pickerKey){pickerKey=nextKey;add.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='+ Shared LFO';add.append(placeholder);for(const s of sources.filter(s=>!s.routes.some(matches))){const option=document.createElement('option');option.value=String(s.id);option.textContent='LFO '+s.id+' · '+s.routes.length+'/8 routes';option.disabled=s.routes.length>=8;add.append(option);}add.disabled=!sources.some(s=>!s.routes.some(matches)&&s.routes.length<8);if(add.disabled)placeholder.textContent='No available LFO routes';}
      add.value='';
    };
  }
  if(item.type==='drop'){
    contour=document.createElementNS('http://www.w3.org/2000/svg','svg');contour.setAttribute('viewBox','0 0 180 48');contour.classList.add('rack-contour');contour.setAttribute('aria-label','Pitch fall shape');extra.prepend(contour);
  }
  function update(){const n=getNode();if(!n)return;for(const d of dials)d.update();curve?.();lfoUI?.update();updateMovementRoutes?.();
    if(performanceUI){const p=n.performance,count=performanceSteps(p),preview=item.type==='strum'?Array.from({length:4},(_,i)=>i/3*p.strum/100):Array.from({length:count},(_,i)=>curlPhase(i/count,p.curl));performanceUI.update(preview,item.type);}
    if(contour){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',Array.from({length:65},(_,i)=>{const p=i/64,y=44-(n.amount/2400)*40*(1-Math.pow(p,2**n.bend));return(i?'L':'M')+(4+172*p)+','+y;}).join(' '));contour.replaceChildren(path);}
  }
  return{update,updatePhase:()=>lfoUI?.updatePhase(),destroy:()=>lfoUI?.destroy(),setPending:value=>performanceUI?.setPending(value)};
}
