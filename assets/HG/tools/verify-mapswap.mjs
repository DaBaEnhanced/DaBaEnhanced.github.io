// Swapping maps while the world is still running.
//
// loadMap installs game.cells and then does four more awaits -- style JSON, its
// atlas, the overlay metas, their atlases -- before it rebuilds
// game.monsterState. requestAnimationFrame keeps firing through all of them, so
// the frame loop was stepping the OLD map's monsters against the NEW map's
// cells. putMonsterInMap stamped them into it, then the fresh state replaced
// them, and those stamps were left with no record behind them.
//
// A monster block with no record never moves (moveMonsters only walks records)
// and cannot be killed (damageOccupantAtCell looks the record up by cell), but
// still occupies the square. Reported from a real session as "some monsters
// stand still, cannot be killed, and block the road".
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	createMonsterState, stampMonsters, initialiseMonsterHatches,
	moveMonsters, monsterAtCell, activeMonsters,
} from '../src/monsters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS = path.join(__dirname, '..', 'assets', 'maps');
const W = 23, LEVEL = W * 23;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const defs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'monsters.json'), 'utf8'));
const isMon = (v) => (v & 2) && ((v >>> 11) & 0x3f) >= 8 && ((v >>> 11) & 0x3f) <= 15;

function load(key) {
	const map = JSON.parse(fs.readFileSync(path.join(MAPS, `${key}.json`), 'utf8'));
	const raw = fs.readFileSync(path.join(MAPS, `${key}.cells`));
	const words = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
	const n = map.cells.cellsPerLayer;
	return { map, cells: words.slice(0, n), seen: words.slice(n, n * 2), items: words.slice(n * 2, n * 3) };
}

const ghostsIn = (state, cells) => {
	let n = 0;
	for (let i = 0; i < cells.length; i++) if (isMon(cells[i] >>> 0) && !monsterAtCell(state, i)) n++;
	return n;
};

// --- the mechanism, reproduced ----------------------------------------------------
//
// Step the OLD state against the NEW cells for a few frames, exactly as the
// frame loop did during those awaits, then install the fresh state.
{
	const from = load('02-CaveSystem');
	const to = load('01-ArtificialIsland');

	const oldState = createMonsterState(from.map, defs);
	stampMonsters(oldState, from.cells);
	initialiseMonsterHatches(oldState, from.cells, from.seen, from.items);
	ok(activeMonsters(oldState).length > 0, 'the old map has monsters running');

	eq(ghostsIn(oldState, to.cells), 0, 'the new map starts clean');

	// The window: old records, new cells. A player somewhere so they act.
	const player = { x: 11, y: 11, floor: 11, dead: false };
	for (let t = 0; t < 40; t++) {
		moveMonsters(oldState, to.cells, to.items, [player], 1, {});
	}

	// Now the swap completes and the fresh state arrives.
	const newState = createMonsterState(to.map, defs);
	stampMonsters(newState, to.cells);
	const ghosts = ghostsIn(newState, to.cells);
	ok(ghosts > 0,
		`stepping the old state against the new cells leaves ${ghosts} ownerless blocks`);

	// And they are exactly the failure that was reported: no record, so nothing
	// moves them and nothing can damage them.
	let unowned = 0;
	for (let i = 0; i < to.cells.length; i++) {
		if (!isMon(to.cells[i] >>> 0)) continue;
		if (!monsterAtCell(newState, i)) unowned++;
	}
	eq(unowned, ghosts, 'every one of them is unreachable by cell lookup');
}

// --- the gate ---------------------------------------------------------------------
{
	const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');

	ok(/async function loadMap\(key\) \{\s*\n\s*game\.loading = true;/.test(main),
		'loadMap raises the flag before it starts');
	ok(/\} finally \{\s*\n\s*game\.loading = false;/.test(main),
		'and clears it in a finally, so a failed load cannot freeze the world');
	ok(/async function loadMapInner\(key\)/.test(main),
		'the body moved into an inner function so the finally wraps all of it');

	// The world step honours it.
	ok(/!game\.mission\?\.complete && !game\.loading\)/.test(main),
		'the world does not step while a map is loading');

	// The window it closes is real: cells go in well before the state is rebuilt.
	const lines = main.split('\n');
	const cellsAt = lines.findIndex((l) => l.includes('game.cells = words.subarray'));
	const stateAt = lines.findIndex((l) => l.includes('game.monsterState = createMonsterState'));
	ok(cellsAt > 0 && stateAt > cellsAt, 'cells are installed before the monster state');
	let awaits = 0;
	for (let i = cellsAt; i < stateAt; i++) if (/\bawait\b/.test(lines[i])) awaits++;
	ok(awaits > 0,
		`there are ${awaits} awaits in that window, which is why the gate is needed`);
}

console.log(`map swap: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
