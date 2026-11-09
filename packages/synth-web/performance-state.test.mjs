import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PERFORMANCE,normalizePerformance,toCorePerformance,fromCorePerformance,curlPhase,performanceSteps} from './performance-state.js';
test('performance state roundtrips all modes, orders and divisions independently of tone',()=>{
 for(const mode of ['off','arp','strum'])for(const order of ['up','down','played','random'])for(const division of ['1/4','1/8','1/16','1/8T','1/16T']){
  const s=normalizePerformance({...DEFAULT_PERFORMANCE,mode,order,division,mono:true,curl:-.3});assert.deepEqual(fromCorePerformance(toCorePerformance(s)),s);
 }
 assert.equal(normalizePerformance().mode,'off');assert.equal(performanceSteps({...DEFAULT_PERFORMANCE,division:'1/16T'}),24);
 const source={bpm:1000,curl:9};const bounded=normalizePerformance(source);assert.equal(bounded.bpm,240);assert.equal(bounded.curl,.8);assert.deepEqual(source,{bpm:1000,curl:9});
 for(const bad of [null,[],{version:2},{mode:'unknown'},{mono:1},{bpm:NaN},{division:'1/32'},{seed:-1}])assert.throws(()=>normalizePerformance(bad));
});
test('Curl pins every bar, is monotone, reversible and straight at zero without rounded accumulation',()=>{
 for(const n of [4,8,12,16,24])for(const c of [-.8,-.2,-1e-10,0,1e-10,.2,.8]){
  const times=Array.from({length:n+1},(_,i)=>curlPhase(i/n,c));assert.equal(times[0],0);assert.equal(times[n],1);
  for(let i=1;i<=n;i++)assert(times[i]>times[i-1]);
  for(let i=0;i<=n;i++)assert(Math.abs(times[i]-(1-curlPhase(1-i/n,-c)))<1e-12);
  const intervals=times.slice(1).map((t,i)=>t-times[i]);assert(Math.abs(intervals.reduce((a,b)=>a+b,0)-1)<1e-12);
  if(c===0)times.forEach((t,i)=>assert.equal(t,i/n));
 }
 const intervals=Array.from({length:4},(_,i)=>2000*(curlPhase((i+1)/4,.2)-curlPhase(i/4,.2)));assert.deepEqual(intervals.map(Math.round),[538,512,487,463]);
});
