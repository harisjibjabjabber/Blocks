import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {versionSynthAssets} from './version-synth-assets.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
// Reject incorrectly encoded source before it can ship garbled labels.
const utf8=new TextDecoder('utf-8',{fatal:true});
for(const name of readdirSync(resolve(root,'packages/synth-web')).filter(n=>/\.(?:js|css|html)$/.test(n))){
 const path=resolve(root,'packages/synth-web',name),source=utf8.decode(readFileSync(path));
 if(/[\uFFFD\u00C2\u00C3\u00E2\u0080-\u009F]/u.test(source))throw Error('Suspect garbled text in '+path+'; repair the UTF-8 source before building.');
}
const sdk=process.env.EMSDK;
if(!sdk)throw Error('Set EMSDK to an activated Emscripten SDK directory (tested: 7.0.0).');
const compiler=resolve(sdk,'upstream/emscripten/em++.py');
if(!existsSync(compiler))throw Error('Emscripten compiler not found: '+compiler);
const out=resolve(root,'packages/synth-web/build');mkdirSync(out,{recursive:true});
// Remove the retired source-comparison UI from previously generated output.
const retiredSourceUI=resolve(out,'sound-ui.js');if(existsSync(retiredSourceUI))unlinkSync(retiredSourceUI);
const exports=['bs_sub_preview','bs_get_modulated_target_value','bs_default_envelopes','bs_set_envelopes','bs_get_envelopes','bs_get_envelope_value','bs_default_tuning','bs_set_tuning','bs_get_tuning','bs_default_filter_bank','bs_set_filter_bank','bs_get_filter_bank','bs_get_modulation_value','bs_modulation_target_info','bs_default_creative_fx','bs_default_creative_fx_block','bs_set_creative_fx','bs_get_creative_fx','bs_output_latency','bs_get_output_meters','bs_default_reverb','bs_set_reverb','bs_get_reverb','bs_get_reverb_scope','bs_default_osc_bass_v2','bs_set_osc_bass_v2','bs_get_osc_bass_v2','bs_osc_bass_preview_v2','bs_get_osc_bass_raw_phase','bs_get_osc_bass_rate','bs_osc_bass_warp_phase','bs_default_clock','bs_set_clock','bs_get_clock','bs_default_sub','bs_set_sub','bs_get_sub','bs_get_sub_note','bs_get_osc_bass_phase','bs_default_voicing_v2','bs_set_voicing_v2','bs_get_voicing_v2','bs_default_filter_routing','bs_set_filter_routing','bs_get_filter_routing','bs_default_sound','bs_set_sound','bs_get_sound','bs_default_harmonics_suite','bs_set_harmonics_suite','bs_get_harmonics_suite','bs_get_harmonics_suite_meters','bs_harmonics_suite_latency','bs_suite_colour_preview','bs_suite_dynamics_preview','malloc','free','bs_abi_version','bs_parameter_count','bs_parameter_info','bs_normalized_to_physical','bs_physical_to_normalized','bs_create','bs_destroy','bs_prepare','bs_reset','bs_set_parameter','bs_get_parameter','bs_get_patch','bs_set_patch','bs_note_on','bs_note_off','bs_sustain','bs_panic','bs_active_voices','bs_render','bs_default_performance','bs_set_performance','bs_get_performance','bs_performance_pending','bs_default_sauce','bs_set_sauce','bs_get_sauce','bs_get_modulation_phase','bs_default_modulation_v4','bs_set_modulation_v4','bs_get_modulation_v4','bs_set_stereo_width','bs_get_stereo_width','bs_default_delay','bs_set_delay','bs_get_delay','bs_default_notes','bs_set_notes','bs_get_notes','bs_notes_pending_mask'];
const sources=readdirSync(resolve(root,'packages/synth-core/src')).filter(n=>n.endsWith('.cpp')).map(n=>resolve(root,'packages/synth-core/src',n));
const args=[compiler,...sources,'-I'+resolve(root,'packages/synth-core/include'),'-std=c++17','-O2','-fno-exceptions','-fno-rtti','--no-entry','-sSTANDALONE_WASM=1','-sALLOW_MEMORY_GROWTH=0','-sABORTING_MALLOC=0','-sSTACK_SIZE=1048576','-sINITIAL_MEMORY=33554432','-sEXPORTED_FUNCTIONS='+JSON.stringify(exports.map(n=>'_'+n)),'-o',resolve(out,'synth.wasm')];
const result=spawnSync(process.env.PYTHON||'python',args,{stdio:'inherit',cwd:root});if(result.error)throw result.error;if(result.status)process.exit(result.status);
for(const name of ['envelope-state.js','tuning-state.js','filter-bank-state.js','modulation-targets.js','modulation-dock.js','modulation-interaction.js','modulation-envelope.js','filter-bank-ui.js','modulation-dock.css','clock-state.js','sub-state.js','sub-ui.js','osc-bass-state.js','osc-bass-ui.js','filter-routing-state.js','sound-state.js','sound-ui.css','suite-state.js','harmonics-ui.js','harmonics-ui.css','index.html','host.js','processor.js','instrument-ui.js','recipes.js','patches.js','presets.js','envelope-scale.js','envelope-geometry.js','filter-response.js','peak-meter.js','parameter-state.js','performance-state.js','performance-ui.js','sauce-rack-ui.js','sauce-state.js','modulation-state.js','voicing-state.js','delay-state.js','reverb-state.js','voicing-ui.js','output-ui.js','neutral-state.js','stereo-state.js','tap-gesture.js','config-dial.js','lfo-ui.js','lfo-curve.js','lfo-timing.js','rack-editor.js','styles.css','dial-reset.css','output-ui.css'])copyFileSync(resolve(root,'packages/synth-web',name),resolve(out,name));
copyFileSync(resolve(root,'packages/synth-core/THIRD_PARTY_NOTICES.txt'),resolve(out,'THIRD_PARTY_NOTICES.txt'));
mkdirSync(resolve(out,'fonts'),{recursive:true});
for(const [family,file] of [['Instrument Serif','InstrumentSerif-Regular.ttf'],['Inter Tight','InterTight-VariableFont_wght.ttf'],['Geist Mono','GeistMono-VariableFont_wght.ttf']]) {
  copyFileSync(resolve(root,'web/public/fonts',family,file),resolve(out,'fonts',file));
  copyFileSync(resolve(root,'web/public/fonts',family,'OFL.txt'),resolve(out,'fonts',family.replaceAll(' ','-')+'-OFL.txt'));
}
console.log('Standalone synth built: '+out+' (revision '+versionSynthAssets(out)+')');
mkdirSync(resolve(out,'examples'),{recursive:true});
for(const name of readdirSync(resolve(root,'packages/synth-web/examples')))copyFileSync(resolve(root,'packages/synth-web/examples',name),resolve(out,'examples',name));
