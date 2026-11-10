import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const flags=Object.fromEntries(process.argv.slice(2).map(arg=>{const m=/^--(before|after|out|backend)=(.+)$/.exec(arg);if(!m)throw Error('Usage: compare-rack-audio.mjs --before=core-path [--after=core-path] [--out=path] [--backend=wasm|native]');return[m[1],m[2]];}));
if(!flags.before)throw Error('--before is required');const backend=flags.backend||'wasm';if(!['wasm','native'].includes(backend))throw Error('Unknown backend');if(backend==='wasm'&&!process.env.EMSDK)throw Error('Set EMSDK');
const out=resolve(flags.out||resolve(root,'../synth-headroom-audio-'+backend));mkdirSync(out,{recursive:true});
const fixture=resolve(root,'packages/synth-core/tests/rack_differential.cpp'),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(dir,e.name)):/\.(?:h|hpp|cpp)$/.test(e.name)?[resolve(dir,e.name)]:[]).sort();
const cores={before:resolve(root,flags.before),after:resolve(root,flags.after||'packages/synth-core')};
const hashes=()=>Object.fromEntries(Object.entries(cores).map(([name,core])=>[name,[...files(resolve(core,'src')),...files(resolve(core,'include')),fixture,fileURLToPath(import.meta.url)].map(path=>({path:relative(root,path).replaceAll('\\','/'),sha256:sha(path)}))]));
const sourceHashes=hashes(),variants={};
for(const [name,core]of Object.entries(cores)){
 const target=resolve(out,name+(backend==='wasm'?'.mjs':process.platform==='win32'?'.exe':'')),audio=resolve(out,name+'.f32');
 const common=[resolve(core,'src/blocks_synth.cpp'),fixture,'-I'+resolve(core,'include'),'-std=c++17',backend==='wasm'?'-O2':'-O3','-Wall','-Wextra','-Wpedantic'];
 const command=backend==='wasm'?process.env.PYTHON||'python':process.env.CXX||'c++';
 const args=backend==='wasm'?[resolve(process.env.EMSDK,'upstream/emscripten/em++.py'),...common,'-sENVIRONMENT=node','-sEXIT_RUNTIME=1','-sNODERAWFS=1','-o',target]:[...common,'-o',target];
 const compiled=spawnSync(command,args,{stdio:'inherit',cwd:root});if(compiled.error)throw compiled.error;if(compiled.status)process.exit(compiled.status);
 if(backend==='wasm'){let status=0;await(await import(pathToFileURL(target).href)).default({arguments:[audio],onExit:value=>status=value});if(status||process.exitCode)process.exit(status||process.exitCode);}else{const run=spawnSync(target,[audio],{stdio:'inherit',cwd:root});if(run.error)throw run.error;if(run.status)process.exit(run.status);}
 variants[name]={audio,sha256:sha(audio),manifest:JSON.parse(readFileSync(audio+'.json','utf8'))};
}
if(JSON.stringify(sourceHashes)!==JSON.stringify(hashes()))throw Error('Core/fixture changed during comparison');
const before=readFileSync(variants.before.audio),after=readFileSync(variants.after.audio),metadataEqual=JSON.stringify(variants.before.manifest)===JSON.stringify(variants.after.manifest),byteIdentical=before.equals(after);let firstDifference=null;
if(!byteIdentical){const count=Math.min(before.length,after.length)/4;for(let sample=0;sample<count;sample++)if(before.readUInt32LE(sample*4)!==after.readUInt32LE(sample*4)){firstDifference={sample,before:before.readFloatLE(sample*4),after:after.readFloatLE(sample*4)};break;}}
const report={kind:'Same-backend exact public stereo float-output comparison',backend,options:backend==='wasm'?'Emscripten C++17 -O2':'native C++17 -O3',node:process.version,sourceHashes,variants,bytes:before.length,metadataEqual,byteIdentical,firstDifference,passed:metadataEqual&&byteIdentical&&variants.before.manifest.cases.length===24&&before.length===variants.before.manifest.totalFrames*8};
writeFileSync(resolve(out,'comparison.json'),JSON.stringify(report,null,2)+'\n');if(!report.passed)throw Error('Differential audio mismatch: '+JSON.stringify(firstDifference));console.log('PASS exact24-case rack audio '+backend+': '+before.length+' bytes, SHA256 '+variants.after.sha256);
