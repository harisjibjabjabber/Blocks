import {SUITE_FLOATS} from './suite-state.js';

import {REVERB_FIELDS} from './reverb-state.js';

import {CREATIVE_FX_FIELDS} from './sauce-state.js';

export const ROUTE_KINDS=Object.freeze(['tone','sauce','lfo','effects','config','effect-control','note-control']);

export const TONE_MOD_TARGETS=Object.freeze([0,1,3,4,5,6,7,8,9,10,11,13,14,15,16,17,18,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,41,42]);

const keyOf=r=>`${r.kind}:${r.targetId}:${r.parameter}`;

export function canonicalModulationKey(r){
 if(r.kind==='tone'){
  if(r.parameter===11)return 'config:10:0';
  if(r.parameter===42)return 'config:10:1';
  if(r.parameter===23)return 'config:10:2';
  if(r.parameter>=4&&r.parameter<=10)return 'config:40:'+(r.parameter-4);
  if(r.parameter>=25&&r.parameter<=31)return 'config:41:'+(r.parameter-25);
 }
 return keyOf(r);
}

const words=new Map();

const title=s=>s.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,x=>x.toUpperCase());

const fields=[];

function fixed(targetId,parameter,label,min,max,unit='',mapping=0,controlKeys=[]){const r={kind:'config',targetId,parameter,label,min,max,unit,mapping,scope:0,controlKeys};r.key=keyOf(r);fields.push(r);words.set(targetId+':'+parameter,r);}

for(let f=0;f<2;f++)for(const[p,k,min,max,unit,mapping]of[[0,'cutoff',20,20000,'Hz',1],[1,'resonance',0,1,'ratio',0],[2,'mix',0,1,'ratio',0],[3,'drive',1,12,'gain',1]])fixed(10+f,p,'Filter '+(f?'B':'A')+' · '+title(k),min,max,unit,mapping,[`filter:${f}:${k}`,`filter-bank:${f}:${k}`]);

for(const[k,,min,max,,offset]of SUITE_FLOATS)fixed(20,offset/4,'Harmonics · '+title(k),min,max,k.endsWith('Db')?'dB':k.endsWith('Ms')?'ms':k.endsWith('Hz')?'Hz':'',0,['suite:'+k,...(k==='driveDb'?['knob:character']:[])]);

for(let b=0;b<3;b++)for(const[j,k,min,max,unit]of[[0,'thresholdDb',-60,0,'dB'],[1,'gainDb',-24,24,'dB'],[2,'up',0,1,'ratio'],[3,'down',0,1,'ratio']])fixed(20,34+b*4+j,'OTT '+['Low','Mid','High'][b]+' · '+title(k),min,max,unit,0,[`suite:band:${b}:${k}`]);

for(const[p,k,min,max,unit,mapping]of[[6,'time',.01,2,'seconds',1],[7,'feedback',0,.9,'ratio',0],[8,'wet',0,1,'ratio',0],[9,'damping',20,20000,'Hz',1]])fixed(21,p,'Delay · '+title(k),min,max,unit,mapping,['output:delay:'+k]);
fixed(21,10,'Delay · Division',0,7,'index',2,['output:delay:division']);

REVERB_FIELDS.forEach(([k,,min,max],i)=>fixed(22,3+i,'Reverb · '+title(k),min,max,['lowCut','damping'].includes(k)?'Hz':k==='outputDb'?'dB':k==='shimmerSemitones'?'semitones':['predelay','decay'].includes(k)?'seconds':'',0,['output:reverb:'+k]));

fixed(23,0,'Stereo width',0,2,'ratio',0,['output:width']);
fixed(50,0,'Character · Pitch',0,1,'ratio',0,['knob:motion']);

for(let o=0;o<2;o++){

 for(const[p,k,min,max,unit,mapping]of[[4,'spinHz',.1,20,'Hz',1],[5,'motion',0,1,'ratio',0],[6,'grit',0,1,'ratio',0],[7,'cycleBeats',.03125,64,'beats',1],[8,'curl',-.8,.8,'ratio',0]])fixed(24+o,p,'Osc '+(o+1)+' Bass · '+title(k),min,max,unit,mapping,[`osc-bass:${o}:${k}`]);

 fixed(24+o,9,'Osc '+(o+1)+' Bass · Division',0,1,'position',2,[`osc-bass:${o}:division`]);
 fixed(26+o,2,'Osc '+(o+1)+' Unison count (next notes)',1,7,'voices',2,[`voicing:${o}:count`]);
 fixed(26+o,0,'Osc '+(o+1)+' Unison detune',0,50,'cents',0,[`voicing:${o}:detune`]);fixed(26+o,1,'Osc '+(o+1)+' Unison spread',0,1,'ratio',0,[`voicing:${o}:spread`]);fixed(30+o,0,'Osc '+(o+1)+' Fine pitch',-100,100,'cents',0,[`tuning:${o}:fineCents`]);fixed(30+o,1,'Osc '+(o+1)+' Octave',-3,3,'octaves',2,[`tuning:${o}:octave`]);

}

fixed(28,0,'Sub level',0,1,'linear',0,['sub:level']);fixed(28,1,'Sub fine pitch',-100,100,'cents',0,['tuning:sub:fineCents']);fixed(28,2,'Sub octave',-3,3,'octaves',2,['tuning:sub:octave']);

for(let e=0;e<3;e++)for(const[p,k,min,max,unit,mapping]of[[0,'attack',.001,5,'seconds',1],[1,'decay',.001,8,'seconds',1],[2,'sustain',0,1,'linear',0],[3,'release',.001,10,'seconds',1],[4,'attackBend',-2,2,'octaves',0],[5,'decayBend',-2,2,'octaves',0],[6,'releaseBend',-2,2,'octaves',0]])fixed(40+e,p,'Env '+(e+1)+' · '+title(k),min,max,unit,mapping,[`env:${e+1}:${k}`]);

export const FIXED_MODULATION_TARGETS=Object.freeze(fields.map(r=>Object.freeze({...r,controlKeys:Object.freeze(r.controlKeys)})));

export function isKnownModulationTarget(kind,id,parameter){if(!Number.isInteger(id)||id<0||id>0x7fffffff||!Number.isInteger(parameter))return false;return kind==='tone'?id===0&&TONE_MOD_TARGETS.includes(parameter):kind==='sauce'||kind==='effects'?id>0&&parameter===0:kind==='lfo'?id>=1&&id<=4&&[0,1,2].includes(parameter):kind==='config'?words.has(id+':'+parameter):kind==='effect-control'||kind==='note-control'?id>0&&parameter>=0&&parameter<9:false;}

// Descriptor callback is the final native authority. Null entries are not shown.

// Without it, only the explicitly implemented current-contract candidates appear.

export function buildModulationTargets(parameters=[],rack={audio:[],effects:[]},modulation={sources:[]},getTargetInfo=null){

 const hasPrimaryDrop=(rack.notes??[]).some(b=>b.type==='drop'&&b.primary);
 const result=TONE_MOD_TARGETS.filter(parameter=>![15,16,17].includes(parameter)||hasPrimaryDrop).map(parameter=>({kind:'tone',targetId:0,parameter,label:parameter===24?'Filter A · Env 2 amount':'Tone · '+(parameters[parameter]?.name??'Parameter '+parameter),min:parameters[parameter]?.min??0,max:parameters[parameter]?.max??1,mapping:parameters[parameter]?.mapping??0,scope:parameter===0?0:1,unit:parameters[parameter]?.unit??'',controlKeys:['tone:'+parameter,'knob:'+parameter,...(parameter===24?['filter:envAmount']:[])]}));

 result.push(...FIXED_MODULATION_TARGETS.map(r=>({...r,controlKeys:[...r.controlKeys]})));

 let n=0;for(const b of rack.audio??[])result.push({kind:'sauce',targetId:b.id,parameter:0,label:'Fullness '+(++n)+' · Amount',min:0,max:1,mapping:0,scope:1,unit:'ratio',controlKeys:[`audio:${b.id}:amount`]});

 let moving=0;const counts={};for(const b of rack.effects??[]){if(b.type==='moving-space')result.push({kind:'effects',targetId:b.id,parameter:0,label:'Moving Space '+(++moving)+' · Move',min:-1,max:1,mapping:0,scope:0,unit:'ratio',controlKeys:[]});const number=counts[b.type]=(counts[b.type]??0)+1;const allowed=b.type==='moving-space'?[0,1,2,3,4,8]:[0,5,6,7,8];for(const parameter of allowed){const[k,,min,max]=CREATIVE_FX_FIELDS[parameter];result.push({kind:'effect-control',targetId:b.id,parameter,label:(b.type==='moving-space'?'Moving Space':'Impact')+' '+number+' · '+title(k==='motion'?'Env':k),min,max,mapping:0,scope:0,unit:k==='outputDb'?'dB':k==='pitch'?'semitones':'ratio',controlKeys:[`effects:${b.id}:${k}`]});}}

 const noteFields=[['amount',0,2400,'cents',0],['time',.001,4,'seconds',1],['bend',-2,2,'curve',0],['bpm',40,240,'BPM',0],['division',0,7,'index',2],['curl',-.8,.8,'ratio',0],['gate',.1,.95,'ratio',0],['strum',0,100,'ms',0],['humanize',0,1,'ratio',0]];
 const noteCounts={};for(const b of rack.notes??[]){const number=noteCounts[b.type]=(noteCounts[b.type]??0)+1;const allowed=b.type==='drop'?[0,1,2]:b.type==='arp'?[3,4,5,6]:[7,8];for(const parameter of allowed){const[k,min,max,unit,mapping]=noteFields[parameter];const controlKeys=[`notes:${b.id}:${k}`];if(b.type==='drop'&&b.primary){const t=result.find(r=>r.kind==='tone'&&r.parameter===15+parameter);t?.controlKeys.push(...controlKeys);continue;}result.push({kind:'note-control',targetId:b.id,parameter,label:title(b.type)+' '+number+' · '+title(k)+(b.type==='drop'?' (next attack)':b.type==='arp'?' (next bar)':' (next collection)'),min,max,unit,mapping,scope:0,controlKeys});}}

 for(const s of modulation.sources??[])for(const[parameter,label]of[[0,'Clock speed'],[1,'Intensity'],[2,'Division']])result.push({kind:'lfo',targetId:s.id,parameter,label:'LFO '+s.id+' · '+label,min:parameter===0?.05:0,max:parameter===0?20:parameter===2?9:1,mapping:parameter===0?1:parameter===2?2:0,scope:0,unit:parameter===0?'Hz':parameter===2?'index':'ratio',controlKeys:[`lfo:${s.id}:${parameter===0?'rate':parameter===2?'division':'intensity'}`]});

 return result.flatMap(r=>{const info=getTargetInfo?.(ROUTE_KINDS.indexOf(r.kind),r.targetId,r.parameter);if(getTargetInfo&&!info)return[];return[{...r,...(info?{min:info.min,max:info.max,mapping:info.mapping,scope:info.scope,unit:info.unit}:{}),key:keyOf(r),canonicalKey:canonicalModulationKey(r)}];});

}

export function modulationTargetForControl(targets,controlKey){return targets.find(t=>t.controlKeys?.includes(controlKey))??null;}
