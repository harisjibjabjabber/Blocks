export const HARMONICS_MODELS=['round','tube','fold'];
export const DEFAULT_HARMONICS=Object.freeze({model:'round',tone:0,dynamics:0,mix:1,outputDb:0});
export function normalizeHarmonicsFields(input){
 const n=input;if(!n||!HARMONICS_MODELS.includes(n.model))throw Error('Invalid Harmonics model');
 for(const[key,lo,hi]of[['tone',-1,1],['dynamics',0,1],['mix',0,1],['outputDb',-12,12]])if(!Number.isFinite(n[key])||n[key]<lo||n[key]>hi)throw Error('Invalid Harmonics '+key);
 return{model:n.model,tone:n.tone,dynamics:n.dynamics,mix:n.mix,outputDb:n.outputDb};
}
export function toCoreHarmonics(rack){return{version:1,entries:rack.audio.filter(b=>b.type==='harmonics').map(b=>({id:b.id,model:HARMONICS_MODELS.indexOf(b.model),tone:b.tone,dynamics:b.dynamics,mix:b.mix,output_db:b.outputDb}))};}
