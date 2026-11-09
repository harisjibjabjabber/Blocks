// Worklet unit tests with a fake renderer. These verify telemetry/copying only;
// actual DSP output is covered by the separate core and real-browser suites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('./processor.js',import.meta.url),'utf8');

async function fixture(){
  const memory={buffer:new ArrayBuffer(65536)},floats=new Float32Array(memory.buffer),messages=[];
  let registered,next=1024,samples=[[],[]],renderCalls=0;const renderedEvents=[],patchCalls=[];
  const api={memory,bs_create:()=>1,bs_prepare:()=>1,malloc:bytes=>{const p=next;next+=bytes;return p;},
    bs_parameter_count:()=>35,bs_parameter_info:()=>0,bs_get_parameter:()=>0,bs_abi_version:()=>4,
    bs_set_patch:(_s,p)=>{const view=new DataView(memory.buffer),version=view.getUint32(p,true),n=version===1?18:version===2?19:version===3?21:35;patchCalls.push({version,values:Array.from({length:n},(_,i)=>view.getFloat32(p+4+i*4,true))});return 1;},
    bs_active_voices:()=>3,bs_render:(_s,l,r,frames,eventPointer,eventCount)=>{renderCalls++;const view=new DataView(memory.buffer);for(let i=0;i<eventCount;i++){const p=eventPointer+i*24;renderedEvents.push({offset:view.getUint32(p,true),id:view.getUint32(p+16,true),value:view.getFloat32(p+20,true)});}for(let i=0;i<frames;i++){floats[l/4+i]=samples[0][i]??0;floats[r/4+i]=samples[1][i]??0;}return 0;}};
  const context=vm.createContext({AudioWorkletProcessor:class{constructor(){this.port={postMessage:value=>messages.push(value)};}},
    WebAssembly:{instantiate:async()=>({instance:{exports:api}})},sampleRate:48000,currentFrame:0,
    registerProcessor:(name,processor)=>{assert.equal(name,'blocks-synth');registered=processor;}});
  vm.runInContext(source,context,{filename:'processor.js'});
  const processor=new registered({processorOptions:{wasm:new Uint8Array()}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(processor.ready,true);
  return {messages,renderedEvents,patchCalls,message:m=>processor.message(m),get queued(){return processor.count;},get renderCalls(){return renderCalls;},block(left=[],right=[],channels=2){
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


test('patch boundary delegates valid legacy prefixes and current35 values, rejects invalid state atomically',async()=>{
 const f=await fixture();for(const [version,count] of [[1,18],[2,19],[3,21],[4,35]]){f.message({kind:'patch',version,values:Array.from({length:count},(_,i)=>i/100)});assert.equal(f.patchCalls.at(-1).version,version);assert.equal(f.patchCalls.at(-1).values.length,count);}
 for(const message of [{kind:'patch',version:3,values:Array(35).fill(0)},{kind:'patch',version:4,values:Array(21).fill(0)},{kind:'patch',version:99,values:Array(35).fill(0)},{kind:'patch',version:4,values:[...Array(34).fill(0),NaN]}])f.message(message);
 assert.equal(f.patchCalls.length,4);assert.equal(f.messages.filter(m=>m.kind==='error').length,4);assert.equal(f.messages.filter(m=>m.kind==='patch').length,4);
});
