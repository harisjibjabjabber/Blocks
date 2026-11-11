import {normalizeSuite} from '../packages/synth-web/suite-state.js';
// Explicit complete CURRENT-format fixture construction for tests/examples.
// Runtime file import never fills missing sections with these defaults.
import {normalizePerformance} from '../packages/synth-web/performance-state.js';
import {normalizeRack,syncRackOrder} from '../packages/synth-web/sauce-state.js';
import {normalizeModulation} from '../packages/synth-web/modulation-state.js';
import {normalizeClock} from '../packages/synth-web/clock-state.js';
import {normalizeSub} from '../packages/synth-web/sub-state.js';
import {normalizeOscBass} from '../packages/synth-web/osc-bass-state.js';
import {normalizeVoicing} from '../packages/synth-web/voicing-state.js';
import {normalizeSound} from '../packages/synth-web/sound-state.js';
import {normalizeDelay} from '../packages/synth-web/delay-state.js';
import {normalizeFilterRouting} from '../packages/synth-web/filter-routing-state.js';
import {canonicalLevels} from '../packages/synth-web/parameter-state.js';
export function currentPatch(values,overrides={}){
 const clock=normalizeClock(overrides.clock),modulation=normalizeModulation(overrides.modulation);
 return{format:'blocks-synth-patch',version:7,values:canonicalLevels(values),stereoWidth:1,...overrides,performance:normalizePerformance({...normalizePerformance(),...overrides.performance,mode:'off',bpm:clock.bpm}),rack:syncRackOrder(normalizeRack(overrides.rack),modulation),modulation,clock,suite:normalizeSuite(overrides.suite),sub:normalizeSub(overrides.sub),oscBass:normalizeOscBass(overrides.oscBass),voicing:normalizeVoicing(overrides.voicing),sound:normalizeSound(overrides.sound),delay:normalizeDelay(overrides.delay),filterRouting:normalizeFilterRouting(overrides.filterRouting)};
}
