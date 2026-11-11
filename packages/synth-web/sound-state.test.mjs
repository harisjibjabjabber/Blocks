import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeSound,DEFAULT_SOUND,toCoreSound} from './sound-state.js';
test('Studio is the only source and current sound roundtrips',()=>{assert.deepEqual(normalizeSound(),DEFAULT_SOUND);const s={...DEFAULT_SOUND,filterModel:'ladder',filterDrive:3.2};assert.deepEqual(toCoreSound(s),{version:1,oscillator:1,filter_model:1,filter_drive:3.2});assert.deepEqual(normalizeSound(JSON.parse(JSON.stringify(s))),s);});
test('old or malformed sound configurations reject',()=>{for(const patch of [{version:2},{oscillator:'legacy'},{filterModel:'moog'},{filterDrive:0},{filterDrive:13},{filterDrive:NaN}])assert.throws(()=>normalizeSound({...DEFAULT_SOUND,...patch}));assert.throws(()=>normalizeSound(null));});
