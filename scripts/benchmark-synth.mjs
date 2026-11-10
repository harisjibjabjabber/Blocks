import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.env.EMSDK)throw Error('Set EMSDK to Emscripten 7.0.0.');
const out=resolve(process.env.SYNTH_BENCHMARK_DIR||resolve(root,'../synth-benchmark'));
mkdirSync(out,{recursive:true});
const target=resolve(out,'benchmark.mjs'),json=resolve(out,'benchmark.json');
const sourceFiles=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(resolve(dir,e.name)):/\.(?:h|hpp|cpp)$/.test(e.name)?[resolve(dir,e.name)]:[]).sort();
const paths=[...sourceFiles(resolve(root,'packages/synth-core/src')),...sourceFiles(resolve(root,'packages/synth-core/include')),resolve(root,'packages/synth-core/tests/benchmark_core.cpp'),fileURLToPath(import.meta.url)];
const hashes=()=>paths.map(path=>({path:path.slice(root.length+1).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
const sourceHashes=hashes();

const compile=spawnSync(process.env.PYTHON||'python',[
  resolve(process.env.EMSDK,'upstream/emscripten/em++.py'),resolve(root,'packages/synth-core/src/blocks_synth.cpp'),
  resolve(root,'packages/synth-core/tests/benchmark_core.cpp'),'-I'+resolve(root,'packages/synth-core/include'),'-std=c++17','-O2',
  '-Wall','-Wextra','-Wpedantic','-sENVIRONMENT=node','-sEXIT_RUNTIME=1','-sNODERAWFS=1','-o',target,
],{stdio:'inherit'});
if(compile.error)throw compile.error;if(compile.status)process.exit(compile.status);
await(await import(pathToFileURL(target).href)).default({arguments:[json]});
if(process.exitCode)throw Error('Core benchmark failed');
if(JSON.stringify(sourceHashes)!==JSON.stringify(hashes()))throw Error('Benchmark sources changed during execution; rerun after freeze.');
const report=JSON.parse(readFileSync(json,'utf8'));
if(report.fixtureVersion!==3||report.cases.length!==57||report.cases.filter(c=>c.stressCase).length!==6||report.cases.filter(c=>c.filterComparison).length!==6)throw Error('Incomplete benchmark fixture');
report.comparison={retainedCases:51,addedFilterCases:6,note:'Compare identical case settings and source/runtime context. New cases must not be averaged into historical totals.'};
report.sourceHashes=sourceHashes;
report.runtime={node:process.version,platform:process.platform,arch:process.arch,compiler:'Emscripten 7.0.0 C++17 -O2'};
writeFileSync(json,JSON.stringify(report,null,2)+'\n');
console.log(`Measured ${report.cases.length} cases: ${json}`);
