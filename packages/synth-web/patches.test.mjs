import {test} from 'node:test';
import assert from 'node:assert/strict';
import {migratePatch} from './patches.js';
const parameters=Array.from({length:40},(_,id)=>({min:0,max:[1,21,22,23,27,34,35,36,37,38,39].includes(id)?1:id===19||id===20?4:120,default:id===19?2:id===20?3:id===21?.65:id===22?.35:[23,35,36,37,39].includes(id)?1:0,mapping:[19,20,36,37,38,39].includes(id)?2:0}));
test('v1-v4 prefixes preserve physical settings and migrate manual response plus powered Sauce',()=>{
 for(const[version,count]of[[1,18],[2,19],[3,21],[4,35]]){
  const values=Array(count).fill(.1);values[1]=.7;if(count>19){values[19]=0;values[20]=1;}if(version===4){values[21]=.3;values[22]=.7;}
  const patch={format:'blocks-synth-patch',version,values},copy=structuredClone(patch),result=migratePatch(patch,parameters,5);
  assert.deepEqual(result.slice(0,count),values);assert(Math.abs(result[21]-.3)<1e-12);assert.equal(result[22],.7);assert.equal(result[35],0);assert.deepEqual(result.slice(36),[1,1,0,1]);assert.deepEqual(patch,copy);
  if(count<21)assert.deepEqual(result.slice(19,21),[2,3]);
 }
});
test('v5 levels and Sauce state roundtrip, waveform rounds, invalid schema rejects atomically',()=>{
 const values=parameters.map(p=>p.default);values[21]=.8;values[22]=.4;values[1]=0;values[19]=3.7;values[38]=1;values[36]=0;
 const base={format:'blocks-synth-patch',version:5,values},result=migratePatch(base,parameters,5);
 assert.equal(result[21],.8);assert.equal(result[22],.4);assert(Math.abs(result[1]-1/3)<1e-12);assert.equal(result[19],4);assert.equal(result[38],1);assert.equal(result[36],0);assert.equal(result[35],1);
 for(const patch of [null,{...base,version:6},{...base,version:4},{...base,version:'5'},{...base,format:'other'},{...base,values:[]},{...base,values:[...values,1]},{...base,values:[NaN,...values.slice(1)]}])assert.throws(()=>migratePatch(patch,parameters,5));
 assert.equal(values[1],0);assert.equal(values[19],3.7);
});
