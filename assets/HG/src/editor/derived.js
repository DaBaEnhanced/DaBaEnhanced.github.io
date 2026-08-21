// Data the map stores but nobody authors: it is recomputed from the geometry.
//
// HGedit1.c:411 runs both of these immediately before writing the file:
//
//     make_2d_map();
//     illuminate();
//
// so they are save-time passes, not edit-time ones. That matters, because the
// game READS both -- view.js takes the light bit straight out of the items layer
// rather than deriving it -- so a map edited without them saves with lighting
// and an automap describing the geometry it used to have.

import { MAP_WIDTH, MAP_DEPTH, MAP_HEIGHT, floorIcons } from './blocks2d.js';
import { cellIndex } from './mapdoc.js';

const FLOOR_HERE = 0x1, BLOCK_HERE = 0x2;
const SHIFT = { floor: 9, block: 11 };
const MASK = { floor: 0x3, block: 0x3f };

/** map_cell3.light is the first field of the word, so it is the top bit. */
export const LIGHT_BIT = 31;
/** map_cell2.block_2d is the last field, so it is the low six bits. */
const BLOCK_2D_MASK = 0x3f;

const floorType = (w) => (w >>> SHIFT.floor) & MASK.floor;
const blockType = (w) => (w >>> SHIFT.block) & MASK.block;

/**
 * A light fixture is not a floor value of its own.
 *
 * `floor_names` in HGedit2.c lists "Light" sixth, which would be floor value 4 --
 * unreachable, since the field is two bits. The real fixture is floor type 3
 * (the puddle) with a STONE block in the same cell, and it is that pair which
 * both draws Light.bin (view.js) and lets daylight continue past a floor
 * (illuminate below). Everywhere else a floor stops the light.
 */
export function isLightFixture(word) {
	const w = word >>> 0;
	return (w & FLOOR_HERE) !== 0 && floorType(w) === 3
		&& (w & BLOCK_HERE) !== 0 && blockType(w) === 0;
}

/**
 * Which blocks stop daylight.
 *
 * DELIBERATELY NOT WHAT THE SOURCE IN THIS REPO SAYS. illuminate() as written
 * tests `block==0 || block==1` -- stone and pushable -- but that reproduces only
 * 25 of the 41 shipped maps that carry light data, leaving 2,197 cells wrong.
 * Adding the three field blocks (exit, barrier, teleport) reproduces 36 and
 * leaves 892. An exhaustive sweep of all 256 subsets of blocks 0-7 found no
 * better rule and none that matched every map, so the campaign was not all
 * built by the tool in this repo and the maps are the better authority for what
 * the shipping editor actually did. Boost (block 2) scores identically either
 * way -- no map places one where it would matter -- so it is left out.
 *
 * Revert to `new Set([0, 1])` to follow the source literally instead.
 */
export const LIGHT_BLOCKING = new Set([0, 1, 3, 5, 6]);

/**
 * Port of illuminate() (HGedit3.c:844).
 *
 * One pass per column, walking DOWN from the top. Light starts on, a blocking
 * block switches it off (see LIGHT_BLOCKING), and a floor switches it off too --
 * unless that floor is a light fixture, which switches it back on. The loop runs
 * z from MAP_HEIGHT-2 down to 1, so the top and bottom floors are left alone.
 *
 * @returns how many cells changed
 */
export function illuminate(doc) {
	const cells = doc.layers.cells;
	const items = doc.layers.items;
	let changed = 0;
	for (let y = 0; y < MAP_DEPTH; y++) {
		for (let x = 0; x < MAP_WIDTH; x++) {
			let light = true;
			for (let z = MAP_HEIGHT - 2; z > 0; z--) {
				const i = cellIndex(x, y, z);
				const w = cells[i] >>> 0;

				if ((w & BLOCK_HERE) !== 0 && LIGHT_BLOCKING.has(blockType(w))) light = false;

				const before = items[i] >>> 0;
				const after = (light
					? (before | (1 << LIGHT_BIT))
					: (before & ~(1 << LIGHT_BIT))) >>> 0;
				if (after !== before) { items[i] = after; changed++; }

				if ((w & FLOOR_HERE) !== 0) light = isLightFixture(w);
			}
		}
	}
	return changed;
}

/**
 * Port of the make_2d_map call site: refresh every cell's `block_2d`.
 *
 * This is the GAME's automap index, not the editor's view index -- the editor
 * draws from redraw_level's composite scheme (tileindex.js) and never reads
 * block_2d at all, which is exactly why it can go stale unnoticed.
 *
 * Only the low six bits move; the rest of map_cell2 carries egg_hatch,
 * egg_contents, flowing_bit and the per-player seen flags.
 *
 * @returns how many cells changed
 */
export function rebuild2dMap(doc) {
	const cells = doc.layers.cells;
	const seen = doc.layers.seen;
	let changed = 0;
	for (let z = 0; z < MAP_HEIGHT; z++) {
		const icons = floorIcons(cells, z);
		const base = z * MAP_WIDTH * MAP_DEPTH;
		for (let i = 0; i < icons.length; i++) {
			const at = base + i;
			const before = seen[at] >>> 0;
			const after = ((before & ~BLOCK_2D_MASK) | (icons[i] & BLOCK_2D_MASK)) >>> 0;
			if (after !== before) { seen[at] = after; changed++; }
		}
	}
	return changed;
}

/** Both save-time passes, in the order HGedit1.c runs them. */
export function rebuildDerived(doc) {
	return { blocks2d: rebuild2dMap(doc), lighting: illuminate(doc) };
}
