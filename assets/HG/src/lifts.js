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

/** Move the lift one level, carrying whatever is on it. */
function travel(lift, cells, riders, dy, opts, state = null) {
	const from = lift.cell;
	const to = from + dy * LEVEL_CELLS;
	if (to < 0 || to >= cells.length) { lift.direction = LIFT.STOPPED; return false; }

	const cell = cells[from];
	// Going up, the destination must be clear: a block, panel or floor jams it.
	if (dy > 0 && (cells[to] & (BLOCK_HERE | PANEL_HERE | FLOOR_HERE))) {
		lift.direction = LIFT.STOPPED;
		return false;
	}
	// Something on board that the lift is not rated to carry stops it dead.
	if ((cell & BLOCK_HERE) && (!lift.weight || !carriable(cell))) {
		lift.direction = LIFT.STOPPED;
		return false;
	}

	lift.height += dy;
	lift.cell = to;

	if (cell & PUSHABLE_BIT) movePushableAddress(opts.pushables, from, to, opts);

	// Shift the contents. Going UP the vacated cell becomes another section of
	// hydraulic column, which is what the platform rides on; going DOWN the
	// column shrinks instead, so the cell is cleared. Stamping a hydraulic in
	// both directions walls the lift in and it jams on the return trip.
	const carried = cell & CARRIED;
	cells[from] = dy > 0
		? ((cell & ~CARRIED) | HYDRAULIC) >>> 0
		: (cell & ~CARRIED) >>> 0;
	cells[to] = ((cells[to] & ~CARRIED) | carried) >>> 0;
	carryDataLayers(opts.seen, opts.items, from, to);

	// Anyone standing on it rides along.
	for (const p of riders) {
		if (!p || p.dead) continue;
		const riderCell = ('cell' in p) ? p.cell : cellIndex(p.x, p.y, p.floor);
		if (riderCell === from) {
			if ('cell' in p) {
				p.cell = to;
			} else {
				p.floor += dy;
				// find_heads_owner_quick: only a PLAYER being carried sets the
				// flag, which is why a lift moving a monster is silent.
				if (state) state.onLift = true;
			}
		}
	}
	return true;
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
