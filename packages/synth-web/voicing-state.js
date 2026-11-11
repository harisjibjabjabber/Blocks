export const MAX_UNISON=7;
const neutral=Object.freeze({count:1,detune:0,spread:0});
export const DEFAULT_VOICING=Object.freeze({version:2,oscillators:Object.freeze([neutral,neutral])});
function oscillator(input){if(!input||!Number.isInteger(input.count)||input.count<1||input.count>MAX_UNISON||!Number.isFinite(input.detune)||input.detune<0||input.detune>50||!Number.isFinite(input.spread)||input.spread<0||input.spread>1)throw Error('Invalid voicing configuration');return{count:input.count,detune:input.detune,spread:input.spread};}
export function normalizeVoicing(input=DEFAULT_VOICING){
 if(input?.version===1)return{version:2,oscillators:[oscillator(input),oscillator(input)]};
 if(input?.version!==2||!Array.isArray(input.oscillators)||input.oscillators.length!==2)throw Error('Invalid voicing configuration');
 return{version:2,oscillators:input.oscillators.map(oscillator)};
}
export function toCoreVoicing(input){const v=normalizeVoicing(input);return{version:2,reserved:0,oscillators:v.oscillators.map(o=>({count:o.count,detune_cents:o.detune,spread:o.spread}))};}
