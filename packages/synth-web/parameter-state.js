// ABI4 levels are authoritative; the old Balance parameter remains a shortcut.
export function canonicalLevels(values,previous){
 const next=[...values];if(next.length<23)return next;
 const levelsChanged=!previous||Math.abs(next[21]-previous[21])>1e-10||Math.abs(next[22]-previous[22])>1e-10;
 const balanceChanged=previous&&Math.abs(next[1]-previous[1])>1e-6;
 if(balanceChanged&&!levelsChanged){next[21]=1-next[1];next[22]=next[1];}
 const sum=next[21]+next[22];next[1]=sum>0?next[22]/sum:.5;
 return next;
}
export function parameterBatch(before,next){
 const ids=new Set(next.map((v,id)=>v!==before[id]?id:-1).filter(id=>id>=0));
 if(next.length>=23&&[1,21,22].some(id=>ids.has(id)))for(const id of [1,21,22])ids.add(id);
 return [...ids].sort((a,b)=>a-b).map(id=>({id,value:next[id]}));
}
