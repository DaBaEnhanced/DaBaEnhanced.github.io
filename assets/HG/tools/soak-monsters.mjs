// Soak: run the whole world loop over every map and look for monsters whose
// record and map stamp have come apart.
//
// A monster block with no active record at that cell is inert and invulnerable:
// moveMonsters only walks records, and damageMonsterAtCell looks the record up
// BY CELL. A record whose x/y/floor disagree with its own cell is the other
// half of the same failure -- findClosestPlayer works in x/y/floor, so a stale
// one stops finding targets and the monster stands still forever.
//
//   node tools/soak-monsters.mjs [map] [ticks]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	createMonsterState, stampMonsters, initialiseMonsterHatches, hatchEggs,
	moveMonsters, monstersFall, activeMonsters, monsterAtCell,
} from '../src/monsters.js';
import { createLiftState, moveLifts } from '../src/lifts.js';
import { createDoorState, moveDoors } from '../src/doors.js';
import { createPushableState, blocksFall } from '../src/pushables.js';
import { createWaterState, initialiseWater, moveWater } from '../src/worldfx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS = path.join(__dirname, '..', 'assets', 'maps');
const W = 23, D = 23, LEVEL = W * D;

const defs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'monsters.json'), 'utf8'));
const isMonsterBlock = (v) => (v & 2) && ((v >>> 11) & 0x3f) >= 8 && ((v >>> 11) & 0x3f) <= 15;
const cellOf = (m) => m.floor * LEVEL + m.y * W + m.x;

function load(key) {
	const map = JSON.parse(fs.readFileSync(path.join(MAPS, `${key}.json`), 'utf8'));
	const raw = fs.readFileSync(path.join(MAPS, `${key}.cells`));
	const words = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
	const n = map.cells.cellsPerLayer;
	return {
		map,
		cells: words.slice(0, n),
		seen: words.slice(n, n * 2),
		items: words.slice(n * 2, n * 3),
	};
}

function run(key, ticks) {
	const { map, cells, seen, items } = load(key);
	const state = createMonsterState(map, defs);
	stampMonsters(state, cells);
	initialiseMonsterHatches(state, cells, seen, items);

	const lifts = createLiftState(map.lifts);
	const doors = createDoorState(map.doors);
	const pushables = createPushableState(map.pushables);
	const water = createWaterState(map);
	if (water) initialiseWater(water, cells, seen);

	// Blocks already in the shipped cell data have no record and never will;
	// count them up front so the soak reports what the loop CAUSED.
	let baked = 0;
	for (let i = 0; i < cells.length; i++) {
		if (isMonsterBlock(cells[i] >>> 0) && !monsterAtCell(state, i)) baked++;
	}

	// One player walking a lap of the map, so monsters have something to chase.
	const player = { x: 11, y: 11, floor: 11, dead: false, index: 0 };
	const stale = new Set();

	for (let t = 0; t < ticks; t++) {
		player.x = 2 + (t % 20);
		player.y = 2 + ((t >> 4) % 20);
		player.floor = 4 + ((t >> 8) % 14);

		hatchEggs(state, cells, seen, items, 1);
		if (water) moveWater(water, cells, seen, 1);
		moveDoors(doors, cells, 1, {});
		const riders = [player, ...activeMonsters(state)];
		moveLifts(lifts, cells, riders, 1, { seen, items, pushables });
		blocksFall(cells, items, pushables, { seen });
		monstersFall(state, cells, items, {});
		moveMonsters(state, cells, items, [player], 1, {});

		// Check every tick, not just at the end: a desync can heal itself and
		// still have left a ghost block behind while it lasted.
		for (const m of activeMonsters(state)) {
			if (m.cell >= 0 && cellOf(m) !== m.cell) stale.add(m.index);
		}
	}

	let ghosts = 0;
	for (let i = 0; i < cells.length; i++) {
		if (isMonsterBlock(cells[i] >>> 0) && !monsterAtCell(state, i)) ghosts++;
	}
	const unstamped = activeMonsters(state)
		.filter((m) => m.cell >= 0 && !isMonsterBlock(cells[m.cell] >>> 0)).length;

	return { active: activeMonsters(state).length, baked, ghosts, caused: ghosts - baked, stale: stale.size, unstamped };
}

const only = process.argv[2];
const TICKS = Number(process.argv[3] || 3000);
const keys = only && !/^\d+$/.test(only)
	? [only]
	: fs.readdirSync(MAPS).filter((f) => f.endsWith('.cells')).map((f) => f.slice(0, -6));

console.log('map                      active  baked  ghosts  caused  stale  unstamped');
let bad = 0;
for (const key of keys) {
	const r = run(key, TICKS);
	const flag = (r.caused > 0 || r.stale > 0 || r.unstamped > 0) ? '  <<<' : '';
	if (flag) bad++;
	console.log(key.padEnd(24), String(r.active).padStart(6), String(r.baked).padStart(6),
		String(r.ghosts).padStart(7), String(r.caused).padStart(7),
		String(r.stale).padStart(6), String(r.unstamped).padStart(10) + flag);
}
console.log(`\n${keys.length} maps, ${TICKS} ticks each: ${bad} with a desync`);
process.exitCode = bad ? 1 : 0;
