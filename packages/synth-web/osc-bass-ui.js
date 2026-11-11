import {configDial} from './config-dial.js';
export function createOscBassUI({container,oscillator,getConfig,change,begin,getGesture,bindCompletion}){
 container.className='oscillator-bass';
 const toggle=document.createElement('button');toggle.type='button';toggle.className='osc-bass-toggle';toggle.dataset.oscBass=oscillator;toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','Oscillator '+(oscillator+1)+' Bass');
 const controls=document.createElement('div');controls.className='osc-bass-controls';controls.id='osc-bass-controls-'+oscillator;toggle.setAttribute('aria-controls',controls.id);
 const heading=document.createElement('div');heading.className='osc-bass-heading';const caption=container.previousElementSibling;if(caption?.classList.contains('oscillator-preview-caption'))heading.append(caption);heading.append(toggle);container.append(heading,controls);
 const dials=[];for(const[field,label,min,max,defaultValue]of[['spinHz','Spin',.1,20,4],['motion','Motion',0,1,.65],['grit','Grit',0,1,.35]]){
  const dial=configDial({begin,getGesture,bindCompletion,key:'osc-bass:'+oscillator+':'+field,label,min,max,defaultValue,getValue:()=>getConfig().oscillators[oscillator][field],change:(v,commit)=>change(oscillator,{[field]:v},commit),format:v=>field==='spinHz'?Number(v.toFixed(2))+' Hz':Math.round(v*100)+'%',...(field==='spinHz'?{toUnit:v=>Math.log(v/.1)/Math.log(200),fromUnit:n=>.1*200**n}:{})});dial.button.setAttribute('aria-label','Oscillator '+(oscillator+1)+' Bass '+label);controls.append(dial.element);dials.push(dial);
 }
 toggle.addEventListener('click',()=>{if(!getGesture())change(oscillator,{enabled:!getConfig().oscillators[oscillator].enabled},true);});
 return{update(){const c=getConfig().oscillators[oscillator];toggle.textContent='Bass '+(c.enabled?'On':'Off');toggle.setAttribute('aria-checked',String(c.enabled));toggle.setAttribute('aria-expanded',String(c.enabled));controls.hidden=!c.enabled;dials.forEach(d=>d.update());}};
}
