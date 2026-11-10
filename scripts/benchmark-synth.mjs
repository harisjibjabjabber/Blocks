import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.env.EMSDK)throw Error('Set EMSDK to Emscripten 7.0.0.');
const flags=Object.fromEntries(process.argv.slice(2).map(arg=>{const match=/^--(core|out|suite)=(.+)$/.exec(arg);if(!match)throw Error('Usage: benchmark-synth.mjs [--core=path] [--out=path] [--suite=standard|prefix]');return[match[1],match[2]];}));
const core=resolve(root,flags.core||'packages/synth-core');
const suite=flags.suite||'standard';if(!['standard','prefix'].includes(suite))throw Error('Unknown benchmark suite');
const fixture=resolve(root,'packages/synth-core/tests',suite==='prefix'?'rack_prefix_benchmark.cpp':'benchmark_core.cpp');
const out=resolve(flags.out||process.env.SYNTH_BENCHMARK_DIR||resolve(root,'../synth-benchmark'));
mkdirSync(out,{recursive:true});
const target=resolve(out,'benchmark.mjs'),json=resolve(out,'benchmark.json');
const sourceFiles=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(resolve(dir,e.name)):/\.(?:h|hpp|cpp)$/.test(e.name)?[resolve(dir,e.name)]:[]).sort();
const paths=[...sourceFiles(resolve(core,'src')),...sourceFiles(resolve(core,'include')),fixture,fileURLToPath(import.meta.url)];
const hashes=()=>paths.map(path=>({path:relative(root,path).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
const sourceHashes=hashes();

const compile=spawnSync(process.env.PYTHON||'python',[
  resolve(process.env.EMSDK,'upstream/emscripten/em++.py'),resolve(core,'src/blocks_synth.cpp'),
  fixture,'-I'+resolve(core,'include'),'-std=c++17','-O2',
  '-Wall','-Wextra','-Wpedantic','-sSTACK_SIZE=1048576','-sENVIRONMENT=node','-sEXIT_RUNTIME=1','-sNODERAWFS=1','-o',target,
],{stdio:'inherit'});
if(compile.error)throw compile.error;if(compile.status)process.exit(compile.status);
await(await import(pathToFileURL(target).href)).default({arguments:[json]});
if(process.exitCode)throw Error('Core benchmark failed');
if(JSON.stringify(sourceHashes)!==JSON.stringify(hashes()))throw Error('Benchmark sources changed during execution; rerun after freeze.');
const report=JSON.parse(readFileSync(json,'utf8'));
if(suite==='standard'&&(report.fixtureVersion!==3||report.cases.length!==57||report.cases.filter(c=>c.stressCase).length!==6||report.cases.filter(c=>c.filterComparison).length!==6))throw Error('Incomplete benchmark fixture');
if(suite==='prefix'&&(report.fixtureVersion!==1||report.cases.length!==12||report.cases.some(c=>c.observedBlockEndVoices<16||c.transitionBlockCount!==54)))throw Error('Incomplete focused prefix fixture');
report.suite=suite;
report.comparison=suite==='standard'?{retainedCases:51,addedFilterCases:6,note:'Compare identical case settings and source/runtime context. New cases must not be averaged into historical totals.'}:{focusedCases:12,customPrefixes:[0,8,15],note:'Additional focused suite; the standard57 workloads remain unchanged. Transition-window timings are separate.'};
report.sourceHashes=sourceHashes;
report.coreSourceRoot=relative(root,core).replaceAll('\\','/');
report.runtime={node:process.version,platform:process.platform,arch:process.arch,compiler:'Emscripten 7.0.0 C++17 -O2'};
writeFileSync(json,JSON.stringify(report,null,2)+'\n');
console.log(`Measured ${report.cases.length} cases: ${json}`);
