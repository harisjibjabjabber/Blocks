export const emptyPeak=()=>({maximum:0,clipped:false,nonFinite:false});
export function receivePeak(state,message){
 const peak=Number.isFinite(message.peak)&&message.peak>=0?message.peak:0;
 return {maximum:Math.max(state.maximum,peak),clipped:state.clipped||message.clipped===true||peak>=1,nonFinite:state.nonFinite||message.nonFinite===true};
}
export function peakDisplay(state){
 const level=state.maximum>1e-6?(20*Math.log10(state.maximum)).toFixed(1)+' dBFS':'—';
 return {state:state.clipped||state.nonFinite?'clip':state.maximum>=.98?'near':'normal',text:state.nonFinite?'Invalid audio':state.clipped?'Peak '+level+' · Clip':'Peak '+level};
}
