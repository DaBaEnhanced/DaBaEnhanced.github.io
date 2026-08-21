// Doors: a port of move_doors and open_door (Sources/Main.s:2229, 2890).
//
// A door has no separate sprite for each open position. The cell's VARIANT
// field counts 0-10, and blit_block's .mirror path uses it to slide the door's
// two halves apart -- so "half open" is a render-time split of one image, not
// eleven images. At variant 10 the block is erased from the cell entirely and
// the doorway becomes walkable; closing puts the block back and counts down.
//
// The door table lives in the map header, keyed by the cell offset it controls.

const SHIFT = { block: 11, variant: 23 };
const MASK = { block: 0x3f, variant: 0x1f };
const BLOCK_HERE = 2;
const KEEP_VARIANT = MASK.variant << SHIFT.variant;
const KEEP_BLOCK = MASK.block << SHIFT.block;

export const DOOR_OPEN_MAX = 10;
export const DOOR = { STOPPED: 0, OPENING: 1, CLOSING: 2, LOCKED: 3 };
export const TRIG = { NONE: 0, OPEN: 1, CLOSE: 2, LOCK: 3, UNLOCK: 4 };

const DOOR_FRONT = 20, DOOR_SIDE = 21;
const isDoorBlock = (t) => t === DOOR_FRONT || t === DOOR_SIDE;

// move_doors runs its step every time a 6-unit accumulator overflows, so the
// animation rate is independent of how often the caller ticks.
const DOOR_TICK = 6;

export function createDoorState(doors) {
	return {
		count: 0,
		// door_trig / door_direction / door_del_count are per-door mutable state;
		// the rest comes from the map and is left alone.
		doors: (doors || []).filter((d) => d && d.posn).map((d) => ({
			posn: d.posn,
			cell: d.posn >>> 2,          // door_posn is a BYTE offset into the map
			type: d.type >>> 0,          // door_type: the block value to restore
			delay: d.delay | 0,          // -1 = stays open
			key: d.key | 0,
			buttonOnly: d.buttonOnly === -1 || d.buttonOnly === 255,
			trig: TRIG.NONE,
			direction: d.direction | 0,
			delCount: 0,
		})),
	};
}

/**
 * open_door: the player walked into a door. Locked doors need the right key;
 * button-only doors ignore being walked into. Returns what happened so the
 * caller can play the sample and post the message.
 */
export function triggerDoor(state, cellIdx, opts = {}) {
	const door = state.doors.find((d) => d.cell === cellIdx);
	if (!door) return { found: false };
	if (door.buttonOnly) return { found: true, locked: true, buttonOnly: true, key: 0 };
	if (door.direction === DOOR.LOCKED) {
		if (door.key && !(opts.carrying && opts.carrying(door.key))) {
			return { found: true, locked: true, key: door.key };
		}
		door.direction = DOOR.STOPPED;
		door.trig = TRIG.OPEN;
		return { found: true, unlocked: true, key: door.key };
	}
	door.trig = TRIG.OPEN;
	return { found: true, opening: true };
}

/**
 * One frame of move_doors. Mutates `cells` and returns true when anything
 * changed, which is the original's redraw_flag.
 */
/**
 * @param hooks {{onDoorMoving?: function, onDoorArrived?: function}}
 *   Main.s:2342-2402 plays two sounds per door, and they are symmetric between
 *   opening and closing: sample 5 (period 428) once when a door is newly
 *   triggered in either direction, and sample 4 (period 568) when it reaches
 *   fully open or fully closed. Missing the arrival clunk is why the door
 *   sounded like it stopped before the animation did.
 */
export function moveDoors(state, cells, ticks = 1, hooks = {}) {
	state.count += ticks;
	let changed = false;
	while (state.count > DOOR_TICK) {
		state.count -= DOOR_TICK;
		if (stepDoors(state, cells, hooks)) changed = true;
	}
	return changed;
}

function stepDoors(state, cells, hooks = {}) {
	let changed = false;
	for (const door of state.doors) {
		const i = door.cell;
		if (i < 0 || i >= cells.length) continue;

		// Auto-close after door_delay ticks, but only once the doorway is clear
		// -- an occupied cell keeps the door open rather than shutting on you.
		if (door.delay >= 0 && !(cells[i] & BLOCK_HERE)) {
			if (++door.delCount >= door.delay) {
				door.delCount = 0;
				door.trig = TRIG.CLOSE;
			}
		}

		let newlyTriggered = false;
		switch (door.trig) {
			case TRIG.OPEN:
				door.trig = TRIG.NONE;
				if (door.direction !== DOOR.LOCKED && door.direction !== DOOR.OPENING) {
					door.direction = DOOR.OPENING; newlyTriggered = true;
				}
				break;
			case TRIG.CLOSE:
				door.trig = TRIG.NONE;
				if (door.direction !== DOOR.LOCKED && door.direction !== DOOR.CLOSING) {
					door.direction = DOOR.CLOSING; newlyTriggered = true;
				}
				break;
			case TRIG.LOCK:
				door.trig = TRIG.NONE;
				if (door.direction === DOOR.STOPPED) door.direction = DOOR.LOCKED;
				break;
			case TRIG.UNLOCK:
				door.trig = TRIG.NONE;
				if (door.direction === DOOR.LOCKED) door.direction = DOOR.STOPPED;
				break;
			default: break;
		}
		door.newlyTriggered = newlyTriggered;

		if (door.direction === DOOR.OPENING) {
			if (!(cells[i] & BLOCK_HERE)) continue;      // already fully open
			if (!isDoorBlock((cells[i] >>> SHIFT.block) & MASK.block)) {
				door.direction = DOOR.STOPPED;             // something else is here
				continue;
			}
			const v = (cells[i] >>> SHIFT.variant) & MASK.variant;
			if (v >= DOOR_OPEN_MAX) {
				// Fully open: the block leaves the cell so it becomes walkable.
				door.delCount = 0;
				door.direction = DOOR.STOPPED;
				cells[i] = (cells[i] & ~KEEP_BLOCK & ~BLOCK_HERE) >>> 0;
				hooks.onDoorArrived?.(door, i);
			} else {
				if (newlyTriggered) hooks.onDoorMoving?.(door, i);
				cells[i] = ((cells[i] & ~KEEP_VARIANT) | ((v + 1) << SHIFT.variant)) >>> 0;
			}
			changed = true;
		} else if (door.direction === DOOR.CLOSING) {
			let v;
			if (!(cells[i] & BLOCK_HERE)) {
				// Coming back from fully open: restore the block at full travel.
				cells[i] = (cells[i] & ~KEEP_VARIANT) >>> 0;
				v = DOOR_OPEN_MAX;
			} else {
				if (!isDoorBlock((cells[i] >>> SHIFT.block) & MASK.block)) {
					door.direction = DOOR.STOPPED;           // blocked by something
					continue;
				}
				v = (cells[i] >>> SHIFT.variant) & MASK.variant;
				if (v <= 0) {
					door.direction = DOOR.STOPPED;
					hooks.onDoorArrived?.(door, i);
					continue;
				}
			}
			if (newlyTriggered) hooks.onDoorMoving?.(door, i);
			cells[i] = ((cells[i] & ~KEEP_VARIANT & ~KEEP_BLOCK) |
				((v - 1) << SHIFT.variant) | door.type) >>> 0;
			changed = true;
		}
	}
	return changed;
}
