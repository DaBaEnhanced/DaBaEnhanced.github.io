// Fireballs, thrown grenades, mines, and direct weapon hits.
//
// This follows the source's data model rather than making projectiles a render
// overlay. Live fireballs write the EXPLOSION field into map_data1, and thrown
// grenades are temporary EXGFX blocks 22/23 with height stored in VARIANT.

import { MAP_WIDTH, MAP_DEPTH, MAP_HEIGHT, LEVEL_CELLS, cellIndex } from './view.js';
import { BLOCK } from './movement.js';

const FLOOR_HERE = 1, BLOCK_HERE = 2, AUX_HERE = 1 << 5;
const OPAQUE_BIT = 1 << 6;
const EXPLOSION_HERE = 1 << 4;
const SHIFT = {
	block: 11, itemType: 0, itemDamage: 8, itemAmmo: 16,
	explosion: 21, variant: 23, aux: 28,
};
const MASK = { block: 0x3f, explosion: 0x3, variant: 0x1f, aux: 0xf };
const KEEP_BLOCK = BLOCK_HERE | (MASK.block << SHIFT.block);
const KEEP_VARIANT = MASK.variant << SHIFT.variant;
const KEEP_AUX = AUX_HERE | (MASK.aux << SHIFT.aux);
const KEEP_ITEM_DATA = 0x00ffffff;
const KEEP_EXPLOSION = EXPLOSION_HERE | (MASK.explosion << SHIFT.explosion);
const ERASE_EXPLOSION = ~KEEP_EXPLOSION;
const ERASE_PERSON = ~(KEEP_BLOCK | KEEP_VARIANT);
const AUX_EGG_CLOSED = 0;
const AUX_EGG_OPEN = 1;
const EXPL_NO_DECAY = 0;
const EXPL_DECAY = 1;
const EXPL_VANISH = 2;
const FIREBALL_COUNT = 32;
const GRENADE_COUNT = 32;
const FIREBALL_TICK = 10;
const EXP_KILL = 10;

const STEP = [
	{ dx: 0, dy: -1, dz: 0, delta: -MAP_WIDTH },
	{ dx: 1, dy: 0, dz: 0, delta: 1 },
	{ dx: 0, dy: 1, dz: 0, delta: MAP_WIDTH },
	{ dx: -1, dy: 0, dz: 0, delta: -1 },
	{ dx: 0, dy: 0, dz: -1, delta: -LEVEL_CELLS },
	{ dx: 0, dy: 0, dz: 1, delta: LEVEL_CELLS },
];

const blockType = (cell) => (cell >>> SHIFT.block) & MASK.block;
const auxType = (cell) => (cell >>> SHIFT.aux) & MASK.aux;
const inMapCell = (idx) => idx >= 0 && idx < LEVEL_CELLS * MAP_HEIGHT;
const sameFloorStep = (from, to, dir) => {
	if (!inMapCell(to)) return false;
	if (dir === 1) return (from % MAP_WIDTH) < MAP_WIDTH - 1;
	if (dir === 3) return (from % MAP_WIDTH) > 0;
	if (dir === 0) return (from % LEVEL_CELLS) >= MAP_WIDTH;
	if (dir === 2) return (from % LEVEL_CELLS) < LEVEL_CELLS - MAP_WIDTH;
	return true;
};

export function createCombatState() {
	return {
		count: 0,
		random: 0x1234,
		fireballs: Array.from({ length: FIREBALL_COUNT }, () => ({ pos: 0 })),
		grenades: Array.from({ length: GRENADE_COUNT }, () => ({ pos: 0 })),
	};
}

function nextRandom(state) {
	let d = ((state.random & 0xffff) * 47) & 0xffff;
	d = ((d << 7) | (d >>> 9)) & 0xffff;
	state.random = d;
	return d;
}

function clearExplosion(cells, idx) {
	if (inMapCell(idx)) cells[idx] = (cells[idx] & ERASE_EXPLOSION) >>> 0;
}

function stampExplosion(cells, idx, density) {
	if (!inMapCell(idx)) return;
	const d = Math.max(0, Math.min(3, density | 0));
	cells[idx] = ((cells[idx] & ERASE_EXPLOSION) |
		(d << SHIFT.explosion) | EXPLOSION_HERE) >>> 0;
}

function clearBlock(cells, idx) {
	if (inMapCell(idx)) cells[idx] = (cells[idx] & ERASE_PERSON & ~BLOCK_HERE) >>> 0;
}

function stampGrenade(cells, g) {
	if (!inMapCell(g.pos)) return;
	const block = g.type ? 23 : 22;
	const variant = (g.height | 0) & 31;
	cells[g.pos] = ((cells[g.pos] & ~KEEP_BLOCK & ~KEEP_VARIANT) |
		BLOCK_HERE | (block << SHIFT.block) | (variant << SHIFT.variant)) >>> 0;
	g.stamped = true;
}

function clearAux(cells, items, idx) {
	cells[idx] = (cells[idx] & ~KEEP_AUX) >>> 0;
	if (items) items[idx] = (items[idx] & ~KEEP_ITEM_DATA) >>> 0;
}

function openEgg(cells, seen, items, idx, hooks) {
	if (!inMapCell(idx) || !(cells[idx] & AUX_HERE) || auxType(cells[idx]) !== AUX_EGG_CLOSED) {
		return false;
	}
	if (hooks.hatchEggAt) return !!hooks.hatchEggAt(idx);
	cells[idx] = ((cells[idx] & ~KEEP_AUX) | AUX_HERE | (AUX_EGG_OPEN << SHIFT.aux)) >>> 0;
	if (seen) seen[idx] = (seen[idx] & ~(0xff << 12)) >>> 0;
	if (items) items[idx] = (items[idx] & ~KEEP_ITEM_DATA) >>> 0;
	return true;
}

function blocksFireball(cell, style) {
	if (cell === OPAQUE_BIT) return 'kill';
	if (cell & OPAQUE_BIT) return true;
	if (!(cell & BLOCK_HERE)) return false;
	const t = blockType(cell);
	if (t === BLOCK.TREE && style !== 0 && style !== 2) return true;
	return t >= 16 && t <= 21;
}

function chuckStartCell(cells, from, dir, style) {
	const step = STEP[dir & 7];
	if (!step || !sameFloorStep(from, from + step.delta, dir)) return from;
	const dest = from + step.delta;
	const cell = cells[dest] >>> 0;
	if (cell & OPAQUE_BIT) return from;
	if (!(cell & BLOCK_HERE)) return dest;
	const t = blockType(cell);
	if (t === BLOCK.TREE && style !== 0 && style !== 2) return from;
	if ((t === BLOCK.DOOR_FRONT || t === BLOCK.DOOR_SIDE) && style !== 1 && style !== 3) {
		const variant = (cell >>> SHIFT.variant) & MASK.variant;
		return variant < 5 ? from : dest;
	}
	return dest;
}

export function addFireball(state, cells, seen, items, from, opts = {}, hooks = {}) {
	if (!state || !cells || !inMapCell(from)) return false;
	const dir = opts.direction | 0;
	const pos = opts.skipInitialStep ? from : chuckStartCell(cells, from, dir, opts.style | 0);
	const slot = state.fireballs.find((f) => !f.pos);
	if (!slot) return false;
	Object.assign(slot, {
		pos,
		direction: dir,
		speed: opts.speed ?? 1,
		count: 0,
		colour: 9,
		density: Math.max(0, Math.min(3, opts.density | 0)),
		decay: opts.decay ?? EXPL_DECAY,
		flameback: opts.flameback == null || opts.flameback < 0
			? -1
			: ((opts.flameback + 2) & 3),
		damage: opts.damage || 0,
		owner: opts.owner ?? -1,
	});
	fireballHits(state, cells, seen, items, slot, opts.style | 0, hooks);
	stampExplosion(cells, slot.pos, slot.density);
	return true;
}

export function addDirectionalFireballs(state, cells, seen, items, from, arcs, opts = {}, hooks = {}) {
	let changed = false;
	const entries = [
		// add_fireballs reads bytes in this order. The source comments label
		// the last two as down/up, but the directions passed to move_fireballs
		// are 5 then 4, which move upward then downward in memory terms.
		['north', 0], ['south', 2], ['east', 1], ['west', 3], ['down', 5], ['up', 4],
	];
	for (const [key, dir] of entries) {
		const density = arcs?.[key] | 0;
		if (!density) continue;
		changed = addFireball(state, cells, seen, items, from, {
			...opts, direction: dir, density: density - 1,
			flameback: opts.flameback ?? -1,
			skipInitialStep: true,
		}, hooks) || changed;
	}
	return changed;
}

function fireballHits(state, cells, seen, items, f, style = 0, hooks = {}) {
	if (!inMapCell(f.pos)) return false;
	let changed = false;
	if (triggerMine(state, cells, seen, items, f.pos, hooks)) changed = true;
	if (style !== 4 && openEgg(cells, seen, items, f.pos, hooks)) changed = true;
	const cell = cells[f.pos] >>> 0;
	const density = Math.max(0, f.density | 0);
	const hit = hooks.hitCell?.(f.pos, {
		playerDamage: (density + 1) * 4000,
		playerInventoryDamage: (density + 1) * 4000,
		sentryDamage: (density + 1) * 5500,
		monsterDamage: (density + 1) * 7000,
		owner: f.owner,
		source: 'fireball',
		cell,
	});
	return changed || !!hit;
}

function chooseBounceDirection(state, f) {
	let d = nextRandom(state) & 7;
	if (d > 5) d >>= 1;
	if (f.decay && f.flameback >= 0 && f.flameback === d) {
		d = (d + 2) & 3;
	}
	return d;
}

function moveFireballOne(state, cells, seen, items, f, style, hooks) {
	if (!f.pos || f.speed === 255) return false;
	let changed = false;
	if (f.count >= f.speed && f.direction >= 0) {
		clearExplosion(cells, f.pos);
		f.count = 0;
		let blocked = false;
		const step = STEP[f.direction & 7];
		const next = step && sameFloorStep(f.pos, f.pos + step.delta, f.direction)
			? f.pos + step.delta : -1;
		if (!step || !inMapCell(next)) {
			f.pos = 0;
			return true;
		}
		const b = blocksFireball(cells[next] >>> 0, style);
		if (b === 'kill') {
			f.pos = 0;
			return true;
		}
		if (b) blocked = true;
		else f.pos = next;

		if (blocked) {
			f.direction = chooseBounceDirection(state, f);
			if (f.decay === EXPL_DECAY && --f.density < 0) {
				f.pos = 0;
				return true;
			}
			if (f.decay === EXPL_DECAY) {
				stampExplosion(cells, f.pos, f.density);
			} else if (f.decay === EXPL_VANISH) {
				f.pos = 0;
				return true;
			}
		}
		changed = true;
	}
	if (f.pos) {
		fireballHits(state, cells, seen, items, f, style, hooks);
		stampExplosion(cells, f.pos, f.density);
		f.count++;
		changed = true;
	}
	return changed;
}

export function moveFireballs(state, cells, seen, items, ticks = 1, opts = {}, hooks = {}) {
	if (!state) return false;
	state.count += ticks;
	if (state.count <= FIREBALL_TICK) return false;
	state.count = 0;
	let changed = moveGrenades(state, cells, seen, items, opts.style | 0, hooks);
	for (const f of state.fireballs) {
		if (moveFireballOne(state, cells, seen, items, f, opts.style | 0, hooks)) changed = true;
	}
	return changed;
}

export function addGrenade(state, cells, player, itemMeta, from, opts = {}) {
	if (!state || !cells || !itemMeta?.grenade || !inMapCell(from)) return false;
	const slot = state.grenades.find((g) => !g.pos);
	if (!slot) return false;
	const existing = cells[from] >>> 0;
	const t = blockType(existing);
	if ((existing & BLOCK_HERE) && (t === 22 || t === 23)) return false;
	Object.assign(slot, {
		pos: from,
		direction: opts.direction | 0,
		type: itemMeta.grenade.type | 0,
		xvel: opts.xvel | 0,
		yvel: opts.yvel | 0,
		height: opts.height | 0,
		radius: itemMeta.grenade.radius | 0,
		owner: player?.index ?? -1,
		arcs: {
			north: itemMeta.grenade.north | 0,
			south: itemMeta.grenade.south | 0,
			east: itemMeta.grenade.east | 0,
			west: itemMeta.grenade.west | 0,
			down: itemMeta.grenade.down | 0,
			up: itemMeta.grenade.up | 0,
		},
		stamped: false,
	});
	if (existing & (BLOCK_HERE | OPAQUE_BIT)) return true;
	stampGrenade(cells, slot);
	return true;
}

function grenadeDelta(g) {
	if (g.xvel === 0) return 0;
	g.xvel--;
	return STEP[g.direction & 3]?.delta || 0;
}

function grenadeMoveBlocked(cells, idx) {
	if (!inMapCell(idx)) return true;
	const cell = cells[idx] >>> 0;
	if (cell & OPAQUE_BIT) return true;
	if (!(cell & BLOCK_HERE)) return false;
	const t = blockType(cell);
	return t >= 16 && t <= 21;
}

function moveGrenadeOne(state, cells, seen, items, g, style, hooks) {
	if (!g.pos) return false;
	const cell = cells[g.pos] >>> 0;
	const wantBlock = g.type ? 23 : 22;
	if (!(cell & BLOCK_HERE) || blockType(cell) !== wantBlock) {
		return explodeGrenade(state, cells, seen, items, g, hooks);
	}
	clearBlock(cells, g.pos);
	g.stamped = false;

	let delta = grenadeDelta(g);
	while (g.height < 0) {
		if (cells[g.pos] & FLOOR_HERE) return explodeGrenade(state, cells, seen, items, g, hooks);
		delta -= LEVEL_CELLS;
		g.height += 32;
	}

	const next = g.pos + delta;
	if (delta && (!sameFloorStep(g.pos, next, g.direction & 3) || grenadeMoveBlocked(cells, next))) {
		return explodeGrenade(state, cells, seen, items, g, hooks);
	}
	g.pos = next;
	if (delta) {
		const nextCell = cells[g.pos] >>> 0;
		if (nextCell & BLOCK_HERE) return explodeGrenade(state, cells, seen, items, g, hooks);
		if (style !== 4 && g.height <= 16 && openEgg(cells, seen, items, g.pos, hooks)) {
			return explodeGrenade(state, cells, seen, items, g, hooks);
		}
	}
	stampGrenade(cells, g);
	if (g.yvel !== -1000) {
		g.height += g.yvel;
		g.yvel = Math.max(-16, g.yvel - 8);
	}
	return true;
}

function moveGrenades(state, cells, seen, items, style, hooks) {
	let changed = false;
	for (const g of state.grenades) {
		if (moveGrenadeOne(state, cells, seen, items, g, style, hooks)) changed = true;
	}
	return changed;
}

function explodeGrenade(state, cells, seen, items, g, hooks) {
	const at = g.pos;
	if (!at) return false;
	if (g.stamped) clearBlock(cells, at);
	addDirectionalFireballs(state, cells, seen, items, at, g.arcs, {
		speed: 1, decay: EXPL_VANISH, flameback: -1, owner: g.owner,
	}, hooks);
	if (!g.type) {
		woundBlast(cells, at, 240000, hooks, g.owner);
		for (const off of [-MAP_WIDTH, MAP_WIDTH, 1, -1, LEVEL_CELLS, -LEVEL_CELLS]) {
			woundBlast(cells, at + off, 160000, hooks, g.owner);
		}
		for (const off of [
			-MAP_WIDTH - 1, -MAP_WIDTH + 1, MAP_WIDTH - 1, MAP_WIDTH + 1,
			-LEVEL_CELLS - MAP_WIDTH, -LEVEL_CELLS - 1, -LEVEL_CELLS + 1, -LEVEL_CELLS + MAP_WIDTH,
			LEVEL_CELLS - MAP_WIDTH, LEVEL_CELLS - 1, LEVEL_CELLS + 1, LEVEL_CELLS + MAP_WIDTH,
		]) woundBlast(cells, at + off, 100000, hooks, g.owner);
		for (const off of [
			LEVEL_CELLS - MAP_WIDTH - 1, LEVEL_CELLS - MAP_WIDTH + 1,
			LEVEL_CELLS + MAP_WIDTH - 1, LEVEL_CELLS + MAP_WIDTH + 1,
			-LEVEL_CELLS - MAP_WIDTH - 1, -LEVEL_CELLS - MAP_WIDTH + 1,
			-LEVEL_CELLS + MAP_WIDTH - 1, -LEVEL_CELLS + MAP_WIDTH + 1,
		]) woundBlast(cells, at + off, 60000, hooks, g.owner);
	} else {
		for (const m of hooks.activeMonsters?.() || []) {
			const dist = cellDistance(at, m.cell);
			if (dist <= (g.radius || 0)) hooks.stunMonster?.(m, 15);
		}
	}
	// Both kinds play moresfx 7 at period 550 and shake the screen -- a stun
	// nudges it (power 20, Main.s:3644) and a live one hits it harder (power 17,
	// Main.s:3656). Reported rather than played here so combat.js stays free of
	// the audio and view layers.
	hooks.onGrenadeExplode?.(at, !!g.type);
	g.pos = 0;
	g.stamped = false;
	return true;
}

function cellDistance(a, b) {
	const af = Math.floor(a / LEVEL_CELLS), bf = Math.floor(b / LEVEL_CELLS);
	const ar = a % LEVEL_CELLS, br = b % LEVEL_CELLS;
	const ax = ar % MAP_WIDTH, ay = Math.floor(ar / MAP_WIDTH);
	const bx = br % MAP_WIDTH, by = Math.floor(br / MAP_WIDTH);
	const dx = ax - bx, dy = ay - by, dz = (af - bf) * 4;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function woundBlast(cells, idx, damage, hooks, owner = -1) {
	if (!inMapCell(idx)) return false;
	return !!hooks.hitCell?.(idx, {
		playerDamage: damage >> 1,
		monsterDamage: damage << 1,
		sentryDamage: damage << 1,
		owner,
		source: 'grenade',
	});
}

export function triggerMine(state, cells, seen, items, idx, hooks = {}) {
	if (!inMapCell(idx) || !(cells[idx] & AUX_HERE)) return 0;
	const aux = auxType(cells[idx]);
	if (aux < 2 || aux > 6) return 0;
	const num = (items?.[idx] || 0) & 255;
	if (!num) return 0;
	const meta = hooks.itemMeta?.(num);
	if (meta?.category !== 13 || !meta.mine) return 0;
	clearAux(cells, items, idx);
	addDirectionalFireballs(state, cells, seen, items, idx, meta.mine, {
		speed: 1, decay: EXPL_DECAY, flameback: -1,
	}, hooks);
	return (meta.mine.damage | 0) << 11;
}

function rayBlocked(cell, style) {
	if (cell & OPAQUE_BIT) return true;
	if (!(cell & BLOCK_HERE)) return false;
	const t = blockType(cell);
	if (t === BLOCK.TREE) return style !== 0 && style !== 2;
	if (t === BLOCK.FIELD3 || t === BLOCK.TELEPORT) return false;
	if (t === BLOCK.DOOR_FRONT || t === BLOCK.DOOR_SIDE) {
		return ((cell >>> SHIFT.variant) & MASK.variant) < 5;
	}
	return true;
}

export function traceWeaponTarget(cells, seen, items, from, direction, style = 0, max = 128, hooks = {}) {
	let idx = from;
	const delta = STEP[direction & 3]?.delta || 0;
	for (let dist = 0; dist < max; dist++) {
		const next = idx + delta;
		if (!sameFloorStep(idx, next, direction & 3)) return { cell: idx, dist, hit: false };
		idx = next;
		if (!inMapCell(idx)) return { cell: idx, dist, hit: false };
		if (style !== 4 && openEgg(cells, seen, items, idx, hooks)) return { cell: idx, dist, hit: 'egg' };
		if (cells[idx] & BLOCK_HERE) {
			const t = blockType(cells[idx]);
			if (t >= BLOCK.MONSTER_FIRST && t <= BLOCK.MONSTER_LAST) return { cell: idx, dist, hit: 'monster' };
			if (t >= 24 && t <= 27) return { cell: idx, dist, hit: 'sentry' };
			if (t >= BLOCK.PLAYER_FIRST && t <= BLOCK.PLAYER_LAST) return { cell: idx, dist, hit: 'player' };
		}
		if (rayBlocked(cells[idx] >>> 0, style)) return { cell: idx, dist, hit: false };
	}
	return { cell: idx, dist: max, hit: false };
}

export function fireWeaponAtTarget(cells, seen, items, from, player, itemMeta, style, hooks = {}) {
	const target = traceWeaponTarget(cells, seen, items, from,
		player.direction & 3, style, 128, hooks);
	const damage = ((itemMeta?.gun?.damagePerHit || 0) *
		(Math.max(1, itemMeta?.animDuration || 1)) << 9) >>> 0;
	const hit = hooks.hitCell?.(target.cell, {
		playerDamage: damage,
		playerInventoryDamage: damage,
		monsterDamage: damage,
		sentryDamage: damage,
		owner: player.index,
		source: 'weapon',
	});
	return { ...target, changed: !!hit };
}

export { EXPL_DECAY, EXPL_NO_DECAY, EXPL_VANISH };
