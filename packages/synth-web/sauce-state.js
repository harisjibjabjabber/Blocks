import {DEFAULT_PERFORMANCE,normalizePerformance,toCorePerformance} from './performance-state.js';
export const DEFAULT_RACK=Object.freeze({version:1,audio:[],notes:[],order:[]});
const bounded=(x,lo,hi)=>{if(!Number.isFinite(x))throw Error('Invalid Sauce amount');return Math.max(lo,Math.min(hi,x));};
export function normalizeRack(input=DEFAULT_RACK){
 if(!input||input.version!==1||!Array.isArray(input.audio)||input.audio.length>16||!Array.isArray(input.notes)||input.notes.length>16)throw Error('Invalid Sauce rack');
 const ids=new Set(),primaries=new Set();const identity=(b,lane)=>{if(!b||!Number.isInteger(b.id)||b.id<1||b.id>0x7fffffff||ids.has(b.id)||typeof b.primary!=='boolean'||typeof b.enabled!=='boolean')throw Error('Invalid Sauce block');ids.add(b.id);if(b.primary){const key=lane+':'+b.type;if(primaries.has(key))throw Error('Duplicate primary Sauce block');primaries.add(key);}};
 const audio=input.audio.map(b=>{identity(b,'audio');if(b.type!=='fullness')throw Error('Unsupported audio block');return{id:b.id,type:b.type,primary:b.primary,enabled:b.enabled,amount:bounded(b.amount,0,1)};});
 const notes=input.notes.map(b=>{identity(b,'notes');if(!['arp','strum','drop'].includes(b.type))throw Error('Unsupported note block');const performance=normalizePerformance({...DEFAULT_PERFORMANCE,...b.performance,mode:b.type==='drop'?'off':b.type,mono:false});return{id:b.id,type:b.type,primary:b.primary,enabled:b.enabled,performance,amount:bounded(b.amount??120,0,2400),time:bounded(b.time??.12,.001,4),bend:bounded(b.bend??0,-2,2)};});
 const known=new Set([...notes.map(b=>'notes:'+b.id),...audio.map(b=>'audio:'+b.id)]);
 const supplied=input.order??[];
 if(!Array.isArray(supplied)||supplied.length>35)throw Error('Invalid Sauce layout order');
 const seen=new Set();for(const key of supplied){if(typeof key!=='string'||! /^(audio|notes|lfo):[1-9][0-9]*$/.test(key)||Number(key.split(':')[1])>0x7fffffff||seen.has(key))throw Error('Invalid or duplicate Sauce layout key');seen.add(key);}
 // Structural edits can leave old layout references. Prune removed note/audio
 // cards; LFO availability is reconciled against modulation when displayed.
 const order=supplied.filter(key=>key.startsWith('lfo:')?key!=='lfo:1':known.has(key));
 for(const key of known)if(!order.includes(key))order.push(key);
 const rank=new Map(order.map((key,i)=>[key,i]));audio.sort((a,b)=>rank.get('audio:'+a.id)-rank.get('audio:'+b.id));notes.sort((a,b)=>rank.get('notes:'+a.id)-rank.get('notes:'+b.id));
 return{version:1,audio,notes,order};
}
export function rackVisualOrder(input,modulation={sources:[]}){
 const rack=normalizeRack(input),available=[...rack.notes.map(b=>'notes:'+b.id),...rack.audio.map(b=>'audio:'+b.id),...modulation.sources.filter(s=>s.id!==1).map(s=>'lfo:'+s.id)],known=new Set(available);
 const order=rack.order.filter(key=>known.has(key));for(const key of available)if(!order.includes(key))order.push(key);return order;
}
export function syncRackOrder(input,modulation){const rack=normalizeRack(input);rack.order=rackVisualOrder(rack,modulation);return rack;}
export function reorderRack(input,modulation,keys){
 const rack=normalizeRack(input),available=rackVisualOrder(rack,modulation);
 if(!Array.isArray(keys)||keys.length!==available.length||new Set(keys).size!==keys.length||keys.some(key=>!available.includes(key)))throw Error('Invalid Sauce reorder');
 const byKey=new Map([...rack.audio.map(b=>['audio:'+b.id,b]),...rack.notes.map(b=>['notes:'+b.id,b])]);
 rack.audio=keys.filter(key=>key.startsWith('audio:')).map(key=>byKey.get(key));rack.notes=keys.filter(key=>key.startsWith('notes:')).map(key=>byKey.get(key));rack.order=[...keys];return normalizeRack(rack);
}
export function hydrateRack(input,values){const r=normalizeRack(input);for(const b of r.audio)if(b.primary){b.amount=values[18];b.enabled=values[39]>=.5;}for(const b of r.notes)if(b.type==='drop'&&b.primary){b.amount=values[15];b.time=values[16];b.bend=values[17];b.enabled=values[37]>=.5;}return r;}
export function nextBlockId(rack){const r=normalizeRack(rack);return Math.max(0,...r.audio.map(b=>b.id),...r.notes.map(b=>b.id))+1;}
export function newSauceBlock(rack,type){const id=nextBlockId(rack);if(type==='fullness')return{id,type,primary:false,enabled:true,amount:0};if(!['arp','strum','drop'].includes(type))throw Error('Unsupported Sauce type');return{id,type,primary:false,enabled:true,performance:normalizePerformance({...DEFAULT_PERFORMANCE,mode:type==='drop'?'off':type,mono:false}),amount:0,time:.12,bend:0};}
export function toCoreSauce(input){return{version:1,blocks:normalizeRack(input).audio.map(b=>({id:b.id,type:1,primary:Number(b.primary),enabled:Number(b.enabled),amount:b.amount}))};}
export function toCoreNotes(input){return{version:1,blocks:normalizeRack(input).notes.map(b=>({id:b.id,type:['arp','strum','drop'].indexOf(b.type),primary:Number(b.primary),enabled:Number(b.enabled),perf:toCorePerformance(b.performance),drop_amount:b.amount,drop_time:b.time,drop_bend:b.bend}))};}
