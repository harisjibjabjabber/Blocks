import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindDoubleTap} from './tap-gesture.js';
function fixture(){
 const doc=new EventTarget();doc.defaultView=new EventTarget();const target=new EventTarget();target.ownerDocument=doc;target.getAttribute=()=>null;const calls=[];bindDoubleTap(target,key=>calls.push(key),{key:e=>e.node});
 const event=(type,time,{id=1,x=10,y=10,node=2}={})=>{const e=new Event(type,{cancelable:true});for(const[k,v]of Object.entries({pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0,timeStamp:time,node}))Object.defineProperty(e,k,{value:v});if(type==='pointerdown')doc.dispatchEvent(new Event(type));target.dispatchEvent(e);};
 const tap=(time,options)=>{event('pointerdown',time,options);event('pointerup',time+40,options);};return{doc,target,calls,event,tap};
}
test('double tap requires two short taps of the same existing point and consumes the pair',()=>{
 const f=fixture();f.tap(0,{node:null});f.tap(100);assert.equal(f.calls.length,0);f.tap(200);assert.deepEqual(f.calls,[2]);f.tap(300);assert.equal(f.calls.length,1);f.tap(400,{node:3});assert.equal(f.calls.length,1);f.tap(500,{node:3});assert.deepEqual(f.calls,[2,3]);
});
test('drag, cancellation, Escape, another pointer and long hold cannot become a double tap',()=>{
 for(const interruption of['drag','cancel','escape','other','hold']){const f=fixture();f.tap(0);f.event('pointerdown',120);if(interruption==='drag')f.event('pointermove',140,{y:30});if(interruption==='cancel')f.event('pointercancel',140);if(interruption==='escape'){const e=new Event('keydown');Object.defineProperty(e,'key',{value:'Escape'});f.doc.defaultView.dispatchEvent(e);}if(interruption==='other')f.doc.dispatchEvent(new Event('pointerdown'));f.event('pointerup',interruption==='hold'?500:160);assert.equal(f.calls.length,0,interruption);}
});
