import {ROUTE_KINDS,TONE_MOD_TARGETS,isKnownModulationTarget,buildModulationTargets} from './modulation-targets.js';
export {ROUTE_KINDS} from './modulation-targets.js';
export const MOD_TARGETS=TONE_MOD_TARGETS;
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
export function defaultLfo(id=1){return{id,enabled:false,waveform:'sine',rate:1,synced:true,division:'1/4',intensity:1,retrigger:false,points:shapeForWave(),routes:id===1?[{parameter:11,depth:0},{parameter:0,depth:0}]:[]};}
export const DEFAULT_MODULATION=Object.freeze({version:4,sources:[1,2,3,4].map(defaultLfo)});
const bounded=(x,min,max)=>{if(!Number.isFinite(x))throw Error('Invalid modulation value');return Math.max(min,Math.min(max,x));};
export const MOD_ROUTE_LIMIT=32;
export function normalizeModulationRoutes(input,defaultPolarity='bipolar'){if(!Array.isArray(input)||input.length>MOD_ROUTE_LIMIT)throw Error('Invalid modulation routes');
 const targets=new Set();return input.map(r=>{
   if(!r)throw Error('Invalid LFO destination');const polarity=r.polarity??defaultPolarity;if(!['unipolar','bipolar'].includes(polarity))throw Error('Invalid route polarity');const kind=r.kind??'tone',targetId=r.targetId??0;
   if(!isKnownModulationTarget(kind,targetId,r.parameter))throw Error('Invalid LFO destination');
   const key=routeTargetKey({kind,targetId,parameter:r.parameter});if(targets.has(key))throw Error('Duplicate LFO destination');targets.add(key);
   return{kind,targetId,parameter:r.parameter,depth:bounded(r.depth,-1,1),polarity};
  });
}
export function normalizeModulation(input=DEFAULT_MODULATION){
 if(!input||input.version!==4||!Array.isArray(input.sources)||input.sources.length!==4)throw Error('Invalid modulation configuration');
 const ids=new Set();const sources=input.sources.map(s=>{
  if(!s||!Number.isInteger(s.id)||s.id<1||s.id>0x7fffffff||ids.has(s.id)||typeof s.enabled!=='boolean'||typeof s.synced!=='boolean'||!LFO_WAVES.includes(s.waveform)||!Object.hasOwn(MOD_DIVISIONS,s.division)||!Array.isArray(s.routes)||s.routes.length>MOD_ROUTE_LIMIT||typeof s.retrigger!=='boolean')throw Error('Invalid LFO source');ids.add(s.id);
  const routes=normalizeModulationRoutes(s.routes);
  return{id:s.id,enabled:s.enabled,waveform:s.waveform,rate:bounded(s.rate,.05,20),synced:s.synced,division:s.division,intensity:bounded(s.intensity,0,1),retrigger:s.retrigger,points:normalizeLfoPoints(s.points),routes};
 });if(![1,2,3,4].every(id=>ids.has(id)))throw Error('Four persistent LFO IDs are required');sources.sort((a,b)=>a.id-b.id);return{version:4,sources};
}
export function toCoreModulation(input){const s=normalizeModulation(input);return{version:4,sources:s.sources.map(l=>({id:l.id,enabled:Number(l.enabled),waveform:LFO_WAVES.indexOf(l.waveform),synced:Number(l.synced),division:MOD_DIVISIONS[l.division][0],triplet:MOD_DIVISIONS[l.division][1],rate_hz:l.rate,intensity:l.intensity,retrigger:Number(l.retrigger),points:l.points.map(p=>({...p})),routes:l.routes.map(r=>({target_kind:ROUTE_KINDS.indexOf(r.kind),target_id:r.targetId,parameter_id:r.parameter,depth:r.depth,polarity:r.polarity==='unipolar'?1:2}))}))};}

// A random editing pattern is stored as Custom, so playback/Undo/export are repeatable.
export function randomLfoPoints(count=30,random=()=>{const word=new Uint32Array(1);globalThis.crypto.getRandomValues(word);return word[0]/4294967296;}){
 if(!Number.isInteger(count)||count<2||count>MAX_LFO_POINTS)throw Error('Invalid random LFO point count');
 const points=Array.from({length:count},(_,i)=>({x:Math.fround(i/(count-1)),y:Math.fround(random()*2-1),bend:0}));
 points.at(-1).y=points[0].y;return normalizeLfoPoints(points);
}

export const routeTargetKey=r=>`${r.kind??'tone'}:${r.targetId??0}:${r.parameter}`;
export const defaultRouteDepth=()=>0;
export function modulationDestinations(parameters,rack,modulation,getTargetInfo=null){return buildModulationTargets(parameters,rack,modulation,getTargetInfo);}

// Called inside the rack edit transaction. Undo restores both the target and its
// saved routes; source power, other destinations, timing and shapes are untouched.
export function pruneRackRoutes(routes,rack){const audio=new Set((rack.audio??[]).map(b=>b.id)),effects=new Map((rack.effects??[]).map(b=>[b.id,b.type]));return routes.filter(r=>r.kind==='tone'&&[15,16,17].includes(r.parameter)?(rack.notes??[]).some(b=>b.type==='drop'&&b.primary):r.kind==='note-control'?(rack.notes??[]).some(b=>b.id===r.targetId&&(b.type==='drop'?!b.primary&&[0,1,2].includes(r.parameter):b.type==='arp'?[3,4,5,6].includes(r.parameter):b.type==='strum'?[7,8].includes(r.parameter):false)):r.kind==='sauce'?audio.has(r.targetId):r.kind==='effects'?effects.get(r.targetId)==='moving-space':r.kind==='effect-control'?(effects.get(r.targetId)==='moving-space'?[0,1,2,3,4,8].includes(r.parameter):effects.get(r.targetId)==='impact'?[0,5,6,7,8].includes(r.parameter):false):true).map(r=>({...r}));}
export function pruneEffectRoutes(input,rack){const modulation=normalizeModulation(input);for(const s of modulation.sources)s.routes=pruneRackRoutes(s.routes,rack);return modulation;}
