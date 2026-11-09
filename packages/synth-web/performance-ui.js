// Performance controls display settings; the audio scheduler owns all timing.
export function createPerformanceUI({container, getPerformance, change, begin, getGesture, bindCompletion}) {
  container.className='performance-panel';
  container.innerHTML=`
    <div class="performance-modes" role="group" aria-label="Performance mode">
      <button type="button" data-performance-mode="off">Off</button><button type="button" data-performance-mode="arp">Arp</button><button type="button" data-performance-mode="strum">Strum</button>
    </div>
    <div class="performance-row performance-rhythm">
      <div class="performance-tempo" role="group" aria-label="Tempo"><button type="button" id="performance-bpm-down" aria-label="Decrease performance tempo">−</button><output id="performance-bpm" aria-label="Tempo"></output><button type="button" id="performance-bpm-up" aria-label="Increase performance tempo">+</button></div>
      <label class="performance-select"><span>Division</span><select id="performance-division" aria-label="Arpeggiator division"><option>1/4</option><option>1/8</option><option>1/16</option><option>1/8T</option><option>1/16T</option></select></label>
    </div>
    <div class="performance-row">
      <label class="performance-select"><span>Order</span><select id="performance-order" aria-label="Note order"><option value="up">Up</option><option value="down">Down</option><option value="played">Played</option><option value="random">Random</option></select></label>
      <label class="performance-range performance-curl"><span>Curl <output data-performance-value="curl"></output></span><input type="range" data-performance="curl" min="-80" max="80" step="1" aria-label="Arpeggiator curl"></label>
      <label class="performance-range performance-spread" hidden><span>Spread <output data-performance-value="strum"></output></span><input type="range" data-performance="strum" min="0" max="100" step="1" aria-label="Strum spread"></label>
    </div>
    <label class="performance-range performance-humanize" hidden><span>Humanize <output data-performance-value="humanize"></output></span><input type="range" data-performance="humanize" min="0" max="100" step="1" aria-label="Strum humanize"></label>
    <div class="performance-preview"><span id="performance-preview-label">Timing preview</span><svg id="performance-preview" viewBox="0 0 300 20" preserveAspectRatio="none" aria-label="Timing settings preview"></svg></div>
    <details class="performance-advanced"><summary>Gate <output data-performance-value="gate"></output></summary><label class="performance-range"><span>Note length</span><input type="range" data-performance="gate" min="10" max="95" step="1" aria-label="Arpeggiator gate"></label></details>
    <p class="performance-hint"><span id="performance-context">4 beats</span><span id="performance-status" role="status"></span></p>`;
  const $=selector=>container.querySelector(selector);
  const scale=key=>key==='strum'?1:100;
  for(const button of container.querySelectorAll('[data-performance-mode]'))button.addEventListener('click',()=>change({mode:button.dataset.performanceMode}));
  $('#performance-bpm-down').addEventListener('click',()=>change({bpm:getPerformance().bpm-1}));
  $('#performance-bpm-up').addEventListener('click',()=>change({bpm:getPerformance().bpm+1}));
  for(const key of ['division','order'])$('#performance-'+key).addEventListener('change',e=>change({[key]:e.target.value}));
  for(const input of container.querySelectorAll('[data-performance]')) {
    const key=input.dataset.performance;
    input.addEventListener('pointerdown',e=>{if(!begin(e,'performance',{key}))e.preventDefault();});
    input.addEventListener('input',()=>{const active=getGesture();if(active&&(active.type!=='performance'||active.key!==key))return;change({[key]:Number(input.value)/scale(key)},!active);});
    bindCompletion(input);
  }
  function update(previewOffsets) {
    const p=getPerformance(),strum=p.mode==='strum';
    for(const button of container.querySelectorAll('[data-performance-mode]'))button.setAttribute('aria-pressed',String(button.dataset.performanceMode===p.mode));
    $('#performance-bpm').textContent=Math.round(p.bpm)+' BPM';
    $('#performance-bpm-down').disabled=p.bpm<=40;$('#performance-bpm-up').disabled=p.bpm>=240;
    $('#performance-division').value=p.division;$('#performance-order').value=p.order;
    $('.performance-rhythm').hidden=strum;$('.performance-curl').hidden=strum;$('.performance-spread').hidden=!strum;$('.performance-humanize').hidden=!strum;$('.performance-advanced').hidden=strum;
    for(const input of container.querySelectorAll('[data-performance]'))input.value=Math.round(p[input.dataset.performance]*scale(input.dataset.performance));
    for(const output of container.querySelectorAll('[data-performance-value]')){const key=output.dataset.performanceValue;output.textContent=key==='strum'?Math.round(p.strum)+' ms':(key==='curl'&&p.curl>0?'+':'')+Math.round(p[key]*100)+'%';}
    $('#performance-context').textContent=strum?'Spread across held notes':'4 beats';
    // Offsets are supplied by the scheduler's shared pure timing helper.
    const svg=$('#performance-preview');svg.replaceChildren();
    if(previewOffsets){for(const phase of previewOffsets){const dot=document.createElementNS('http://www.w3.org/2000/svg','ellipse');dot.setAttribute('cx',String(4+Math.max(0,Math.min(1,phase))*292));dot.setAttribute('cy','10');dot.setAttribute('rx',String(2.5*300/(svg.clientWidth||300)));dot.setAttribute('ry','2.5');svg.append(dot);}}
    $('#performance-preview-label').textContent=strum?'Illustrative strum':'Timing preview';
  }
  const setPending=pending=>{$('#performance-status').textContent=pending?' · Changes next bar':'';};
  return {update,setPending};
}
