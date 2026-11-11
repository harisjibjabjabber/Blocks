import {normalizeEnvelopes,hydrateEnvelopes} from '../packages/synth-web/envelope-state.js';
import {normalizeTuning,hydrateTuning} from '../packages/synth-web/tuning-state.js';
import {normalizeFilterBank,hydrateFilterBank} from '../packages/synth-web/filter-bank-state.js';
import {normalizeReverb} from '../packages/synth-web/reverb-state.js';
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
 const tone=canonicalLevels(values),clock=normalizeClock(overrides.clock),modulation=normalizeModulation(overrides.modulation),sub=normalizeSub(overrides.sub),sound=normalizeSound(overrides.sound),filterRouting=normalizeFilterRouting(overrides.filterRouting);
 const tuning=hydrateTuning(normalizeTuning(overrides.tuning),sub);if(!overrides.tuning)tuning.oscillators[1].fineCents=tone[2];tone[2]=0;
 return{...overrides,format:'blocks-synth-patch',version:7,values:tone,envelopes:hydrateEnvelopes(normalizeEnvelopes(overrides.envelopes),tone),tuning,filterBank:hydrateFilterBank(normalizeFilterBank(overrides.filterBank),tone,sound,filterRouting),stereoWidth:overrides.stereoWidth??1,performance:normalizePerformance({...normalizePerformance(),...overrides.performance,mode:'off',bpm:clock.bpm}),rack:syncRackOrder(normalizeRack(overrides.rack),modulation),modulation,clock,suite:normalizeSuite(overrides.suite),sub,oscBass:normalizeOscBass(overrides.oscBass),voicing:normalizeVoicing(overrides.voicing),sound,delay:normalizeDelay(overrides.delay),reverb:normalizeReverb(overrides.reverb),filterRouting};
}
