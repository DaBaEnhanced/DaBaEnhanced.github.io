// Falling: a port of players_fall (Sources/Main.s:4014), which the main loop
// calls every frame through stuff_falls.
//
// `move` only ever steps you sideways -- walking off a ledge just leaves you
// standing in a cell with nothing under it. This is what actually drops you,
// one level per frame, accumulating damage that doubles on the way down and is
// paid on landing.
//
// Water changes both halves. Standing in water at least half deep you sink on
// only every third frame and take no fall damage at all; landing in shallow
// water still quarters it. That is why a flooded shaft is the safe way down.

import { LEVEL_CELLS, cellIndex } from './view.js';
import { BLOCK, putHeadInMap, removeHeadFromMap } from './movement.js';

const FLOOR_HERE = 1, BLOCK_HERE = 2, WATER_HERE = 4;
const SHIFT = { block: 11, water: 17 };
const MASK = { block: 0x3f, water: 0x3 };

const FALL_DAMAGE_CAP = 0x1000000;
const SQUASH_DAMAGE = 2500;
// water_fall is reloaded with 2 and counted down, so a level only passes on
// every third call -- one fall, two skipped.
const WATER_FALL_FRAMES = 2;

const blockType = (cell) => (cell >>> SHIFT.block) & MASK.block;
const waterLevel = (cell) => (cell >>> SHIFT.water) & MASK.water;
const hasWater = (cell) => (cell & WATER_HERE) !== 0;

/** Per-player falling state; `move` and the HUD do not need to know about it. */
export function createFallState() {
	return { waterFall: 0, fallDamage: 0 };
}

// stuff_falls (Main.s:366) is gated on `fall_count`, one of the counters
// xcr_counters bumps once per frame at 50Hz. (move_lifts pins that rate: its
// gate is `cmp.w #50,lift_count`, i.e. exactly one second.)
//
// The gate is 6 vblanks, so the counter alone allows a level every 120ms. But
// stuff_falls subtracts 6 exactly ONCE per pass:
//
//     cmp.w  #6,fall_count
//     bls    .end
//     subi.w #6,fall_count      <- no .again loop, unlike move_doors
//
// move_doors deliberately loops until the counter goes negative, so doors keep
// wall-clock time however slow the machine is. Falling does not: it advances at
// most one level per GAME-LOOP PASS, which on the original meant one level per
// rendered frame. Four software-rendered 3D views on a 68020 ran far below
// 50Hz, so the real fall rate was the frame rate, not the counter's 8.33Hz.
//
// This renderer does 60fps, so it always reaches the counter cap and falls
// roughly twice as fast as the CD32 does on video. FALL_TICKS is therefore the
// one number here not derived from the source: 6 is the counter's own gate, and
// the doubling stands in for the original's render-bound loop. Change this
// single constant to retime falling.
const FALL_TICKS = 12;

export function createFallClock() { return { count: 0 }; }

/**
 * stuff_falls. `ticks` is elapsed 50Hz vblanks, so the fall speed is wall-clock
 * and does not ride the display's refresh rate.
 */
export function stuffFalls(clock, cells, players, hooks = {}, ticks = 1) {
	clock.count += ticks;
	if (clock.count <= FALL_TICKS) return false;
	// One step per pass: the original subtracts once and moves on, so a long
	// stall does not teleport anyone to the bottom of a shaft.
	clock.count -= FALL_TICKS;
	// stuff_falls runs blocks_fall, players_fall, monsters_fall and
	// sentries_fall off this single gate, in that order.
	const blocks = hooks.blocksFall ? hooks.blocksFall() : false;
	const players_ = playersFall(cells, players, hooks);
	const monsters = hooks.monstersFall ? hooks.monstersFall() : false;
	const sentries = hooks.sentriesFall ? hooks.sentriesFall() : false;
	return blocks || players_ || monsters || sentries;
}

/**
 * The damage a fall has built up by the time it lands. Seeded from the player's
 * own weight and build on the first level, then doubled for every level after.
 */
function accumulate(fall, stats) {
	let d = fall.fallDamage;
	if (d === 0) {
		const agility = Math.max(1, stats.agility | 0);
		d = ((Math.floor((stats.weight | 0) / agility) + (stats.physique | 0)) << 5) >>> 0;
	}
	d *= 2;
	fall.fallDamage = Math.min(d, FALL_DAMAGE_CAP);
}

/**
 * Damage actually paid on landing. Deep water absorbs it completely, shallow
 * water takes it down to a quarter.
 */
function landingDamage(fall, cell) {
	const d = fall.fallDamage;
	fall.fallDamage = 0;
	if (!d) return 0;
	if (!hasWater(cell)) return d;
	if (waterLevel(cell) >= 1) return 0;
	return d >> 2;
}

/**
 * One frame of players_fall.
 *
 * @param hooks optional { onDamage(player, amount), onSquash(player, cellIdx,
 *              type), onTeleport(player, cellIdx) } -- squashing and teleport
 *              blocks are recognised here but the entities they act on are not
 *              ported yet, so they are reported rather than applied.
 * @returns true when anything moved, i.e. the original's redraw_flag.
 */
export function playersFall(cells, players, hooks = {}) {
	let changed = false;
	for (const p of players) {
		if (!p || p.dead || p.inExit || p.active === false) continue;
		if (!p.fall) p.fall = createFallState();
		const fall = p.fall;

		const here = cellIndex(p.x, p.y, p.floor);
		const cell = cells[here];

		// Deep enough to swim in: sink slowly and take nothing.
		if (hasWater(cell) && waterLevel(cell) >= 2) {
			fall.fallDamage = 0;
			if (fall.waterFall > 0) { fall.waterFall--; continue; }
			fall.waterFall = WATER_FALL_FRAMES;
		} else {
			fall.waterFall = 0;
		}

		// Standing on a floor: nothing to do but settle up.
		if (cell & FLOOR_HERE) { land(cells, p, here, fall, hooks); continue; }

		// A tree two levels down is a canopy you come to rest on.
		const two = here - 2 * LEVEL_CELLS;
		if (two >= 0 && (cells[two] & BLOCK_HERE) && blockType(cells[two]) === BLOCK.TREE) {
			landOnBlock(cells, p, here, two, fall, hooks);
			continue;
		}

		const under = here - LEVEL_CELLS;
		if (under >= 0 && (cells[under] & BLOCK_HERE)) {
			landOnBlock(cells, p, here, under, fall, hooks);
			continue;
		}
		if (under < 0) { land(cells, p, here, fall, hooks); continue; }

		// Nothing underneath: drop a level.
		removeHeadFromMap(cells, p.x, p.y, p.floor);
		p.floor -= 1;
		accumulate(fall, p.stats || {});
		putHeadInMap(cells, p);
		// land() runs on every frame spent standing on a floor, so the landing
		// sound needs the edge: only a player who was actually dropping has
		// arrived at anything.
		fall.dropping = true;
		changed = true;
	}
	return changed;
}

function land(cells, p, here, fall, hooks) {
	const amount = landingDamage(fall, cells[here]);
	if (amount && hooks.onDamage) hooks.onDamage(p, amount);
	if (fall.dropping) {
		fall.dropping = false;
		// Main.s:4295 .sound -- the landing thump, plus a screen shake.
		if (hooks.onLand) hooks.onLand(p, cells[here]);
	}
	// Treading water never carries damage forward.
	if (hasWater(cells[here]) && waterLevel(cells[here]) >= 2) fall.fallDamage = 0;
}

/** .block_below: a teleport pad catches you, anything alive gets squashed. */
function landOnBlock(cells, p, here, blockIdx, fall, hooks) {
	const t = blockType(cells[blockIdx]);
	if (t === BLOCK.TELEPORT) {
		fall.fallDamage = 0;
		if (hooks.onTeleport) hooks.onTeleport(p, blockIdx);
		return;
	}
	if (t >= BLOCK.MONSTER_FIRST && t <= BLOCK.PLAYER_LAST) {
		const squashable =
			t < 16 ? 'monster' :
			t >= BLOCK.PLAYER_FIRST ? 'player' :
			(t >= 24 && t <= 27) ? 'sentry' : null;
		if (squashable && hooks.onSquash) hooks.onSquash(p, blockIdx, squashable, SQUASH_DAMAGE);
	}
	land(cells, p, here, fall, hooks);
}
