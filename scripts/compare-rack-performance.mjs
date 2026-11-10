import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const flags=Object.fromEntries(process.argv.slice(2).map(arg=>{const m=/^--(before|after|out|suite)=(.+)$/.exec(arg);if(!m)throw Error('Usage: compare-rack-performance.mjs --before=core-path [--after=core-path] [--out=path] [--suite=standard|prefix]');return[m[1],m[2]];}));
if(!flags.before)throw Error('--before must identify an immutable src/include snapshot');
const out=resolve(flags.out||resolve(root,'../synth-headroom-timing'));mkdirSync(out,{recursive:true});
const order=['before','after','after','before'],runs=[];
for(const [i,variant]of order.entries()){
 const directory=resolve(out,variant+'-'+(i+1));
 const result=spawnSync(process.execPath,[resolve(root,'scripts/benchmark-synth.mjs'),'--core='+resolve(root,variant==='before'?flags.before:flags.after||'packages/synth-core'),'--out='+directory,'--suite='+(flags.suite||'standard')],{stdio:'inherit',cwd:root});
 if(result.error)throw result.error;if(result.status)process.exit(result.status);
 const report=JSON.parse(readFileSync(resolve(directory,'benchmark.json'),'utf8'));runs.push({variant,directory,report});
}
const timingKeys=new Set(['renderMsPerAudioSecond','blockMsP50','blockMsP95','blockMsP99','blockMsMax','configurationMsTotal','transitionBlockMsP50','transitionBlockMsP95','transitionBlockMsP99','transitionBlockMsMax']);
const settings=c=>Object.fromEntries(Object.entries(c).filter(([k])=>!timingKeys.has(k)));
const first=runs[0].report;
for(const variant of ['before','after']){const group=runs.filter(r=>r.variant===variant);if(group.some(r=>JSON.stringify(r.report.sourceHashes)!==JSON.stringify(group[0].report.sourceHashes)))throw Error('Sources changed between '+variant+' runs');}
for(const run of runs){if(run.report.cases.length!==first.cases.length||JSON.stringify(run.report.runtime)!==JSON.stringify(first.runtime))throw Error('Incomparable runtime or case count');for(let i=0;i<first.cases.length;i++)if(JSON.stringify(settings(run.report.cases[i]))!==JSON.stringify(settings(first.cases[i])))throw Error('Case settings/observed voice mismatch at '+i);}
const median=xs=>{const s=[...xs].sort((a,b)=>a-b),n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;};
const metrics=['renderMsPerAudioSecond','blockMsP50','blockMsP95','blockMsP99','blockMsMax','configurationMsTotal','transitionBlockMsP50','transitionBlockMsP95','transitionBlockMsP99','transitionBlockMsMax'];
const cases=first.cases.map((c,i)=>{const summary={settings:settings(c),before:{},after:{}};for(const variant of ['before','after'])for(const metric of metrics){const values=runs.filter(r=>r.variant===variant).map(r=>r.report.cases[i][metric]).filter(Number.isFinite);if(values.length)summary[variant][metric]={runs:values,median:median(values),min:Math.min(...values),max:Math.max(...values)};}summary.p99ReductionPercent=(1-summary.after.blockMsP99.median/summary.before.blockMsP99.median)*100;return summary;});
const report={suite:flags.suite||'standard',kind:'Balanced warmed offline before/after timing; not device validation',order,caseCount:cases.length,audioBlockBudgetMs:first.audioBlockBudgetMs,runtime:first.runtime,runs:runs.map(r=>({variant:r.variant,directory:r.directory,sourceHashes:r.report.sourceHashes})),cases,limits:'Two runs per variant in B/C/C/B order; each case retains its own warmup and three measured audio seconds. Report all runs and medians, not the best result. Scheduling can affect tails. Same case settings and observed voices are required; no phone/latency/thermal guarantee.'};
writeFileSync(resolve(out,'comparison.json'),JSON.stringify(report,null,2)+'\n');console.log('Comparison: '+resolve(out,'comparison.json'));
