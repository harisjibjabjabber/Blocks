import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyPeak,receivePeak,peakDisplay} from './peak-meter.js';
test('stereo telemetry peak holds, warns near full scale and latches genuine clipping',()=>{
 let state=receivePeak(emptyPeak(),{peak:.5});assert.equal(peakDisplay(state).state,'normal');
 state=receivePeak(state,{peak:.99,clipped:false});assert.equal(peakDisplay(state).state,'near');assert.equal(state.clipped,false);
 state=receivePeak(state,{peak:.1,clipped:true});assert.equal(peakDisplay(state).state,'clip');
 state=receivePeak(state,{peak:0,clipped:false});assert.equal(state.clipped,true);
 assert.equal(peakDisplay(emptyPeak()).state,'normal');
 assert.equal(peakDisplay(receivePeak(emptyPeak(),{peak:NaN,nonFinite:true})).text,'Invalid audio');
 assert.equal(receivePeak(emptyPeak(),{peak:1}).clipped,true);
});
