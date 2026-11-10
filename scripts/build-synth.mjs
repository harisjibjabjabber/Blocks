import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sdk=process.env.EMSDK;
if(!sdk)throw Error('Set EMSDK to an activated Emscripten SDK directory (tested: 7.0.0).');
const compiler=resolve(sdk,'upstream/emscripten/em++.py');
if(!existsSync(compiler))throw Error('Emscripten compiler not found: '+compiler);
const out=resolve(root,'packages/synth-web/build');mkdirSync(out,{recursive:true});
const exports=['malloc','free','bs_abi_version','bs_parameter_count','bs_parameter_info','bs_normalized_to_physical','bs_physical_to_normalized','bs_create','bs_destroy','bs_prepare','bs_reset','bs_set_parameter','bs_get_parameter','bs_get_patch','bs_set_patch','bs_note_on','bs_note_off','bs_sustain','bs_panic','bs_active_voices','bs_render','bs_default_performance','bs_set_performance','bs_get_performance','bs_performance_pending','bs_default_sauce','bs_set_sauce','bs_get_sauce','bs_default_modulation','bs_set_modulation','bs_get_modulation','bs_default_notes','bs_set_notes','bs_get_notes','bs_notes_pending_mask'];
const sources=readdirSync(resolve(root,'packages/synth-core/src')).filter(n=>n.endsWith('.cpp')).map(n=>resolve(root,'packages/synth-core/src',n));
const args=[compiler,...sources,'-I'+resolve(root,'packages/synth-core/include'),'-std=c++17','-O2','-fno-exceptions','-fno-rtti','--no-entry','-sSTANDALONE_WASM=1','-sALLOW_MEMORY_GROWTH=0','-sINITIAL_MEMORY=16777216','-sEXPORTED_FUNCTIONS='+JSON.stringify(exports.map(n=>'_'+n)),'-o',resolve(out,'synth.wasm')];
const result=spawnSync(process.env.PYTHON||'python',args,{stdio:'inherit',cwd:root});if(result.error)throw result.error;if(result.status)process.exit(result.status);
for(const name of ['index.html','host.js','processor.js','instrument-ui.js','recipes.js','patches.js','presets.js','envelope-scale.js','envelope-geometry.js','filter-response.js','peak-meter.js','parameter-state.js','performance-state.js','performance-ui.js','sauce-rack-ui.js','sauce-state.js','modulation-state.js','config-dial.js','lfo-ui.js','rack-editor.js','styles.css'])copyFileSync(resolve(root,'packages/synth-web',name),resolve(out,name));
mkdirSync(resolve(out,'fonts'),{recursive:true});
for(const [family,file] of [['Instrument Serif','InstrumentSerif-Regular.ttf'],['Inter Tight','InterTight-VariableFont_wght.ttf'],['Geist Mono','GeistMono-VariableFont_wght.ttf']]) {
  copyFileSync(resolve(root,'web/public/fonts',family,file),resolve(out,'fonts',file));
  copyFileSync(resolve(root,'web/public/fonts',family,'OFL.txt'),resolve(out,'fonts',family.replaceAll(' ','-')+'-OFL.txt'));
}
console.log('Standalone synth built: '+out);
