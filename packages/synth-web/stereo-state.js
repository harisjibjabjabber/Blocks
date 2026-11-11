export const DEFAULT_STEREO_WIDTH=1;
export function normalizeStereoWidth(value=DEFAULT_STEREO_WIDTH){if(!Number.isFinite(value)||value<0||value>2)throw Error('Stereo Width must be between0 and2');return value;}
