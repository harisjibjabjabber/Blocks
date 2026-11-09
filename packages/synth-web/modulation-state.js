export const MOD_TARGETS=Object.freeze([0,2,3,11,12,13,14,18,21,22,23,24]);
export const LFO_WAVES=Object.freeze(['sine','triangle','saw','square','random']);
export const MOD_DIVISIONS=Object.freeze({'1/1':[1,0],'1/2':[2,0],'1/4':[4,0],'1/8':[8,0],'1/16':[16,0],'1/32':[32,0],'1/64':[64,0],'1/8T':[8,1],'1/16T':[16,1]});
export function defaultLfo(id=1){return{id,enabled:false,waveform:'sine',rate:1,synced:false,division:'1/4',intensity:1,routes:[{parameter:11,depth:.3},{parameter:0,depth:.2}]};}
export const DEFAULT_MODULATION=Object.freeze({version:1,sources:[defaultLfo()]});
const bounded=(x,min,max)=>{if(!Number.isFinite(x))throw Error('Invalid modulation value');return Math.max(min,Math.min(max,x));};
export function normalizeModulation(input=DEFAULT_MODULATION){
 if(!input||input.version!==1||!Array.isArray(input.sources)||input.sources.length<1||input.sources.length>4)throw Error('Invalid modulation configuration');
 const ids=new Set();const sources=input.sources.map(s=>{
  if(!s||!Number.isInteger(s.id)||s.id<1||s.id>0x7fffffff||ids.has(s.id)||typeof s.enabled!=='boolean'||typeof s.synced!=='boolean'||!LFO_WAVES.includes(s.waveform)||!Object.hasOwn(MOD_DIVISIONS,s.division)||!Array.isArray(s.routes)||s.routes.length>8)throw Error('Invalid LFO source');ids.add(s.id);
  const targets=new Set();const routes=s.routes.map(r=>{if(!r||!MOD_TARGETS.includes(r.parameter)||targets.has(r.parameter))throw Error('Invalid or duplicate LFO destination');targets.add(r.parameter);return{parameter:r.parameter,depth:bounded(r.depth,-1,1)};});
  return{id:s.id,enabled:s.enabled,waveform:s.waveform,rate:bounded(s.rate,.05,20),synced:s.synced,division:s.division,intensity:bounded(s.intensity,0,1),routes};
 });if(!ids.has(1))throw Error('Main LFO source is required');return{version:1,sources};
}
export function toCoreModulation(input){const s=normalizeModulation(input);return{version:1,sources:s.sources.map(l=>({id:l.id,enabled:Number(l.enabled),waveform:LFO_WAVES.indexOf(l.waveform),synced:Number(l.synced),division:MOD_DIVISIONS[l.division][0],triplet:MOD_DIVISIONS[l.division][1],rate_hz:l.rate,intensity:l.intensity,routes:l.routes.map(r=>({parameter_id:r.parameter,depth:r.depth}))}))};}
