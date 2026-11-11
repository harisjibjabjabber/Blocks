export const DEFAULT_FILTER_ROUTING=Object.freeze({version:1,osc1:true,osc2:true});
export function normalizeFilterRouting(input=DEFAULT_FILTER_ROUTING){
 if(input?.version!==1||typeof input.osc1!=='boolean'||typeof input.osc2!=='boolean')throw Error('Invalid filter routing');
 return{version:1,osc1:input.osc1,osc2:input.osc2};
}
export function toCoreFilterRouting(input){const r=normalizeFilterRouting(input);return{version:1,mask:(r.osc1?1:0)|(r.osc2?2:0)};}
