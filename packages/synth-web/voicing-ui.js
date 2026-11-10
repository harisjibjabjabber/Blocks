import {configDial} from './config-dial.js';
export function createVoicingUI({container,getVoicing,changeVoicing,...controls}){
 container.className='voicing-panel';container.innerHTML='<div class="voicing-caption"><span>Voicing</span><span>Count · next notes</span></div><div class="voicing-controls"></div>';
 const target=container.querySelector('.voicing-controls'),dials=[];
 for(const[key,label,min,max,defaultValue,format]of[['count','Unison',1,4,1,v=>v===1?'1 voice':v+' voices'],['detune','Detune',0,50,0,v=>Number(v.toFixed(1))+' ct'],['spread','Spread',0,1,0,v=>Math.round(v*100)+'%']]){
  const dial=configDial({...controls,key:'voicing:'+key,label,min,max,defaultValue,getValue:()=>getVoicing()[key],change:(value,commit)=>changeVoicing({[key]:key==='count'?Math.round(value):value},commit),...(key==='count'?{fromUnit:n=>1+Math.round(n*3),step:()=>1/3}:{}),format});target.append(dial.element);dials.push(dial);
 }
 function update(){for(const dial of dials)dial.update();for(const dial of dials.slice(1)){const disabled=getVoicing().count===1;dial.button.disabled=disabled;dial.button.setAttribute('aria-disabled',String(disabled));dial.button.title=disabled?'Choose 2 or more unison voices to use this control':dial.button.title;}}
 return{update};
}
