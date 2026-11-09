// Host-side macros only write existing physical parameters. No separate DSP state.
export const characterRecipe = Object.freeze({
  id: 'character', version: 1,
  targets: Object.freeze([
    Object.freeze({id:13, minimum:0, maximum:10}),
    Object.freeze({id:12, minimum:1, maximum:2.2}),
    Object.freeze({id:14, minimum:.1, maximum:.6}),
  ]),
});
const clamp = value => Math.max(0, Math.min(1, value));
export function applyRecipe(recipe, amount, values) {
  if (!Number.isFinite(amount)) throw new Error('Recipe amount must be finite');
  const next = [...values], n = clamp(amount);
  for (const target of recipe.targets) next[target.id] = target.minimum + n*(target.maximum-target.minimum);
  return next;
}
export function readRecipe(recipe, values) {
  const primary=recipe.targets[0];
  const amount=clamp((values[primary.id]-primary.minimum)/(primary.maximum-primary.minimum));
  const custom=recipe.targets.some(t=>Math.abs(values[t.id]-(t.minimum+amount*(t.maximum-t.minimum)))>.0001);
  return {amount,custom};
}
