// Timed world effects: the rising and falling water, and the lightning flash.
//
// Both are ports of routines the original ran once per frame from the main loop,
// and both work by rewriting state the renderer already reads -- move_water
// edits the map cells in place, lightning swaps which copper sky ramp is in
// force. Neither needs anything from the draw path.

// --- Water ------------------------------------------------------------------
//
// Sources/Main.s:4499 move_water. The level is counted in QUARTERS of a map
// level and oscillates between the map's low and high marks; every cell whose
// FLOWING bit is set on the current level gets its water field rewritten to the
// current quarter. Levels above and below are left alone, so a body of water
// really does climb the map one level at a time.
//
// water_speed is a frame divisor. 0 means the map has no moving water at all,
// and 99 is the sentinel for "water is here but stays put".
const WATER_SHIFT = 17;
const WATER_HERE = 1 << 2;
const KEEP_WATER = (0b11 << WATER_SHIFT) | WATER_HERE;   // keep_water, Equates.i:590
const ERASE_WATER = ~KEEP_WATER;
const FLOWING_BIT = 11;                                  // flowing_bit_num, seen layer
const LEVEL_CELLS = 23 * 23;
const WATER_STATIC_SPEED = 99;
const STARTUP_WATER_STEPS = 19 * 23 + 1;                 // Main.s dbf #19*23

export function createWaterState(water) {
	const w = water || {};
	const speed = w.speed | 0;
	return {
		speed,
		// The header comment says the initial direction is no longer stored --
		// "just start water going up all the time now".
		level: w.level | 0,
		low: w.low | 0,
		high: w.high | 0,
		direction: 1,
		count: 0,
		active: speed !== 0 && speed !== WATER_STATIC_SPEED,
	};
}

function stepWater(state, cells, seen) {
	state.count = 0;

	// Reverse at either end BEFORE stepping, so the extremes are held for one
	// tick rather than skipped.
	if (state.level === state.low) state.direction = 1;
	if (state.level === state.high) state.direction = 0;
	state.level += state.direction ? 1 : -1;

	const quarter = state.level & 3;
	const level = state.level >> 2;
	const value = (quarter << WATER_SHIFT) | WATER_HERE;   // water_heights[quarter]
	const base = level * LEVEL_CELLS;
	if (base < 0 || base + LEVEL_CELLS > cells.length) return false;

	// Falling out of the top of a level: the level above has to be drained in the
	// same pass, or its water would be stranded there (.3_water_draw).
	const drainAbove = !state.direction && quarter === 3;
	const above = base + LEVEL_CELLS;

	for (let i = 0; i < LEVEL_CELLS; i++) {
		if (!((seen[base + i] >>> FLOWING_BIT) & 1)) continue;
		if (drainAbove && above + i < cells.length) {
			cells[above + i] = (cells[above + i] & ERASE_WATER) >>> 0;
		}
		cells[base + i] = ((cells[base + i] & ERASE_WATER) | value) >>> 0;
	}
	return true;
}

/**
 * Main.s calls force_move_water during the pre-screen startup loop. Unlike the
 * timed move_water path, this only checks water_speed != 0, so speed 99 maps are
 * seeded once at load and then stay static.
 */
export function forceMoveWater(state, cells, seen) {
	if (!state || !state.speed) return false;
	return stepWater(state, cells, seen);
}

export function initialiseWater(state, cells, seen) {
	if (!state || !state.speed) return false;
	let changed = false;
	for (let i = 0; i < STARTUP_WATER_STEPS; i++) {
		if (forceMoveWater(state, cells, seen)) changed = true;
	}
	return changed;
}

/**
 * One frame of move_water. Returns true when cells changed and the views need
 * redrawing (the original sets redraw_flag for exactly this reason).
 */
export function moveWater(state, cells, seen, ticks = 1) {
	if (!state.active) return false;
	// water_count is one of the 50Hz vblank counters; move_water fires once it
	// reaches water_speed and resets it to zero.
	state.count += ticks;
	if (state.count < state.speed) return false;
	return stepWater(state, cells, seen);
}

// --- Lightning --------------------------------------------------------------
//
// Sources/Main.s:955 update_fx rolls the shared 16-bit RNG once a frame and,
// on a low enough value, sets a countdown of 1-16. update_sky (ColdStartup.s)
// then offsets the sky table by 5 ramps for as long as the countdown lasts and
// decrements it -- so the flash is a palette swap, not a drawn effect, and the
// horizon ramp (scotch_mist) deliberately does not move with it.
export const LIGHTNING_RAMP_OFFSET = 5;

export function createLightningState(seed = 0x1234) {
	return { random: seed & 0xffff, count: 0, thunder: false, drip: false };
}

const rol16 = (v, n) => ((v << n) | (v >>> (16 - n))) & 0xffff;

/**
 * One frame of the lightning roll. `suppress` stands in for the original's
 * gates -- any player firing, or the party riding a lift, blocks a strike.
 */
export function stepLightning(state, suppress = false) {
	let d2 = rol16((state.random * 27) & 0xffff, 7);
	state.random = d2;
	state.drip = d2 <= 100;                 // sample 4, the water drip
	state.thunder = false;
	if (suppress) return;
	d2 = rol16(d2, 7);                      // a second rotation, not stored back
	if (d2 > 100) return;
	state.count = (d2 & 0xf) + 1;
	state.thunder = true;
}

/** update_sky: consume one frame of the flash. True while it is lit. */
export function lightningActive(state) {
	if (state.count <= 0) return false;
	state.count--;
	return true;
}
