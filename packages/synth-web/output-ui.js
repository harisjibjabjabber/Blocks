import {configDial} from './config-dial.js';
import {DEFAULT_DELAY,DELAY_DIVISIONS} from './delay-state.js';
import {DEFAULT_REVERB} from './reverb-state.js';

// Fixed output processing follows the reorderable insert rack. These are bus
// controls, deliberately without card drag handles or insert ordering affordances.
export function createOutputUI({container,getWidth,changeWidth,getDelay,changeDelay,getReverb,changeReverb,getTempo,begin,getGesture,bindCompletion,getKeyboardVisible=()=>false,onKeyboardToggle=()=>{}}){
 const life=new AbortController(),controls={begin,getGesture,bindCompletion};
 container.className='space-workspace';
 container.innerHTML='<div class="output-heading"><h2>Space</h2><button type="button" id="space-keyboard-toggle" aria-pressed="false">Keyboard</button></div><div class="output-grid"><section class="output-card output-width-card" aria-label="Stereo width"><header><h3>Width</h3></header><div data-output-width></div></section><section class="output-card output-delay-card" aria-label="Output delay"><header><h3>Delay</h3><button type="button" id="delay-enabled" role="switch" aria-checked="false" aria-label="Output delay enabled">Off</button></header><div class="output-delay-mode" role="group" aria-label="Delay mode"><button type="button" data-delay-mode="regular" aria-pressed="true">Regular</button><button type="button" data-delay-mode="pingpong" aria-pressed="false">Ping-pong</button><button type="button" id="delay-sync" aria-pressed="false">Sync</button></div><div class="output-delay-dials"><div data-delay-time></div><div data-delay-feedback></div><div data-delay-mix></div></div><div id="delay-tempo" class="output-tempo"></div><details class="output-delay-details"><summary>Tone</summary><div data-delay-damping></div></details></section></div>';
 const $=s=>container.querySelector(s),on=(target,type,fn)=>target.addEventListener(type,fn,{signal:life.signal});
 const reverbCard=document.createElement('section');reverbCard.className='output-card output-reverb-card';reverbCard.setAttribute('aria-label','Output reverb');
 reverbCard.innerHTML=`<header><h3>Reverb</h3><button type="button" id="reverb-enabled" role="switch" aria-checked="false" aria-label="Output reverb enabled">Off</button></header><div class="output-reverb-types" role="group" aria-label="Reverb type"><button type="button" data-reverb-type="plate" title="Dense reverberation with an immediate onset">Plate</button><button type="button" data-reverb-type="hall" title="A slower, spreading reverberant space">Hall</button><button type="button" data-reverb-type="shimmer" title="Reverberation with pitch-shifted feedback">Shimmer</button></div><div class="output-reverb-main"></div><div class="output-reverb-scope"><span>Wet</span><svg viewBox="0 0 320 44" preserveAspectRatio="none" role="img" aria-label="Wet reverb waveform"><path class="reverb-scope-guide" d="M0 22H320"/><path data-reverb-scope d="M0 22H320"/></svg></div><div class="output-reverb-shimmer" hidden></div><details class="output-reverb-details"><summary>Space & tone</summary><div class="output-reverb-deep"></div></details>`;
 $('.output-grid').append(reverbCard);$('.output-heading').insertBefore($('.output-width-card'),$('#space-keyboard-toggle'));
 let reverbScope=null;
 function drawReverbScope(){if(container.hidden)return;const path=$('[data-reverb-scope]');if(!getReverb().enabled||!reverbScope){path.setAttribute('d','M0 22H320');path.dataset.level='0';return;}const peak=Math.max(...reverbScope.map(Math.abs));path.dataset.level=String(peak);if(peak<1e-8){path.setAttribute('d','M0 22H320');return;}const scale=18/Math.max(.02,peak);path.setAttribute('d',reverbScope.map((v,i)=>(i?'L':'M')+(320*i/(reverbScope.length-1)).toFixed(2)+' '+(22-v*scale).toFixed(2)).join(' '));}
 function setReverbScope(samples){reverbScope=(Array.isArray(samples)||ArrayBuffer.isView(samples))&&samples.length===128&&Array.from(samples).every(Number.isFinite)?Array.from(samples):null;drawReverbScope();}
 const reverbDials=[],percent=v=>Math.round(v*100)+'%',hertz=v=>v>=1000?(v/1000).toFixed(v>=10000?1:2)+' kHz':Math.round(v)+' Hz';
 function reverbDial(key,label,min,max,target,format,options={}){const d=configDial({...controls,key:'output:reverb:'+key,label,min,max,defaultValue:DEFAULT_REVERB[key],getValue:()=>getReverb()[key],change:(value,commit)=>changeReverb({[key]:value},commit),format,...options,modulationToUnit:options.toUnit??(v=>(v-min)/(max-min))});target.append(d.element);reverbDials.push(d);return d;}
 const main=$('.output-reverb-main'),deep=$('.output-reverb-deep'),shimmer=$('.output-reverb-shimmer');
 reverbDial('decay','Decay',.2,30,main,v=>v.toFixed(v<10?2:1)+' s',{toUnit:v=>Math.log(v/.2)/Math.log(150),fromUnit:n=>.2*Math.pow(150,n)});
 const reverbTone=reverbDial('damping','Tone',200,20000,main,hertz,{toUnit:v=>Math.log(v/200)/Math.log(100),fromUnit:n=>200*Math.pow(100,n)});reverbTone.button.setAttribute('aria-description','High-frequency damping within the reverb tail; dry sound is unchanged.');
 const ducking=reverbDial('ducking','Ducking',0,1,main,percent);ducking.button.setAttribute('aria-description','Lowers the reverb tail while new sound arrives, then lets it rise in the gaps.');
 reverbDial('mix','Mix',0,1,main,percent);
 reverbDial('shimmer','Amount',0,1,shimmer,percent);
 reverbDial('shimmerSemitones','Interval',-12,12,shimmer,v=>(v>0?'+':'')+Number(v.toFixed(2))+' st',{step:fine=>fine?.01/24:1/24});
 reverbDial('predelay','Predelay',0,.25,deep,v=>Math.round(v*1000)+' ms',{toUnit:v=>Math.sqrt(v/.25),fromUnit:n=>.25*n*n});
 reverbDial('lowCut','Low cut',20,2000,deep,hertz,{toUnit:v=>Math.log(v/20)/Math.log(100),fromUnit:n=>20*Math.pow(100,n)});
 reverbDial('size','Size',.5,2,deep,percent);
 reverbDial('diffusion','Diffusion',0,1,deep,percent);
 reverbDial('modDepth','Movement',0,1,deep,percent);
 reverbDial('modRate','Rate',.05,2,deep,v=>v.toFixed(2)+' Hz',{toUnit:v=>Math.log(v/.05)/Math.log(40),fromUnit:n=>.05*Math.pow(40,n)});
 reverbDial('wetWidth','Wet width',0,2,deep,percent);
 reverbDial('outputDb','Wet trim',-24,12,deep,v=>(v>0?'+':'')+Number(v.toFixed(1))+' dB');
 on($('#reverb-enabled'),'click',()=>{if(!getGesture())changeReverb({enabled:!getReverb().enabled},true);});
 for(const b of container.querySelectorAll('[data-reverb-type]'))on(b,'click',()=>{if(!getGesture())changeReverb({type:b.dataset.reverbType},true);});
 function updateReverb(){const r=getReverb();$('#reverb-enabled').textContent=r.enabled?'On':'Off';$('#reverb-enabled').setAttribute('aria-checked',String(r.enabled));for(const b of container.querySelectorAll('[data-reverb-type]'))b.setAttribute('aria-pressed',String(r.type===b.dataset.reverbType));shimmer.hidden=r.type!=='shimmer';for(const d of reverbDials)d.update();drawReverbScope();}

 const width=configDial({...controls,key:'output:width',label:'Stereo width',compact:true,min:0,max:2,defaultValue:1,getValue:getWidth,change:changeWidth,format:v=>Math.round(v*100)+'%'});
 $('[data-output-width]').append(width.element);
 on($('#space-keyboard-toggle'),'click',()=>{if(!getGesture()){onKeyboardToggle();update();}});
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
 function update(){updateReverb();const d=getDelay();$('#space-keyboard-toggle').setAttribute('aria-pressed',String(getKeyboardVisible()));width.update();timing.setLabel(d.synced?'Division':'Time');timing.update();feedback.update();mix.update();damping.update();$('#delay-enabled').textContent=d.enabled?'On':'Off';$('#delay-enabled').setAttribute('aria-checked',String(d.enabled));$('#delay-sync').setAttribute('aria-pressed',String(d.synced));for(const button of container.querySelectorAll('[data-delay-mode]'))button.setAttribute('aria-pressed',String(button.dataset.delayMode===d.mode));$('#delay-tempo').hidden=!d.synced;$('#delay-tempo').textContent=Math.round(getTempo())+' BPM \u00b7 global';}
 return{update,setReverbScope,destroy:()=>life.abort()};
}
