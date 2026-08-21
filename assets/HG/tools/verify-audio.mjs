// Smoke test for SFX tables, Paula playback rates, and OGG music assets.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	ATMOS_PLAY, EX_SFX, MISC_SFX, PAULA_CLOCK, locationMusicKey, playbackRate,
} from '../src/audio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..', 'assets');

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

assert(MISC_SFX.length === 10, 'misc table is 1-based with 9 clips');
assert(EX_SFX[17] === 'Unlock' && EX_SFX[19] === 'GunFire1', 'extra sfx indices');
assert(ATMOS_PLAY.length === 8, '8 atmos slots');
assert(locationMusicKey(0) === null && locationMusicKey(3) === 'Static03', 'map music keys');
assert(Math.abs(playbackRate(428, 8000) - (PAULA_CLOCK / 428) / 8000) < 1e-9, 'paula rate');

const sfx = JSON.parse(fs.readFileSync(path.join(ASSETS, 'audio', 'sfx.json'), 'utf8'));
assert(sfx.sfx.length >= 61, `expected 61 sfx, got ${sfx.sfx.length}`);
for (const rec of ['Footstep', 'DoorOpening', 'Atmos00', 'GunFire1']) {
	assert(sfx.sfx.some((s) => s.key === rec), `missing ${rec}`);
}

const music = JSON.parse(fs.readFileSync(path.join(ASSETS, 'music', 'music.json'), 'utf8'));
assert(music.modules.length === 11, `expected 11 modules, got ${music.modules.length}`);
for (const m of music.modules) {
	assert(m.ogg, `${m.key} has no ogg`);
	const file = path.join(ASSETS, m.ogg.replace(/^music\//, 'music/'));
	assert(fs.existsSync(file), `missing ${m.ogg}`);
	assert(fs.statSync(file).size > 1000, `${m.key} ogg too small`);
}

console.log(`audio smoke: ${sfx.sfx.length} wav, ${music.modules.length} ogg, paula/tables ok`);
