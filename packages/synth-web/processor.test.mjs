// Worklet unit tests with a fake renderer. These verify telemetry/copying only;
// actual DSP output is covered by the separate core and real-browser suites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('./processor.js',import.meta.url),'utf8');

async function fixture(){
  const memory={buffer:new ArrayBuffer(65536)},floats=new Float32Array(memory.buffer),messages=[];
  let registered,next=1024,samples=[[],[]],renderCalls=0;const renderedEvents=[],patchCalls=[],performanceCalls=[];
  const performanceFields=['version','mode','order','division','triplet','seed','mono','bpm','curl','gate','strum_ms','randomness'];
  let performance={version:1,mode:0,order:0,division:8,triplet:0,seed:0xc0ffee,mono:0,bpm:120,curl:0,gate:.7,strum_ms:35,randomness:.25};
  const rackCalls={sauce:[],modulation:[],notes:[]},rackApi={};
  for(const [kind,size]of[['sauce',328],['modulation',1208],['notes',1224]]){let bytes=new Uint8Array(size);new DataView(bytes.buffer).setUint32(0,kind==='modulation'?2:1,true);const suffix=kind==='modulation'?'_v2':'';rackApi['bs_get_'+kind+suffix]=(_s,p)=>{new Uint8Array(memory.buffer,p,size).set(bytes);return 1;};rackApi['bs_set_'+kind+suffix]=(_s,p)=>{bytes=Uint8Array.from(new Uint8Array(memory.buffer,p,size));rackCalls[kind].push(Array.from(bytes));return 1;};}
  const api={memory,...rackApi,
    bs_get_performance:(_s,p)=>{const v=new DataView(memory.buffer);performanceFields.forEach((key,i)=>i<7?v.setUint32(p+i*4,performance[key],true):v.setFloat32(p+i*4,performance[key],true));return 1;},
    bs_set_performance:(_s,p)=>{const v=new DataView(memory.buffer),next={};performanceFields.forEach((key,i)=>next[key]=i<7?v.getUint32(p+i*4,true):v.getFloat32(p+i*4,true));performanceCalls.push({config:next,bytes:Array.from(new Uint8Array(memory.buffer,p,48))});performance=next;return 1;},
    bs_performance_pending:()=>performance.curl!==0?1:0,
    bs_create:()=>1,bs_prepare:()=>1,malloc:bytes=>{const p=next;next+=bytes;return p;},
    bs_parameter_count:()=>44,bs_parameter_info:()=>0,bs_get_parameter:()=>0,bs_abi_version:()=>7,
    bs_set_patch:(_s,p)=>{const view=new DataView(memory.buffer),version=view.getUint32(p,true),n=version===1?18:version===2?19:version===3?21:version===4?35:version===5?40:version===6?42:44;patchCalls.push({version,values:Array.from({length:n},(_,i)=>view.getFloat32(p+4+i*4,true))});return 1;},
    bs_get_modulation_phase:(_s,id)=>id===1?.25:-1,bs_active_voices:()=>3,bs_render:(_s,l,r,frames,eventPointer,eventCount)=>{renderCalls++;const view=new DataView(memory.buffer);for(let i=0;i<eventCount;i++){const p=eventPointer+i*24;renderedEvents.push({offset:view.getUint32(p,true),id:view.getUint32(p+16,true),value:view.getFloat32(p+20,true)});}for(let i=0;i<frames;i++){floats[l/4+i]=samples[0][i]??0;floats[r/4+i]=samples[1][i]??0;}return 0;}};
  const context=vm.createContext({AudioWorkletProcessor:class{constructor(){this.port={postMessage:value=>messages.push(value)};}},
    WebAssembly:{instantiate:async()=>({instance:{exports:api}})},sampleRate:48000,currentFrame:0,
    registerProcessor:(name,processor)=>{assert.equal(name,'blocks-synth');registered=processor;}});
  vm.runInContext(source,context,{filename:'processor.js'});
  const processor=new registered({processorOptions:{wasm:new Uint8Array()}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(processor.ready,true);
  return {messages,renderedEvents,patchCalls,performanceCalls,rackCalls,message:m=>processor.message(m),get queued(){return processor.count;},get renderCalls(){return renderCalls;},block(left=[],right=[],channels=2){
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


test('patch boundary delegates valid legacy prefixes and current44 values, rejects invalid state atomically',async()=>{
 const f=await fixture();for(const [version,count] of [[1,18],[2,19],[3,21],[4,35],[5,40],[6,42],[7,44]]){f.message({kind:'patch',version,values:Array.from({length:count},(_,i)=>i/100)});assert.equal(f.patchCalls.at(-1).version,version);assert.equal(f.patchCalls.at(-1).values.length,count);}
 for(const message of [{kind:'patch',version:3,values:Array(35).fill(0)},{kind:'patch',version:4,values:Array(21).fill(0)},{kind:'patch',version:99,values:Array(35).fill(0)},{kind:'patch',version:4,values:[...Array(34).fill(0),NaN]},{kind:'patch',version:5,values:[...Array(39).fill(0),NaN]},{kind:'patch',version:5,values:Array(35).fill(0)},{kind:'patch',version:6,values:[...Array(41).fill(0),NaN]},{kind:'patch',version:6,values:Array(40).fill(0)},{kind:'patch',version:7,values:Array(42).fill(0)},{kind:'patch',version:7,values:[...Array(43).fill(0),NaN]}])f.message(message);
 assert.equal(f.patchCalls.length,7);assert.equal(f.messages.filter(m=>m.kind==='error').length,10);assert.equal(f.messages.filter(m=>m.kind==='patch').length,7);
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
 const f=await fixture(),config={version:1,blocks:[{id:8,type:0,primary:1,enabled:1,amount:4},{id:19,type:0,primary:0,enabled:0,amount:2.5},{id:22,type:1,primary:1,enabled:1,amount:.7}]};f.message({kind:'event',type:0,key:60,channel:0,value:1});f.message({kind:'sauce',config});assert.equal(f.queued,1);assert.equal(f.rackCalls.sauce.length,1);const bytes=Uint8Array.from(f.rackCalls.sauce[0]),v=new DataView(bytes.buffer);assert.equal(bytes.length,328);assert.equal(v.getUint32(4,true),3);assert.equal(v.getUint32(28,true),19);assert.equal(v.getUint32(40,true),0);assert.equal(v.getFloat32(44,true),2.5);assert.equal(v.getFloat32(64,true),Math.fround(.7));assert.equal(f.messages.findLast(m=>m.kind==='sauce').config.blocks[1].id,19);
 const invalid=[{...config,version:2},{...config,blocks:Array(17).fill(config.blocks[0])},{...config,blocks:[config.blocks[0],config.blocks[0]]},{...config,blocks:[config.blocks[0],{...config.blocks[1],primary:1}]},{...config,blocks:[{...config.blocks[0],amount:NaN}]},{...config,blocks:[{...config.blocks[0],amount:0}]},{...config,blocks:[{...config.blocks[0],enabled:true}]}];for(const c of invalid)f.message({kind:'sauce',config:c});assert.equal(f.rackCalls.sauce.length,1);assert.equal(f.queued,1);assert.equal(f.messages.filter(m=>m.kind==='error').length,invalid.length);
});

test('legacy modulation messages migrate to1208-byte sources/routes and rejects invalid routing atomically',async()=>{
 const f=await fixture(),source={id:4294967295,enabled:1,waveform:4,synced:1,division:16,triplet:1,rate_hz:2.5,intensity:.7,routes:[{parameter_id:11,depth:-.3},{parameter_id:0,depth:.2}]},config={version:1,sources:[source,{...source,id:2,division:64,triplet:0}]};f.message({kind:'modulation',config});assert.equal(f.rackCalls.modulation.length,1);const bytes=Uint8Array.from(f.rackCalls.modulation[0]),v=new DataView(bytes.buffer);assert.equal(bytes.length,1208);assert.equal(v.getUint32(4,true),2);assert.equal(v.getUint32(8,true),4294967295);assert.equal(v.getFloat32(32,true),2.5);assert.equal(v.getFloat32(36,true),Math.fround(.7));assert.equal(v.getUint32(40,true),2);assert.equal(v.getUint32(44,true),11);assert.equal(v.getFloat32(48,true),Math.fround(-.3));assert.equal(v.getUint32(308,true),2);assert.equal(f.messages.findLast(m=>m.kind==='modulation').config.sources[1].division,64);
 const invalid=[{...source,id:-1},{...source,waveform:5},{...source,rate_hz:Infinity},{...source,intensity:1.01},{...source,division:64,triplet:1},{...source,routes:[{parameter_id:40,depth:.5}]},{...source,routes:[{parameter_id:11,depth:.5},{parameter_id:11,depth:.2}]},{...source,routes:Array(9).fill({parameter_id:11,depth:.2})}];for(const s of invalid)f.message({kind:'modulation',config:{version:1,sources:[s]}});f.message({kind:'modulation',config:{version:1,sources:[source,source]}});f.message({kind:'modulation',config:{version:1,sources:Array(5).fill(source)}});assert.equal(f.rackCalls.modulation.length,1);assert.equal(f.messages.filter(m=>m.kind==='error').length,invalid.length+2);
});

test('note rack bridge encodes1224-byte cascading generators/Drop and preserves queued input on invalid or settings-only changes',async()=>{
 const f=await fixture(),perf={version:1,mode:1,order:2,division:64,triplet:0,seed:123,mono:0,bpm:139,curl:.3,gate:.6,strum_ms:42,randomness:.7},config={version:1,blocks:[{id:3,type:0,primary:0,enabled:1,perf},{id:9,type:2,primary:1,enabled:1,drop_amount:700,drop_time:.4,drop_bend:-.7}]};f.message({kind:'event',type:0,key:60,channel:0,value:1});f.message({kind:'parameter-batch',values:[{id:11,value:500}]});f.message({kind:'notes',config});assert.equal(f.queued,1);const bytes=Uint8Array.from(f.rackCalls.notes[0]),v=new DataView(bytes.buffer);assert.equal(bytes.length,1224);assert.equal(v.getUint32(4,true),2);assert.equal(v.getUint32(24,true),1);assert.equal(v.getUint32(36,true),64);assert.equal(v.getFloat32(52,true),139);assert.equal(v.getUint32(84,true),9);assert.equal(v.getFloat32(148,true),700);assert.equal(v.getFloat32(152,true),Math.fround(.4));assert.equal(v.getFloat32(156,true),Math.fround(-.7));assert.equal(f.messages.findLast(m=>m.kind==='notes').config.blocks[0].perf.curl,Math.fround(.3));
 f.message({kind:'event',type:0,key:64,channel:0,value:1});const changed={...config,blocks:[{...config.blocks[0],perf:{...perf,bpm:144}},config.blocks[1]]};f.message({kind:'notes',config:changed});assert.equal(f.queued,2);assert.equal(f.rackCalls.notes.length,2);
 const bad=[{...config.blocks[0],primary:1},{...config.blocks[0],perf:{...perf,mono:1}},{...config.blocks[0],perf:{...perf,mode:2}},{...config.blocks[1],drop_amount:NaN},{...config.blocks[1],drop_time:0},{...config.blocks[1],drop_bend:3}];for(const block of bad)f.message({kind:'notes',config:{version:1,blocks:[block]}});assert.equal(f.rackCalls.notes.length,2);assert.equal(f.queued,2);assert.equal(f.messages.filter(m=>m.kind==='error').length,bad.length);
});

test('Resonance is a continuous modulation route; filter mode is rejected atomically',async()=>{
 const f=await fixture(),source={id:1,enabled:1,waveform:0,synced:0,division:4,triplet:0,rate_hz:1,intensity:.5,routes:[{parameter_id:42,depth:.6}]};
 f.message({kind:'modulation',config:{version:1,sources:[source]}});assert.equal(f.rackCalls.modulation.length,1);
 f.message({kind:'modulation',config:{version:1,sources:[{...source,routes:[{parameter_id:43,depth:.6}]}]}});assert.equal(f.rackCalls.modulation.length,1);assert.equal(f.messages.at(-1).kind,'error');
});

test('custom LFO bridge preserves retrigger/curve bytes and rejects every invalid shape atomically',async()=>{
 const f=await fixture(),source={id:1,enabled:1,waveform:5,synced:1,division:8,triplet:1,rate_hz:1.1,intensity:.7,retrigger:1,points:[{x:0,y:-1,bend:.8},{x:.4,y:.3,bend:-.5},{x:1,y:.7,bend:0}],routes:[{parameter_id:11,depth:.4}]};
 f.message({kind:'event',type:0,key:60,channel:0,value:1});f.message({kind:'modulation',config:{version:2,sources:[source]}});assert.equal(f.rackCalls.modulation.length,1);assert.equal(f.queued,1);
 const view=new DataView(Uint8Array.from(f.rackCalls.modulation[0]).buffer);assert.equal(view.byteLength,1208);assert.equal(view.getUint32(0,true),2);assert.equal(view.getUint32(108,true),1);assert.equal(view.getUint32(112,true),3);assert.equal(view.getFloat32(120,true),-1);assert.equal(view.getFloat32(124,true),Math.fround(.8));assert.equal(view.getFloat32(128,true),Math.fround(.4));assert.equal(view.getFloat32(136,true),-.5);
 const returned=f.messages.findLast(m=>m.kind==='modulation').config.sources[0];assert.equal(returned.points.length,3);assert.equal(returned.retrigger,1);assert.equal(returned.points.at(-1).y,Math.fround(.7));
 const bad=[{...source,retrigger:2},{...source,points:[]},{...source,points:Array(17).fill(source.points[0])},{...source,points:[source.points[0],{x:0,y:1,bend:0},source.points[2]]},{...source,points:[{x:.1,y:0,bend:0},source.points[2]]},{...source,points:[source.points[0],{x:1,y:2,bend:0}]},{...source,points:[source.points[0],{x:1,y:0,bend:NaN}]}];
 for(const s of bad)f.message({kind:'modulation',config:{version:2,sources:[s]}});assert.equal(f.rackCalls.modulation.length,1);assert.equal(f.queued,1);assert.equal(f.messages.filter(m=>m.kind==='error').length,bad.length);
 for(let i=0;i<24;i++)f.block();assert.deepEqual(JSON.parse(JSON.stringify(f.statuses().at(-1).lfoPhases)),[{id:1,phase:.25}]);
});
