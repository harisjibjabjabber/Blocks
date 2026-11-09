import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migratePatch } from './patches.js';
const parameters=Array.from({length:21},(_,id)=>({min:0,max:id<19?100:3,default:id===19?2:id===20?3:0,mapping:id>=19?2:0}));
test('legacy patch versions preserve values and default missing Fullness/waveforms',()=>{
  for(const [version,count] of [[1,18],[2,19],[3,21]]){
    const input={format:'blocks-synth-patch',version,values:Array.from({length:count},(_,id)=>id<19?id:1)};
    const original=structuredClone(input),result=migratePatch(input,parameters,3);
    assert.deepEqual(result.slice(0,count),input.values);
    assert.deepEqual(result.slice(count),parameters.slice(count).map(p=>p.default));
    assert.deepEqual(input,original);
  }
});
test('invalid patches fail before mutating state; finite bounds and discrete waves clamp',()=>{
  const base={format:'blocks-synth-patch',version:3,values:Array(21).fill(0)};
  for(const patch of [null,{...base,format:'other'},{...base,version:4},{...base,version:'3'},{...base,values:[]},{...base,values:[...base.values,1]},{...base,values:[NaN,...base.values.slice(1)]},{...base,values:[Infinity,...base.values.slice(1)]}])assert.throws(()=>migratePatch(patch,parameters,3));
  const values=[...base.values];values[0]=1000;values[1]=-1;values[19]=1.6;values[20]=99;
  const result=migratePatch({...base,values},parameters,3);
  assert.equal(result[0],100);assert.equal(result[1],0);assert.equal(result[19],2);assert.equal(result[20],3);
  assert.throws(()=>migratePatch(base,parameters.slice(0,19),3));
});
