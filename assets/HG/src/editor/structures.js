// Doors, lifts, buttons and pushables.
//
// Each of these is two things at once: a record in a fixed-size table, and a
// cell in the map. The game reads both, and they have to agree -- a door record
// whose `posn` names a cell with no door block does nothing, and a door block
// with no record never moves. Everything here keeps the pair in step.
//
// `posn` is a BYTE offset into map_part1, so a cell index is posn >>> 2. Button
// data fields are offsets too, but into whichever table the action targets, so
// they are converted through the map's own tableOffsets rather than guessed.

import { cellIndex, cellOfIndex, inBounds, CELLS_PER_LAYER } from './mapdoc.js';
import { ACTION } from '../buttons.js';
import { setField, getField, BITS, snapshotTable } from './edit.js';

/** Table capacities, from HGmapstructure.h. */
export const LIMITS = {
	doors: 32, lifts: 32, buttons: 32, pushables: 32, monsters: 128, explosions: 32,
};

/** The block types that are a door, by facing. */
export const DOOR_BLOCKS = { front: 20, side: 21 };

export const cellOfPosn = (posn) => (posn | 0) >>> 2;
export const posnOfCell = (cell) => (cell | 0) << 2;

/** Every structure sitting on a cell, with the table it came from. */
export function structuresAt(doc, x, y, floor) {
	if (!inBounds(x, y, floor)) return [];
	const cell = cellIndex(x, y, floor);
	const out = [];
	for (const table of ['doors', 'lifts', 'pushables']) {
		for (const rec of doc.meta[table] || []) {
			if (cellOfPosn(rec.posn) === cell) out.push({ table, rec });
		}
	}
	for (const rec of doc.meta.monsters || []) {
		// Monsters carry x/y/floor rather than a posn.
		if (rec.x === x && rec.y === y && rec.floor === floor) out.push({ table: 'monsters', rec });
	}
	return out;
}

// A wall button is a PANEL, not a block (buttons.js activatePanel). The cell's
// `panel` field says which kind, and its `variant` is the button index:
//
//   0  a text sign, variant naming one of the map's 36 text panels
//   1  a button in the pressed state
//   2  a button in the raised state
//
// which lines up with the panel graphics: 29 text, 30 butin, 31 butout.
export const PANEL_TEXT = 0, PANEL_IN = 1, PANEL_OUT = 2;

/** The button record a cell names, or null when the cell is not a button. */
export function buttonAt(doc, x, y, floor) {
	if (!inBounds(x, y, floor)) return null;
	const word = doc.layers.cells[cellIndex(x, y, floor)] >>> 0;
	if (!(word & 0x00000008)) return null;                 // panel_here_bit
	const kind = getField(word, 'panel');
	if (kind !== PANEL_IN && kind !== PANEL_OUT) return null;
	const index = getField(word, 'variant');
	return (doc.meta.buttons || []).find((b) => b && b.index === index) || null;
}

/**
 * The lowest unused record INDEX, which is not the same as an array position:
 * the shipped tables are sparse. 01-ArtificialIsland's buttons are indexed
 * [0,1,2,3,4,5,6,8,9] -- 7 is missing -- so appending at position 9 would
 * collide with the record that already calls itself 9, and the cell would find
 * the wrong button.
 */
function freeIndex(list, limit) {
	const taken = new Set((list || []).filter((r) => r && r.used).map((r) => r.index));
	for (let i = 0; i < limit; i++) if (!taken.has(i)) return i;
	return -1;
}

/**
 * Add a door at a cell: the block goes into the map and a record into the
 * table, both pointing at each other.
 *
 * @returns the record, or null when the table is full
 */
export function addDoor(doc, history, x, y, floor, { side = false, key = 0, delay = 18 } = {}) {
	if (!inBounds(x, y, floor)) return null;
	snapshotTable(history, doc, 'doors');
	const doors = doc.meta.doors || (doc.meta.doors = []);
	if (doors.length >= LIMITS.doors) return null;
	const cell = cellIndex(x, y, floor);
	const block = side ? DOOR_BLOCKS.side : DOOR_BLOCKS.front;

	const before = doc.layers.cells[cell] >>> 0;
	const after = setField(setField(before, 'block', block), 'variant', 0);
	record(history, 'cells', cell, before, after);
	doc.layers.cells[cell] = after;

	// door_type is the cell the door restores itself to when it closes.
	const rec = {
		index: doors.length,
		posn: posnOfCell(cell),
		trig: 0, direction: 0, type: after,
		delay: delay | 0, delCount: 0, key: key | 0, buttonOnly: 0,
	};
	doors.push(rec);
	return rec;
}

export function addLift(doc, history, x, y, floor, opts = {}) {
	if (!inBounds(x, y, floor)) return null;
	snapshotTable(history, doc, 'lifts');
	const lifts = doc.meta.lifts || (doc.meta.lifts = []);
	if (lifts.length >= LIMITS.lifts) return null;
	const cell = cellIndex(x, y, floor);

	// A lift rides on a lift floor.
	const before = doc.layers.cells[cell] >>> 0;
	const after = setField(before, 'floor', 2);
	record(history, 'cells', cell, before, after);
	doc.layers.cells[cell] = after;

	const rec = {
		index: lifts.length,
		posn: posnOfCell(cell),
		height: floor,
		minHeight: opts.minHeight ?? Math.max(0, floor - 2),
		maxHeight: opts.maxHeight ?? floor,
		direction: 0,
		weight: opts.weight ?? 1,
		up: opts.up ?? 0, down: opts.down ?? 1,
		automove: opts.automove ?? 0,
	};
	lifts.push(rec);
	return rec;
}

/**
 * Add a button. The cell gets a button block whose `variant` is the record
 * index, which is how the game finds the record from the cell.
 */
export function addButton(doc, history, x, y, floor, { out = false, action = 0, target = null } = {}) {
	if (!inBounds(x, y, floor)) return null;
	snapshotTable(history, doc, 'buttons');
	const buttons = doc.meta.buttons || (doc.meta.buttons = []);
	const slot = freeIndex(buttons, LIMITS.buttons);
	if (slot < 0) return null;
	const cell = cellIndex(x, y, floor);

	const before = doc.layers.cells[cell] >>> 0;
	let after = setField(before, 'panel', out ? PANEL_OUT : PANEL_IN);
	after = setField(after, 'variant', slot);
	record(history, 'cells', cell, before, after);
	doc.layers.cells[cell] = after;

	const data = target === null ? 0 : targetData(doc, target);
	const rec = {
		index: slot, used: -1,
		actionIn: action | 0, actionOut: action | 0,
		dataIn: data, dataOut: data,
		delay: 0,
	};
	// Replace a spent record with the same index if there is one, else append.
	const at = buttons.findIndex((b) => b && b.index === slot);
	if (at >= 0) buttons[at] = rec; else buttons.push(rec);
	return rec;
}

/**
 * Turn a button target into the offset the game expects. A cell target is an
 * offset into the map data; a lift or door target is an offset into that table.
 */
export function targetData(doc, target) {
	const t = doc.meta.tableOffsets || {};
	if (target.cell !== undefined) return (t.mapData | 0) + posnOfCell(target.cell);
	if (target.lift !== undefined) return (t.lifts | 0) + target.lift * LIFT_SIZE;
	if (target.door !== undefined) return (t.doors | 0) + target.door * DOOR_SIZE;
	return 0;
}

// Record sizes, from HGmapstructure.h.
export const LIFT_SIZE = 10;
export const DOOR_SIZE = 12;

/** Remove whatever structure a cell holds, and clear the cell to match. */
export function removeStructureAt(doc, history, x, y, floor) {
	if (!inBounds(x, y, floor)) return 0;
	const cell = cellIndex(x, y, floor);
	let removed = 0;

	// The cell's own history cannot see the header tables, so every one this
	// might splice from is remembered before anything is spliced.
	for (const t of ['doors', 'lifts', 'pushables', 'buttons', 'monsters']) {
		snapshotTable(history, doc, t);
	}

	for (const table of ['doors', 'lifts', 'pushables']) {
		const list = doc.meta[table];
		if (!list) continue;
		for (let i = list.length - 1; i >= 0; i--) {
			if (cellOfPosn(list[i].posn) !== cell) continue;
			list.splice(i, 1);
			removed++;
		}
	}
	const b = buttonAt(doc, x, y, floor);
	if (b) {
		b.used = 0;
		const before = doc.layers.cells[cell] >>> 0;
		const after = setField(before, 'panel', null);   // clears the panel bit too
		record(history, 'cells', cell, before, after);
		doc.layers.cells[cell] = after;
		removed++;
	}

	const monsters = doc.meta.monsters;
	if (monsters) {
		for (let i = monsters.length - 1; i >= 0; i--) {
			const m = monsters[i];
			if (m.x === x && m.y === y && m.floor === floor) { monsters.splice(i, 1); removed++; }
		}
	}

	if (removed) {
		// Take the block away too, so no orphan door or button is left behind.
		const before = doc.layers.cells[cell] >>> 0;
		const after = setField(before, 'block', null);
		if (after !== before) {
			record(history, 'cells', cell, before, after);
			doc.layers.cells[cell] = after;
		}
	}
	return removed;
}

/** Renumber `index` so it matches position after any removal. */
export function reindex(doc) {
	for (const table of ['doors', 'lifts', 'pushables']) {
		(doc.meta[table] || []).forEach((r, i) => { r.index = i; });
	}
}

/**
 * Every structure whose record and cell disagree. Reported, never repaired --
 * a half-finished edit is the author's business, and saving is never blocked.
 */
export function danglingStructures(doc) {
	const out = [];
	const cells = doc.layers.cells;
	for (const rec of doc.meta.doors || []) {
		const b = getField(cells[cellOfPosn(rec.posn)] >>> 0, 'block');
		if (b !== DOOR_BLOCKS.front && b !== DOOR_BLOCKS.side) {
			out.push(`door ${rec.index} has no door block at its cell`);
		}
	}
	for (const rec of doc.meta.lifts || []) {
		const w = cells[cellOfPosn(rec.posn)] >>> 0;
		if (getField(w, 'floor') !== 2) out.push(`lift ${rec.index} has no lift floor at its cell`);
		if (rec.minHeight > rec.maxHeight) out.push(`lift ${rec.index} travels nowhere`);
	}
	out.push(...danglingPushables(doc));
	return out;
}

function record(history, layer, index, before, after) {
	if (!history || before === after) return;
	if (history.at < history.entries.length) history.entries.length = history.at;
	history.entries.push({ layer, index, before, after, group: history.group });
	history.at = history.entries.length;
}

// ---------------------------------------------------------------------------
// Loose items and monsters.
//
// A loose item is two halves as well: the CELL needs a container auxiliary
// (aux 2-6) so something is there to pick up, and the ITEMS layer holds what it
// is -- item number in the low byte, then damage, then ammo (inventory.js
// looseItemAt). Writing one without the other leaves either an empty crate or
// an item nothing can reach.

export const AUX_CONTAINER_FIRST = 2;
export const AUX_CONTAINER_LAST = 6;
const ITEM_DAMAGE_SHIFT = 8;
const ITEM_AMMO_SHIFT = 16;

/** What is lying on a cell, or null. */
export function itemAt(doc, x, y, floor) {
	if (!inBounds(x, y, floor)) return null;
	const i = cellIndex(x, y, floor);
	const cell = doc.layers.cells[i] >>> 0;
	if (!(cell & 0x20)) return null;                      // aux_here_bit
	const aux = getField(cell, 'aux');
	if (aux < AUX_CONTAINER_FIRST || aux > AUX_CONTAINER_LAST) return null;
	const word = doc.layers.items[i] >>> 0;
	const num = word & 255;
	if (!num) return null;
	return {
		num, container: aux,
		damage: (word >>> ITEM_DAMAGE_SHIFT) & 255,
		ammo: (word >>> ITEM_AMMO_SHIFT) & 255,
	};
}

/**
 * Lay an item on a cell. `container` picks which crate graphic holds it.
 * @returns true when anything changed
 */
export function placeItem(doc, history, x, y, floor, num, opts = {}) {
	if (!inBounds(x, y, floor) || !num) return false;
	const container = Math.max(AUX_CONTAINER_FIRST,
		Math.min(AUX_CONTAINER_LAST, opts.container ?? AUX_CONTAINER_FIRST));
	const i = cellIndex(x, y, floor);

	const cellBefore = doc.layers.cells[i] >>> 0;
	const cellAfter = setField(cellBefore, 'aux', container);
	record(history, 'cells', i, cellBefore, cellAfter);
	doc.layers.cells[i] = cellAfter;

	// The upper bits of map_cell3 are light and sky flags -- keep them.
	const itemBefore = doc.layers.items[i] >>> 0;
	const itemAfter = (((itemBefore & 0xff000000) >>> 0)
		| (((opts.ammo ?? 0) & 255) << ITEM_AMMO_SHIFT)
		| (((opts.damage ?? 0) & 255) << ITEM_DAMAGE_SHIFT)
		| (num & 255)) >>> 0;
	record(history, 'items', i, itemBefore, itemAfter);
	doc.layers.items[i] = itemAfter;
	return cellAfter !== cellBefore || itemAfter !== itemBefore;
}

export function removeItem(doc, history, x, y, floor) {
	if (!inBounds(x, y, floor)) return false;
	const i = cellIndex(x, y, floor);
	const cellBefore = doc.layers.cells[i] >>> 0;
	const itemBefore = doc.layers.items[i] >>> 0;
	if (!(itemBefore & 255)) return false;

	const cellAfter = setField(cellBefore, 'aux', null);
	const itemAfter = (itemBefore & 0xff000000) >>> 0;   // keep the flags
	record(history, 'cells', i, cellBefore, cellAfter);
	record(history, 'items', i, itemBefore, itemAfter);
	doc.layers.cells[i] = cellAfter;
	doc.layers.items[i] = itemAfter;
	return true;
}

/**
 * Place a monster. Unlike the others these carry x/y/floor directly rather
 * than a posn, and the cell itself is left alone -- the game stamps monsters
 * into the map at load (stampMonsters).
 */
export function addMonster(doc, x, y, floor, { type = 0, health = 1000, direction = 0 } = {}) {
	if (!inBounds(x, y, floor)) return null;
	const list = doc.meta.monsters || (doc.meta.monsters = []);
	if (list.length >= LIMITS.monsters) return null;
	const rec = {
		type: type | 0, mem: 0, health: health | 0,
		direction: direction & 3, x, y, floor, count: 0, pad: 0,
	};
	list.push(rec);
	return rec;
}

// ---------------------------------------------------------------------------
// Wiring a button to what it operates.
//
// A button record holds an action and a data word for each of press and
// release. The data word is a byte offset from the map base, and WHICH table it
// points into depends on the action: floor and block actions name a cell, 9-12
// name a lift, 14-18 name a door. targetData above encodes that; this decodes
// it, so the editor can show an existing button's target and change it.


/** Which table an action's data word points into, or null for none. */
export function actionTarget(action) {
	const a = action | 0;
	if (a >= ACTION.FLOOR_ON && a <= ACTION.BLOCK_TOGGLE) return 'cell';
	if (a >= ACTION.LIFT_UP && a <= ACTION.LIFT_TOGGLE) return 'lift';
	if (a >= ACTION.DOOR_OPEN && a <= ACTION.DOOR_UNLOCK) return 'door';
	return null;
}

/** The original editor's own labels, from the gadget text in HGedit2.c. */
export const ACTION_NAMES = {
	[ACTION.NOTHING]: 'Nothing',
	[ACTION.FLOOR_ON]: 'Floor on', [ACTION.FLOOR_OFF]: 'Floor off',
	[ACTION.FLOOR_TOGGLE]: 'Toggle Floor',
	[ACTION.BLOCK_ON]: 'Block on', [ACTION.BLOCK_OFF]: 'Block off',
	[ACTION.BLOCK_TOGGLE]: 'Toggle Block',
	[ACTION.HATCH]: 'Hatch egg', [ACTION.PSI]: 'Psi',
	[ACTION.LIFT_UP]: 'Lift up', [ACTION.LIFT_DOWN]: 'Lift down',
	[ACTION.LIFT_STOP]: 'Lift stop', [ACTION.LIFT_TOGGLE]: 'Toggle Lift',
	[ACTION.DOOR_OPEN]: 'Open Door', [ACTION.DOOR_CLOSE]: 'Close Door',
	[ACTION.DOOR_TOGGLE]: 'Toggle Door',
	[ACTION.DOOR_LOCK]: 'Lock Door', [ACTION.DOOR_UNLOCK]: 'Unlock Door',
};

/** Every action a button can be given, in code order. */
export const ACTION_LIST = Object.keys(ACTION_NAMES)
	.map(Number).sort((a, b) => a - b)
	.filter((a) => a !== ACTION.UNUSED)
	.map((a) => ({ action: a, name: ACTION_NAMES[a], target: actionTarget(a) }));

/**
 * Turn a stored data word back into a target, given the action that reads it.
 * Returns null when the action takes no target or the offset does not line up
 * with a record boundary -- a map can hold a stale word, and inventing an index
 * for it would be worse than admitting it is unresolvable.
 */
export function decodeTarget(doc, data, action) {
	const kind = actionTarget(action);
	if (!kind) return null;
	const t = doc.meta.tableOffsets || {};
	const d = data | 0;
	if (kind === 'cell') {
		const off = d - (t.mapData | 0);
		if (off < 0 || off % 4) return null;
		const cell = cellOfPosn(off);
		return cell < CELLS_PER_LAYER ? { cell } : null;
	}
	const base = kind === 'lift' ? (t.lifts | 0) : (t.doors | 0);
	const size = kind === 'lift' ? LIFT_SIZE : DOOR_SIZE;
	const off = d - base;
	if (off < 0 || off % size) return null;
	const index = off / size;
	return index < LIMITS[`${kind}s`] ? { [kind]: index } : null;
}

/**
 * Point one side of a button at something. `which` is 'in' or 'out'. Passing a
 * null target clears the data word, which is what an action taking no target
 * wants.
 */
export function setButtonAction(doc, button, which, action, target = null) {
	if (!button) return false;
	const suffix = which === 'out' ? 'Out' : 'In';
	const data = target === null ? 0 : targetData(doc, target);
	const changed = button[`action${suffix}`] !== (action | 0)
		|| button[`data${suffix}`] !== data;
	button[`action${suffix}`] = action | 0;
	button[`data${suffix}`] = data;
	return changed;
}

/** A one-line description of what a button does, for the inspector. */
export function describeButton(doc, button) {
	const side = (which) => {
		const a = button[which === 'out' ? 'actionOut' : 'actionIn'] | 0;
		const name = ACTION_NAMES[a] ?? `action ${a}`;
		if (!actionTarget(a)) return name;
		const t = decodeTarget(doc, button[which === 'out' ? 'dataOut' : 'dataIn'], a);
		if (!t) return `${name} (unresolved)`;
		if (t.cell !== undefined) {
			const { x, y, floor } = cellOfIndex(t.cell);
			return `${name} @ ${x},${y},${floor}`;
		}
		return `${name} #${t.lift ?? t.door}`;
	};
	return { in: side('in'), out: side('out') };
}

// ---------------------------------------------------------------------------
// Payloads that live in the ITEMS layer.
//
// Two block types keep their data outside the cell word entirely, in map_part3
// at the block's own cell (Controls&Movement.s:8098 and 8070 both step
// `add.l #map_part_size*2,a3` to get there):
//
//   teleport (block 6)  the destination, as a BYTE offset into map_part1
//   ft boost (block 2)  the fitness increment, as a plain number
//
// Nothing in the cell word hints at either, so a teleport with no payload sends
// you to cell 0 and looks like a bug rather than an unfinished pad.

export const BLOCK_BOOST = 2, BLOCK_TELEPORT = 6;

function itemsWord(doc, x, y, floor) {
	if (!inBounds(x, y, floor)) return null;
	return cellIndex(x, y, floor);
}

function writeItems(doc, history, index, value) {
	const before = doc.layers.items[index] >>> 0;
	const after = value >>> 0;
	if (before === after) return false;
	record(history, 'items', index, before, after);
	doc.layers.items[index] = after;
	return true;
}

/** The cell a teleport sends you to, or null if it is not a teleport. */
export function teleportTargetAt(doc, x, y, floor) {
	const i = itemsWord(doc, x, y, floor);
	if (i === null) return null;
	const word = doc.layers.cells[i] >>> 0;
	if (!(word & BITS.blockHere) || getField(word, 'block') !== BLOCK_TELEPORT) return null;
	const dest = (doc.layers.items[i] >>> 0) >>> 2;
	return dest < CELLS_PER_LAYER ? dest : null;
}

/** Point a teleport at a destination cell index. */
export function setTeleportTarget(doc, history, x, y, floor, destCell) {
	const i = itemsWord(doc, x, y, floor);
	if (i === null || !(destCell >= 0 && destCell < CELLS_PER_LAYER)) return false;
	return writeItems(doc, history, i, posnOfCell(destCell));
}

/** The fitness a boost pad grants, or null if it is not a boost pad. */
export function boostAmountAt(doc, x, y, floor) {
	const i = itemsWord(doc, x, y, floor);
	if (i === null) return null;
	const word = doc.layers.cells[i] >>> 0;
	if (!(word & BITS.blockHere) || getField(word, 'block') !== BLOCK_BOOST) return null;
	return doc.layers.items[i] >>> 0;
}

export function setBoostAmount(doc, history, x, y, floor, amount) {
	const i = itemsWord(doc, x, y, floor);
	if (i === null) return false;
	return writeItems(doc, history, i, Math.max(0, Math.min(65535, amount | 0)));
}

// ---------------------------------------------------------------------------
// Eggs.
//
// This is how the campaign actually places monsters: not one of the 128 records
// -- every shipped map leaves that table empty -- but a cell carrying aux 0 with
// its payload in layer 2:
//
//   seen >>> 12 & 0xff   which monster type hatches
//   seen >>> 20 (12 bits) hatch time in 20-second units
//                        4094 = random, 4093 and 4095 = never
//
// and a bit in the items layer saying whether an open shell is left behind.

export const AUX_EGG = 0;
export const EGG_NEVER = 4095, EGG_RANDOM = 4094, EGG_DORMANT = 4093;
const EGG_TYPE_SHIFT = 12, EGG_TYPE_MASK = 0xff;
const EGG_HATCH_SHIFT = 20;
const REMOVE_EGG_BIT = 0x40000000;

/** The egg on a cell, or null. */
export function eggAt(doc, x, y, floor) {
	if (!inBounds(x, y, floor)) return null;
	const i = cellIndex(x, y, floor);
	const word = doc.layers.cells[i] >>> 0;
	if (!(word & BITS.auxHere) || getField(word, 'aux') !== AUX_EGG) return null;
	const seen = doc.layers.seen[i] >>> 0;
	return {
		cell: i,
		type: (seen >>> EGG_TYPE_SHIFT) & EGG_TYPE_MASK,
		hatch: seen >>> EGG_HATCH_SHIFT,
		leaveShell: !(doc.layers.items[i] & REMOVE_EGG_BIT),
	};
}

/**
 * Place or update an egg. `hatch` is in 20-second units; the three reserved
 * values above mean random or never.
 */
export function placeEgg(doc, history, x, y, floor,
	{ type = 0, hatch = EGG_RANDOM, leaveShell = true } = {}) {
	if (!inBounds(x, y, floor)) return null;
	const i = cellIndex(x, y, floor);

	const cellBefore = doc.layers.cells[i] >>> 0;
	const cellAfter = setField(cellBefore, 'aux', AUX_EGG);
	if (cellAfter !== cellBefore) {
		record(history, 'cells', i, cellBefore, cellAfter);
		doc.layers.cells[i] = cellAfter;
	}

	// Only the egg's own bits move; the seen layer also carries flowing_bit and
	// the per-player seen flags, which must survive.
	const seenBefore = doc.layers.seen[i] >>> 0;
	const keep = seenBefore & ~(((EGG_TYPE_MASK << EGG_TYPE_SHIFT) | (0xfff << EGG_HATCH_SHIFT)) >>> 0);
	const seenAfter = (keep
		| ((type & EGG_TYPE_MASK) << EGG_TYPE_SHIFT)
		| ((hatch & 0xfff) << EGG_HATCH_SHIFT)) >>> 0;
	if (seenAfter !== seenBefore) {
		record(history, 'seen', i, seenBefore, seenAfter);
		doc.layers.seen[i] = seenAfter;
	}

	const itemsBefore = doc.layers.items[i] >>> 0;
	const itemsAfter = (leaveShell
		? (itemsBefore & ~REMOVE_EGG_BIT)
		: (itemsBefore | REMOVE_EGG_BIT)) >>> 0;
	if (itemsAfter !== itemsBefore) {
		record(history, 'items', i, itemsBefore, itemsAfter);
		doc.layers.items[i] = itemsAfter;
	}
	return eggAt(doc, x, y, floor);
}

/**
 * The facing an egg hatches into, or null for the original's random roll.
 *
 * Stored beside the cells rather than in them: map_cell2 is full. See
 * monsters.js eggDirection for the read side.
 */
export function eggDirectionAt(doc, x, y, floor) {
	if (!inBounds(x, y, floor)) return null;
	const d = doc.meta.eggDirections?.[cellIndex(x, y, floor)];
	return d === undefined || d === null ? null : (d & 3);
}

/** Pass null to go back to the random roll. @returns true if changed */
export function setEggDirection(doc, x, y, floor, direction) {
	if (!inBounds(x, y, floor)) return false;
	const i = cellIndex(x, y, floor);
	const table = doc.meta.eggDirections || (doc.meta.eggDirections = {});
	const before = table[i];
	if (direction === null || direction === undefined) {
		if (before === undefined) return false;
		delete table[i];
		// An empty table is noise in the saved JSON.
		if (!Object.keys(table).length) delete doc.meta.eggDirections;
		return true;
	}
	const next = direction & 3;
	if (before === next) return false;
	table[i] = next;
	return true;
}

export function removeEgg(doc, history, x, y, floor) {
	if (!eggAt(doc, x, y, floor)) return false;
	setEggDirection(doc, x, y, floor, null);
	const i = cellIndex(x, y, floor);
	const cellBefore = doc.layers.cells[i] >>> 0;
	const cellAfter = setField(cellBefore, 'aux', null);
	record(history, 'cells', i, cellBefore, cellAfter);
	doc.layers.cells[i] = cellAfter;

	const seenBefore = doc.layers.seen[i] >>> 0;
	const seenAfter = (seenBefore & ~(((EGG_TYPE_MASK << EGG_TYPE_SHIFT) | (0xfff << EGG_HATCH_SHIFT)) >>> 0)) >>> 0;
	if (seenAfter !== seenBefore) {
		record(history, 'seen', i, seenBefore, seenAfter);
		doc.layers.seen[i] = seenAfter;
	}
	return true;
}

// ---------------------------------------------------------------------------
// Pressure pads.
//
// A pad is not an object: it is FLOOR TYPE 1, and the button it fires is named
// by the VARIANT of the cell one level BELOW it (buttons.js:110). That split is
// the whole trick, and it has two consequences the editor has to respect -- a
// pad cannot sit on floor 0, and the cell below must not already be spending its
// variant on a panel slot.

export const PAD_FLOOR_TYPE = 1;

/** The button a pad fires, plus where its index is stored. */
export function padAt(doc, x, y, floor) {
	if (!inBounds(x, y, floor) || floor === 0) return null;
	const i = cellIndex(x, y, floor);
	const word = doc.layers.cells[i] >>> 0;
	if (!(word & BITS.floorHere) || getField(word, 'floor') !== PAD_FLOOR_TYPE) return null;
	const belowIndex = cellIndex(x, y, floor - 1);
	const index = getField(doc.layers.cells[belowIndex] >>> 0, 'variant');
	const button = (doc.meta.buttons || []).find((b) => b && b.index === index) || null;
	return { button, index, belowCell: belowIndex };
}

/** Why a cell cannot hold a pad, or null when it can. */
export function padBlocker(doc, x, y, floor) {
	if (!inBounds(x, y, floor)) return 'out of bounds';
	if (floor === 0) return 'a pad needs a cell below it to name its button';
	const below = doc.layers.cells[cellIndex(x, y, floor - 1)] >>> 0;
	if (below & BITS.panelHere) {
		return 'the cell below uses its variant for a panel, so it cannot name a button';
	}
	return null;
}

/**
 * Lay a pressure pad and give it a button record. Unlike a wall button the
 * record index goes BELOW, so both cells are written.
 *
 * @returns the record, or null when it cannot be placed
 */
export function addPad(doc, history, x, y, floor, { action = 0, target = null } = {}) {
	if (padBlocker(doc, x, y, floor)) return null;
	const buttons = doc.meta.buttons || (doc.meta.buttons = []);
	const slot = freeIndex(buttons, LIMITS.buttons);
	if (slot < 0) return null;

	const i = cellIndex(x, y, floor);
	const before = doc.layers.cells[i] >>> 0;
	const after = setField(before, 'floor', PAD_FLOOR_TYPE);
	if (after !== before) {
		record(history, 'cells', i, before, after);
		doc.layers.cells[i] = after;
	}

	const belowIndex = cellIndex(x, y, floor - 1);
	const belowBefore = doc.layers.cells[belowIndex] >>> 0;
	const belowAfter = setField(belowBefore, 'variant', slot);
	if (belowAfter !== belowBefore) {
		record(history, 'cells', belowIndex, belowBefore, belowAfter);
		doc.layers.cells[belowIndex] = belowAfter;
	}

	const data = target === null ? 0 : targetData(doc, target);
	const rec = {
		index: slot, used: -1,
		actionIn: action | 0, actionOut: action | 0,
		dataIn: data, dataOut: data,
		delay: 0,
	};
	const at = buttons.findIndex((b) => b && b.index === slot);
	if (at >= 0) buttons[at] = rec; else buttons.push(rec);
	return rec;
}

// ---------------------------------------------------------------------------
// DEVIATION FROM THE ORIGINAL: a sample on a button.
//
// The map format has no sound trigger at all -- no sample field in any table,
// in any cell layer. Audio comes only from the map's ambience, the music, and
// the fixed per-item and per-monster samples. So a pad that plays a sound is a
// new capability, not a restored one.
//
// It rides on the button record rather than a new table, because a button
// already IS the "something happened here" object: pads fire them by standing
// on them, wall buttons by pressing. Export is JSON, so the fields are simply
// absent on every shipped map and default to silence -- nothing existing is
// reinterpreted.

/** Give a button a sample, or clear it with a null key. */
export function setButtonSound(doc, button, key, { once = false, onRelease = false } = {}) {
	if (!button) return false;
	const had = button.sample ?? null;
	if (key === null || key === undefined || key === '') {
		delete button.sample;
		delete button.sampleOnce;
		delete button.sampleOnRelease;
		return had !== null;
	}
	button.sample = String(key);
	if (once) button.sampleOnce = true; else delete button.sampleOnce;
	if (onRelease) button.sampleOnRelease = true; else delete button.sampleOnRelease;
	return true;
}

export function buttonSound(button) {
	if (!button || !button.sample) return null;
	return {
		key: button.sample,
		once: !!button.sampleOnce,
		onRelease: !!button.sampleOnRelease,
	};
}

// ---------------------------------------------------------------------------
// Corpses and wall panels.
//
// A corpse is an aux value like any other, but WHICH corpse art you get depends
// on the map's monster sets rather than on the creature that died: aux 14 draws
// monster set 1's body and aux 15 draws set 2's (monsters.js:580). Aux 7 is the
// player skeleton -- the original editor's aux_names has no entry for it, which
// is why it shows as "--" there.
export const AUX_DEAD_SET1 = 14, AUX_DEAD_SET2 = 15, AUX_SKELETON = 7;

export const CORPSE_KINDS = [
	{ aux: AUX_DEAD_SET1, label: 'Body (monster set 1)' },
	{ aux: AUX_DEAD_SET2, label: 'Body (monster set 2)' },
	{ aux: AUX_SKELETON, label: 'Skeleton' },
];

/** Lay a corpse on a cell. A cell has one aux slot, so this replaces it. */
export function placeCorpse(doc, history, x, y, floor, aux = AUX_DEAD_SET1) {
	if (!inBounds(x, y, floor)) return false;
	if (!CORPSE_KINDS.some((k) => k.aux === aux)) return false;
	const i = cellIndex(x, y, floor);
	const before = doc.layers.cells[i] >>> 0;
	const after = setField(before, 'aux', aux);
	if (after === before) return false;
	record(history, 'cells', i, before, after);
	doc.layers.cells[i] = after;
	return true;
}

/** The corpse on a cell, or null. */
export function corpseAt(doc, x, y, floor) {
	if (!inBounds(x, y, floor)) return null;
	const w = doc.layers.cells[cellIndex(x, y, floor)] >>> 0;
	if (!(w & BITS.auxHere)) return null;
	const aux = getField(w, 'aux');
	return CORPSE_KINDS.find((k) => k.aux === aux) || null;
}

// A wall panel is the text plate you read in the 3D view. buildDrawList only
// draws its CONTENT for panel frame 0 at view slot 57 (view.js:696), i.e. the
// plate on the wall directly ahead -- frames 1 and 2 are the button graphics,
// which is why a button and a sign share the panel field.
export const PANEL_FRAME_TEXT = 0;

/** Which panel slot a cell displays, or null when it holds no text plate. */
export function wallPanelAt(doc, x, y, floor) {
	if (!inBounds(x, y, floor)) return null;
	const w = doc.layers.cells[cellIndex(x, y, floor)] >>> 0;
	if (!(w & BITS.panelHere) || getField(w, 'panel') !== PANEL_FRAME_TEXT) return null;
	return getField(w, 'variant');
}

/** Remove a text plate, leaving the rest of the cell alone. */
export function removeWallPanel(doc, history, x, y, floor) {
	if (wallPanelAt(doc, x, y, floor) === null) return false;
	const i = cellIndex(x, y, floor);
	const before = doc.layers.cells[i] >>> 0;
	const after = setField(setField(before, 'panel', null), 'variant', 0);
	record(history, 'cells', i, before, after);
	doc.layers.cells[i] = after;
	return true;
}

/**
 * Wipe a cell: every layer, and every record that names it.
 *
 * "Remove" only takes out structures; this is the bigger hammer for when a cell
 * has accumulated a floor, a block, water, an item, an egg and a trigger and
 * picking them off one at a time is tedious. The three cell words are zeroed
 * together, because leaving a stray water level or a light bit behind is exactly
 * the sort of thing that is invisible until it is not.
 *
 * @returns a count of what went
 */
export function clearCell(doc, history, x, y, floor) {
	if (!inBounds(x, y, floor)) return 0;
	let n = 0;

	// Records first: they read the cell to find themselves.
	n += removeStructureAt(doc, history, x, y, floor);
	if (removeItem(doc, history, x, y, floor)) n++;

	// A monster record placed at this cell, if any.
	const monsters = doc.meta.monsters || [];
	for (let i = monsters.length - 1; i >= 0; i--) {
		const m = monsters[i];
		if (!m) continue;
		const at = m.posn !== undefined ? cellOfPosn(m.posn) : cellIndex(m.x, m.y, m.floor);
		if (at === cellIndex(x, y, floor)) { monsters.splice(i, 1); n++; }
	}

	const i = cellIndex(x, y, floor);
	for (const layer of ['cells', 'seen', 'items']) {
		const buf = doc.layers[layer];
		if (!buf) continue;
		const before = buf[i] >>> 0;
		if (!before) continue;
		record(history, layer, i, before, 0);
		buf[i] = 0;
		if (layer === 'cells') n++;
	}
	return n;
}

// ---------------------------------------------------------------------------
// Pushables.
//
// A pushable is two things that have to agree: a cell carrying the PUSHABLE
// bit, and a record in the pushables table holding the word to stamp down
// wherever the block ends up. movePushable clears a fixed set of fields out of
// both cells and then ORs that word into the destination, so the record is
// really "what this block looks like", travelling with it.
//
// Which fields those are is not a guess: across all 477 pushables the campaign
// ships, every record equals its own cell masked to exactly these bits, and no
// record carries a bit outside them. So the record is derived from the cell
// rather than assembled separately, and the two cannot drift.

/** The fields movePushable carries with the block (see pushables.js CLEARED). */
export const PUSH_TEMPLATE_MASK = (BITS.blockHere | (0x3f << 11) |
	BITS.panelHere | (0x3 << 19) | BITS.opaque | BITS.pushable | (0x1f << 23)) >>> 0;

/**
 * Blocks that make sense to push.
 *
 * The campaign uses two: crates (block 1, "Push") for 458 of the 477, and plain
 * stone for the rest -- usually with a sign panel on the front. Variant picks
 * the crate graphic.
 */
export const PUSH_BLOCKS = [
	{ block: 1, label: 'Crate' },
	{ block: 0, label: 'Stone' },
];

/** The template word a cell would produce, for previewing or repairing. */
export const pushTemplateOf = (word) => ((word >>> 0) & PUSH_TEMPLATE_MASK) >>> 0;

/** The pushable record on a cell, or null. */
export function pushableAt(doc, x, y, floor) {
	if (!inBounds(x, y, floor)) return null;
	const cell = cellIndex(x, y, floor);
	const list = doc.meta.pushables || [];
	const index = list.findIndex((p) => p && cellOfPosn(p.posn) === cell);
	if (index < 0) return null;
	return { index, rec: list[index], cell };
}

/**
 * Put a pushable block on a cell.
 *
 * Replaces rather than stacking: a cell can only hold one block, so a second
 * record would be a permanent inconsistency the mover reports as an orphan.
 *
 * @returns the record, or null if the cell cannot take one or the table is full
 */
export function addPushable(doc, history, x, y, floor,
		{ block = 1, variant = 0 } = {}) {
	if (!inBounds(x, y, floor)) return null;
	const cell = cellIndex(x, y, floor);
	snapshotTable(history, doc, 'pushables');
	const list = doc.meta.pushables || (doc.meta.pushables = []);
	const existing = pushableAt(doc, x, y, floor);
	if (!existing && list.length >= LIMITS.pushables) return null;

	const before = doc.layers.cells[cell] >>> 0;
	let after = setField(before, 'block', block & 0x3f);
	after = setField(after, 'variant', variant & 0x1f);
	// Opaque and pushable are not fields, so setField cannot reach them. A
	// pushable is always opaque -- every shipped one is, and a see-through crate
	// would let the view scanner read the wall behind it.
	after = (after | BITS.pushable | BITS.opaque) >>> 0;
	record(history, 'cells', cell, before, after);
	doc.layers.cells[cell] = after;

	const rec = existing?.rec || { index: list.length, posn: posnOfCell(cell), cell: 0 };
	rec.posn = posnOfCell(cell);
	rec.cell = pushTemplateOf(after);
	if (!existing) list.push(rec);
	reindex(doc);
	return rec;
}

/**
 * Take a pushable off a cell: the record and the block both go.
 *
 * @returns true if something was removed
 */
export function removePushable(doc, history, x, y, floor) {
	const found = pushableAt(doc, x, y, floor);
	if (!found) return false;
	snapshotTable(history, doc, 'pushables');
	doc.meta.pushables.splice(found.index, 1);

	const before = doc.layers.cells[found.cell] >>> 0;
	let after = setField(before, 'block', null);
	after = (after & ~BITS.pushable & ~BITS.opaque) >>> 0;
	record(history, 'cells', found.cell, before, after);
	doc.layers.cells[found.cell] = after;
	reindex(doc);
	return true;
}

/**
 * Pushables whose record and cell disagree.
 *
 * The mover halts the original with a red screen when a block it is moving has
 * no record; the port keeps going and reports an orphan. Either way it is worth
 * catching before the map is played, so this reports both directions: a block
 * with no record, and a record whose cell no longer holds the block.
 */
export function danglingPushables(doc) {
	const out = [];
	const cells = doc.layers.cells;
	const claimed = new Set();

	for (const rec of doc.meta.pushables || []) {
		const at = cellOfPosn(rec.posn);
		claimed.add(at);
		const word = cells[at] >>> 0;
		if (!(word & BITS.pushable)) {
			const c = cellOfIndex(at);
			out.push(`pushable ${rec.index} has no block at ${c.x},${c.y},${c.floor}`);
		} else if (pushTemplateOf(word) !== (rec.cell >>> 0)) {
			const c = cellOfIndex(at);
			out.push(`pushable ${rec.index} at ${c.x},${c.y},${c.floor} does not match its block`);
		}
	}
	for (let i = 0; i < cells.length; i++) {
		if (!(cells[i] & BITS.pushable) || claimed.has(i)) continue;
		const c = cellOfIndex(i);
		out.push(`the block at ${c.x},${c.y},${c.floor} is pushable but has no record`);
	}
	return out;
}
