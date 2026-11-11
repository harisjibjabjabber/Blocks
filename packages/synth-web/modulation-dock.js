import {configDial} from './config-dial.js';
import {createLfoUI} from './lfo-ui.js';
import {createDockEnvelope} from './modulation-envelope.js';
import {routeTargetKey} from './modulation-state.js';

const colours=['#83c9d9','#c9a4ef','#e7bc77','#8dcea1','#ed927c','#c7d87f','#9aaff0'];
const ns='http://www.w3.org/2000/svg';
export function createModulationDock({container,getSources,getSource,changeSource,getRoutes,changeRoutes,getEnvelope,changeEnvelope,getEnvelopeLimits,getDestinations,getTargetForElement,getSourceValue=()=>null,getTargetValue=()=>null,getGesture,begin,bindCompletion,parameters,getTempo,changeTempo,getPhase,onKeyboardToggle}){
  container.className='modulation-dock';container.setAttribute('aria-label','Modulation sources');
  container.innerHTML='<header class="mod-dock-header"><div class="mod-source-tabs" role="group" aria-label="Modulation source"></div><div class="mod-dock-actions"><button type="button" data-mod-matrix aria-expanded="false">Matrix</button><button type="button" data-mod-keyboard>Keyboard</button><button type="button" data-mod-collapse aria-expanded="true" aria-label="Collapse modulation editor">−</button></div></header><div class="mod-dock-status" role="status"></div><div class="mod-quick-route" hidden></div><div class="mod-editor"><div class="mod-lfo-editor"></div><div class="mod-envelope-editor" hidden></div></div><section class="mod-matrix" aria-label="Modulation matrix" hidden><label class="mod-matrix-add"><span></span><select data-mod-add-destination aria-label="Add modulation destination"></select></label><div class="mod-matrix-rows"></div></section>';
  const $=s=>container.querySelector(s),life=new AbortController(),on=(el,event,fn,options={})=>el.addEventListener(event,fn,{...options,signal:life.signal});
  let selected={kind:'env',id:1},armed=null,drag=null,quick=null,expanded=innerWidth>=900,matrixOpen=false,sourceKey='',matrixKey='',quickKey='',destinationKey='';
  const rowControls=[],quickControls=[],sourceButtons=new Map();let telemetry=[];
  let tabWidth=-1;const shell=container.closest('.instrument');
  const layout=()=>{const r=shell.getBoundingClientRect(),c=getComputedStyle(shell),left=r.left+parseFloat(c.paddingLeft)+1,width=r.width-parseFloat(c.paddingLeft)-parseFloat(c.paddingRight)-2;container.style.left=left+'px';container.style.width=width+'px';const dockHeight=container.getBoundingClientRect().height;shell.style.paddingBottom=(dockHeight+20)+'px';document.documentElement.style.setProperty('--mod-dock-height',(dockHeight+16)+'px');const widthNow=$('.mod-source-tabs').clientWidth;if(widthNow!==tabWidth){tabWidth=widthNow;revealSource();}};
  const observer=new ResizeObserver(layout);observer.observe(shell);observer.observe(container);on(window,'resize',layout);
  const eq=(a,b)=>a&&b&&a.kind===b.kind&&a.id===b.id;
  const sourceLabel=s=>getSources().find(x=>eq(x,s))?.label??(s.kind==='lfo'?'LFO ':'Env ')+s.id;
  const color=s=>colours[Math.max(0,getSources().findIndex(x=>eq(x,s)))%colours.length];
  const selectedLfo=()=>getSource('lfo',selected.kind==='lfo'?selected.id:1);
  const lfo=createLfoUI({container:$('.mod-lfo-editor'),parameters,getSource:selectedLfo,changeSource:(p,c)=>changeSource('lfo',selected.id,p,c),getTempo,changeTempo,getPhase,getDestinations:()=>getDestinations('lfo',selected.id),getGesture,begin,bindCompletion,instance:'dock'});
  $('.mod-lfo-editor .lfo-routing').hidden=true;
  const envelope=createDockEnvelope({container:$('.mod-envelope-editor'),getEnvelope:()=>getEnvelope(selected.id),changeEnvelope:(p,c)=>changeEnvelope(selected.id,p,c),getLimits:()=>getEnvelopeLimits(selected.id),getGesture,begin,bindCompletion,getId:()=>selected.id});
  function status(text=''){ $('.mod-dock-status').textContent=text;$('.mod-dock-status').hidden=!text; }
  function cancelAssignment(){armed=null;if(drag){try{drag.handle.releasePointerCapture(drag.pointer);}catch{}drag=null;}document.documentElement.classList.remove('mod-assigning');document.querySelectorAll('[data-mod-hover]').forEach(e=>delete e.dataset.modHover);status();}
  function revealSource(){const bar=$('.mod-source-tabs'),group=sourceButtons.get(selected.kind+':'+selected.id)?.group;if(!group)return;const a=group.getBoundingClientRect(),b=bar.getBoundingClientRect();if(a.left<b.left)bar.scrollLeft-=b.left-a.left;else if(a.right>b.right)bar.scrollLeft+=a.right-b.right;}
  function choose(source){if(getGesture())return;cancelAssignment();if(!eq(source,selected))quick=null;selected={kind:source.kind,id:source.id};expanded=true;matrixOpen=false;update();revealSource();}
  function targetAt(x,y){const e=document.elementFromPoint(x,y)?.closest('[role=slider],input[type=range]');if(!e)return null;const target=getTargetForElement(e);return target&&getDestinations(armed?.kind??selected.kind,armed?.id??selected.id).some(d=>d.key===target.key)?{element:e,target}:null;}
  function assign(source,target){
    const routes=getRoutes(source.kind,source.id);if(!routes.some(r=>routeTargetKey(r)===target.key)){
      if(routes.length>=8){cancelAssignment();status('This source already has eight assignments.');return;}
      changeRoutes(source.kind,source.id,[...routes,{kind:target.kind,targetId:target.targetId,parameter:target.parameter,depth:.1}],true);
    }
    selected={...source};quick={source:{...source},key:target.key};cancelAssignment();expanded=true;update();status('Assigned '+sourceLabel(source)+' to '+target.label+'. '+(source.kind==='lfo'&&!getSource('lfo',source.id).enabled?'Source is Off — enable it below to hear modulation.':'Adjust the signed depth below.'));
  }
  function arm(source){cancelAssignment();selected={...source};armed={...source};document.documentElement.classList.add('mod-assigning');status('Tap a highlighted control to assign '+sourceLabel(source)+'. Escape cancels.');updateTargets();}
  function makeSources(){const sources=getSources(),key=sources.map(s=>s.kind+':'+s.id).join('|');if(key===sourceKey)return;sourceKey=key;$('.mod-source-tabs').replaceChildren();sourceButtons.clear();for(const s of sources){
    const group=document.createElement('div');group.className='mod-source-tab';group.style.setProperty('--mod-colour',color(s));
    const tab=document.createElement('button');tab.type='button';tab.dataset.modSource=s.kind+':'+s.id;tab.textContent=s.label;on(tab,'click',()=>choose(s));
    const handle=document.createElement('button');handle.type='button';handle.className='mod-source-handle';handle.dataset.modHandle=s.kind+':'+s.id;handle.textContent='↗';handle.setAttribute('aria-label','Assign '+s.label+' — drag or tap then choose a control');handle.title='Drag to a control, or tap this handle then tap a control.';
    on(handle,'pointerdown',e=>{if(getGesture()||drag||e.button!==0)return;e.preventDefault();cancelAssignment();selected={kind:s.kind,id:s.id};armed={...selected};drag={pointer:e.pointerId,x:e.clientX,y:e.clientY,moved:false,handle};handle.setPointerCapture(e.pointerId);document.documentElement.classList.add('mod-assigning');status('Drop '+s.label+' on a highlighted control.');updateTargets();});
    on(handle,'pointermove',e=>{if(drag?.pointer!==e.pointerId)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8)drag.moved=true;document.querySelectorAll('[data-mod-hover]').forEach(el=>delete el.dataset.modHover);targetAt(e.clientX,e.clientY)?.element.setAttribute('data-mod-hover','true');});
    on(handle,'pointerup',e=>{if(drag?.pointer!==e.pointerId)return;const moved=drag.moved,source={...armed},hit=targetAt(e.clientX,e.clientY);drag=null;try{handle.releasePointerCapture(e.pointerId);}catch{}if(moved){if(hit)assign(source,hit.target);else cancelAssignment();}else arm(source);});
    on(handle,'pointercancel',cancelAssignment);on(handle,'lostpointercapture',()=>{if(drag)cancelAssignment();});on(handle,'keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();arm(s);}});
    group.append(tab,handle);$('.mod-source-tabs').append(group);sourceButtons.set(s.kind+':'+s.id,{group,tab});
  }}
  on(document,'pointerdown',e=>{if(drag&&e.pointerId!==drag.pointer){cancelAssignment();e.preventDefault();e.stopImmediatePropagation();return;}if(!armed||drag||container.contains(e.target))return;const el=e.target.closest('[role=slider],input[type=range]'),target=el&&getTargetForElement(el);if(target&&getDestinations(armed.kind,armed.id).some(d=>d.key===target.key)){e.preventDefault();e.stopImmediatePropagation();assign({...armed},target);}}, {capture:true});
  on(window,'keydown',e=>{if(e.key==='Escape'&&armed){cancelAssignment();e.preventDefault();e.stopPropagation();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z')cancelAssignment();},{capture:true});on(window,'blur',cancelAssignment);
  on($('[data-mod-collapse]'),'click',()=>{expanded=!expanded;update();});on($('[data-mod-matrix]'),'click',()=>{matrixOpen=!matrixOpen;expanded=true;update();});on($('[data-mod-keyboard]'),'click',()=>onKeyboardToggle?.());
  function routeRow(source,route,target,compact=false,showPower=false){
    const row=document.createElement('div');row.className='mod-matrix-row';row.dataset.modRoute=source.kind+':'+source.id+'>'+routeTargetKey(route);row.style.setProperty('--mod-colour',color(source));
    const title=document.createElement('span');title.className='mod-route-title';title.textContent=sourceLabel(source)+' → '+target.label;
    const control=configDial({begin,getGesture,bindCompletion,key:'route:'+source.kind+':'+source.id+':'+target.key,label:'Depth',min:-1,max:1,defaultValue:0,compact,getValue:()=>getRoutes(source.kind,source.id).find(r=>routeTargetKey(r)===target.key)?.depth??0,change:(depth,c)=>changeRoutes(source.kind,source.id,getRoutes(source.kind,source.id).map(r=>routeTargetKey(r)===target.key?{...r,depth}:r),c),format:v=>(v>0?'+':'')+Math.round(v*100)+'%'});
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+title.textContent);on(remove,'click',()=>{if(!getGesture())changeRoutes(source.kind,source.id,getRoutes(source.kind,source.id).filter(r=>routeTargetKey(r)!==target.key),true);});row.append(title);if(showPower&&source.kind==='lfo'){const power=document.createElement('button');power.type='button';power.setAttribute('role','switch');power.dataset.modRoutePower=String(source.id);power.title='Shared LFO power; affects all this source’s assignments.';power.setAttribute('aria-label','Shared LFO '+source.id+' enabled');on(power,'click',()=>{if(!getGesture())changeSource('lfo',source.id,{enabled:!getSource('lfo',source.id).enabled},true);});row.append(power);row.classList.add('mod-route-with-power');}row.append(control.element,remove);return{row,control};
  }
  on($('[data-mod-add-destination]'),'change',e=>{if(getGesture()||!e.target.value)return;const target=getDestinations(selected.kind,selected.id).find(d=>d.key===e.target.value);if(target&&target.active!==false)assign({...selected},target);});
  function updateRoutes(){
    const all=[];for(const s of getSources()){const dest=getDestinations(s.kind,s.id);for(const r of getRoutes(s.kind,s.id)){const target=dest.find(d=>d.key===routeTargetKey(r));if(target)all.push({source:s,route:r,target});}}
    const key=all.map(x=>x.source.kind+':'+x.source.id+'>'+x.target.key+':'+x.target.label).join('|');
    if(key!==matrixKey){matrixKey=key;rowControls.length=0;$('.mod-matrix-rows').replaceChildren();for(const x of all){const r=routeRow(x.source,x.route,x.target,true);$('.mod-matrix-rows').append(r.row);rowControls.push(r.control);}if(!all.length){const p=document.createElement('p');p.textContent='No assignments yet. Drag a source handle to a control.';$('.mod-matrix-rows').append(p);}}
    for(const c of rowControls)c.update();
    const selectedRoutes=getRoutes(selected.kind,selected.id),destinations=getDestinations(selected.kind,selected.id),nextDestinationKey=selected.kind+':'+selected.id+':'+destinations.map(d=>d.key+d.label).join('|')+':'+selectedRoutes.map(routeTargetKey).join('|');
    $('.mod-matrix-add>span').textContent=sourceLabel(selected);
    if(nextDestinationKey!==destinationKey){destinationKey=nextDestinationKey;const select=$('[data-mod-add-destination]');select.replaceChildren();const first=document.createElement('option');first.value='';first.textContent='+ Destination · '+selectedRoutes.length+'/8';select.append(first);for(const d of destinations.filter(d=>d.active!==false&&!selectedRoutes.some(r=>routeTargetKey(r)===d.key))){const o=document.createElement('option');o.value=d.key;o.textContent=d.label;select.append(o);}select.disabled=selectedRoutes.length>=8;}
    $('[data-mod-add-destination]').value='';
    const q=quick&&all.find(x=>eq(x.source,quick.source)&&x.target.key===quick.key),qKey=q?q.source.kind+':'+q.source.id+'>'+q.target.key:'';
    if(qKey!==quickKey){quickKey=qKey;quickControls.length=0;$('.mod-quick-route').replaceChildren();if(q){const r=routeRow(q.source,q.route,q.target,true,true);$('.mod-quick-route').append(r.row);quickControls.push(r.control);}}
    $('.mod-quick-route').hidden=!q;for(const c of quickControls)c.update();for(const b of container.querySelectorAll('[data-mod-route-power]')){const on=getSource('lfo',Number(b.dataset.modRoutePower)).enabled;b.setAttribute('aria-checked',String(on));b.textContent=on?'On':'Off';}if(q){const label=$('.mod-quick-route .mod-route-title');label.textContent=sourceLabel(q.source)+(q.source.kind==='lfo'&&!getSource('lfo',q.source.id).enabled?' · Off':'')+' → '+q.target.label;}telemetry=all;
  }
  function updateTargets(){
    const dest=getDestinations(armed?.kind??selected.kind,armed?.id??selected.id),keys=new Set(dest.map(d=>d.key));
    for(const el of document.querySelectorAll('[role=slider],input[type=range]')){
      if(el.closest('.mod-matrix,.mod-quick-route'))continue;
      const target=getTargetForElement(el);if(!target||!keys.has(target.key)){delete el.dataset.modTarget;el.querySelector?.('.mod-target-ring')?.remove();continue;}el.dataset.modTarget=target.key;
      const routes=telemetry.filter(x=>(x.target.canonicalKey??x.target.key)===(target.canonicalKey??target.key)),active=routes.find(x=>eq(x.source,selected))??routes[0];
      let ring=el.querySelector('.mod-target-ring');if(!active||el.tagName==='INPUT'){ring?.remove();continue;}
      if(!ring){ring=document.createElementNS(ns,'svg');ring.classList.add('mod-target-ring');ring.setAttribute('viewBox','0 0 56 56');ring.setAttribute('aria-hidden','true');ring.innerHTML='<circle class="mod-ring-track" cx="28" cy="28" r="25"/><path class="mod-ring-depth"/><circle class="mod-ring-value" r="2.5"/>';el.append(ring);}
      const depth=active.route.depth,base=Number(el.value),normal=Number.isFinite(target.normalized)?target.normalized:Number.isFinite(base)&&base>=0&&base<=1?base:.5;
      const angle=n=>(-135+Math.max(0,Math.min(1,n))*270)*Math.PI/180,point=n=>[28+25*Math.sin(angle(n)),28-25*Math.cos(angle(n))];
      const start=active.source.kind==='lfo'?normal-Math.abs(depth):normal,end=active.source.kind==='lfo'?normal+Math.abs(depth):normal+depth,a=point(start),b=point(end),delta=Math.abs(Math.max(0,Math.min(1,end))-Math.max(0,Math.min(1,start)))*270;
      ring.style.setProperty('--mod-colour',color(active.source));ring.querySelector('path').setAttribute('d',Math.abs(depth)<.00001?'M'+a.join(' ')+'l.01 0':'M'+a.join(' ')+'A25 25 0 '+(delta>180?1:0)+' '+(end>=start?1:0)+' '+b.join(' '));
      const physical=getTargetValue(target),value=Number.isFinite(physical)?(target.mapping===1?Math.log(Math.max(target.min,physical)/target.min)/Math.log(target.max/target.min):(physical-target.min)/(target.max-target.min)):null,marker=ring.querySelector('.mod-ring-value');marker.hidden=!Number.isFinite(value);marker.style.display=Number.isFinite(value)?'':'none';if(Number.isFinite(value)){const p=point(value);marker.setAttribute('cx',p[0]);marker.setAttribute('cy',p[1]);}
    }
  }
  function update(){makeSources();for(const s of getSources()){const b=sourceButtons.get(s.kind+':'+s.id);b.tab.setAttribute('aria-pressed',String(eq(s,selected)));b.group.dataset.active=String(eq(s,selected));b.group.dataset.enabled=String(s.enabled!==false);}
    $('.mod-editor').hidden=!expanded||matrixOpen;$('.mod-matrix').hidden=!matrixOpen||!expanded;$('[data-mod-collapse]').textContent=expanded?'−':'+';$('[data-mod-collapse]').setAttribute('aria-expanded',String(expanded));$('[data-mod-matrix]').setAttribute('aria-expanded',String(matrixOpen));
    $('.mod-lfo-editor').hidden=selected.kind!=='lfo';$('.mod-envelope-editor').hidden=selected.kind!=='env';if(selected.kind==='lfo')lfo.update();else envelope.update();updateRoutes();updateTargets();
  }
  return{update,select:(kind,id)=>choose({kind,id}),updateTelemetry:()=>{lfo.updatePhase();updateTargets();},cancel:cancelAssignment,close:()=>{cancelAssignment();lfo.close();},destroy:()=>{cancelAssignment();life.abort();observer.disconnect();lfo.destroy();envelope.destroy?.();document.querySelectorAll('.mod-target-ring').forEach(e=>e.remove());}};
}
