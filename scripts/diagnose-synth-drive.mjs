import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const core=resolve(root,'packages/synth-core');
const out=resolve(process.argv.find(a=>a.startsWith('--out='))?.slice(6)||resolve(root,'../synth-drive-diagnostic'));
if(!process.env.EMSDK)throw Error('Set EMSDK and optionally PYTHON before running.');
mkdirSync(out,{recursive:true});
const fixture=resolve(core,'tests/drive_diagnostic.cpp');
const sha256=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceFiles=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(resolve(directory,e.name)):/\.(?:h|hpp|cpp)$/.test(e.name)?[resolve(directory,e.name)]:[]).sort();
const paths=[...sourceFiles(resolve(core,'src')),...sourceFiles(resolve(core,'include')),fixture,fileURLToPath(import.meta.url)];
const sourceHashes=()=>paths.map(path=>({path:path.slice(root.length+1).replaceAll('\\','/'),sha256:sha256(path)}));
const before=sourceHashes();
const target=resolve(out,'drive-diagnostic.mjs');
const sources=readdirSync(resolve(core,'src')).filter(n=>n.endsWith('.cpp')).map(n=>resolve(core,'src',n));
const compiled=spawnSync(process.env.PYTHON||'python',[resolve(process.env.EMSDK,'upstream/emscripten/em++.py'),...sources,fixture,'-I'+resolve(core,'include'),'-std=c++17','-O2','-Wall','-Wextra','-Wpedantic','-sENVIRONMENT=node','-sEXIT_RUNTIME=1','-sNODERAWFS=1','-sALLOW_MEMORY_GROWTH=1','-o',target],{cwd:root,stdio:'inherit'});
if(compiled.error)throw compiled.error;if(compiled.status)process.exit(compiled.status);
if(process.argv.includes('--compile-only')){console.log('Diagnostic host compiles; no audio/evidence rendered.');process.exit(0);}
const started=performance.now();
await (await import(pathToFileURL(target).href)).default({arguments:[out]});
if(process.exitCode)throw Error('Core diagnostic failed.');
const renderWallMs=performance.now()-started;
if(JSON.stringify(before)!==JSON.stringify(sourceHashes()))throw Error('Core or fixture changed during rendering; discard this evidence and rerun after freeze.');
const matrix=JSON.parse(readFileSync(resolve(out,'matrix.json'),'utf8'));
if(![4,5].includes(matrix.abiVersion)||matrix.cases.length!==130||matrix.normalized!==false)throw Error('Incorrect diagnostic matrix.');
const parameter=(c,id)=>c.parameters.find(p=>p.id===id)?.value;
for(const c of matrix.cases){
 if(c.parameters.length!==(matrix.abiVersion===4?35:40)||Math.abs(parameter(c,0)-Math.fround(.3))>1e-10||parameter(c,6)!==1||parameter(c,11)!==6000||parameter(c,13)!==0||parameter(c,18)!==0||parameter(c,23)!==1||parameter(c,24)!==0||parameter(c,32)!==0||parameter(c,34)!==0)throw Error('Non-neutral diagnostic setting: '+c.id);
 if(c.metrics.clippedSamples||c.metrics.voicesAtEnd||Object.values(c.metrics).some(v=>!Number.isFinite(v))||c.metrics.monoAcRms<=0)throw Error('Invalid output: '+c.id);
}
const near=(a,b)=>Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));
// Square must be a control for Pulse at .5, not a different hidden loudness.
for(const c of matrix.cases.filter(c=>c.configuration.includes('square'))){
 const twin=matrix.cases.find(t=>t.configuration===c.configuration.replace('square','pulse50')&&t.drive===c.drive&&t.phrase===c.phrase);
 if(!twin||Object.keys(c.metrics).some(k=>!near(c.metrics[k],twin.metrics[k])))throw Error('Square/Pulse.5 control mismatch: '+c.id);
}
const db=(a,b)=>20*Math.log10(Math.max(a,1e-20)/Math.max(b,1e-20));
const comparisons=matrix.cases.map(c=>{
 const baseline=matrix.cases.find(b=>b.configuration===c.configuration&&b.phrase===c.phrase&&b.drive===1);
 return {id:c.id,configuration:c.configuration,phrase:c.phrase,drive:c.drive,acDbVsDrive1:db(c.metrics.monoAcRms,baseline.metrics.monoAcRms),fundamentalDbVsDrive1:db(Math.sqrt(c.metrics.fundamentalBandPower),Math.sqrt(baseline.metrics.fundamentalBandPower)),dc:c.metrics.monoDc,energyVariationDb:db(c.metrics.window250msAcMax,c.metrics.window250msAcMin)};
});
const clips=['bass','chord'].map(phrase=>({file:`drive-${phrase}.wav`,sha256:sha256(resolve(out,`drive-${phrase}.wav`)),channels:2,encoding:'PCM16 little-endian',normalized:false,configuration:'dual-pulse6592-4.800000',segments:[1,2,4,8,12].map((drive,i)=>({startSample:i*matrix.framesPerCase,endSample:(i+1)*matrix.framesPerCase,drive,caseId:`dual-pulse6592-4.800000-${phrase}-drive${drive}`}))}));
const evidence={fixtureVersion:1,node:process.version,compiler:'Emscripten C++17 -O2',renderWallMs,sourceHashes:before,wasmSha256:sha256(resolve(out,'drive-diagnostic.wasm')),matrix:{file:'matrix.json',sha256:sha256(resolve(out,'matrix.json'))},clips,comparisons,limitations:['No listening or physical-phone acceptance claimed.','Actual core output includes the unchanged filter, per-voice Drive and master tanh; this is not an isolated transfer-function bench.','Union harmonic bands include overlapping chord partials and are not THD or isolated oscillator amplitudes.','Detuned beating and pulse DC can alter the nonlinear operating point; energy variation does not establish perceived phasiness or a new Drive phase path.','Fixed Output .3 and input velocity .72; no per-step/file normalization. Reset before each step makes events/seeds identical.']};
writeFileSync(resolve(out,'index.json'),JSON.stringify(evidence,null,2)+'\n');
const selected=['single-saw','single-square','single-pulse6592','dual-pulse6592-0.000000','dual-pulse6592-4.800000','dual-pulse6592-20.000000'];
const rows=comparisons.filter(c=>c.phrase==='bass'&&selected.includes(c.configuration)).map(c=>`| ${c.configuration} | ${c.drive} | ${c.acDbVsDrive1.toFixed(2)} | ${c.fundamentalDbVsDrive1.toFixed(2)} | ${c.dc.toFixed(6)} | ${c.energyVariationDb.toFixed(2)} |`);
writeFileSync(resolve(out,'report.md'),`# Drive diagnostic\n\n130 actual-core cases; ABI${matrix.abiVersion}, 48kHz, fixed Output .3 and velocity .72. No normalization. Square/Pulse duty .5 controls match within numerical tolerance. Analysis self-test checks known AC/DC and FFT power. Full matrix and exact parameters/events are in matrix.json; source/build/audio hashes are in index.json.\n\nThe two WAVs compare Drive 1, 2, 4, 8, 12 in that order, each in a separate 10-second segment with identical note timing. Both use Saw + Pulse duty .6592 at 4.8-cent detune; one holds MIDI36, the other MIDI48/55/60/64. Each segment begins with .2 seconds silence and releases at 9.5 seconds. Playback volume is the listener's choice; the files themselves retain one fixed gain.\n\n## Bass measurements\n\nSteady interval 1.5–9 seconds. AC and fundamental dB are relative to the same configuration at Drive1. Window variation is max/min AC RMS over nonoverlapping 250ms windows; it can include finite-window measurement ripple and is not a listening verdict.\n\n| Configuration | Drive | AC dB vs1 | Fundamental-band dB vs1 | Mono DC | Window variation dB |\n|---|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\n## Interpretation limits\n\n${evidence.limitations.map(s=>'- '+s).join('\n')}\n\nThis diagnostic separates configurations; it does not identify perceived phasiness automatically. A memoryless tanh has no independent temporal state, but waveform DC, beating and compression can change harmonic/energy balance through the existing filter and master saturation. No bass boost, new distortion or ladder model was introduced by this test.\n`);
console.log(`130 cases, Square/Pulse.5 controls and fixed settings verified; two comparison clips: ${out}`);
