import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_RACK,normalizeRack,newSauceBlock,legacyRack,hydrateRack,toCoreSauce,toCoreNotes,rackVisualOrder,reorderRack,syncRackOrder} from './sauce-state.js';
import {DEFAULT_MODULATION,normalizeModulation,toCoreModulation,defaultLfo,shapeForWave,normalizeLfoPoints,sampleLfoPoints} from './modulation-state.js';
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
 for(const bad of [{...m,version:99},{version:1,sources:[]},{version:1,sources:[defaultLfo(2)]},{...m,sources:[m.sources[0],m.sources[0]]},{...m,sources:[{...m.sources[0],routes:[{parameter:19,depth:.2}]}]},{...m,sources:[{...m.sources[0],routes:[{parameter:11,depth:NaN}]}]}])assert.throws(()=>normalizeModulation(bad));
 assert.equal(normalizeModulation().sources[0].enabled,false);
});

test('filter resonance routes persist separately from tone; filter mode is never a continuous target',()=>{
 const config=normalizeModulation();config.sources[0].routes.push({parameter:42,depth:.6});
 assert.equal(toCoreModulation(config).sources[0].routes.at(-1).parameter_id,42);
 assert.throws(()=>normalizeModulation({version:1,sources:[{...config.sources[0],routes:[{parameter:43,depth:.2}]}]}));
});

test('global rack order projects typed subsequences without changing cross-type processing',()=>{
 let r=normalizeRack();r.notes.push(newSauceBlock(r,'arp'));r.audio.push(newSauceBlock(r,'drive'));r.audio.push(newSauceBlock(r,'fullness'));r=normalizeRack(r);const m=normalizeModulation();m.sources.push(defaultLfo(2));
 const available=rackVisualOrder(r,m);assert.equal(available.length,4);const beforeAudio=toCoreSauce(r),beforeNotes=toCoreNotes(r);
 const mixed=['audio:2','lfo:2','notes:1','audio:3'];r=reorderRack(r,m,mixed);assert.deepEqual(r.order,mixed);assert.deepEqual(toCoreSauce(r),beforeAudio);assert.deepEqual(toCoreNotes(r),beforeNotes);
 r=reorderRack(r,m,['audio:3','notes:1','lfo:2','audio:2']);assert.deepEqual(r.audio.map(b=>b.id),[3,2]);assert.deepEqual(r.notes.map(b=>b.id),[1]);
 const roundtrip=normalizeRack(JSON.parse(JSON.stringify(r)));assert.deepEqual(roundtrip,r);const removed={...m,sources:[m.sources[0]]};assert(!syncRackOrder(r,removed).order.includes('lfo:2'));
 assert.throws(()=>reorderRack(r,m,['notes:1']));assert.throws(()=>normalizeRack({...r,order:['audio:2','audio:2']}));
});
test('modulation v1 migrates free clocks while v2 preserves drawn curves and retrigger atomically',()=>{
 const old=defaultLfo();delete old.points;delete old.retrigger;old.rate=3;old.division='1/8T';const migrated=normalizeModulation({version:1,sources:[old]});assert.equal(migrated.version,2);assert.equal(migrated.sources[0].retrigger,false);assert.equal(migrated.sources[0].rate,3);assert.equal(migrated.sources[0].division,'1/8T');assert.deepEqual(migrated.sources[0].points,shapeForWave());
 migrated.sources[0].waveform='custom';migrated.sources[0].retrigger=true;migrated.sources[0].points=[{x:0,y:-1,bend:1},{x:.5,y:.8,bend:-1},{x:1,y:1,bend:0}];const normalized=normalizeModulation(migrated);assert.deepEqual(normalizeModulation(JSON.parse(JSON.stringify(normalized))),normalized);assert.equal(toCoreModulation(normalized).sources[0].retrigger,1);assert.equal(toCoreModulation(normalized).sources[0].waveform,5);
 for(const points of [[],Array(17).fill({x:0,y:0,bend:0}),[{x:.1,y:0,bend:0},{x:1,y:0,bend:0}],[{x:0,y:0,bend:0},{x:0,y:1,bend:0},{x:1,y:0,bend:0}],[{x:0,y:-2,bend:0},{x:1,y:0,bend:0}]])assert.throws(()=>normalizeLfoPoints(points));
});
test('custom curve sampling keeps exact points and bounded monotone bent segments with independent wrap levels',()=>{
 for(const bend of [-1,-.5,0,.5,1]){const p=normalizeLfoPoints([{x:0,y:-1,bend},{x:.5,y:.7,bend:-bend},{x:1,y:.2,bend:0}]);assert.equal(sampleLfoPoints(p,0),-1);assert.equal(sampleLfoPoints(p,.5),p[1].y);assert.equal(sampleLfoPoints(p,1),p[2].y);let previous=-1;for(let i=0;i<=100;i++){const value=sampleLfoPoints(p,i/200);assert(value>=previous-1e-12&&value>=-1&&value<=1);previous=value;}}
});

test('Triangle editing template matches native polarity at quarter phases',()=>{
 const points=shapeForWave('triangle');for(const phase of [0,.25,.5,.75,1])assert.equal(sampleLfoPoints(points,phase),1-4*Math.abs(phase-.5));
});
