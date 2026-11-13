import {configDial} from './config-dial.js';
import {timeToUnit,timeFromUnit} from './envelope-scale.js';
import {envelopeGeometry} from './envelope-geometry.js';
const ns='http://www.w3.org/2000/svg';
export function createDockEnvelope({container,getEnvelope,changeEnvelope,getLimits,getId,getGesture,begin,bindCompletion}){
  container.className='mod-envelope-editor';
  const graph=document.createElementNS(ns,'svg');graph.setAttribute('viewBox','0 0 420 148');graph.setAttribute('role','group');graph.setAttribute('aria-label','Envelope shape; illustrative key release after sustain');
  const controls=document.createElement('div');controls.className='mod-env-controls';
  const details=document.createElement('details');details.className='mod-env-curves';details.innerHTML='<summary>Curves</summary>';const bends=document.createElement('div');details.append(bends);container.append(graph,controls,details);
  const dials=[],clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  for(const key of ['attack','decay','sustain','release','attackBend','decayBend','releaseBend']){
    const isBend=key.endsWith('Bend'),isTime=key!=='sustain'&&!isBend;
    const label=key[0].toUpperCase()+key.slice(1).replace('Bend',' curve');
    const limits=()=>getLimits()[key],def=()=>limits().default;
    const dial=configDial({begin,getGesture,bindCompletion,key:'dock:env:'+key,label,modulationToUnit:v=>isTime?timeToUnit(v,limits().min,limits().max):isBend?(v+2)/4:v,min:isBend?-2:0,max:isBend?2:1,defaultValue:()=>isTime?timeToUnit(def(),limits().min,limits().max):def(),getValue:()=>isTime?timeToUnit(getEnvelope()[key],limits().min,limits().max):getEnvelope()[key],change:(v,c)=>changeEnvelope({[key]:isTime?timeFromUnit(v,limits().min,limits().max):v},c),format:v=>{const actual=isTime?timeFromUnit(v,limits().min,limits().max):v;return isTime?(actual<1?Math.round(actual*1000)+' ms':actual.toFixed(2)+' s'):isBend?(Math.abs(v)<.01?'Linear':(v>0?'+':'')+v.toFixed(2)):Math.round(v*100)+'%';}});
    (isBend?bends:controls).append(dial.element);dials.push({key,dial});
  }
  let span=0;
  function draw(){
    const scaleX=420/(graph.getBoundingClientRect().width||420),scaleY=148/(graph.getBoundingClientRect().height||148);const focused=graph.contains(document.activeElement)?{handle:document.activeElement.dataset.envHandle,bend:document.activeElement.dataset.envBend}:null;const s=getEnvelope(),g=envelopeGeometry({...s,height:148,footerHeight:0,span:getGesture()?.key?.startsWith('dock:env:shape')?span:undefined});graph.replaceChildren();
    const node=(name,attrs,text)=>{const e=document.createElementNS(ns,name);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;graph.append(e);return e;};
    for(const y of [g.yTop,(g.yTop+g.yBottom)/2,g.yBottom])node('path',{d:'M18 '+y+'H402',class:'mod-env-grid'});
    const path=[];for(const[x,y,ex,ey,b]of [[18,g.yBottom,g.a,g.yTop,s.attackBend],[g.a,g.yTop,g.d,g.sy,s.decayBend],[g.d,g.sy,g.releaseStart,g.sy,0],[g.releaseStart,g.sy,g.r,g.yBottom,s.releaseBend]])for(let i=0;i<=32;i++){const p=i/32;path.push((path.length?'L':'M')+(x+(ex-x)*p)+','+(y+(ey-y)*p**(2**b)));}node('path',{d:path.join(' '),class:'mod-env-line'});
    for(const[key,x,y,ex,ey]of [['attackBend',18,g.yBottom,g.a,g.yTop],['decayBend',g.a,g.yTop,g.d,g.sy],['releaseBend',g.releaseStart,g.sy,g.r,g.yBottom]]){
      const points=[];for(let i=0;i<=32;i++){const p=i/32;points.push((i?'L':'M')+(x+(ex-x)*p)+','+(y+(ey-y)*p**(2**s[key])));}
      const hit=node('path',{d:points.join(' '),fill:'none',stroke:'transparent','stroke-width':24*scaleY,tabindex:0,role:'slider','aria-label':key.replace('Bend',' curve'),'aria-valuemin':-2,'aria-valuemax':2,'aria-valuenow':s[key]});hit.dataset.envBend=key;
      node('circle',{cx:(x+ex)/2,cy:y+(ey-y)*.5**(2**s[key]),r:3,class:'mod-env-point','pointer-events':'none'});
      hit.addEventListener('keydown',e=>{if(getGesture()||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();changeEnvelope({[key]:clamp(s[key]+(['ArrowUp','ArrowRight'].includes(e.key)?1:-1)*(e.shiftKey?.01:.1),-2,2)},true);});
    }
    node('path',{d:'M'+g.releaseStart+' '+g.yTop+'V'+g.yBottom,class:'mod-env-release'});node('text',{x:g.releaseStart,y:12,'text-anchor':'middle',class:'mod-env-keyup'},'Key up');
    for(const[key,x,y]of [['attack',g.a,g.yTop],['decay',g.d,g.sy],['release',g.r,g.yBottom]]){
      node('circle',{cx:clamp(x,18,402),cy:y,r:4,class:'mod-env-point'});
      const h=node('rect',{x:clamp(x-22*scaleX,0,420-44*scaleX),y:clamp(y-22*scaleY,0,148-44*scaleY),width:44*scaleX,height:44*scaleY,fill:'transparent',class:'mod-env-handle',tabindex:0,role:'slider','aria-label':key==='decay'?'Decay and sustain':key+' time','aria-valuemin':getLimits()[key].min,'aria-valuemax':getLimits()[key].max,'aria-valuenow':s[key]});
      h.dataset.envHandle=key;
      h.addEventListener('keydown',e=>{if(getGesture()||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(key==='decay'&&['ArrowUp','ArrowDown'].includes(e.key))changeEnvelope({sustain:clamp(s.sustain+(e.key==='ArrowUp'?1:-1)*(e.shiftKey?.001:.01),0,1)},true);else{const lim=getLimits()[key],u=timeToUnit(s[key],lim.min,lim.max);changeEnvelope({[key]:timeFromUnit(u+(['ArrowUp','ArrowRight'].includes(e.key)?1:-1)*(e.shiftKey?.001:.01),lim.min,lim.max)},true);}});

    }
    if(focused){const attr=focused.handle?'data-env-handle':'data-env-bend',value=focused.handle??focused.bend;if(value)graph.querySelector('['+attr+'="'+value+'"]')?.focus({preventScroll:true});}
  }
  graph.addEventListener('pointerdown',e=>{const stage=e.target.closest('[data-env-handle]')?.dataset.envHandle,bend=e.target.closest('[data-env-bend]')?.dataset.envBend;if((!stage&&!bend)||getGesture())return;e.preventDefault();const s=getEnvelope();span=envelopeGeometry({...s,height:148,footerHeight:0}).span;begin(e,'config',{key:'dock:env:shape',stage,bend,envelope:{...s},rect:graph.getBoundingClientRect()});});
  graph.addEventListener('pointermove',e=>{const a=getGesture();if(a?.key!=='dock:env:shape'||a.pointer!==e.pointerId)return;if(a.bend){changeEnvelope({[a.bend]:clamp(a.envelope[a.bend]+(a.y-e.clientY)/80,-2,2)},false);return;}const g=envelopeGeometry({...a.envelope,height:148,footerHeight:0,span}),dt=(e.clientX-a.x)/a.rect.width*420/(g.x1-g.x0)*span,limit=getLimits()[a.stage],patch={[a.stage]:clamp(a.envelope[a.stage]+dt,limit.min,limit.max)};if(a.stage==='decay')patch.sustain=clamp(a.envelope.sustain-(e.clientY-a.y)/a.rect.height*148/(g.yBottom-g.yTop),0,1);changeEnvelope(patch,false);});
  bindCompletion(graph);
  function update(){for(const{key,dial}of dials){dial.button.dataset.control='env:'+getId()+':'+key;dial.button.dataset.modValue=getEnvelope()[key];dial.button.dataset.envelopeSource=getId();dial.button.dataset.envelopeField=key;dial.update();}draw();}
  return{update};
}
