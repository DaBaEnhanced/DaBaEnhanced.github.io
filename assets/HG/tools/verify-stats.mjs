// Smoke test for the source-faithful Stats pane (Drawviews.s:2027 window4).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IndexCompositor } from '../src/compositor.js';
import { PANE_H, PANE_W, SCREEN_W } from '../src/view.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..', 'assets');

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

const chars = JSON.parse(fs.readFileSync(path.join(ASSETS, 'characters.json'), 'utf8'));
const portraits = JSON.parse(fs.readFileSync(path.join(ASSETS, 'character-portraits.json'), 'utf8'));
const font = JSON.parse(fs.readFileSync(path.join(ASSETS, 'gamefont.json'), 'utf8'));
font.atlasData = {
	width: font.atlas.width,
	data: new Uint8Array(fs.readFileSync(path.join(ASSETS, font.atlas.file))),
};
const portraitAtlas = {
	width: portraits.atlas.width,
	height: portraits.atlas.height,
	data: new Uint8Array(fs.readFileSync(path.join(ASSETS, portraits.atlas.file))),
	characters: portraits.characters,
};

const player = {
	index: 0,
	direction: 0,
	character: chars.characters[0],
	stats: {
		fitness: 65535,
		physique: 152,
		agility: 150,
		experience: 12,
		weight: 7500,
	},
	poisonedStrength: 0,
	tooHeavy: false,
};

assert(fs.readFileSync(path.resolve(__dirname, '../src/main.js'), 'utf8')
	.includes('drawStatsBody'), 'drawStatsBody missing from main.js');

const r = new IndexCompositor();
r.clear();
const slot = portraits.characters[0].figures.front.slots[41];
assert(slot?.w === 32 && slot?.h === 64, 'stats body uses the 32x64 figure slot');
const rect = { ...slot, x: 0, y: 0 };
r.drawMaskedSolid(rect, portraitAtlas, 19, 25, 21);
r.drawMaskedSolid(rect, portraitAtlas, 18, 24, 20);
r.drawMaskedSolid(rect, portraitAtlas, 17, 23, 19);
r.drawIndexedSpriteClipped(rect, portraitAtlas, 16, 22, {
	x0: 0, y0: 0, x1: PANE_W, y1: PANE_H,
});

let c19 = 0, c20 = 0, c21 = 0, art = 0;
for (let y = 16; y < 90; y++) {
	for (let x = 10; x < 56; x++) {
		const v = r.indices[y * SCREEN_W + x];
		if (v === 19) c19++;
		else if (v === 20) c20++;
		else if (v === 21) c21++;
		else if (v) art++;
	}
}
assert(c19 > 10 && c20 > 10 && c21 > 10, `body outline colours missing ${c19}/${c20}/${c21}`);
assert(art > 50, 'figure art pass missing');

r.clear();
r.drawText(font, 'Clavius', 55, 20, 2);
r.drawText(font, '   99', 111, 41, 9);
let name = 0, poison = 0;
for (let i = 0; i < r.indices.length; i++) {
	if (r.indices[i] === 2) name++;
	if (r.indices[i] === 9) poison++;
}
assert(name > 10, 'name colour 2 not drawn');
assert(poison > 10, 'poisoned fitness colour 9 not drawn');

assert(player.character.className === 'Pilot', 'class phrase mapping');
assert(player.character.raceName === 'Humanoid', 'race phrase mapping');
assert(player.character.genderName === 'n/a', 'gender phrase mapping');
	assert(Math.floor(65535 / 655) === 100, 'fitness ITOA divisor');

console.log(`stats smoke: body outline ${c21}/${c20}/${c19}, figure ${art}, name/poison colours ok`);
