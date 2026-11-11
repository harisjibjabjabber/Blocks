import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeOscBass,toCoreOscBass,bassDivisions} from './osc-bass-state.js';
test('New Bass defaults off and independent oscillator state roundtrips native units',()=>{
 const state=normalizeOscBass();assert.deepEqual(state.oscillators,[{enabled:false,voice:'rotor',synced:false,retrigger:false,spinHz:4,motion:.65,grit:.35,cycleBeats:1,curl:0},{enabled:false,voice:'rotor',synced:false,retrigger:false,spinHz:4,motion:.65,grit:.35,cycleBeats:1,curl:0}]);
 Object.assign(state.oscillators[0],{enabled:true,voice:'growl',synced:true,retrigger:true,spinHz:12,motion:.8,grit:.9,cycleBeats:2/3,curl:.4});assert.equal(state.oscillators[1].enabled,false);
 assert.deepEqual(normalizeOscBass(JSON.parse(JSON.stringify(state))),state);
 assert.deepEqual(toCoreOscBass(state),{version:2,reserved:0,oscillators:[{enabled:1,voice:1,synced:1,retrigger:1,spin_hz:12,motion:.8,grit:.9,cycle_beats:2/3,curl:.4},{enabled:0,voice:0,synced:0,retrigger:0,spin_hz:4,motion:.65,grit:.35,cycle_beats:1,curl:0}]});
});
test('Bass rejects invalid second oscillator atomically and leaves caller state untouched',()=>{
 const state=normalizeOscBass(),copy=structuredClone(state);
 for(const change of[{enabled:1},{spinHz:0},{spinHz:21},{motion:NaN},{motion:-.1},{grit:1.1},{voice:'unknown'},{cycleBeats:0},{curl:1},{synced:1}])assert.throws(()=>normalizeOscBass({...state,oscillators:[state.oscillators[0],{...state.oscillators[1],...change}]}));
 assert.deepEqual(state,copy);assert.throws(()=>normalizeOscBass({...state,version:3}));assert.throws(()=>normalizeOscBass({...state,oscillators:[state.oscillators[0]]}));
});
test('Bass v1 rejects; current divisions retain dotted triplet and bars',()=>{const old={enabled:true,spinHz:7,motion:.25,grit:.75};assert.throws(()=>normalizeOscBass({version:1,oscillators:[old,old]}));const list=bassDivisions();assert(list.some(d=>d[0]==='1/8T'&&d[1]===1/3));assert(list.some(d=>d[0]==='1/4D'&&d[1]===1.5));assert(bassDivisions(3).some(d=>d[0]==='1 bar'&&d[1]===3));});
