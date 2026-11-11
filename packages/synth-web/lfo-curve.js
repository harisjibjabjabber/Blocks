import {bindDoubleTap} from './tap-gesture.js';
import {shapeForWave,quantizeLfoX,MAX_LFO_POINTS} from './modulation-state.js';
export const POINT_GAP=1/1024;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function curveValue(points,x){
  if(x<=0)return points[0].y;if(x>=1)return points.at(-1).y;
  const i=points.findIndex((p,n)=>n<points.length-1&&x>=p.x&&x<=points[n+1].x),a=points[Math.max(0,i)],b=points[Math.max(0,i)+1],t=clamp((x-a.x)/(b.x-a.x),0,1);
  return a.y+(b.y-a.y)*(t+a.bend*t*(1-t));
}
export function moveCurvePoint(points,index,x,y){const next=points.map(p=>({...p}));next[index].x=index===0?0:index===next.length-1?1:clamp(quantizeLfoX(x),next[index-1].x+POINT_GAP,next[index+1].x-POINT_GAP);next[index].y=clamp(y,-1,1);return next;}
export function insertCurvePoint(points,x,y){x=quantizeLfoX(x);if(points.length>=MAX_LFO_POINTS||points.some(p=>Math.abs(p.x-x)<POINT_GAP))return null;const next=points.map(p=>({...p}));next.push({x:clamp(x,POINT_GAP,1-POINT_GAP),y:clamp(y,-1,1),bend:0});next.sort((a,b)=>a.x-b.x);return next;}

export function createLfoCurve({container,getSource,changeSource,begin,getGesture,bindCompletion,instance,onSelection=()=>{}}){
  const ns='http://www.w3.org/2000/svg',key=instance+':curve';let selected=null,phase=null,lastWave='';
  container.className='lfo-curve';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 400 140');svg.setAttribute('aria-label','LFO shape. Tap to add, drag points, drag segments to bend.');container.append(svg);
  const helper=document.createElement('div');helper.className='lfo-curve-hint';helper.textContent='Tap to add · drag points · bend segments';container.append(helper);
  const points=()=>{const s=getSource();return(s.waveform==='custom'?s.points:shapeForWave(s.waveform)).map(p=>({...p}));};
  const box=()=>svg.getBoundingClientRect(),coords=e=>{const r=box();return{x:clamp((e.clientX-r.left-12)/(r.width-24),0,1),y:clamp(1-2*(e.clientY-r.top-14)/(r.height-28),-1,1)};};
  const pixel=p=>{const r=box();return{x:12+p.x*(r.width-24),y:14+(1-p.y)*(r.height-28)/2};};
  function select(index){selected=index;onSelection({index,deletable:index!==null&&index>0&&index<points().length-1,count:points().length});}
  function change(next,commit=false){changeSource({waveform:'custom',points:next},commit);}
  function targetAt(e,ps){const r=box(),p={x:e.clientX-r.left,y:e.clientY-r.top};let best=null,distance=Infinity,segment=null,segmentDistance=Infinity;ps.forEach((point,index)=>{const q=pixel(point),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<distance){distance=d;best=index;}if(index<ps.length-1){const x=(point.x+ps[index+1].x)/2,m=pixel({x,y:curveValue(ps,x)}),md=Math.hypot(m.x-p.x,m.y-p.y);if(md<segmentDistance){segment=index;segmentDistance=md;}}});return{point:distance<=22?best:null,segment:segmentDistance<=12&&distance>8?segment:null};}
  svg.addEventListener('pointerdown',e=>{
    if(getGesture())return;e.preventDefault();const ps=points(),position=coords(e),target=targetAt(e,ps),index=target.point,segment=e.target.closest('[data-lfo-segment]');
    const part=target.segment!==null?'segment':index!==null?'point':segment?'segment':'add';
    if(!begin(e,'config',{key,part,index:part==='point'?index:target.segment??Number(segment?.dataset.lfoSegment),curveBefore:ps,fine:e.shiftKey,moved:false,start:position}))return;
    if(part==='point'){select(index);render();}else if(part==='add'){const next=insertCurvePoint(ps,position.x,position.y);if(next){select(next.findIndex(p=>p.x===quantizeLfoX(position.x)));const g=getGesture();g.part='point';g.index=selected;g.curveBefore=next;change(next);}else helper.textContent='32 points maximum · select a point to delete';}
  });
  svg.addEventListener('pointermove',e=>{
    const g=getGesture();if(g?.key!==key||g.pointer!==e.pointerId)return;const r=box(),factor=g.fine?.1:1;g.moved||=Math.hypot(e.clientX-g.x,e.clientY-g.y)>2;
    if(g.part==='point'&&g.index!==null){const p=g.curveBefore[g.index];change(moveCurvePoint(g.curveBefore,g.index,p.x+(e.clientX-g.x)/(r.width-24)*factor,p.y-2*(e.clientY-g.y)/(r.height-28)*factor));}
    else if(g.part==='segment'&&g.moved){const next=g.curveBefore.map(p=>({...p})),delta=next[g.index+1].y-next[g.index].y;next[g.index].bend=clamp(next[g.index].bend+(g.y-e.clientY)/Math.max(30,r.height*.4)*Math.sign(delta||1)*factor,-1,1);change(next);}
  });
  svg.addEventListener('pointerup',e=>{const g=getGesture();if(g?.key===key&&g.pointer===e.pointerId&&g.part==='segment'&&!g.moved){const next=insertCurvePoint(g.curveBefore,g.start.x,curveValue(g.curveBefore,g.start.x));if(next){select(next.findIndex(p=>p.x===quantizeLfoX(g.start.x)));change(next);}}});
  svg.addEventListener('keydown',e=>{
    if(getGesture())return;const point=e.target.closest('[data-lfo-point]'),segment=e.target.closest('[data-lfo-segment]');if(!point&&!segment)return;
    const ps=points(),index=Number(point?.dataset.lfoPoint??segment.dataset.lfoSegment),fine=e.shiftKey?.1:1;
    if(point){select(index);if(['Delete','Backspace'].includes(e.key)){e.preventDefault();removeSelected();return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const p=ps[index];change(moveCurvePoint(ps,index,p.x+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0)*.01*fine,e.key==='Home'?-1:e.key==='End'?1:p.y+(e.key==='ArrowUp'?1:e.key==='ArrowDown'?-1:0)*.02*fine),true);}
    else{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();ps[index].bend=e.key==='Home'?-1:e.key==='End'?1:clamp(ps[index].bend+(e.key==='ArrowUp'?1:-1)*.05*fine,-1,1);change(ps,true);}
    svg.querySelector(point?`[data-lfo-point="${index}"]`:`[data-lfo-segment="${index}"]`)?.focus();
  });
  bindCompletion(svg);bindDoubleTap(svg,index=>{if(getGesture())return;select(index);removeSelected();},{key:e=>targetAt(e,points()).point});
  function removeSelected(){if(getGesture()||selected===null)return;const ps=points();if(selected===0||selected===ps.length-1)return;ps.splice(selected,1);select(null);change(ps,true);}
  function node(tag,attrs){const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);svg.append(e);return e;}
  function render(){
    const s=getSource(),r=box();if(!s||!r.width)return;if(s.waveform!==lastWave){if(!getGesture())selected=null;lastWave=s.waveform;}
    const ps=points();if(selected!==null&&selected>=ps.length)selected=null;
    svg.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);svg.replaceChildren();
    for(const x of[0,.25,.5,.75,1]){const a=pixel({x,y:1}),b=pixel({x,y:-1});node('path',{d:`M${a.x} ${a.y}V${b.y}`,class:'lfo-curve-grid'});}
    for(const y of[-1,0,1]){const p=pixel({x:0,y});node('path',{d:`M12 ${p.y}H${r.width-12}`,class:'lfo-curve-grid'});}
    for(let i=0;i<ps.length-1;i++){
      const a=ps[i],b=ps[i+1],d=Array.from({length:25},(_,n)=>{const x=a.x+(b.x-a.x)*n/24,p=pixel({x,y:curveValue(ps,x)});return(n?'L':'M')+p.x+','+p.y;}).join(' ');
      node('path',{d,class:'lfo-curve-line'});node('path',{d,class:'lfo-segment-hit','data-lfo-segment':i,role:'slider',tabindex:0,'aria-label':'Segment '+(i+1)+' bend','aria-valuemin':-1,'aria-valuemax':1,'aria-valuenow':a.bend});
    }
    if(ps[0].y!==ps.at(-1).y){const end=pixel(ps.at(-1)),start=pixel({x:1,y:ps[0].y});node('path',{d:`M${end.x} ${end.y}V${start.y}`,class:'lfo-wrap-line'});}
    ps.forEach((p,index)=>{const q=pixel(p);node('circle',{cx:q.x,cy:q.y,r:index===selected?5:3,class:'lfo-point-dot','data-selected':String(index===selected)});node('circle',{cx:clamp(q.x,22,r.width-22),cy:clamp(q.y,22,r.height-22),r:22,class:'lfo-point-hit','data-lfo-point':index,role:'slider',tabindex:0,'aria-label':'Point '+(index+1)+(index===0?' start':index===ps.length-1?' end':''),'aria-valuemin':-1,'aria-valuemax':1,'aria-valuenow':p.y,'aria-valuetext':Math.round(p.x*100)+'% phase, '+Math.round(p.y*100)+'% level'});});
    node('line',{'data-lfo-cursor':'true',class:'lfo-phase-cursor',y1:14,y2:r.height-14});setPhase(phase);
    helper.textContent=s.waveform==='random'?'Random template · edit creates Custom':ps.length>=MAX_LFO_POINTS?'32 points · select an interior point to delete':'Tap to add · drag points · bend segments';
    svg.setAttribute('aria-label',s.waveform==='random'?'Random template, not live random output. Cursor shows engine phase. Editing points or segments creates Custom.':'LFO shape. Tap to add, drag points, drag segments to bend.');select(selected);
  }
  function setPhase(value){phase=value;const cursor=svg.querySelector('[data-lfo-cursor]');if(!cursor)return;const valid=getSource()?.enabled&&Number.isFinite(value)&&value>=0&&value<1;cursor.style.display=valid?'':'none';if(valid){const x=pixel({x:value,y:0}).x;cursor.setAttribute('x1',x);cursor.setAttribute('x2',x);}}
  const observer=new ResizeObserver(render);observer.observe(container);
  return{update:render,setPhase,removeSelected,destroy:()=>observer.disconnect()};
}
