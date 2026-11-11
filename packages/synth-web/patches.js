import {DEFAULT_SUITE,normalizeSuite} from './suite-state.js';
import {canonicalLevels} from './parameter-state.js';
import {DEFAULT_PERFORMANCE,normalizePerformance} from './performance-state.js';
import {normalizeRack,syncRackOrder} from './sauce-state.js';
import {normalizeModulation} from './modulation-state.js';
import {normalizeClock} from './clock-state.js';
import {normalizeSub} from './sub-state.js';
import {normalizeOscBass} from './osc-bass-state.js';
import {normalizeVoicing} from './voicing-state.js';
import {normalizeSound} from './sound-state.js';
import {DEFAULT_REVERB,normalizeReverb} from './reverb-state.js';
import {normalizeDelay} from './delay-state.js';
import {normalizeFilterRouting} from './filter-routing-state.js';
import {normalizeStereoWidth} from './stereo-state.js';
const inRange=(value,min,max,label)=>{if(!Number.isFinite(value)||value<min||value>max)throw Error('Invalid '+label);};
const checkPerformance=p=>{for(const[key,min,max]of[['bpm',40,240],['curl',-.8,.8],['gate',.1,.95],['strum',0,100],['humanize',0,1]])inRange(p[key],min,max,'performance '+key);};
const requireFields=(value,keys,label)=>{if(!value||typeof value!=='object'||Array.isArray(value)||keys.some(key=>!Object.hasOwn(value,key)))throw Error('Incomplete '+label);};
export function validateTonePatch(patch,parameters,engineVersion){
 if(patch?.format!=='blocks-synth-patch'||patch.version!==7||engineVersion!==7||parameters.length!==44||!Array.isArray(patch.values)||patch.values.length!==44)throw Error('Unsupported or invalid current patch');
 const next=patch.values.map((value,id)=>{const p=parameters[id];if(!Number.isFinite(value)||Math.fround(value)<p.min||Math.fround(value)>p.max||(p.mapping===2&&!Number.isInteger(value)))throw Error('Invalid patch parameter '+id);return value;});
 return canonicalLevels(next);
}
// Import validates every section before changing any live state. Defaults belong
// to Init/new controls, never to a file missing current-format data.
export function validateCurrentPatch(patch,parameters,engineVersion){
 const values=validateTonePatch(patch,parameters,engineVersion);
 const fields={reverb:Object.keys(DEFAULT_REVERB),suite:Object.keys(DEFAULT_SUITE),performance:Object.keys(DEFAULT_PERFORMANCE),rack:['version','audio','notes','order'],modulation:['version','sources'],clock:['version','bpm','beatsPerBar'],sub:['version','enabled','waveform','octave','priority','routing','level'],oscBass:['version','oscillators'],voicing:['version','oscillators'],sound:['version','oscillator','filterModel','filterDrive'],filterRouting:['version','osc1','osc2'],delay:['version','enabled','mode','synced','division','time','feedback','wet','damping']};
 for(const[key,required]of Object.entries(fields))requireFields(patch[key],required,key);
 if(!Object.hasOwn(patch,'stereoWidth'))throw Error('Incomplete stereo width');inRange(patch.stereoWidth,0,2,'stereo width');checkPerformance(patch.performance);
 for(const b of patch.rack.notes||[]){requireFields(b,['id','type','primary','enabled','performance','amount','time','bend'],'note block');requireFields(b.performance,Object.keys(DEFAULT_PERFORMANCE),'note performance');checkPerformance(b.performance);inRange(b.amount,0,2400,'note amount');inRange(b.time,.001,4,'note time');inRange(b.bend,-2,2,'note bend');}
 for(const b of patch.rack.audio||[]){inRange(b.amount,b.type==='fullness'?0:1,b.type==='fullness'?1:12,'audio amount');requireFields(b,['id','type','primary','enabled','amount',...[]],'audio block');}
 for(const s of patch.modulation.sources||[]){requireFields(s,['id','enabled','waveform','rate','synced','division','intensity','retrigger','points','routes'],'LFO');inRange(s.rate,.05,20,'LFO rate');inRange(s.intensity,0,1,'LFO intensity');for(const r of s.routes||[]){requireFields(r,['kind','targetId','parameter','depth'],'LFO route');inRange(r.depth,-1,1,'LFO depth');}}
 const performance=normalizePerformance(patch.performance),clock=normalizeClock(patch.clock);if(performance.mode!=='off'||performance.bpm!==clock.bpm)throw Error('Patch performance must use the shared clock and note rack');
 const modulation=normalizeModulation(patch.modulation),rack=normalizeRack(patch.rack);
 for(const source of modulation.sources)for(const route of source.routes){if(route.kind==='sauce'&&!rack.audio.some(b=>b.id===route.targetId)||route.kind==='lfo'&&!modulation.sources.some(s=>s.id===route.targetId)||route.kind==='effects'&&!rack.effects.some(b=>b.id===route.targetId&&b.type==='moving-space'))throw Error('Missing LFO route target');}
 return{values,performance,clock,suite:normalizeSuite(patch.suite),rack:syncRackOrder(rack,modulation),modulation,sub:normalizeSub(patch.sub),oscBass:normalizeOscBass(patch.oscBass),voicing:normalizeVoicing(patch.voicing),sound:normalizeSound(patch.sound),delay:normalizeDelay(patch.delay),reverb:normalizeReverb(patch.reverb),filterRouting:normalizeFilterRouting(patch.filterRouting),stereoWidth:normalizeStereoWidth(patch.stereoWidth)};
}
