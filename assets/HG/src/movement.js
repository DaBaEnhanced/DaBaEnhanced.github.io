// Player movement: a port of `move` and its callers (Controls&Movement.s:4729).
//
// The original couples the player to the map in both directions. `mem_position`
// is a pointer into the cell array, and the player's own figure is written INTO
// the cell it occupies (put_head_in_map) so the other three views can see them.
// Moving is therefore: erase yourself, test the target, write yourself back.
//
// Stairs are not blocks you climb. Standing on a cell whose AUX field matches
// the direction you are facing steps you up a level as you walk forward, and a
// matching stairs BLOCK in the cell below steps you down. The aux and block
// values encode which way the flight runs, which is why they are direction
// tables rather than constants.

import { MAP_WIDTH, MAP_DEPTH, MAP_HEIGHT, LEVEL_CELLS, cellIndex } from './view.js';

// Cell field layout (Equates.i).
const FLOOR_HERE = 1, BLOCK_HERE = 2, AUX_HERE = 1 << 5;
const OPAQUE_BIT = 1 << 6;
const SHIFT = { floor: 9, block: 11, water: 17, variant: 23, aux: 28 };
const MASK = { block: 0x3f, water: 0x3, variant: 0x1f, aux: 0xf };
const KEEP_PERSON = (0x3f << SHIFT.block) | (0x1f << SHIFT.variant);

// Block types, from the style graphic table (block type = graphic index - 5).
export const BLOCK = {
	STONE: 0, PUSH: 1, BOOST: 2, EXIT: 3, TREE: 4, FIELD3: 5, TELEPORT: 6,
	HYDRAULIC: 7, MONSTER_FIRST: 8, MONSTER_LAST: 15,
	STAIRS_SOUTH: 16, STAIRS_WEST: 17, STAIRS_NORTH: 18, STAIRS_EAST: 19,
	DOOR_FRONT: 20, DOOR_SIDE: 21,
	EXGFX_FIRST: 22, EXGFX_LAST: 31, PLAYER_FIRST: 32, PLAYER_LAST: 47,
};

// `forward` (Controls&Movement.s:4905) sets three direction-dependent values:
// the step, the AUX value that means "stairs up this way", and the BLOCK value
// in the cell below that means "stairs down this way".
const STEP = [
	{ dx: 0, dy: -1, up: 8, down: BLOCK.STAIRS_NORTH },  // north
	{ dx: 1, dy: 0, up: 9, down: BLOCK.STAIRS_EAST },    // east
	{ dx: 0, dy: 1, up: 10, down: BLOCK.STAIRS_SOUTH },  // south
	{ dx: -1, dy: 0, up: 11, down: BLOCK.STAIRS_WEST },  // west
];

const blockType = (cell) => (cell >>> SHIFT.block) & MASK.block;
const hasBlock = (cell) => (cell & BLOCK_HERE) !== 0;
const waterLevel = (cell) => (cell >>> SHIFT.water) & MASK.water;
const inBounds = (x, y, f) =>
	x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_DEPTH && f >= 0 && f < MAP_HEIGHT;

/** Outcomes `move` can produce, so the caller can react without re-deriving. */
export const MOVE = {
	NONE: 'none',           // could not move and nothing else happened
	MOVED: 'moved',
	DOOR: 'door',           // walked into a door: trigger it
	BUMP: 'bump',
	EXIT: 'exit',           // walked into the level exit
	TELEPORT: 'teleport',
	BOOST: 'boost',
	BUMPED_PLAYER: 'player',
};

/**
 * Can the player stand in this cell at all? A cell supports you if it has a
 * floor, or the cell below holds a block, or the one two below holds a tree, or
 * it is flooded to at least half depth (you tread water).
 */
function supported(cells, idx) {
	if (cells[idx] & FLOOR_HERE) return true;
	const below = idx - LEVEL_CELLS;
	if (below >= 0 && hasBlock(cells[below])) return true;
	const below2 = idx - 2 * LEVEL_CELLS;
	if (below2 >= 0 && hasBlock(cells[below2]) && blockType(cells[below2]) === BLOCK.TREE) {
		return true;
	}
	return waterLevel(cells[idx]) >= 2 && (cells[idx] & 4) !== 0;
}

/**
 * Walk one step. `player` is mutated in place on success.
 *
 * @param dir  0-3 facing to step along; pass the facing for forward, the
 *             reverse for backward, and a rotated one for a sidestep.
 * @param auto true for the follow-the-leader AI, which refuses to walk off
 *             ledges the player is allowed to jump from.
 * @returns one of MOVE.*, plus the target cell index where meaningful.
 */
export function move(cells, player, dir, auto = false) {
	const here = cellIndex(player.x, player.y, player.floor);
	if (!supported(cells, here)) return { result: MOVE.NONE };

	const step = STEP[dir & 3];
	let { x, y, floor } = player;
	let nx = x + step.dx, ny = y + step.dy, nfloor = floor;

	// Stairs up: this cell's aux marks a flight running the way we are facing,
	// and the cell above the target must be clear to climb into.
	const auxHere = (cells[here] & AUX_HERE) ? (cells[here] >>> SHIFT.aux) & MASK.aux : -1;
	if (auxHere === step.up) {
		const above = here + LEVEL_CELLS;
		if (above >= cells.length) return { result: MOVE.NONE };
		if (cells[above] & (BLOCK_HERE | FLOOR_HERE | OPAQUE_BIT)) return { result: MOVE.NONE };
		nfloor = floor + 1;
	} else {
		// Stairs down: a matching stairs block sits in the cell below this one.
		const below = here - LEVEL_CELLS;
		const downStairs = below >= 0 && hasBlock(cells[below]) && blockType(cells[below]) === step.down;
		if (downStairs && inBounds(nx, ny, floor)) {
			const target = cellIndex(nx, ny, floor);
			// Only descend if the target has no floor of its own; otherwise the
			// flight is walled off and you simply walk onto it.
			if (!(cells[target] & FLOOR_HERE)) {
				const under = target - LEVEL_CELLS;
				const blocked = under >= 0 && (cells[under] & (BLOCK_HERE | OPAQUE_BIT));
				const t = under >= 0 ? blockType(cells[under]) : -1;
				const isPlayer = blocked && t >= BLOCK.PLAYER_FIRST && t <= BLOCK.PLAYER_LAST;
				if (!blocked || isPlayer) nfloor = floor - 1;
			}
		}
	}

	if (!inBounds(nx, ny, nfloor)) return { result: MOVE.NONE };
	const target = cellIndex(nx, ny, nfloor);
	const cell = cells[target];

	// Obstruction.
	if (cell & (BLOCK_HERE | OPAQUE_BIT)) {
		const t = blockType(cell);
		if (t === BLOCK.DOOR_FRONT || t === BLOCK.DOOR_SIDE) {
			return { result: MOVE.DOOR, target };
		}
		if (auto) return { result: MOVE.NONE };
		if (t === BLOCK.TELEPORT) return { result: MOVE.TELEPORT, target };
		if (t === BLOCK.BOOST) return { result: MOVE.BOOST, target };
		if (t === BLOCK.EXIT) return { result: MOVE.EXIT, target };
		if (t >= BLOCK.PLAYER_FIRST && t <= BLOCK.PLAYER_LAST) {
			return { result: MOVE.BUMPED_PLAYER, target };
		}
		return { result: MOVE.BUMP, target };
	}

	// Nothing in the way -- but is there anything to land on?
	if (!(cell & FLOOR_HERE)) {
		const under = target - LEVEL_CELLS;
		const underCell = under >= 0 ? cells[under] : 0;
		if (!hasBlock(underCell)) {
			// Open air. The player may step off and fall; the AI may not.
			if (auto) return { result: MOVE.NONE };
		} else {
			const t = blockType(underCell);
			// A tree below is a canopy you cannot stand on, monsters and exgfx
			// block the drop, but stairs and doors below are walkable.
			if (t === BLOCK.TREE) return { result: MOVE.NONE };
			if (t >= BLOCK.MONSTER_FIRST && t <= 15) return { result: MOVE.NONE };
			if (t >= BLOCK.EXGFX_FIRST && t <= BLOCK.PLAYER_LAST) return { result: MOVE.NONE };
		}
	}

	player.x = nx; player.y = ny; player.floor = nfloor;
	return { result: MOVE.MOVED, target };
}

/**
 * put_head_in_map: stamp the player's figure into the cell they occupy, so the
 * other three views render them. Block types 32-47 are the player figures --
 * base image plus facing -- and the variant field carries the player number
 * plus a glow offset.
 */
export function putHeadInMap(cells, player) {
	const idx = cellIndex(player.x, player.y, player.floor);
	const block = (player.headImages ?? BLOCK.PLAYER_FIRST) + (player.direction & 3);
	let variant = player.index & 3;
	if (player.fireWhite) variant += 8;
	else if (player.spellShield) variant += 4;
	cells[idx] = ((cells[idx] & ~KEEP_PERSON) | (block << SHIFT.block) |
		(variant << SHIFT.variant) | BLOCK_HERE) >>> 0;
}

/** Clear the player's figure out of a cell before moving away from it. */
export function removeHeadFromMap(cells, x, y, floor) {
	const idx = cellIndex(x, y, floor);
	cells[idx] = (cells[idx] & ~KEEP_PERSON & ~BLOCK_HERE) >>> 0;
}

// --- Teleport and boost pads -------------------------------------------------
//
// Both are BLOCKS you walk into (types 6 and 2), and both keep their payload in
// the ITEMS layer at the pad's own cell rather than in the cell word:
//   teleport  items[pad] = destination BYTE offset into map_data1
//   boost     items[pad] = fitness increment
// (Controls&Movement.s:8098, 8070 -- both start `add.l #map_part_size*2,a3`,
// which is exactly the step from map_data1 to the third layer.)

const MAX_FITNESS = 65535;

/**
 * teleport. Refuses to land you inside another player or solid geometry;
 * a monster or sentry standing on the pad is removed instead, reported through
 * hooks since neither is ported yet.
 *
 * @returns {moved, x, y, floor} or {blocked:true}
 */
export function teleport(cells, items, player, padCell, hooks = {}) {
	const dest = (items[padCell] >>> 2);
	if (!(dest >= 0 && dest < cells.length)) return { blocked: true };

	const cell = cells[dest];
	if (cell & BLOCK_HERE) {
		const t = blockType(cell);
		if (t >= BLOCK.PLAYER_FIRST && t <= BLOCK.PLAYER_LAST) return { blocked: true };
		if (t >= BLOCK.MONSTER_FIRST && t <= 15) hooks.onKillMonster?.(dest);
		// 1-7 is solid: stone, pushables and the field blocks all refuse you.
		else if (t >= 1 && t <= 7) return { blocked: true };
		else if (t >= 24 && t <= 27) hooks.onClearSentry?.(dest);
	}

	removeHeadFromMap(cells, player.x, player.y, player.floor);
	player.floor = Math.floor(dest / LEVEL_CELLS);
	const rem = dest % LEVEL_CELLS;
	player.y = Math.floor(rem / MAP_WIDTH);
	player.x = rem % MAP_WIDTH;
	putHeadInMap(cells, player);
	return { moved: true, x: player.x, y: player.y, floor: player.floor };
}

/** boost: a one-shot fitness top-up, the amount stored in the items layer. */
export function boost(items, player, padCell) {
	const amount = items[padCell] >>> 0;
	if (!player.stats) return 0;
	const before = player.stats.fitness | 0;
	player.stats.fitness = Math.min(MAX_FITNESS, before + amount);
	return player.stats.fitness - before;
}
