import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.env.EMSDK)throw Error('Set EMSDK to Emscripten 7.0.0.');
const out=resolve(process.env.SYNTH_BENCHMARK_DIR||resolve(root,'../synth-benchmark'));
mkdirSync(out,{recursive:true});
const target=resolve(out,'benchmark.mjs'),json=resolve(out,'benchmark.json');
const compile=spawnSync(process.env.PYTHON||'python',[
  resolve(process.env.EMSDK,'upstream/emscripten/em++.py'),resolve(root,'packages/synth-core/src/blocks_synth.cpp'),
  resolve(root,'packages/synth-core/tests/benchmark_core.cpp'),'-I'+resolve(root,'packages/synth-core/include'),'-std=c++17','-O2',
  '-Wall','-Wextra','-Wpedantic','-sENVIRONMENT=node','-sEXIT_RUNTIME=1','-sNODERAWFS=1','-o',target,
],{stdio:'inherit'});
if(compile.error)throw compile.error;if(compile.status)process.exit(compile.status);
await(await import(pathToFileURL(target).href)).default({arguments:[json]});
const report=JSON.parse(readFileSync(json,'utf8'));
report.runtime={node:process.version,platform:process.platform,arch:process.arch,compiler:'Emscripten 7.0.0 C++17 -O2'};
writeFileSync(json,JSON.stringify(report,null,2)+'\n');
console.log(`Measured ${report.cases.length} cases: ${json}`);
