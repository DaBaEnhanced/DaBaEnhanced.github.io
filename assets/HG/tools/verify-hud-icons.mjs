// Smoke test for source HUD icon/message BOB extraction and compositor paths.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IndexCompositor } from '../src/compositor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..', 'assets');

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function loadAtlas(meta, base) {
	return {
		width: meta.atlas.width,
		height: meta.atlas.height,
		data: new Uint8Array(fs.readFileSync(path.join(base, meta.atlas.file))),
	};
}

function countNonZero(indices) {
	let count = 0;
	for (const v of indices) if (v) count++;
	return count;
}

const misc = JSON.parse(fs.readFileSync(path.join(ASSETS, 'misc-ui.json'), 'utf8'));
const atlas = loadAtlas(misc, ASSETS);

const required = [
	'icon_shield', 'icon_weights', 'icon_wings', 'icon_water', 'icon_immune',
	'locked', 'locked2', 'used',
	'noammo', 'noroom', 'heavy', 'drowning', 'poisoned', 'warning',
	'active', 'blocked', 'blocked2', 'invalid',
];

for (const key of required) {
	const rect = misc.sprites[key];
	assert(rect, `${key} missing from misc-ui.json`);
	assert(rect.mode === 'indexed', `${key} should be indexed`);
}

const r = new IndexCompositor();
let baseX = 0;
for (const key of ['icon_shield', 'icon_weights', 'icon_wings', 'icon_water', 'icon_immune']) {
	r.drawIndexedSprite(misc.sprites[key], atlas, baseX, 0);
	baseX -= 17;
}
r.drawIndexedSprite(misc.sprites.locked, atlas, -46, 23);
r.drawIndexedSprite(misc.sprites.used, atlas, -46, 23);
r.drawIndexedSprite(misc.sprites.noammo, atlas, 3, 26);
r.drawIndexedSprite(misc.sprites.drowning, atlas, 3, 43);
r.drawIndexedSprite(misc.sprites.blocked2, atlas, 3, 60);

assert(countNonZero(r.indices) > 300, 'HUD icon/message sprites did not render');

console.log(`hud smoke: ${required.length} source BOBs present and compositor draw paths checked`);
