import fs from 'node:fs';
const bytes=fs.readFileSync('packages/synth-web/build/synth.wasm');
const {instance}=await WebAssembly.instantiate(bytes,{wasi_snapshot_preview1:{proc_exit:c=>{throw Error('exit '+c)},fd_close:()=>0,fd_write:()=>0,fd_seek:()=>0},env:{emscripten_notify_memory_growth:()=>{}}});
const a=instance.exports;a._initialize?.();const rows=[];
for(let wave=0;wave<5;wave++)for(const key of[36,60,84,96]){
 const render=mode=>{const s=a.bs_create();if(!s||!a.bs_prepare(s,48000))throw Error('prepare');
  for(const[id,value]of[[0,.3],[3,.5],[4,.001],[5,.1],[6,1],[7,.02],[11,20000],[12,1],[13,0],[15,0],[18,0],[19,wave],[21,.25],[22,0],[23,0],[24,0],[32,0],[34,0],[35,0],[36,0],[39,0]])if(!a.bs_set_parameter(s,id,value))throw Error('param');
  const c=a.malloc(16),v=new DataView(a.memory.buffer);v.setUint32(c,1,true);v.setUint32(c+4,mode,true);v.setUint32(c+8,0,true);v.setFloat32(c+12,1,true);if(!a.bs_set_sound(s,c)||!a.bs_get_sound(s,c)||v.getUint32(c+4,true)!==mode)throw Error('source readback');a.bs_reset(s);a.bs_note_on(s,0,key,1);
  const l=a.malloc(65536*4),r=a.malloc(65536*4);if(a.bs_render(s,l,r,8192,0,0))throw Error('warmup');if(a.bs_render(s,l,r,65536,0,0))throw Error('render');const result=new Float32Array(a.memory.buffer,l,65536).slice();a.free(l);a.free(r);a.free(c);a.bs_destroy(s);return result;};
 const legacy=render(0),studio=render(1);let energy=0,error=0,peak=0,different=0;for(let i=0;i<legacy.length;i++){energy+=legacy[i]**2;const d=studio[i]-legacy[i];error+=d*d;peak=Math.max(peak,Math.abs(d));different+=d!==0;}
 const row={wave:['Sine','Triangle','Saw','Pulse','Square'][wave],midi:key,sourceReadback:true,differentSamples:different,relativeDifferenceDb:error?10*Math.log10(error/energy):null,maximumSampleDelta:peak};rows.push(row);console.log(row.wave,key,different,row.relativeDifferenceDb?.toFixed(2)??'exact',peak.toExponential(3));
 if(wave===0&&different)throw Error('sine changed');if(wave>0&&different===0)throw Error('source selector has no actual audio effect');
}
fs.writeFileSync(process.env.SYNTH_SOURCE_AUDIT||'../source-switch-live-audit.json',JSON.stringify({host:'actual built standalone synth.wasm,48000Hz,dry filterMix0,Drive/Fullness off,oneOsc level.25',rows},null,2));
