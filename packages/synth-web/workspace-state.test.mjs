import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_MODULATION,normalizeModulation,toCoreModulation,pruneEffectRoutes,MOD_ROUTE_LIMIT} from './modulation-state.js';
import {DEFAULT_ENVELOPES,normalizeEnvelopes,hydrateEnvelopes,envelopesToTone,toCoreEnvelopes,pruneEnvelopeRoutes} from './envelope-state.js';
import {DEFAULT_TUNING,normalizeTuning,hydrateTuning,toCoreTuning} from './tuning-state.js';
import {DEFAULT_FILTER_BANK,normalizeFilterBank,hydrateFilterBank,filterBankToAliases,toCoreFilterBank} from './filter-bank-state.js';
import {buildModulationTargets,modulationTargetForControl,isKnownModulationTarget} from './modulation-targets.js';
import {DEFAULT_RACK,syncRackOrder} from './sauce-state.js';
const copy=x=>structuredClone(x);
const route=(kind,targetId,parameter,depth=.4)=>({kind,targetId,parameter,depth});

test('four persistent independent LFOs keep power off, exact identities and eight routes',()=>{
 const m=normalizeModulation();assert.deepEqual(m.sources.map(s=>s.id),[1,2,3,4]);assert.ok(m.sources.every(s=>!s.enabled));
 m.sources[1].points[1].y=.2;assert.notEqual(m.sources[0].points[1].y,.2);
 m.sources[2].routes=Array.from({length:MOD_ROUTE_LIMIT},(_,i)=>route('config',20,8+i));
 assert.equal(toCoreModulation(m).sources[2].routes.length,8);
 m.sources[2].routes.push(route('config',23,0));assert.throws(()=>normalizeModulation(m));
 assert.throws(()=>normalizeModulation({...DEFAULT_MODULATION,sources:DEFAULT_MODULATION.sources.slice(0,3)}));
 assert.throws(()=>normalizeModulation({...DEFAULT_MODULATION,sources:[...DEFAULT_MODULATION.sources.slice(0,3),{...DEFAULT_MODULATION.sources[3],id:7}]}));
 assert.deepEqual(syncRackOrder(DEFAULT_RACK,DEFAULT_MODULATION).order,[]);
});

test('envelope aliases preserve routes and independent Env3 without mutating tone',()=>{
 const e=normalizeEnvelopes(),values=Array(44).fill(0);
 [4,25].forEach((base,i)=>[.02+i,.4,.6,.8,.2,-.3,.4].forEach((v,j)=>values[base+j]=v));
 e.sources[0].routes=[route('config',11,0,-.7)];e.sources[2].attack=4;
 const h=hydrateEnvelopes(e,values);assert.equal(h.sources[0].attack,.02);assert.equal(h.sources[1].attack,1.02);assert.equal(h.sources[2].attack,4);
 assert.deepEqual(h.sources[0].routes,e.sources[0].routes);assert.equal(e.sources[0].attack,DEFAULT_ENVELOPES.sources[0].attack);
 const next=envelopesToTone(h,values);next[4]=3;assert.equal(values[4],.02);
 const c=toCoreEnvelopes(h);assert.equal(c.sources[0].attack_bend,.2);assert.deepEqual(c.sources[0].routes[0],{target_kind:4,target_id:11,parameter_id:0,depth:-.7});
 for(const [field,value] of [['attack',5.01],['decay',8.01],['release',10.01],['sustain',1.01],['attackBend',2.01]]){const bad=copy(e);bad.sources[2][field]=value;assert.throws(()=>normalizeEnvelopes(bad),field);}
});

test('independent tuning encodes signed octaves and cents; Sub hydration is one alias',()=>{
 const t=normalizeTuning();t.oscillators[0]={octave:-3,fineCents:-100};t.oscillators[1]={octave:3,fineCents:100};t.sub.fineCents=12.5;
 const h=hydrateTuning(t,{octave:2}),c=toCoreTuning(h);
 assert.deepEqual(c.oscillators,[{octave:-3,fine_cents:-100},{octave:3,fine_cents:100},{octave:2,fine_cents:12.5}]);assert.equal(t.sub.octave,-1);
 for(const v of [3.1,4,NaN]){const bad=copy(t);bad.sub.octave=v;assert.throws(()=>normalizeTuning(bad));}
 assert.equal(DEFAULT_TUNING.oscillators[0].octave,0);
});

test('Filter A aliases do not overwrite independently configured Filter B',()=>{
 const b=normalizeFilterBank(),v=Array(44).fill(0);Object.assign(v,{11:700,42:.8,23:.3,43:1});
 b.filters[1]={enabled:true,model:'resonant',osc1:false,osc2:true,cutoff:3100,resonance:.4,mix:.9,drive:2};
 const h=hydrateFilterBank(b,v,{filterModel:'ladder',filterDrive:5},{osc1:true,osc2:false});
 assert.deepEqual(h.filters[1],b.filters[1]);assert.equal(h.filters[0].model,'ladder');
 assert.deepEqual(toCoreFilterBank(h).filters.map(f=>[f.model,f.mask,f.enabled]),[[2,1,1],[1,2,1]]);
 const aliases=filterBankToAliases(h,v,{filterModel:'existing'},{osc1:false,osc2:true});assert.equal(aliases.values[11],700);assert.equal(aliases.sound.filterDrive,5);assert.deepEqual(aliases.routing,{osc1:true,osc2:false});
 assert.equal(DEFAULT_FILTER_BANK.filters[1].enabled,false);const bad=copy(h);bad.filters[1].cutoff=Infinity;assert.throws(()=>normalizeFilterBank(bad));
});

test('target registry uses physical config words and native authority, excluding discrete and composite controls',()=>{
 const targets=buildModulationTargets([],DEFAULT_RACK,DEFAULT_MODULATION);
 for(const [control,key] of [['suite:driveDb','config:20:8'],['output:reverb:ducking','config:22:16'],['filter:1:cutoff','config:11:0'],['env:3:release','config:42:3'],['tuning:sub:fineCents','config:28:1']])assert.equal(modulationTargetForControl(targets,control)?.key,key);
 for(const p of [2,12,19,20,24,36,43])assert.equal(isKnownModulationTarget('tone',0,p),false);
 assert.equal(modulationTargetForControl(targets,'character'),null);
 assert.equal(targets.find(t=>t.key==='tone:0:11').canonicalKey,'config:10:0');
 assert.equal(targets.find(t=>t.key==='tone:0:25').canonicalKey,'config:41:0');
 assert.equal(targets.find(t=>t.key==='config:11:0').canonicalKey,'config:11:0');
 const native=buildModulationTargets([],DEFAULT_RACK,DEFAULT_MODULATION,(kind,id,p)=>kind===4&&id===11&&p===0?{min:30,max:16000,mapping:1,scope:1,unit:'Hz'}:null);
 assert.equal(native.length,1);assert.equal(native[0].min,30);assert.equal(native[0].scope,1);
});

test('rack deletion prunes both source families atomically while preserving unrelated routes and source clocks',()=>{
 const rack={audio:[{id:3}],effects:[{id:7,type:'moving-space'},{id:8,type:'impact'}]};
 const routes=[route('sauce',3,0),route('sauce',99,0),route('effects',7,0),route('effect-control',7,5),route('effect-control',8,5),route('effect-control',99,0),route('config',20,8),route('tone',0,15)];
 const m=normalizeModulation();m.sources[0].routes=copy(routes);m.sources[0].rate=3.2;m.sources[0].enabled=true;
 const e=normalizeEnvelopes();e.sources[2].routes=copy(routes);const original=copy({m,e});
 const pm=pruneEffectRoutes(m,rack),pe=pruneEnvelopeRoutes(e,rack),expected=routes.filter((_,i)=>[0,2,4,6].includes(i));
 assert.deepEqual(pm.sources[0].routes,expected);assert.deepEqual(pe.sources[2].routes,expected);assert.equal(pm.sources[0].rate,3.2);assert.equal(pm.sources[0].enabled,true);
 assert.deepEqual({m,e},original);pm.sources[0].routes[0].depth=-1;assert.equal(m.sources[0].routes[0].depth,.4);
});

test('Standalone Drop routes are exposed only for a bound primary and prune in both source families',()=>{const rack={...DEFAULT_RACK,notes:[{id:4,type:'drop',primary:true}]};assert(buildModulationTargets([],rack,DEFAULT_MODULATION).some(t=>t.key==='tone:0:15'));assert(!buildModulationTargets([],DEFAULT_RACK,DEFAULT_MODULATION).some(t=>t.key==='tone:0:15'));const m=normalizeModulation(),e=normalizeEnvelopes();m.sources[0].routes=[route('tone',0,15)];e.sources[0].routes=[route('tone',0,16)];assert.equal(pruneEffectRoutes(m,rack).sources[0].routes.length,1);assert.equal(pruneEnvelopeRoutes(e,rack).sources[0].routes.length,1);assert.equal(pruneEffectRoutes(m,DEFAULT_RACK).sources[0].routes.length,0);assert.equal(pruneEnvelopeRoutes(e,DEFAULT_RACK).sources[0].routes.length,0);});
