import {configDial} from './config-dial.js';
import {createPerformanceUI} from './performance-ui.js';
import {createLfoUI} from './lfo-ui.js';
import {curlPhase,performanceSteps} from './performance-state.js';
// Each block owns its controls. Closing another card cannot interrupt this instance.
export function createRackEditor({item,body,extra,getNode,changeNode,parameters,getTempo,changeTempo,begin,getGesture,bindCompletion}) {
  const dials=[],options={begin,getGesture,bindCompletion};
  function dial(field,label,min,max,format,extraOptions={},target=body){
    const control=configDial({...options,key:item.key+':'+field,label,min,max,getValue:()=>getNode()?.[field]??min,change:(value,commit)=>changeNode({[field]:value},commit),format,...extraOptions});target.append(control.element);dials.push(control);return control;
  }
  let performanceUI,lfoUI,contour,curve;
  const time=v=>v<1?Math.round(v*1000)+' ms':v.toFixed(2)+' s';
  if(item.type==='drive')dial('amount','Drive',1,12,v=>Number(v.toFixed(1))+'×');
  else if(item.type==='fullness')dial('amount','Fullness',0,1,v=>Math.round(v*100)+'%');
  else if(item.type==='drop'){
    dial('amount','Amount',0,2400,v=>Math.round(v)+' ct');
    dial('time','Fall',.001,4,time,{toUnit:v=>Math.log(v/.001)/Math.log(4000),fromUnit:n=>.001*4000**n});
    dial('bend','Curve',-2,2,v=>Math.abs(v)<.01?'Linear':(v>0?'+':'')+v.toFixed(2),{},extra);
  }else if(item.type==='arp'||item.type==='strum'){
    performanceUI=createPerformanceUI({container:body,getPerformance:()=>getNode().performance,change:(patch,commit=true)=>changeNode({performance:{...getNode().performance,...patch}},commit),...options,instance:item.key});

  }else if(item.type==='lfo'){
    const rate=dial('rate','Rate',.05,20,v=>Number(v.toFixed(2))+' Hz',{toUnit:v=>Math.log(v/.05)/Math.log(400),fromUnit:n=>.05*400**n});
    dial('intensity','Intensity',0,1,v=>Math.round(v*100)+'%');
    const badge=document.createElement('span');badge.className='rack-route-badge';body.append(badge);
    const panel=document.createElement('div');extra.append(panel);lfoUI=createLfoUI({container:panel,parameters,getSource:getNode,getTempo,changeSource:changeNode,changeTempo,...options,instance:item.key});
    // Rate and Intensity stay on the compact card; deeper view owns routing and sync.
    panel.querySelector('[data-lfo-ref=lfo-rate-slot]').hidden=true;panel.querySelector('[data-lfo-ref=lfo-intensity-slot]').hidden=true;
    curve=()=>{rate.button.disabled=getNode().synced;badge.textContent=getNode().routes.length+' routes'+(getNode().synced?' · '+getNode().division:'');};
  }
  if(item.type==='drive'||item.type==='drop'){
    contour=document.createElementNS('http://www.w3.org/2000/svg','svg');contour.setAttribute('viewBox','0 0 180 48');contour.classList.add('rack-contour');contour.setAttribute('aria-label',item.type==='drive'?'Drive transfer shape':'Pitch fall shape');extra.prepend(contour);
  }
  function update(){const n=getNode();if(!n)return;for(const d of dials)d.update();curve?.();lfoUI?.update();
    if(performanceUI){const p=n.performance,count=performanceSteps(p),preview=item.type==='strum'?Array.from({length:4},(_,i)=>i/3*p.strum/100):Array.from({length:count},(_,i)=>curlPhase(i/count,p.curl));performanceUI.update(preview,item.type);}
    if(contour){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',Array.from({length:65},(_,i)=>{const p=i/64,y=item.type==='drive'?24-Math.tanh((p*2-1)*n.amount)*20:44-(n.amount/2400)*40*(1-Math.pow(p,2**n.bend));return(i?'L':'M')+(4+172*p)+','+y;}).join(' '));contour.replaceChildren(path);}
  }
  return{update,destroy:()=>lfoUI?.destroy(),setPending:value=>performanceUI?.setPending(value)};
}
