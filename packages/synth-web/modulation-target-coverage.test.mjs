import test from 'node:test';
import assert from 'node:assert/strict';
import {buildModulationTargets,modulationTargetForControl} from './modulation-targets.js';
import {SUITE_FLOATS} from './suite-state.js';
import {REVERB_FIELDS} from './reverb-state.js';
import {DEFAULT_MODULATION} from './modulation-state.js';
import {DEFAULT_RACK} from './sauce-state.js';
const targets=()=>buildModulationTargets([],DEFAULT_RACK,DEFAULT_MODULATION);

test('the Character shortcut and Suite Drive resolve to the same real native destination',()=>{
 const all=targets(),shortcut=modulationTargetForControl(all,'knob:character'),full=modulationTargetForControl(all,'suite:driveDb');
 assert.equal(shortcut?.key,'config:20:8');assert.equal(shortcut,full);
 const denied=buildModulationTargets([],DEFAULT_RACK,DEFAULT_MODULATION,()=>null);
 assert.equal(modulationTargetForControl(denied,'knob:character'),null);
});

test('all Harmonics controls, including each selected OTT band, have independent destinations',()=>{
 const all=targets();
 for(const[key,,,,,offset]of SUITE_FLOATS)assert.equal(modulationTargetForControl(all,'suite:'+key)?.key,'config:20:'+offset/4,key);
 const destinations=new Set();
 for(let band=0;band<3;band++)for(const[field,parameter]of [['thresholdDb',0],['gainDb',1],['up',2],['down',3]]){
  const t=modulationTargetForControl(all,`suite:band:${band}:${field}`);assert.equal(t?.key,`config:20:${34+band*4+parameter}`);destinations.add(t.key);
 }
 assert.equal(destinations.size,12);assert.equal(modulationTargetForControl(all,'suite:band:gainDb'),null,'an unowned band is never silently mapped to Low');
});

test('all current Space physical controls and all modulation-source envelope fields are exposed',()=>{
 const all=targets();
 for(const[key]of REVERB_FIELDS)assert.ok(modulationTargetForControl(all,'output:reverb:'+key),key);
 for(const key of ['time','feedback','wet','damping'])assert.ok(modulationTargetForControl(all,'output:delay:'+key));
 for(let env=1;env<=3;env++)for(const field of ['attack','decay','sustain','release','attackBend','decayBend','releaseBend'])assert.ok(modulationTargetForControl(all,`env:${env}:${field}`));
 for(let lfo=1;lfo<=4;lfo++)for(const field of ['rate','intensity'])assert.ok(modulationTargetForControl(all,`lfo:${lfo}:${field}`));
 assert.ok(modulationTargetForControl(all,'output:width'));
});


test('Osc1, Osc2 and Sub octave controls bind distinct stepped native targets',()=>{
 const all=targets();for(const [control,id,p]of [['tuning:0:octave',30,1],['tuning:1:octave',31,1],['tuning:sub:octave',28,2]]){
  const t=modulationTargetForControl(all,control);assert.equal(t?.key,`config:${id}:${p}`);assert.equal(t.mapping,2);assert.equal(t.min,-3);assert.equal(t.max,3);
 }
});

test('numeric unison count and synchronized clock choices bind actual stepped destinations',()=>{const all=targets();for(const [control,key]of [['voicing:0:count','config:26:2'],['voicing:1:count','config:27:2'],['output:delay:division','config:21:10'],['osc-bass:0:division','config:24:9'],['osc-bass:1:division','config:25:9'],...Array.from({length:4},(_,i)=>[`lfo:${i+1}:division`,`lfo:${i+1}:2`])]){const t=modulationTargetForControl(all,control);assert.equal(t?.key,key);assert.equal(t.mapping,2);}});

test('note destinations expose only meaningful node controls, with primary Drop aliases',()=>{const rack={audio:[],effects:[],notes:[{id:4,type:'drop',primary:false},{id:5,type:'arp'},{id:6,type:'strum'},{id:7,type:'drop',primary:true}]};const all=buildModulationTargets([],rack,DEFAULT_MODULATION);for(const [id,fields]of [[4,['amount','time','bend']],[5,['bpm','division','curl','gate']],[6,['strum','humanize']]])for(const field of fields)assert.equal(modulationTargetForControl(all,`notes:${id}:${field}`)?.kind,'note-control');for(const [field,p]of [['amount',15],['time',16],['bend',17]])assert.equal(modulationTargetForControl(all,`notes:7:${field}`)?.key,`tone:0:${p}`);for(const key of ['notes:5:strum','notes:6:gate','notes:4:bpm'])assert.equal(modulationTargetForControl(all,key),null);});
