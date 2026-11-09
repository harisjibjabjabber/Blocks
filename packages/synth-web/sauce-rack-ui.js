// Rack controls only select editors and dispatch explicit state changes.
export function createSauceRack({container,onOpen,onToggle,onSwap}) {
  container.className='sauce-rack';
  const cards=new Map();
  function card(id,name) {
    const block=document.createElement('div');block.className='sauce-block';block.dataset.sauceBlock=id;
    const open=document.createElement('button');open.type='button';open.className='sauce-block-open';open.dataset.sauceOpen=id;open.textContent=name;open.setAttribute('aria-label','Edit '+name);open.setAttribute('aria-controls','sound-editor');open.setAttribute('aria-expanded','false');open.addEventListener('click',()=>onOpen(id));
    const power=document.createElement('button');power.type='button';power.className='sauce-block-power';power.dataset.saucePower=id;power.setAttribute('role','switch');power.setAttribute('aria-label',name+' enabled');power.addEventListener('click',()=>onToggle(id));
    block.append(open,power);cards.set(id,{block,open,power});return block;
  }
  const notes=document.createElement('section');notes.className='sauce-lane';notes.setAttribute('aria-label','Note processing');
  const notesHeading=document.createElement('h3');notesHeading.textContent='Notes';
  const noteCards=document.createElement('div');noteCards.className='sauce-note-cards';noteCards.append(card('arp','Arp'),card('strum','Strum'),card('drop','Pitch Drop'));notes.append(notesHeading,noteCards);
  const audio=document.createElement('section');audio.className='sauce-lane';audio.setAttribute('aria-label','Audio signal flow');
  const audioHeading=document.createElement('h3');audioHeading.textContent='Audio';const flow=document.createElement('span');flow.id='sauce-audio-flow';audioHeading.append(flow);
  const audioCards=document.createElement('div');audioCards.className='sauce-audio-cards';
  const swap=document.createElement('button');swap.type='button';swap.id='sauce-audio-swap';swap.textContent='⇄';swap.setAttribute('aria-label','Swap Drive and Fullness signal order');swap.title='Swap audio order';swap.addEventListener('click',onSwap);
  const drive=card('drive','Drive'),fullness=card('fullness','Fullness');audioCards.append(drive,swap,fullness);audio.append(audioHeading,audioCards);container.append(notes,audio);
  let currentOrder=null;
  function update({selected,enabled,audioOrder,supported=true}) {
    for(const[id,{block,open,power}]of cards){block.dataset.selected=String(selected===id);open.setAttribute('aria-expanded',String(selected===id));power.setAttribute('aria-checked',String(Boolean(enabled[id])));power.textContent=enabled[id]?'On':'Off';power.disabled=!supported&&['drive','drop','fullness'].includes(id);}
    if(currentOrder!==audioOrder){currentOrder=audioOrder;if(audioOrder===1)audioCards.replaceChildren(fullness,swap,drive);else audioCards.replaceChildren(drive,swap,fullness);}
    swap.disabled=!supported;flow.textContent=audioOrder===1?'Fullness → Drive':'Drive → Fullness';
  }
  return{update};
}
