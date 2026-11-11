// Reproduce a stale long-lived module cache in a disposable browser and origin.
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {resolve,dirname,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserSession,delay} from './browser-session.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const build=resolve(root,'packages/synth-web/build'),out=resolve(process.env.SYNTH_PROOF_DIR||'../synth-cache-evidence');mkdirSync(out,{recursive:true});
const {revision}=JSON.parse(readFileSync(resolve(build,'build-version.json'),'utf8'));
if(!revision)throw Error('Build must include a revision before cache regression runs');
const previous='previous-cached-build',stalePaths=['/instrument-ui.js','/instrument-ui.js?v='+previous];
const stale=`// blocks-stale-cache-regression\nexport function createInstrumentUI(){}\nconst oldPanel=document.getElementById('old-shared-voicing-panel');oldPanel.className='voicing-panel';`;
const seed=`<!doctype html><meta charset="utf-8"><title>Cache regression seed</title><script type="module">window.seedErrors=[];await Promise.all(${JSON.stringify(stalePaths)}.map(url=>import(url).catch(error=>window.seedErrors.push(error.message))));window.seedDone=true;</script>`;
const requests=[],checks=[];let phase='seed',b,failure;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.json':'application/json','.ttf':'font/ttf'};
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');requests.push({phase,url:req.url});
 if(url.pathname==='/seed'||url.pathname==='/cache-probe'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(seed);return;}
 if(phase==='seed'&&stalePaths.includes(req.url)){res.writeHead(200,{'Content-Type':mime['.js'],'Cache-Control':'public, max-age=31536000, immutable'});res.end(stale);return;}
 const path=resolve(build,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 try{if(!path.startsWith(build+sep)||!statSync(path).isFile())throw Error('Not a file');res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':extname(path)==='.html'?'no-store':'public, max-age=31536000, immutable'});res.end(readFileSync(path));}
 catch{res.writeHead(404,{'Cache-Control':'no-store'});res.end('Not found');}
});
await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
const url='http://127.0.0.1:'+server.address().port+'/';
const check=(value,name)=>{if(!value)throw Error(name);checks.push(name);console.log('PASS',name);};
const wait=async expression=>{for(let i=0;i<100;i++){if(await b.evaluate(expression))return;await delay(100);}throw Error('Timed out: '+expression);};
try{
 b=await browserSession();await b.send('Network.enable');await b.send('Network.setCacheDisabled',{cacheDisabled:false});
 await b.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await b.navigate(url+'seed');await wait('window.seedDone===true');
 check(await b.evaluate(`window.seedErrors.length===2&&window.seedErrors.every(e=>e.includes('null')&&e.includes('className'))`),'Seeded stale unversioned and previous-version modules reproduce null className startup error');
 check(stalePaths.every(path=>requests.filter(r=>r.url===path).length===1),'Both stale modules were served with long-lived cache headers');
 phase='probe';await b.navigate(url+'cache-probe');await wait('window.seedDone===true');
 check(await b.evaluate(`window.seedErrors.length===2&&window.seedErrors.every(e=>e.includes('className'))`),'New document still loads stale modules from its HTTP cache');
 check(stalePaths.every(path=>requests.filter(r=>r.url===path).length===1),'Stale modules stay cached even after server switches to current source');
 phase='actual';await b.navigate(url);await wait(`!!document.querySelector('[data-control="voicing:1:count"]')`);
 check(await b.evaluate(`document.querySelectorAll('.oscillator-unison').length===2&&document.querySelector('#error').textContent===''`),'Current versioned app boots both independent unison panels over the stale cache');
 check(await b.evaluate(`[...document.querySelectorAll('script[src],link[rel=stylesheet]')].every(e=>new URL(e.src||e.href).searchParams.get('v')===${JSON.stringify(revision)})`),'HTML entry script and all stylesheets reference the same build revision');
 for(const module of['envelope','character','drop','lfo','tone']){
  await b.evaluate(`document.querySelector('#module-tabs [data-module="${module}"]').click()`);
  check(await b.evaluate(`document.querySelector('.instrument').dataset.module===${JSON.stringify(module)}&&document.querySelector('#error').textContent===''`),'Cached-session module switch works: '+module);
 }
 await b.evaluate(`document.querySelector('#start').click()`);await wait(`document.querySelector('#status').textContent.includes('running')`);
 check(await b.evaluate(`document.querySelector('#error').textContent===''`),'Versioned worklet and WASM start successfully with stale browser cache present');
 await b.evaluate(`document.querySelector('#stop').click()`);await wait(`document.querySelector('#status').textContent==='Sound stopped'`);check(true,'Audio stops cleanly after cached-session startup');
 const assets=requests.filter(r=>r.phase==='actual'&&/\.(?:js|css|wasm)$/.test(new URL(r.url,url).pathname));
 check(assets.length>15&&assets.every(r=>new URL(r.url,url).searchParams.get('v')===revision),'Every requested module, stylesheet, worklet and WASM shares the current revision');
 check(assets.some(r=>new URL(r.url,url).pathname==='/processor.js')&&assets.some(r=>new URL(r.url,url).pathname==='/synth.wasm'),'Actual worklet and WASM versioned requests observed');
 check(!b.exceptions.length,'No uncaught exceptions in seeded-cache recovery');
 await b.screenshot(resolve(out,'cache-recovered-tone.png'));
}catch(error){failure=error;}finally{
 try{writeFileSync(resolve(out,'cache-proof-report.json'),JSON.stringify({revision,checks,requests,failure:failure?String(failure):null,exceptions:b?.exceptions||[]},null,2));}
 finally{if(b)await b.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
}
if(failure)throw failure;
