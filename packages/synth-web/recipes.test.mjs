import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRecipe,readRecipe,characterRecipe } from './recipes.js';
test('Character is bounded, reversible and preserves unrelated patch parameters',()=>{
  const original=Array.from({length:19},(_,i)=>i);
  for(const amount of [-1,0,.16,.32,.6,.8,1,2]){
    const next=applyRecipe(characterRecipe,amount,original),n=Math.max(0,Math.min(1,amount));
    assert.ok(Math.abs(next[13]-(n<=.6?n*10:6+(n-.6)*35))<1e-12);assert.ok(Math.abs(next[12]-(1+n*1.2))<1e-12);assert.ok(Math.abs(next[14]-(.1+n*.5))<1e-12);
    const read=readRecipe(characterRecipe,next);assert.ok(Math.abs(read.amount-n)<1e-12);assert.equal(read.custom,false);
    for(let i=0;i<19;i++)if(![12,13,14].includes(i))assert.equal(next[i],original[i]);
  }
  assert.deepEqual(original,Array.from({length:19},(_,i)=>i));
  const changed=applyRecipe(characterRecipe,.5,original);changed[12]=7;
  assert.deepEqual(readRecipe(characterRecipe,changed),{amount:.5,custom:true});
  assert.throws(()=>applyRecipe(characterRecipe,NaN,original));
});
