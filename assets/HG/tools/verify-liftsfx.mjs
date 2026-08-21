// The lift motor, and what it shares a channel with.
//
// on_a_lift means "a lift CARRIED a player on its last step" -- Main.s sets it
// at :1958 and :2097, immediately after stepping the rider's floor, and clears
// it at :1812 INSIDE the 50-tick gate so it holds between steps. The port asked
// instead whether the viewing player was standing on a lift cell, so parking on
// a stopped lift ran the motor forever.
//
// The same flag gates the door samples, because they and the motor both play on
// channel 2, so getting it wrong silenced doors as well as running the motor.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	createLiftState, moveLifts, liftCarryingPlayer, liftUp, liftStop, LIFT,
} from '../src/lifts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', '..', 'Sources');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const main = fs.readFileSync(path.join(SRC, 'Main.s'), 'utf8');

// --- what the source keys the motor on ------------------------------------------
{
	// Set only where a figure's floor is stepped, not where one is stood.
	const ups = main.indexOf('addi.b\t#1,floor(a4)');
	ok(ups > 0, 'the source steps a carried player up');
	ok(/(?<!t)st\.b\s+variables\+on_a_lift\(a5\)/.test(main.slice(ups, ups + 120)),
		'and sets on_a_lift right there');
	const downs = main.indexOf('sub.b\t#1,floor(a4)');
	ok(downs > 0, 'and down');
	ok(/(?<!t)st\.b\s+variables\+on_a_lift\(a5\)/.test(main.slice(downs, downs + 120)),
		'setting it there too');
	// Two places only: it is not set anywhere a player merely stands.
	eq((main.match(/(?<!t)st\.b\s+variables\+on_a_lift\(a5\)/g) || []).length, 2,
		'on_a_lift is set in exactly those two places');

	// Cleared inside the 50-tick gate, which is what makes it hold between steps.
	const gate = main.indexOf('cmp.w\t#50,lift_count');
	const clear = main.indexOf('clr.w\tvariables+on_a_lift(a5)');
	ok(gate > 0 && clear > gate, 'it is cleared after the tick gate, not before');
	ok(clear - gate < 400, 'and immediately inside it');

	// The doors share channel 2 with the motor, hence the same gate on them.
	ok(/PLAY_EX_SAMPLE #9,#2,#40,#412/.test(main), 'the motor plays on channel 2');
	ok(/PLAY_SAMPLE_MEM a2,#5,#2,#428/.test(main), 'and the door sample too');
	const doorGates = (main.match(/tst\.b\s+variables\+on_a_lift\(a5\)/g) || []).length;
	ok(doorGates >= 3, `the flag is tested ${doorGates} times, gating doors as well as the motor`);
}

// --- a real ride -----------------------------------------------------------------
//
// The behaviour that was wrong: standing still on a lift that is not moving.
{
	const W = 23, D = 23, LEVEL = W * D;
	const cells = new Uint32Array(LEVEL * 20);
	const FLOOR_HERE = 1;
	const at = (x, y, f) => f * LEVEL + y * W + x;
	const cell = at(5, 5, 4);
	// An empty shaft: only the platform itself carries a floor, or travel()
	// refuses to rise into one and the lift never moves.
	cells[cell] = FLOOR_HERE;
	const state = createLiftState([
		{ posn: cell << 2, height: 4, minHeight: 2, maxHeight: 8, direction: 0, weight: 1 },
	]);
	const player = { x: 5, y: 5, floor: 4, dead: false };

	eq(liftCarryingPlayer(state), false, 'a fresh lift is silent');

	// Sitting on a stopped lift, for a long time. This is the bug.
	let heard = 0;
	for (let t = 0; t < 40; t++) {
		moveLifts(state, cells, [player], 51);
		if (liftCarryingPlayer(state)) heard++;
	}
	eq(heard, 0, 'parking on a stopped lift never runs the motor');
	eq(player.floor, 4, 'and the player has not moved');

	// Now send it up.
	liftUp(state, cell);
	moveLifts(state, cells, [player], 51);
	ok(liftCarryingPlayer(state), 'a lift carrying the player runs the motor');
	const rose = player.floor;
	ok(rose > 4, `and the player rose (${rose})`);

	// It keeps running for as long as the ride does.
	let ran = 0;
	for (let t = 0; t < 3; t++) {
		moveLifts(state, cells, [player], 51);
		if (liftCarryingPlayer(state)) ran++;
	}
	eq(ran, 3, 'the motor runs through the whole ride');

	// Stop it. The next step carries nobody, so the motor stops.
	liftStop(state, cell);
	moveLifts(state, cells, [player], 51);
	eq(liftCarryingPlayer(state), false, 'stopping the lift stops the motor');
	const parked = player.floor;
	for (let t = 0; t < 20; t++) moveLifts(state, cells, [player], 51);
	eq(liftCarryingPlayer(state), false, 'and it stays stopped while parked on it');
	eq(player.floor, parked, 'with the player still where it left them');
}

// --- the flag holds between steps -------------------------------------------------
//
// It is rolled over inside the tick gate, so frames that do not step a lift must
// not clear it -- otherwise the motor stutters through a ride.
{
	const W = 23, D = 23, LEVEL = W * D;
	const cells = new Uint32Array(LEVEL * 20);
	const cell = 4 * LEVEL + 5 * W + 5;
	cells[cell] = 1;
	const state = createLiftState([
		{ posn: cell << 2, height: 4, minHeight: 2, maxHeight: 8, direction: 0, weight: 1 },
	]);
	const player = { x: 5, y: 5, floor: 4, dead: false };
	liftUp(state, cell);
	moveLifts(state, cells, [player], 51);
	ok(liftCarryingPlayer(state), 'the motor is running');
	// Several frames that do not reach the gate.
	for (let t = 0; t < 10; t++) moveLifts(state, cells, [player], 1);
	ok(liftCarryingPlayer(state), 'and stays running across frames that do not step');
}

// --- only players count -----------------------------------------------------------
//
// find_heads_owner_quick finds a PLAYER's head. A lift carrying a monster is
// silent, which is why monsters ride by cell index rather than x/y/floor here.
{
	const W = 23, D = 23, LEVEL = W * D;
	const cells = new Uint32Array(LEVEL * 20);
	const cell = 4 * LEVEL + 5 * W + 5;
	const state = createLiftState([
		{ posn: cell << 2, height: 4, minHeight: 2, maxHeight: 8, direction: 0, weight: 1 },
	]);
	cells[cell] = 1;
	const monster = { cell, dead: false };
	liftUp(state, cell);
	moveLifts(state, cells, [monster], 51);
	ok(monster.cell !== cell, 'the monster rode the lift');
	eq(liftCarryingPlayer(state), false, 'but a lift carrying only a monster is silent');
}

// --- and the port is wired to it ---------------------------------------------------
{
	const mjs = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	ok(!/viewerOnLift/.test(mjs), 'the old standing-on-a-lift test is gone');
	const fn = mjs.slice(mjs.indexOf('function updateLiftSfx()'));
	ok(/liftCarryingPlayer\(game\.lifts\)/.test(fn.slice(0, 400)),
		'the motor asks whether a lift is carrying someone');
	// Edge-triggered, or startLift/stopLift fire every frame.
	ok(/if \(on === game\.onLiftPrev\) return;/.test(fn.slice(0, 400)),
		'and only acts on the edge');
	// The doors share the channel, so they share the gate.
	ok(/onDoorMoving: \(\) => \{ if \(!liftCarryingPlayer\(game\.lifts\)\)/.test(mjs),
		'the door sounds use the same flag');
	ok(/onDoorArrived: \(\) => \{ if \(!liftCarryingPlayer\(game\.lifts\)\)/.test(mjs),
		'both of them');
}

console.log(`lift sfx: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
