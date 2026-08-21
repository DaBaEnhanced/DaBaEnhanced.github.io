// Runtime sentry guns from Main.s.
//
// Deployed sentries are their own fixed table, not monsters. A live sentry is
// stamped into map_data1 as ExGfx block 24-27, with the variant field carrying
// the sentry slot number plus 16 while flashing white.

import { MAP_WIDTH, MAP_DEPTH, MAP_HEIGHT, LEVEL_CELLS, cellIndex } from './view.js';
import { BLOCK } from './movement.js';
import { addFireball, EXPL_DECAY } from './combat.js';

const FLOOR_HERE = 1, BLOCK_HERE = 2;
const OPAQUE_BIT = 1 << 6;
const SHIFT = { block: 11, variant: 23 };
const MASK = { block: 0x3f, variant: 0x1f };
const KEEP_PERSON = BLOCK_HERE | (MASK.block << SHIFT.block) |
	(MASK.variant << SHIFT.variant);
const SENTRY_COUNT = 16;
const SQUASH_DAMAGE = 2500;

const STEP = [
	{ dx: 0, dy: -1, delta: -MAP_WIDTH },
	{ dx: 1, dy: 0, delta: 1 },
	{ dx: 0, dy: 1, delta: MAP_WIDTH },
	{ dx: -1, dy: 0, delta: -1 },
];

const blockType = (cell) => (cell >>> SHIFT.block) & MASK.block;
const inMapCell = (idx) => idx >= 0 && idx < LEVEL_CELLS * MAP_HEIGHT;
const sameFloorStep = (from, to, dir) => {
	if (!inMapCell(to)) return false;
	if (dir === 1) return (from % MAP_WIDTH) < MAP_WIDTH - 1;
	if (dir === 3) return (from % MAP_WIDTH) > 0;
	if (dir === 0) return (from % LEVEL_CELLS) >= MAP_WIDTH;
	if (dir === 2) return (from % LEVEL_CELLS) < LEVEL_CELLS - MAP_WIDTH;
	return true;
};

export function createSentryState() {
	return {
		count: 0,
		sentries: Array.from({ length: SENTRY_COUNT }, (_, index) => ({
			index, active: false, cell: -1,
		})),
	};
}

export function activeSentries(state) {
	return state?.sentries?.filter((s) => s.active) || [];
}

function clearPerson(cells, idx) {
	if (inMapCell(idx)) cells[idx] = (cells[idx] & ~KEEP_PERSON) >>> 0;
}

function putSentryInMap(cells, s) {
	if (!s.active || !inMapCell(s.cell)) return;
	let variant = s.index & 15;
	if (s.white) variant += 16;
	clearPerson(cells, s.cell);
	cells[s.cell] = ((cells[s.cell] & ~KEEP_PERSON) | BLOCK_HERE |
		((24 + (s.direction & 3)) << SHIFT.block) |
		((variant & MASK.variant) << SHIFT.variant)) >>> 0;
	s.white = false;
}

export function addSentry(state, cells, cell, direction, itemMeta, owner = 0) {
	if (!state || !cells || !itemMeta?.sentry || !inMapCell(cell)) return false;
	const here = cells[cell] >>> 0;
	if (here & (BLOCK_HERE | OPAQUE_BIT)) return false;
	const s = state.sentries.find((entry) => !entry.active);
	if (!s) return false;
	Object.assign(s, {
		active: true,
		cell,
		direction: direction & 3,
		type: itemMeta.index + 1,
		owner: owner | 0,
		density: itemMeta.sentry.density | 0,
		rounds: itemMeta.sentry.rounds | 0,
		delay: itemMeta.sentry.delay | 0,
		fitness: 65535,
		physique: itemMeta.sentry.physique | 0,
		turnCount: 50,
		turnFlag: itemMeta.sentry.turnFlag | 0,
		shootPlayers: itemMeta.sentry.shootPlayers | 0,
		range: itemMeta.sentry.range | 0,
		white: false,
	});
	putSentryInMap(cells, s);
	return true;
}

export function moveSentries(state, cells, combatState, seen, items, ticks = 1, hooks = {}) {
	if (!state) return false;
	state.count += ticks;
	if (state.count <= 10) return false;
	state.count -= 10;
	let changed = false;
	for (const s of activeSentries(state)) {
		if (s.delay > 0) {
			s.delay -= 10;
			if (s.delay > 0) continue;
			s.delay = 0;
			hooks.onActivated?.(s);
		}
		if (s.turnFlag) {
			if (s.turnCount === 0) {
				s.direction = (s.direction + 1) & 3;
				s.turnCount = 60;
			}
			s.turnCount -= 10;
			changed = true;
		}
		if (sentryFire(s, cells, combatState, seen, items, hooks)) changed = true;
		putSentryInMap(cells, s);
		changed = true;
	}
	return changed;
}

function sentryFire(s, cells, combatState, seen, items, hooks) {
	const step = STEP[s.direction & 3];
	let idx = s.cell;
	for (let d = 0; d <= (s.range | 0); d++) {
		const next = idx + step.delta;
		if (!sameFloorStep(idx, next, s.direction & 3)) return false;
		idx = next;
		const cell = cells[idx] >>> 0;
		if (!(cell & BLOCK_HERE)) continue;
		const t = blockType(cell);
		if (t === BLOCK.TREE || t === BLOCK.FIELD3 || t === BLOCK.HYDRAULIC) continue;
		if (t >= BLOCK.MONSTER_FIRST && t <= BLOCK.MONSTER_LAST) {
			return addSentryFireball(s, cells, combatState, seen, items, hooks);
		}
		if (s.shootPlayers && t >= BLOCK.PLAYER_FIRST && t <= BLOCK.PLAYER_LAST) {
			return addSentryFireball(s, cells, combatState, seen, items, hooks);
		}
		return false;
	}
	return false;
}

function addSentryFireball(s, cells, combatState, seen, items, hooks) {
	return addFireball(combatState, cells, seen, items, s.cell, {
		direction: s.direction & 3,
		speed: 1,
		decay: EXPL_DECAY,
		density: Math.max(0, (s.density | 0) - 1),
		flameback: s.direction & 3,
		owner: (s.owner | 0) - 1,
		style: hooks.style | 0,
	}, hooks.combatHooks || {});
}

export function sentriesFall(state, cells, hooks = {}) {
	if (!state) return false;
	let changed = false;
	for (const s of activeSentries(state)) {
		if (sentryFall(state, cells, s, hooks)) changed = true;
	}
	return changed;
}

function sentryFall(_state, cells, s, hooks) {
	if (!inMapCell(s.cell) || (cells[s.cell] & FLOOR_HERE)) return false;
	const below = s.cell - LEVEL_CELLS;
	if (below < 0) return false;
	const belowCell = cells[below] >>> 0;
	if (!(belowCell & BLOCK_HERE)) {
		const person = cells[s.cell] & KEEP_PERSON;
		clearPerson(cells, s.cell);
		clearPerson(cells, below);
		cells[below] = (cells[below] | person) >>> 0;
		s.cell = below;
		return true;
	}
	const t = blockType(belowCell);
	if (t >= BLOCK.MONSTER_FIRST && t <= BLOCK.PLAYER_LAST) {
		if (t <= BLOCK.MONSTER_LAST) hooks.onSquashMonster?.(s, below, SQUASH_DAMAGE << 6);
		else if (t >= BLOCK.PLAYER_FIRST) hooks.onSquashPlayer?.(s, below, SQUASH_DAMAGE);
		else if (t >= 24 && t <= 27) hooks.onSquashSentry?.(s, below, SQUASH_DAMAGE);
	}
	return false;
}

function sentryByCell(state, cell) {
	if (!state) return null;
	return activeSentries(state).find((s) => s.cell === cell) || null;
}

export function damageSentryAtCell(state, cells, cell, hit) {
	const s = sentryByCell(state, cell);
	if (!s || hit <= 0) return false;
	const physique = Math.max(1, s.physique | 0);
	const damage = Math.floor(hit / physique) * 100;
	s.white = true;
	if (inMapCell(cell)) cells[cell] = (cells[cell] | (16 << SHIFT.variant)) >>> 0;
	if (damage > (s.fitness | 0)) {
		clearPerson(cells, s.cell);
		s.active = false;
		s.cell = -1;
		s.fitness = 0;
		return true;
	}
	s.fitness -= damage;
	putSentryInMap(cells, s);
	return false;
}

export function clearSentryAtCell(state, cells, cell) {
	const s = sentryByCell(state, cell);
	if (!s) return false;
	clearPerson(cells, s.cell);
	s.active = false;
	s.cell = -1;
	s.fitness = 0;
	return true;
}


/**
 * Take over the sentry standing on `cell`.
 *
 * A NEW CAPABILITY, not a restored one. The original reserved a whole item
 * category for this -- CAT_SENTRYCNTRL, 25 -- wired it into the use dispatch and
 * then left `.use_sentrycntrl` as a bare `rts` (ItemUsage.s:58). No shipped item
 * was ever given the category, so nothing could reach it.
 *
 * Two things change, and they are the two fields that decide whose side a
 * sentry is on:
 *
 *   owner         whose fireballs these are; addSentryFireball passes owner-1,
 *                 so this is stored one-based and 0 means nobody
 *   shootPlayers  both shipped kits set this, and moveSentries reads it
 *                 straight -- which is why your own turret happily shoots your
 *                 own party. Clearing it is the point of the exercise.
 *
 * It keeps firing at monsters either way: that check is unconditional.
 *
 * @returns null when there is no sentry there, else what changed
 */
export function takeOverSentry(state, cells, cell, owner) {
	if (!state || !inMapCell(cell)) return null;
	const s = state.sentries.find((entry) => entry.active && entry.cell === cell);
	if (!s) return null;
	const before = { owner: s.owner | 0, shootPlayers: s.shootPlayers | 0 };
	s.owner = owner | 0;
	s.shootPlayers = 0;
	// A takeover reads as an event, so flash it the way a hit does.
	s.white = true;
	putSentryInMap(cells, s);
	return {
		sentry: s,
		wasHostile: before.shootPlayers !== 0,
		changedOwner: before.owner !== (owner | 0),
		before,
	};
}

/** Is there a sentry on this cell? */
export function sentryAtCell(state, cell) {
	if (!state || !inMapCell(cell)) return null;
	return state.sentries.find((s) => s.active && s.cell === cell) || null;
}
