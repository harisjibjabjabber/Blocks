import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_RACK,normalizeRack,newSauceBlock,legacyRack,hydrateRack,toCoreSauce,toCoreNotes} from './sauce-state.js';
import {DEFAULT_MODULATION,normalizeModulation,toCoreModulation,defaultLfo} from './modulation-state.js';
test('repeatable rack blocks are independent and serialize both processing lanes in exact order',()=>{
 let rack=normalizeRack(DEFAULT_RACK);assert.deepEqual(rack.audio,[]);assert.deepEqual(rack.notes,[]);
 for(const type of ['drive','drive','fullness'])rack.audio.push(newSauceBlock(rack,type));
 for(const type of ['arp','arp','strum','drop','drop'])rack.notes.push(newSauceBlock(rack,type));
 rack.audio[1].amount=8;rack.notes[1].performance.division='1/64';rack.notes[4].amount=1200;
 const copy=structuredClone(rack),normalized=normalizeRack(rack);assert.deepEqual(rack,copy);assert.equal(normalized.audio[0].amount,2);assert.equal(normalized.audio[1].amount,8);assert.equal(normalized.notes[0].performance.division,'1/8');
 assert.deepEqual(toCoreSauce(rack).blocks.map(b=>b.id),rack.audio.map(b=>b.id));assert.equal(toCoreNotes(rack).blocks[1].perf.division,64);assert.equal(toCoreNotes(rack).blocks[4].drop_amount,1200);
 for(const bad of [{...rack,version:2},{...rack,audio:Array(17).fill(rack.audio[0])},{...rack,notes:[...rack.notes,rack.notes[0]]}])assert.throws(()=>normalizeRack(bad));
});
test('legacy routing migration preserves active generators and primary amounts without refilling an empty FX workspace',()=>{
 const values=Array(44).fill(0);values[12]=8;values[18]=.7;values[15]=600;values[16]=.12;values[37]=1;
 const r=legacyRack(values,{mode:'arp',mono:true,bpm:120});assert.equal(r.audio.length,0);assert.equal(r.notes[0].type,'arp');assert.equal(r.notes[0].performance.mono,false);assert.equal(r.notes[1].amount,600);
 const h=hydrateRack(r,values);assert.equal(h.notes[1].amount,600);assert.equal(h.notes[1].enabled,true);assert.equal(normalizeRack(DEFAULT_RACK).audio.length,0);
});
test('LFO sources and routes roundtrip independent settings with bounded capacity and permanent source1',()=>{
 const m=normalizeModulation(DEFAULT_MODULATION);m.sources[0].enabled=true;m.sources[0].routes[0].depth=-.5;m.sources.push(defaultLfo(2));m.sources[1].rate=4;m.sources[1].routes.push({parameter:18,depth:.2});
 const native=toCoreModulation(m);assert.equal(native.sources[0].routes[0].depth,-.5);assert.equal(native.sources[1].rate_hz,4);assert.equal(m.sources[0].rate,1);assert.equal(native.sources[0].routes[1].parameter_id,0);
 for(const bad of [{...m,version:2},{version:1,sources:[]},{version:1,sources:[defaultLfo(2)]},{...m,sources:[m.sources[0],m.sources[0]]},{...m,sources:[{...m.sources[0],routes:[{parameter:19,depth:.2}]}]},{...m,sources:[{...m.sources[0],routes:[{parameter:11,depth:NaN}]}]}])assert.throws(()=>normalizeModulation(bad));
 assert.equal(normalizeModulation().sources[0].enabled,false);
});

test('filter resonance routes persist separately from tone; filter mode is never a continuous target',()=>{
 const config=normalizeModulation();config.sources[0].routes.push({parameter:42,depth:.6});
 assert.equal(toCoreModulation(config).sources[0].routes.at(-1).parameter_id,42);
 assert.throws(()=>normalizeModulation({version:1,sources:[{...config.sources[0],routes:[{parameter:43,depth:.2}]}]}));
});
