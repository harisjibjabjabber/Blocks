export const REVERB_TYPES=Object.freeze(['plate','hall','shimmer']);
// UI name, native name, minimum, maximum; floats occupy offsets12..64.
export const REVERB_FIELDS=Object.freeze([
 ['predelay','predelay_seconds',0,.25],['decay','decay_seconds',.2,30],
 ['size','size',.5,2],['diffusion','diffusion',0,1],['lowCut','lowcut_hz',20,2000],
 ['damping','damping_hz',200,20000],['modRate','mod_rate_hz',.05,2],
 ['modDepth','mod_depth',0,1],['shimmer','shimmer',0,1],['mix','wet',0,1],
 ['outputDb','output_db',-24,12],['shimmerSemitones','shimmer_semitones',-12,12],['wetWidth','wet_width',0,2],['ducking','ducking',0,1],
].map(Object.freeze));
export const DEFAULT_REVERB=Object.freeze({version:2,enabled:false,type:'plate',predelay:.015,decay:2.5,size:1,diffusion:.75,lowCut:120,damping:7000,modRate:.3,modDepth:.2,shimmer:.35,mix:.25,outputDb:0,shimmerSemitones:12,wetWidth:1,ducking:0});
export function normalizeReverb(input=DEFAULT_REVERB){
 if(!input||input.version!==2||typeof input.enabled!=='boolean'||!REVERB_TYPES.includes(input.type))throw Error('Invalid reverb configuration');
 const result={version:2,enabled:input.enabled,type:input.type};
 for(const[key,,min,max]of REVERB_FIELDS){if(!Number.isFinite(input[key])||input[key]<min||input[key]>max)throw Error('Invalid reverb '+key);result[key]=input[key];}
 return result;
}
export function toCoreReverb(input){const c=normalizeReverb(input);return{version:2,enabled:Number(c.enabled),mode:REVERB_TYPES.indexOf(c.type),...Object.fromEntries(REVERB_FIELDS.map(([key,native])=>[native,c[key]]))};}
