import {MAX_UNISON} from './voicing-state.js';
import {configDial} from './config-dial.js';
export function createVoicingUI({container,oscillator=0,getVoicing,changeVoicing,...controls}){
 container.className='voicing-panel oscillator-unison';container.setAttribute('aria-label','Oscillator '+(oscillator+1)+' unison');container.innerHTML='<div class="voicing-caption"><span>Unison</span><span>Count · next notes</span></div><div class="voicing-controls"></div>';
 const target=container.querySelector('.voicing-controls'),dials=[];
 for(const[key,label,min,max,defaultValue,format]of[['count','Unison',1,MAX_UNISON,1,v=>v===1?'1 voice':v+' voices'],['detune','Detune',0,50,0,v=>Number(v.toFixed(1))+' ct'],['spread','Spread',0,1,0,v=>Math.round(v*100)+'%']]){
  const dial=configDial({...controls,key:'voicing:'+oscillator+':'+key,label:key==='count'?'Count':label,min,max,defaultValue,getValue:()=>getVoicing().oscillators[oscillator][key],change:(value,commit)=>changeVoicing(oscillator,{[key]:key==='count'?Math.round(value):value},commit),...(key==='count'?{fromUnit:n=>1+Math.round(n*(MAX_UNISON-1)),step:()=>1/(MAX_UNISON-1)}:{}),format});dial.button.setAttribute('aria-label','Oscillator '+(oscillator+1)+' unison '+(key==='count'?'count':label.toLowerCase()));target.append(dial.element);dials.push(dial);
 }
 function update(){for(const dial of dials)dial.update();for(const dial of dials.slice(1)){const disabled=getVoicing().oscillators[oscillator].count===1;dial.button.disabled=disabled;dial.button.setAttribute('aria-disabled',String(disabled));dial.button.title=disabled?'Choose 2 or more unison voices for this oscillator to use this control':dial.button.title;}}
 return{update};
}
