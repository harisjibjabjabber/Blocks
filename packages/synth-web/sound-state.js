export const DEFAULT_SOUND=Object.freeze({version:1,oscillator:'studio',filterModel:'existing',filterDrive:1});
export function normalizeSound(input=DEFAULT_SOUND){
 if(!input||input.version!==1||input.oscillator!=='studio'||!['existing','ladder'].includes(input.filterModel)||!Number.isFinite(input.filterDrive)||input.filterDrive<1||input.filterDrive>12)throw Error('Invalid sound configuration');
 return{version:1,oscillator:'studio',filterModel:input.filterModel,filterDrive:input.filterDrive};
}
export function toCoreSound(input){const s=normalizeSound(input);return{version:1,oscillator:1,filter_model:s.filterModel==='ladder'?1:0,filter_drive:s.filterDrive};}
