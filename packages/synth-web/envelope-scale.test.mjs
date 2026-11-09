import {test} from 'node:test';
import assert from 'node:assert/strict';
import {timeFromUnit,timeToUnit} from './envelope-scale.js';
test('time editing is monotone, reversible and spends70% of travel between30ms and2s',()=>{
 for(const max of [5,8,10]){
  let previous=0;
  for(let i=0;i<=1000;i++){const n=i/1000,value=timeFromUnit(n,.001,max);assert(value>=previous);assert(Math.abs(timeToUnit(value,.001,max)-n)<1e-12);previous=value;}
  assert(Math.abs(timeFromUnit(.15,.001,max)-.03)<1e-12);assert(Math.abs(timeFromUnit(.85,.001,max)-2)<1e-12);
  const middle=timeToUnit(.4,.001,max);const edited=timeFromUnit(middle+10/(280*1.2),.001,max);
  assert(edited>.4&&edited<.5,'10px drag near400ms must remain fine');
 }
});
