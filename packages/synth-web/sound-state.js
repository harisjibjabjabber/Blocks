export const LEGACY_SOUND=Object.freeze({version:1,oscillator:'legacy',filterModel:'existing',filterDrive:1});
export const DEFAULT_SOUND=Object.freeze({...LEGACY_SOUND,oscillator:'studio'});
export function normalizeSound(input=DEFAULT_SOUND){
 if(!input||input.version!==1||!['legacy','studio'].includes(input.oscillator)||!['existing','ladder'].includes(input.filterModel)||!Number.isFinite(input.filterDrive)||input.filterDrive<1||input.filterDrive>12)throw Error('Invalid sound configuration');
 return{version:1,oscillator:input.oscillator,filterModel:input.filterModel,filterDrive:input.filterDrive};
}
export const soundForImportedPatch=patch=>normalizeSound(patch.sound===undefined?LEGACY_SOUND:patch.sound);
export function toCoreSound(input){const s=normalizeSound(input);return{version:1,oscillator:s.oscillator==='studio'?1:0,filter_model:s.filterModel==='ladder'?1:0,filter_drive:s.filterDrive};}
