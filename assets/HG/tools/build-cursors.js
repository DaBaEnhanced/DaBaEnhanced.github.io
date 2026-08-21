'use strict';
// Build browser cursor PNGs from the original in-game mouse sprite sheet.
//
// Data/GameChip.dat/SpritesCD32.rexx clips 19 sprites from x=0 and another 19
// from x=32, each 32x16. ColdStartup.s positions them at mouse-(8,8), so the
// browser overlay uses hotspot 8,8.

const fs = require('fs');
const path = require('path');
const { decodeILBM } = require('./lib/iff');
const { encodePNG, indexedToRGBA } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');
const SRC = path.join(REPO, 'Data', 'GameChip.dat', 'Sprites.ilbm');

const SPRITE_W = 32;
const SPRITE_H = 16;
const SPRITE_COUNT = 19;
const HOTSPOT = { x: 8, y: 8 };

const NAMES = [
	'default',
	'forward',
	'backward',
	'turn-left',
	'turn-right',
	'activate',
	'pick-up',
	'drop',
	'wake',
	'info',
	'tab',
	'vdu-forward',
	'vdu-backward',
	'right-use',
	'left-unuse',
	'throw-1',
	'throw-2',
	'throw-3',
	'throw-4',
];

function crop(img, x0, y0) {
	const out = new Uint8Array(SPRITE_W * SPRITE_H);
	for (let y = 0; y < SPRITE_H; y++) {
		for (let x = 0; x < SPRITE_W; x++) {
			out[y * SPRITE_W + x] = img.pixels[(y0 + y) * img.width + (x0 + x)];
		}
	}
	return out;
}

function main() {
	const img = decodeILBM(fs.readFileSync(SRC));
	const palette = [...img.palette];
	const cursorDir = path.join(OUT, 'cursors');
	fs.mkdirSync(cursorDir, { recursive: true });

	const sets = [];
	for (let set = 0; set < 2; set++) {
		const files = [];
		for (let i = 0; i < SPRITE_COUNT; i++) {
			const pixels = crop(img, set * SPRITE_W, i * SPRITE_H);
			const rgba = indexedToRGBA(pixels, palette, 0);
			const file = `cursors/mouse${set}-${i}.png`;
			fs.writeFileSync(path.join(OUT, file), encodePNG(SPRITE_W, SPRITE_H, rgba));
			files.push(file);
		}
		sets.push({ index: set, files });
	}

	fs.writeFileSync(path.join(OUT, 'cursors.json'), JSON.stringify({
		source: 'Data/GameChip.dat/Sprites.ilbm',
		sourceBuild: 'Data/GameChip.dat/SpritesCD32.rexx',
		width: SPRITE_W,
		height: SPRITE_H,
		hotspot: HOTSPOT,
		names: NAMES,
		sets,
		comment: 'Sprite numbers match ColdStartup.s gadget tables. Set 0 is mouse0; set 1 is mouse1.',
	}, null, '\t'));

	console.log(`cursors: ${sets.length} sets x ${SPRITE_COUNT} sprites, ${SPRITE_W}x${SPRITE_H}`);
}

main();
