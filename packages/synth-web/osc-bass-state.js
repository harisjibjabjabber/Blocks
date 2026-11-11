export const BASS_VOICES=['rotor','growl','throat','fray'];
const neutral=Object.freeze({enabled:false,voice:'rotor',synced:false,retrigger:false,spinHz:4,motion:.65,grit:.35,cycleBeats:1,curl:0});
export const DEFAULT_OSC_BASS=Object.freeze({version:2,oscillators:Object.freeze([neutral,neutral])});
export function normalizeOscBass(input=DEFAULT_OSC_BASS){
 if(input?.version!==2||!Array.isArray(input.oscillators)||input.oscillators.length!==2)throw Error('Invalid oscillator Bass configuration');
 return{version:2,oscillators:input.oscillators.map(entry=>{const o=entry;if(!o||!BASS_VOICES.includes(o.voice)||['enabled','synced','retrigger'].some(k=>typeof o[k]!=='boolean'))throw Error('Invalid oscillator Bass mode');for(const[key,lo,hi]of[['spinHz',.1,20],['motion',0,1],['grit',0,1],['cycleBeats',.03125,64],['curl',-.8,.8]])if(!Number.isFinite(o[key])||o[key]<lo||o[key]>hi)throw Error('Invalid oscillator Bass '+key);return Object.fromEntries(Object.keys(neutral).map(k=>[k,o[k]]));})};
}
export function toCoreOscBass(input){return{version:2,reserved:0,oscillators:normalizeOscBass(input).oscillators.map(o=>({enabled:Number(o.enabled),voice:BASS_VOICES.indexOf(o.voice),synced:Number(o.synced),retrigger:Number(o.retrigger),spin_hz:o.spinHz,motion:o.motion,grit:o.grit,cycle_beats:o.cycleBeats,curl:o.curl}))};}
export function bassDivisions(beatsPerBar=4){const entries=[['4 bars',beatsPerBar*4],['2 bars',beatsPerBar*2],['1 bar',beatsPerBar]];for(const d of[2,4,8,16,32,64,128])for(const[suffix,factor]of[['',1],['T',2/3],['D',1.5]]){const beats=4/d*factor;if(beats>=.03125)entries.push(['1/'+d+suffix,beats]);}return entries.filter((v,i,a)=>v[1]<=64&&a.findIndex(x=>Math.abs(x[1]-v[1])<1e-8)===i).sort((a,b)=>b[1]-a[1]);}
