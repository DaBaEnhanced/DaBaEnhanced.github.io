// Cell editing and undo.
//
// Every edit is a write to one 32-bit word of map_part1, so undo is just the
// previous word. That keeps the history cheap enough to hold thousands of
// steps. Floor-wide operations (fill, the sky pass) will need whole-floor
// snapshots, which is why `pushEdit` takes a group id -- a group undoes as one
// step even though it is stored per cell.

import { cellIndex, inBounds, MAP_WIDTH, MAP_DEPTH } from './mapdoc.js';

// map_cell1 layout, from HGmapstructure.h.
export const BITS = {
	floorHere: 0x00000001,
	blockHere: 0x00000002,
	waterHere: 0x00000004,
	panelHere: 0x00000008,
	explosionHere: 0x00000010,
	auxHere: 0x00000020,
	opaque: 0x00000040,
	invisible: 0x00000080,
	pushable: 0x00000100,
};

export const FIELDS = {
	floor: { shift: 9, mask: 0x3, here: BITS.floorHere },
	block: { shift: 11, mask: 0x3f, here: BITS.blockHere },
	water: { shift: 17, mask: 0x3, here: BITS.waterHere },
	panel: { shift: 19, mask: 0x3, here: BITS.panelHere },
	explosion: { shift: 21, mask: 0x3, here: BITS.explosionHere },
	variant: { shift: 23, mask: 0x1f, here: 0 },
	aux: { shift: 28, mask: 0xf, here: BITS.auxHere },
};

/**
 * The original editor's own names for each field value, from the tables in
 * HGedit2.c. Those tables carry a leading "None" entry and are indexed as
 * `value + 1` when the presence bit is set (HGedit2.c:5697), so these are the
 * same lists with that entry dropped -- indexed by the raw field value.
 */
export const FIELD_NAMES = {
	// floor is 2 bits, so HGedit2.c's sixth name ("Light") is unreachable.
	floor: ['Grass', 'Button', 'Lift', 'Puddle'],
	block: [
		'Stone', 'Push', 'Ft Boost', 'Exit', 'Tree', 'Barrier', 'Teleport', 'Hydraulic',
		'--', '--', '--', '--', '--', '--', '--', '--',
		'Stairs N', 'Stairs E', 'Stairs S', 'Stairs W', 'Doors NS', 'Doors EW',
	],
	panel: ['Text', 'Button in', 'Button out'],
	aux: [
		'Monster', 'Egg Open', 'Cont 1', 'Cont 2', 'Cont 3', 'Cont 4', 'Cont 5', '--',
		'Stairs N', 'Stairs E', 'Stairs S', 'Stairs W', 'Frame NS', 'Frame EW',
		'Dead 1', 'Dead 2',
	],
};

/** The original editor's name for a field value, or null if it has none. */
export function fieldName(field, value) {
	const t = FIELD_NAMES[field];
	if (!t) return null;
	const n = t[value];
	return !n || n === '--' ? null : n;
}

export function getField(word, name) {
	const f = FIELDS[name];
	return (word >>> f.shift) & f.mask;
}

export function hasField(word, name) {
	const f = FIELDS[name];
	return f.here ? (word & f.here) !== 0 : true;
}

/**
 * Set a field and its presence bit. `value` of null clears the field --
 * presence off and the bits zeroed, which is what "erase" means here.
 */
export function setField(word, name, value) {
	const f = FIELDS[name];
	let w = word >>> 0;
	w = (w & ~(f.mask << f.shift)) >>> 0;
	if (value === null || value === undefined) {
		if (f.here) w = (w & ~f.here) >>> 0;
		return w >>> 0;
	}
	w = (w | ((value & f.mask) << f.shift)) >>> 0;
	if (f.here) w = (w | f.here) >>> 0;
	return w >>> 0;
}

export function createHistory(limit = 4000) {
	return { entries: [], at: 0, limit, group: 0 };
}

/** Begin a group; every edit until the next call undoes together. */
export function beginGroup(history) {
	history.group++;
	return history.group;
}

/**
 * Record a change. Call BEFORE writing, with the word that is about to be
 * replaced, so undo has something to restore.
 */
/**
 * Anything redone-past is discarded the moment a new edit lands. Table
 * snapshots are remembered separately, so the note of which tables this group
 * has already saved has to be rebuilt from whatever survives.
 */
function truncate(history) {
	if (history.at >= history.entries.length) return;
	history.entries.length = history.at;
	rebuildSnapped(history);
}

function rebuildSnapped(history) {
	history.snapped = new Set(history.entries
		.filter((e) => e.table)
		.map((e) => `${e.group}:${e.table}`));
}

function pushEdit(history, layer, index, before, after) {
	if (before === after) return false;
	truncate(history);
	history.entries.push({ layer, index, before, after, group: history.group });
	if (history.entries.length > history.limit) {
		history.entries.shift();
		rebuildSnapped(history);
	}
	history.at = history.entries.length;
	return true;
}

/**
 * Remember a header table before it is changed, so undo can put it back.
 *
 * Doors, lifts, buttons and pushables keep a record in the map header as well
 * as a cell in the grid, and the two are useless apart. The word-level history
 * cannot see the records, so without this an undo restores the cell and leaves
 * the record behind -- exactly the dangling pair the rest of the editor works
 * to prevent, and very visible after a bulk fill puts down thirty at once.
 *
 * One snapshot per table per group is enough: the group undoes as a unit, so
 * the state before its first change is the state to go back to.
 *
 * @returns true if a snapshot was taken
 */
export function snapshotTable(history, doc, table) {
	if (!history || !doc) return false;
	if (!history.snapped) history.snapped = new Set();
	const key = `${history.group}:${table}`;
	if (history.snapped.has(key)) return false;
	truncate(history);
	if (history.snapped.has(key)) return false;      // truncate may have re-added it
	history.entries.push({ table, before: cloneTable(doc.meta[table]), group: history.group });
	history.snapped.add(key);
	history.at = history.entries.length;
	return true;
}

/**
 * Write one cell field.
 * @returns true if anything changed
 */
export function editCell(doc, history, layer, x, y, floor, field, value) {
	if (!inBounds(x, y, floor)) return false;
	const cells = doc.layers[layer];
	if (!cells) return false;
	const i = cellIndex(x, y, floor);
	const before = cells[i] >>> 0;
	const after = setField(before, field, value);
	if (!pushEdit(history, layer, i, before, after)) return false;
	cells[i] = after;
	return true;
}

/** Write a raw word, for tools that set several fields at once. */
export function writeCell(doc, history, layer, x, y, floor, word) {
	if (!inBounds(x, y, floor)) return false;
	const cells = doc.layers[layer];
	if (!cells) return false;
	const i = cellIndex(x, y, floor);
	const before = cells[i] >>> 0;
	const after = word >>> 0;
	if (!pushEdit(history, layer, i, before, after)) return false;
	cells[i] = after;
	return true;
}

export function canUndo(history) { return history.at > 0; }
export function canRedo(history) { return history.at < history.entries.length; }

/**
 * A shallow copy of a header table.
 *
 * Most are arrays of records; the message pool is an object keyed by byte
 * offset. Both are one level deep, so one level of copying is enough.
 */
function cloneTable(table) {
	if (Array.isArray(table)) return table.map((r) => (r ? { ...r } : r));
	if (table && typeof table === 'object') {
		const out = {};
		for (const k of Object.keys(table)) out[k] = { ...table[k] };
		return out;
	}
	return Array.isArray(table) ? [] : table;
}

/**
 * Undo one group.
 *
 * A table entry's "after" is only known once the group is finished, so it is
 * captured here, on the way past -- which is exactly when redo starts needing
 * it and not a moment before.
 *
 * @returns the number of entries restored
 */
export function undo(doc, history) {
	if (!canUndo(history)) return 0;
	const group = history.entries[history.at - 1].group;
	let n = 0;
	while (history.at > 0 && history.entries[history.at - 1].group === group) {
		const e = history.entries[--history.at];
		if (e.table) {
			e.after = cloneTable(doc.meta[e.table]);
			doc.meta[e.table] = cloneTable(e.before);
		} else {
			doc.layers[e.layer][e.index] = e.before;
		}
		n++;
	}
	return n;
}

export function redo(doc, history) {
	if (!canRedo(history)) return 0;
	const group = history.entries[history.at].group;
	let n = 0;
	while (history.at < history.entries.length && history.entries[history.at].group === group) {
		const e = history.entries[history.at++];
		if (e.table) {
			if (e.after) doc.meta[e.table] = cloneTable(e.after);
		} else {
			doc.layers[e.layer][e.index] = e.after;
		}
		n++;
	}
	return n;
}

/**
 * The tools the palette offers. `field` names the map_cell1 field written;
 * `value` null erases. Names come from the style's own graphic names, so they
 * are the game's words rather than invented ones.
 */
// What a click does. `kind` splits them: a cell tool writes a field, `info`
// writes nothing at all (so you can read a cell without changing it), and the
// start and exit tools move a marker in the map header rather than the grid.
export const TOOLS = [
	{ id: 'info', label: 'Info', kind: 'info' },
	{ id: 'block-stone', label: 'Wall', kind: 'cell', field: 'block', value: 0 },
	// Two different things share the crate graphic: block 1 on its own is
	// scenery (the campaign has 114 of those), while a pushable is block 1 plus
	// the PUSHABLE bit AND a table record. Only the second one moves.
	{ id: 'block-push', label: 'Crate', kind: 'cell', field: 'block', value: 1 },
	{ id: 'pushable', label: 'Pushable', kind: 'pushable' },
	{ id: 'pushable-erase', label: 'No pushable', kind: 'pushable-erase' },
	{ id: 'block-tree', label: 'Tree', kind: 'cell', field: 'block', value: 4 },
	{ id: 'block-hydraulic', label: 'Hydraulic', kind: 'cell', field: 'block', value: 7 },
	{ id: 'block-erase', label: 'No block', kind: 'cell', field: 'block', value: null },
	{ id: 'floor-grass', label: 'Floor', kind: 'cell', field: 'floor', value: 0 },
	{ id: 'floor-lift', label: 'Lift floor', kind: 'cell', field: 'floor', value: 2 },
	{ id: 'floor-puddle', label: 'Puddle', kind: 'cell', field: 'floor', value: 3 },
	{ id: 'floor-erase', label: 'No floor', kind: 'cell', field: 'floor', value: null },
	{ id: 'stairs-out', label: 'Stairs N', kind: 'cell', field: 'block', value: 16 },
	{ id: 'stairs-right', label: 'Stairs E', kind: 'cell', field: 'block', value: 17 },
	{ id: 'stairs-left', label: 'Stairs W', kind: 'cell', field: 'block', value: 18 },
	{ id: 'stairs-in', label: 'Stairs S', kind: 'cell', field: 'block', value: 19 },
	{ id: 'block-boost', label: 'Ft Boost', kind: 'cell', field: 'block', value: 2 },
	{ id: 'block-exit', label: 'Exit block', kind: 'cell', field: 'block', value: 3 },
	{ id: 'block-barrier', label: 'Barrier', kind: 'cell', field: 'block', value: 5 },
	{ id: 'block-teleport', label: 'Teleport', kind: 'cell', field: 'block', value: 6 },
	{ id: 'door-front', label: 'Door NS', kind: 'cell', field: 'block', value: 20 },
	{ id: 'door-side', label: 'Door EW', kind: 'cell', field: 'block', value: 21 },
	// Water is a depth, 0-3, not a switch.
	{ id: 'water-1', label: 'Water 1', kind: 'cell', field: 'water', value: 1 },
	{ id: 'water-2', label: 'Water 2', kind: 'cell', field: 'water', value: 2 },
	{ id: 'water', label: 'Water 3', kind: 'cell', field: 'water', value: 3 },
	{ id: 'water-erase', label: 'No water', kind: 'cell', field: 'water', value: null },
	{ id: 'pad', label: 'Pressure pad', kind: 'pad' },
	{ id: 'egg', label: 'Egg', kind: 'egg' },
	{ id: 'corpse', label: 'Body', kind: 'corpse' },
	// A light fixture is not a floor value: it is the puddle floor plus a stone
	// block, the one pair that lets daylight past a floor (derived.js).
	{ id: 'light', label: 'Light', kind: 'light' },
	{ id: 'light-erase', label: 'No light', kind: 'light-erase' },
	{ id: 'panel', label: 'Wall panel', kind: 'panel' },
	{ id: 'trigger', label: 'Message', kind: 'trigger' },
	{ id: 'start-1', label: 'Start 1', kind: 'start', player: 0 },
	{ id: 'start-2', label: 'Start 2', kind: 'start', player: 1 },
	{ id: 'start-3', label: 'Start 3', kind: 'start', player: 2 },
	{ id: 'start-4', label: 'Start 4', kind: 'start', player: 3 },
	{ id: 'exit', label: 'Exit point', kind: 'exit' },
	{ id: 'clear-cell', label: 'Clear cell', kind: 'clear-cell' },
];


/**
 * Wipe every cell of the map, or of one floor.
 *
 * Recorded as a single group so one undo brings it all back -- with 10,580
 * cells a per-cell history would be useless to step through anyway.
 *
 * @returns how many cells actually changed
 */
export function clearCells(doc, history, { floor = null } = {}) {
	const cells = doc.layers.cells;
	const per = MAP_WIDTH * MAP_DEPTH;
	const from = floor === null ? 0 : floor * per;
	const to = floor === null ? cells.length : from + per;
	if (history) beginGroup(history);
	let n = 0;
	for (const layer of ['cells', 'seen', 'items']) {
		const buf = doc.layers[layer];
		if (!buf) continue;
		for (let i = from; i < to; i++) {
			const before = buf[i] >>> 0;
			if (!before) continue;
			if (history) {
				history.entries.push({ layer, index: i, before, after: 0, group: history.group });
				history.at = history.entries.length;
			}
			buf[i] = 0;
			if (layer === 'cells') n++;
		}
	}
	return n;
}

// Cell flags that are a single bit and have no field of their own. `opaque`
// blocks sight without a block, `invisible` hides one that is there, and
// `pushable` marks a block the player can shove.
export const FLAGS = [
	{ key: 'pushable', bit: BITS.pushable, label: 'pushable' },
	{ key: 'invisible', bit: BITS.invisible, label: 'invisible' },
	{ key: 'opaque', bit: BITS.opaque, label: 'opaque' },
];

export function getFlag(word, key) {
	const f = FLAGS.find((x) => x.key === key);
	return f ? (word & f.bit) !== 0 : false;
}

/** Toggle one flag on a cell, through the history. @returns true if changed */
export function setFlag(doc, history, x, y, floor, key, on) {
	const f = FLAGS.find((x) => x.key === key);
	if (!f || !inBounds(x, y, floor)) return false;
	const i = cellIndex(x, y, floor);
	const before = doc.layers.cells[i] >>> 0;
	const after = (on ? (before | f.bit) : (before & ~f.bit)) >>> 0;
	if (before === after) return false;
	history.entries.push({ layer: 'cells', index: i, before, after, group: history.group });
	history.at = history.entries.length;
	doc.layers.cells[i] = after;
	return true;
}
