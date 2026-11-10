export function createSourceUI({container,getSound,changeSound,getGesture}){
 const life=new AbortController(),wrap=document.createElement('div');wrap.className='source-profile-control';
 wrap.innerHTML='<button type="button" id="source-profile-toggle" aria-haspopup="true" aria-expanded="false" aria-controls="source-profile-options"></button><div id="source-profile-options" class="source-profile-options" role="group" aria-label="Oscillator source profile" hidden><button type="button" data-source-profile="studio">Studio</button><button type="button" data-source-profile="legacy">Legacy</button></div>';
 container.prepend(wrap);const button=wrap.querySelector('#source-profile-toggle'),panel=wrap.querySelector('#source-profile-options');
 function close(){panel.hidden=true;button.setAttribute('aria-expanded','false');}
 button.addEventListener('click',()=>{if(getGesture())return;const open=panel.hidden;panel.hidden=!open;button.setAttribute('aria-expanded',String(open));},{signal:life.signal});
 for(const option of panel.children)option.addEventListener('click',()=>{if(getGesture())return;changeSound({oscillator:option.dataset.sourceProfile},true);close();button.focus();},{signal:life.signal});
 document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))close();},{signal:life.signal});
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){close();button.focus();e.preventDefault();e.stopPropagation();}},{signal:life.signal});
 function update(){const s=getSound();button.textContent='Quality \u00b7 '+(s.oscillator==='studio'?'Studio':'Legacy')+' \u2304';button.setAttribute('aria-label','Oscillator source quality, '+s.oscillator);button.title='Shared oscillator quality. Studio reduces aliasing; the selected waveform stays the same.';for(const option of panel.children)option.setAttribute('aria-pressed',String(option.dataset.sourceProfile===s.oscillator));}
 return{update,close,destroy:()=>life.abort()};
}
