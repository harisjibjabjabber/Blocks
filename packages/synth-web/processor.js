// Thin reference host for the portable C ABI. No Blocks app imports.
// Prepare and allocate in initialization; audio rendering uses fixed buffers.
class BlocksSynthProcessor extends AudioWorkletProcessor {
  constructor(options){super();this.ready=false;this.queue=new Array(1024).fill(null);this.count=0;this.counter=0;this.peak=0;this.clipped=false;this.nonFinite=false;this.port.onmessage=e=>this.message(e.data);this.init(options.processorOptions.wasm).catch(e=>this.port.postMessage({kind:'error',message:String(e)}));}
  async init(bytes){const wasi={proc_exit:code=>{throw Error('WASM exit '+code);},fd_close:()=>0,fd_write:()=>0,fd_seek:()=>0};const {instance}=await WebAssembly.instantiate(bytes,{wasi_snapshot_preview1:wasi,env:{emscripten_notify_memory_growth:()=>{}}});this.api=instance.exports;this.api._initialize?.();this.synth=this.api.bs_create();if(!this.synth||!this.api.bs_prepare(this.synth,sampleRate))throw Error('Synth prepare failed');this.left=this.api.malloc(2048*4);this.right=this.api.malloc(2048*4);this.events=this.api.malloc(1024*24);this.patch=this.api.malloc(4+this.api.bs_parameter_count()*4);if(!this.left||!this.right||!this.events||!this.patch)throw Error('Audio buffer allocation failed');this.floats=new Float32Array(this.api.memory.buffer);this.view=new DataView(this.api.memory.buffer);const string=p=>{const b=new Uint8Array(this.api.memory.buffer);let value='';for(let i=p;i<b.length&&i<p+256&&b[i];i++)value+=String.fromCharCode(b[i]);return value;};const parameters=[];for(let id=0;id<this.api.bs_parameter_count();id++){const p=this.api.bs_parameter_info(id);parameters.push({id,name:string(this.view.getUint32(p+4,true)),unit:string(this.view.getUint32(p+8,true)),min:this.view.getFloat32(p+12,true),max:this.view.getFloat32(p+16,true),default:this.view.getFloat32(p+20,true),mapping:this.view.getUint32(p+24,true)});}this.parameters=parameters;this.ready=true;this.port.postMessage({kind:'ready',parameters,values:parameters.map(p=>this.api.bs_get_parameter(this.synth,p.id)),version:this.api.bs_abi_version()});}
  message(m){if(!this.ready)return;if(m.kind==='panic'){this.count=0;this.api.bs_panic(this.synth);return;}if(m.kind==='patch'){
      const n=this.parameters.length,version=this.api.bs_abi_version();
      const legacyCount=m.version===1?18:m.version===2?19:m.version===3?21:0;
      const legacy=version===4&&n===35&&legacyCount>0&&Array.isArray(m.values)&&m.values.length===legacyCount;
      const current=m.version===version&&Array.isArray(m.values)&&m.values.length===n;
      if((!legacy&&!current)||!m.values.every(Number.isFinite)){this.port.postMessage({kind:'error',message:'Invalid patch'});return;}
      // The core owns legacy defaults and Mix/level canonicalization. Validate
      // the full prefix before touching state, and never read beyond that prefix.
      this.view.setUint32(this.patch,m.version,true);
      for(let i=0;i<m.values.length;i++)this.view.setFloat32(this.patch+4+i*4,m.values[i],true);
      if(!this.api.bs_set_patch(this.synth,this.patch))this.port.postMessage({kind:'error',message:'Patch rejected'});
      else this.port.postMessage({kind:'patch',version,values:this.parameters.map(p=>this.api.bs_get_parameter(this.synth,p.id))});return;}
    if(m.kind==='parameter-batch'){
      if(!Array.isArray(m.values)||m.values.length===0||m.values.length>1024||this.count+m.values.length>1024||(m.frame!==undefined&&!Number.isFinite(m.frame))||!m.values.every(p=>p&&Number.isInteger(p.id)&&p.id>=0&&p.id<this.parameters.length&&Number.isFinite(p.value))){this.port.postMessage({kind:'error',message:'Invalid parameter batch or event queue capacity'});return;}
      // Validate all items/capacity before enqueueing any. Equal-frame insertion
      // is stable, so aliases and both independent levels apply before a sample.
      const frame=m.frame===undefined?currentFrame:Math.max(currentFrame,Math.round(m.frame));
      for(const parameter of m.values){let i=this.count;while(i>0&&this.queue[i-1].frame>frame){this.queue[i]=this.queue[i-1];i--;}this.queue[i]={frame,type:2,channel:0,key:0,parameter:parameter.id,value:parameter.value};this.count++;}
      return;
    }
    if(m.kind!=='event')return;if(this.count>=1024){this.count=0;this.api.bs_panic(this.synth);this.port.postMessage({kind:'error',message:'Event queue full; voices released'});return;}if(!Number.isInteger(m.type)||m.type<0||m.type>4||!Number.isFinite(m.value))return;const frame=Number.isFinite(m.frame)?Math.max(currentFrame,Math.round(m.frame)):currentFrame;let i=this.count;while(i>0&&this.queue[i-1].frame>frame){this.queue[i]=this.queue[i-1];i--;}this.queue[i]={frame,type:m.type,channel:m.channel>>>0,key:m.key>>>0,parameter:m.parameter>>>0,value:m.value};this.count++;}
  process(inputs,outputs){const out=outputs[0];if(!out?.length)return true;const frames=out[0].length;if(!this.ready||frames>2048){for(let ch=0;ch<out.length;ch++)out[ch].fill(0);return true;}let due=0;while(due<this.count&&this.queue[due].frame<currentFrame+frames){const e=this.queue[due],p=this.events+due*24;this.view.setUint32(p,Math.max(0,e.frame-currentFrame),true);this.view.setUint32(p+4,e.type,true);this.view.setUint32(p+8,e.channel,true);this.view.setUint32(p+12,e.key,true);this.view.setUint32(p+16,e.parameter,true);this.view.setFloat32(p+20,e.value,true);due++;}const result=this.api.bs_render(this.synth,this.left,this.right,frames,this.events,due);for(let i=due;i<this.count;i++)this.queue[i-due]=this.queue[i];for(let i=this.count-due;i<this.count;i++)this.queue[i]=null;this.count-=due;const l=this.left/4,r=this.right/4;for(let i=0;i<frames;i++){
      const left=this.floats[l+i],right=this.floats[r+i];out[0][i]=left;if(out.length>1)out[1][i]=right;
      // Measure copied output, not oscillator/drive saturation. Hold every block's
      // peak until telemetry is sent; no arrays or objects in this sample loop.
      const lp=Math.abs(left),rp=Math.abs(right);
      if(Number.isFinite(lp)){if(lp>this.peak)this.peak=lp;if(lp>=1)this.clipped=true;}else this.nonFinite=true;
      if(out.length>1){if(Number.isFinite(rp)){if(rp>this.peak)this.peak=rp;if(rp>=1)this.clipped=true;}else this.nonFinite=true;}
    }
    if(++this.counter%24===0){this.port.postMessage({kind:'status',voices:this.api.bs_active_voices(this.synth),invalid:result,peak:this.peak,clipped:this.clipped,nonFinite:this.nonFinite});this.peak=0;this.clipped=false;this.nonFinite=false;}return true;}
}
registerProcessor('blocks-synth',BlocksSynthProcessor);
