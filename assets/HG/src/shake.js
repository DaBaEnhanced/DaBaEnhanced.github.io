// Screen shake: a port of shake_screen (Sources/Main.s:4600).
//
// The original does this in the copper, not the blitter. Each frame it reads
// one entry from a table and adds it to the VERTICAL position of every raster
// wait in the list -- the display window start, the palette split, and every
// sky band. The whole picture therefore slides up and down together, HUD
// included, and nothing is redrawn to do it.
//
// The table is a damped oscillation that always ends on -127, the terminator:
//
//   12 16 12 0  -10 -14 -10 0  8 12 8 0  -7 -11 -7 0  6 8 6 0  -6 0  5 0 ...
//
// so a shake is a decaying bounce rather than random jitter, and it is purely
// vertical -- shake_x is set to zero at all four call sites in the sources.
//
// `power` is both the timer and the index: it starts wherever the caller set it
// and walks up one entry per frame until it reaches the terminator. That is why
// the callers pass different starting values -- a smaller number starts earlier
// in the table and shakes harder:
//
//   1   a falling block landing (Main.s:4307)     full, peaks at 16
//   17  a mine, a stun grenade (Main.s:3938)      half, peaks at 8
//   20  a grenade (Main.s:3644)                   a nudge, peaks at 6
//
// The port applies the offset as a vertical translate of the whole screen
// element, which is the same thing the copper shift produces: the picture moves
// within the display and the border follows it.

/** shake_table, Main.s:4618. The last entry is the terminator. */
export const SHAKE_TABLE = [
	0,
	12, 16, 12, 0,
	-10, -14, -10, 0,
	8, 12, 8, 0,
	-7, -11, -7, 0,
	6, 8, 6, 0,
	-6, 0,
	5, 0,
	-4, 0,
	3, 0,
	-2, 0,
	1, 0,
	-1, 0,
	1, 0,
	-1, 0,
	-127,
];

export const SHAKE_END = -127;

/** The starting powers the sources use, by what causes them. */
export const SHAKE_BLOCK_LANDS = 1;
export const SHAKE_EXPLOSION = 17;
export const SHAKE_GRENADE = 20;

export function createShakeState() {
	return { power: 0, offset: 0 };
}

/**
 * Start a shake, or restart one already running.
 *
 * A new shake always wins: the original just writes shake_power, so a second
 * block landing mid-bounce restarts the sequence rather than being swallowed.
 * Taking the stronger of the two would be a different game.
 */
export function startShake(state, power = SHAKE_BLOCK_LANDS) {
	if (!state) return 0;
	const p = power | 0;
	state.power = (p >= 0 && p < SHAKE_TABLE.length) ? p : 0;
	return state.power;
}

/**
 * One frame of shake_screen.
 *
 * @returns the vertical offset to draw at, in view pixels; 0 when at rest
 */
export function stepShake(state) {
	if (!state || !state.power) return (state ? (state.offset = 0) : 0);
	const value = SHAKE_TABLE[state.power];
	if (value === SHAKE_END || value === undefined) {
		state.power = 0;
		state.offset = 0;
		return 0;
	}
	state.offset = value;
	state.power++;
	return value;
}

export function shakeActive(state) { return !!(state && state.power); }
