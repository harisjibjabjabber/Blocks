import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { factoryPatch } from '../packages/synth-web/presets.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.env.EMSDK)throw Error('Set EMSDK to an activated Emscripten SDK (tested7.0.0).');
const compiler=resolve(process.env.EMSDK,'upstream/emscripten/em++.py');
if(!existsSync(compiler))throw Error('Emscripten compiler not found: '+compiler);
const out=resolve(process.argv[2]||process.env.SYNTH_AUDITIONS||resolve(root,'../synth-auditions'));
mkdirSync(out,{recursive:true});
const core=resolve(root,'packages/synth-core');
const sources=readdirSync(resolve(core,'src')).filter(name=>name.endsWith('.cpp')).map(name=>resolve(core,'src',name));
const fixture=resolve(core,'tests/audition_wav.cpp'),target=resolve(out,'audition-wav.mjs');
const compileArgs=[compiler,...sources,fixture,'-I'+resolve(core,'include'),'-std=c++17','-O2','-Wall','-Wextra','-Wpedantic','-sENVIRONMENT=node','-sEXIT_RUNTIME=1','-sNODERAWFS=1','-o',target];
const compiled=spawnSync(process.env.PYTHON||'python',compileArgs,{stdio:'inherit',cwd:root});
if(compiled.error)throw compiled.error;if(compiled.status)process.exit(compiled.status);
const run=(await import(pathToFileURL(target).href)).default;
await run({arguments:[out,'--describe']});
if(process.exitCode)throw Error('Audition descriptor export failed');
const descriptors=JSON.parse(readFileSync(resolve(out,'descriptors.json'),'utf8'));
if(descriptors.length!==40)throw Error('Expected ABI5/count40 descriptors');
const factoryInput=resolve(out,'factory-values.txt');
writeFileSync(factoryInput,['velvet','glass','low'].map(id=>id+' '+factoryPatch(id,descriptors).join(' ')).join('\n')+'\n');
await run({arguments:[out,factoryInput]});
if(process.exitCode)throw Error('Audition render failed');
if(process.exitCode)throw Error('Audition renderer exited with code '+process.exitCode);
const sha256=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const clips=['velvet','glass','low','sine-triangle','voice-overflow'].map(id=>{
 const manifest=JSON.parse(readFileSync(resolve(out,id+'.json'),'utf8'));
 if(manifest.abiVersion!==5||manifest.patchVersion!==5||manifest.parameters.length!==40)throw Error('Audition requires ABI5/count40: '+id);
 if(manifest.frames>manifest.sampleRate*6||manifest.normalized!==false||manifest.measurements.clippedSamples||manifest.measurements.voicesAtEnd)throw Error('Invalid audition fixture: '+id);
 if(!(manifest.measurements.rms>1e-4)||!Number.isFinite(manifest.measurements.peak)||manifest.measurements.lastHalfSecondRms>1e-5)throw Error('Silent or uncleared audition fixture: '+id);
 if(['velvet','glass','low'].includes(id)) {
  const expected=factoryPatch(id,manifest.parameters);
  for(const p of manifest.parameters)if(Math.abs(p.value-expected[p.id])>1e-5*Math.max(1e-6,Math.abs(expected[p.id])))throw Error(`Factory patch drift: ${id} parameter${p.id}, fixture=${p.value}, UI=${expected[p.id]}`);
 }
 return{id,title:manifest.title,wav:id+'.wav',manifest:id+'.json',wavSha256:sha256(resolve(out,id+'.wav')),manifestSha256:sha256(resolve(out,id+'.json')),measurements:manifest.measurements};
});
const sourceFiles=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sourceFiles(resolve(directory,entry.name)):/\.(?:h|hpp|cpp)$/.test(entry.name)?[resolve(directory,entry.name)]:[]);
const evidence={fixtureVersion:1,node:process.version,compiler:'Emscripten em++ C++17 -O2',wasmSha256:sha256(resolve(out,'audition-wav.wasm')),sources:[...sourceFiles(resolve(core,'src')),...sourceFiles(resolve(core,'include')),fixture,resolve(root,'packages/synth-web/presets.js'),resolve(root,'packages/synth-web/recipes.js')].map(path=>({path:path.slice(root.length+1).replaceAll('\\','/'),sha256:sha256(path)})),clips,notes:'Actual portable-core render. Fixed output gain0.3; no per-file normalization. JSON manifests contain exact parameter values and sample-offset events. Factory patches verified against the shared UI definitions. Listening and physical-phone acceptance remain separate.'};
writeFileSync(resolve(out,'index.json'),JSON.stringify(evidence,null,2)+'\n');
console.log('Audition files and exact manifests: '+out);
