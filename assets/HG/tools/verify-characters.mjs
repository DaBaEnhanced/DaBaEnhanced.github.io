// Smoke test for character face/figure assets and visible party members.

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { BLOCK, putHeadInMap } from '../src/movement.js';
import { LEVEL_CELLS, MAP_HEIGHT, MAP_WIDTH, cellIndex, buildDrawList } from '../src/view.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const R = require('./lib/viewrender.js');
const ASSETS = path.resolve(__dirname, '..', 'assets');

const tables = JSON.parse(fs.readFileSync(path.join(ASSETS, 'viewtables.json'), 'utf8'));
const style = JSON.parse(fs.readFileSync(path.join(ASSETS, 'style2.json'), 'utf8'));
const styleAtlas = {
	width: style.atlas.width,
	data: new Uint8Array(fs.readFileSync(path.join(ASSETS, style.atlas.file))),
};
const chars = JSON.parse(fs.readFileSync(path.join(ASSETS, 'character-portraits.json'), 'utf8'));
const charAtlas = {
	width: chars.atlas.width,
	data: new Uint8Array(fs.readFileSync(path.join(ASSETS, chars.atlas.file))),
};

const FLOOR_HERE = 1;
const FLOOR_SHIFT = 9;
const LIGHT_BIT = 31;
const floorCell = FLOOR_HERE | (3 << FLOOR_SHIFT);

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

assert(chars.count === 12, `character count ${chars.count}`);
for (let i = 0; i < 4; i++) {
	const c = chars.characters[i];
	assert(c?.faces?.view?.w === 48 && c?.faces?.tab?.h === 10,
		`character ${i} face slots missing`);
	for (const part of ['front', 'left', 'right', 'back']) {
		const slot = c?.figures?.[part]?.slots?.[61];
		assert(slot?.w === 32 && slot?.h === 64,
			`character ${i} ${part} near figure slot missing`);
	}
}

const cells = new Uint32Array(LEVEL_CELLS * MAP_HEIGHT);
const items = new Uint32Array(cells.length);
for (let z = 0; z < MAP_HEIGHT; z++) {
	for (let y = 0; y < MAP_WIDTH; y++) {
		for (let x = 0; x < MAP_WIDTH; x++) {
			cells[cellIndex(x, y, z)] = floorCell;
			items[cellIndex(x, y, z)] = 1 << LIGHT_BIT;
		}
	}
}

const player1 = { index: 0, x: 10, y: 10, floor: 2, direction: 0,
	headImages: BLOCK.PLAYER_FIRST };
const player2 = { index: 1, x: 10, y: 9, floor: 2, direction: 2,
	headImages: BLOCK.PLAYER_FIRST + 4 };
putHeadInMap(cells, player2);

const list = buildDrawList({
	cells, items,
	x: player1.x, y: player1.y, floor: player1.floor, direction: player1.direction,
	tables, style,
});
const layer = list.find((s) => s.player !== undefined);
assert(layer, 'player figure was not emitted in draw list');
assert((layer.player >> 2) === 1, `expected player 2 block, got ${layer.player}`);

const part = ['front', 'left', 'right', 'back'][layer.player & 3];
const rect = chars.characters[1].figures[part].slots[layer.slot];
assert(rect?.ax !== undefined && rect?.ay !== undefined,
	`player 2 ${part} slot ${layer.slot} has no atlas rect`);

const renderArgs = {
	cells, items,
	base: cellIndex(player1.x, player1.y, player1.floor),
	direction: player1.direction,
	tables, style, atlas: styleAtlas,
	players: {
		characters: chars.characters,
		selected: [0, 1, 2, 3],
	},
};
const withPlayer = R.renderView({ ...renderArgs, playerAtlas: charAtlas }).pixels;
const withoutPlayer = R.renderView({ ...renderArgs, playerAtlas: null }).pixels;
let diff = 0;
for (let i = 0; i < withPlayer.length; i++) {
	if (withPlayer[i] !== withoutPlayer[i]) diff++;
}
assert(diff > 0, 'player atlas did not change rendered pixels');

console.log(`character smoke: player 2 ${part} slot ${layer.slot} emitted from ${chars.characters[1].name}, ${diff} pixels drawn`);
