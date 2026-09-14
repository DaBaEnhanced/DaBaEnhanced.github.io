// A lift's two directions are not mirror images.
//
// move_lifts (Main.s:1807) writes up and down as separate code, and they differ
// in two ways the port had flattened into one signed step:
//
//   1. The weight and block-class checks live only in `.move_up`. `.move_down`
//      decrements lift_height and lift_posn before it has read the platform at
//      all, and never consults lift_weight. So a weight-0 lift refuses to raise
//      a load but still lowers one. Ten of the 284 shipped lifts are weight 0 --
//      four of them in 09-Tomb with automove 2, which only ever sends a lift
//      DOWN from the top. Under the port's symmetric gate those four could not
//      move in either direction.
//
//   2. `.move_down_loop` is a loop. A descending lift carries the whole COLUMN
//      standing on it, stepping both addresses up one level per pass, until it
//      reaches a cell with no block and no aux, or one whose floor is not type 2.
//      The port moved a single cell, leaving anything stacked above the platform
//      hanging in the air.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLiftState, moveLifts, liftUp, liftDown } from '../src/lifts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS = path.join(__dirname, '..', 'assets', 'maps');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const asm = fs.readFileSync(path.join(__dirname, '..', '..', 'Sources', 'Main.s'), 'utf8');
// The routine, from its label to the dbf that closes the 32-lift loop.
const fn = asm.slice(asm.search(/^move_lifts/m));
const routine = fn.slice(0, fn.indexOf('dbf\td7,.next_lift'));
const upPart = routine.slice(routine.search(/^\.move_up/m), routine.search(/^\.not_up/m));
const downPart = routine.slice(routine.search(/^\.move_down\b/m), routine.search(/^\.not_down/m));

const W = 23, LEVEL = W * 23;
const FLOOR_HERE = 1, BLOCK_HERE = 2, AUX_HERE = 1 << 5;
const OPAQUE = 1 << 6, PUSHABLE = 1 << 8;
// Measured from the shipped maps below, not assumed.
const PLATFORM = (FLOOR_HERE | (2 << 9)) >>> 0;
const blk = (t) => ((t << 11) | BLOCK_HERE) >>> 0;

// --- what the shipped data actually contains ----------------------------------------
{
	let total = 0, zero = 0, floor2 = 0;
	const zeroMaps = new Set();
	for (const f of fs.readdirSync(MAPS)) {
		if (!f.endsWith('.json') || /^campaign|^maps\.json/.test(f)) continue;
		const m = JSON.parse(fs.readFileSync(path.join(MAPS, f), 'utf8'));
		const raw = fs.readFileSync(path.join(MAPS, f.replace('.json', '.cells')));
		const cells = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
			.slice(0, m.cells.cellsPerLayer);
		for (const l of (m.lifts || [])) {
			if (!l || !l.posn) continue;
			total++;
			const c = cells[l.posn >>> 2] >>> 0;
			if ((c & FLOOR_HERE) && ((c >>> 9) & 3) === 2) floor2++;
			if (!(l.weight | 0)) { zero++; zeroMaps.add(f.replace('.json', '')); }
		}
	}
	eq(total, 284, 'the campaign ships 284 positioned lifts');
	eq(floor2, total, 'every one of them sits on a floor of type 2');
	eq(zero, 10, 'ten of them are weight 0');
	eq([...zeroMaps].sort().join(','), '09-Tomb,22-Stopover,37-3pl', 'across three maps');

	// 09-Tomb's four are automove 2 -- down from the top, and nothing else.
	const tomb = JSON.parse(fs.readFileSync(path.join(MAPS, '09-Tomb.json'), 'utf8'));
	const drops = tomb.lifts.filter((l) => l && l.posn && !(l.weight | 0));
	eq(drops.length, 4, '09-Tomb has four weight-0 lifts');
	ok(drops.every((l) => l.automove === 2),
		'all automove 2, which only ever sends a lift down from the top');
	ok(drops.every((l) => l.height >= l.maxHeight),
		'and all parked at the top, so down is their only move');
}

// --- the asymmetry, read out of the source -------------------------------------------
{
	ok(/tst\.b\s+lift_weight\(a0\)/.test(upPart), '.move_up consults the weight');
	ok(!/lift_weight/.test(downPart), '.move_down never does');
	// The class range is up-only too.
	ok(/cmp\.l\s+#\(8<<block_shift\)/.test(upPart), '.move_up range-checks the block class');
	ok(!/cmp\.l\s+#\(8<<block_shift\)/.test(downPart), '.move_down does not');

	// Down commits before it reads anything.
	const head = downPart.slice(0, downPart.indexOf('.move_down_loop'));
	ok(/subi\.b\s+#1,lift_height\(a0\)/.test(head), 'down drops the height straight away');
	ok(head.indexOf('lift_height') < head.indexOf('keep_aux'),
		'before it has even looked at the platform');

	// And it is a loop.
	ok(/^\.move_down_loop/m.test(downPart), '.move_down_loop is a label');
	ok(/bra\s+\.move_down_loop/.test(downPart), 'branched back to, so it is a loop');
	ok(/add\.w\s+#MAP_WIDTH\*MAP_DEPTH\*map_cell_size,a2/.test(downPart),
		'stepping a level per pass');
	// Its two exit conditions.
	ok(/and\.l\s+#keep_aux!keep_block,d3\s*\n\s*beq\s+\.end_loop_down/.test(downPart),
		'it stops at a cell with no block and no aux');
	ok(/cmp\.l\s+#\(2<<floor_shift\)!keep_floor_here_bit,d3\s*\n\s*bne\s+\.end_loop_down/
		.test(downPart), 'and at any floor that is not type 2');

	// Up carries one cell and one only: no branch back.
	ok(!/bra\s+\.move_up/.test(upPart), 'the up path never loops');
}

/** A shaft with a platform at `floor`, plus whatever blocks are stacked on it. */
function shaft(floor, stack = [], { weight = 1, automove = 0, height = floor } = {}) {
	const cells = new Uint32Array(LEVEL * 20);
	const cell = floor * LEVEL + 10 * W + 10;
	cells[cell] = PLATFORM;
	stack.forEach((word, n) => { cells[cell + n * LEVEL] |= word; });
	const state = createLiftState([{
		posn: cell << 2, height, minHeight: 2, maxHeight: 16,
		direction: 0, weight, automove,
	}]);
	return { cells, cell, state };
}

// --- a weight-0 lift: up is refused, down is not --------------------------------------
{
	{
		const { cells, cell, state } = shaft(6, [blk(32)], { weight: 0 });
		liftUp(state, cell);
		const player = { x: 10, y: 10, floor: 6, dead: false };
		moveLifts(state, cells, [player], 51, {});
		eq(player.floor, 6, 'a weight-0 lift will not raise a player');
		eq(state.lifts[0].height, 6, 'and does not move');
	}
	{
		const { cells, cell, state } = shaft(6, [blk(32)], { weight: 0 });
		liftDown(state, cell);
		const player = { x: 10, y: 10, floor: 6, dead: false };
		moveLifts(state, cells, [player], 51, {});
		eq(player.floor, 5, 'but it lowers one -- this is 09-Tomb, and it was frozen');
		eq(state.lifts[0].height, 5, 'the lift travelled');
		ok((cells[cell - LEVEL] & BLOCK_HERE) !== 0, 'the block arrived below');
	}
}

// --- a descending lift carries the column ----------------------------------------------
{
	// A crate on the platform with a monster standing on top of it. Both cells
	// have to come down together.
	const crate = (PLATFORM | blk(2) | PUSHABLE) >>> 0;
	const { cells, cell, state } = shaft(6, [crate, (PLATFORM | blk(8)) >>> 0]);
	const monster = { cell: cell + LEVEL, x: 10, y: 10, floor: 7, dead: false };
	liftDown(state, cell);
	moveLifts(state, cells, [monster], 51, { pushables: { list: [{ cell }] } });

	eq(state.lifts[0].height, 5, 'the lift dropped a level');
	ok((cells[cell - LEVEL] & PUSHABLE) !== 0, 'the crate came with it');
	eq((cells[cell] >>> 11) & 0x3f, 8, 'and the monster above followed into the vacated cell');
	eq(monster.cell, cell, 'the monster rode down');
	eq(monster.floor, 6, 'with its floor kept in step');
}

// --- an opaque block does not ride, and stops the walk -----------------------------------
{
	const wall = (PLATFORM | blk(3) | OPAQUE) >>> 0;
	const { cells, cell, state } = shaft(6, [wall, (PLATFORM | blk(8)) >>> 0]);
	const monster = { cell: cell + LEVEL, x: 10, y: 10, floor: 7, dead: false };
	liftDown(state, cell);
	moveLifts(state, cells, [monster], 51, {});

	eq((cells[cell] >>> 11) & 0x3f, 3, 'the wall stayed where it was');
	eq(monster.cell, cell + LEVEL, 'and nothing above it was dragged down');
	eq(monster.floor, 7, 'its floor is untouched too');
}

// --- the walk stops at a real floor --------------------------------------------------------
{
	// Floor type 0 above the platform: that cell holds its own load up.
	const { cells, cell, state } = shaft(6, [blk(8), (FLOOR_HERE | blk(9)) >>> 0]);
	const upper = { cell: cell + LEVEL, x: 10, y: 10, floor: 7, dead: false };
	liftDown(state, cell);
	moveLifts(state, cells, [upper], 51, {});
	eq(upper.cell, cell + LEVEL, 'a cell with a type-0 floor is not carried down');
}

// --- a grenade leaves its block behind ------------------------------------------------------
//
// Only on the way DOWN. Going up, blocks 22 and 23 fall in the 16..23 band that
// `.move_up` refuses outright (stairs and doors jam a rising lift), so the
// grenade carve-out at `.carry_up` is reachable only through the pushable bit.
// Coming down there is no class check at all, and the carve-out is the plain
// path: the floor and aux travel, the grenade itself stays where it was.
{
	for (const t of [22, 23]) {
		const { cells, cell, state } = shaft(6, [blk(t) | AUX_HERE]);
		liftDown(state, cell);
		moveLifts(state, cells, [], 51, {});
		eq((cells[cell] >>> 11) & 0x3f, t, `block ${t} stays put as the lift descends`);
		eq((cells[cell - LEVEL] >>> 11) & 0x3f, 0, 'and does not arrive below');
		ok((cells[cell - LEVEL] & AUX_HERE) !== 0, 'though its aux travels');
		ok((cells[cell] & AUX_HERE) === 0, 'and is gone from the cell it left');
	}

	// The other half: a rising lift will not take one at all.
	for (const t of [22, 23]) {
		const { cells, cell, state } = shaft(6, [blk(t)]);
		liftUp(state, cell);
		moveLifts(state, cells, [], 51, {});
		eq(state.lifts[0].height, 6, `block ${t} jams a rising lift, as 16..23 does`);
	}
}

// --- and the port keeps the two directions apart --------------------------------------------
{
	const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lifts.js'), 'utf8');
	ok(/function travelUp\(/.test(src) && /function travelDown\(/.test(src),
		'the port writes them as two functions');
	const up = src.slice(src.indexOf('function travelUp('), src.indexOf('function travelDown('));
	const down = src.slice(src.indexOf('function travelDown('), src.indexOf('function moveRiders('));
	ok(/lift\.weight/.test(up), 'the weight gate is in the up path');
	ok(!/lift\.weight/.test(down), 'and nowhere in the down path');
	ok(/function descend\(/.test(down), 'which walks the column instead');
}

console.log(`lift travel: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
