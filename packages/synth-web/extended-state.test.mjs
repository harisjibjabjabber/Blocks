import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_RACK,normalizeRack,newSauceBlock,hydrateRack,toCoreSauce,toCoreNotes,rackVisualOrder,reorderRack,syncRackOrder} from './sauce-state.js';
import {DEFAULT_MODULATION,normalizeModulation,toCoreModulation,defaultLfo,shapeForWave,normalizeLfoPoints,sampleLfoPoints,randomLfoPoints,modulationDestinations,routeTargetKey} from './modulation-state.js';
test('repeatable rack blocks are independent and serialize both processing lanes in exact order',()=>{
 let rack=normalizeRack(DEFAULT_RACK);assert.deepEqual(rack.audio,[]);assert.deepEqual(rack.notes,[]);
 for(const type of ['drive','drive','fullness'])rack.audio.push(newSauceBlock(rack,type));
 for(const type of ['arp','arp','strum','drop','drop'])rack.notes.push(newSauceBlock(rack,type));
 rack.audio[1].amount=8;rack.notes[1].performance.division='1/64';rack.notes[4].amount=1200;
 const copy=structuredClone(rack),normalized=normalizeRack(rack);assert.deepEqual(rack,copy);assert.equal(normalized.audio[0].amount,1);assert.equal(normalized.audio[1].amount,8);assert.equal(normalized.notes[0].performance.division,'1/8');
 assert.deepEqual(toCoreSauce(rack).blocks.map(b=>b.id),rack.audio.map(b=>b.id));assert.equal(toCoreNotes(rack).blocks[1].perf.division,64);assert.equal(toCoreNotes(rack).blocks[4].drop_amount,1200);
 for(const bad of [{...rack,version:2},{...rack,audio:Array(17).fill(rack.audio[0])},{...rack,notes:[...rack.notes,rack.notes[0]]}])assert.throws(()=>normalizeRack(bad));
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
test('current modulation preserves drawn curves; retired formats reject',()=>{
 const old=defaultLfo();delete old.points;delete old.retrigger;assert.throws(()=>normalizeModulation({version:1,sources:[old]}));assert.throws(()=>normalizeModulation({version:2,sources:[defaultLfo()]}));
 const migrated=normalizeModulation();migrated.sources[0].waveform='custom';migrated.sources[0].retrigger=true;migrated.sources[0].points=[{x:0,y:-1,bend:1},{x:.5,y:.8,bend:-1},{x:1,y:1,bend:0}];const normalized=normalizeModulation(migrated);assert.deepEqual(normalizeModulation(JSON.parse(JSON.stringify(normalized))),normalized);assert.equal(toCoreModulation(normalized).sources[0].retrigger,1);assert.equal(toCoreModulation(normalized).sources[0].waveform,5);
 for(const points of [[],Array(33).fill({x:0,y:0,bend:0}),[{x:.1,y:0,bend:0},{x:1,y:0,bend:0}],[{x:0,y:0,bend:0},{x:0,y:1,bend:0},{x:1,y:0,bend:0}],[{x:0,y:-2,bend:0},{x:1,y:0,bend:0}]])assert.throws(()=>normalizeLfoPoints(points));
});
test('custom curve sampling keeps exact points and bounded monotone bent segments with independent wrap levels',()=>{
 for(const bend of [-1,-.5,0,.5,1]){const p=normalizeLfoPoints([{x:0,y:-1,bend},{x:.5,y:.7,bend:-bend},{x:1,y:.2,bend:0}]);assert.equal(sampleLfoPoints(p,0),-1);assert.equal(sampleLfoPoints(p,.5),p[1].y);assert.equal(sampleLfoPoints(p,1),p[2].y);let previous=-1;for(let i=0;i<=100;i++){const value=sampleLfoPoints(p,i/200);assert(value>=previous-1e-12&&value>=-1&&value<=1);previous=value;}}
});

test('Triangle editing template matches native polarity at quarter phases',()=>{
 const points=shapeForWave('triangle');for(const phase of [0,.25,.5,.75,1])assert.equal(sampleLfoPoints(points,phase),1-4*Math.abs(phase-.5));
});

test('new synced defaults preserve explicit current free clocks and random30point patterns persist',()=>{
 assert.equal(defaultLfo().synced,true);const source=defaultLfo();source.synced=false;assert.equal(normalizeModulation({version:3,sources:[source]}).sources[0].synced,false);
 let seed=1;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);const points=randomLfoPoints(30,random);assert.equal(points.length,30);assert.equal(points[0].y,points.at(-1).y);assert.notDeepEqual(points,randomLfoPoints(30,random));const m=normalizeModulation();m.sources[0].points=points;m.sources[0].waveform='custom';assert.deepEqual(normalizeModulation(JSON.parse(JSON.stringify(m))),m);
});
test('dynamic destinations key repeated blocks and LFO targets independently',()=>{
 const m=normalizeModulation(),r=normalizeRack();r.audio.push(newSauceBlock(r,'drive'));r.audio.push(newSauceBlock(r,'drive'));m.sources.push(defaultLfo(2));const destinations=modulationDestinations([],r,m);assert(destinations.some(d=>d.label==='Drive 2 · Amount'));assert(destinations.some(d=>d.label==='LFO 2 · Rate'));
 m.sources[0].routes=[{kind:'sauce',targetId:2,parameter:0,depth:.4},{kind:'lfo',targetId:1,parameter:0,depth:.3},{kind:'lfo',targetId:2,parameter:0,depth:-.2}];const saved=normalizeModulation(m);assert.equal(new Set(saved.sources[0].routes.map(routeTargetKey)).size,3);assert.deepEqual(toCoreModulation(saved).sources[0].routes.map(r=>r.target_kind),[1,2,2]);assert.throws(()=>normalizeModulation({...m,version:2}));
});
