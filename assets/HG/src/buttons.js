// Pressure pads: a port of check_pad_pushed / check_pad_released and
// do_button_action (Sources/Controls&Movement.s:6435, 6748).
//
// A pad is not an object in the map. It is FLOOR TYPE 1 -- a floor with no
// graphic of its own, so it reads as bare ground -- and the button it fires is
// identified by the VARIANT of the cell one level BELOW it. Stepping on runs
// button_action_in, stepping off runs button_action_out, which is how a door
// held open by standing on a plate falls shut behind you.
//
// The action's data field is a byte offset from the map base, and which table
// it indexes depends on the action: a cell for the floor and block actions, a
// lift for 9-12, a door for 14-18. hgmap.js records the table origins so those
// can be resolved back to an index.

const FLOOR_HERE = 1, BLOCK_HERE = 2, PANEL_HERE = 8;
const OPAQUE_BIT = 1 << 6;
const SHIFT = { floor: 9, block: 11, panel: 19, variant: 23 };
const MASK = { floor: 0x3, block: 0x3f, variant: 0x1f };
const KEEP_BLOCK = MASK.block << SHIFT.block;

const PAD_FLOOR_TYPE = 1;
const LIFT_SIZE = 10, DOOR_SIZE = 12, CELL_SIZE = 4;

export const ACTION = {
	NOTHING: 0,
	FLOOR_ON: 1, FLOOR_OFF: 2, FLOOR_TOGGLE: 3,
	BLOCK_ON: 4, BLOCK_OFF: 5, BLOCK_TOGGLE: 6,
	HATCH: 7, PSI: 8,
	LIFT_UP: 9, LIFT_DOWN: 10, LIFT_STOP: 11, LIFT_TOGGLE: 12,
	UNUSED: 13,
	DOOR_OPEN: 14, DOOR_CLOSE: 15, DOOR_TOGGLE: 16,
	DOOR_LOCK: 17, DOOR_UNLOCK: 18,
};

// DEVIATION FROM THE ORIGINAL. do_button_action is synchronous there: a button
// press lands the same frame. This port defers it, so a button has a settling
// time before the lift starts or the door moves.
//
// The delay lives in button_pad1, a byte the original never used -- it is zero
// in all 573 buttons across all 47 shipped maps, so nothing is being
// overwritten. It is read in TENTHS of a second, with 0 meaning "use the
// default", which is how every existing map inherits the default without any
// map data changing.
export const DEFAULT_BUTTON_DELAY_S = 1;
const VBLANK_HZ = 50;
const TENTHS_TO_TICKS = VBLANK_HZ / 10;

export function createButtonState(map, levelCells, opts = {}) {
	const t = map.tableOffsets || {};
	const fallback = opts.defaultDelaySeconds ?? DEFAULT_BUTTON_DELAY_S;
	return {
		buttons: (map.buttons || []).filter((b) => b && b.used),
		levelCells,
		// Table origins, so a data offset can be turned back into an index.
		liftsOffset: t.lifts | 0,
		doorsOffset: t.doors | 0,
		mapDataOffset: t.mapData | 0,
		defaultDelayTicks: Math.round(fallback * VBLANK_HZ),
		pending: [],
	};
}

/** Vblanks to wait before this button's action fires. */
function delayTicks(state, button) {
	const tenths = button ? (button.delay | 0) : 0;
	return tenths > 0 ? Math.round(tenths * TENTHS_TO_TICKS) : state.defaultDelayTicks;
}

/**
 * Queue an action instead of running it. The panel graphic still flips
 * immediately, so the press feels responsive and only the effect is delayed.
 */
function queueAction(state, button, action, data) {
	if (action === ACTION.NOTHING) return;
	const ticks = delayTicks(state, button);
	if (ticks <= 0) return { immediate: true, action, data };
	state.pending.push({ action, data, ticks });
	return null;
}

/**
 * Drain the queue. Call once per frame with the elapsed 50Hz vblanks.
 * @returns true when anything fired, i.e. the original's redraw_flag.
 */
export function stepButtons(state, cells, world, ticks = 1) {
	if (!state.pending.length) return false;
	let fired = false;
	for (let i = state.pending.length - 1; i >= 0; i--) {
		const p = state.pending[i];
		p.ticks -= ticks;
		if (p.ticks > 0) continue;
		state.pending.splice(i, 1);
		doButtonAction(state, cells, p.action, p.data, world);
		fired = true;
	}
	return fired;
}

/**
 * check_pad_pushed / check_pad_released for one cell.
 * @param pressed true on stepping in, false on stepping out.
 * @returns the action taken, or null when the cell is not a pad.
 */
export function checkPad(state, cells, cellIdx, pressed, world) {
	if (cellIdx < 0 || cellIdx >= cells.length) return null;
	const cell = cells[cellIdx];
	if (!(cell & FLOOR_HERE)) return null;
	if (((cell >>> SHIFT.floor) & MASK.floor) !== PAD_FLOOR_TYPE) return null;

	// The button index lives in the variant of the cell BELOW the pad.
	const below = cellIdx - state.levelCells;
	if (below < 0) return null;
	const index = (cells[below] >>> SHIFT.variant) & MASK.variant;
	const button = state.buttons.find((b) => b.index === index);
	if (!button) return null;

	const action = pressed ? button.actionIn : button.actionOut;
	const data = pressed ? button.dataIn : button.dataOut;
	const now = queueAction(state, button, action, data);
	if (now) doButtonAction(state, cells, action, data, world);
	fireButtonSound(state, button, pressed, world);
	return { index, action, data, delayTicks: delayTicks(state, button) };
}

// DEVIATION FROM THE ORIGINAL: a button may carry a sample.
//
// The map format has no sound trigger anywhere -- no sample field in any table
// or cell layer -- so this is a new capability, not a restored one. It hangs off
// the button record because a button is already the "something happened here"
// object, and it fires immediately rather than after the action delay: the
// sound is feedback for the press, not for the door that opens a second later.
//
// The fields are absent on every shipped map, so all 573 existing buttons stay
// silent without any data change.

function fireButtonSound(state, button, pressed, world) {
	const key = button && button.sample;
	if (!key || !world || !world.playSample) return false;
	// `sampleOnRelease` flips which edge speaks, so a pad can sound when you
	// step off it instead of on.
	if (pressed === !!button.sampleOnRelease) return false;
	if (button.sampleOnce) {
		state.soundsFired = state.soundsFired || new Set();
		if (state.soundsFired.has(button.index)) return false;
		state.soundsFired.add(button.index);
	}
	world.playSample(key);
	return true;
}

// Wall buttons are PANELS, not pads. activate_it dispatches on the panel type
// of the cell you are facing (Controls&Movement.s:6631):
//   type 1 = "butin"  -- the button is currently pressed in
//   type 2 = "butout" -- the button is currently raised
// Activating one runs the action for the state it is LEAVING and flips it to
// the other, so a pair of actions drives a door or lift both ways off one
// button. The button index is the panel cell's own variant.
const PANEL_IN = 1, PANEL_OUT = 2;
const KEEP_PANEL = (0x3 << SHIFT.panel) | PANEL_HERE;

/**
 * activate: press the wall button in the cell the player faces.
 * @returns what happened, or null when there is no button there.
 */
export function activatePanel(state, cells, cellIdx, world) {
	if (cellIdx < 0 || cellIdx >= cells.length) return null;
	const cell = cells[cellIdx];
	if (!(cell & PANEL_HERE)) return null;
	const type = (cell >>> SHIFT.panel) & 0x3;
	if (type !== PANEL_IN && type !== PANEL_OUT) return null;

	const index = (cell >>> SHIFT.variant) & MASK.variant;
	const button = state.buttons.find((b) => b.index === index);
	if (!button) return null;

	// A pressed button releases (running the "out" action), a raised one presses.
	const pressing = type === PANEL_OUT;
	const action = pressing ? button.actionIn : button.actionOut;
	const data = pressing ? button.dataIn : button.dataOut;
	const now = queueAction(state, button, action, data);
	if (now) doButtonAction(state, cells, action, data, world);
	fireButtonSound(state, button, pressing, world);

	const liveCell = cells[cellIdx] >>> 0;
	if (!(liveCell & PANEL_HERE)) {
		return {
			index, action, data, pressed: pressing,
			delayTicks: delayTicks(state, button),
			panelGone: true,
		};
	}

	// The panel itself flips at once -- only the action it triggers waits.
	const next = pressing ? PANEL_IN : PANEL_OUT;
	cells[cellIdx] = ((liveCell & ~KEEP_PANEL) | (next << SHIFT.panel) | PANEL_HERE) >>> 0;
	return { index, action, data, pressed: pressing, delayTicks: delayTicks(state, button) };
}

const liftIndex = (s, data) => Math.floor((data - s.liftsOffset) / LIFT_SIZE);
const doorIndex = (s, data) => Math.floor((data - s.doorsOffset) / DOOR_SIZE);
const cellOf = (s, data) => Math.floor((data - s.mapDataOffset) / CELL_SIZE);

function doButtonAction(state, cells, action, data, world = {}) {
	switch (action) {
		case ACTION.FLOOR_ON: setFloor(cells, cellOf(state, data), true); break;
		case ACTION.FLOOR_OFF: setFloor(cells, cellOf(state, data), false); break;
		case ACTION.FLOOR_TOGGLE: {
			const i = cellOf(state, data);
			setFloor(cells, i, !(cells[i] & FLOOR_HERE));
			break;
		}
		case ACTION.BLOCK_ON: setBlock(cells, cellOf(state, data), true); break;
		case ACTION.BLOCK_OFF: setBlock(cells, cellOf(state, data), false); break;
		case ACTION.BLOCK_TOGGLE: {
			const i = cellOf(state, data);
			setBlock(cells, i, !(cells[i] & BLOCK_HERE));
			break;
		}
		case ACTION.LIFT_UP: world.liftUp?.(liftIndex(state, data)); break;
		case ACTION.LIFT_DOWN: world.liftDown?.(liftIndex(state, data)); break;
		case ACTION.LIFT_STOP: world.liftStop?.(liftIndex(state, data)); break;
		case ACTION.LIFT_TOGGLE: world.liftToggle?.(liftIndex(state, data)); break;
		case ACTION.DOOR_OPEN: world.doorTrig?.(doorIndex(state, data), 1); break;
		case ACTION.DOOR_CLOSE: world.doorTrig?.(doorIndex(state, data), 2); break;
		case ACTION.DOOR_TOGGLE: world.doorToggle?.(doorIndex(state, data)); break;
		case ACTION.DOOR_LOCK: world.doorTrig?.(doorIndex(state, data), 3); break;
		case ACTION.DOOR_UNLOCK: world.doorTrig?.(doorIndex(state, data), 4); break;
		// hatch and psi_effect belong to the monster and spell systems.
		default: break;
	}
}

function setFloor(cells, i, on) {
	if (i < 0 || i >= cells.length) return;
	cells[i] = (on ? (cells[i] | FLOOR_HERE) : (cells[i] & ~FLOOR_HERE)) >>> 0;
}

function setBlock(cells, i, on) {
	if (i < 0 || i >= cells.length) return;
	const t = (cells[i] >>> SHIFT.block) & MASK.block;
	if (on) {
		if ((cells[i] & BLOCK_HERE) && t >= 1 && t <= 6) return;
		cells[i] = ((cells[i] & ~KEEP_BLOCK) | BLOCK_HERE | OPAQUE_BIT) >>> 0;
	} else {
		if (!(cells[i] & BLOCK_HERE) || t === 1 || t > 6) return;
		cells[i] = (cells[i] & ~KEEP_BLOCK & ~KEEP_PANEL & ~BLOCK_HERE & ~OPAQUE_BIT) >>> 0;
	}
}
