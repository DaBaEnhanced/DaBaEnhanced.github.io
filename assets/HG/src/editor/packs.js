// The shared panel and horizon library.
//
// A map does not author panel art; it holds 36 slots of it, and a cell points
// at one of those slots through its `variant` field. Almost every design is
// shared -- 181 distinct panels behind 1,297 filled slots -- so the editor works
// the way the originals evidently did: pick from a library, and materialise the
// chosen entry into the map's own slots on assignment.
//
// That indirection is also what makes custom packs cheap later: a different
// source for the same pick-then-materialise step.

import { cellIndex, inBounds } from './mapdoc.js';
import { setField } from './edit.js';

/** How many panel slots a map carries, and how many a cell can name. */
export const PANEL_SLOTS = 36;
// `variant` is 5 bits, so a cell can only point at slots 0-31 of the 36.
export const PANEL_SLOTS_ADDRESSABLE = 32;
export const HORIZON_FACINGS = 4;

export async function loadPack(name, assetsBase = 'assets/') {
	const meta = await (await fetch(`${assetsBase}${name}.json`)).json();
	const bytes = new Uint8Array(await (await fetch(`${assetsBase}${meta.file}`)).arrayBuffer());
	return { meta, bytes };
}

/** The raw planar bytes of one library entry. */
export function entryBytes(pack, index) {
	const n = pack.meta.entryBytes;
	if (index < 0 || index >= pack.meta.count) return null;
	return pack.bytes.subarray(index * n, (index + 1) * n);
}

/**
 * One entry -> one byte per pixel.
 *
 * The two libraries are not stored the same way, because the two assets are
 * not: panel art leaves the build pipeline already chunky (compositor.applyPanel
 * ORs it straight into planes 0-1), while horizons are still planar. The pack
 * metadata says which, and guessing is how you get noise.
 */
export function decodeEntry(pack, index) {
	const src = entryBytes(pack, index);
	if (!src) return null;
	const { width: w, height: h, planes } = pack.meta;
	if (pack.meta.format === 'chunky') {
		return { width: w, height: h, pixels: Uint8Array.from(src) };
	}
	const rowBytes = w / 8;
	const px = new Uint8Array(w * h);
	for (let p = 0; p < planes; p++) {
		const base = p * rowBytes * h;
		for (let y = 0; y < h; y++) {
			for (let b = 0; b < rowBytes; b++) {
				const byte = src[base + y * rowBytes + b];
				if (!byte) continue;
				for (let bit = 0; bit < 8; bit++) {
					if (byte & (0x80 >> bit)) px[y * w + b * 8 + bit] |= 1 << p;
				}
			}
		}
	}
	return { width: w, height: h, pixels: px };
}

/**
 * Copy a library panel into one of the map's 36 slots.
 * @returns true if the slot changed
 */
export function assignPanel(doc, slot, pack, index) {
	if (!doc.panels || slot < 0 || slot >= PANEL_SLOTS) return false;
	const src = entryBytes(pack, index);
	if (!src) return false;
	const n = pack.meta.entryBytes;
	const at = slot * n;
	if (at + n > doc.panels.length) return false;
	let changed = false;
	for (let i = 0; i < n; i++) {
		if (doc.panels[at + i] !== src[i]) { doc.panels[at + i] = src[i]; changed = true; }
	}
	return changed;
}

/** Copy a library horizon over one of the four facings. */
export function assignHorizon(doc, facing, pack, index) {
	if (!doc.horizon || facing < 0 || facing >= HORIZON_FACINGS) return false;
	const src = entryBytes(pack, index);
	if (!src) return false;
	const n = pack.meta.entryBytes;
	const at = facing * n;
	if (at + n > doc.horizon.length) return false;
	let changed = false;
	for (let i = 0; i < n; i++) {
		if (doc.horizon[at + i] !== src[i]) { doc.horizon[at + i] = src[i]; changed = true; }
	}
	return changed;
}

/**
 * Point a cell at a panel slot. The cell needs the panel presence bit, a frame
 * graphic in `panel`, and the slot number in `variant` -- which is what
 * buildDrawList reads at PANEL_SLOT to choose the text.
 */
export function setCellPanel(doc, history, x, y, floor, slot, frame = 0) {
	if (!inBounds(x, y, floor) || slot < 0 || slot >= PANEL_SLOTS_ADDRESSABLE) return false;
	const cells = doc.layers.cells;
	const i = cellIndex(x, y, floor);
	const before = cells[i] >>> 0;
	let w = setField(before, 'panel', frame);
	w = setField(w, 'variant', slot);
	if (w === before) return false;
	if (history) {
		history.entries.push({ layer: 'cells', index: i, before, after: w, group: history.group });
		history.at = history.entries.length;
	}
	cells[i] = w;
	return true;
}

/** Which library entry, if any, a map slot currently holds. */
export function panelSlotSource(doc, slot, pack) {
	if (!doc.panels) return -1;
	const n = pack.meta.entryBytes;
	const at = slot * n;
	if (at + n > doc.panels.length) return -1;
	outer:
	for (let e = 0; e < pack.meta.count; e++) {
		const src = entryBytes(pack, e);
		for (let i = 0; i < n; i++) if (doc.panels[at + i] !== src[i]) continue outer;
		return e;
	}
	return -1;
}
