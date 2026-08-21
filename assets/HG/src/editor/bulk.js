// Bulk editing: do the same thing to many cells at once.
//
// Three operations, all of which come down to "pick a set of cells, then act on
// each one":
//
//   rectCells    a rectangle between two corners
//   floodCells   the connected run of cells that look like the one clicked
//   copy/paste   lift a block of map out and stamp it down somewhere else
//
// The first two only choose cells -- the caller supplies what to do with each,
// so a bulk edit is exactly the tool the author already picked, applied many
// times, rather than a second set of rules that can drift from the first.
//
// Copy and paste is the one that needs to know more. A cell is not just its
// three words: doors, lifts, pushables and buttons each keep a record in a
// header table that the cell points at, and a message trigger is keyed by the
// cell it fires on. Copying the words alone would produce a door that never
// opens and a crate that halts the original game when pushed. So the records
// inside the region come along, rebased onto their new cells -- and when a
// table has no room left, the offending FIELD is stripped from the pasted cell
// rather than left dangling, and the loss is reported.

import {
	cellIndex, cellOfIndex, inBounds, MAP_WIDTH, MAP_DEPTH, MAP_HEIGHT, CELL_LAYERS,
} from './mapdoc.js';
import { beginGroup, BITS, getField, setField, snapshotTable } from './edit.js';
import {
	LIMITS, cellOfPosn, posnOfCell, reindex, DOOR_BLOCKS, PANEL_IN, PANEL_OUT,
} from './structures.js';
import { addTrigger, triggerAt, removeTrigger, decomposeText } from './messages.js';

/** The most cells any one operation can touch: a whole floor. */
export const REGION_LIMIT = MAP_WIDTH * MAP_DEPTH;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------------------
// Choosing cells.

/**
 * Every cell in the rectangle between two corners, in reading order.
 *
 * The corners are given in either order -- a drag that goes up and to the left
 * describes the same rectangle as one that goes down and to the right.
 */
export function rectCells(a, b, floor) {
	const x0 = clamp(Math.min(a.x, b.x), 0, MAP_WIDTH - 1);
	const x1 = clamp(Math.max(a.x, b.x), 0, MAP_WIDTH - 1);
	const y0 = clamp(Math.min(a.y, b.y), 0, MAP_DEPTH - 1);
	const y1 = clamp(Math.max(a.y, b.y), 0, MAP_DEPTH - 1);
	const out = [];
	for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y, floor });
	return out;
}

/**
 * What makes two cells "the same" for a flood fill: the block and the floor,
 * presence bits included.
 *
 * Not the whole word -- water depth, items and seen bits differ all over a
 * region an author thinks of as one surface, and a fill that stopped at every
 * one of them would never cover anything.
 */
export function surfaceKey(word) {
	const w = word >>> 0;
	const floor = (w & BITS.floorHere) ? getField(w, 'floor') + 1 : 0;
	const block = (w & BITS.blockHere) ? getField(w, 'block') + 1 : 0;
	return floor | (block << 8);
}

/**
 * The connected run of cells matching the one clicked, four-connected and
 * confined to one floor.
 *
 * Capped at a whole floor, which is also the most it could ever reach.
 */
export function floodCells(doc, x, y, floor) {
	if (!inBounds(x, y, floor)) return [];
	const cells = doc.layers.cells;
	const want = surfaceKey(cells[cellIndex(x, y, floor)]);
	const seen = new Set();
	const out = [];
	const stack = [[x, y]];
	while (stack.length && out.length < REGION_LIMIT) {
		const [cx, cy] = stack.pop();
		if (cx < 0 || cy < 0 || cx >= MAP_WIDTH || cy >= MAP_DEPTH) continue;
		const key = cy * MAP_WIDTH + cx;
		if (seen.has(key)) continue;
		seen.add(key);
		if (surfaceKey(cells[cellIndex(cx, cy, floor)]) !== want) continue;
		out.push({ x: cx, y: cy, floor });
		stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
	}
	return out;
}

/**
 * Run one edit over a set of cells as a single undo step.
 *
 * `fn` is whatever the caller does to one cell; anything truthy it returns
 * counts as a change. Grouping matters here: 529 separate history entries would
 * be unusable to step back through.
 *
 * @returns how many cells the edit reported changing
 */
export function forRegion(history, cells, fn) {
	if (history) beginGroup(history);
	let n = 0;
	for (const c of cells) if (fn(c.x, c.y, c.floor)) n++;
	return n;
}

// ---------------------------------------------------------------------------
// Copy and paste.

/** Records keyed by a cell offset, and how the cell points at each. */
const POSN_TABLES = ['doors', 'lifts', 'pushables'];

/**
 * Lift a region out of the map.
 *
 * The clipboard holds the three cell layers plus every header record that lives
 * inside the region, each remembered by its offset from the top-left corner so
 * it can be put back down anywhere.
 */
export function copyRegion(doc, a, b, floor) {
	const cells = rectCells(a, b, floor);
	if (!cells.length) return null;
	const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
	const w = Math.abs(a.x - b.x) + 1, h = Math.abs(a.y - b.y) + 1;

	const clip = {
		w, h, floor,
		words: {},
		doors: [], lifts: [], pushables: [], buttons: [], triggers: [],
	};
	for (const layer of CELL_LAYERS) {
		const buf = doc.layers[layer];
		const out = new Uint32Array(w * h);
		for (let i = 0; i < cells.length; i++) {
			out[i] = buf ? buf[cellIndex(cells[i].x, cells[i].y, floor)] >>> 0 : 0;
		}
		clip.words[layer] = out;
	}

	const inside = new Map();       // cell index -> offset within the region
	cells.forEach((c, i) => inside.set(cellIndex(c.x, c.y, floor), i));

	for (const table of POSN_TABLES) {
		for (const rec of doc.meta[table] || []) {
			const at = inside.get(cellOfPosn(rec.posn));
			if (at === undefined) continue;
			clip[table].push({ dx: at % w, dy: Math.floor(at / w), rec: { ...rec } });
		}
	}
	// A button is found from its cell's `variant`, not from a posn, so the cells
	// have to be searched for it rather than the table.
	for (const [cell, at] of inside) {
		const word = doc.layers.cells[cell] >>> 0;
		if (!(word & BITS.panelHere)) continue;
		const kind = getField(word, 'panel');
		if (kind !== PANEL_IN && kind !== PANEL_OUT) continue;
		const rec = (doc.meta.buttons || []).find((r) => r && r.index === getField(word, 'variant'));
		if (!rec) continue;
		clip.buttons.push({ dx: at % w, dy: Math.floor(at / w), rec: { ...rec } });
	}
	for (const c of cells) {
		const found = triggerAt(doc, c.x, c.y, floor);
		if (!found?.record) continue;
		const at = inside.get(found.cell);
		clip.triggers.push({
			dx: at % w, dy: Math.floor(at / w),
			body: decomposeText(found.record.text).body,
			speaker: found.record.speaker,
			participants: found.record.participants | 0,
		});
	}
	return clip;
}

/** A free slot in a table that keeps holes, like buttons. */
function freeSlot(list, limit) {
	for (let i = 0; i < limit; i++) if (!(list || []).some((r) => r && r.index === i)) return i;
	return -1;
}

/**
 * Stamp a clipboard down with its top-left corner at (x, y, floor).
 *
 * Cells that would land off the map are skipped rather than wrapped. Existing
 * records on the cells being overwritten go first, so a paste never doubles up
 * two doors on one cell.
 *
 * @returns {cells, dropped} -- dropped names each record a full table refused
 */
export function pasteRegion(doc, history, x, y, floor, clip) {
	if (!clip) return { cells: 0, dropped: [] };
	if (history) beginGroup(history);
	// A paste rewrites cells and header tables together, and undo has to take
	// both back or it leaves records pointing at cells that no longer match.
	for (const t of [...POSN_TABLES, 'buttons', 'textTriggers', 'textMessages']) {
		snapshotTable(history, doc, t);
	}
	const dropped = [];

	// Where each source offset lands, and which of them are actually on the map.
	const landing = new Map();
	for (let dy = 0; dy < clip.h; dy++) {
		for (let dx = 0; dx < clip.w; dx++) {
			const tx = x + dx, ty = y + dy;
			if (!inBounds(tx, ty, floor)) continue;
			landing.set(dy * clip.w + dx, { x: tx, y: ty, cell: cellIndex(tx, ty, floor) });
		}
	}
	if (!landing.size) return { cells: 0, dropped: ['the paste lands entirely off the map'] };

	// Clear what is already here, records first -- they read the cell to find
	// themselves, so removing them after the words were overwritten would miss.
	for (const { x: tx, y: ty, cell } of landing.values()) {
		for (const table of POSN_TABLES) {
			const list = doc.meta[table];
			if (!list) continue;
			for (let i = list.length - 1; i >= 0; i--) {
				if (cellOfPosn(list[i].posn) === cell) list.splice(i, 1);
			}
		}
		const word = doc.layers.cells[cell] >>> 0;
		if (word & BITS.panelHere) {
			const kind = getField(word, 'panel');
			if (kind === PANEL_IN || kind === PANEL_OUT) {
				const b = (doc.meta.buttons || []).find((r) => r && r.index === getField(word, 'variant'));
				if (b) b.used = 0;
			}
		}
		removeTrigger(doc, tx, ty, floor);
	}

	// The words.
	let changed = 0;
	for (const [at, place] of landing) {
		for (const layer of CELL_LAYERS) {
			const buf = doc.layers[layer];
			if (!buf) continue;
			const before = buf[place.cell] >>> 0;
			const after = clip.words[layer][at] >>> 0;
			if (before === after) continue;
			if (history) {
				history.entries.length = Math.min(history.entries.length, history.at);
				history.entries.push({ layer, index: place.cell, before, after, group: history.group });
				history.at = history.entries.length;
			}
			buf[place.cell] = after;
			if (layer === 'cells') changed++;
		}
	}

	// The records. Each one is refused the same way: strip the field on the cell
	// that would have pointed at it, so what is left is scenery rather than a
	// dangling reference.
	const strip = (cell, field, bit) => {
		let w = doc.layers.cells[cell] >>> 0;
		w = field ? setField(w, field, null) : w;
		if (bit) w = (w & ~bit) >>> 0;
		doc.layers.cells[cell] = w >>> 0;
	};
	const floorDelta = floor - (clip.floor | 0);

	for (const table of POSN_TABLES) {
		for (const { dx, dy, rec } of clip[table]) {
			const place = landing.get(dy * clip.w + dx);
			if (!place) continue;
			const list = doc.meta[table] || (doc.meta[table] = []);
			if (list.length >= LIMITS[table]) {
				dropped.push(`${table} table is full -- ${rec.index} was not copied`);
				if (table === 'doors') strip(place.cell, 'block', 0);
				if (table === 'lifts') strip(place.cell, 'floor', 0);
				if (table === 'pushables') strip(place.cell, null, BITS.pushable);
				continue;
			}
			const copy = { ...rec, index: list.length, posn: posnOfCell(place.cell) };
			// A lift's travel is measured in floors, so it moves with the paste.
			if (table === 'lifts') {
				copy.height = clamp((rec.height | 0) + floorDelta, 0, MAP_HEIGHT - 1);
				copy.minHeight = clamp((rec.minHeight | 0) + floorDelta, 0, MAP_HEIGHT - 1);
				copy.maxHeight = clamp((rec.maxHeight | 0) + floorDelta, 0, MAP_HEIGHT - 1);
			}
			list.push(copy);
		}
	}

	// Buttons get a record of their own rather than sharing the original's --
	// two cells pointing at one record would press as a single button.
	for (const { dx, dy, rec } of clip.buttons) {
		const place = landing.get(dy * clip.w + dx);
		if (!place) continue;
		const buttons = doc.meta.buttons || (doc.meta.buttons = []);
		const slot = freeSlot(buttons, LIMITS.buttons);
		if (slot < 0) {
			dropped.push(`button table is full -- button ${rec.index} was not copied`);
			strip(place.cell, 'panel', 0);
			continue;
		}
		buttons.push({ ...rec, index: slot });
		doc.layers.cells[place.cell] =
			setField(doc.layers.cells[place.cell] >>> 0, 'variant', slot) >>> 0;
	}

	for (const t of clip.triggers) {
		const place = landing.get(t.dy * clip.w + t.dx);
		if (!place) continue;
		const made = addTrigger(doc, place.x, place.y, floor, {
			body: t.body, speaker: t.speaker, participants: t.participants,
		});
		if (!made) dropped.push('the trigger table is full -- a message was not copied');
	}

	reindex(doc);
	return { cells: changed, dropped };
}

/** A one-line summary of what a clipboard holds, for the status line. */
export function describeClip(clip) {
	if (!clip) return 'nothing copied';
	const parts = [`${clip.w}x${clip.h}`];
	for (const t of [...POSN_TABLES, 'buttons', 'triggers']) {
		if (clip[t]?.length) parts.push(`${clip[t].length} ${t}`);
	}
	return parts.join(', ');
}

export { DOOR_BLOCKS };
