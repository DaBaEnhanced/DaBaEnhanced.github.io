// Smoke test for activate_planes player solids (Drawviews.s:3563).

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { BLOCK, putHeadInMap } from '../src/movement.js';
import {
	LEVEL_CELLS, MAP_HEIGHT, MAP_WIDTH, cellIndex, buildDrawList, playerSolidColour,
} from '../src/view.js';
import { IndexCompositor } from '../src/compositor.js';
import { LIGHT_OFFSET } from '../src/view.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const R = require('./lib/viewrender.js');
const ASSETS = path.resolve(__dirname, '..', 'assets');

const tables = JSON.parse(fs.readFileSync(path.join(ASSETS, 'viewtables.json'), 'utf8'));
const style = JSON.parse(fs.readFileSync(path.join(ASSETS, 'style2.json'), 'utf8'));
const chars = JSON.parse(fs.readFileSync(path.join(ASSETS, 'character-portraits.json'), 'utf8'));
const charAtlas = {
	width: chars.atlas.width,
	data: new Uint8Array(fs.readFileSync(path.join(ASSETS, chars.atlas.file))),
	characters: chars.characters,
};

const FLOOR_HERE = 1;
const FLOOR_SHIFT = 9;
const LIGHT_BIT = 31;
const floorCell = FLOOR_HERE | (3 << FLOOR_SHIFT);

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

assert(playerSolidColour([{ spellShield: 86 }], 0) === 6, 'shield is colour 6');
assert(playerSolidColour([{ fireWhite: true }], 0) === 1, 'hit flash is colour 1');
assert(playerSolidColour([{ spellShield: 86, fireWhite: true }], 0) === 6, 'shield wins over flash');
assert(playerSolidColour([{ fireWhite: true }], 4) === 1, 'keep_variant_player is 2 bits');

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

const viewer = { index: 0, x: 10, y: 10, floor: 2, direction: 0, headImages: BLOCK.PLAYER_FIRST };
const other = {
	index: 1, x: 10, y: 9, floor: 2, direction: 2,
	headImages: BLOCK.PLAYER_FIRST + 4, spellShield: 86, fireWhite: false,
};
putHeadInMap(cells, other);
assert(other.fireWhite === false, 'put_head_in_map must not clear fire_white');

const list = buildDrawList({
	cells, items,
	x: viewer.x, y: viewer.y, floor: viewer.floor, direction: viewer.direction,
	tables, style, party: [viewer, other],
});
const layer = list.find((s) => s.player !== undefined);
assert(layer, 'player figure was not emitted');
assert(layer.solid === 6, `expected shield solid 6, got ${layer.solid}`);

other.spellShield = 0;
other.fireWhite = true;
const flashList = buildDrawList({
	cells, items,
	x: viewer.x, y: viewer.y, floor: viewer.floor, direction: viewer.direction,
	tables, style, party: [viewer, other],
});
assert(flashList.find((s) => s.player !== undefined)?.solid === 1, 'fire_white solid 1');

const rect = chars.characters[1].figures.back.slots[layer.slot] ||
	chars.characters[1].figures.front.slots[layer.slot];
assert(rect, 'figure slot missing');

const comp = new IndexCompositor();
comp.clear();
comp.drawPlayerFigure({ ...layer, solid: 6, lit: true, slot: layer.slot }, charAtlas,
	0, 0, 142, 84);
let c38 = 0;
for (const v of comp.indices) if (v === 6 + LIGHT_OFFSET) c38++;
assert(c38 > 20, `lit shield colour ${6 + LIGHT_OFFSET} missing (${c38})`);

const renderArgs = {
	cells, items,
	base: cellIndex(viewer.x, viewer.y, viewer.floor),
	direction: viewer.direction,
	tables, style, atlas: { width: style.atlas.width, data: new Uint8Array(1) },
	players: { characters: chars.characters, selected: [0, 1, 2, 3] },
	playerAtlas: charAtlas,
	party: [viewer, other],
};
other.spellShield = 0;
other.fireWhite = true;
const flashed = R.renderView(renderArgs).pixels;
other.fireWhite = false;
const normal = R.renderView(renderArgs).pixels;
let changed = 0, whites = 0;
for (let i = 0; i < flashed.length; i++) {
	if (flashed[i] !== normal[i]) changed++;
	if (flashed[i] === 1 + LIGHT_OFFSET) whites++;
}
assert(changed > 20 && whites > 20, `oracle flash ${changed} diffs ${whites} lit-white`);

console.log(`player solids: shield=6 flash=1 lit-shield=${c38} lit-white=${whites}`);
