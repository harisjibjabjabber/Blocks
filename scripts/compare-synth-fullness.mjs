import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const core=resolve(arg('core')||resolve(root,'packages/synth-core'));
const out=resolve(arg('out')||resolve(root,'../synth-fullness-after'));mkdirSync(out,{recursive:true});
if(!process.env.EMSDK)throw Error('Set EMSDK and optionally PYTHON.');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(dir,e.name)):/\.(?:h|hpp|cpp)$/.test(e.name)?[resolve(dir,e.name)]:[]).sort();
const fixture=resolve(root,'packages/synth-core/tests/fullness_comparison.cpp');
const paths=[...files(resolve(core,'src')),...files(resolve(core,'include')),fixture,fileURLToPath(import.meta.url)];
const hashes=()=>paths.map(p=>({path:relative(root,p).replaceAll('\\','/'),sha256:sha(p)}));
const before=hashes();
function compile(sources,target){const r=spawnSync(process.env.PYTHON||'python',[resolve(process.env.EMSDK,'upstream/emscripten/em++.py'),...sources,'-I'+resolve(core,'include'),'-std=c++17','-O2','-Wall','-Wextra','-Wpedantic','-sSTACK_SIZE=1048576','-sENVIRONMENT=node','-sEXIT_RUNTIME=1','-sNODERAWFS=1','-sALLOW_MEMORY_GROWTH=1','-o',target],{cwd:root,stdio:'inherit'});if(r.error)throw r.error;if(r.status)process.exit(r.status);}
if(process.argv.includes('--unit')){
 const target=resolve(out,'fullness-body-tests.mjs');compile([resolve(root,'packages/synth-core/tests/fullness_body_tests.cpp')],target);await(await import(pathToFileURL(target).href)).default({arguments:[]});if(process.exitCode)throw Error('Body unit tests failed');if(process.argv.includes('--unit-only'))process.exit(0);
}
const target=resolve(out,'fullness-comparison.mjs');compile([...files(resolve(core,'src')).filter(p=>p.endsWith('.cpp')),fixture],target);
const started=performance.now();await(await import(pathToFileURL(target).href)).default({arguments:[out]});if(process.exitCode)throw Error('Fullness renderer failed');const renderWallMs=performance.now()-started;
if(JSON.stringify(before)!==JSON.stringify(hashes()))throw Error('Source changed during render; rerun from frozen/snapshot source.');
const data=JSON.parse(readFileSync(resolve(out,'measurements.json'),'utf8'));
const db=(a,b)=>20*Math.log10(Math.max(a,1e-30)/Math.max(b,1e-30));
const powerDb=(a,b)=>db(Math.sqrt(a),Math.sqrt(b));
const comparisons=data.cases.map(c=>{const dry=data.cases.find(d=>d.fixture===c.fixture&&d.drive===c.drive&&d.order===c.order&&d.fullness===0);return{fixture:c.fixture,order:c.order,drive:c.drive,fullness:c.fullness,acDb:db(c.metrics.acRms,dry.metrics.acRms),fundamentalDb:powerDb(c.metrics.fundamentalPower,dry.metrics.fundamentalPower),lowDb:powerDb(c.metrics.lowPower,dry.metrics.lowPower),highDb:powerDb(c.metrics.highPower,dry.metrics.highPower),dcDelta:c.metrics.dc-dry.metrics.dc};});
let legacyZeroMatches=null;
if(arg('before')){
 const old=JSON.parse(readFileSync(resolve(arg('before'),'measurements.json'),'utf8'));
 legacyZeroMatches=data.cases.filter(c=>c.fullness===0).every(c=>old.cases.find(d=>d.fixture===c.fixture&&d.drive===c.drive&&d.fullness===0)?.floatPcmFnv64===c.floatPcmFnv64);
 if(!legacyZeroMatches)throw Error('Fullness0 float-output fingerprint changed versus baseline');
}
const clips=readdirSync(out).filter(n=>n.endsWith('.wav')).map(file=>({file,sha256:sha(resolve(out,file)),normalized:false,segments:[1,4,12].flatMap((drive,i)=>[0,1].map(fullness=>({startSeconds:(i*2+fullness)*8,endSeconds:(i*2+fullness+1)*8,drive,fullness})))}));
writeFileSync(resolve(out,'index.json'),JSON.stringify({fixtureVersion:1,node:process.version,compiler:'Emscripten C++17 -O2',renderWallMs,sourceHashes:before,wasmSha256:sha(resolve(out,'fullness-comparison.wasm')),measurementSha256:sha(resolve(out,'measurements.json')),legacyZeroMatches,comparisons,clips,notes:'Actual portable-core output, fixed gain.3 and velocity.72; no normalization. Order0 is Drive then Fullness in the new rack; baseline old core has historical preTone residual placement. No listening or physical-phone claim.'},null,2)+'\n');
const rows=comparisons.filter(c=>c.fullness===1).map(c=>`| ${c.fixture} | ${c.order} | ${c.drive} | ${c.acDb.toFixed(3)} | ${c.fundamentalDb.toFixed(3)} | ${c.lowDb.toFixed(3)} | ${c.highDb.toFixed(3)} |`);
writeFileSync(resolve(out,'report.md'),`# Fullness actual-core comparison\n\n${data.cases.length} eight-second cases; fixed output.3, velocity.72, 48kHz. Each WAV alternates Fullness0/1 at Drive1,4,12: six8-second segments. No peak/loudness normalization. Exact parameters, events and source hashes accompany the recordings.\n\n| Fixture | Order | Drive | AC dB Fullness1/0 | Fundamental dB | Low30–250Hz dB | High1–10kHz dB |\n|---|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\nLow/high band figures with negligible baseline energy (especially isolated Sine) are not perceptual level measures. Use Saw/Pulse fixtures to assess spectral balance. Fundamental bands are unions around both oscillators; chord partial overlap prevents isolated-voice interpretation. Audio fingerprints compare Fullness0 against the baseline when supplied: ${legacyZeroMatches}. No listening verdict or phone-performance claim.\n`);
console.log(`Fullness evidence: ${out}; cases=${data.cases.length}; legacyZeroMatches=${legacyZeroMatches}`);
