// A lift carries more than a cell index.
//
// Monsters are addressed by `cell`, so the lift moved that and nothing else.
// But a monster ALSO carries x/y/floor, and findClosestPlayer works in those:
// it weights the floor difference by four before squaring, against a cutoff of
// 100. A monster left three floors stale therefore scores 144 against a player
// standing right beside it, finds no target, and moveMonsters skips it with
// `if (!target) continue;` for the rest of the level.
//
// From the outside that is a monster standing on its cell, blocking it, doing
// nothing, while every monster that never rode a lift behaves normally.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLiftState, moveLifts, liftUp, liftDown } from '../src/lifts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const W = 23, D = 23, LEVEL = W * D;
const cellOf = (o) => o.floor * LEVEL + o.y * W + o.x;

/** A shaft with the platform's floor at `floor`, and a monster block on it. */
function shaft(floor, x = 10, y = 10) {
	const cells = new Uint32Array(LEVEL * 20);
	const cell = floor * LEVEL + y * W + x;
	// Floor type 2: every one of the 284 shipped lifts carries it, and the
	// descent loop keys on it -- any other floor type holds its load up.
	cells[cell] = 1 | (2 << 9) | 2 | (8 << 11);   // platform + a mon1 block
	return { cells, cell };
}

// --- the invariant a rider has to keep -------------------------------------------
{
	for (const [name, dir, sign] of [['up', liftUp, +1], ['down', liftDown, -1]]) {
		const { cells, cell } = shaft(6);
		const lifts = createLiftState([{
			posn: cell << 2, height: 6, minHeight: 2, maxHeight: 10,
			direction: 0, weight: 1,
		}]);
		const m = { active: true, cell, x: 10, y: 10, floor: 6, direction: 0 };
		eq(cellOf(m), m.cell, `${name}: the monster starts consistent`);

		dir(lifts, cell);
		for (let i = 0; i < 3; i++) moveLifts(lifts, cells, [m], 51, {});

		eq(m.cell, (6 + sign * 3) * LEVEL + 10 * W + 10, `${name}: the cell moved three floors`);
		eq(m.floor, 6 + sign * 3, `${name}: and so did the floor`);
		eq(cellOf(m), m.cell, `${name}: x/y/floor still agree with the cell`);
		eq(m.x, 10, `${name}: x is untouched -- a lift only travels vertically`);
		eq(m.y, 10, `${name}: and y`);
	}
}

// --- what the drift did to the aggro test -----------------------------------------
//
// findClosestPlayer, restated here so the arithmetic that made the monster inert
// is visible rather than implied.
{
	const aggro = (m, p) => {
		const dx = p.x - m.x, dy = p.y - m.y, dz = (p.floor - m.floor) << 2;
		return dx * dx + dy * dy + dz * dz;
	};
	const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'monsters.js'), 'utf8');
	const fn = src.slice(src.indexOf('function findClosestPlayer('));
	ok(/\(\(p\.floor \| 0\) - m\.floor\) << 2/.test(fn.slice(0, 600)),
		'the floor difference is weighted by four');
	const cutoff = Number(fn.match(/bestDist < (\d+)/)?.[1]);
	eq(cutoff, 100, 'and the cutoff is 100');
	ok(/if \(!target\) continue;/.test(src),
		'a monster with no target is skipped entirely');

	// A player one cell away, on the floor the block is actually on.
	const block = { x: 10, y: 10, floor: 9 };
	const player = { x: 10, y: 11, floor: 9 };
	eq(aggro(block, player), 1, 'with the floor right, the player is adjacent');
	ok(aggro(block, player) < cutoff, 'and well inside the cutoff');

	// The same monster with the floor left three behind, as it used to be.
	const stale = { x: 10, y: 10, floor: 6 };
	ok(aggro(stale, player) >= cutoff,
		`three floors stale scores ${aggro(stale, player)}, past the cutoff -- inert forever`);
	// Where it tips over: one and two floors of drift still find a target, three
	// does not. So a short hop leaves the monster working but half blind, and
	// any ride of three floors or more kills it outright.
	eq(aggro({ ...stale, floor: 8 }, player), 17, 'one floor of drift costs 16 of the 100');
	eq(aggro({ ...stale, floor: 7 }, player), 65, 'two costs 64, most of the radius');
	ok(aggro({ ...stale, floor: 7 }, player) < cutoff, 'two still just finds a target');
	ok(aggro({ ...stale, floor: 6 }, player) >= cutoff, 'three is past it, and inert for good');
}

// --- the fix is in the right place -------------------------------------------------
{
	const lifts = fs.readFileSync(path.join(__dirname, '..', 'src', 'lifts.js'), 'utf8');
	const travel = lifts.slice(lifts.indexOf('function travel('));
	ok(/typeof p\.floor === 'number'/.test(travel),
		'a cell-addressed rider carrying a floor has it moved too');
	ok(!/p\.x \+=|p\.y \+=/.test(travel),
		'and x/y are left alone, since a lift only travels vertically');
}

// --- a rider with no floor is unharmed ---------------------------------------------
//
// Sentries ride by cell alone. Inventing a floor on them would be worse than
// leaving them be.
{
	const { cells, cell } = shaft(6);
	const lifts = createLiftState([{
		posn: cell << 2, height: 6, minHeight: 2, maxHeight: 10, direction: 0, weight: 1,
	}]);
	const sentry = { active: true, cell };
	liftUp(lifts, cell);
	moveLifts(lifts, cells, [sentry], 51, {});
	eq(sentry.cell, 7 * LEVEL + 10 * W + 10, 'a sentry still rides');
	ok(!('floor' in sentry), 'and gains no floor it never had');
}

console.log(`lift riders: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
