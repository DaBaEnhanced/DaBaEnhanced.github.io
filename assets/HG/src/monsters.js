// Active monster state and movement, ported from Sources/MonsterMovement.s.
//
// Monsters are not a separate render pass in the original. A live monster is
// stamped into the cell's BLOCK field as type 8-15, and blit_view draws it from
// the current style table. The style entries are runtime placeholders patched
// from the map's two loaded monster graphics.

import { MAP_WIDTH, MAP_DEPTH, MAP_HEIGHT, LEVEL_CELLS, cellIndex } from './view.js';
import { BLOCK } from './movement.js';

const FLOOR_HERE = 1, BLOCK_HERE = 2, WATER_HERE = 4, AUX_HERE = 1 << 5;
const OPAQUE_BIT = 1 << 6;
const SHIFT = { floor: 9, block: 11, water: 17, variant: 23, aux: 28 };
const MASK = { floor: 0x3, block: 0x3f, water: 0x3, variant: 0x1f, aux: 0xf };

const KEEP_BLOCK = (MASK.block << SHIFT.block) | BLOCK_HERE;
const KEEP_VARIANT = MASK.variant << SHIFT.variant;
const KEEP_AUX = (MASK.aux << SHIFT.aux) | AUX_HERE;
const KEEP_PERSON = KEEP_BLOCK | KEEP_VARIANT;
const KEEP_AUX_DATA = 0xff << 12;
const NO_MONSTER_BIT = 1 << 29;
const REMOVE_EGG_BIT = 1 << 28;

const AUX_EGG_CLOSED = 0;
const AUX_EGG_OPEN = 1;
const AUX_CONTAINER_FIRST = 2, AUX_CONTAINER_LAST = 6;
// inventory.js calls this AUX_SKELETON; it is the dead player's kit bag.
const AUX_SKELETON_DEAD = 7;
const AUX_MONSTER1_DEAD = 14;
const AUX_MONSTER2_DEAD = 15;
const HATCH_SCAN_TICKS = 5;
const MONSTER_MOVE_TICKS = 10;
const MAX_MONSTERS = Math.floor((128 * 16) / 22);
const SQUASH_DAMAGE = 2500 << 6;

const DIR_STEP = [
	{ dx: 0, dy: -1, up: 8, down: BLOCK.STAIRS_NORTH },
	{ dx: 1, dy: 0, up: 9, down: BLOCK.STAIRS_EAST },
	{ dx: 0, dy: 1, up: 10, down: BLOCK.STAIRS_SOUTH },
	{ dx: -1, dy: 0, up: 11, down: BLOCK.STAIRS_WEST },
];

const towardsTable = {
	'-1,-1': [0, 3, 1, 5], '0,-1': [0, 3, 1, 5], '1,-1': [0, 1, 3, 5],
	'-1,0': [3, 0, 2, 5],  '0,0': [2, 3, 1, 5],  '1,0': [1, 0, 2, 5],
	'-1,1': [3, 2, 0, 5],  '0,1': [2, 3, 1, 5],  '1,1': [1, 2, 0, 5],
};
const awayTable = {
	'-1,-1': [2, 1, 3, 5], '0,-1': [2, 1, 3, 5], '1,-1': [2, 3, 1, 5],
	'-1,0': [1, 2, 0, 5],  '0,0': [0, 1, 3, 5],  '1,0': [3, 2, 0, 5],
	'-1,1': [1, 0, 2, 5],  '0,1': [0, 1, 3, 5],  '1,1': [3, 0, 2, 5],
};

const blockType = (cell) => (cell >>> SHIFT.block) & MASK.block;
const floorType = (cell) => (cell >>> SHIFT.floor) & MASK.floor;
const waterLevel = (cell) => (cell >>> SHIFT.water) & MASK.water;
const auxType = (cell) => (cell >>> SHIFT.aux) & MASK.aux;
const s8 = (v) => (v & 0x80) ? v - 0x100 : v;
const clampSign = (v) => v < 0 ? -1 : v > 0 ? 1 : 0;
const inBounds = (x, y, f) =>
	x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_DEPTH && f >= 0 && f < MAP_HEIGHT;
const inBoundsIndex = (idx) => idx >= 0 && idx < LEVEL_CELLS * MAP_HEIGHT;

/**
 * The facing an egg was given in the editor, or null for the random roll.
 *
 * map_cell2 has no spare bits -- egg_hatch:12, egg_contents:8, flowing_bit,
 * qmark, four seen flags and block_2d:6 fill the word -- so this rides in the
 * map JSON beside the cell data rather than inside it. Absent on every shipped
 * map, which is why they keep the original's behaviour.
 */
function eggDirection(state, cell) {
	const d = state?.eggDirections?.[cell];
	return d === undefined || d === null ? null : (d & 3);
}

export function createMonsterState(map, monsterDefs) {
	const defs = Array.isArray(monsterDefs) ? monsterDefs : (monsterDefs?.monsters || []);
	const state = {
		defs,
		eggDirections: map?.eggDirections || null,
		locnMons1: map?.locn?.mons1 | 0,
		locnMons2: map?.locn?.mons2 | 0,
		monsters: [],
		moveCount: 0,
		hatchCount: 0,
		hatchLevel: 0,
		hatchLine: 0,
		timer: 0,
		random: 0x1234,
	};
	for (const m of map?.monsters || []) {
		const def = defs[m.type] || null;
		if (!def) continue;
		const cell = m.posn >>> 2;
		state.monsters.push({
			active: true,
			index: state.monsters.length,
			typeIndex: m.type,
			def,
			cell,
			x: m.x | 0,
			y: m.y | 0,
			floor: m.floor | 0,
			direction: m.direction & 3,
			fitness: m.fitness || 65535,
			count: s8(m.count ?? def.speed ?? 0),
			white: !!m.white,
			move: [0, 0, 0, 0],
			dr: 4,
			stun: 0,
		});
	}
	return state;
}

export function activeMonsters(state) {
	return state?.monsters?.filter((m) => m.active) || [];
}

export function stampMonsters(state, cells) {
	if (!state || !cells) return;
	for (const m of state.monsters) {
		if (m.active) putMonsterInMap(state, cells, m);
	}
}

export function clearNoMonster(items, cell) {
	if (!items || cell < 0 || cell >= items.length) return;
	items[cell] = (items[cell] & ~NO_MONSTER_BIT) >>> 0;
}

export function initialiseMonsterHatches(state, cells, seen, items) {
	if (!state) return false;
	let changed = false;
	// Main.s seeds `d0` with `#19*23` and then uses DBF, so the loop executes
	// the initial value plus one.
	for (let i = 0; i <= 19 * MAP_DEPTH; i++) {
		if (scanHatchLine(state, cells, seen, items)) changed = true;
	}
	return changed;
}

export function hatchEggs(state, cells, seen, items, ticks = 1) {
	if (!state) return false;
	state.timer = (state.timer + ticks) & 0xffff;
	state.hatchCount += ticks;
	let changed = false;
	while (state.hatchCount >= HATCH_SCAN_TICKS) {
		state.hatchCount -= HATCH_SCAN_TICKS;
		if (scanHatchLine(state, cells, seen, items)) changed = true;
	}
	return changed;
}

export function forceHatchEggAt(state, cells, seen, items, idx) {
	if (!state || !cells || !seen || !inBoundsIndex(idx)) return false;
	if (!(cells[idx] & AUX_HERE) || auxType(cells[idx]) !== AUX_EGG_CLOSED) return false;
	const hatchTime = seen[idx] >>> 20;
	if (hatchTime === 4093) return false;
	const typeIndex = (seen[idx] >>> 12) & 0xff;
	const floor = Math.floor(idx / LEVEL_CELLS);
	const rem = idx % LEVEL_CELLS;
	const y = Math.floor(rem / MAP_WIDTH);
	const x = rem % MAP_WIDTH;
	const monster = addMonster(state, cells, typeIndex, x, y, floor,
		eggDirection(state, idx));
	if (!monster) return false;
	cells[idx] = (cells[idx] & ~KEEP_AUX) >>> 0;
	seen[idx] = (seen[idx] & ~KEEP_AUX_DATA) >>> 0;
	if (!(items?.[idx] & REMOVE_EGG_BIT)) {
		cells[idx] = (cells[idx] | AUX_HERE | (AUX_EGG_OPEN << SHIFT.aux)) >>> 0;
	}
	return true;
}

function scanHatchLine(state, cells, seen, items) {
	const floor = state.hatchLevel | 0;
	const y = state.hatchLine | 0;
	let changed = false;
	if (floor >= 0 && floor < MAP_HEIGHT && y >= 0 && y < MAP_DEPTH) {
		for (let x = 0; x < MAP_WIDTH; x++) {
			const idx = cellIndex(x, y, floor);
			const cell = cells[idx];
			if (!(cell & AUX_HERE) || auxType(cell) !== AUX_EGG_CLOSED) continue;
			if (examineEgg(state, cells, seen, items, idx, x, y, floor)) changed = true;
		}
	}

	state.hatchLine++;
	if (state.hatchLine >= MAP_DEPTH) {
		state.hatchLine = 1;
		state.hatchLevel++;
		if (state.hatchLevel >= MAP_HEIGHT) state.hatchLevel = 1;
	}
	return changed;
}

function examineEgg(state, cells, seen, items, idx, x, y, floor) {
	const typeIndex = (seen[idx] >>> 12) & 0xff;
	let hatchTime = seen[idx] >>> 20;
	if (hatchTime === 4093 || hatchTime === 4095) return false;
	if (hatchTime === 4094) hatchTime = state.random & 0x0fff;
	// MonsterMovement.s multiplies into a long but then does `cmp.w timer,d1`,
	// so only the low word participates. That makes long hatch times wrap.
	const deadline = (hatchTime * 20 * 50) & 0xffff;
	if (deadline > state.timer) return false;
	if (cells[idx] & BLOCK_HERE) return false;

	const monster = addMonster(state, cells, typeIndex, x, y, floor,
		eggDirection(state, idx));
	if (!monster) return false;
	cells[idx] = (cells[idx] & ~KEEP_AUX) >>> 0;
	seen[idx] = (seen[idx] & ~KEEP_AUX_DATA) >>> 0;
	if (!(items[idx] & REMOVE_EGG_BIT)) {
		cells[idx] = (cells[idx] | AUX_HERE | (AUX_EGG_OPEN << SHIFT.aux)) >>> 0;
	}
	return true;
}

/**
 * @param direction 0-3 to force a facing, or null/undefined for the random one.
 */
function addMonster(state, cells, typeIndex, x, y, floor, direction = null) {
	if (!inBounds(x, y, floor)) return null;
	if (state.monsters.filter((m) => m.active).length >= MAX_MONSTERS) return null;
	const def = state.defs[typeIndex];
	if (!def) return null;
	const cell = cellIndex(x, y, floor);
	const m = {
		active: true,
		index: state.monsters.length,
		typeIndex,
		def,
		cell,
		x,
		y,
		floor,
		direction: 0,          // overwritten below
		fitness: 65535,
		count: s8(def.speed || 0),
		white: false,
		move: [0, 0, 0, 0],
		dr: 4,
		stun: 0,
	};
	state.monsters.push(m);

	// FIXES A BUG IN THE ORIGINAL. add_monster (MonsterMovement.s:180) writes
	// `move.b #0,monster_direct(a3)`, then computes a facing:
	//
	//     mulu #47,d0 / rol.w #8,d0 / andi.w #%11,d0   ;face random direction
	//
	// and calls put_monster_in_map without ever storing d0. Its own comment says
	// what it meant to do, so the roll is kept and now lands where it was headed.
	// Everything hatched otherwise faces north.
	const rolled = nextRandom(state) & 3;
	m.direction = direction === null || direction === undefined
		? rolled
		: (direction & 3);

	putMonsterInMap(state, cells, m);
	return m;
}

export function moveMonsters(state, cells, items, players, ticks = 1, hooks = {}) {
	if (!state) return false;
	state.moveCount += ticks;
	if (state.moveCount <= MONSTER_MOVE_TICKS) return false;
	state.moveCount -= MONSTER_MOVE_TICKS;

	let changed = false;
	for (const m of state.monsters) {
		if (!m.active) continue;
		const def = m.def;
		if (m.stun > 0) {
			m.stun--;
			putMonsterInMap(state, cells, m);
			changed = true;
			continue;
		}
		if (m.count >= 0) {
			m.count = s8((m.count - 1) & 0xff);
			if (m.count !== 0) continue;
			m.count = s8(def.speed || 0);
		}

		const target = findClosestPlayer(m, players);
		if (!target) continue;

		if (s8(def.speed || 0) < 0) {
			m.dr = 4;
		} else if (target.dist <= 1) {
			m.dr = 4;
		}

		if ((def.fireballDensity | 0) && monsterFireFireball(cells, m, hooks)) {
			changed = true;
			continue;
		}

		const brave = (def.bravery | 0) <= (m.fitness | 0);
		if (moveByTable(state, cells, items, m, target.player, brave ? towardsTable : awayTable, hooks)) {
			changed = true;
		}
		putMonsterInMap(state, cells, m);
	}
	return changed;
}

function findClosestPlayer(m, players) {
	let best = null;
	let bestDist = 0x7fff;
	for (const p of players || []) {
		if (!p || p.dead || p.inExit || p.active === false) continue;
		const dx = (p.x | 0) - m.x;
		const dy = (p.y | 0) - m.y;
		const dz = ((p.floor | 0) - m.floor) << 2;
		const dist = dx * dx + dy * dy + dz * dz;
		if (dist <= bestDist) {
			bestDist = dist;
			best = p;
		}
	}
	return bestDist < 100 && best ? { player: best, dist: bestDist } : null;
}

function monsterFireFireball(cells, m, hooks) {
	let idx = m.cell;
	for (let d = 0; d <= (m.def.maxFireDistance | 0); d++) {
		const next = idx + ((m.direction & 3) === 0 ? -MAP_WIDTH
			: (m.direction & 3) === 1 ? 1
				: (m.direction & 3) === 2 ? MAP_WIDTH : -1);
		if (!sameFloorStep(idx, next, m.direction & 3)) return false;
		idx = next;
		const cell = cells[idx] >>> 0;
		if (!(cell & BLOCK_HERE)) continue;
		const t = blockType(cell);
		if (t === BLOCK.TREE) {
			const style = hooks.style | 0;
			if (style === 0 || style === 2) continue;
			return false;
		}
		if (t === BLOCK.HYDRAULIC) continue;
		if (t === BLOCK.FIELD3) return false;
		if (t < 24 || t > BLOCK.PLAYER_LAST) return false;
		if (t >= 28 && t < BLOCK.PLAYER_FIRST) return false;
		return !!hooks.addFireball?.(m.cell, {
			direction: m.direction & 3,
			speed: m.def.fireballSpeed | 0,
			decay: m.def.fireballDecay | 0,
			density: Math.max(0, (m.def.fireballDensity | 0) - 1),
			flameback: m.direction & 3,
			owner: -1,
		});
	}
	return false;
}

function sameFloorStep(from, to, dir) {
	if (!inBoundsIndex(to)) return false;
	if (dir === 1) return (from % MAP_WIDTH) < MAP_WIDTH - 1;
	if (dir === 3) return (from % MAP_WIDTH) > 0;
	if (dir === 0) return (from % LEVEL_CELLS) >= MAP_WIDTH;
	if (dir === 2) return (from % LEVEL_CELLS) < LEVEL_CELLS - MAP_WIDTH;
	return true;
}

function moveByTable(state, cells, items, m, player, table, hooks) {
	if (m.dr < 4) return doMovement(state, cells, items, m, hooks);
	if (m.dr === 5) {
		m.move = [0, 0, 0, 255];
		m.dr = 3;
		return doMovement(state, cells, items, m, hooks);
	}

	m.dr = 0;
	const key = `${clampSign((player.x | 0) - m.x)},${clampSign((player.y | 0) - m.y)}`;
	m.move = table[key] || [0, 0, 0, 255];
	return doMovement(state, cells, items, m, hooks);
}

function doMovement(state, cells, items, m, hooks) {
	let dir = m.move[m.dr] ?? 255;
	while (dir < 0 || dir > 3) dir = nextRandom(state) & 3;
	return tryDirection(state, cells, items, m, dir, hooks);
}

function tryDirection(state, cells, items, m, dir, hooks) {
	const before = m.direction;
	if (dir === 0) {
		if (before === 0) return monsterForward(state, cells, items, m, hooks);
		m.direction = before === 2 ? 1 : 0;
		return true;
	}
	if (dir === 1) {
		if (before === 1) return monsterForward(state, cells, items, m, hooks);
		m.direction = before === 3 ? 0 : 1;
		return true;
	}
	if (dir === 2) {
		if (before === 2) return monsterForward(state, cells, items, m, hooks);
		m.direction = before === 0 ? 1 : 2;
		return true;
	}
	if (before === 3) return monsterForward(state, cells, items, m, hooks);
	m.direction = before === 1 ? 2 : 3;
	return true;
}

function monsterForward(state, cells, items, m, hooks) {
	if (m.count === -1) return false;
	clearPerson(cells, m.cell);
	const step = DIR_STEP[m.direction & 3];
	const result = moveMonster(cells, items, m, step, hooks);
	if (result === 0) { m.dr++; return true; }
	if (result === 1) {
		if (!attackOrReassess(state, cells, m, hooks)) m.dr++;
		return true;
	}
	m.dr = 4;
	return true;
}

function moveMonster(cells, items, m, step, hooks) {
	const here = m.cell;
	if (here < 0 || here >= cells.length) return 0;
	if (!monsterSupported(cells, here)) return 0;

	let nx = m.x + step.dx;
	let ny = m.y + step.dy;
	let nf = m.floor;
	let dest = cellIndex(nx, ny, nf);

	const auxHere = (cells[here] & AUX_HERE) ? auxType(cells[here]) : -1;
	if (auxHere === step.up) {
		const above = here + LEVEL_CELLS;
		if (above >= cells.length || (cells[above] & (BLOCK_HERE | FLOOR_HERE | OPAQUE_BIT))) return 0;
		dest += LEVEL_CELLS;
		nf++;
	} else {
		const below = here - LEVEL_CELLS;
		if (below >= 0 && (cells[below] & BLOCK_HERE) && blockType(cells[below]) === step.down) {
			if (dest < 0 || dest >= cells.length) return 0;
			if (!(cells[dest] & FLOOR_HERE)) {
				const under = dest - LEVEL_CELLS;
				const blocked = under >= 0 && (cells[under] & (BLOCK_HERE | OPAQUE_BIT));
				const t = under >= 0 ? blockType(cells[under]) : -1;
				if (!blocked || (t >= BLOCK.PLAYER_FIRST && t <= BLOCK.PLAYER_LAST)) {
					dest -= LEVEL_CELLS;
					nf--;
				}
			}
		}
	}

	if (!inBounds(nx, ny, nf) || dest < 0 || dest >= cells.length) return 0;
	if (items && (items[dest] & NO_MONSTER_BIT)) return 0;
	if (m.def.twoHigh) {
		const above = dest + LEVEL_CELLS;
		if (above >= cells.length || (cells[above] & (FLOOR_HERE | BLOCK_HERE | OPAQUE_BIT))) return 0;
	}
	if (m.def.staysInWater) {
		if (!(cells[dest] & WATER_HERE) || waterLevel(cells[dest]) < 3) return 0;
	}

	const dcell = cells[dest];
	if (dcell & (BLOCK_HERE | OPAQUE_BIT)) {
		const t = blockType(dcell);
		if (t === BLOCK.DOOR_FRONT || t === BLOCK.DOOR_SIDE) {
			hooks.openDoor?.(dest);
			return 0;
		}
		m.bumpCell = dest;
		return 1;
	}

	if (!(dcell & FLOOR_HERE)) {
		const under = dest - LEVEL_CELLS;
		if (under < 0 || !(cells[under] & BLOCK_HERE)) return 0;
		const t = blockType(cells[under]);
		if (t === BLOCK.TREE) return 0;
		if (t >= BLOCK.MONSTER_FIRST && t <= BLOCK.PLAYER_LAST) {
			if (t <= BLOCK.MONSTER_LAST) return 0;
			if (t >= BLOCK.EXGFX_FIRST) return 0;
		}
	} else if ((m.def.twoHigh || m.def.staysInWater) && floorType(dcell) === 2) {
		return 0;
	}

	m.cell = dest;
	m.x = nx;
	m.y = ny;
	m.floor = nf;
	return 2;
}

function monsterSupported(cells, idx) {
	if (cells[idx] & FLOOR_HERE) return true;
	const below = idx - LEVEL_CELLS;
	if (below >= 0 && (cells[below] & BLOCK_HERE)) return true;
	const below2 = idx - 2 * LEVEL_CELLS;
	if (below2 >= 0 && (cells[below2] & BLOCK_HERE) && blockType(cells[below2]) === BLOCK.TREE) {
		return true;
	}
	return (cells[idx] & WATER_HERE) && waterLevel(cells[idx]) >= 2;
}

function attackOrReassess(state, cells, m, hooks) {
	const idx = m.bumpCell;
	m.bumpCell = -1;
	if (idx < 0 || idx >= cells.length) return false;
	const t = blockType(cells[idx]);
	if (t >= BLOCK.PLAYER_FIRST && t <= BLOCK.PLAYER_LAST) {
		hooks.onAttackPlayer?.(m, idx, (m.def.weaponModifier || 0) << 5);
		if ((m.def.poisonStrength | 0) > 0) hooks.onPoisonPlayer?.(m, idx);
		return true;
	}
	if (t >= 24 && t <= 27) {
		hooks.onAttackSentry?.(m, idx, (m.def.weaponModifier || 0) << 3);
		return true;
	}
	return false;
}

export function monstersFall(state, cells, items, hooks = {}) {
	if (!state) return false;
	let changed = false;
	for (const m of state.monsters) {
		if (!m.active) continue;
		if (monsterFall(state, cells, items, m, hooks)) changed = true;
	}
	return changed;
}

function monsterFall(state, cells, items, m, hooks) {
	const here = m.cell;
	if (here < 0 || here >= cells.length) return false;
	if (cells[here] & FLOOR_HERE) return false;
	const under = here - LEVEL_CELLS;
	if (under < 0) return false;
	const below = cells[under];
	if (!(below & BLOCK_HERE)) {
		const person = cells[here] & KEEP_PERSON;
		clearPerson(cells, here);
		clearPerson(cells, under);
		cells[under] = (cells[under] | person) >>> 0;
		m.cell = under;
		m.floor--;
		return true;
	}

	const t = blockType(below);
	if (t === BLOCK.TELEPORT) {
		const dest = items ? (items[under] >>> 2) : -1;
		if (dest >= 0 && dest < cells.length && !(cells[dest] & BLOCK_HERE)) {
			clearPerson(cells, here);
			m.cell = dest;
			m.floor = Math.floor(dest / LEVEL_CELLS);
			const rem = dest % LEVEL_CELLS;
			m.y = Math.floor(rem / MAP_WIDTH);
			m.x = rem % MAP_WIDTH;
			putMonsterInMap(state, cells, m);
			return true;
		}
		return false;
	}
	if (t >= BLOCK.MONSTER_FIRST && t <= BLOCK.PLAYER_LAST) {
		if (t <= BLOCK.MONSTER_LAST) {
			const victim = findMonsterByCell(state, under);
			if (victim) damageMonsterFitness(state, cells, victim, SQUASH_DAMAGE);
		} else if (t >= BLOCK.PLAYER_FIRST) {
			hooks.onSquashPlayer?.(m, under, 2500);
		} else if (t >= 24 && t <= 27) {
			hooks.onSquashSentry?.(m, under, 2500);
		}
	}
	return false;
}

export function damageMonsterFitness(state, cells, m, hit) {
	if (!m?.active) return false;
	const physique = Math.max(1, m.def?.physique || 1);
	const damage = Math.floor(hit / physique) * 100;
	return decrMonsterFitness(state, cells, m, damage);
}

export function damageMonsterAtCell(state, cells, cell, hit) {
	const m = findMonsterByCell(state, cell);
	return m ? damageMonsterFitness(state, cells, m, hit) : false;
}

export function monsterAtCell(state, cell) {
	return findMonsterByCell(state, cell);
}

function decrMonsterFitness(state, cells, m, damage) {
	m.white = true;
	const next = (m.fitness | 0) - (damage | 0);
	if (next >= 0) {
		m.fitness = next;
		if (m.def?.stunnable) m.stun = Math.min(127, Math.floor((damage | 0) / 5000));
		return false;
	}
	killMonster(state, cells, m);
	return true;
}

function killMonster(state, cells, m) {
	const idx = m.cell;
	if (idx >= 0 && idx < cells.length) {
		clearPerson(cells, idx);
		if (canLeaveDeadAux(cells, idx)) {
			const deadAux = monsterSlot(state, m) === 1 ? AUX_MONSTER1_DEAD : AUX_MONSTER2_DEAD;
			if (!(cells[idx] & AUX_HERE) || auxIsHarmless(auxType(cells[idx]))) {
				cells[idx] = (cells[idx] & ~KEEP_AUX) >>> 0;
				cells[idx] = (cells[idx] | AUX_HERE | (deadAux << SHIFT.aux)) >>> 0;
			} else {
				// A cell has one aux slot, and a floor item is already using it,
				// so the corpse cannot be drawn. Remember it: DEVIATION -- the
				// original just loses the body, this port lays it down once the
				// item is taken (see placePendingCorpse).
				if (!state.pendingCorpses) state.pendingCorpses = new Map();
				state.pendingCorpses.set(idx, deadAux);
			}
		}
	}
	m.active = false;
	m.cell = -1;
	m.fitness = 0;
}

/**
 * Lay down a corpse that could not be placed when the monster died because a
 * floor item held the cell's only aux slot. Call after the cell is cleared.
 *
 * @returns true if a corpse was placed, so the caller can flag a redraw.
 */
export function placePendingCorpse(state, cells, idx) {
	const pending = state?.pendingCorpses;
	if (!pending || !pending.has(idx)) return false;
	if (idx < 0 || idx >= cells.length) return false;
	if (cells[idx] & AUX_HERE) return false;            // something still there
	if (!canLeaveDeadAux(cells, idx)) { pending.delete(idx); return false; }
	cells[idx] = (cells[idx] | AUX_HERE | (pending.get(idx) << SHIFT.aux)) >>> 0;
	pending.delete(idx);
	return true;
}

/**
 * Can a corpse simply overwrite whatever aux is already here?
 *
 * A cell has ONE aux slot, so a body can only be laid down if the slot is free
 * or holds something nobody would miss. Deferring on any occupant at all was too
 * cautious: most of what lives in that slot is scenery.
 *
 *   0        an unhatched egg -- overwriting it deletes a spawn
 *   2-6      a container, i.e. loot the player can still pick up
 *   7        a player skeleton, which carries that character's inventory
 *
 * Everything else is decoration: an opened eggshell, the ornamental stairs and
 * frames, and an older corpse. A fresh body replaces those.
 */
function auxIsHarmless(aux) {
	if (aux === AUX_EGG_CLOSED) return false;           // a spawn waiting to hatch
	if (aux >= AUX_CONTAINER_FIRST && aux <= AUX_CONTAINER_LAST) return false;
	if (aux === AUX_SKELETON_DEAD) return false;        // holds a player's kit
	return true;
}

function canLeaveDeadAux(cells, idx) {
	if (cells[idx] & FLOOR_HERE) return true;
	const below = idx - LEVEL_CELLS;
	if (below < 0 || !(cells[below] & BLOCK_HERE)) return false;
	return blockType(cells[below]) <= BLOCK.PUSH;
}

function putMonsterInMap(state, cells, m) {
	if (!m.active || m.cell < 0 || m.cell >= cells.length) return;
	const slot = monsterSlot(state, m);
	if (!slot) return;
	const block = (slot === 1 ? BLOCK.MONSTER_FIRST : 12) + (m.direction & 3);
	let variant = 0;
	if (m.white) variant |= 1;
	if (m.def?.outline) variant |= 2;
	clearPerson(cells, m.cell);
	cells[m.cell] = (cells[m.cell] | BLOCK_HERE | (block << SHIFT.block) |
		(variant << SHIFT.variant)) >>> 0;
	m.white = false;
}

function monsterSlot(state, m) {
	const number = m.def?.monsterNumber | 0;
	if (number === 20 || number === state.locnMons1) return 1;
	if (number === state.locnMons2) return 2;
	return 0;
}

function clearPerson(cells, idx) {
	if (idx < 0 || idx >= cells.length) return;
	cells[idx] = (cells[idx] & ~KEEP_PERSON) >>> 0;
}

function findMonsterByCell(state, cell) {
	return state.monsters.find((m) => m.active && m.cell === cell) || null;
}

function nextRandom(state) {
	let d = ((state.random & 0xffff) * 47) & 0xffff;
	d = ((d << 8) | (d >>> 8)) & 0xffff;
	state.random = d;
	return d;
}
