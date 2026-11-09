// Worklet unit tests with a fake renderer. These verify telemetry/copying only;
// actual DSP output is covered by the separate core and real-browser suites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('./processor.js',import.meta.url),'utf8');

async function fixture(){
  const memory={buffer:new ArrayBuffer(65536)},floats=new Float32Array(memory.buffer),messages=[];
  let registered,next=1024,samples=[[],[]],renderCalls=0;
  const api={memory,bs_create:()=>1,bs_prepare:()=>1,malloc:bytes=>{const p=next;next+=bytes;return p;},
    bs_parameter_count:()=>21,bs_parameter_info:()=>0,bs_get_parameter:()=>0,bs_abi_version:()=>3,
    bs_active_voices:()=>3,bs_render:(_s,l,r,frames)=>{renderCalls++;for(let i=0;i<frames;i++){floats[l/4+i]=samples[0][i]??0;floats[r/4+i]=samples[1][i]??0;}return 0;}};
  const context=vm.createContext({AudioWorkletProcessor:class{constructor(){this.port={postMessage:value=>messages.push(value)};}},
    WebAssembly:{instantiate:async()=>({instance:{exports:api}})},sampleRate:48000,currentFrame:0,
    registerProcessor:(name,processor)=>{assert.equal(name,'blocks-synth');registered=processor;}});
  vm.runInContext(source,context,{filename:'processor.js'});
  const processor=new registered({processorOptions:{wasm:new Uint8Array()}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(processor.ready,true);
  return {messages,get renderCalls(){return renderCalls;},block(left=[],right=[],channels=2){
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
