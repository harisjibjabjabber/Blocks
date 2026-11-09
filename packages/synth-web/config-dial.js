// A configuration dial uses the instrument's shared gesture/Undo transaction.
export function configDial({key,label,min=0,max=1,getValue,change,begin,getGesture,bindCompletion,format=value=>String(value),toUnit=value=>(value-min)/(max-min),fromUnit=unit=>min+unit*(max-min),compact=false}) {
  const wrap=document.createElement('div');wrap.className='config-control'+(compact?' config-control-inline':'');
  const button=document.createElement('button');button.type='button';button.className='config-dial';button.dataset.control=key;button.setAttribute('role','slider');button.setAttribute('aria-label',label);button.setAttribute('aria-valuemin',min);button.setAttribute('aria-valuemax',max);
  const face=document.createElement('span');face.className='config-dial-face';face.setAttribute('aria-hidden','true');const needle=document.createElement('span');needle.className='config-dial-needle';face.append(needle);button.append(face);
  const title=document.createElement('span');title.className='config-dial-label';title.textContent=label;const value=document.createElement('output');value.className='config-dial-value';
  const bounded=n=>Math.max(0,Math.min(1,n));
  button.addEventListener('pointerdown',e=>{e.preventDefault();begin(e,'config',{key,base:toUnit(getValue()),fine:e.shiftKey});});
  button.addEventListener('pointermove',e=>{const g=getGesture();if(g?.type!=='config'||g.pointer!==e.pointerId||g.key!==key)return;change(fromUnit(bounded(g.base+(g.y-e.clientY)/180*(g.fine?.1:1))),false);});
  button.addEventListener('keydown',e=>{if(getGesture()||!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const direction=['ArrowUp','ArrowRight'].includes(e.key)?1:-1,n=e.key==='Home'?0:e.key==='End'?1:toUnit(getValue())+direction*(e.shiftKey?.001:.01);change(fromUnit(bounded(n)),true);});
  bindCompletion(button);if(compact){button.append(value);wrap.append(button);}else wrap.append(button,title,value);
  function update(){const v=getValue(),text=format(v),n=bounded(toUnit(v));button.value=String(v);button.style.setProperty('--rotation',(-135+n*270)+'deg');button.setAttribute('aria-valuenow',v);button.setAttribute('aria-valuetext',text);value.textContent=text;}
  return{element:wrap,button,update};
}
