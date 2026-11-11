export const MOD_TARGETS=Object.freeze([0,2,3,11,13,14,18,21,22,23,24,42]);
export const LFO_WAVES=Object.freeze(['sine','triangle','saw','square','random','custom']);
export const MOD_DIVISIONS=Object.freeze({'1/1':[1,0],'1/2':[2,0],'1/4':[4,0],'1/8':[8,0],'1/16':[16,0],'1/32':[32,0],'1/64':[64,0],'1/4T':[4,1],'1/8T':[8,1],'1/16T':[16,1]});
export const MAX_LFO_POINTS=32,MIN_LFO_GAP=1/1024;
export const quantizeLfoX=x=>Math.round(Math.max(0,Math.min(1,x))*1024)/1024;
export function shapeForWave(waveform='sine'){
 const point=(x,y,bend=0)=>({x:Math.fround(x),y:Math.fround(y),bend:Math.fround(bend)});
 if(waveform==='triangle')return[point(0,-1),point(.5,1),point(1,-1)];
 if(waveform==='saw')return[point(0,-1),point(1,1)];
 if(waveform==='square')return[point(0,1),point(.5-MIN_LFO_GAP,1),point(.5,-1),point(1,-1)];
 if(waveform==='random')return[0,.25,.5,.75,1].map((x,i)=>point(x,[.4,-.7,.8,-.4,.4][i]));
 return[0,Math.SQRT1_2,1,Math.SQRT1_2,0,-Math.SQRT1_2,-1,-Math.SQRT1_2,0].map((y,i)=>point(i/8,y));
}
export function normalizeLfoPoints(input){
 if(!Array.isArray(input)||input.length<2||input.length>MAX_LFO_POINTS)throw Error('LFO shape needs 2–32 points');
 const points=input.map(p=>{if(!p||![p.x,p.y,p.bend].every(Number.isFinite)||p.x<0||p.x>1||p.y< -1||p.y>1||p.bend< -1||p.bend>1)throw Error('Invalid LFO shape point');return{x:Math.fround(p.x),y:Math.fround(p.y),bend:Math.fround(p.bend)};});
 if(points[0].x!==0||points.at(-1).x!==1||points.some((p,i)=>i&&p.x-points[i-1].x<MIN_LFO_GAP))throw Error('LFO shape times must be ordered with fixed endpoints');
 return points;
}
export function sampleLfoPoints(points,phase){
 if(phase<=0)return points[0].y;if(phase>=1)return points.at(-1).y;
 let lo=0,hi=points.length-1;while(hi-lo>1){const middle=(lo+hi)>>1;if(phase<points[middle].x)hi=middle;else lo=middle;}
 const a=points[lo],b=points[hi],t=(phase-a.x)/(b.x-a.x),q=t+a.bend*t*(1-t);return a.y+(b.y-a.y)*q;
}
export function defaultLfo(id=1){return{id,enabled:false,waveform:'sine',rate:1,synced:true,division:'1/4',intensity:1,retrigger:false,points:shapeForWave(),routes:[{parameter:11,depth:0},{parameter:0,depth:0}]};}
export const DEFAULT_MODULATION=Object.freeze({version:3,sources:[defaultLfo()]});
const bounded=(x,min,max)=>{if(!Number.isFinite(x))throw Error('Invalid modulation value');return Math.max(min,Math.min(max,x));};
export function normalizeModulation(input=DEFAULT_MODULATION){
 if(!input||input.version!==3||!Array.isArray(input.sources)||input.sources.length<1||input.sources.length>4)throw Error('Invalid modulation configuration');
 const ids=new Set();const sources=input.sources.map(s=>{
  if(!s||!Number.isInteger(s.id)||s.id<1||s.id>0x7fffffff||ids.has(s.id)||typeof s.enabled!=='boolean'||typeof s.synced!=='boolean'||!LFO_WAVES.includes(s.waveform)||!Object.hasOwn(MOD_DIVISIONS,s.division)||!Array.isArray(s.routes)||s.routes.length>8||typeof s.retrigger!=='boolean')throw Error('Invalid LFO source');ids.add(s.id);
  const targets=new Set();const routes=s.routes.map(r=>{
   if(!r)throw Error('Invalid LFO destination');const kind=r.kind??'tone',targetId=r.targetId??0;
   if(!['tone','sauce','lfo','effects'].includes(kind)||!Number.isInteger(targetId)||targetId<0||targetId>0x7fffffff||!Number.isInteger(r.parameter)||(kind==='tone'?(targetId!==0||!MOD_TARGETS.includes(r.parameter)):(targetId<1||((kind==='sauce'||kind==='effects')?r.parameter!==0:![0,1].includes(r.parameter)))))throw Error('Invalid LFO destination');
   const key=routeTargetKey({kind,targetId,parameter:r.parameter});if(targets.has(key))throw Error('Duplicate LFO destination');targets.add(key);
   return{kind,targetId,parameter:r.parameter,depth:bounded(r.depth,-1,1)};
  });
  return{id:s.id,enabled:s.enabled,waveform:s.waveform,rate:bounded(s.rate,.05,20),synced:s.synced,division:s.division,intensity:bounded(s.intensity,0,1),retrigger:s.retrigger,points:normalizeLfoPoints(s.points),routes};
 });if(!ids.has(1))throw Error('Main LFO source is required');return{version:3,sources};
}
export function toCoreModulation(input){const s=normalizeModulation(input);return{version:3,sources:s.sources.map(l=>({id:l.id,enabled:Number(l.enabled),waveform:LFO_WAVES.indexOf(l.waveform),synced:Number(l.synced),division:MOD_DIVISIONS[l.division][0],triplet:MOD_DIVISIONS[l.division][1],rate_hz:l.rate,intensity:l.intensity,retrigger:Number(l.retrigger),points:l.points.map(p=>({...p})),routes:l.routes.map(r=>({target_kind:['tone','sauce','lfo','effects'].indexOf(r.kind),target_id:r.targetId,parameter_id:r.parameter,depth:r.depth}))}))};}

// A random editing pattern is stored as Custom, so playback/Undo/export are repeatable.
export function randomLfoPoints(count=30,random=()=>{const word=new Uint32Array(1);globalThis.crypto.getRandomValues(word);return word[0]/4294967296;}){
 if(!Number.isInteger(count)||count<2||count>MAX_LFO_POINTS)throw Error('Invalid random LFO point count');
 const points=Array.from({length:count},(_,i)=>({x:Math.fround(i/(count-1)),y:Math.fround(random()*2-1),bend:0}));
 points.at(-1).y=points[0].y;return normalizeLfoPoints(points);
}

export const routeTargetKey=r=>`${r.kind??'tone'}:${r.targetId??0}:${r.parameter}`;
export const defaultRouteDepth=()=>0;
export function modulationDestinations(parameters,rack,modulation){
 const destinations=MOD_TARGETS.map(parameter=>({kind:'tone',targetId:0,parameter,label:'Tone · '+(parameter===0?'Sound level':parameters[parameter]?.name??'Parameter '+parameter)}));
 const counts={};for(const block of rack.audio){const number=counts[block.type]=(counts[block.type]??0)+1;destinations.push({kind:'sauce',targetId:block.id,parameter:0,label:'Fullness'+' '+number+' · '+'Amount'});}
 for(const block of rack.effects??[])if(block.type==='moving-space'){const number=counts['moving-space']=(counts['moving-space']??0)+1;destinations.push({kind:'effects',targetId:block.id,parameter:0,label:'Moving Space '+number+' � Move'});}
 for(const source of modulation.sources)for(const[parameter,label]of[[0,'Rate'],[1,'Intensity']])destinations.push({kind:'lfo',targetId:source.id,parameter,label:'LFO '+source.id+' · '+label});
 return destinations.map(r=>({...r,key:routeTargetKey(r)}));
}

// Called inside the rack edit transaction. Undo restores both the target and its
// saved routes; source power, other destinations, timing and shapes are untouched.
export function pruneEffectRoutes(input,rack){const modulation=normalizeModulation(input),targets=new Set((rack.effects??[]).filter(b=>b.type==='moving-space').map(b=>b.id));for(const s of modulation.sources)s.routes=s.routes.filter(r=>r.kind!=='effects'||targets.has(r.targetId));return modulation;}
