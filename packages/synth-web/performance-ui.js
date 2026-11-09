// Settings previews only; audio timing belongs to the scheduler.
export function createPerformanceUI({container,getPerformance,change,begin,getGesture,bindCompletion,instance="main"}) {
  container.className='performance-panel';
  container.innerHTML=`<div class="performance-row performance-rhythm">
    <div class="performance-tempo" role="group" aria-label="Tempo"><button type="button" id="performance-bpm-down" aria-label="Decrease performance tempo">−</button><output id="performance-bpm" aria-label="Tempo"></output><button type="button" id="performance-bpm-up" aria-label="Increase performance tempo">+</button></div>
    <label class="performance-select"><span>Division</span><select id="performance-division" aria-label="Arpeggiator division"><option>1/4</option><option>1/8</option><option>1/16</option><option>1/32</option><option>1/64</option><option>1/8T</option><option>1/16T</option></select></label></div>
    <div class="performance-mini-controls"><label class="performance-select"><span>Order</span><select id="performance-order" aria-label="Note order"><option value="up">Up</option><option value="down">Down</option><option value="played">Played</option><option value="random">Random</option></select></label></div>
    <div class="performance-preview"><span id="performance-preview-label">Timing preview</span><svg id="performance-preview" viewBox="0 0 300 20" preserveAspectRatio="none" aria-label="Timing settings preview"></svg></div>
    <p class="performance-hint"><span id="performance-context">4 beats</span><span id="performance-status" role="status"></span></p>`;
  for(const el of container.querySelectorAll('[id]')){el.dataset.performanceRef=el.id;el.id=instance+'-'+el.id;}
  const $=selector=>container.querySelector(selector.startsWith('#')?'[data-performance-ref="'+selector.slice(1)+'"]':selector);
  const limits={curl:[-.8,.8,100],gate:[.1,.95,100],strum:[0,100,1],humanize:[0,1,100]};
  const names={curl:'Curl',gate:'Gate',strum:'Spread',humanize:'Humanize'};
  const label=key=>({curl:'Arpeggiator curl',gate:'Arpeggiator gate',strum:'Strum spread',humanize:'Strum humanize'})[key];
  const format=(key,value)=>key==='strum'?Number(value.toFixed(1))+' ms':(key==='curl'&&value>0?'+':'')+Number((value*100).toFixed(1))+'%';
  for(const key of Object.keys(limits)) {
    const [min,max,scale]=limits[key],wrap=document.createElement('div');wrap.className='performance-control performance-'+key;
    const button=document.createElement('button');button.type='button';button.className='performance-dial';button.dataset.performance=key;button.setAttribute('role','slider');button.setAttribute('aria-label',label(key));button.setAttribute('aria-valuemin',min*scale);button.setAttribute('aria-valuemax',max*scale);
    const face=document.createElement('span');face.className='performance-dial-face';face.setAttribute('aria-hidden','true');const needle=document.createElement('span');needle.className='performance-dial-needle';face.append(needle);button.append(face);
    const title=document.createElement('span');title.className='performance-dial-label';title.textContent=names[key];const value=document.createElement('output');value.dataset.performanceValue=key;
    button.addEventListener('pointerdown',e=>{e.preventDefault();begin(e,'performance',{key:instance+':'+key,base:getPerformance()[key],fine:e.shiftKey});});
    button.addEventListener('pointermove',e=>{const g=getGesture();if(g?.type!=='performance'||g.pointer!==e.pointerId||g.key!==instance+':'+key)return;change({[key]:Math.max(min,Math.min(max,g.base+(g.y-e.clientY)/180*(max-min)*(g.fine?.1:1)))},false);});
    button.addEventListener('keydown',e=>{if(getGesture()||!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const step=(e.shiftKey?.1:1)/scale,current=getPerformance()[key],next=e.key==='Home'?min:e.key==='End'?max:current+(['ArrowUp','ArrowRight'].includes(e.key)?step:-step);change({[key]:Math.max(min,Math.min(max,next))});});
    bindCompletion(button);wrap.append(button,title,value);$('.performance-mini-controls').append(wrap);
  }
  $('#performance-bpm-down').addEventListener('click',()=>change({bpm:getPerformance().bpm-1}));$('#performance-bpm-up').addEventListener('click',()=>change({bpm:getPerformance().bpm+1}));
  for(const key of ['division','order'])$('#performance-'+key).addEventListener('change',e=>change({[key]:e.target.value}));
  let viewMode='arp',pending=false;
  const pendingText=()=>{$('#performance-status').textContent=pending&&getPerformance().mode===viewMode?' · Changes next bar':'';};
  function update(previewOffsets,selectedView='arp') {
    viewMode=selectedView;const p=getPerformance(),strum=viewMode==='strum';pendingText();
    $('#performance-bpm').textContent=Math.round(p.bpm)+' BPM';$('#performance-bpm-down').disabled=p.bpm<=40;$('#performance-bpm-up').disabled=p.bpm>=240;$('#performance-division').value=p.division;$('#performance-order').value=p.order;
    $('.performance-rhythm').hidden=strum;$('.performance-curl').hidden=strum;$('.performance-gate').hidden=strum;$('.performance-strum').hidden=!strum;$('.performance-humanize').hidden=!strum;
    for(const[key,[min,max,scale]]of Object.entries(limits)){const button=$(`[data-performance="${key}"]`),value=p[key],text=format(key,value);button.value=String(Number((value*scale).toFixed(2)));button.setAttribute('aria-valuenow',button.value);button.setAttribute('aria-valuetext',text);button.style.setProperty('--rotation',(-135+(value-min)/(max-min)*270)+'deg');$(`[data-performance-value="${key}"]`).textContent=text;}
    $('#performance-context').textContent=strum?'Spread across held notes':'4 beats';
    const svg=$('#performance-preview');svg.replaceChildren();
    if(previewOffsets){const width=svg.clientWidth||300,radius=Math.min(2.5,Math.max(.7,width/Math.max(1,previewOffsets.length)*.32));for(const phase of previewOffsets){const dot=document.createElementNS('http://www.w3.org/2000/svg','ellipse');dot.setAttribute('cx',4+Math.max(0,Math.min(1,phase))*292);dot.setAttribute('cy','10');dot.setAttribute('rx',radius*300/width);dot.setAttribute('ry',radius);svg.append(dot);}}
    $('#performance-preview-label').textContent=strum?'Illustrative strum':'Timing preview';
  }
  return{update,setPending:value=>{pending=Boolean(value);pendingText();}};
}
