import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalLevels,parameterBatch} from './parameter-state.js';
const patch=()=>{const p=Array(44).fill(0);p[1]=.35;p[21]=.65;p[22]=.35;return p;};
test('independent levels retain the other source and canonicalize legacy balance',()=>{
 const before=patch(),edit=[...before];edit[21]=.9;
 const next=canonicalLevels(edit,before);assert.equal(next[21],.9);assert.equal(next[22],.35);assert.equal(next[1],.35/1.25);
 const batch=parameterBatch(before,next);assert.deepEqual(batch.map(p=>p.id),[1,21,22]);assert.equal(batch[2].value,.35);
 const balance=[...next];balance[1]=.2;const legacy=canonicalLevels(balance,next);assert.equal(legacy[21],.8);assert.equal(legacy[22],.2);
 const silence=[...next];silence[21]=silence[22]=0;assert.equal(canonicalLevels(silence,next)[1],.5);
 assert.deepEqual(before,patch());
});
