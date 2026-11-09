// Cards keep their own controls and expansion state. Drag previews never mutate DSP state.
export function createSauceRack({container,createEditor,onToggle,onAdd,onRemove,onReorder,canDrag=()=>true}) {
  container.className='sauce-workspace';
  const cards=new Map(),blocked=new Set();let current=[],drag=null,previousFocus=null;
  const names={drive:'Drive',fullness:'Fullness',arp:'Arp',strum:'Strum',drop:'Pitch Drop',lfo:'LFO'};
  const grid=document.createElement('div');grid.className='rack-grid';grid.setAttribute('aria-label','Sauce blocks');
  const add=document.createElement('button');add.type='button';add.id='sauce-add';add.textContent='+ Add';add.setAttribute('aria-haspopup','dialog');
  const picker=document.createElement('dialog');picker.id='sauce-picker';picker.setAttribute('aria-labelledby','sauce-picker-title');
  picker.innerHTML='<div class="rack-picker-heading"><h2 id="sauce-picker-title">Add Sauce</h2><button type="button" data-picker-close aria-label="Close Add Sauce">Ã—</button></div><div class="rack-picker-options"></div><p class="rack-picker-capacity"></p>';
  const options=picker.querySelector('.rack-picker-options');
  for(const type of ['drive','fullness','arp','strum','drop','lfo']){
    const b=document.createElement('button');b.type='button';b.dataset.rackAdd=type;
    const title=document.createElement('strong');title.textContent=names[type];const tag=document.createElement('span');tag.textContent=['drive','fullness'].includes(type)?'Audio':type==='lfo'?'Control':'Notes';b.append(title,tag);
    b.addEventListener('click',()=>{closePicker();onAdd(type);});options.append(b);
  }
  function closePicker(){picker.close();add.setAttribute('aria-expanded','false');add.focus();}
  add.addEventListener('click',()=>{if(!canDrag())return;previousFocus=document.activeElement;picker.showModal();add.setAttribute('aria-expanded','true');options.querySelector('button:not(:disabled)')?.focus();});
  picker.querySelector('[data-picker-close]').addEventListener('click',closePicker);picker.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePicker();}});picker.addEventListener('cancel',e=>{e.preventDefault();closePicker();});
  picker.addEventListener('click',e=>{if(e.target===picker){const r=picker.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePicker();}});
  container.append(grid,add,picker);
  const laneItems=lane=>current.filter(item=>item.lane===lane);
  function move(key,delta){if(!canDrag()||drag)return;const item=current.find(i=>i.key===key),items=laneItems(item.lane),index=items.findIndex(i=>i.key===key),target=index+delta;if(target<0||target>=items.length)return;[items[index],items[target]]=[items[target],items[index]];onReorder(item.lane,items.map(i=>i.id));}
  function make(item){
    const card=document.createElement('article');card.className='rack-card';card.dataset.rackBlock=item.key;card.dataset.rackType=item.type;
    const head=document.createElement('div');head.className='rack-card-header';
    const grip=document.createElement('button');grip.type='button';grip.className='rack-grip';grip.dataset.rackDrag=item.key;grip.textContent='â ¿';grip.title='Drag to reorder Â· arrow keys move';grip.setAttribute('aria-label','Move '+names[item.type]+' '+item.id);grip.hidden=item.lane==='lfo';
    grip.addEventListener('pointerdown',e=>startDrag(e,item.key));grip.addEventListener('pointermove',moveDrag);grip.addEventListener('pointerup',dropDrag);grip.addEventListener('pointercancel',cancelDrag);grip.addEventListener('lostpointercapture',e=>{if(drag?.pointer===e.pointerId)cancelDrag();});
    grip.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(e.key)){e.preventDefault();move(item.key,['ArrowLeft','ArrowUp'].includes(e.key)?-1:1);}});
    const title=document.createElement('div');title.className='rack-card-title';const name=document.createElement('h3');name.textContent=names[item.type]+(item.type==='lfo'?' '+item.id:'');const tag=document.createElement('span');tag.textContent=item.lane==='audio'?'Audio':item.lane==='notes'?'Notes':'Control';title.append(name,tag);
    const power=document.createElement('button');power.type='button';power.className='rack-power';power.dataset.rackPower=item.key;power.setAttribute('role','switch');power.setAttribute('aria-label',names[item.type]+' '+item.id+' enabled');power.addEventListener('click',()=>{if(canDrag()&&!drag)onToggle(item.key);});head.append(grip,title,power);
    const body=document.createElement('div');body.className='rack-card-controls';const details=document.createElement('details');details.className='rack-deeper';const summary=document.createElement('summary');summary.textContent='Details';summary.dataset.rackDetails=item.key;details.append(summary);
    const extra=document.createElement('div');extra.className='rack-extra';details.append(extra);
    const actions=document.createElement('div');actions.className='rack-card-actions';const earlier=document.createElement('button');earlier.type='button';earlier.textContent='â†';earlier.dataset.rackEarlier=item.key;earlier.setAttribute('aria-label','Move '+names[item.type]+' earlier');earlier.hidden=item.lane==='lfo';earlier.addEventListener('click',()=>move(item.key,-1));const later=document.createElement('button');later.type='button';later.textContent='â†’';later.dataset.rackLater=item.key;later.setAttribute('aria-label','Move '+names[item.type]+' later');later.hidden=item.lane==='lfo';later.addEventListener('click',()=>move(item.key,1));
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.dataset.rackRemove=item.key;remove.addEventListener('click',()=>{if(canDrag()&&!drag)onRemove(item.key);});actions.append(earlier,later,remove);details.append(actions);card.append(head,body,details);grid.append(card);
    const editor=createEditor(item,body,extra);return{card,power,grip,earlier,later,editor};
  }
  function startDrag(e,key){if(drag||!canDrag()||e.button!==0)return;const item=current.find(i=>i.key===key),items=laneItems(item.lane);if(items.length<2)return;e.preventDefault();const rect=cards.get(key).card.getBoundingClientRect();drag={key,lane:item.lane,pointer:e.pointerId,target:e.currentTarget,x:e.clientX,y:e.clientY,dx:e.clientX-rect.left,dy:e.clientY-rect.top,rect,before:items.map(i=>i.id),desired:items.map(i=>i.id),active:false,area:grid.getBoundingClientRect(),slots:items.map(i=>({id:i.id,rect:cards.get(i.key).card.getBoundingClientRect()}))};e.currentTarget.setPointerCapture(e.pointerId);}
  const inside=e=>drag&&e.clientX>=drag.area.left&&e.clientX<=drag.area.right&&e.clientY>=drag.area.top&&e.clientY<=drag.area.bottom;
  function previewOrder(){const byLane={};for(const lane of ['audio','notes','lfo'])byLane[lane]=current.filter(i=>i.lane===lane);if(drag)byLane[drag.lane]=drag.desired.map(id=>current.find(i=>i.lane===drag.lane&&i.id===id));let n=0;for(const lane of ['notes','audio','lfo'])for(const item of byLane[lane])cards.get(item.key).card.style.order=String(n++);}
  function moveDrag(e){if(drag?.pointer!==e.pointerId)return;if(!drag.active){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<8)return;drag.active=true;const ghost=cards.get(drag.key).card.cloneNode(true);ghost.classList.add('rack-drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.inert=true;ghost.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));ghost.style.width=drag.rect.width+'px';ghost.style.height=drag.rect.height+'px';document.body.append(ghost);drag.ghost=ghost;cards.get(drag.key).card.dataset.dragging='true';}
    drag.ghost.style.left=e.clientX-drag.dx+'px';drag.ghost.style.top=e.clientY-drag.dy+'px';
    if(!inside(e)){drag.desired=[...drag.before];drag.ghost.dataset.invalid='true';}else{delete drag.ghost.dataset.invalid;const nearest=drag.slots.toSorted((a,b)=>Math.hypot(e.clientX-a.rect.left-a.rect.width/2,e.clientY-a.rect.top-a.rect.height/2)-Math.hypot(e.clientX-b.rect.left-b.rect.width/2,e.clientY-b.rect.top-b.rect.height/2))[0],id=Number(drag.key.split(':')[1]),list=drag.before.filter(n=>n!==id),targetIndex=drag.before.indexOf(nearest.id);list.splice(targetIndex,0,id);drag.desired=list;}previewOrder();}
  function cancelDrag(){if(!drag)return;const d=drag;drag=null;d.ghost?.remove();const card=cards.get(d.key)?.card;if(card)delete card.dataset.dragging;previewOrder();try{if(d.target.hasPointerCapture(d.pointer))d.target.releasePointerCapture(d.pointer);}catch{}}
  function dropDrag(e){if(drag?.pointer!==e.pointerId)return;const lane=drag.lane,ids=[...drag.desired],changed=drag.active&&inside(e)&&JSON.stringify(ids)!==JSON.stringify(drag.before);cancelDrag();if(changed)onReorder(lane,ids);}
  document.addEventListener('pointerdown',e=>{if(drag&&drag.pointer!==e.pointerId){blocked.add(drag.pointer);blocked.add(e.pointerId);cancelDrag();e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('pointerup',e=>{if(blocked.has(e.pointerId)){e.preventDefault();e.stopImmediatePropagation();setTimeout(()=>blocked.delete(e.pointerId),600);}},true);document.addEventListener('click',e=>{if(blocked.has(e.pointerId)){blocked.delete(e.pointerId);e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){cancelDrag();e.preventDefault();}});window.addEventListener('blur',cancelDrag);window.addEventListener('resize',cancelDrag);
  function update({rack,modulation}){
    const next=[...rack.notes.map(b=>({...b,lane:'notes',key:'notes:'+b.id})),...rack.audio.map(b=>({...b,lane:'audio',key:'audio:'+b.id})),...modulation.sources.filter(s=>s.id!==1).map(s=>({...s,lane:'lfo',type:'lfo',key:'lfo:'+s.id}))];
    if(drag&&JSON.stringify(next.filter(i=>i.lane===drag.lane).map(i=>i.id))!==JSON.stringify(drag.before))cancelDrag();current=next;
    for(const[key,entry]of cards)if(!current.some(i=>i.key===key)){entry.editor.destroy?.();entry.card.remove();cards.delete(key);}
    for(const item of current){if(!cards.has(item.key))cards.set(item.key,make(item));const entry=cards.get(item.key),lane=laneItems(item.lane),index=lane.findIndex(i=>i.id===item.id);entry.power.textContent=item.enabled?'On':'Off';entry.power.setAttribute('aria-checked',String(item.enabled));entry.card.dataset.enabled=String(item.enabled);entry.earlier.disabled=index===0;entry.later.disabled=index===lane.length-1;entry.grip.disabled=lane.length<2;entry.editor.update();}
    if(!drag){const focused=document.activeElement;current.forEach((item,index)=>{const card=cards.get(item.key).card;if(grid.children[index]!==card)grid.insertBefore(card,grid.children[index]||null);});if(focused&&grid.contains(focused)&&document.activeElement!==focused)focused.focus({preventScroll:true});}
    previewOrder();for(const b of options.children){const type=b.dataset.rackAdd;b.disabled=type==='lfo'?modulation.sources.length>=4:['drive','fullness'].includes(type)?rack.audio.length>=16:rack.notes.length>=16;}
    picker.querySelector('.rack-picker-capacity').textContent=`Audio ${rack.audio.length}/16 Â· Notes ${rack.notes.length}/16 Â· LFO ${modulation.sources.length}/4`;
  }
  return{update,cancel:cancelDrag,closePicker,setPending:mask=>{current.filter(i=>i.lane==='notes').forEach((item,index)=>cards.get(item.key)?.editor.setPending?.(Boolean(mask&(1<<index))));}};
}
