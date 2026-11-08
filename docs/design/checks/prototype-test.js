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
 document.body.setAttribute('data-test',out.join(' ; '));
},500);
