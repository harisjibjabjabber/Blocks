import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeVoicing,toCoreVoicing} from './voicing-state.js';
import {normalizeFilterRouting,toCoreFilterRouting} from './filter-routing-state.js';
test('independent oscillator settings roundtrip without linked object references',()=>{
 const v=normalizeVoicing({version:2,oscillators:[{count:5,detune:12.5,spread:.7},{count:5,detune:12.5,spread:.7}]});v.oscillators[0].count=2;
 assert.equal(v.oscillators[1].count,5);assert.deepEqual(normalizeVoicing(JSON.parse(JSON.stringify(v))),v);
 assert.deepEqual(toCoreVoicing(v),{version:2,reserved:0,oscillators:[{count:2,detune_cents:12.5,spread:.7},{count:5,detune_cents:12.5,spread:.7}]});
 const a=normalizeVoicing(),b=normalizeVoicing();a.oscillators[0].spread=1;assert.equal(b.oscillators[0].spread,0);
});
test('invalid second oscillator rejects entire voicing and does not mutate input',()=>{
 for(const patch of[{count:0},{count:8},{count:1.5},{detune:-1},{detune:Infinity},{detune:50.1},{spread:1.01},{spread:NaN}]){const v=normalizeVoicing();Object.assign(v.oscillators[1],patch);const copy=structuredClone(v);assert.throws(()=>normalizeVoicing(v));assert.deepEqual(v,copy);}
 for(const input of[null,{version:1,count:5,detune:12.5,spread:.7},{version:2,oscillators:[]},{version:2,oscillators:[{count:1,detune:0,spread:0}]},{version:3,oscillators:normalizeVoicing().oscillators}])assert.throws(()=>normalizeVoicing(input));
});
test('filter routing defaults both on and preserves all four explicit combinations',()=>{
 assert.deepEqual(normalizeFilterRouting(),{version:1,osc1:true,osc2:true});
 for(let mask=0;mask<4;mask++){const r={version:1,osc1:Boolean(mask&1),osc2:Boolean(mask&2)};assert.deepEqual(normalizeFilterRouting(JSON.parse(JSON.stringify(r))),r);assert.deepEqual(toCoreFilterRouting(r),{version:1,mask});}
 for(const input of[null,{version:1,count:5,detune:12.5,spread:.7},{version:1,osc1:1,osc2:true},{version:1,osc1:true},{version:2,osc1:true,osc2:true}])assert.throws(()=>normalizeFilterRouting(input));
});
