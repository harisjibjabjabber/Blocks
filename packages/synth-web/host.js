import { createInstrumentUI } from './instrument-ui.js';
import { characterRecipe,motionRecipe } from './recipes.js';
import { migratePatch } from './patches.js';
import {emptyPeak,receivePeak,peakDisplay} from './peak-meter.js';
import {canonicalLevels,parameterBatch} from './parameter-state.js';
const $=id=>document.getElementById(id);
let context,node,analyser,parameters=[],values=[],ready=false,access,raf=0,lastDraw=0,instrument,version=1;
const pressed=new Map(),keys=new Map();
let keyboardShift=0,voiceCount=0,peakState=emptyPeak();
const error=message=>{$('error').textContent=message;};
function event(type,key=0,value=0,parameter=0,channel=15){if(ready&&context.state==='running')node.port.postMessage({kind:'event',type,key,value,parameter,channel,frame:Math.ceil(context.currentTime*context.sampleRate)});}
function applyValues(next){
  const before=values; values=canonicalLevels(next,before.length?before:undefined);
  if(!ready)return;
  if(context.state==='running')node.port.postMessage({kind:'parameter-batch',values:parameterBatch(before,values),frame:Math.ceil(context.currentTime*context.sampleRate)});
  else node.port.postMessage({kind:'patch',version,values});
}
const engineData=(async()=>{
  const response=await fetch('./synth.wasm');if(!response.ok)throw Error('Cannot load synth.wasm');
  const wasm=await response.arrayBuffer();
  const {instance}=await WebAssembly.instantiate(wasm,{}),api=instance.exports;api._initialize?.();
  version=api.bs_abi_version();const view=new DataView(api.memory.buffer),bytes=new Uint8Array(api.memory.buffer);
  const string=p=>{let s='';while(bytes[p])s+=String.fromCharCode(bytes[p++]);return s;};
  parameters=Array.from({length:api.bs_parameter_count()},(_,id)=>{const p=api.bs_parameter_info(id);return{id,name:string(view.getUint32(p+4,true)),unit:string(view.getUint32(p+8,true)),min:view.getFloat32(p+12,true),max:view.getFloat32(p+16,true),default:view.getFloat32(p+20,true),mapping:view.getUint32(p+24,true)};});
  instrument=createInstrumentUI({parameters,getValues:()=>values,applyValues,releaseVoices:panic,onViewChange:drawScope});
  for(const id of ['init','export','import'])$(id).disabled=false;
  return wasm;
})();
engineData.catch(e=>{error(String(e));$('start').disabled=true;});
function setKey(pitch,down){keys.get(pitch)?.classList.toggle('active',down);}
function startNote(owner,pitch,velocity=.75){if(!ready||context.state!=='running'||pressed.has(owner))return;const existing=[...pressed.values()].includes(pitch);pressed.set(owner,pitch);if(!existing)event(0,pitch,velocity);setKey(pitch,true);}
function releaseNote(owner){const pitch=pressed.get(owner);if(pitch===undefined)return;pressed.delete(owner);if(![...pressed.values()].includes(pitch)){event(1,pitch);setKey(pitch,false);}}
function panic(){pressed.clear();for(const k of keys.values())k.classList.remove('active');node?.port.postMessage({kind:'panic'});$('monitor').textContent='0 voices';}
async function stop(){panic();if(context?.state==='running')await context.suspend();cancelAnimationFrame(raf);$('status').textContent='Sound stopped';$('stop').disabled=true;$('start').disabled=false;$('start').textContent='Resume sound';voiceCount=0;drawScope();}
function drawScope(samples){
  const canvas=$('scope');if(!canvas.clientWidth||!canvas.clientHeight)return;
  const drawing=canvas.getContext('2d'),ratio=devicePixelRatio||1,w=Math.round(canvas.clientWidth*ratio),h=Math.round(canvas.clientHeight*ratio);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const running=context?.state==='running';let peak=0;
  if(running){samples??=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);for(const value of samples)peak=Math.max(peak,Math.abs(value));}
  const output=running&&(voiceCount>0||peak>1e-5);
  $('scope-label').textContent=output?'Output (auto)':'Preview';
  canvas.setAttribute('aria-label',output?'Actual output waveform, display auto-scaled':'Selected oscillator shape preview, not measured output');
  drawing.clearRect(0,0,w,h);drawing.lineWidth=1.2*ratio;
  const trace=(colour,sample)=>{drawing.strokeStyle=colour;drawing.beginPath();for(let i=0;i<w;i++){const y=h*.5-sample(i/(w-1))*h*.36;if(i)drawing.lineTo(i,y);else drawing.moveTo(i,y);}drawing.stroke();};
  if(output){const scale=Math.max(.003,peak);trace('#e9e3d7',n=>samples[Math.min(samples.length-1,Math.floor(n*(samples.length-1)))]/scale);}
  else if(values.length){const shape=(wave,t)=>wave===0?Math.sin(2*Math.PI*t):wave===1?4*Math.abs(t-.5)-1:wave===2?2*t-1:t<(wave===4?.5:(values[3]??.5))?1:-1;trace('#e9e3d7',n=>shape(values[19]??2,(n*2)%1)*(values[21]??.65));trace('#ff743f',n=>shape(values[20]??3,(n*2)%1)*(values[22]??.35));}
}
function scope(){
  if(!context||context.state!=='running')return;
  const samples=new Float32Array(analyser.fftSize);
  const draw=time=>{if(context.state!=='running')return;raf=requestAnimationFrame(draw);if(time-lastDraw<33)return;lastDraw=time;drawScope(samples);};
  cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);
}
function showPeak(){const display=peakDisplay(peakState);$('peak-indicator').dataset.state=display.state;$('peak-readout').textContent=display.text;$('volume-toggle').title='Volume - '+display.text;}
$('peak-reset').addEventListener('click',()=>{peakState=emptyPeak();showPeak();});
window.addEventListener('resize',()=>drawScope());

async function start(){error('');$('start').disabled=true;try{if(!context){context=new AudioContext({latencyHint:'interactive'});await context.resume();const wasm=await engineData;await context.audioWorklet.addModule('./processor.js');node=new AudioWorkletNode(context,'blocks-synth',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{wasm}});analyser=context.createAnalyser();analyser.fftSize=1024;node.connect(analyser);analyser.connect(context.destination);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Synth initialization timed out')),15000);node.port.onmessage=e=>{const m=e.data;if(m.kind==='error'){error(m.message);if(!ready){clearTimeout(timer);reject(Error(m.message));}}else if(m.kind==='ready'){clearTimeout(timer);ready=true;version=m.version;node.port.postMessage({kind:'patch',version,values});for(const id of ['midi','init','export','import'])$(id).disabled=false;resolve();}else if(m.kind==='status'){voiceCount=m.voices;$('monitor').textContent=m.voices+' voices';peakState=receivePeak(peakState,m);showPeak();if(m.invalid<0)error('Audio event block rejected');}else if(m.kind==='patch'){values=m.values;instrument?.update();}};});}else {await context.resume();node.port.postMessage({kind:'patch',version,values});}$('status').textContent='Sound running · '+Math.round(context.sampleRate)+' Hz';$('stop').disabled=false;$('start').disabled=true;scope();}catch(e){error(String(e));if(context){await context.close();context=null;}node=null;ready=false;$('start').disabled=false;$('status').textContent='Sound unavailable';}}
$('start').addEventListener('click',start);$('stop').addEventListener('click',stop);
const whites=[60,62,64,65,67,69,71,72,74,76,77,79,81,83],blacks=[[61,1],[63,2],[66,4],[68,5],[70,6],[73,8],[75,9],[78,11],[80,12],[82,13]],names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
for(const pitch of whites){const b=document.createElement('button');b.className='key white';b.dataset.pitch=pitch;b.textContent=names[pitch%12]+(pitch%12===0?Math.floor(pitch/12)-1:'');b.setAttribute('aria-label','Play '+names[pitch%12]+(Math.floor(pitch/12)-1));$('keyboard').append(b);keys.set(pitch,b);}
for(const[pitch,pos]of blacks){const b=document.createElement('button');b.className='key black';b.dataset.pitch=pitch;b.dataset.octave=pitch>=72?'1':'0';b.style.left=`calc(${pos/14*100}% - 2.15%)`;b.style.setProperty('--mobile-left',`calc(${pos%7/7*100}% - 4.3%)`);b.setAttribute('aria-label','Play '+names[pitch%12]+(Math.floor(pitch/12)-1));$('keyboard').append(b);keys.set(pitch,b);}
function shiftOctave(delta){
  panic();keyboardShift=Math.max(-2,Math.min(1,keyboardShift+delta));
  const buttons=[...keys.values()];keys.clear();
  for(const button of buttons){
    button.dataset.basePitch??=button.dataset.pitch;
    const pitch=Number(button.dataset.basePitch)+keyboardShift*12;
    button.dataset.pitch=pitch;keys.set(pitch,button);
    const octave=Math.floor(pitch/12)-1;
    if(button.classList.contains('white'))button.textContent=names[pitch%12]+(pitch%12===0?octave:'');
    button.setAttribute('aria-label','Play '+names[pitch%12]+octave);
  }
  if($('octave-label'))$('octave-label').textContent='C'+(4+keyboardShift);
  if($('octave-down'))$('octave-down').disabled=keyboardShift===-2;
  if($('octave-up'))$('octave-up').disabled=keyboardShift===1;
}
$('octave-down')?.addEventListener('click',()=>shiftOctave(-1));
$('octave-up')?.addEventListener('click',()=>shiftOctave(1));
$('keyboard').addEventListener('pointerdown',e=>{const k=e.target.closest('[data-pitch]');if(!k)return;e.preventDefault();$('keyboard').setPointerCapture(e.pointerId);const r=k.getBoundingClientRect();startNote('touch-'+e.pointerId,Number(k.dataset.pitch),Math.max(.2,Math.min(1,(e.clientY-r.top)/r.height)));});
$('keyboard').addEventListener('pointermove',e=>{const owner='touch-'+e.pointerId;if(!pressed.has(owner))return;const k=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-pitch]');if(k&&Number(k.dataset.pitch)!==pressed.get(owner)){releaseNote(owner);startNote(owner,Number(k.dataset.pitch));}});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('keyboard').addEventListener(name,e=>releaseNote('touch-'+e.pointerId));
const mapping={a:60,w:61,s:62,e:63,d:64,f:65,t:66,g:67,y:68,h:69,u:70,j:71,k:72};
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName))return;const base=mapping[e.key.toLowerCase()],pitch=base===undefined?undefined:base+keyboardShift*12;if(pitch!==undefined&&!e.repeat){e.preventDefault();startNote('key-'+e.code,pitch);}});window.addEventListener('keyup',e=>releaseNote('key-'+e.code));
for(const[pitch,key]of keys){key.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)&&!e.repeat){e.preventDefault();startNote('button-'+pitch,Number(key.dataset.pitch));}});key.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();releaseNote('button-'+pitch);}});}
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({format:'blocks-synth-patch',version,values,macroVersions:{character:characterRecipe.version,motion:motionRecipe.version}},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='blocks-synth-patch.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
$('import').addEventListener('change',async e=>{
  try{
    const file=e.target.files[0];if(!file)return;if(file.size>65536)throw Error('Patch exceeds 64 KiB');
    const patch=JSON.parse(await file.text());
    instrument.loadPatch(migratePatch(patch,parameters,version));error('');
  }catch(e){error(String(e));}finally{e.target.value='';}
});

function bindMidi(){if(!access)return;for(const input of access.inputs.values())input.onmidimessage=e=>{const[status,d1,d2]=e.data,type=status&240,channel=status&15;if(type===144)event(d2?0:1,d1,d2/127,0,channel);else if(type===128)event(1,d1,0,0,channel);else if(type===176&&d1===64)event(4,0,d2>=64?1:0,0,channel);else if(type===176&&(d1===120||d1===123))panic();};$('midi').textContent=access.inputs.size?`MIDI · ${access.inputs.size} input(s)`:'MIDI · no input';}
$('midi').addEventListener('click',async()=>{try{if(!navigator.requestMIDIAccess)throw Error('This browser does not support Web MIDI');access??=await navigator.requestMIDIAccess({sysex:false});access.onstatechange=()=>{panic();bindMidi();};bindMidi();}catch(e){error(String(e));}});
window.addEventListener('blur',panic);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',()=>{panic();context?.close();});
