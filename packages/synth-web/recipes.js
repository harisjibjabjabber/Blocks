// Host-side macros only write existing physical parameters. No separate DSP state.
export const motionRecipe = Object.freeze({
  id: 'motion', version: 4,
  targets: Object.freeze([
    Object.freeze({id:13,minimum:0,maximum:120,points:Object.freeze([[0,0],[.6,4.8],[.85,40],[1,120]].map(Object.freeze))}),
    Object.freeze({id:32,minimum:0,maximum:60,points:Object.freeze([[0,0],[.6,1.2],[.85,12],[1,60]].map(Object.freeze))}),
    Object.freeze({id:33,minimum:.18,maximum:.18}),
    Object.freeze({id:34,minimum:0,maximum:.85}),
    Object.freeze({id:35,minimum:1,maximum:1}),
  ]),
});
export const characterRecipe=Object.freeze({id:'character',version:5,targets:Object.freeze([Object.freeze({id:12,minimum:1,maximum:2.2})])});
const clamp = value => Math.max(0, Math.min(1, value));
function mapped(target,n){
 if(!target.points)return target.minimum+n*(target.maximum-target.minimum);
 const points=target.points;
 for(let i=1;i<points.length;i++)if(n<=points[i][0]){const [x0,y0]=points[i-1],[x1,y1]=points[i];return y0+(y1-y0)*(n-x0)/(x1-x0);}
 return target.maximum;
}
function inverse(target,value){
 if(!target.points)return clamp((value-target.minimum)/(target.maximum-target.minimum));
 const points=target.points;
 for(let i=1;i<points.length;i++)if(value<=points[i][1]){const [x0,y0]=points[i-1],[x1,y1]=points[i];return clamp(x0+(x1-x0)*(value-y0)/(y1-y0));}
 return 1;
}
export function applyRecipe(recipe, amount, values) {
  if (!Number.isFinite(amount)) throw new Error('Recipe amount must be finite');
  const next = [...values], n = clamp(amount);
  for (const target of recipe.targets) next[target.id] = mapped(target,n);
  return next;
}
export function readRecipe(recipe, values) {
  const primary=recipe.targets[0];
  const amount=inverse(primary,values[primary.id]);
  const custom=recipe.targets.some(t=>Math.abs(values[t.id]-mapped(t,amount))>.0001);
  return {amount,custom};
}
