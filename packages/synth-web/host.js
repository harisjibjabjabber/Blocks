import {normalizeClock,toCoreClock} from './clock-state.js';
import {normalizeSub,toCoreSub} from './sub-state.js';
import {normalizeOscBass,toCoreOscBass} from './osc-bass-state.js';
import {DEFAULT_VOICING,normalizeVoicing,toCoreVoicing} from './voicing-state.js';
import {normalizeFilterRouting,toCoreFilterRouting} from './filter-routing-state.js';
import {normalizeSound,toCoreSound} from './sound-state.js';
import {normalizeSuite,toCoreSuite,SUITE_FLOATS,SUITE_UINTS} from './suite-state.js';
import {normalizeReverb,toCoreReverb} from './reverb-state.js';
import {DEFAULT_DELAY,normalizeDelay,toCoreDelay} from './delay-state.js';
import {normalizeStereoWidth} from './stereo-state.js';
import { createInstrumentUI } from './instrument-ui.js';
import { motionRecipe } from './recipes.js';
import { validateCurrentPatch } from './patches.js';
import {emptyPeak,receivePeak,peakDisplay} from './peak-meter.js';
import {canonicalLevels,parameterBatch} from './parameter-state.js';
import {DEFAULT_PERFORMANCE,normalizePerformance,toCorePerformance} from './performance-state.js';
import {DEFAULT_RACK,normalizeRack,hydrateRack,toCoreSauce,toCoreNotes,toCoreCreativeFX,syncRackOrder} from './sauce-state.js';
import {DEFAULT_MODULATION,normalizeModulation,toCoreModulation,pruneEffectRoutes} from './modulation-state.js';
const $=id=>document.getElementById(id);
let context,node,analyser,parameters=[],values=[],ready=false,access,raf=0,lastDraw=0,instrument,version=1;
let performanceSettings=normalizePerformance(DEFAULT_PERFORMANCE),rackSettings=normalizeRack(DEFAULT_RACK),modulationSettings=normalizeModulation(DEFAULT_MODULATION);
const pressed=new Map(),keys=new Map();
let clockSettings=normalizeClock(),subSettings=normalizeSub(),suiteSettings=normalizeSuite();
let oscBassSettings=normalizeOscBass(),oscBassPreviewPhases=[.25,.25],nativeOscPreview=null;
let stereoWidth=1,voicingSettings=normalizeVoicing(),filterRoutingSettings=normalizeFilterRouting(),delaySettings=normalizeDelay(),reverbSettings=normalizeReverb(),soundSettings=normalizeSound();
let keyboardShift=0,voiceCount=0,peakState=emptyPeak(),outputMeterState=null;
const error=message=>{$('error').textContent=message;};
function event(type,key=0,value=0,parameter=0,channel=15){if(ready&&context.state==='running')node.port.postMessage({kind:'event',type,key,value,parameter,channel,frame:Math.ceil(context.currentTime*context.sampleRate)});}
function applyValues(next){
  if(next.length===values.length&&next.every((value,id)=>value===values[id]))return;
  const before=values; values=canonicalLevels(next,before.length?before:undefined);
  if(!ready)return;
  if(context.state==='running'){const batch=parameterBatch(before,values);if(batch.length)node.port.postMessage({kind:'parameter-batch',values:batch,frame:Math.ceil(context.currentTime*context.sampleRate)});}
  else node.port.postMessage({kind:'patch',version,values});
}
function applyPerformance(next){
  const normalized=normalizePerformance(next),reset=normalized.mode!==performanceSettings.mode||normalized.mono!==performanceSettings.mono;
  performanceSettings=normalized;clockSettings={...clockSettings,bpm:normalized.bpm};
  if(reset)clearInputUI();
  if(ready)node.port.postMessage({kind:'performance',config:toCorePerformance(performanceSettings)});
}
function getRack(){return values.length?hydrateRack(rackSettings,values):normalizeRack(rackSettings);}
function sendRack(previous=null){if(!ready)return;const current=getRack(),sauce=toCoreSauce(current),notes=toCoreNotes(current),effects=toCoreCreativeFX(current);if(!previous||JSON.stringify(toCoreSauce(previous))!==JSON.stringify(sauce))node.port.postMessage({kind:'sauce',config:sauce});if(!previous||JSON.stringify(toCoreNotes(previous))!==JSON.stringify(notes))node.port.postMessage({kind:'notes',config:notes});if(!previous||JSON.stringify(toCoreCreativeFX(previous))!==JSON.stringify(effects))node.port.postMessage({kind:'creative-fx',config:effects});}
function applyRack(next){
  const normalized=normalizeRack(next),previous=rackSettings,before=getRack();
  const shape=r=>JSON.stringify(r.notes.map(b=>[b.id,b.type,b.enabled]));if(shape(previous)!==shape(normalized))clearInputUI();
  rackSettings=normalized;
  if(values.length){const tone=[...values];for(const b of normalized.audio)if(b.primary){tone[18]=b.amount;tone[39]=Number(b.enabled);}for(const b of normalized.notes)if(b.type==='drop'&&b.primary){tone[15]=b.amount;tone[16]=b.time;tone[17]=b.bend;tone[37]=Number(b.enabled);}if(tone.some((value,id)=>value!==values[id]))applyValues(tone);}
  sendRack(before);
  applyModulation(pruneEffectRoutes(modulationSettings,normalized));
}
function applyModulation(next){const normalized=normalizeModulation(next),changed=JSON.stringify(normalized)!==JSON.stringify(modulationSettings);modulationSettings=normalized;if(ready&&changed)node.port.postMessage({kind:'modulation',config:toCoreModulation(modulationSettings)});}
function applyStereoWidth(value){const next=normalizeStereoWidth(value);if(next===stereoWidth)return;stereoWidth=next;if(ready){if(context.state==='running')node.port.postMessage({kind:'event',type:5,value:next,frame:Math.ceil(context.currentTime*context.sampleRate)});else node.port.postMessage({kind:'stereo-width',value:next});}}
function applyVoicing(next){const config=normalizeVoicing(next);if(JSON.stringify(config)===JSON.stringify(voicingSettings))return;voicingSettings=config;if(ready)node.port.postMessage({kind:'voicing',config:toCoreVoicing(config)});}
function applyClock(next){const config=normalizeClock(next);if(JSON.stringify(config)===JSON.stringify(clockSettings))return;clockSettings=config;if(ready)node.port.postMessage({kind:'clock',config:toCoreClock(config)});}
function applySub(next){const config=normalizeSub(next);if(JSON.stringify(config)===JSON.stringify(subSettings))return;subSettings=config;if(ready)node.port.postMessage({kind:'sub',config:toCoreSub(config)});}
function applyOscBass(next){const config=normalizeOscBass(next);if(JSON.stringify(config)===JSON.stringify(oscBassSettings))return;oscBassSettings=config;if(ready)node.port.postMessage({kind:'osc-bass',config:toCoreOscBass(config)});}
function applyFilterRouting(next){const config=normalizeFilterRouting(next);if(JSON.stringify(config)===JSON.stringify(filterRoutingSettings))return;filterRoutingSettings=config;if(ready)node.port.postMessage({kind:'filter-routing',config:toCoreFilterRouting(config)});}
function applyDelay(next){const config=normalizeDelay(next);if(JSON.stringify(config)===JSON.stringify(delaySettings))return;delaySettings=config;if(ready)node.port.postMessage({kind:'delay',config:toCoreDelay(config)});}
function applyReverb(next){const config=normalizeReverb(next);if(JSON.stringify(config)===JSON.stringify(reverbSettings))return;reverbSettings=config;if(ready)node.port.postMessage({kind:'reverb',config:toCoreReverb(config)});}
function applySuite(next){const config=normalizeSuite(next);if(JSON.stringify(config)===JSON.stringify(suiteSettings))return;suiteSettings=config;if(ready)node.port.postMessage({kind:'suite',config:toCoreSuite(config)});}
function applySound(next){const config=normalizeSound(next);if(JSON.stringify(config)===JSON.stringify(soundSettings))return;soundSettings=config;if(ready)node.port.postMessage({kind:'sound',config:toCoreSound(config)});}
function sendExtended(){if(ready){node.port.postMessage({kind:'suite',config:toCoreSuite(suiteSettings)});node.port.postMessage({kind:'clock',config:toCoreClock(clockSettings)});node.port.postMessage({kind:'sub',config:toCoreSub(subSettings)});}sendRack();if(ready){node.port.postMessage({kind:'osc-bass',config:toCoreOscBass(oscBassSettings)});node.port.postMessage({kind:'sound',config:toCoreSound(soundSettings)});node.port.postMessage({kind:'voicing',config:toCoreVoicing(voicingSettings)});node.port.postMessage({kind:'filter-routing',config:toCoreFilterRouting(filterRoutingSettings)});node.port.postMessage({kind:'delay',config:toCoreDelay(delaySettings)});node.port.postMessage({kind:'reverb',config:toCoreReverb(reverbSettings)});}if(ready)node.port.postMessage({kind:'stereo-width',value:stereoWidth});if(ready)node.port.postMessage({kind:'modulation',config:toCoreModulation(modulationSettings)});}
const engineData=(async()=>{
  const response=await fetch('./synth.wasm');if(!response.ok)throw Error('Cannot load synth.wasm');
  const wasm=await response.arrayBuffer();
  const {instance}=await WebAssembly.instantiate(wasm,{}),api=instance.exports;api._initialize?.();
  version=api.bs_abi_version();const view=new DataView(api.memory.buffer),bytes=new Uint8Array(api.memory.buffer);
  const string=p=>{let s='';while(bytes[p])s+=String.fromCharCode(bytes[p++]);return s;};
  parameters=Array.from({length:api.bs_parameter_count()},(_,id)=>{const p=api.bs_parameter_info(id);return{id,name:string(view.getUint32(p+4,true)),unit:string(view.getUint32(p+8,true)),min:view.getFloat32(p+12,true),max:view.getFloat32(p+16,true),default:view.getFloat32(p+20,true),mapping:view.getUint32(p+24,true)};});
  const previewSettings=api.malloc(36),previewOutput=api.malloc(257*4);
  if(!previewSettings||!previewOutput||!api.bs_osc_bass_preview_v2)throw Error('Oscillator preview unavailable');
  const previewOscBass=(index,wave,pulseWidth,phase)=>{const settings=toCoreOscBass(oscBassSettings).oscillators[index],view=new DataView(api.memory.buffer);for(const[field,offset]of[['enabled',0],['voice',4],['synced',8],['retrigger',12]])view.setUint32(previewSettings+offset,settings[field],true);for(const[field,offset]of[['spin_hz',16],['motion',20],['grit',24],['cycle_beats',28],['curl',32]])view.setFloat32(previewSettings+offset,settings[field],true);if(context?.state!=='running')phase=api.bs_osc_bass_warp_phase(.25,settings.curl);if(!api.bs_osc_bass_preview_v2(wave,1,pulseWidth,previewSettings,phase,130.81278265,context?.sampleRate||48000,clockSettings.bpm,1,1,previewOutput,257))return null;return Array.from(new Float32Array(api.memory.buffer,previewOutput,257));};
  nativeOscPreview=previewOscBass;
  const suitePointer=api.malloc(204),suitePreviewOutput=api.malloc(257*4),suiteDryOutput=api.malloc(256*4),suiteWetOutput=api.malloc(256*4);if(!suitePointer||!suitePreviewOutput||!suiteDryOutput||!suiteWetOutput)throw Error('Suite preview allocation failed');let suitePreviewKey='',suitePreviewCache=null,dynamicsPreviewKey='',dynamicsPreviewCache=null;
  const writeSuitePreview=config=>{const c=toCoreSuite(config),view=new DataView(api.memory.buffer);SUITE_UINTS.forEach(([,k,offset])=>view.setUint32(suitePointer+offset,c[k],true));SUITE_FLOATS.forEach(([,k,,,,offset])=>view.setFloat32(suitePointer+offset,c[k],true));c.bands.forEach((band,i)=>['threshold_db','gain_db','up','down'].forEach((k,j)=>view.setFloat32(suitePointer+136+i*16+j*4,band[k],true)));};
  const previewSuiteColour=config=>{const rate=context?.sampleRate||48000,key=JSON.stringify([config.style,config.driveDb,config.tone,config.colourEnabled,config.colourMix,config.colourOutputDb,config.colour2Style,config.colour2DriveDb,config.colour2Tone,config.colour2Enabled,config.colour2Mix,config.colour2OutputDb,rate]);if(key===suitePreviewKey)return suitePreviewCache;writeSuitePreview(config);if(!api.bs_suite_colour_preview(suitePointer,130.81278265,rate,suitePreviewOutput,257))return null;suitePreviewKey=key;suitePreviewCache={dry:Array.from({length:257},(_,i)=>.25*Math.sin(2*Math.PI*i/257)),wet:Array.from(new Float32Array(api.memory.buffer,suitePreviewOutput,257))};return suitePreviewCache;};
  const previewSuiteDynamics=config=>{const rate=context?.sampleRate||48000,key=JSON.stringify([config.dynamics,rate]);if(key===dynamicsPreviewKey)return dynamicsPreviewCache;writeSuitePreview(config);if(!api.bs_suite_dynamics_preview(suitePointer,rate,suiteDryOutput,suiteWetOutput,128))return null;dynamicsPreviewKey=key;dynamicsPreviewCache={dry:Array.from(new Float32Array(api.memory.buffer,suiteDryOutput,128)),wet:Array.from(new Float32Array(api.memory.buffer,suiteWetOutput,128)),seconds:.6};return dynamicsPreviewCache;};
  instrument=createInstrumentUI({parameters,getSuite:()=>suiteSettings,applySuite,previewSuiteColour,previewSuiteDynamics,getClock:()=>clockSettings,applyClock,getSub:()=>subSettings,applySub,warpBassPhase:(phase,curl)=>api.bs_osc_bass_warp_phase(phase,curl),getOscBass:()=>oscBassSettings,applyOscBass,previewOscBass,getSound:()=>soundSettings,applySound,getStereoWidth:()=>stereoWidth,applyStereoWidth,getVoicing:()=>voicingSettings,applyVoicing,getFilterRouting:()=>filterRoutingSettings,applyFilterRouting,getDelay:()=>delaySettings,applyDelay,getReverb:()=>reverbSettings,applyReverb,getValues:()=>values,getSampleRate:()=>context?.sampleRate||48000,applyValues,releaseVoices:panic,onViewChange:drawScope,getPerformance:()=>performanceSettings,applyPerformance,getRack,applyRack,getModulation:()=>modulationSettings,applyModulation});
  for(const id of ['init','export','import'])$(id).disabled=false;
  return wasm;
})();
engineData.catch(e=>{error(String(e));$('start').disabled=true;});
function setKey(pitch,down){keys.get(pitch)?.classList.toggle('active',down);}
function startNote(owner,pitch,velocity=.75){if(!ready||context.state!=='running'||pressed.has(owner))return;const existing=[...pressed.values()].includes(pitch);pressed.set(owner,pitch);if(!existing)event(0,pitch,velocity);setKey(pitch,true);}
function releaseNote(owner){const pitch=pressed.get(owner);if(pitch===undefined)return;pressed.delete(owner);if(![...pressed.values()].includes(pitch)){event(1,pitch);setKey(pitch,false);}}
function clearInputUI(){instrument?.setPerformancePending?.(false);pressed.clear();for(const k of keys.values())k.classList.remove('active');$('monitor').textContent='0 voices';}
function panic(){clearInputUI();node?.port.postMessage({kind:'panic'});}
async function stop(){panic();if(context?.state==='running')await context.suspend();cancelAnimationFrame(raf);$('status').textContent='Sound stopped';$('stop').disabled=true;$('start').disabled=false;$('start').textContent='Resume sound';voiceCount=0;receiveOscBassPhases(null);showCpu(null);instrument?.setSuiteMeters?.(null);instrument?.setReverbScope?.(null);outputMeterState=null;showPeak();instrument?.setModulationPhases?.([]);drawScope();}
function receiveOscBassPhases(phases,rawPhases,rates){oscBassPreviewPhases=Array.isArray(phases)&&phases.length===2&&phases.every(Number.isFinite)?phases:[.25,.25];instrument?.setOscBassPhases?.(phases,rawPhases,rates);}
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
  else if(values.length){const shape=(wave,t)=>wave===0?Math.sin(2*Math.PI*t):wave===1?4*Math.abs(t-.5)-1:wave===2?2*t-1:t<(wave===4?.5:(values[3]??.5))?1:-1;const nativeShapes=[0,1].map(index=>oscBassSettings.oscillators[index].enabled?nativeOscPreview?.(index,values[19+index]??(index?3:2),values[3]??.5,oscBassPreviewPhases[index]):null),displayScale=Math.max(1,...nativeShapes.flatMap((samples,index)=>samples?samples.map(v=>Math.abs(v)*(values[21+index]??(index?.35:.65))):[]));if(nativeShapes.some(Boolean))canvas.setAttribute('aria-label','Native C3 oscillator shape preview, jointly auto-scaled, not measured output');for(let index=0;index<2;index++){const wave=values[19+index]??(index?3:2),native=nativeShapes[index];trace(index?'#ff743f':'#e9e3d7',n=>{const phase=(n*2)%1;return(native?native[Math.floor(phase*(native.length-1))]:shape(wave,phase))*(values[21+index]??(index?.35:.65))/displayScale;});}}
}
function scope(){
  if(!context||context.state!=='running')return;
  const samples=new Float32Array(analyser.fftSize);
  const draw=time=>{if(context.state!=='running')return;raf=requestAnimationFrame(draw);if(time-lastDraw<33)return;lastDraw=time;drawScope(samples);};
  cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);
}
function showCpu(value){const meter=$('cpu-load');const valid=context?.state==='running'&&Number.isFinite(value)&&value>=0;meter.textContent=valid?'CPU ~'+Math.round(value)+'%':'CPU \u2014';meter.dataset.state=valid?(value>=100?'over':value>=70?'high':'normal'):'idle';}
function showPeak(){const display=peakDisplay(peakState);$('peak-indicator').dataset.state=display.state;$('peak-readout').textContent=display.text;const input=outputMeterState?.inputPeak,gr=outputMeterState?.gainReductionDb;const protection=Number.isFinite(input)&&Number.isFinite(gr)?' · Protection input '+(input>1e-6?(20*Math.log10(input)).toFixed(1)+' dBFS':'silent')+' · reduction '+gr.toFixed(1)+' dB':'';$('volume-toggle').title='Volume - '+display.text+protection;$('peak-indicator').title=display.text+protection;$('peak-indicator').dataset.reduction=Number.isFinite(gr)?String(gr):'';}
$('peak-reset').addEventListener('click',()=>{peakState=emptyPeak();showPeak();});
window.addEventListener('resize',()=>drawScope());

async function start(){error('');$('start').disabled=true;try{if(!context){context=new AudioContext({latencyHint:'interactive'});await context.resume();const wasm=await engineData;await context.audioWorklet.addModule('./processor.js');node=new AudioWorkletNode(context,'blocks-synth',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{wasm}});analyser=context.createAnalyser();analyser.fftSize=1024;node.connect(analyser);analyser.connect(context.destination);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Synth initialization timed out')),15000);node.port.onmessage=e=>{const m=e.data;if(m.kind==='error'){error(m.message);if(!ready){clearTimeout(timer);reject(Error(m.message));}}else if(m.kind==='ready'){clearTimeout(timer);ready=true;version=m.version;node.port.postMessage({kind:'patch',version,values});node.port.postMessage({kind:'performance',config:toCorePerformance(performanceSettings)});sendExtended();for(const id of ['midi','init','export','import'])$(id).disabled=false;resolve();}else if(m.kind==='status'){instrument?.setReverbScope?.(context?.state==='running'&&reverbSettings.enabled?m.reverbScope:null);outputMeterState=context?.state==='running'?m.outputMeters:null;instrument?.setSuiteMeters?.(context?.state==='running'?m.suiteMeters:null);receiveOscBassPhases(context?.state==='running'?m.oscBassPhases:null,m.oscBassRawPhases,m.oscBassRates);showCpu(m.cpuPercent);voiceCount=m.voices;instrument?.setPerformancePending?.(Boolean(m.performancePending));instrument?.setRackPending?.(m.notesPendingMask??0);instrument?.setModulationPhases?.(context?.state==='running'?m.lfoPhases??[]:[]);$('monitor').textContent=m.voices+' voices';peakState=receivePeak(peakState,m);showPeak();if(m.invalid<0)error('Audio event block rejected');}else if(m.kind==='patch'){values=m.values;instrument?.update();}};});}else {await context.resume();node.port.postMessage({kind:'patch',version,values});node.port.postMessage({kind:'performance',config:toCorePerformance(performanceSettings)});sendExtended();}$('status').textContent='Sound running Ã‚· '+Math.round(context.sampleRate)+' Hz';$('stop').disabled=false;$('start').disabled=true;instrument?.update();scope();}catch(e){error(String(e));if(context){await context.close();context=null;}node=null;ready=false;$('start').disabled=false;$('status').textContent='Sound unavailable';}}
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
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({format:'blocks-synth-patch',version,values,performance:performanceSettings,rack:syncRackOrder(getRack(),modulationSettings),modulation:modulationSettings,stereoWidth,voicing:voicingSettings,oscBass:oscBassSettings,sub:subSettings,clock:clockSettings,suite:suiteSettings,filterRouting:filterRoutingSettings,delay:delaySettings,reverb:reverbSettings,sound:soundSettings,macroVersions:{suite:2,motion:motionRecipe.version}},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='blocks-synth-patch.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
$('import').addEventListener('change',async e=>{
  try{
    const file=e.target.files[0];if(!file)return;if(file.size>65536)throw Error('Patch exceeds 64 KiB');
    const patch=JSON.parse(await file.text());
    const p=validateCurrentPatch(patch,parameters,version);instrument.loadPatch(p.values,'custom',p.performance,p);error('');
  }catch(e){error(String(e));}finally{e.target.value='';}
});

function bindMidi(){if(!access)return;for(const input of access.inputs.values())input.onmidimessage=e=>{const[status,d1,d2]=e.data,type=status&240,channel=status&15;if(type===144)event(d2?0:1,d1,d2/127,0,channel);else if(type===128)event(1,d1,0,0,channel);else if(type===176&&d1===64)event(4,0,d2>=64?1:0,0,channel);else if(type===176&&(d1===120||d1===123))panic();};$('midi').textContent=access.inputs.size?`MIDI Ã‚· ${access.inputs.size} input(s)`:'MIDI Ã‚· no input';}
$('midi').addEventListener('click',async()=>{try{if(!navigator.requestMIDIAccess)throw Error('This browser does not support Web MIDI');access??=await navigator.requestMIDIAccess({sysex:false});access.onstatechange=()=>{panic();bindMidi();};bindMidi();}catch(e){error(String(e));}});
window.addEventListener('blur',panic);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',()=>{panic();context?.close();});
