// Smoke test for source-style water startup.
//
// Main.s runs force_move_water inside the #19*23 startup dbf loop before the
// game screen is shown. This catches maps that would otherwise start with their
// authored water_level at 0 and only visibly fill after several seconds.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWaterState, initialiseWater, moveWater } from '../src/worldfx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..', 'assets');
const mapsDir = path.join(ASSETS, 'maps');

const WATER_HERE = 1 << 2;
const FLOWING_BIT = 11;

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function loadMap(key) {
	const map = JSON.parse(fs.readFileSync(path.join(mapsDir, `${key}.json`), 'utf8'));
	const raw = fs.readFileSync(path.join(ASSETS, map.cells.file));
	const words = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
	const n = map.cells.cellsPerLayer;
	return {
		map,
		cells: new Uint32Array(words.subarray(0, n)),
		seen: new Uint32Array(words.subarray(n, n * 2)),
	};
}

function waterCells(cells) {
	let n = 0;
	for (const c of cells) if (c & WATER_HERE) n++;
	return n;
}

function flowingCells(seen) {
	let n = 0;
	for (const c of seen) if ((c >>> FLOWING_BIT) & 1) n++;
	return n;
}

const files = fs.readdirSync(mapsDir).filter((f) => f.endsWith('.json')).sort();
const seeded = [];

for (const file of files) {
	const key = file.slice(0, -5);
	const meta = JSON.parse(fs.readFileSync(path.join(mapsDir, file), 'utf8'));
	if (!meta?.cells?.file) continue;
	const { map, cells, seen } = loadMap(key);
	if (!map.water?.speed || !flowingCells(seen)) continue;

	const before = waterCells(cells);
	const state = createWaterState(map.water);
	const changed = initialiseWater(state, cells, seen);
	const after = waterCells(cells);
	assert(changed, `${key}: startup water did not touch any cells`);
	assert(state.count === 0, `${key}: startup force_move_water should reset water_count`);
	seeded.push({ key, before, after, level: state.level, speed: state.speed });

	if (state.speed === 99) {
		const still = moveWater(state, cells, seen, 999);
		assert(!still, `${key}: speed 99 water moved after startup seeding`);
	}
}

const map07 = seeded.find((s) => s.key === '07-AbandonedDepot');
assert(map07, '07-AbandonedDepot moving-water map not found');
assert(map07.after > map07.before, `07-AbandonedDepot water did not fill (${map07.before} -> ${map07.after})`);

console.log(`water smoke: ${seeded.length} moving maps seeded, 07 ${map07.before}->${map07.after} water cells at level ${map07.level}`);
