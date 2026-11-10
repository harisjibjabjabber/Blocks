// Host Init/reset policy. Legacy native defaults and explicitly saved patches stay intact.
const neutral={1:0,2:0,4:.005,6:1,7:.15,11:20000,12:1,13:0,15:0,18:0,21:1,22:0,24:0,32:0,34:0,40:0,42:0,43:0};
export const resetValue=p=>Object.hasOwn(neutral,p.id)?neutral[p.id]:p.default;
export const neutralValues=parameters=>parameters.map(resetValue);
