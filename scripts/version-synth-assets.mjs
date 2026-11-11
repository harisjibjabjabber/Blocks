import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

// One revision covers the whole module graph, worklet, WASM and styles. Updating
// only host.js still lets browsers reuse incompatible cached child modules.
export function versionSynthAssets(directory){
  const names=readdirSync(directory).filter(name=>/\.(?:js|css|wasm)$/.test(name)).sort();
  const hash=createHash('sha256');
  hash.update(readFileSync(join(directory,'index.html')));
  for(const name of names){hash.update(name);hash.update(readFileSync(join(directory,name)));}
  const revision=hash.digest('hex').slice(0,20);
  for(const name of names.filter(name=>name.endsWith('.js'))){
    const source=readFileSync(join(directory,name),'utf8');
    const versioned=source.replace(/(['"])(\.\/[^'"?\s]+\.(?:js|wasm))\1/g,(_,quote,path)=>`${quote}${path}?v=${revision}${quote}`);
    writeFileSync(join(directory,name),versioned);
  }
  const html=readFileSync(join(directory,'index.html'),'utf8').replace(/((?:src|href)=["'])(?:\.\/)?([^"'?\s]+\.(?:js|css))(["'])/g,(_,prefix,path,quote)=>`${prefix}./${path}?v=${revision}${quote}`);
  writeFileSync(join(directory,'index.html'),html);
  writeFileSync(join(directory,'build-version.json'),JSON.stringify({revision},null,2)+'\n');
  return revision;
}
