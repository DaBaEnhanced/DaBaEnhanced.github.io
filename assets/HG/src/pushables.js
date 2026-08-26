// Pushable blocks: a port of the .push path in activate_it and move_pushable
// (Sources/Controls&Movement.s:6540, 7726).
//
// Pushing is not a single-block operation. activate_it walks FORWARD from the
// player over every consecutive pushable, finds the first free cell beyond the
// row, then moves the blocks back-to-front into it -- furthest first, each into
// the space the one ahead just vacated -- and finally steps the player in. So a
// line of crates shuffles along together, and the whole row fails as one if the
// far end is blocked.
//
// A pushable is identified by the PUSHABLE bit in its cell, but its identity
// lives in the map's pushables table: an entry maps a cell offset to the cell
// word to stamp down when it arrives. Moving one therefore means rewriting that
// table entry's position, not just the two cells.

import { LEVEL_CELLS, MAP_WIDTH, MAP_DEPTH, cellIndex } from './view.js';
import { removeHeadFromMap, putHeadInMap } from './movement.js';

const FLOOR_HERE = 1, BLOCK_HERE = 2, PANEL_HERE = 8, AUX_HERE = 1 << 5;
const OPAQUE_BIT = 1 << 6;
const PUSHABLE_BIT = 1 << 8;
const SHIFT = { block: 11, panel: 19, aux: 28 };
const MASK = { block: 0x3f, aux: 0xf };

const KEEP_BLOCK = MASK.block << SHIFT.block;
const KEEP_PANEL = 0x3 << SHIFT.panel;
const KEEP_AUX = (MASK.aux << SHIFT.aux) | AUX_HERE;
const KEEP_AUX_DATA_HATCH = 0xfffff000;
const KEEP_ITEM_DATA = 0x00ffffff;
const KEEP_NO_QUESTION = 1 << 30;
const KEEP_QUESTION_MARK = 1 << 10;
// What move_pushable clears out of both the vacated and the entered cell.
const CLEARED = KEEP_BLOCK | BLOCK_HERE | KEEP_PANEL | PANEL_HERE | OPAQUE_BIT | PUSHABLE_BIT;

const BLOCK_TELEPORT = 6;
const BLOCK_PUSH = 1;
const STEP = [[0, -1], [1, 0], [0, 1], [-1, 0]];

const blockType = (cell) => (cell >>> SHIFT.block) & MASK.block;
const auxType = (cell) => (cell >>> SHIFT.aux) & MASK.aux;
const inBounds = (x, y) => x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_DEPTH;

function copyCarriedLayers(cells, seen, items, from, dest) {
	if (!seen || !items) return;
	const above = from + LEVEL_CELLS;
	if (above < 0 || above >= cells.length) return;
	const aux = cells[above] & KEEP_AUX;
	if (!aux || (cells[above] & FLOOR_HERE)) return;
	cells[above] = (cells[above] & ~KEEP_AUX) >>> 0;

	const force = dest === from - LEVEL_CELLS;
	const destAbove = dest + LEVEL_CELLS;
	if (destAbove < 0 || destAbove >= cells.length) return;
	const blocker = cells[destAbove] >>> 0;
	if (!force && (blocker & (FLOOR_HERE | OPAQUE_BIT))) return;

	cells[destAbove] = ((cells[destAbove] & ~KEEP_AUX) | aux) >>> 0;
	seen[destAbove] = ((seen[destAbove] & ~KEEP_AUX_DATA_HATCH) |
		(seen[above] & KEEP_AUX_DATA_HATCH)) >>> 0;
	items[destAbove] = ((items[destAbove] & ~KEEP_ITEM_DATA) |
		(items[above] & KEEP_ITEM_DATA)) >>> 0;
}

function copyNoQuestion(seen, items, from, dest, metalPushable) {
	if (!items) return;
	const bit = items[from] & KEEP_NO_QUESTION;
	items[dest] = ((items[dest] & ~KEEP_NO_QUESTION) | bit) >>> 0;
	if (metalPushable || bit) return;
	items[dest] = (items[dest] | KEEP_NO_QUESTION) >>> 0;
	if (seen) seen[from] = (seen[from] | KEEP_QUESTION_MARK) >>> 0;
}

export function createPushableState(pushables) {
	return {
		// pushable_posn is a BYTE offset into map_data1; pushable_cell is the cell
		// word stamped down wherever the block ends up.
		list: (pushables || []).filter((p) => p && p.posn).map((p) => ({
			cell: p.posn >>> 2,
			template: p.cell >>> 0,
		})),
	};
}

const findPushable = (state, cellIdx) => state.list.find((p) => p.cell === cellIdx);

/**
 * move_pushable: shift one block from `from` to `to`.
 *
 * A destination holding a block is normally a refusal -- the one exception is a
 * teleport block, which the crate is pushed THROUGH, re-emerging at the address
 * held in the items layer (and refused if that is occupied in turn).
 *
 * @returns true when the block moved.
 */
export function movePushable(cells, items, state, from, to, hooks = {}) {
	if (to < 0 || to >= cells.length || from < 0 || from >= cells.length) return false;

	let dest = to;
	if (cells[dest] & BLOCK_HERE) {
		if (blockType(cells[dest]) !== BLOCK_TELEPORT) return false;
		const through = items[dest] >>> 2;
		if (!(through >= 0 && through < cells.length)) return false;
		if (cells[through] & BLOCK_HERE) return false;
		dest = through;
		hooks.onTeleported?.(to, through);
	}

	// Pushables trip pressure pads exactly as players do -- released on the cell
	// left behind, pushed on the one entered.
	hooks.onPad?.(from, false);
	hooks.onPad?.(dest, true);

	// Crush: anything lying in the destination is destroyed, unless the block is
	// rising straight up (a lift carrying it) or the aux is one of the 8-13 group.
	if (dest !== from + LEVEL_CELLS && (cells[dest] & AUX_HERE)) {
		const a = auxType(cells[dest]);
		if (a <= 7 || a > 13) {
			cells[dest] = (cells[dest] & ~KEEP_AUX) >>> 0;
			hooks.onCrush?.(dest, a);
		}
	}

	cells[from] = (cells[from] & ~CLEARED) >>> 0;
	cells[dest] = (cells[dest] & ~CLEARED) >>> 0;
	copyCarriedLayers(cells, hooks.seen, items, from, dest);

	const entry = findPushable(state, from);
	if (entry) {
		entry.cell = dest;
		cells[dest] = (cells[dest] | entry.template) >>> 0;
		copyNoQuestion(hooks.seen, items, from, dest,
			((entry.template >>> SHIFT.block) & MASK.block) === BLOCK_PUSH);
	} else {
		// The original halts with a red screen here; the port keeps the block
		// visible rather than losing it, and reports the inconsistency.
		hooks.onOrphan?.(from, dest);
		cells[dest] = (cells[dest] | BLOCK_HERE | PUSHABLE_BIT) >>> 0;
	}
	return true;
}

/**
 * The .push branch of activate_it: shove the row of pushables the player faces.
 *
 * @returns {moved, count} -- count is how many blocks shifted.
 */
export function pushRow(cells, items, state, player, hooks = {}) {
	const [dx, dy] = STEP[player.direction & 3];
	const here = cellIndex(player.x, player.y, player.floor);

	// .push opens with `andi.l #erase_person,(a2)` -- lift the player OUT of the
	// map before anything moves. Without it the pusher's own figure is left
	// stamped in the cell behind them, which keeps BLOCK_HERE set there and the
	// vacated square stays impassable.
	removeHeadFromMap(cells, player.x, player.y, player.floor);

	// Walk forward over the run of pushables to find the first free cell.
	const chain = [];
	let x = player.x + dx, y = player.y + dy;
	while (x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_DEPTH) {
		const idx = cellIndex(x, y, player.floor);
		if (!(cells[idx] & PUSHABLE_BIT)) {
			// The cell beyond the row. Aux 2-7 lying there blocks the push; an
			// empty cell or aux 0/1 lets it through.
			if (cells[idx] & AUX_HERE) {
				const a = auxType(cells[idx]);
				if (a >= 2 && a <= 7) { putHeadInMap(cells, player); return { moved: false, count: 0 }; }
			}
			chain.push({ free: idx });
			break;
		}
		chain.push({ block: idx });
		x += dx; y += dy;
	}
	const abort = () => { putHeadInMap(cells, player); return { moved: false, count: 0 }; };
	if (!chain.length || chain[0].block === undefined) return abort();
	if (chain[chain.length - 1].free === undefined) return abort();

	// Move back to front: the furthest block goes into the free cell, then each
	// one behind fills the gap just opened.
	const free = chain[chain.length - 1].free;
	const blocks = chain.slice(0, -1).map((c) => c.block);
	let target = free;
	let count = 0;
	for (let i = blocks.length - 1; i >= 0; i--) {
		if (!movePushable(cells, items, state, blocks[i], target, hooks)) {
			putHeadInMap(cells, player);
			return { moved: count > 0, count };
		}
		target = blocks[i];
		count++;
	}

	// The player follows into the space the nearest block vacated.
	hooks.onPad?.(here, false);
	player.x += dx; player.y += dy;
	hooks.onPad?.(cellIndex(player.x, player.y, player.floor), true);
	putHeadInMap(cells, player);          // .all_moved ends with put_head_in_map
	return { moved: true, count };
}

/**
 * pull_block: drag the pushable in front of the player into the player's old
 * cell, then step the player backward. Unlike pushing, this moves exactly one
 * block; if there is no pushable in front the original falls through to
 * reload_item, which inventory has not reached yet.
 */
export function pullBlock(cells, items, state, player, hooks = {}) {
	const [dx, dy] = STEP[player.direction & 3];
	const here = cellIndex(player.x, player.y, player.floor);
	const frontX = player.x + dx, frontY = player.y + dy;
	const backX = player.x - dx, backY = player.y - dy;

	if (!inBounds(frontX, frontY) || !inBounds(backX, backY)) {
		return { moved: false, reason: 'blocked' };
	}
	const front = cellIndex(frontX, frontY, player.floor);
	const back = cellIndex(backX, backY, player.floor);

	removeHeadFromMap(cells, player.x, player.y, player.floor);
	const abort = (reason) => {
		putHeadInMap(cells, player);
		return { moved: false, reason };
	};

	if (!(cells[front] & PUSHABLE_BIT)) return abort('reload');
	if (pullRearBlocked(cells, back)) return abort('blocked');
	if (cells[back] & BLOCK_HERE) return abort('blocked');
	if (!canPullFrom(cells[here])) return abort('blocked');
	if (!movePushable(cells, items, state, front, here, hooks)) return abort('blocked');

	player.x = backX; player.y = backY;
	hooks.onPad?.(here, false);
	hooks.onPad?.(cellIndex(player.x, player.y, player.floor), true);
	putHeadInMap(cells, player);
	return { moved: true, count: 1 };
}

function pullRearBlocked(cells, back) {
	const below = back - LEVEL_CELLS;
	if (below < 0 || !(cells[below] & BLOCK_HERE)) return false;
	const t = blockType(cells[below]);
	if (t < 8 || t > 47) return false;
	if (t >= 16 && t < 21) return false;
	return !(cells[back] & FLOOR_HERE);
}

function canPullFrom(cell) {
	if (!(cell & AUX_HERE)) return true;
	const a = auxType(cell);
	return a === 1 || a > 7;
}

/**
 * Read-only version of pull_block's eligibility checks. Mobile controls use
 * this to show Pull only when pressing it can actually move the block.
 */
export function canPullBlock(cells, player) {
	if (!cells || !player) return false;
	const [dx, dy] = STEP[player.direction & 3];
	const frontX = player.x + dx, frontY = player.y + dy;
	const backX = player.x - dx, backY = player.y - dy;
	if (!inBounds(frontX, frontY) || !inBounds(backX, backY)) return false;
	const here = cellIndex(player.x, player.y, player.floor);
	const front = cellIndex(frontX, frontY, player.floor);
	const back = cellIndex(backX, backY, player.floor);
	return !!(cells[front] & PUSHABLE_BIT) &&
		!pullRearBlocked(cells, back) &&
		!(cells[back] & BLOCK_HERE) &&
		canPullFrom(cells[here]);
}

// --- Falling blocks ----------------------------------------------------------
//
// blocks_fall (Sources/Main.s:4221), the other half of stuff_falls. An
// unsupported pushable drops a level per tick, reusing the same mover.
//
// The interesting case is .any_stairs: a block below does NOT always stop the
// fall. A teleport block below is fallen straight through, and a STAIRS block
// below makes the crate tumble diagonally -- it continues down AND sideways in
// the direction the flight runs, provided the cell that way is clear of both
// block and floor. That is how a crate pushed into a stairwell works its way to
// the bottom instead of perching on the top step.
const STAIRS_FALL = {
	16: MAP_WIDTH,    // stairs down to the south
	17: -1,           // ... west
	18: -MAP_WIDTH,   // ... north
	19: 1,            // ... east
};

/**
 * One tick of blocks_fall. Call on the same gate as players_fall.
 * @returns true when anything moved.
 */
export function blocksFall(cells, items, state, hooks = {}) {
	let changed = false;
	// Snapshot: movePushable rewrites entry.cell as it goes.
	for (const entry of [...state.list]) {
		const from = entry.cell;
		if (from < LEVEL_CELLS || from >= cells.length) continue;
		// Its own cell having a floor is what holds it up.
		if (cells[from] & FLOOR_HERE) continue;

		const below = from - LEVEL_CELLS;
		let dest = below;

		if (cells[below] & BLOCK_HERE) {
			const t = blockType(cells[below]);
			if (t === BLOCK_TELEPORT) {
				// movePushable follows the teleport through on its own.
			} else if (STAIRS_FALL[t] !== undefined) {
				const side = from + STAIRS_FALL[t];
				if (side < 0 || side >= cells.length) continue;
				// The way off the step has to be clear of both block and floor.
				if (cells[side] & (BLOCK_HERE | FLOOR_HERE)) continue;
				dest = below + STAIRS_FALL[t];
			} else {
				continue;                       // anything else holds it up
			}
		}

		if (!movePushable(cells, items, state, from, dest, hooks)) continue;
		changed = true;
		// The block moved. Whether that was a landing or just another level of
		// falling decides the thud (Main.s:4270), so it is asked here rather
		// than waiting for the next tick to find it cannot move again.
		if (blockHasLanded(cells, entry.cell)) hooks.onBlockLand?.(entry.cell);
	}
	return changed;
}

/**
 * Has a block that just fell come to rest on something, and is that something
 * worth a noise?
 *
 * Main.s:4270, straight down the branch list. Two of the cases are silent for
 * different reasons: empty space below means it is still falling and will land
 * on a later tick, while a creature below is squashed, and the squash has its
 * own handling rather than a landing thump.
 */
function blockHasLanded(cells, dest) {
	if (dest < 0 || dest >= cells.length) return false;
	if (cells[dest] & FLOOR_HERE) return true;          // a floor to hit
	const under = dest - LEVEL_CELLS;
	if (under < 0) return true;                          // the bottom of the map
	const below = cells[under] >>> 0;
	if (below & OPAQUE_BIT) return true;
	if (!(below & BLOCK_HERE)) return false;             // nothing there yet
	const t = blockType(below);
	if (t < 8 || t > 47) return true;                    // scenery and walls
	if (t < 16) return false;                            // 8-15  monster, squashed
	if (t >= 32) return false;                           // 32-47 player, squashed
	if (t < 22 || t > 27) return true;                   // stairs, doors, exgfx
	if (t >= 24) return false;                           // 24-27 sentry, squashed
	return false;                                        // 22-23 grenades
}
