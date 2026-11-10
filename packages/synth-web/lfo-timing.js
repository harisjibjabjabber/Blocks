import {MOD_DIVISIONS} from './modulation-state.js';
import {configDial} from './config-dial.js';
export const LFO_DIVISION_ORDER=Object.keys(MOD_DIVISIONS).sort((a,b)=>{const beats=k=>4/MOD_DIVISIONS[k][0]*(MOD_DIVISIONS[k][1]?2/3:1);return beats(b)-beats(a);});
export function createLfoTimingDial({key,getSource,changeSource,...controls}){
  const count=LFO_DIVISION_ORDER.length-1;
  const dial=configDial({...controls,key,label:'Rate',getValue:()=>{const s=getSource();return s.synced?LFO_DIVISION_ORDER.indexOf(s.division)/count:Math.log(s.rate/.05)/Math.log(400);},
    change:(n,commit)=>{const s=getSource();changeSource(s.synced?{division:LFO_DIVISION_ORDER[Math.round(n*count)]}:{rate:.05*400**n},commit);},
    step:fine=>getSource().synced?1/count:fine?.001:.01,format:()=>{const s=getSource();return s.synced?s.division:Number(s.rate.toFixed(2))+' Hz';}});
  return{...dial,update:()=>{dial.setLabel(getSource().synced?'Division':'Rate');dial.update();dial.button.dataset.lfoTiming=getSource().synced?'division':'rate';dial.button.setAttribute('aria-valuetext',getSource().synced?getSource().division+' note division':Number(getSource().rate.toFixed(2))+' Hz');}};
}
