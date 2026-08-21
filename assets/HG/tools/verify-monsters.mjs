// Smoke test for the task #21 monster runtime slice.
//
// This deliberately uses real extracted maps and data. It proves immediate eggs
// hatch into active monsters, their map cells are stamped as block 8-15, map 21
// Gargoyles have imported art, and movement does not leave duplicate live bodies
// behind in the cell layer.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	createMonsterState, initialiseMonsterHatches, moveMonsters, activeMonsters,
	stampMonsters, damageMonsterFitness,
} from '../src/monsters.js';
import { mapMonsterNumbers, patchStyleMonsters } from '../src/monster-graphics.js';
import { LEVEL_CELLS, cellIndex, buildDrawList } from '../src/view.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..', 'assets');
const mapsDir = path.join(ASSETS, 'maps');
const defs = JSON.parse(fs.readFileSync(path.join(ASSETS, 'monsters.json'), 'utf8'));
const tables = JSON.parse(fs.readFileSync(path.join(ASSETS, 'viewtables.json'), 'utf8'));
const gfx = JSON.parse(fs.readFileSync(path.join(ASSETS, 'monster-graphics.json'), 'utf8'));
const gfxAtlas = {
	width: gfx.atlas.width,
	height: gfx.atlas.height,
	data: new Uint8Array(fs.readFileSync(path.join(ASSETS, gfx.atlas.file))),
};

const BLOCK_HERE = 2;
const AUX_HERE = 1 << 5;
const FLOOR_HERE = 1;
const FLOOR_SHIFT = 9;
const blockType = (cell) => (cell >>> 11) & 0x3f;
const auxType = (cell) => (cell >>> 28) & 0xf;
const liveMonsterBlock = (cell) => {
	const t = blockType(cell);
	return (cell & BLOCK_HERE) && t >= 8 && t <= 15;
};

function loadMap(key) {
	const map = JSON.parse(fs.readFileSync(path.join(mapsDir, `${key}.json`), 'utf8'));
	const raw = fs.readFileSync(path.join(ASSETS, map.cells.file));
	const words = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
	const n = map.cells.cellsPerLayer;
	return {
		map,
		cells: new Uint32Array(words.subarray(0, n)),
		seen: new Uint32Array(words.subarray(n, n * 2)),
		items: new Uint32Array(words.subarray(n * 2, n * 3)),
	};
}

const styleCache = new Map();
function loadStyle(n) {
	if (styleCache.has(n)) return styleCache.get(n);
	const style = JSON.parse(fs.readFileSync(path.join(ASSETS, `style${n}.json`), 'utf8'));
	styleCache.set(n, style);
	return style;
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

assert(defs.monsters?.[0]?.bravery === 2500, 'monster record alignment: Leahdile bravery');
assert(defs.monsters?.[0]?.sample === 13, 'monster record alignment: Leahdile sample');
assert(defs.monsters?.[0]?.samplePeriod === 380, 'monster record alignment: Leahdile sample period');
assert(defs.monsters?.[0]?.stunnable === 1, 'monster record alignment: Leahdile stunnable flag');
assert(defs.monsters?.[76]?.monsterNumber === 20, 'monster record alignment: Gargoyle number');
assert(defs.monsters?.[76]?.speed === 5, 'monster record alignment: Gargoyle speed');

function monsterRecord(number) {
	return gfx.monsters.find((m) => m.number === number);
}

function collectMapMonsterNumbers(map, cells, seen) {
	const needed = new Set();
	const list = defs.monsters || defs;
	for (let i = 0; i < cells.length; i++) {
		if (!(cells[i] & AUX_HERE) || auxType(cells[i]) !== 0) continue;
		const hatchTime = seen[i] >>> 20;
		if (hatchTime === 4093 || hatchTime === 4095) continue;
		const type = (seen[i] >>> 12) & 0xff;
		const number = list[type]?.monsterNumber | 0;
		if (number) needed.add(number);
	}
	for (const m of map.monsters || []) {
		const number = list[m.type]?.monsterNumber | 0;
		if (number) needed.add(number);
	}
	return needed;
}

function validateAllMapGraphics() {
	const errors = [];
	let checked = 0;
	const files = fs.readdirSync(mapsDir).filter((f) => f.endsWith('.json')).sort();
	for (const file of files) {
		const key = file.slice(0, -5);
		const meta = JSON.parse(fs.readFileSync(path.join(mapsDir, file), 'utf8'));
		if (!meta?.cells?.file) continue;
		const { map, cells, seen } = loadMap(key);
		checked++;
		const slotNumbers = mapMonsterNumbers(map, cells, seen, defs);
		for (const number of slotNumbers) {
			if (!number) continue;
			const rec = monsterRecord(number);
			if (!rec?.parts?.front?.slots?.some(Boolean)) {
				errors.push(`${key}: monster ${number} has no imported front art`);
			}
		}
		for (const number of collectMapMonsterNumbers(map, cells, seen)) {
			if (number === 20 && slotNumbers[0] !== 20) {
				errors.push(`${key}: Monster20 stamps slot 1 but slot 1 art is ${slotNumbers[0]}`);
			} else if (number !== 20 && number !== slotNumbers[0] && number !== slotNumbers[1]) {
				errors.push(`${key}: monster ${number} missing from locn monster slots ${slotNumbers}`);
			}
		}
	}
	assert(errors.length === 0, `monster map graphics coverage failed:\n${errors.join('\n')}`);
	return checked;
}

function checkMap(key, player) {
	const { map, cells, seen, items } = loadMap(key);
	const state = createMonsterState(map, defs);
	stampMonsters(state, cells);
	initialiseMonsterHatches(state, cells, seen, items);
	const monsters = activeMonsters(state);
	assert(monsters.length > 0, `${key}: no monsters hatched`);
	for (const m of monsters) {
		assert(liveMonsterBlock(cells[m.cell]), `${key}: monster ${m.index} not stamped at ${m.cell}`);
	}

	const beforeLiveBlocks = cells.reduce((n, c) => n + (liveMonsterBlock(c) ? 1 : 0), 0);
	for (let i = 0; i < 120; i++) {
		moveMonsters(state, cells, items, [player], 10, {});
	}
	const active = activeMonsters(state);
	const occupied = new Set(active.map((m) => m.cell));
	const afterLiveBlocks = cells.reduce((n, c) => n + (liveMonsterBlock(c) ? 1 : 0), 0);
	assert(occupied.size === active.length, `${key}: two active monsters share a cell`);
	assert(afterLiveBlocks === active.length,
		`${key}: live block count ${afterLiveBlocks} != active monsters ${active.length}`);
	assert(beforeLiveBlocks >= monsters.length, `${key}: unexpected initial live block count`);
	return active.length;
}

{
	const { map, cells, seen, items } = loadMap('01-ArtificialIsland');
	const state = createMonsterState(map, defs);
	initialiseMonsterHatches(state, cells, seen, items);
	assert(state.random !== 0x1234, 'add_monster should advance the RNG even though facing stays north');
}

const artificial = checkMap('01-ArtificialIsland', { x: 8, y: 11, floor: 11, active: true });
const spaceport = checkMap('21-Spaceport', { x: 12, y: 12, floor: 3, active: true });
const checkedMaps = validateAllMapGraphics();
const gargoyle = monsterRecord(20);
assert(gargoyle?.parts?.front?.slots?.some(Boolean), 'Monster20/Gargoyle front art missing');
assert(gargoyle.sourceKind === 'rawBigBob', `Monster20 source kind ${gargoyle.sourceKind}`);
assert(gargoyle.source === 'Monsters/Bob/20_gargoyle.bob', `Monster20 source ${gargoyle.source}`);
assert(gargoyle.parts.front.slots[61]?.w === 64, 'Monster20 near slot width should be big BOB width 64');
assert(gargoyle.parts.front.slots[61]?.h === 128, 'Monster20 near slot height should be two-high 128');
assert(gargoyle.parts.attack?.slots?.[0]?.h === 128, 'Monster20 attack BOB should be two-high 128');
assert(monsterRecord(1).parts.attack?.slots?.[0]?.h === 64, 'normal monster attack BOB missing');

{
	const { map, cells, seen } = loadMap('21-Spaceport');
	const nums = mapMonsterNumbers(map, cells, seen, defs);
	assert(nums[0] === 20 && nums[1] === 0, `21-Spaceport monster numbers ${nums}`);
	const style = JSON.parse(fs.readFileSync(path.join(ASSETS, `style${map.locn.style}.json`), 'utf8'));
	const styleAtlas = {
		width: style.atlas.width,
		height: style.atlas.height,
		data: new Uint8Array(fs.readFileSync(path.join(ASSETS, style.atlas.file))),
	};
	const patched = patchStyleMonsters(style, styleAtlas, gfx, gfxAtlas, nums);
	assert(patched.style.graphics[13].present, 'Gargoyle front slot not patched');
	assert(patched.style.graphics[13].slots.some(Boolean), 'Gargoyle front slots empty');
	assert(patched.style.graphics[13].attack?.slot?.h === 128,
		'Gargoyle attack slot not patched into style 5 slot 1');
	assert(patched.atlas.height > styleAtlas.height, 'patched atlas did not grow');
}

{
	const state = { locnMons1: 1, locnMons2: 0 };
	const cells = new Uint32Array(LEVEL_CELLS * 2);
	const pos = cellIndex(6, 6, 1);
	cells[pos] = (FLOOR_HERE | (3 << FLOOR_SHIFT) | BLOCK_HERE | (8 << 11)) >>> 0;
	const monster = {
		active: true,
		cell: pos,
		fitness: 1,
		def: { monsterNumber: 1, physique: 1, stunnable: 0 },
	};
	damageMonsterFitness(state, cells, monster, 2);
	assert(!monster.active, 'monster did not die in puddle-cell test');
	assert(auxType(cells[pos]) === 14, 'dead monster aux was not stamped over puddle floor');
	const seen = new Uint32Array(cells.length);
	const items = new Uint32Array(cells.length);
	const style = loadStyle(2);
	const styleAtlas = {
		width: style.atlas.width,
		height: style.atlas.height,
		data: new Uint8Array(fs.readFileSync(path.join(ASSETS, style.atlas.file))),
	};
	const patched = patchStyleMonsters(style, styleAtlas, gfx, gfxAtlas, [1, 0]);
	const deadSlots = patched.style.graphics[46].slots.filter(Boolean);
	const list = buildDrawList({
		cells, seen, items,
		x: 6, y: 7, floor: 1, direction: 0,
		tables, style: patched.style,
	});
	assert(list.some((s) => deadSlots.some((d) =>
		d.ax === s.ax && d.ay === s.ay && d.w === s.w && d.h === s.h)),
		'dead monster aux did not emit monster1dead draw-list sprite');
}

console.log(`monster smoke: 01=${artificial} active, 21=${spaceport} active, ${checkedMaps} maps covered, Monster20 art present`);
