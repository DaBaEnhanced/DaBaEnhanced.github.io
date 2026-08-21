// Which icon the editor's map view draws for a cell.
//
// This is redraw_level (HGedit3.c:582-600), not make_2d_map. The editor does
// not derive an icon from a cell and its neighbours the way the game's automap
// does; it looks up a pre-drawn icon for the cell's exact contents:
//
//	block_num  = 0
//	if floor_here  block_num += (floor + 1) * 33
//	if block_here  block_num += block + 1
//	if aux_here    block_num += 660
//	if panel_here  block_num += 165
//	if flowing     block_num += 330
//
// which is a 33-wide row per combination of the four flags and the floor:
//
//	33 * (floorState + 5*panel + 10*flowing + 20*aux) + blockState
//
// floor is 2 bits so floorState is 0-4 (none, Grass, Button, Lift, Puddle) and
// block_names stops at 32, so blockState is 0-32. 5 * 8 * 33 = 1320 icons, and
// Blocks.dat holds 1333 -- the remainder being the three specials below.
//
// The upshot for the map view is that panel, water and aux contribute a flat
// offset: the icon says one is present, never which. That is why a cell with a
// text panel and a cell with a button draw the same, and why the marker overlay
// still earns its place.

import { getField, hasField } from './edit.js';

export const TILE_STRIDE = 33;      // block states per row
export const FLOOR_STATES = 5;      // none + 4 floor types
// map_cell2 packs MSB-first, so flowing_bit sits below egg_hatch:12 and
// egg_contents:8 -- the same bit worldfx.js reads.
export const FLOWING_BIT = 11;

/** Cell is empty but the cell below is stone, so this is a ceiling. */
export const TILE_UNDER_STONE = 1325;
/** Opaque with no block: an invisible wall. */
export const TILE_OPAQUE = 1324;
/** Highlight for the target of the button being edited. */
export const TILE_BUTTON_TARGET = 1328;

/**
 * @param cells    the map_part1 layer
 * @param flowing  true if map_part2's flowing_bit is set for this cell
 * @param below    the cell one floor down, or 0 at the bottom
 */
export function tileFor(word, flowing = false, below = 0) {
	const w = word >>> 0;
	let n = 0;
	if (hasField(w, 'floor')) n += (getField(w, 'floor') + 1) * TILE_STRIDE;
	if (hasField(w, 'block')) n += getField(w, 'block') + 1;
	if (hasField(w, 'aux')) n += 660;
	if (hasField(w, 'panel')) n += 165;
	if (flowing) n += 330;

	// Both of these replace the index outright rather than adding to it.
	const under = below >>> 0;
	if (n === 0 && (under & 0x2) !== 0 && getField(under, 'block') === 0) {
		n = TILE_UNDER_STONE;
	}
	if ((w & 0x40) !== 0 && (w & 0x2) === 0) n = TILE_OPAQUE;   // opaque, no block
	return n;
}

/** Every icon for one floor of a map, in row-major order. */
export function floorTiles(cells, layer2, floor, width, depth) {
	const out = new Uint16Array(width * depth);
	const base = floor * width * depth;
	const under = (floor - 1) * width * depth;
	for (let i = 0; i < out.length; i++) {
		const flowing = layer2 ? ((layer2[base + i] >>> FLOWING_BIT) & 1) !== 0 : false;
		out[i] = tileFor(cells[base + i], flowing, floor > 0 ? cells[under + i] : 0);
	}
	return out;
}

/**
 * What an icon index means, for the legend. Returns the pieces rather than a
 * sentence so the caller can lay them out.
 */
export function describeTile(n) {
	if (n === TILE_UNDER_STONE) return { special: 'Empty, with stone overhead' };
	if (n === TILE_OPAQUE) return { special: 'Opaque, no block (invisible wall)' };
	if (n === TILE_BUTTON_TARGET) return { special: 'Target of the picked button' };
	if (n < 0 || n >= FLOOR_STATES * 8 * TILE_STRIDE) return null;
	const blockState = n % TILE_STRIDE;
	const group = Math.floor(n / TILE_STRIDE);
	return {
		floorState: group % FLOOR_STATES,
		panel: Math.floor(group / FLOOR_STATES) % 2 === 1,
		flowing: Math.floor(group / (FLOOR_STATES * 2)) % 2 === 1,
		aux: Math.floor(group / (FLOOR_STATES * 4)) % 2 === 1,
		blockState,
	};
}
