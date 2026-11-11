import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const [nativePath,wasmPath]=process.argv.slice(2);
if(!nativePath||!wasmPath) throw Error('Usage: node scripts/compare-synth-renders.mjs native.wav wasm.wav');
const a=readFileSync(nativePath),b=readFileSync(wasmPath);
assert.equal(a.length,b.length);
assert.deepEqual(a.subarray(0,44),b.subarray(0,44));
let max=0,sum=0,energy=0;
for(let i=44;i<a.length;i+=2) {
  const x=a.readInt16LE(i),y=b.readInt16LE(i),delta=x-y;
  max=Math.max(max,Math.abs(delta)); sum+=delta*delta; energy+=x*x;
}
assert(energy>0,'Fixture must contain audio');
assert(max<=2,`Native/WASM differ by ${max} PCM16 units (limit 2)`);
console.log(JSON.stringify({samples:(a.length-44)/2,maxPcmDifference:max,rmsPcmDifference:Math.sqrt(sum/((a.length-44)/2))}));
