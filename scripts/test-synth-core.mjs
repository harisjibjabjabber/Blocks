import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.env.EMSDK) throw Error('Set EMSDK to Emscripten 7.0.0.');
const out=resolve(process.env.SYNTH_CORE_EVIDENCE||resolve(root,'../synth-core-evidence'));
mkdirSync(out,{recursive:true});
for(const [source,name,extra] of [['core_tests.cpp','core-tests',[]],['render_wav.cpp','render-wav',['-sNODERAWFS=1']]]) {
  const target=resolve(out,name+'.mjs');
  const result=spawnSync(process.env.PYTHON||'python',[
    resolve(process.env.EMSDK,'upstream/emscripten/em++.py'),
    resolve(root,'packages/synth-core/src/blocks_synth.cpp'),
    resolve(root,'packages/synth-core/tests',source),
    '-I'+resolve(root,'packages/synth-core/include'),'-std=c++17','-O2',
    '-Wall','-Wextra','-Wpedantic','-sENVIRONMENT=node','-sEXIT_RUNTIME=1',...extra,'-o',target
  ],{stdio:'inherit'});
  if(result.error) throw result.error;
  if(result.status) process.exit(result.status);
  const run=(await import(pathToFileURL(target).href)).default;
  await run({arguments:name==='render-wav'?[resolve(out,'wasm.wav')]:[]});
}
