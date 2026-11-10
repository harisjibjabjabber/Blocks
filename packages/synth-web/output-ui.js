import {configDial} from './config-dial.js';
import {DEFAULT_DELAY,DELAY_DIVISIONS} from './delay-state.js';

// Fixed output processing follows the reorderable insert rack. These are bus
// controls, deliberately without card drag handles or insert ordering affordances.
export function createOutputUI({container,getWidth,changeWidth,getDelay,changeDelay,getTempo,begin,getGesture,bindCompletion,getKeyboardVisible=()=>false,onKeyboardToggle=()=>{}}){
 const life=new AbortController(),controls={begin,getGesture,bindCompletion};
 container.className='sauce-output';
 container.innerHTML='<div class="output-heading"><h2>Output</h2><button type="button" id="sauce-keyboard-toggle" aria-pressed="false">Keyboard</button></div><div class="output-grid"><section class="output-card output-width-card" aria-label="Stereo width"><header><h3>Width</h3></header><div data-output-width></div></section><section class="output-card output-delay-card" aria-label="Output delay"><header><h3>Delay</h3><button type="button" id="delay-enabled" role="switch" aria-checked="false" aria-label="Output delay enabled">Off</button></header><div class="output-delay-mode" role="group" aria-label="Delay mode"><button type="button" data-delay-mode="regular" aria-pressed="true">Regular</button><button type="button" data-delay-mode="pingpong" aria-pressed="false">Ping-pong</button><button type="button" id="delay-sync" aria-pressed="false">Sync</button></div><div class="output-delay-dials"><div data-delay-time></div><div data-delay-feedback></div><div data-delay-mix></div></div><div id="delay-tempo" class="output-tempo"></div><details class="output-delay-details"><summary>Tone</summary><div data-delay-damping></div></details></section></div>';
 const $=s=>container.querySelector(s),on=(target,type,fn)=>target.addEventListener(type,fn,{signal:life.signal});
 const width=configDial({...controls,key:'output:width',label:'Stereo width',min:0,max:2,defaultValue:1,getValue:getWidth,change:changeWidth,format:v=>Math.round(v*100)+'%'+(Math.abs(v-1)<.0001?' \u00b7 Neutral':'')});
 $('[data-output-width]').append(width.element);
 on($('#sauce-keyboard-toggle'),'click',()=>{if(!getGesture()){onKeyboardToggle();update();}});
 const divisions=Object.keys(DELAY_DIVISIONS).sort((a,b)=>duration(b)-duration(a));
 function duration(label){const [denominator,triplet]=DELAY_DIVISIONS[label];return 4/denominator*(triplet?2/3:1);}
 const timeUnit=seconds=>Math.log(Math.max(.01,Math.min(2,seconds))/.01)/Math.log(200);
 const timing=configDial({...controls,key:'output:delay:time',label:'Time',min:0,max:1,
  defaultValue:()=>getDelay().synced?divisions.indexOf(DEFAULT_DELAY.division)/(divisions.length-1):timeUnit(DEFAULT_DELAY.time),
  getValue:()=>getDelay().synced?divisions.indexOf(getDelay().division)/(divisions.length-1):timeUnit(getDelay().time),
  change:(v,commit)=>changeDelay(getDelay().synced?{division:divisions[Math.round(v*(divisions.length-1))]}:{time:.01*200**v},commit),
  step:fine=>getDelay().synced?1/(divisions.length-1):fine?.001:.01,
  format:v=>getDelay().synced?divisions[Math.round(v*(divisions.length-1))]:formatTime(.01*200**v)});
 function formatTime(t){return t<1?Math.round(t*1000)+' ms':t.toFixed(2)+' s';}
 const feedback=configDial({...controls,key:'output:delay:feedback',label:'Feedback',min:0,max:.9,defaultValue:DEFAULT_DELAY.feedback,getValue:()=>getDelay().feedback,change:(feedback,commit)=>changeDelay({feedback},commit),format:v=>Math.round(v*100)+'%'});
 const mix=configDial({...controls,key:'output:delay:wet',label:'Mix',defaultValue:DEFAULT_DELAY.wet,getValue:()=>getDelay().wet,change:(wet,commit)=>changeDelay({wet},commit),format:v=>Math.round(v*100)+'%'});
 const damping=configDial({...controls,key:'output:delay:damping',label:'Damping',min:20,max:20000,defaultValue:DEFAULT_DELAY.damping,toUnit:v=>Math.log(Math.max(20,v)/20)/Math.log(1000),fromUnit:n=>20*1000**n,getValue:()=>getDelay().damping,change:(damping,commit)=>changeDelay({damping},commit),format:v=>v>=1000?(v/1000).toFixed(1)+' kHz':Math.round(v)+' Hz'});
 $('[data-delay-time]').append(timing.element);$('[data-delay-feedback]').append(feedback.element);$('[data-delay-mix]').append(mix.element);$('[data-delay-damping]').append(damping.element);
 on($('#delay-enabled'),'click',()=>{if(!getGesture())changeDelay({enabled:!getDelay().enabled},true);});
 on($('#delay-sync'),'click',()=>{if(!getGesture())changeDelay({synced:!getDelay().synced},true);});
 for(const button of container.querySelectorAll('[data-delay-mode]'))on(button,'click',()=>{if(!getGesture())changeDelay({mode:button.dataset.delayMode},true);});
 function update(){const d=getDelay();$('#sauce-keyboard-toggle').setAttribute('aria-pressed',String(getKeyboardVisible()));width.update();timing.setLabel(d.synced?'Division':'Time');timing.update();feedback.update();mix.update();damping.update();$('#delay-enabled').textContent=d.enabled?'On':'Off';$('#delay-enabled').setAttribute('aria-checked',String(d.enabled));$('#delay-sync').setAttribute('aria-pressed',String(d.synced));for(const button of container.querySelectorAll('[data-delay-mode]'))button.setAttribute('aria-pressed',String(button.dataset.delayMode===d.mode));$('#delay-tempo').hidden=!d.synced;$('#delay-tempo').textContent=Math.round(getTempo())+' BPM \u00b7 global';}
 return{update,destroy:()=>life.abort()};
}
