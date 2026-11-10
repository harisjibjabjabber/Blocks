export const MAX_UNISON=7;
export const DEFAULT_VOICING=Object.freeze({version:1,count:1,detune:0,spread:0});
export function normalizeVoicing(input=DEFAULT_VOICING){if(!input||input.version!==1||!Number.isInteger(input.count)||input.count<1||input.count>MAX_UNISON||!Number.isFinite(input.detune)||input.detune<0||input.detune>50||!Number.isFinite(input.spread)||input.spread<0||input.spread>1)throw Error('Invalid voicing configuration');return{version:1,count:input.count,detune:input.detune,spread:input.spread};}
export function toCoreVoicing(input){const v=normalizeVoicing(input);return{version:1,count:v.count,detune_cents:v.detune,spread:v.spread};}
