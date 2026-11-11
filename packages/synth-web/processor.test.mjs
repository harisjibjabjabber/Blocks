import {normalizeReverb,toCoreReverb,REVERB_FIELDS} from './reverb-state.js';
import {normalizeSuite,toCoreSuite,SUITE_FLOATS,SUITE_UINTS} from './suite-state.js';
// Worklet unit tests with a fake renderer. These verify telemetry/copying only;
// actual DSP output is covered by the separate core and real-browser suites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('./processor.js',import.meta.url),'utf8');

async function fixture(){
  const memory={buffer:new ArrayBuffer(65536)},floats=new Float32Array(memory.buffer),messages=[];
  let scope=Array.from({length:128},(_,i)=>(i-64)/128),scopeCount=128;let width=1;let registered,next=1024,samples=[[],[]],renderCalls=0;const renderedEvents=[],patchCalls=[],performanceCalls=[];
  const performanceFields=['version','mode','order','division','triplet','seed','mono','bpm','curl','gate','strum_ms','randomness'];
  let performance={version:1,mode:0,order:0,division:8,triplet:0,seed:0xc0ffee,mono:0,bpm:120,curl:0,gate:.7,strum_ms:35,randomness:.25};
  const rackCalls={clock:[],sub:[],osc_bass:[],sauce:[],modulation:[],notes:[],voicing:[],filter_routing:[],delay:[],reverb:[],sound:[],harmonics_suite:[]},rackApi={};
  for(const [kind,size]of[['clock',12],['sub',32],['osc_bass',80],['sauce',328],['modulation',2232],['notes',1224],['voicing',32],['filter_routing',8],['delay',40],['reverb',64],['sound',16],['harmonics_suite',204]]){let bytes=new Uint8Array(size);new DataView(bytes.buffer).setUint32(0,kind==='modulation'?3:kind==='voicing'?2:1,true);const suffix=kind==='modulation'?'_v3':(kind==='voicing'||kind==='osc_bass')?'_v2':'';rackApi['bs_get_'+kind+suffix]=(_s,p)=>{new Uint8Array(memory.buffer,p,size).set(bytes);return 1;};rackApi['bs_set_'+kind+suffix]=(_s,p)=>{bytes=Uint8Array.from(new Uint8Array(memory.buffer,p,size));rackCalls[kind].push(Array.from(bytes));return 1;};}
  const api={memory,...rackApi,bs_get_reverb_scope:(s,p,capacity)=>{assert.equal(s,1);assert.equal(capacity,128);new Float32Array(memory.buffer,p,128).set(scope);return scopeCount;},bs_output_latency:s=>{assert.equal(s,1);return 48;},bs_get_output_meters:(_s,p)=>{new Float32Array(memory.buffer,p,3).set([1.25,.95,2.4]);return 1;},bs_get_harmonics_suite_meters:(_s,p)=>{new Float32Array(memory.buffer,p,11).set([.2,.4,3,5,-30,-20,-10,1,-2,3,-4]);return 1;},bs_set_stereo_width:(_s,value)=>{width=value;return 1;},bs_get_stereo_width:()=>width,
    bs_get_performance:(_s,p)=>{const v=new DataView(memory.buffer);performanceFields.forEach((key,i)=>i<7?v.setUint32(p+i*4,performance[key],true):v.setFloat32(p+i*4,performance[key],true));return 1;},
    bs_set_performance:(_s,p)=>{const v=new DataView(memory.buffer),next={};performanceFields.forEach((key,i)=>next[key]=i<7?v.getUint32(p+i*4,true):v.getFloat32(p+i*4,true));performanceCalls.push({config:next,bytes:Array.from(new Uint8Array(memory.buffer,p,48))});performance=next;return 1;},
    bs_performance_pending:()=>performance.curl!==0?1:0,
    bs_create:()=>1,bs_prepare:()=>1,malloc:bytes=>{const p=next;next+=bytes;return p;},
    bs_parameter_count:()=>44,bs_parameter_info:()=>0,bs_get_parameter:()=>0,bs_abi_version:()=>7,
    bs_set_patch:(_s,p)=>{const view=new DataView(memory.buffer),version=view.getUint32(p,true),n=44;patchCalls.push({version,values:Array.from({length:n},(_,i)=>view.getFloat32(p+4+i*4,true))});return 1;},
    bs_get_osc_bass_phase:(_s,osc)=>osc===0?.25:.75,bs_get_modulation_phase:(_s,id)=>id===1?.25:-1,bs_active_voices:()=>3,bs_render:(_s,l,r,frames,eventPointer,eventCount)=>{renderCalls++;const view=new DataView(memory.buffer);for(let i=0;i<eventCount;i++){const p=eventPointer+i*24;renderedEvents.push({offset:view.getUint32(p,true),id:view.getUint32(p+16,true),value:view.getFloat32(p+20,true)});}for(let i=0;i<frames;i++){floats[l/4+i]=samples[0][i]??0;floats[r/4+i]=samples[1][i]??0;}return 0;}};
  const context=vm.createContext({AudioWorkletProcessor:class{constructor(){this.port={postMessage:value=>messages.push(value)};}},
    WebAssembly:{instantiate:async()=>({instance:{exports:api}})},sampleRate:48000,currentFrame:0,
    registerProcessor:(name,processor)=>{assert.equal(name,'blocks-synth');registered=processor;}});
  vm.runInContext(source,context,{filename:'processor.js'});
  const processor=new registered({processorOptions:{wasm:new Uint8Array()}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(processor.ready,true);
  return {setScope:(values,count=128)=>{scope=values;scopeCount=count;},get width(){return width;},messages,renderedEvents,patchCalls,performanceCalls,rackCalls,message:m=>processor.message(m),get queued(){return processor.count;},get renderCalls(){return renderCalls;},block(left=[],right=[],channels=2){
    samples=[left,right];const outputs=Array.from({length:channels},()=>new Float32Array(4));
    assert.equal(processor.process([], [outputs]),true);context.currentFrame+=4;return outputs;
  },statuses(){return messages.filter(m=>m.kind==='status');}};
}

test('stereo telemetry preserves output and retains an early right-channel peak across24 blocks',async()=>{
  const f=await fixture(),left=[.1,-.2,.3,-.4],right=[0,1.125,-.6,.2];
  const output=f.block(left,right);assert.deepEqual(output[0],Float32Array.from(left));assert.deepEqual(output[1],Float32Array.from(right));
  for(let i=1;i<23;i++)f.block();assert.equal(f.statuses().length,0);
  f.block();const status=f.statuses()[0];assert.equal(status.peak,1.125);assert.equal(status.clipped,true);assert.equal(status.nonFinite,false);assert.equal(status.voices,3);assert.equal(status.invalid,0);assert.equal(f.renderCalls,24);
  for(let i=0;i<24;i++)f.block();const reset=f.statuses()[1];assert.equal(reset.peak,0);assert.equal(reset.clipped,false);assert.equal(reset.nonFinite,false);
});

test('negative left peaks and exact full scale clip; sub-full-scale output does not',async()=>{
  const f=await fixture();for(let i=0;i<24;i++)f.block(i===7?[-1]:[],[]);
  assert.equal(f.statuses()[0].peak,1);assert.equal(f.statuses()[0].clipped,true);
  for(let i=0;i<24;i++)f.block(i===2?[-.999]:[],i===19?[.98]:[]);
  assert.equal(f.statuses()[1].peak,Math.abs(Math.fround(-.999)));assert.equal(f.statuses()[1].clipped,false);
});

test('invalid audio is reported separately without poisoning finite peaks or modifying output',async()=>{
  const f=await fixture(),out=f.block([NaN,.5],[-Infinity,.75]);assert.ok(Number.isNaN(out[0][0]));assert.equal(out[1][0],-Infinity);
  for(let i=1;i<24;i++)f.block();const status=f.statuses()[0];assert.equal(status.peak,.75);assert.equal(status.clipped,false);assert.equal(status.nonFinite,true);
  for(let i=0;i<24;i++)f.block();assert.equal(f.statuses()[1].nonFinite,false);
});

test('a mono output measures only the channel actually copied',async()=>{
  const f=await fixture();for(let i=0;i<24;i++)f.block([.25],[1.5],1);
  assert.equal(f.statuses()[0].peak,.25);assert.equal(f.statuses()[0].clipped,false);
});


test('parameter batch queues atomically at one frame in alias-preserving order',async()=>{
 const f=await fixture();f.message({kind:'parameter-batch',frame:2,values:[{id:1,value:.2},{id:21,value:.7},{id:22,value:.4}]});assert.equal(f.queued,3);f.block();assert.equal(f.queued,0);
 assert.deepEqual(f.renderedEvents.map(e=>[e.offset,e.id]),[[2,1],[2,21],[2,22]]);assert.equal(f.renderedEvents[1].value,Math.fround(.7));
});

test('invalid or overflowing parameter batch preserves the existing queue completely',async()=>{
 const f=await fixture();f.message({kind:'parameter-batch',values:[{id:23,value:.5}]});
 for(const values of [[{id:21,value:.1},{id:999,value:.4}],[{id:21,value:NaN}],[],Array.from({length:1024},()=>({id:21,value:.1}))]){f.message({kind:'parameter-batch',values});assert.equal(f.queued,1);}
 assert.equal(f.messages.filter(m=>m.kind==='error').length,4);f.block();assert.equal(f.renderedEvents.length,1);assert.equal(f.renderedEvents[0].id,23);
});


test('current44-value patch validates atomically and rejects old formats',async()=>{
 const f=await fixture();f.message({kind:'patch',version:7,values:Array.from({length:44},(_,i)=>i/100)});assert.equal(f.patchCalls.length,1);assert.equal(f.patchCalls[0].values.length,44);
 const bad=[...Array.from({length:6},(_,i)=>({kind:'patch',version:i+1,values:Array(44).fill(0)})),{kind:'patch',version:7,values:Array(42).fill(0)},{kind:'patch',version:7,values:[...Array(43).fill(0),NaN]}];for(const m of bad)f.message(m);assert.equal(f.patchCalls.length,1);assert.equal(f.messages.filter(m=>m.kind==='error').length,bad.length);
});

test('performance bridge encodes48-byte fields and exposes pending state without altering tone automation',async()=>{
 const f=await fixture(),ready=f.messages.find(m=>m.kind==='ready');assert.equal(ready.performance.mode,0);assert.equal(ready.performance.bpm,120);
 f.message({kind:'event',type:0,key:60,channel:0,value:.8});f.message({kind:'parameter-batch',values:[{id:11,value:400}]});
 const config={version:1,mode:1,order:3,division:16,triplet:1,seed:4294967295,mono:1,bpm:137,curl:.4,gate:.55,strum_ms:72,randomness:.8};f.message({kind:'performance',config});assert.equal(f.performanceCalls.length,1);assert.equal(f.queued,1);
 const actual=f.performanceCalls[0],view=new DataView(Uint8Array.from(actual.bytes).buffer);assert.equal(view.byteLength,48);assert.equal(view.getUint32(20,true),4294967295);assert.equal(view.getUint32(24,true),1);assert.equal(view.getFloat32(28,true),137);assert.equal(view.getFloat32(32,true),Math.fround(.4));assert.equal(view.getFloat32(44,true),Math.fround(.8));
 for(let i=0;i<24;i++)f.block();assert.equal(f.statuses()[0].performancePending,true);assert.deepEqual(f.renderedEvents.map(e=>e.id),[11]);
 f.message({kind:'performance',config:{...config,curl:0}});for(let i=0;i<24;i++)f.block();assert.equal(f.statuses()[1].performancePending,false);
});

test('invalid performance settings reject the entire message and preserve queued input/tone targets',async()=>{
 const f=await fixture(),base={version:1,mode:0,order:0,division:8,triplet:0,seed:12,mono:0,bpm:120,curl:0,gate:.7,strum_ms:35,randomness:.25};f.message({kind:'event',type:0,key:60,channel:0,value:.8});f.message({kind:'parameter-batch',values:[{id:11,value:400}]});
 const invalid=[{version:2},{mode:3},{order:4},{division:12},{division:32,triplet:1},{division:64,triplet:1},{triplet:true},{seed:-1},{seed:4294967296},{mono:2},{bpm:NaN},{curl:-.81},{gate:.96},{strum_ms:101},{randomness:Infinity}];for(const change of invalid){f.message({kind:'performance',config:{...base,...change}});assert.equal(f.queued,2);}assert.equal(f.performanceCalls.length,0);assert.equal(f.messages.filter(m=>m.kind==='error').length,invalid.length);
});

test('straight32/64 performance divisions retain exact bridge values',async()=>{
 const f=await fixture(),base={version:1,mode:1,order:0,division:32,triplet:0,seed:12,mono:0,bpm:240,curl:.8,gate:.1,strum_ms:35,randomness:.25};
 for(const division of [32,64]){f.message({kind:'performance',config:{...base,division}});const bytes=f.performanceCalls.at(-1).bytes;assert.equal(new DataView(Uint8Array.from(bytes).buffer).getUint32(12,true),division);}
 assert.equal(f.performanceCalls.length,2);const echoed=f.messages.findLast(m=>m.kind==='performance').config;f.message({kind:'performance',config:echoed});assert.equal(f.performanceCalls.length,3);assert.equal(f.messages.filter(m=>m.kind==='error').length,0);
});

test('audio rack bridge preserves328-byte layout and duplicates; invalid whole graphs never touch core or queued notes',async()=>{
 const f=await fixture(),config={version:1,blocks:[{id:8,type:1,primary:1,enabled:1,amount:.4},{id:19,type:1,primary:0,enabled:0,amount:.25},{id:22,type:1,primary:0,enabled:1,amount:.7}]};f.message({kind:'event',type:0,key:60,channel:0,value:1});f.message({kind:'sauce',config});assert.equal(f.queued,1);assert.equal(f.rackCalls.sauce.length,1);const bytes=Uint8Array.from(f.rackCalls.sauce[0]),v=new DataView(bytes.buffer);assert.equal(bytes.length,328);assert.equal(v.getUint32(4,true),3);assert.equal(v.getUint32(28,true),19);assert.equal(v.getUint32(40,true),0);assert.equal(v.getFloat32(44,true),.25);assert.equal(v.getFloat32(64,true),Math.fround(.7));assert.equal(f.messages.findLast(m=>m.kind==='sauce').config.blocks[1].id,19);
 const invalid=[{...config,version:2},{...config,blocks:Array(17).fill(config.blocks[0])},{...config,blocks:[config.blocks[0],config.blocks[0]]},{...config,blocks:[config.blocks[0],{...config.blocks[1],primary:1}]},{...config,blocks:[{...config.blocks[0],amount:NaN}]},{...config,blocks:[{...config.blocks[0],amount:-.1}]},{...config,blocks:[{...config.blocks[0],enabled:true}]}];for(const c of invalid)f.message({kind:'sauce',config:c});assert.equal(f.rackCalls.sauce.length,1);assert.equal(f.queued,1);assert.equal(f.messages.filter(m=>m.kind==='error').length,invalid.length);
});

test('current modulation preserves2232-byte sources/routes and rejects invalid routing atomically',async()=>{
 const f=await fixture(),source={retrigger:0,points:[{x:0,y:0,bend:0},{x:1,y:0,bend:0}],id:4294967295,enabled:1,waveform:4,synced:1,division:16,triplet:1,rate_hz:2.5,intensity:.7,routes:[{target_kind:0,target_id:0,parameter_id:11,depth:-.3},{target_kind:0,target_id:0,parameter_id:0,depth:.2}]},config={version:3,sources:[source,{...source,id:2,division:64,triplet:0}]};f.message({kind:'modulation',config});assert.equal(f.rackCalls.modulation.length,1);const bytes=Uint8Array.from(f.rackCalls.modulation[0]),v=new DataView(bytes.buffer);assert.equal(bytes.length,2232);assert.equal(v.getUint32(4,true),2);assert.equal(v.getUint32(8,true),4294967295);assert.equal(v.getFloat32(32,true),2.5);assert.equal(v.getFloat32(36,true),Math.fround(.7));assert.equal(v.getUint32(40,true),2);assert.equal(v.getUint32(52,true),11);assert.equal(v.getFloat32(56,true),Math.fround(-.3));assert.equal(v.getUint32(564,true),2);assert.equal(f.messages.findLast(m=>m.kind==='modulation').config.sources[1].division,64);
 const invalid=[{...source,id:-1},{...source,waveform:6},{...source,rate_hz:Infinity},{...source,intensity:1.01},{...source,division:64,triplet:1},{...source,routes:[{target_kind:0,target_id:0,parameter_id:40,depth:.5}]},{...source,routes:[{target_kind:0,target_id:0,parameter_id:11,depth:.5},{target_kind:0,target_id:0,parameter_id:11,depth:.2}]},{...source,routes:Array(9).fill({target_kind:0,target_id:0,parameter_id:11,depth:.2})}];for(const s of invalid)f.message({kind:'modulation',config:{version:3,sources:[s]}});f.message({kind:'modulation',config:{version:3,sources:[source,source]}});f.message({kind:'modulation',config:{version:3,sources:Array(5).fill(source)}});assert.equal(f.rackCalls.modulation.length,1);assert.equal(f.messages.filter(m=>m.kind==='error').length,invalid.length+2);
});

test('note rack bridge encodes1224-byte cascading generators/Drop and preserves queued input on invalid or settings-only changes',async()=>{
 const f=await fixture(),perf={version:1,mode:1,order:2,division:64,triplet:0,seed:123,mono:0,bpm:139,curl:.3,gate:.6,strum_ms:42,randomness:.7},config={version:1,blocks:[{id:3,type:0,primary:0,enabled:1,perf},{id:9,type:2,primary:1,enabled:1,drop_amount:700,drop_time:.4,drop_bend:-.7}]};f.message({kind:'event',type:0,key:60,channel:0,value:1});f.message({kind:'parameter-batch',values:[{id:11,value:500}]});f.message({kind:'notes',config});assert.equal(f.queued,1);const bytes=Uint8Array.from(f.rackCalls.notes[0]),v=new DataView(bytes.buffer);assert.equal(bytes.length,1224);assert.equal(v.getUint32(4,true),2);assert.equal(v.getUint32(24,true),1);assert.equal(v.getUint32(36,true),64);assert.equal(v.getFloat32(52,true),139);assert.equal(v.getUint32(84,true),9);assert.equal(v.getFloat32(148,true),700);assert.equal(v.getFloat32(152,true),Math.fround(.4));assert.equal(v.getFloat32(156,true),Math.fround(-.7));assert.equal(f.messages.findLast(m=>m.kind==='notes').config.blocks[0].perf.curl,Math.fround(.3));
 f.message({kind:'event',type:0,key:64,channel:0,value:1});const changed={...config,blocks:[{...config.blocks[0],perf:{...perf,bpm:144}},config.blocks[1]]};f.message({kind:'notes',config:changed});assert.equal(f.queued,2);assert.equal(f.rackCalls.notes.length,2);
 const bad=[{...config.blocks[0],primary:1},{...config.blocks[0],perf:{...perf,mono:1}},{...config.blocks[0],perf:{...perf,mode:2}},{...config.blocks[1],drop_amount:NaN},{...config.blocks[1],drop_time:0},{...config.blocks[1],drop_bend:3}];for(const block of bad)f.message({kind:'notes',config:{version:1,blocks:[block]}});assert.equal(f.rackCalls.notes.length,2);assert.equal(f.queued,2);assert.equal(f.messages.filter(m=>m.kind==='error').length,bad.length);
});

test('Resonance is a continuous modulation route; filter mode is rejected atomically',async()=>{
 const f=await fixture(),source={retrigger:0,points:[{x:0,y:0,bend:0},{x:1,y:0,bend:0}],id:1,enabled:1,waveform:0,synced:0,division:4,triplet:0,rate_hz:1,intensity:.5,routes:[{target_kind:0,target_id:0,parameter_id:42,depth:.6}]};
 f.message({kind:'modulation',config:{version:3,sources:[source]}});assert.equal(f.rackCalls.modulation.length,1);
 f.message({kind:'modulation',config:{version:3,sources:[{...source,routes:[{target_kind:0,target_id:0,parameter_id:43,depth:.6}]}]}});assert.equal(f.rackCalls.modulation.length,1);assert.equal(f.messages.at(-1).kind,'error');
});

test('custom LFO bridge preserves retrigger/curve bytes and rejects every invalid shape atomically',async()=>{
 const f=await fixture(),source={id:1,enabled:1,waveform:5,synced:1,division:8,triplet:1,rate_hz:1.1,intensity:.7,retrigger:1,points:[{x:0,y:-1,bend:.8},{x:.4,y:.3,bend:-.5},{x:1,y:.7,bend:0}],routes:[{target_kind:0,target_id:0,parameter_id:11,depth:.4}]};
 f.message({kind:'event',type:0,key:60,channel:0,value:1});f.message({kind:'modulation',config:{version:3,sources:[source]}});assert.equal(f.rackCalls.modulation.length,1);assert.equal(f.queued,1);
 const view=new DataView(Uint8Array.from(f.rackCalls.modulation[0]).buffer);assert.equal(view.byteLength,2232);assert.equal(view.getUint32(0,true),3);assert.equal(view.getUint32(172,true),1);assert.equal(view.getUint32(176,true),3);assert.equal(view.getFloat32(184,true),-1);assert.equal(view.getFloat32(188,true),Math.fround(.8));assert.equal(view.getFloat32(192,true),Math.fround(.4));assert.equal(view.getFloat32(200,true),-.5);
 const returned=f.messages.findLast(m=>m.kind==='modulation').config.sources[0];assert.equal(returned.points.length,3);assert.equal(returned.retrigger,1);assert.equal(returned.points.at(-1).y,Math.fround(.7));
 const bad=[{...source,retrigger:2},{...source,points:[]},{...source,points:Array(17).fill(source.points[0])},{...source,points:[source.points[0],{x:0,y:1,bend:0},source.points[2]]},{...source,points:[{x:.1,y:0,bend:0},source.points[2]]},{...source,points:[source.points[0],{x:1,y:2,bend:0}]},{...source,points:[source.points[0],{x:1,y:0,bend:NaN}]}];
 for(const s of bad)f.message({kind:'modulation',config:{version:3,sources:[s]}});assert.equal(f.rackCalls.modulation.length,1);assert.equal(f.queued,1);assert.equal(f.messages.filter(m=>m.kind==='error').length,bad.length);
 for(let i=0;i<24;i++)f.block();assert.deepEqual(JSON.parse(JSON.stringify(f.statuses().at(-1).lfoPhases)),[{id:1,phase:.25}]);
});

test('width validates direct configuration and sample-offset event before altering state or queue',async()=>{
 const f=await fixture();assert.equal(f.width,1);f.message({kind:'stereo-width',value:1.6});assert.equal(f.width,1.6);
 for(const value of[-1,2.1,NaN,Infinity]){f.message({kind:'stereo-width',value});f.message({kind:'event',type:5,value});}assert.equal(f.width,1.6);assert.equal(f.queued,0);
 f.message({kind:'event',type:5,value:.4,frame:2});assert.equal(f.queued,1);f.block();assert.equal(f.renderedEvents.at(-1).offset,2);assert.equal(f.renderedEvents.at(-1).value,Math.fround(.4));
});
test('v3 carries32 custom points and distinguishes all typed destination identities atomically',async()=>{
 const f=await fixture(),points=Array.from({length:32},(_,i)=>({x:i/31,y:Math.sin(i),bend:0})),source={id:1,enabled:1,waveform:5,synced:0,division:4,triplet:0,rate_hz:1,intensity:1,retrigger:0,points,routes:[{target_kind:0,target_id:0,parameter_id:11,depth:.2},{target_kind:1,target_id:7,parameter_id:0,depth:-.5},{target_kind:2,target_id:1,parameter_id:0,depth:.3},{target_kind:2,target_id:2,parameter_id:1,depth:.8}]};
 f.message({kind:'modulation',config:{version:3,sources:[source]}});assert.equal(f.rackCalls.modulation.length,1);const returned=JSON.parse(JSON.stringify(f.messages.findLast(m=>m.kind==='modulation').config.sources[0]));assert.equal(returned.points.length,32);assert.deepEqual(returned.routes.map(r=>[r.target_kind,r.target_id,r.parameter_id]),[[0,0,11],[1,7,0],[2,1,0],[2,2,1]]);
 const invalid=[{...source,routes:[{...source.routes[0],target_kind:9}]},{...source,routes:[{...source.routes[1],parameter_id:1}]},{...source,routes:[{...source.routes[2],parameter_id:2}]},{...source,routes:[source.routes[1],source.routes[1]]},{...source,points:[...points,points.at(-1)]}];for(const s of invalid)f.message({kind:'modulation',config:{version:3,sources:[s]}});assert.equal(f.rackCalls.modulation.length,1);
});

test('voicing v2 and filter routing encode independent native fields atomically without clearing notes',async()=>{
 const f=await fixture();f.message({kind:'event',type:0,frame:100,key:60,channel:0,value:.7});
 const c={version:2,reserved:0,oscillators:[{count:2,detune_cents:7.5,spread:.25},{count:6,detune_cents:31,spread:.75}]};f.message({kind:'voicing',config:c});
 const v=new DataView(Uint8Array.from(f.rackCalls.voicing[0]).buffer);assert.deepEqual([v.getUint32(0,true),v.getUint32(4,true),v.getUint32(8,true),v.getUint32(20,true)],[2,0,2,6]);assert.deepEqual([12,16,24,28].map(p=>v.getFloat32(p,true)),[7.5,.25,31,.75]);
 assert.equal(f.messages.filter(m=>m.kind==='voicing').at(-1).config.oscillators[1].count,6);
 for(const config of[{...c,reserved:1},{...c,oscillators:[c.oscillators[0],{...c.oscillators[1],count:8}]},{...c,oscillators:[c.oscillators[0]]}])f.message({kind:'voicing',config});assert.equal(f.rackCalls.voicing.length,1);
 for(let mask=0;mask<4;mask++){f.message({kind:'filter-routing',config:{version:1,mask}});const r=new DataView(Uint8Array.from(f.rackCalls.filter_routing.at(-1)).buffer);assert.equal(r.byteLength,8);assert.equal(r.getUint32(0,true),1);assert.equal(r.getUint32(4,true),mask);assert.equal(f.messages.filter(m=>m.kind==='filter-routing').at(-1).config.mask,mask);}
 for(const mask of[-1,4,1.5,NaN])f.message({kind:'filter-routing',config:{version:1,mask}});assert.equal(f.rackCalls.filter_routing.length,4);
 assert.equal(f.queued,1);
});

test('current voicing and delay validate each field atomically',async()=>{
 const f=await fixture();f.message({kind:'event',type:0,key:60,channel:0,value:.7});const voice={version:2,reserved:0,oscillators:[{count:7,detune_cents:12.5,spread:.8},{count:7,detune_cents:12.5,spread:.8}]},delay={version:1,enabled:1,mode:1,synced:1,division:8,triplet:1,time_seconds:.4,feedback:.65,wet:.3,damping_hz:6000};
 f.message({kind:'voicing',config:voice});f.message({kind:'delay',config:delay});assert.equal(f.queued,1);const v=new DataView(Uint8Array.from(f.rackCalls.voicing[0]).buffer),d=new DataView(Uint8Array.from(f.rackCalls.delay[0]).buffer);assert.equal(v.byteLength,32);assert.equal(v.getUint32(0,true),2);assert.equal(v.getUint32(4,true),0);for(const offset of[8,20]){assert.equal(v.getUint32(offset,true),7);assert.equal(v.getFloat32(offset+4,true),12.5);assert.equal(v.getFloat32(offset+8,true),Math.fround(.8));}assert.equal(d.byteLength,40);assert.deepEqual(Array.from({length:6},(_,i)=>d.getUint32(i*4,true)),[1,1,1,1,8,1]);assert.deepEqual(Array.from({length:4},(_,i)=>d.getFloat32(24+i*4,true)),[.4,.65,.3,6000].map(Math.fround));
 for(const patch of[{count:0},{count:8},{count:2.5},{detune_cents:NaN},{detune_cents:51},{spread:1.1}])f.message({kind:'voicing',config:{...voice,oscillators:[voice.oscillators[0],{...voice.oscillators[1],...patch}]}});
 for(const patch of[{enabled:true},{mode:2},{division:1},{division:64,triplet:1},{time_seconds:0},{feedback:.91},{wet:NaN},{damping_hz:20001}])f.message({kind:'delay',config:{...delay,...patch}});assert.equal(f.rackCalls.voicing.length,1);assert.equal(f.rackCalls.delay.length,1);assert.equal(f.queued,1);
});
test('sound16-byte bridge validates atomically and retains queued input events',async()=>{const f=await fixture();f.message({kind:'event',type:0,key:60,value:.8});f.message({kind:'sound',config:{version:1,oscillator:1,filter_model:1,filter_drive:4}});assert.equal(f.queued,1);const v=new DataView(Uint8Array.from(f.rackCalls.sound[0]).buffer);assert.deepEqual([v.getUint32(0,true),v.getUint32(4,true),v.getUint32(8,true),v.getFloat32(12,true)],[1,1,1,4]);f.message({kind:'sound',config:{version:1,oscillator:2,filter_model:0,filter_drive:1}});assert.equal(f.rackCalls.sound.length,1);});

test('current oscillator Bass80byte bridge validates atomically and reports native phase',async()=>{const f=await fixture(),c={version:2,reserved:0,oscillators:[{enabled:1,voice:0,synced:0,retrigger:0,cycle_beats:.5,curl:0,spin_hz:4,motion:.65,grit:.35},{enabled:0,voice:0,synced:0,retrigger:0,cycle_beats:.5,curl:0,spin_hz:12,motion:.2,grit:.9}]};f.message({kind:'osc-bass',config:c});assert.equal(f.rackCalls.osc_bass.length,1);const v=new DataView(Uint8Array.from(f.rackCalls.osc_bass[0]).buffer);assert.equal(v.byteLength,80);assert.equal(v.getUint32(8,true),1);assert.equal(v.getFloat32(24,true),4);assert.equal(v.getUint32(44,true),0);assert.equal(v.getFloat32(60,true),12);assert.equal(f.messages.at(-1).kind,'osc-bass');f.message({kind:'event',type:0,channel:0,key:60,value:.7});const queued=f.queued;for(const bad of [{...c,reserved:1},{...c,oscillators:[c.oscillators[0],{...c.oscillators[1],motion:NaN}]},{...c,oscillators:[c.oscillators[0],{...c.oscillators[1],spin_hz:21}]}])f.message({kind:'osc-bass',config:bad});assert.equal(f.rackCalls.osc_bass.length,1);assert.equal(f.queued,queued);for(let i=0;i<24;i++)f.block();assert.deepEqual(Array.from(f.statuses().at(-1).oscBassPhases),[.25,.75]);});

test('Bass v2, shared clock and centred Sub encode exact ABI and reject atomically',async()=>{const f=await fixture(),e={enabled:1,voice:3,synced:1,retrigger:1,spin_hz:4,motion:.8,grit:.7,cycle_beats:1/3,curl:-.5},c={version:2,reserved:0,oscillators:[e,{...e,voice:2}]};f.message({kind:'event',type:0,key:36,value:.8});f.message({kind:'osc-bass',config:c});const b=new DataView(Uint8Array.from(f.rackCalls.osc_bass[0]).buffer);assert.equal(b.byteLength,80);assert.deepEqual([8,12,16,20].map(p=>b.getUint32(p,true)),[1,3,1,1]);assert.equal(b.getFloat32(36,true),Math.fround(1/3));assert.equal(b.getFloat32(40,true),-.5);f.message({kind:'clock',config:{version:1,bpm:90,beats_per_bar:3}});const k=new DataView(Uint8Array.from(f.rackCalls.clock[0]).buffer);assert.equal(k.getFloat32(4,true),90);assert.equal(k.getUint32(8,true),3);f.message({kind:'clock',config:null});assert.equal(f.messages.at(-1).kind,'error');assert.equal(f.rackCalls.clock.length,1);const sub={version:1,enabled:1,waveform:1,octave:-2,priority:1,routing:0,level:.75,reserved:0};f.message({kind:'sub',config:sub});const v=new DataView(Uint8Array.from(f.rackCalls.sub[0]).buffer);assert.equal(v.byteLength,32);assert.equal(v.getInt32(12,true),-2);assert.equal(v.getFloat32(24,true),.75);for(const config of[{...sub,reserved:1},{...sub,octave:-3},{...sub,level:NaN}])f.message({kind:'sub',config});for(const config of[{version:1,bpm:400,beats_per_bar:4},{version:1,bpm:120,beats_per_bar:0}])f.message({kind:'clock',config});f.message({kind:'osc-bass',config:{...c,oscillators:[e,{...e,voice:4}]}});assert.equal(f.rackCalls.sub.length,1);assert.equal(f.rackCalls.clock.length,1);assert.equal(f.rackCalls.osc_bass.length,1);assert.equal(f.queued,1);});



test('removed configuration formats reject without changing current native state or queued notes',async()=>{
 const f=await fixture();f.message({kind:'event',type:0,key:60,value:.8});
 const messages=[{kind:'voicing',config:{version:1,count:3,detune_cents:10,spread:.5}},{kind:'osc-bass',config:{version:1,reserved:0,oscillators:[{enabled:1,spin_hz:4,motion:.5,grit:.5},{enabled:0,spin_hz:4,motion:.5,grit:.5}]}},{kind:'modulation',config:{version:1,sources:[]}},{kind:'modulation',config:{version:2,sources:[]}},{kind:'sound',config:{version:1,oscillator:0,filter_model:0,filter_drive:1}},{kind:'clock',config:null}];
 for(const message of messages)f.message(message);
 for(const kind of['voicing','osc_bass','modulation','sound','clock'])assert.equal(f.rackCalls[kind].length,0);
 assert.equal(f.queued,1);assert.equal(f.messages.filter(m=>m.kind==='error').length,messages.length);
});

test('global Suite encodes204bytes with bands and rejects invalid configs atomically without dropping queued notes',async()=>{const f=await fixture(),c=toCoreSuite({...normalizeSuite(),enabled:true,style:'rectify',colour2Enabled:true,colour2Style:'tape',dynamics:-.6,compEnabled:true,crushEnabled:true,ottEnabled:true,driveDb:18,compMakeupDb:-12,crushRecovery:2});f.message({kind:'event',type:0,key:60,value:.8});f.message({kind:'suite',config:c});const v=new DataView(Uint8Array.from(f.rackCalls.harmonics_suite[0]).buffer);assert.equal(v.byteLength,204);SUITE_UINTS.forEach(([,key,o])=>assert.equal(v.getUint32(o,true),c[key]));SUITE_FLOATS.forEach(([,key,,,,o])=>assert.equal(v.getFloat32(o,true),Math.fround(c[key])));c.bands.forEach((b,i)=>['threshold_db','gain_db','up','down'].forEach((k,j)=>assert.equal(v.getFloat32(136+i*16+j*4,true),Math.fround(b[k]))));assert.equal(f.messages.at(-1).config.dynamics,Math.fround(-.6));for(const change of[{reserved:1},{version:1},{enabled:true},{colour_style:5},{colour2_style:5},{dynamics:-1.1},{drive_db:37},{ott_up:NaN},{comp_ratio:.5},{comp_makeup_db:-25},{crush_recovery:5},{bands:[]},{ott_low_hz:1000,ott_high_hz:1000},{comp_auto_makeup:2}])f.message({kind:'suite',config:{...c,...change}});assert.equal(f.rackCalls.harmonics_suite.length,1);assert.equal(f.queued,1);});
test('actual Suite meter fields retain units and retired audio block types reject',async()=>{const f=await fixture();for(const type of[0,2])f.message({kind:'sauce',config:{version:1,blocks:[{id:1,type,primary:0,enabled:1,amount:1}]}});assert.equal(f.rackCalls.sauce.length,0);for(let i=0;i<24;i++)f.block();const m=f.statuses().at(-1).suiteMeters;assert.equal(m.dynamicsGainDb,-4);assert.equal(m.compReductionDb,3);assert.equal(m.crushReductionDb,5);assert.deepEqual(Array.from(m.ottGainDb),[1,-2,3]);assert.deepEqual(Array.from(m.ottInputDb),[-30,-20,-10]);});

test('reverb bridge writes64 bytes and reads native state; invalid controls preserve queue/config',async()=>{
 const f=await fixture();f.message({kind:'parameter-batch',values:[{id:11,value:2000}]});
 const c=toCoreReverb({...normalizeReverb(),enabled:true,type:'shimmer',decay:12,shimmerSemitones:-7,wetWidth:1.7});f.message({kind:'reverb',config:c});
 assert.equal(f.rackCalls.reverb.length,1);assert.equal(f.queued,1);const bytes=Uint8Array.from(f.rackCalls.reverb[0]),v=new DataView(bytes.buffer);assert.equal(bytes.length,64);assert.equal(v.getUint32(0,true),1);assert.equal(v.getUint32(4,true),1);assert.equal(v.getUint32(8,true),2);
 REVERB_FIELDS.forEach(([,key],i)=>assert.equal(v.getFloat32(12+i*4,true),Math.fround(c[key]),key));
 const read=f.messages.findLast(m=>m.kind==='reverb').config;assert.equal(read.shimmer_semitones,-7);assert.equal(read.wet_width,Math.fround(1.7));
 for(const bad of[{...c,enabled:true},{...c,mode:3},{...c,version:2},...REVERB_FIELDS.map(([,key])=>({...c,[key]:NaN})),{...c,shimmer_semitones:-13},{...c,wet_width:3}])f.message({kind:'reverb',config:bad});
 assert.equal(f.rackCalls.reverb.length,1);assert.equal(f.queued,1);
});

test('output protection reports native pre/post peaks and reduction with actual instance latency',async()=>{const f=await fixture();for(let i=0;i<24;++i)f.block();const s=f.statuses()[0];assert.equal(s.outputLatency,48);assert.equal(s.outputMeters.inputPeak,1.25);assert.equal(s.outputMeters.outputPeak,Math.fround(.95));assert.equal(s.outputMeters.gainReductionDb,Math.fround(2.4));});

test('reverb scope forwards exactly128 native wet samples and rejects invalid or short telemetry',async()=>{const f=await fixture();for(let i=0;i<24;++i)f.block();assert.deepEqual(Array.from(f.statuses()[0].reverbScope),Array.from({length:128},(_,i)=>(i-64)/128));f.setScope(Array(128).fill(0));for(let i=0;i<24;++i)f.block();assert.deepEqual(Array.from(f.statuses()[1].reverbScope),Array(128).fill(0));f.setScope(Array(128).fill(NaN));for(let i=0;i<24;++i)f.block();assert.equal(f.statuses()[2].reverbScope,null);f.setScope(Array(128).fill(.1),0);for(let i=0;i<24;++i)f.block();assert.equal(f.statuses()[3].reverbScope,null);});
