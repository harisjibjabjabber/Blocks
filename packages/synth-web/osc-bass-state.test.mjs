import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeOscBass,toCoreOscBass} from './osc-bass-state.js';
test('Absent Bass migrates off and independent oscillator state roundtrips native units',()=>{
 const state=normalizeOscBass();assert.deepEqual(state.oscillators,[{enabled:false,spinHz:4,motion:.65,grit:.35},{enabled:false,spinHz:4,motion:.65,grit:.35}]);
 state.oscillators[0]={enabled:true,spinHz:12,motion:.8,grit:.9};assert.equal(state.oscillators[1].enabled,false);
 assert.deepEqual(normalizeOscBass(JSON.parse(JSON.stringify(state))),state);
 assert.deepEqual(toCoreOscBass(state),{version:1,reserved:0,oscillators:[{enabled:1,spin_hz:12,motion:.8,grit:.9},{enabled:0,spin_hz:4,motion:.65,grit:.35}]});
});
test('Bass rejects invalid second oscillator atomically and leaves caller state untouched',()=>{
 const state=normalizeOscBass(),copy=structuredClone(state);
 for(const change of[{enabled:1},{spinHz:0},{spinHz:21},{motion:NaN},{motion:-.1},{grit:1.1}])assert.throws(()=>normalizeOscBass({...state,oscillators:[state.oscillators[0],{...state.oscillators[1],...change}]}));
 assert.deepEqual(state,copy);assert.throws(()=>normalizeOscBass({...state,version:2}));assert.throws(()=>normalizeOscBass({...state,oscillators:[state.oscillators[0]]}));
});
