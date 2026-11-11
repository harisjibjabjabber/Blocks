const neutral=Object.freeze({enabled:false,spinHz:4,motion:.65,grit:.35});
export const DEFAULT_OSC_BASS=Object.freeze({version:1,oscillators:Object.freeze([neutral,neutral])});
export function normalizeOscBass(input=DEFAULT_OSC_BASS){
 if(input?.version!==1||!Array.isArray(input.oscillators)||input.oscillators.length!==2)throw Error('Invalid oscillator Bass configuration');
 return{version:1,oscillators:input.oscillators.map(o=>{if(typeof o?.enabled!=='boolean')throw Error('Invalid oscillator Bass enabled');for(const[key,lo,hi]of[['spinHz',.1,20],['motion',0,1],['grit',0,1]])if(!Number.isFinite(o[key])||o[key]<lo||o[key]>hi)throw Error('Invalid oscillator Bass '+key);return{enabled:o.enabled,spinHz:o.spinHz,motion:o.motion,grit:o.grit};})};
}
export function toCoreOscBass(input){return{version:1,reserved:0,oscillators:normalizeOscBass(input).oscillators.map(o=>({enabled:Number(o.enabled),spin_hz:o.spinHz,motion:o.motion,grit:o.grit}))};}
