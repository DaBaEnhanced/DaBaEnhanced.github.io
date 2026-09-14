// When a button's action lands.
//
// do_button_action (Controls&Movement.s:6748) is a bare jump table: `lsl.w #2,d1
// / jmp 0(a3,d1.w)` into 19 branches, each of which does the work and returns.
// There is no counter, no queue, and nothing that waits. The action lands the
// same frame the button is pressed.
//
// The port briefly defaulted to a one-second settling time, and since the delay
// byte is zero in every shipped button, EVERY button in the campaign inherited
// it. The Abandoned Depot shows what that costs: pad 6 sits at x11 y7 on floor
// 11 and unlocks the door three cells north at x11 y4. Three steps takes well
// under a second, so the door still read LOCKED when you got there, and only
// opened when you walked into it a second time -- after the unlock had landed.
// Reported from play as "I go against them and it says LOCKED, then I go
// against them again and they open".
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	createButtonState, checkPad, stepButtons, activatePanel,
	ACTION, DEFAULT_BUTTON_DELAY_S,
} from '../src/buttons.js';
import { createDoorState, moveDoors, triggerDoor, DOOR } from '../src/doors.js';
import { move, MOVE, putHeadInMap, removeHeadFromMap } from '../src/movement.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS = path.join(__dirname, '..', 'assets', 'maps');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const cm = fs.readFileSync(
	path.join(__dirname, '..', '..', 'Sources', 'Controls&Movement.s'), 'utf8');

// --- the original does not wait ------------------------------------------------
{
	const at = cm.search(/^do_button_action/m);
	ok(at > 0, 'do_button_action exists');
	const body = cm.slice(at, at + 900);
	ok(/lea\s+\.action_table\(pc\),a3[\s\S]{0,80}jmp\s+0\(a3,d1\.w\)/.test(body),
		'it jumps straight into an action table');
	const branches = (body.match(/bra\.w\s+\.\w+/g) || []).length;
	eq(branches, 19, 'with one branch per action');
	// Nothing in it counts down or defers.
	ok(!/\bcount\b|delay/i.test(body), 'and nothing in it counts or delays');
}

// --- every shipped button asks for no delay -------------------------------------
let totalButtons = 0;
{
	let nonZero = 0, maps = 0;
	for (const f of fs.readdirSync(MAPS)) {
		if (!f.endsWith('.json') || /^campaign|^maps\.json/.test(f)) continue;
		maps++;
		for (const b of (JSON.parse(fs.readFileSync(path.join(MAPS, f), 'utf8')).buttons || [])) {
			if (!b || !b.used) continue;
			totalButtons++;
			if ((b.delay | 0) !== 0) nonZero++;
		}
	}
	eq(maps, 47, 'the campaign ships 47 maps');
	ok(totalButtons > 500, `carrying ${totalButtons} live buttons`);
	eq(nonZero, 0, 'not one of which asks for a delay');
	// So the default is what every one of them gets.
	eq(DEFAULT_BUTTON_DELAY_S, 0, 'and the default is no delay, as the original has none');
}

// --- a pad fires the same call -----------------------------------------------------
{
	const map = JSON.parse(fs.readFileSync(path.join(MAPS, '07-AbandonedDepot.json'), 'utf8'));
	const LEVEL = 23 * 23;
	const state = createButtonState(map, LEVEL);
	let fired = 0;
	const world = { doorTrig: () => { fired++; }, liftUp: () => {}, playSample: () => {} };

	// Rather than hunt a pad cell, drive doButtonAction through the public path by
	// queueing: with no delay, queueAction must report immediate.
	const raw = fs.readFileSync(path.join(MAPS, '07-AbandonedDepot.cells'));
	const words = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
	const cells = words.slice(0, map.cells.cellsPerLayer);
	const padCell = 11 * 23 * 23 + 7 * 23 + 11;      // x11 y7 f11
	const r = checkPad(state, cells, padCell, true, world);
	ok(r, 'x11 y7 floor 11 is a pad');
	eq(r.index, 6, 'button 6');
	eq(r.action, ACTION.DOOR_UNLOCK, 'whose action is DOOR_UNLOCK');
	eq(r.delayTicks, 0, 'with no delay');
	eq(fired, 1, 'and it reached the door the same call');
	eq(state.pending.length, 0, 'nothing was left queued');
}

// --- the depot corridor, walked ------------------------------------------------------
{
	const map = JSON.parse(fs.readFileSync(path.join(MAPS, '07-AbandonedDepot.json'), 'utf8'));
	const raw = fs.readFileSync(path.join(MAPS, '07-AbandonedDepot.cells'));
	const words = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
	const cells = words.slice(0, map.cells.cellsPerLayer);
	const MW = 23, LEVEL = MW * 23;
	const idx = (x, y, f) => f * LEVEL + y * MW + x;

	const doors = createDoorState(map.doors.filter((d) => d && d.posn));
	const buttons = createButtonState(map, LEVEL);
	const world = {
		doorTrig: (n, trig) => { const d = doors.doors[n]; if (d) d.trig = trig; },
		doorToggle: () => {}, liftUp: () => {}, liftDown: () => {},
		liftStop: () => {}, liftToggle: () => {}, playSample: () => {},
	};
	const doorCell = idx(11, 4, 11);
	const door = doors.doors.find((d) => d.cell === doorCell);
	eq(door.direction, DOOR.LOCKED, 'the depot door at x11 y4 f11 starts locked');
	eq(door.key, 0, 'with no key, so only a button can shift it');

	const p = { x: 11, y: 8, floor: 11, direction: 0, index: 0 };   // facing north
	putHeadInMap(cells, p);
	const log = [];
	for (let n = 0; n < 5; n++) {
		const from = idx(p.x, p.y, p.floor);
		removeHeadFromMap(cells, p.x, p.y, p.floor);
		const r = move(cells, p, 0, false);
		if (r.result === MOVE.DOOR) {
			const t = triggerDoor(doors, r.target, { carrying: () => false });
			log.push(t.locked ? 'LOCKED' : 'opening');
		} else if (r.result === MOVE.MOVED) {
			checkPad(buttons, cells, from, false, world);
			checkPad(buttons, cells, idx(p.x, p.y, p.floor), true, world);
			log.push('moved');
		} else log.push(String(r.result));
		putHeadInMap(cells, p);
		stepButtons(buttons, cells, world, 1);
		for (let t = 0; t < 90; t++) moveDoors(doors, cells, 1);
	}
	eq(log.join(','), 'moved,moved,moved,opening,moved',
		'walking the corridor unlocks the door before you reach it, and it opens first try');
	ok(!log.includes('LOCKED'), 'no spurious LOCKED on the way in');
	// Five attempts: three steps up the corridor, one that opens the door, and
	// one that carries them into the doorway cell itself at y=4.
	eq(p.y, 4, 'and the player ends up standing in the doorway');
}

// --- an explicit delay still defers ---------------------------------------------------
//
// The byte stays usable for maps that want it; it is only the DEFAULT that is 0.
{
	const map = JSON.parse(fs.readFileSync(path.join(MAPS, '07-AbandonedDepot.json'), 'utf8'));
	map.buttons = map.buttons.map((b) => (b && b.index === 6 ? { ...b, delay: 20 } : b));
	const LEVEL = 23 * 23;
	const state = createButtonState(map, LEVEL);
	const raw = fs.readFileSync(path.join(MAPS, '07-AbandonedDepot.cells'));
	const words = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
	const cells = words.slice(0, map.cells.cellsPerLayer);
	let fired = 0;
	const world = { doorTrig: () => { fired++; }, playSample: () => {} };

	const r = checkPad(state, cells, 11 * LEVEL + 7 * 23 + 11, true, world);
	eq(r.delayTicks, 100, '20 tenths of a second is 100 vblanks');
	eq(fired, 0, 'and the action does not land yet');
	stepButtons(state, cells, world, 99);
	eq(fired, 0, 'still not at 99');
	stepButtons(state, cells, world, 1);
	eq(fired, 1, 'and lands on the hundredth');
}

// --- a button's index has to match its table slot ---------------------------------------
//
// doorTrig and the lift actions index the port's door/lift arrays with a number
// derived from a byte offset into the RAW table. createDoorState/createLiftState
// drop empty slots, so a gap before a referenced slot would silently retarget
// the wrong door. No shipped map has one -- but the editor can make one.
{
	let shifted = 0, maps = 0;
	for (const f of fs.readdirSync(MAPS)) {
		if (!f.endsWith('.json') || /^campaign|^maps\.json/.test(f)) continue;
		maps++;
		const m = JSON.parse(fs.readFileSync(path.join(MAPS, f), 'utf8'));
		for (const key of ['doors', 'lifts']) {
			const raw = m[key] || [];
			const kept = raw.filter((r) => r && r.posn);
			if (raw.some((r, i) => kept[i] !== r)) shifted++;
		}
	}
	eq(maps, 47, 'checked every map');
	eq(shifted, 0, 'no shipped table has a gap that would shift a button target');
}

console.log(`button timing: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
