import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyRecipe,readRecipe,characterRecipe,motionRecipe} from './recipes.js';
test('pitch movement calibration is bounded and reversible with deliberate extreme top end',()=>{
 const before=Array.from({length:40},(_,i)=>i);
 for(const [amount,drift,settling] of [[-1,0,0],[0,0,0],[.16,1.28,.32],[.32,2.56,.64],[.6,4.8,1.2],[.85,40,12],[1,120,60],[2,120,60]]){
  const n=Math.max(0,Math.min(1,amount)),next=applyRecipe(motionRecipe,amount,before);
  assert(Math.abs(next[13]-drift)<1e-12);assert(Math.abs(next[32]-settling)<1e-12);
  const read=readRecipe(motionRecipe,next);assert(Math.abs(read.amount-n)<1e-12);assert.equal(read.custom,false);
  for(let id=0;id<40;id++)if(!motionRecipe.targets.some(t=>t.id===id))assert.equal(next[id],before[id]);
 }
 assert.deepEqual(before,Array.from({length:40},(_,i)=>i));assert.throws(()=>applyRecipe(motionRecipe,NaN,before));
});
test('Character tone colour and Motion are independent, and both preserve pitch speed',()=>{
 const before=Array.from({length:40},(_,i)=>i),tone=applyRecipe(characterRecipe,.7,before),motion=applyRecipe(motionRecipe,.9,before);
 assert.deepEqual(tone.map((v,i)=>v===before[i]?null:i).filter(i=>i!==null),[12]);
 for(const id of [13,14,32,33,34])assert.equal(tone[id],before[id]);
 assert.equal(motion[12],before[12]);assert.equal(motion[14],before[14]);
 const combined=applyRecipe(characterRecipe,.7,motion);for(const id of [13,14,32,33,34])assert.equal(combined[id],motion[id]);
 const custom=[...motion];custom[32]=1;assert.equal(readRecipe(motionRecipe,custom).custom,true);
});
