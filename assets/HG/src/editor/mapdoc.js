// The editable map document.
//
// A map in this port is four things: a JSON of metadata and structure tables,
// and three binaries -- cells, panels, horizons. The game loads them straight
// from assets/maps/. An edited map is the same four things held in memory and
// written back to storage, so anything the editor produces is loadable by the
// unmodified game path.
//
// Byte-exact .map export is deliberately out of scope (the port is the only
// consumer), but the document still has to round-trip its own format exactly,
// or an edit-save-load cycle quietly loses data. verify-mapdoc.mjs proves that
// across all 47 shipped maps.

export const MAP_WIDTH = 23;
export const MAP_DEPTH = 23;
export const MAP_HEIGHT = 20;
export const CELLS_PER_LAYER = MAP_WIDTH * MAP_DEPTH * MAP_HEIGHT;   // 10580
export const CELL_LAYERS = ['cells', 'seen', 'items'];

/** Every field of the JSON the editor round-trips, in load order. */
const DOC_FIELDS = [
	'key', 'source', 'panels', 'horizon', 'cells', 'locn', 'starts', 'exit',
	'timeLimit', 'water', 'explosions', 'textTriggers', 'textMessages',
	'monsters', 'buttons', 'lifts', 'doors', 'pushables', 'tableOffsets',
	// Additions this port makes, absent on every shipped map: per-egg hatch
	// facing (map_cell2 has no spare bits for it) and the ambient light range.
	'eggDirections', 'ambient',
];

const clone = (v) => (v === undefined ? undefined : structuredClone(v));

/**
 * Wrap a loaded map into an editable document.
 *
 * @param json    the map's .json, as the game loads it
 * @param cellBytes the .cells binary (3 layers of u32)
 * @param panels  the .panels binary, or null
 * @param horizon the .horizon binary, or null
 */
export function createMapDoc(json, cellBytes, panels = null, horizon = null) {
	const doc = { meta: {} };
	for (const f of DOC_FIELDS) if (json[f] !== undefined) doc.meta[f] = clone(json[f]);

	// One Uint32Array per layer, viewing a copy of the source bytes -- the
	// editor writes into these directly.
	const buf = cellBytes instanceof Uint8Array
		? cellBytes.slice().buffer
		: cellBytes.slice(0);
	const words = new Uint32Array(buf);
	doc.layers = {};
	CELL_LAYERS.forEach((name, i) => {
		doc.layers[name] = words.subarray(i * CELLS_PER_LAYER, (i + 1) * CELLS_PER_LAYER);
	});
	doc.cellWords = words;
	doc.panels = panels ? Uint8Array.from(panels) : null;
	doc.horizon = horizon ? Uint8Array.from(horizon) : null;
	return doc;
}

/** Index of (x, y, floor) in a layer. Matches hgmap.js and view.js. */
export function cellIndex(x, y, floor) {
	return floor * (MAP_WIDTH * MAP_DEPTH) + y * MAP_WIDTH + x;
}

/** The inverse of cellIndex. */
export function cellOfIndex(i) {
	const n = i | 0;
	const perFloor = MAP_WIDTH * MAP_DEPTH;
	return {
		x: n % MAP_WIDTH,
		y: Math.floor(n / MAP_WIDTH) % MAP_DEPTH,
		floor: Math.floor(n / perFloor),
	};
}

export function inBounds(x, y, floor) {
	return x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_DEPTH
		&& floor >= 0 && floor < MAP_HEIGHT;
}

/**
 * Serialise back to what the loader reads.
 *
 * `key` renames the map; the file paths in `cells`/`panels`/`horizon` are
 * rewritten to match, since those are how the game finds the binaries.
 */
export function serializeMapDoc(doc, key = doc.meta.key) {
	const meta = {};
	for (const f of DOC_FIELDS) if (doc.meta[f] !== undefined) meta[f] = clone(doc.meta[f]);
	meta.key = key;
	if (meta.cells) meta.cells = { ...meta.cells, file: `maps/${key}.cells` };
	if (meta.panels) meta.panels = { ...meta.panels, file: `maps/${key}.panels` };
	if (meta.horizon) meta.horizon = { ...meta.horizon, file: `maps/${key}.horizon` };
	return {
		json: meta,
		cells: new Uint8Array(doc.cellWords.buffer.slice(0)),
		panels: doc.panels ? Uint8Array.from(doc.panels) : null,
		horizon: doc.horizon ? Uint8Array.from(doc.horizon) : null,
	};
}

/**
 * Problems worth telling the author about. Saving is never blocked -- the
 * original editor does not check any of this either -- so these are warnings,
 * and the caller decides how loudly to say them.
 */
export function validateMapDoc(doc) {
	const out = [];
	const m = doc.meta;
	const starts = m.starts || [];
	if (starts.length !== 4) {
		out.push(`${starts.length} player start${starts.length === 1 ? '' : 's'}, expected 4`);
	}
	starts.forEach((s, i) => {
		if (!inBounds(s.x, s.y, s.floor)) out.push(`start ${i + 1} is outside the map`);
	});
	if (!m.exit || !inBounds(m.exit.x, m.exit.y, m.exit.floor)) {
		out.push('no exit, so the map cannot be completed');
	}
	if (!(m.locn?.style >= 0)) out.push('no block style set');
	for (const t of m.textTriggers || []) {
		if (!m.textMessages?.[t.offset]) {
			out.push(`a text trigger points at message ${t.offset}, which is empty`);
			break;
		}
	}
	return out;
}
