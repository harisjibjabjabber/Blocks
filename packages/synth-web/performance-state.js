// Host-facing performance state is separate from the portable tone patch.
export const DEFAULT_PERFORMANCE=Object.freeze({version:1,mode:'off',mono:false,bpm:120,division:'1/8',curl:0,gate:.7,order:'up',strum:35,humanize:.25,seed:0xC0FFEE});
const modes=['off','arp','strum'],orders=['up','down','played','random'];
const divisions={'1/4':[4,0],'1/8':[8,0],'1/16':[16,0],'1/8T':[8,1],'1/16T':[16,1]};
export function normalizePerformance(input=DEFAULT_PERFORMANCE){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid performance settings');
 const next={...DEFAULT_PERFORMANCE,...input};
 if(next.version!==1||!modes.includes(next.mode)||!orders.includes(next.order)||!Object.hasOwn(divisions,next.division)||typeof next.mono!=='boolean')throw Error('Unsupported performance settings');
 for(const [key,low,high]of [['bpm',40,240],['curl',-.8,.8],['gate',.1,.95],['strum',0,100],['humanize',0,1]]){
  if(!Number.isFinite(next[key]))throw Error('Invalid performance '+key);
  next[key]=Math.max(low,Math.min(high,next[key]));
 }
 if(!Number.isInteger(next.seed)||next.seed<0||next.seed>0xffffffff)throw Error('Invalid performance seed');
 return Object.fromEntries(Object.keys(DEFAULT_PERFORMANCE).map(key=>[key,next[key]]));
}
export function toCorePerformance(settings){
 const s=normalizePerformance(settings),[division,triplet]=divisions[s.division];
 return{version:1,mode:modes.indexOf(s.mode),order:orders.indexOf(s.order),division,triplet,seed:s.seed,mono:Number(s.mono),bpm:s.bpm,curl:s.curl,gate:s.gate,strum_ms:s.strum,randomness:s.humanize};
}
export function fromCorePerformance(c){
 if(!c||c.version!==1||![0,1].includes(c.mono))throw Error('Invalid engine performance settings');
 const division=Object.entries(divisions).find(([,value])=>value[0]===c.division&&value[1]===c.triplet)?.[0];
 return normalizePerformance({version:c.version,mode:modes[c.mode],order:orders[c.order],division,mono:Boolean(c.mono),seed:c.seed,bpm:c.bpm,curl:c.curl,gate:c.gate,strum:c.strum_ms,humanize:c.randomness});
}
// Display and scheduler share this normalized fixed-span exponential law.
export function curlPhase(unit,curl){
 if(!Number.isFinite(unit)||!Number.isFinite(curl))throw Error('Invalid Curl phase');
 const u=Math.max(0,Math.min(1,unit)),c=Math.max(-.8,Math.min(.8,curl));
 return Math.abs(c)<1e-7?u:Math.expm1(-c*u)/Math.expm1(-c);
}
export function performanceSteps(settings){const s=normalizePerformance(settings),[denominator,triplet]=divisions[s.division];return denominator*(triplet?1.5:1);}
