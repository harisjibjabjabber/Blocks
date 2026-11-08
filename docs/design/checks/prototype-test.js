// Injected into a copy of hifi/prototype/index.html by run_checks.sh; result lands in body[data-test].
setTimeout(()=>{
 const out=[];
 go(S.findIndex(q=>q.id==='10-range-auto-too-short'));
 const roll=document.querySelector('[data-role="roll"]'); const hs=roll.querySelector('[data-role="hs"]');
 out.push('before:'+roll.querySelector('[data-role="rlabel"]').textContent);
 const r=roll.getBoundingClientRect(), sc=r.width/roll.offsetWidth;
 const X=b=>r.left+(34+(b+1.6)/19*314)*sc;
 hs.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,bubbles:true,clientX:X(12)}));
 hs.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,bubbles:true,clientX:X(0.2)}));
 out.push('after:'+roll.querySelector('[data-role="rlabel"]').textContent);
 hs.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,bubbles:true}));
 hs.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
 out.push('key:'+roll.querySelector('[data-role="rlabel"]').textContent);
 go(S.findIndex(q=>q.id==='01-free-play'));
 document.querySelector('[data-role="menu"]').click(); out.push('menu->'+S[i].id);
 document.querySelector('[data-role="ap-light"]').click(); out.push('tone:'+tone);
 go(S.findIndex(q=>q.id==='13a-range-boundaries')); document.querySelector('[data-role="mslide"]').click(); out.push('mode->'+S[i].id);
 go(S.findIndex(q=>q.id==='11-range-drag-start')); out.push('alts:'+S[i].alts.map(a=>a.label).join('|'));
 // rev 3.3 editor
 go(S.findIndex(q=>q.id==='17-editor-entry')); document.querySelector('[data-role="edit-entry"]').click(); out.push('entry->'+S[i].id);
 document.querySelector('[data-role="tool-draw"]').click(); out.push('draw->'+S[i].id);
 document.querySelector('[data-role="tool-erase"]').click(); out.push('erase->'+S[i].id);
 document.querySelector('[data-role="tool-select"]').click(); out.push('select->'+S[i].id);
 {const n=document.querySelector('#scr [data-note][data-sel]')||document.querySelector('[data-note][data-sel]'); const t0=parseFloat(n.style.top), l0=parseFloat(n.style.left);
  const r=n.getBoundingClientRect(); n.dispatchEvent(new PointerEvent('pointerdown',{pointerId:2,bubbles:true,clientX:r.left+4,clientY:r.top+4}));
  const scr=n.closest('[data-role="grid"]')?n.closest('[data-role="grid"]').parentNode:n.parentNode;
  n.parentNode.dispatchEvent(new PointerEvent('pointermove',{pointerId:2,bubbles:true,clientX:r.left+60,clientY:r.top-40}));
  n.parentNode.dispatchEvent(new PointerEvent('pointerup',{pointerId:2,bubbles:true}));
  out.push('move:'+(parseFloat(n.style.left)!==l0||parseFloat(n.style.top)!==t0?'moved':'static'));}
 document.querySelector('[data-role="ctx-velocity"]').click(); out.push('vel->'+S[i].id);
 {const pill=document.querySelector('[data-role="vscale"]'); const r=pill.getBoundingClientRect(); pill.dispatchEvent(new PointerEvent('pointerdown',{pointerId:3,bubbles:true,clientX:r.left+5,clientY:r.top+5}));
  pill.dispatchEvent(new PointerEvent('pointermove',{pointerId:3,bubbles:true,clientX:r.left+5,clientY:r.top-60})); pill.dispatchEvent(new PointerEvent('pointerup',{pointerId:3,bubbles:true}));
  out.push('vread:'+document.querySelector('[data-role="vread"]').textContent);}
 go(S.findIndex(q=>q.id==='25-editor-quantise'));
 {const tr=document.querySelector('[data-role="qstr"]'); const r=tr.getBoundingClientRect(); const q=document.querySelector('[data-q0]'); 
  tr.dispatchEvent(new PointerEvent('pointerdown',{pointerId:4,bubbles:true,clientX:r.right,clientY:r.top})); tr.dispatchEvent(new PointerEvent('pointerup',{pointerId:4,bubbles:true}));
  out.push('qstr:'+document.querySelector('[data-role="qval"]').textContent+' note@grid:'+(Math.abs(parseFloat(q.style.left)-parseFloat(q.dataset.qg))<0.5));}
 document.querySelector('[data-role="q-cancel"]').click(); out.push('cancel->'+S[i].id);
 go(S.findIndex(q=>q.id==='18-editor-select')); out.push('edalts:'+S[i].alts.map(a=>a.label).join('|'));
 document.body.setAttribute('data-test',out.join(' ; '));
},500);
