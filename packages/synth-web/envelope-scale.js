const clamp=n=>Math.max(0,Math.min(1,n));
// Reserve most editing travel for the musically useful 30ms–2s range.
export function timeFromUnit(unit,min,max){
 const n=clamp(unit);
 if(n<=.15)return min+(.03-min)*n/.15;
 if(n<=.85)return .03*Math.pow(2/.03,(n-.15)/.7);
 return 2*Math.pow(max/2,(n-.85)/.15);
}
export function timeToUnit(seconds,min,max){
 const value=Math.max(min,Math.min(max,seconds));
 if(value<=.03)return .15*(value-min)/(.03-min);
 if(value<=2)return .15+.7*Math.log(value/.03)/Math.log(2/.03);
 return .85+.15*Math.log(value/2)/Math.log(max/2);
}
