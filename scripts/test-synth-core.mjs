import { spawnSync } from 'node:child_process';
import { mkdirSync,writeFileSync,appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.env.EMSDK) throw Error('Set EMSDK to Emscripten 7.0.0.');
const out=resolve(process.env.SYNTH_CORE_EVIDENCE||resolve(root,'../synth-core-evidence'));
mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'unison-benchmark.txt'),'');
let started=!process.env.SYNTH_CORE_FROM;
for(const [source,name,extra] of [['harmonics_suite_tests.cpp','harmonics-suite-tests',[]],['harmonics_suite_integration_tests.cpp','harmonics-suite-integration-tests',[]],['bass_expansion_tests.cpp','bass-expansion-tests',[]],['osc_bass_tests.cpp','osc-bass-tests',[]],['oscillator_voicing_tests.cpp','oscillator-voicing-tests',[]],['oscillator_routing_acceptance.cpp','oscillator-routing-acceptance',[]],['ladder_polyphase_tests.cpp','ladder-polyphase-tests',[]],['wave_source_tests.cpp','wave-source-tests',[]],['sound_quality_tests.cpp','sound-quality-tests',[]],['delay_tests.cpp','delay-tests',[]],['unison_tests.cpp','unison-tests',[]],['modulation_v3_tests.cpp','modulation-v3-tests',[]],['stereo_width_tests.cpp','stereo-width-tests',[]],['core_tests.cpp','core-tests',[]],['resonant_filter_tests.cpp','resonant-filter-tests',[]],['performance_tests.cpp','performance-tests',[]],['motion_response_tests.cpp','motion-response-tests',[]],['sauce_tests.cpp','sauce-tests',[]],['fullness_body_tests.cpp','fullness-body-tests',[]],['glide_tests.cpp','glide-tests',[]],['free_drift_tests.cpp','free-drift-tests',[]],['audio_rack_tests.cpp','audio-rack-tests',[]],['modulation_tests.cpp','modulation-tests',[]],['note_rack_tests.cpp','note-rack-tests',[]],['rack_host_tests.cpp','rack-host-tests',[]],['unison_benchmark.cpp','unison-benchmark',[]],['render_wav.cpp','render-wav',['-sNODERAWFS=1']]]) {
  if(!started){if(name!==process.env.SYNTH_CORE_FROM)continue;started=true;}
  if(process.env.SYNTH_FUNCTIONAL_ONLY==='1'&&(name==='unison-benchmark'||name==='render-wav'))continue;
  const target=resolve(out,name+'.mjs');
  const result=spawnSync(process.env.PYTHON||'python',[
    resolve(process.env.EMSDK,'upstream/emscripten/em++.py'),
    resolve(root,'packages/synth-core/src/blocks_synth.cpp'),
    resolve(root,'packages/synth-core/tests',source),
    '-I'+resolve(root,'packages/synth-core/include'),'-std=c++17','-O2',
    '-Wall','-Wextra','-Wpedantic','-sINITIAL_MEMORY=67108864','-sSTACK_SIZE=1048576','-sENVIRONMENT=node','-sEXIT_RUNTIME=1',...extra,'-o',target
  ],{stdio:'inherit'});
  if(result.error) throw result.error;
  if(result.status) process.exit(result.status);
  const run=(await import(pathToFileURL(target).href)).default;
  let exitStatus=0;
  await run({...(name==='unison-benchmark'?{print:line=>{console.log(line);appendFileSync(resolve(out,'unison-benchmark.txt'),line+'\n');}}:{}),arguments:name==='render-wav'?[resolve(out,'wasm.wav')]:[],onExit:status=>{exitStatus=status;}});
  // Emscripten resolves the module factory even when main calls exit(1).
  // Check now: loading another module can overwrite Node's process.exitCode.
  if(exitStatus!==0||process.exitCode)process.exit(exitStatus||process.exitCode);
}
