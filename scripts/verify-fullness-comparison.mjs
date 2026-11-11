import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=resolve(process.argv[2]||resolve(root,'../synth-fullness-after'));
const evidence=JSON.parse(readFileSync(resolve(directory,'index.json'),'utf8'));
const data=JSON.parse(readFileSync(resolve(directory,'measurements.json'),'utf8'));
if(data.cases.length!==180||evidence.comparisons.length!==180||evidence.legacyZeroMatches!==true)throw Error('Require complete two-order matrix and exact legacy Fullness0 fingerprint matches.');
for(const c of evidence.comparisons){
 if(![0,1].includes(c.order)||![1,4,12].includes(c.drive)||![0,.25,.5,.75,1].includes(c.fullness))throw Error('Unexpected case');
 // Intentional additive body may increase level; loss and excessive gain remain
 // bounded independently. These checks never accept the old9dB cancellation.
 for(const value of [c.acDb,c.fundamentalDb])if(!Number.isFinite(value)||value<-.15||value>6)throw Error('Body level/fundamental bound: '+JSON.stringify(c));
}
for(const c of data.cases)if(!Number.isFinite(c.metrics.peak)||c.metrics.peak>=1||!Number.isFinite(c.metrics.dc))throw Error('Nonfinite/clipped signal');
const bass=evidence.comparisons.find(c=>c.fixture==='detuned-bass'&&c.order===0&&c.drive===12&&c.fullness===1);
if(!bass||bass.acDb<2||bass.lowDb-bass.highDb<1)throw Error('High-Drive Fullness must produce measurable low-band colour, not just broadband gain.');
console.log('PASS180 actual-core Fullness cases: bounded growth/no loss, legacy0 identity, high-Drive low-band colour, finite headroom.');
