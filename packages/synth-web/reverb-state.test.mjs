import {test} from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_REVERB,REVERB_FIELDS,normalizeReverb,toCoreReverb} from './reverb-state.js';
test('reverb defaults are inactive and complete; independent settings preserve hidden mode controls',()=>{
 const a=normalizeReverb(),b=normalizeReverb();a.type='shimmer';a.enabled=true;a.shimmerSemitones=-7;a.wetWidth=1.8;
 assert.deepEqual(b,DEFAULT_REVERB);assert.deepEqual(normalizeReverb(JSON.parse(JSON.stringify(a))),a);
 const native=toCoreReverb(a);assert.equal(native.mode,2);assert.equal(native.enabled,1);assert.equal(native.shimmer_semitones,-7);assert.equal(native.wet_width,1.8);assert.equal(REVERB_FIELDS.length,13);
});
test('all reverb endpoints validate and malformed settings reject without changing source',()=>{
 for(const[key,,min,max]of REVERB_FIELDS){for(const value of[min,max])assert.equal(normalizeReverb({...DEFAULT_REVERB,[key]:value})[key],value);for(const value of[NaN,Infinity,min-1,max+1,undefined])assert.throws(()=>normalizeReverb({...DEFAULT_REVERB,[key]:value}),key);}
 for(const change of[{version:2},{enabled:1},{type:'room'}])assert.throws(()=>normalizeReverb({...DEFAULT_REVERB,...change}));
 const input={...DEFAULT_REVERB,decay:999},copy={...input};assert.throws(()=>normalizeReverb(input));assert.deepEqual(input,copy);
});
