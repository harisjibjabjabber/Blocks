// Patch versions describe physical parameter arrays, never transient voices.
const counts = new Map([[1,18],[2,19],[3,21]]);
export function migratePatch(patch, parameters, engineVersion) {
  const count = counts.get(patch?.version);
  if (patch?.format !== 'blocks-synth-patch' || !count || patch.version > engineVersion ||
      !Array.isArray(patch.values) || patch.values.length !== count ||
      !patch.values.every(Number.isFinite) || counts.get(engineVersion) !== parameters.length) {
    throw new Error('Unsupported or invalid patch');
  }
  // Missing parameters take their engine-defined defaults, preserving old sounds.
  return parameters.map((p,id) => {
    const raw=id<count?patch.values[id]:p.default;
    const value=Math.max(p.min,Math.min(p.max,raw));
    return p.mapping===2?Math.round(value):value;
  });
}
