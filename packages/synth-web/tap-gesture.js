// Shared cancellation counters avoid retaining disposed/rebuilt dial elements.
const environments=new WeakMap();
function environment(doc){
 if(environments.has(doc))return environments.get(doc);
 const env={serial:0,cancel:0};environments.set(doc,env);
 doc.addEventListener('pointerdown',()=>env.serial++,{capture:true});
 doc.defaultView.addEventListener('keydown',e=>{if(e.key==='Escape')env.cancel++;});
 doc.defaultView.addEventListener('blur',()=>env.cancel++);return env;
}
// Pointer taps only: a drag, cancellation or second pointer never counts as a tap.
export function bindDoubleTap(target,action,{key=()=>true,available=()=>true}={}){
 const env=environment(target.ownerDocument);let down=null,last=null;
 target.addEventListener('pointerdown',e=>{
  if(down||!available()||(e.button!==undefined&&e.button!==0)){down=null;last=null;return;}
  const identity=key(e);if(identity===null||identity===false||identity===undefined){last=null;return;}
  down={id:e.pointerId,x:e.clientX,y:e.clientY,time:e.timeStamp,kind:e.pointerType||'mouse',identity,serial:env.serial,cancel:env.cancel};
 },{capture:true});
 target.addEventListener('pointermove',e=>{if(down?.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){down=null;last=null;}});
 const clear=()=>{down=null;last=null;};
 target.addEventListener('pointercancel',clear);target.addEventListener('lostpointercapture',()=>{if(down)clear();});
 target.addEventListener('pointerup',e=>{
  if(down?.id!==e.pointerId)return;const tap=down;down=null;
  if(e.timeStamp-tap.time>300||tap.serial!==env.serial||tap.cancel!==env.cancel||!available()){last=null;return;}
  if(last&&last.identity===tap.identity&&last.kind===tap.kind&&tap.serial===last.serial+1&&last.cancel===tap.cancel&&e.timeStamp-last.time<=350&&Math.hypot(e.clientX-last.x,e.clientY-last.y)<=24){last=null;action(tap.identity,e);}
  else last={identity:tap.identity,kind:tap.kind,time:e.timeStamp,x:e.clientX,y:e.clientY,serial:tap.serial,cancel:tap.cancel};
 });
 target.addEventListener('keydown',e=>{last=null;if(available()&&!e.repeat&&(e.key==='Backspace'||e.key==='Delete')&&target.getAttribute('role')==='slider'){e.preventDefault();action(true,e);}});
 target.addEventListener('dblclick',e=>e.preventDefault());return{clear};
}
export function markDialDefault(button,unit,text){
 let marker=button.querySelector('.dial-default-marker');if(!marker){marker=document.createElement('span');marker.className='dial-default-marker';marker.setAttribute('aria-hidden','true');button.append(marker);}
 button.style.setProperty('--default-rotation',(-135+Math.max(0,Math.min(1,unit))*270)+'deg');
 button.dataset.defaultValue=text;button.title='Double tap to reset · '+text+' (Backspace)';
}
