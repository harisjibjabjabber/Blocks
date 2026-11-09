import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyRecipe,readRecipe,characterRecipe,motionRecipe} from './recipes.js';
test('calibration motion is bounded and reversible; upper range deliberately exceeds20 cents',()=>{
 const before=Array.from({length:35},(_,i)=>i);
 for(const amount of [-1,0,.16,.32,.6,.8,1,2]){
  const n=Math.max(0,Math.min(1,amount)),next=applyRecipe(characterRecipe,amount,before);
  assert(Math.abs(next[13]-(n<=.6?8*n:4.8+(n-.6)*88))<1e-12);
  assert(Math.abs(next[32]-(n<=.6?2*n:1.2+(n-.6)*17))<1e-12);
  const read=readRecipe(characterRecipe,next);assert(Math.abs(read.amount-n)<1e-12);assert.equal(read.custom,false);
  for(let id=0;id<35;id++)if(!characterRecipe.targets.some(t=>t.id===id))assert.equal(next[id],before[id]);
 }
 const maximum=applyRecipe(motionRecipe,1,before);assert.equal(maximum[13],40);assert.equal(maximum[32],8);assert.equal(maximum[12],before[12]);assert.equal(maximum[14],before[14]);
 assert.deepEqual(before,Array.from({length:35},(_,i)=>i));assert.throws(()=>applyRecipe(motionRecipe,NaN,before));
});
