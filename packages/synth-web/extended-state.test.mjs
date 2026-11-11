import {test} from 'node:test';

import assert from 'node:assert/strict';

import {DEFAULT_RACK,normalizeRack,newSauceBlock,hydrateRack,toCoreSauce,toCoreNotes,toCoreCreativeFX,CREATIVE_FX_FIELDS,rackVisualOrder,reorderRack,syncRackOrder} from './sauce-state.js';

import {DEFAULT_MODULATION,normalizeModulation,toCoreModulation,defaultLfo,shapeForWave,normalizeLfoPoints,sampleLfoPoints,randomLfoPoints,modulationDestinations,routeTargetKey,pruneEffectRoutes} from './modulation-state.js';

test('repeatable rack blocks are independent and serialize both processing lanes in exact order',()=>{

 let rack=normalizeRack(DEFAULT_RACK);assert.deepEqual(rack.audio,[]);assert.deepEqual(rack.notes,[]);

 for(const type of ['fullness','fullness','fullness'])rack.audio.push(newSauceBlock(rack,type));

 for(const type of ['arp','arp','strum','drop','drop'])rack.notes.push(newSauceBlock(rack,type));

 rack.audio[1].amount=.8;rack.notes[1].performance.division='1/64';rack.notes[4].amount=1200;

 const copy=structuredClone(rack),normalized=normalizeRack(rack);assert.deepEqual(rack,copy);assert.equal(normalized.audio[0].amount,0);assert.equal(normalized.audio[1].amount,.8);assert.equal(normalized.notes[0].performance.division,'1/8');

 assert.deepEqual(toCoreSauce(rack).blocks.map(b=>b.id),rack.audio.map(b=>b.id));assert.equal(toCoreNotes(rack).blocks[1].perf.division,64);assert.equal(toCoreNotes(rack).blocks[4].drop_amount,1200);

 for(const bad of [{...rack,version:2},{...rack,audio:Array(17).fill(rack.audio[0])},{...rack,notes:[...rack.notes,rack.notes[0]]}])assert.throws(()=>normalizeRack(bad));

});

test('LFO sources and routes roundtrip independent settings with bounded capacity and permanent source1',()=>{

 const m=normalizeModulation(DEFAULT_MODULATION);m.sources[0].enabled=true;m.sources[0].routes[0].depth=-.5;m.sources[1].rate=4;m.sources[1].routes.push({parameter:18,depth:.2});

 const native=toCoreModulation(m);assert.equal(native.sources[0].routes[0].depth,-.5);assert.equal(native.sources[1].rate_hz,4);assert.equal(m.sources[0].rate,1);assert.equal(native.sources[0].routes[1].parameter_id,0);

 for(const bad of [{...m,version:99},{version:1,sources:[]},{version:1,sources:[defaultLfo(2)]},{...m,sources:[m.sources[0],m.sources[0]]},{...m,sources:[{...m.sources[0],routes:[{parameter:19,depth:.2}]},...m.sources.slice(1)]},{...m,sources:[{...m.sources[0],routes:[{parameter:11,depth:NaN}]},...m.sources.slice(1)]}])assert.throws(()=>normalizeModulation(bad));

 assert.equal(normalizeModulation().sources[0].enabled,false);

});



test('filter resonance routes persist separately from tone; filter mode is never a continuous target',()=>{

 const config=normalizeModulation();config.sources[0].routes.push({parameter:42,depth:.6});

 assert.equal(toCoreModulation(config).sources[0].routes.at(-1).parameter_id,42);

 assert.throws(()=>normalizeModulation({version:3,sources:[{...config.sources[0],routes:[{parameter:43,depth:.2}]},...config.sources.slice(1)]}));

});



test('global rack order projects typed subsequences without changing cross-type processing',()=>{

 let r=normalizeRack();r.notes.push(newSauceBlock(r,'arp'));r.audio.push(newSauceBlock(r,'fullness'));r.audio.push(newSauceBlock(r,'fullness'));r=normalizeRack(r);const m=normalizeModulation();

 const available=rackVisualOrder(r,m);assert.equal(available.length,3);const beforeAudio=toCoreSauce(r),beforeNotes=toCoreNotes(r);

 const mixed=['audio:2','notes:1','audio:3'];r=reorderRack(r,m,mixed);assert.deepEqual(r.order,mixed);assert.deepEqual(toCoreSauce(r),beforeAudio);assert.deepEqual(toCoreNotes(r),beforeNotes);

 r=reorderRack(r,m,['audio:3','notes:1','audio:2']);assert.deepEqual(r.audio.map(b=>b.id),[3,2]);assert.deepEqual(r.notes.map(b=>b.id),[1]);

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

 assert.equal(defaultLfo().synced,true);const source=defaultLfo();source.synced=false;assert.equal(normalizeModulation({version:3,sources:[source,...normalizeModulation().sources.slice(1)]}).sources[0].synced,false);

 let seed=1;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);const points=randomLfoPoints(30,random);assert.equal(points.length,30);assert.equal(points[0].y,points.at(-1).y);assert.notDeepEqual(points,randomLfoPoints(30,random));const m=normalizeModulation();m.sources[0].points=points;m.sources[0].waveform='custom';assert.deepEqual(normalizeModulation(JSON.parse(JSON.stringify(m))),m);

});

test('dynamic destinations key repeated blocks and LFO targets independently',()=>{

 const m=normalizeModulation(),r=normalizeRack();r.audio.push(newSauceBlock(r,'fullness'));r.audio.push(newSauceBlock(r,'fullness'));const destinations=modulationDestinations([],r,m);assert(destinations.some(d=>d.label==='Fullness 2 · Amount'));assert(destinations.some(d=>d.label==='LFO 2 · Clock speed'));

 m.sources[0].routes=[{kind:'sauce',targetId:2,parameter:0,depth:.4},{kind:'lfo',targetId:1,parameter:0,depth:.3},{kind:'lfo',targetId:2,parameter:0,depth:-.2}];const saved=normalizeModulation(m);assert.equal(new Set(saved.sources[0].routes.map(routeTargetKey)).size,3);assert.deepEqual(toCoreModulation(saved).sources[0].routes.map(r=>r.target_kind),[1,2,2]);assert.throws(()=>normalizeModulation({...m,version:2}));

});



test('Creative FX repeated types use globally unique IDs and ordered actual effect subsequence',()=>{

 let r=normalizeRack();assert.deepEqual(r.effects,[]);r.audio.push(newSauceBlock(r,'fullness'));r.effects.push(newSauceBlock(r,'moving-space'));r.notes.push(newSauceBlock(r,'arp'));r.effects.push(newSauceBlock(r,'impact'));r.effects.push(newSauceBlock(r,'impact'));r=normalizeRack(r);

 assert.deepEqual(r.effects.map(b=>b.id),[2,4,5]);assert.equal(r.effects[0].mix,.35);assert.equal(r.effects[1].mix,.7);assert(r.effects.every(b=>b.enabled&&!b.primary));

 const m=normalizeModulation(),before=structuredClone(r);r=reorderRack(r,m,['effects:5','notes:3','audio:1','effects:2','effects:4']);assert.deepEqual(toCoreCreativeFX(r).blocks.map(b=>b.id),[5,2,4]);assert.deepEqual(toCoreSauce(r),toCoreSauce(before));assert.deepEqual(toCoreNotes(r),toCoreNotes(before));assert.deepEqual(normalizeRack(JSON.parse(JSON.stringify(r))),r);

 r.effects=r.effects.filter(b=>b.id!==2);r=normalizeRack(r);assert(!r.order.includes('effects:2'));assert.deepEqual(toCoreCreativeFX(r).blocks.map(b=>b.id),[5,4]);

 assert.throws(()=>normalizeRack({...r,effects:[{...r.effects[0],id:1}]}));assert.throws(()=>normalizeRack({...r,effects:[{...r.effects[0],primary:true}]}));assert.throws(()=>normalizeRack({...r,effects:Array.from({length:17},(_,i)=>({...r.effects[0],id:20+i}))}));

 for(const[key,,lo,hi]of CREATIVE_FX_FIELDS){for(const value of[lo,hi])assert.equal(normalizeRack({...r,effects:[{...r.effects[0],[key]:value}]}).effects[0][key],value);for(const value of[NaN,undefined,lo-1,hi+1])assert.throws(()=>normalizeRack({...r,effects:[{...r.effects[0],[key]:value}]}));}

});



test('Moving Space Env and unified LFO Move are independent signed controls with no implicit source power',()=>{const rack=normalizeRack();rack.effects.push(newSauceBlock(rack,'moving-space'));rack.effects.push(newSauceBlock(rack,'impact'));rack.effects[0].motion=-1;const m=normalizeModulation();m.sources[0].routes.push({kind:'effects',targetId:1,parameter:0,depth:-.8});m.sources[1].routes=[{kind:'effects',targetId:1,parameter:0,depth:.6}];const before=structuredClone(m),norm=normalizeModulation(m);assert.equal(norm.sources[0].enabled,false);assert.deepEqual(m,before);assert.equal(toCoreCreativeFX(rack).blocks[0].motion,-1);assert.equal(toCoreModulation(norm).sources[0].routes.at(-1).target_kind,3);assert.equal(toCoreModulation(norm).sources[0].routes.at(-1).depth,-.8);const choices=modulationDestinations([],rack,norm).filter(d=>d.kind==='effects');assert.deepEqual(choices.map(d=>d.key),['effects:1:0']);assert.equal(choices[0].label,'Moving Space 1 · Move');for(const bad of[{kind:'effects',targetId:0,parameter:0,depth:.5},{kind:'effects',targetId:1,parameter:1,depth:.5}])assert.throws(()=>normalizeModulation({...m,sources:[{...m.sources[0],routes:[bad]},...m.sources.slice(1)]}));});

test('Removing a Moving Space target prunes only its routes, preserves clocks/power and Undo snapshot',()=>{const r=normalizeRack();r.effects.push(newSauceBlock(r,'moving-space'));r.effects.push(newSauceBlock(r,'moving-space'));const m=normalizeModulation();m.sources[0].routes.push({kind:'effects',targetId:1,parameter:0,depth:-.8},{kind:'effects',targetId:2,parameter:0,depth:.4});m.sources[1]={...defaultLfo(2),enabled:true,retrigger:true,routes:[{kind:'effects',targetId:1,parameter:0,depth:1}]};const before=structuredClone(m),removed={...r,effects:[r.effects[1]]},after=pruneEffectRoutes(m,removed);assert.deepEqual(m,before);assert.deepEqual(after.sources[0].routes,before.sources[0].routes.filter(x=>x.targetId!==1));assert.deepEqual(after.sources[1],{...before.sources[1],routes:[]});assert.deepEqual(pruneEffectRoutes(before,r),before);const changed={...r,effects:[{...r.effects[0],type:'impact'},r.effects[1]]};assert.deepEqual(pruneEffectRoutes(m,changed),after);});
