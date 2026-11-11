export const DEFAULT_CLOCK=Object.freeze({version:1,bpm:120,beatsPerBar:4});
export function normalizeClock(input=DEFAULT_CLOCK){if(input?.version!==1||!Number.isFinite(input.bpm)||input.bpm<40||input.bpm>240||!Number.isInteger(input.beatsPerBar)||input.beatsPerBar<1||input.beatsPerBar>16)throw Error('Invalid global clock');return{version:1,bpm:input.bpm,beatsPerBar:input.beatsPerBar};}
export function toCoreClock(input){const c=normalizeClock(input);return{version:1,bpm:c.bpm,beats_per_bar:c.beatsPerBar};}
