// Patch versions describe physical parameter arrays, never transient voices.
import {canonicalLevels} from './parameter-state.js';
const counts = new Map([[1,18],[2,19],[3,21],[4,35],[5,40]]);
export function migratePatch(patch, parameters, engineVersion) {
  const count = counts.get(patch?.version);
  if (patch?.format !== 'blocks-synth-patch' || !count || patch.version > engineVersion ||
      !Array.isArray(patch.values) || patch.values.length !== count ||
      !patch.values.every(Number.isFinite) || counts.get(engineVersion) !== parameters.length) {
    throw new Error('Unsupported or invalid patch');
  }
  // Missing parameters use engine defaults; legacy pitch response stays manual.
  const next=parameters.map((p,id) => {
    const raw=id<count?patch.values[id]:p.default;
    const value=Math.max(p.min,Math.min(p.max,raw));
    return p.mapping===2?Math.round(value):value;
  });
  if(next.length>=23&&count<=21){next[21]=1-next[1];next[22]=next[1];}
  if(patch.version<5&&next.length>=36)next[35]=0;
  return canonicalLevels(next);
}
