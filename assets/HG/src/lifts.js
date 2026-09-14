// Lifts: a port of move_lifts (Sources/Main.s:1808).
//
// A lift is not a moving block. The lift cell itself always holds a hydraulic
// column (block 7); what travels is the CONTENTS of the cell above it -- floor,
// block, aux, variant and the two data layers -- shifted one cell up or down
// while a fresh hydraulic is stamped into the vacated cell. Anything standing
// on it (a player, a monster, a sentry) is carried by rewriting its position,
// which is why riders keep working without the lift knowing what they are.
//
// The gate is `cmp.w #50,lift_count` -- 50 vblanks, exactly one second per
// level. That is the clearest confirmation in the source that the counters
// xcr_counters bumps really do run at the PAL frame rate.

import { LEVEL_CELLS, cellIndex } from './view.js';
import { BLOCK } from './movement.js';

const FLOOR_HERE = 1, BLOCK_HERE = 2, PANEL_HERE = 8, AUX_HERE = 1 << 5;
const PUSHABLE_BIT = 1 << 8;
const OPAQUE_BIT = 1 << 6;
const SHIFT = { floor: 9, block: 11, panel: 19, variant: 23, aux: 28 };
const MASK = { floor: 0x3, block: 0x3f, panel: 0x3, variant: 0x1f, aux: 0xf };

const KEEP_FLOOR = (MASK.floor << SHIFT.floor) | FLOOR_HERE;
const KEEP_BLOCK = (MASK.block << SHIFT.block) | BLOCK_HERE;
const KEEP_PANEL = (MASK.panel << SHIFT.panel) | PANEL_HERE;
const KEEP_AUX = (MASK.aux << SHIFT.aux) | AUX_HERE;
const KEEP_VARIANT = MASK.variant << SHIFT.variant;
const KEEP_AUX_DATA_HATCH = 0xfffff000;
const KEEP_ITEM_DATA_NO_QUESTION = 0x40ffffff;
// What a lift carries: keep_block_fall plus floor, variant and aux together.
// keep_block_fall includes panel, opaque and pushable bits (Equates.i:621).
const KEEP_BLOCK_FALL = KEEP_BLOCK | KEEP_PANEL | OPAQUE_BIT | PUSHABLE_BIT;
const CARRIED = KEEP_BLOCK_FALL | KEEP_FLOOR | KEEP_VARIANT | KEEP_AUX;
const HYDRAULIC = (BLOCK.HYDRAULIC << SHIFT.block) | BLOCK_HERE;
// What jams a rising lift: keep_block!keep_panel!keep_floor, type fields and
// here-bits alike (Main.s:1869).
const UP_BLOCKED = KEEP_BLOCK | KEEP_PANEL | KEEP_FLOOR;
// A floor holds its load up unless it is type 2, the open grating.
const FLOOR_OPEN = ((2 << SHIFT.floor) | FLOOR_HERE) >>> 0;
// erase_block_fall & erase_floor & erase_variant -- note aux is NOT cleared,
// which is the one place the down path differs from a plain CARRIED wipe.
const CLEAR_BELOW = (KEEP_BLOCK_FALL | KEEP_FLOOR | KEEP_VARIANT) >>> 0;
// Blocks 22 and 23 are the thrown and launched grenade. A lift carries the
// floor out from under one but leaves the grenade itself in place.
const GRENADE_A = ((22 << SHIFT.block) | BLOCK_HERE) >>> 0;
const GRENADE_B = ((23 << SHIFT.block) | BLOCK_HERE) >>> 0;

export const LIFT = { STOPPED: 0, UP: 1, DOWN: 2, AUTO_UP: 3, AUTO_DOWN: 4 };

// One level per 50 vblanks.
const LIFT_TICKS = 50;

const blockType = (cell) => (cell >>> SHIFT.block) & MASK.block;

/**
 * Is this block something a lift will carry? Monsters (8-15), players (32-47)
 * and sentries (24-27) ride; stairs and doors (16-23) and exgfx (28-31) jam it.
 */
function carriable(cell) {
	if (cell & PUSHABLE_BIT) return true;
	const t = blockType(cell);
	if (t < BLOCK.MONSTER_FIRST || t > BLOCK.PLAYER_LAST) return false;
	if (t > 31) return true;              // players
	if (t <= 15) return true;             // monsters
	return t >= 24 && t <= 27;            // sentries
}

export function createLiftState(lifts) {
	return {
		count: 0,
		// on_a_lift / last_on_a_lift (Main.s:1812). Set when a lift MOVES a
		// player, not when one is standing on it, and rolled over only on the
		// ticks a lift actually steps -- which is what keeps the motor running
		// continuously through a ride and silent on a lift that has stopped.
		onLift: false,
		lastOnLift: false,
		lifts: (lifts || []).filter((l) => l && l.posn).map((l) => ({
			cell: l.posn >>> 2,           // lift_posn is a BYTE offset
			height: l.height | 0,
			min: l.minHeight | 0,
			max: l.maxHeight | 0,
			direction: l.direction | 0,
			weight: l.weight | 0,         // 0 = cannot lift anything on it
			up: l.up | 0,                 // what to do on reaching the top
			down: l.down | 0,             // ... and the bottom
			automove: l.automove | 0,
		})),
	};
}

/** Buttons drive lifts through these (do_button_action 9-12). */
export function liftUp(state, cellIdx) { setLift(state, cellIdx, LIFT.UP); }
export function liftDown(state, cellIdx) { setLift(state, cellIdx, LIFT.DOWN); }
export function liftStop(state, cellIdx) { setLift(state, cellIdx, LIFT.STOPPED); }
export function liftToggle(state, cellIdx) {
	const l = find(state, cellIdx);
	if (!l) return;
	// A stopped lift picks the direction it can still travel in.
	if (l.direction === LIFT.UP || l.direction === LIFT.AUTO_UP) l.direction = LIFT.DOWN;
	else if (l.direction === LIFT.DOWN || l.direction === LIFT.AUTO_DOWN) l.direction = LIFT.UP;
	else l.direction = l.height >= l.max ? LIFT.DOWN : LIFT.UP;
}

const find = (state, cellIdx) => state.lifts.find((l) => l.cell === cellIdx);
function setLift(state, cellIdx, dir) { const l = find(state, cellIdx); if (l) l.direction = dir; }

/**
 * One frame of move_lifts. `ticks` is elapsed 50Hz vblanks.
 * `riders` is the player list, so anyone standing on a lift travels with it.
 */
export function moveLifts(state, cells, riders = [], ticks = 1, opts = {}) {
	state.count += ticks;
	if (state.count <= LIFT_TICKS) return false;
	state.count -= LIFT_TICKS;

	// Inside the gate, as the original clears it: between steps the flag holds,
	// so the motor does not stutter on and off during a ride.
	state.lastOnLift = state.onLift;
	state.onLift = false;

	let changed = false;
	for (const lift of state.lifts) {
		if (stepLift(lift, cells, riders, opts, state)) changed = true;
	}
	return changed;
}

/** Did a lift carry a player on its last step? Drives the motor noise. */
export function liftCarryingPlayer(state) { return !!(state && state.onLift); }

function stepLift(lift, cells, riders, opts, state = null) {
	const i = lift.cell;
	if (i < 0 || i >= cells.length) return false;
	const cell = cells[i];

	// An automove lift only commits once something is actually standing on it.
	if (lift.direction === LIFT.AUTO_UP || lift.direction === LIFT.AUTO_DOWN) {
		lift.direction = (cell & BLOCK_HERE)
			? (lift.direction === LIFT.AUTO_UP ? LIFT.UP : LIFT.DOWN)
			: LIFT.STOPPED;
	}

	if (lift.direction === LIFT.UP) {
		if (lift.height >= lift.max) { lift.direction = lift.up; return settle(lift, cells); }
		return travel(lift, cells, riders, +1, opts, state);
	}
	if (lift.direction === LIFT.DOWN) {
		if (lift.height <= lift.min) { lift.direction = lift.down; return settle(lift, cells); }
		return travel(lift, cells, riders, -1, opts, state);
	}
	return settle(lift, cells);
}

/**
 * Move the lift one level. The two directions are not mirror images of each
 * other in the source and must not be written as one path with a sign flip.
 */
function travel(lift, cells, riders, dy, opts, state = null) {
	const from = lift.cell;
	const to = from + dy * LEVEL_CELLS;
	if (to < 0 || to >= cells.length) { lift.direction = LIFT.STOPPED; return false; }
	return dy > 0
		? travelUp(lift, cells, riders, from, to, opts, state)
		: travelDown(lift, cells, riders, from, to, opts, state);
}

/** What a cell takes with it. A grenade leaves its block behind (Main.s:1925). */
const isGrenade = (cell) => {
	const b = (cell & KEEP_BLOCK) >>> 0;
	return b === GRENADE_A || b === GRENADE_B;
};
const carriedMask = (cell) => (isGrenade(cell) ? KEEP_FLOOR | KEEP_AUX : CARRIED);

/** Shift one cell's contents a level, stamping a fresh hydraulic behind it. */
function shift(cells, from, to, mask, hydraulic) {
	const carried = cells[from] & mask;
	cells[from] = hydraulic
		? ((cells[from] & ~mask) | HYDRAULIC) >>> 0
		: (cells[from] & ~mask) >>> 0;
	cells[to] = ((cells[to] & ~mask) | carried) >>> 0;
}

/**
 * Going up carries exactly one cell, and it is the only direction that consults
 * the weight: `.move_up` runs the class checks and `tst.b lift_weight`, while
 * `.move_down` decrements the height before it looks at anything. A weight-0
 * lift therefore refuses to raise a load but still lowers one, and ten of the
 * 284 shipped lifts are weight 0. The port applied the gate both ways, so
 * riding one of those down stopped it dead and left the rider a level high.
 */
function travelUp(lift, cells, riders, from, to, opts, state) {
	const cell = cells[from];
	// keep_block!keep_panel!keep_floor -- the type fields as well as the
	// here-bits, which is what the source ANDs against.
	if (cells[to] & UP_BLOCKED) { lift.direction = LIFT.STOPPED; return false; }

	// .lift_nothing_up: a bare platform rises carrying only the floor, and
	// never consults the weight.
	if (!(cell & (KEEP_BLOCK | KEEP_AUX))) {
		lift.height += 1;
		lift.cell = to;
		shift(cells, from, to, KEEP_FLOOR, true);
		return true;
	}
	// Aux with no block rides free too; only a block is weighed.
	if (cell & KEEP_BLOCK) {
		if (!lift.weight || !carriable(cell)) { lift.direction = LIFT.STOPPED; return false; }
	}

	lift.height += 1;
	lift.cell = to;
	if (cell & PUSHABLE_BIT) movePushableAddress(opts.pushables, from, to, opts);
	shift(cells, from, to, carriedMask(cell), true);
	carryDataLayers(opts.seen, opts.items, from, to);
	moveRiders(riders, from, to, +1, state);
	return true;
}

/**
 * Going down commits first and asks questions afterwards: `.move_down` drops
 * the height and the position before it has even read the platform.
 */
function travelDown(lift, cells, riders, from, to, opts, state) {
	lift.height -= 1;
	lift.cell = to;

	// .nothing_going_down: bare platform, floor only, and the destination loses
	// its block and variant but keeps its aux.
	if (!(cells[from] & (KEEP_BLOCK | KEEP_AUX))) {
		const carried = cells[from] & KEEP_FLOOR;
		cells[from] = (cells[from] & ~KEEP_FLOOR) >>> 0;
		cells[to] = ((cells[to] & ~CLEAR_BELOW) | carried) >>> 0;
		return true;
	}
	descend(cells, riders, from, to, opts, state);
	return true;
}

/**
 * `.move_down_loop`: a descending lift carries the whole COLUMN standing on it,
 * not just the cell above the hydraulic. Each pass moves one level down and
 * then steps both addresses up by `MAP_WIDTH*MAP_DEPTH*map_cell_size`, so a
 * crate with something standing on it arrives intact. The port moved a single
 * cell, which left everything above the platform hanging in the air.
 *
 * The walk stops at the first cell that is empty of block and aux, or that has
 * a floor of any type but 2 -- a real floor holds its load up rather than
 * letting the lift drag it down.
 */
function descend(cells, riders, from, to, opts, state) {
	const floors = Math.floor(cells.length / LEVEL_CELLS);
	let src = from, dst = to;
	for (let step = 0; step < floors; step++) {
		if (src >= cells.length) return;
		const cell = cells[src];
		if (!(cell & (KEEP_BLOCK | KEEP_AUX))) return;
		const floor = (cell & KEEP_FLOOR) >>> 0;
		if (floor && floor !== FLOOR_OPEN) return;

		carryDataLayers(opts.seen, opts.items, src, dst);

		if (cell & PUSHABLE_BIT) {
			movePushableAddress(opts.pushables, src, dst, opts);
			shift(cells, src, dst, CARRIED, false);
		} else if (cell & OPAQUE_BIT) {
			// .not_opaque_down is the branch AROUND this: an opaque block stays
			// where it is, only the floor beneath it travels, and nothing above
			// it is considered.
			const carried = cell & KEEP_FLOOR;
			cells[src] = (cell & ~KEEP_FLOOR) >>> 0;
			cells[dst] = ((cells[dst] & ~CLEAR_BELOW) | carried) >>> 0;
			return;
		} else if (isGrenade(cell)) {
			shift(cells, src, dst, KEEP_FLOOR | KEEP_AUX, false);
			return;
		} else {
			shift(cells, src, dst, CARRIED, false);
		}

		moveRiders(riders, src, dst, -1, state);
		src += LEVEL_CELLS;
		dst += LEVEL_CELLS;
	}
}

/** find_heads_owner_quick / find_monsters_owner: whoever stood there rides. */
function moveRiders(riders, from, to, dy, state) {
	for (const p of riders) {
		if (!p || p.dead) continue;
		const riderCell = ('cell' in p) ? p.cell : cellIndex(p.x, p.y, p.floor);
		if (riderCell !== from) continue;
		if ('cell' in p) {
			p.cell = to;
			// A monster is addressed by cell but ALSO carries x/y/floor, and
			// those have to follow it up the shaft. findClosestPlayer works in
			// x/y/floor and weights the floor difference by four before
			// squaring, against a cutoff of 100 -- so a monster left three
			// floors stale scores 144 for a player standing right next to it,
			// finds no target, and is skipped by moveMonsters for the rest of
			// the level. It stands on its cell, blocking it, while everything
			// that never rode a lift behaves normally.
			//
			// A lift only travels vertically, so the floor is the only part
			// that moves. Sentries carry no floor and are unaffected.
			if (typeof p.floor === 'number') p.floor += dy;
		} else {
			p.floor += dy;
			// find_heads_owner_quick: only a PLAYER being carried sets the
			// flag, which is why a lift moving a monster is silent.
			if (state) state.onLift = true;
		}
	}
}

function carryDataLayers(seen, items, from, to) {
	if (seen) {
		seen[to] = ((seen[to] & ~KEEP_AUX_DATA_HATCH) |
			(seen[from] & KEEP_AUX_DATA_HATCH)) >>> 0;
	}
	if (items) {
		items[to] = ((items[to] & ~KEEP_ITEM_DATA_NO_QUESTION) |
			(items[from] & KEEP_ITEM_DATA_NO_QUESTION)) >>> 0;
	}
}

function movePushableAddress(pushables, from, to, hooks = {}) {
	if (!pushables || !pushables.list) return false;
	const entry = pushables.list.find((p) => p.cell === from);
	if (!entry) {
		hooks.onOrphanPushable?.(from, to);
		return false;
	}
	hooks.onPad?.(from, false);
	hooks.onPad?.(to, true);
	entry.cell = to;
	return true;
}

/**
 * .lift_stopped: an automove lift re-arms itself once something is on board.
 * automove 1 only ever sends it up from the bottom, 2 only down from the top,
 * and anything else shuttles between the two.
 */
function settle(lift, cells) {
	if (!lift.automove) return false;
	const cell = cells[lift.cell];
	if (!carriable(cell)) return false;

	if (lift.automove === 1) {
		if (lift.height <= lift.min) lift.direction = LIFT.AUTO_UP;
	} else if (lift.automove === 2) {
		if (lift.height >= lift.max) lift.direction = LIFT.AUTO_DOWN;
	} else if (lift.height <= lift.min) {
		lift.direction = LIFT.AUTO_UP;
	} else if (lift.height >= lift.max) {
		lift.direction = LIFT.AUTO_DOWN;
	}
	return false;
}
