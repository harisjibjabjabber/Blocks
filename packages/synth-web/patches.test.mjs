import {test} from 'node:test';
import assert from 'node:assert/strict';
import {migratePatch} from './patches.js';
const parameters=Array.from({length:35},(_,id)=>({min:0,max:[1,21,22,23,27,34].includes(id)?1:id===19||id===20?4:100,default:id===19?2:id===20?3:id===21?.65:id===22?.35:id===23?1:0,mapping:id===19||id===20?2:0}));
test('legacy prefixes map balance to independent levels and preserve old waves/defaults',()=>{
 for(const[version,count]of[[1,18],[2,19],[3,21]]){
  const values=Array(count).fill(.1);values[1]=.7;if(count>19){values[19]=0;values[20]=1;}
  const patch={format:'blocks-synth-patch',version,values},copy=structuredClone(patch),result=migratePatch(patch,parameters,4);
  assert.deepEqual(result.slice(0,count),values);assert(Math.abs(result[21]-.3)<1e-12);assert.equal(result[22],.7);assert.equal(result[23],1);assert.equal(result[32],0);assert.equal(result[34],0);assert.deepEqual(patch,copy);
  if(count<21)assert.deepEqual(result.slice(19,21),[2,3]);
 }
});
test('v4 levels are authoritative, square rounds, invalid inputs reject without mutation',()=>{
 const values=parameters.map(p=>p.default);values[21]=.8;values[22]=.4;values[1]=0;values[19]=3.7;
 const base={format:'blocks-synth-patch',version:4,values},result=migratePatch(base,parameters,4);
 assert.equal(result[21],.8);assert.equal(result[22],.4);assert(Math.abs(result[1]-1/3)<1e-12);assert.equal(result[19],4);
 for(const patch of [null,{...base,version:5},{...base,version:'4'},{...base,format:'other'},{...base,values:[]},{...base,values:[...values,1]},{...base,values:[NaN,...values.slice(1)]},{...base,values:[Infinity,...values.slice(1)]}])assert.throws(()=>migratePatch(patch,parameters,4));
 assert.equal(values[1],0);assert.equal(values[19],3.7);
});
