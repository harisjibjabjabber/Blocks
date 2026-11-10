import {test} from 'node:test';
import assert from 'node:assert/strict';
import {curveValue,moveCurvePoint,insertCurvePoint,POINT_GAP} from './lfo-curve.js';
import {normalizeLfoPoints} from './modulation-state.js';
import {LFO_DIVISION_ORDER} from './lfo-timing.js';

test('bend preserves endpoints and cannot overshoot either direction',()=>{
  for(const bend of[-1,-.5,0,.5,1])for(const sign of[-1,1]){
    const points=[{x:0,y:-sign,bend},{x:1,y:sign,bend:0}];assert.equal(curveValue(points,0),-sign);assert.equal(curveValue(points,1),sign);
    let last=-sign;for(let n=1;n<=100;n++){const value=curveValue(points,n/100);assert(value>=-1&&value<=1);assert(sign*(value-last)>=-1e-12);last=value;}
  }
});
test('point drag pins endpoint times, permits discontinuous endpoint levels and bounds neighbours',()=>{
  const points=[{x:0,y:0,bend:0},{x:.5,y:1,bend:0},{x:1,y:0,bend:0}];
  assert.deepEqual(moveCurvePoint(points,0,.8,1)[0],{x:0,y:1,bend:0});assert.deepEqual(moveCurvePoint(points,2,.2,-1)[2],{x:1,y:-1,bend:0});
  const left=moveCurvePoint(points,1,-10,5),right=moveCurvePoint(points,1,10,-5);assert.equal(left[1].x,POINT_GAP);assert.equal(right[1].x,1-POINT_GAP);assert.equal(left[1].y,1);assert.equal(right[1].y,-1);normalizeLfoPoints(left);normalizeLfoPoints(right);
});
test('inserted phase uses native-safe grid, has finite capacity and does not mutate input',()=>{
  const initial=[{x:0,y:0,bend:.2},{x:1,y:1,bend:0}];let points=initial;
  for(let i=1;i<=30;i++){points=insertCurvePoint(points,i/31,.3);assert(points);normalizeLfoPoints(points);}
  assert.equal(points.length,32);assert.equal(insertCurvePoint(points,.42,0),null);assert.equal(initial.length,2);assert(points.every(p=>p.x*1024===Math.round(p.x*1024)));
  assert.equal(insertCurvePoint(initial,POINT_GAP/3,0),null);
});
test('shared timing dial orders straight and triplet divisions by actual duration',()=>{
  assert.deepEqual(LFO_DIVISION_ORDER,['1/1','1/2','1/4','1/4T','1/8','1/8T','1/16','1/16T','1/32','1/64']);
});
