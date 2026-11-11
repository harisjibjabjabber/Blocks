import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyRecipe,readRecipe,motionRecipe} from './recipes.js';
test('pitch movement calibration is bounded and reversible with deliberate extreme top end',()=>{
 const before=Array.from({length:42},(_,i)=>i);
 for(const [amount,drift,settling] of [[-1,0,0],[0,0,0],[.16,1.28,.32],[.32,2.56,.64],[.6,4.8,1.2],[.85,40,12],[1,120,60],[2,120,60]]){
  const n=Math.max(0,Math.min(1,amount)),next=applyRecipe(motionRecipe,amount,before);
  assert(Math.abs(next[13]-drift)<1e-12);assert(Math.abs(next[32]-settling)<1e-12);
  const read=readRecipe(motionRecipe,next);assert(Math.abs(read.amount-n)<1e-12);assert.equal(read.custom,false);
  for(let id=0;id<42;id++)if(!motionRecipe.targets.some(t=>t.id===id))assert.equal(next[id],before[id]);
 }
 assert.deepEqual(before,Array.from({length:42},(_,i)=>i));assert.throws(()=>applyRecipe(motionRecipe,NaN,before));
});
test('Motion does not write reserved distortion slots or independent speed and velocity',()=>{const before=Array.from({length:44},(_,i)=>i),motion=applyRecipe(motionRecipe,.9,before);for(const id of[12,14,33,34,36,38])assert.equal(motion[id],before[id]);const custom=[...motion];custom[32]=1;assert.equal(readRecipe(motionRecipe,custom).custom,true);});
