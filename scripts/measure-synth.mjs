import * as esbuild from "esbuild";
import { browserSession, delay } from "./browser-session.mjs";
import { writeFileSync } from "node:fs";
const audioPath = process.argv[2];

const bundled = await esbuild.build({ entryPoints: ["src/audio/web/instrument-rack.ts"], bundle: true, format: "iife", globalName: "Synth", write: false, platform: "browser" });
const html = `<!doctype html><meta charset="utf-8"><pre id="out">waiting</pre><script>${bundled.outputFiles[0].text}</script><script>
function rms(data,start,end) { let sum=0,n=0; for(let i=Math.floor(start*48000);i<Math.min(data.length,end*48000);i++){sum+=data[i]*data[i];n++;} return Math.sqrt(sum/Math.max(1,n)); }
async function render(id,envelope,options={}) {
 const context=new OfflineAudioContext(1,48000*7,48000), rack=new Synth.WebInstrumentRack(context);
 rack.configure('touch',id,envelope);
 const send=(time,kind,velocity=100,value=0)=>rack.play(time,{kind,channel:0,note:60,velocity,controller:64,value,source:'touch'});
 if(options.pedal) send(0,'cc',0,127);
 send(.1,'note-on',options.velocity??100);
 send(1.4,'note-off',0);
 if(options.pedal) send(2,'cc',0,0);
 if(options.stop) rack.cancelAll();
 const data=(await context.startRendering()).getChannelData(0);
 return { early:rms(data,.12,.16), attack:rms(data,.4,.5), sustain:rms(data,1.1,1.3), released:rms(data,2.5,3), pedal:rms(data,1.6,1.8), silence:rms(data,6,6.5), peak:Math.max(...data.slice(0,48000).map(Math.abs)) };
}
(async()=>{
 const pad='blocks.pad.warm.v1',ep='blocks.ep.fm.v1';
 const shape={attackMs:160,decayMs:1000,sustain:.72,releaseMs:700};
 const result={pad:await render(pad),ep:await render(ep),fast:await render(pad,{...shape,attackMs:2}),slow:await render(pad,{...shape,attackMs:1000}),quiet:await render(pad,shape,{velocity:35}),lowSustain:await render(pad,{...shape,decayMs:100,sustain:.05}),shortDecay:await render(pad,{...shape,decayMs:100,sustain:.2}),longDecay:await render(pad,{...shape,decayMs:2500,sustain:.2}),longRelease:await render(pad,{...shape,releaseMs:3500}),pedal:await render(pad,shape,{pedal:true}),stopped:await render(pad,shape,{stop:true})};
 if (${Boolean(audioPath)}) {
  const context=new OfflineAudioContext(1,48000*13,48000),rack=new Synth.WebInstrumentRack(context);
  rack.configure('replay:ep',ep);rack.configure('replay:pad',pad);
  for(const [source,offset] of [['replay:ep',0],['replay:pad',6]]) for(const [notes,start,end] of [[[60,64,67,71],.2,2.4],[[62,65,69,72],3.2,4.8]]) for(const note of notes) {
   rack.play(offset+start,{kind:'note-on',channel:0,note,velocity:96,controller:0,value:0,source});
   rack.play(offset+end,{kind:'note-off',channel:0,note,velocity:0,controller:0,value:0,source});
  }
  const data=(await context.startRendering()).getChannelData(0),bytes=new Uint8Array(44+data.length*2),view=new DataView(bytes.buffer);
  const str=(offset,s)=>{for(let i=0;i<s.length;i++)bytes[offset+i]=s.charCodeAt(i)};
  str(0,'RIFF');view.setUint32(4,bytes.length-8,true);str(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,48000,true);view.setUint32(28,96000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,data.length*2,true);
  for(let i=0;i<data.length;i++)view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,data[i]))*32767),true);
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));result.audio=btoa(binary);
 }
 document.getElementById('out').textContent=JSON.stringify(result);
})().catch(error=>document.getElementById('out').textContent='ERR '+error.stack);
</script>`;
const browser = await browserSession(); let text = "waiting";
try {
  await browser.navigate("data:text/html;charset=utf-8," + encodeURIComponent(html));
  for (let i=0;i<120 && text==="waiting";i++) { await delay(100); text=await browser.evaluate("document.getElementById('out').textContent"); }
} finally { await browser.close(); }
const result=JSON.parse(text);
if(audioPath && result.audio) { writeFileSync(audioPath,Buffer.from(result.audio,'base64'));delete result.audio; }
console.log(JSON.stringify(result,null,2));
