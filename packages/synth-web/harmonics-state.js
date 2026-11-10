export const DEFAULT_HARMONICS=Object.freeze({model:'soft',tone:0,dynamics:0,mix:1,outputDb:0});
export function normalizeHarmonicsFields(input){
 const n={...DEFAULT_HARMONICS,...input};if(!['soft','asymmetric'].includes(n.model))throw Error('Invalid Harmonics model');
 for(const[key,lo,hi]of[['tone',-1,1],['dynamics',0,1],['mix',0,1],['outputDb',-12,12]])if(!Number.isFinite(n[key])||n[key]<lo||n[key]>hi)throw Error('Invalid Harmonics '+key);
 return{model:n.model,tone:n.tone,dynamics:n.dynamics,mix:n.mix,outputDb:n.outputDb};
}
export function toCoreHarmonics(rack){return{version:1,entries:rack.audio.filter(b=>b.type==='harmonics').map(b=>({id:b.id,model:b.model==='asymmetric'?1:0,tone:b.tone,dynamics:b.dynamics,mix:b.mix,output_db:b.outputDb}))};}
