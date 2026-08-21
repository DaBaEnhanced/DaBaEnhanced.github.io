// The top-down icon for a cell -- a port of make_2d_map (HGedit3.c:706).
//
// The editor's map view does not draw the 3D blocks; it draws a 16x16 icon per
// cell, picked by looking at the cell and six of its neighbours. `block_2d` in
// map_cell2 caches the result, but it is derived data -- the original recomputes
// the whole map after any edit, and so does this.
//
// Neighbour access follows the original's addressing exactly. mp1() is raw
// pointer arithmetic with no bounds check, so at x=0 the "x-1" neighbour is the
// previous cell in linear order -- the last cell of the row above -- and at the
// very edges it lands in the struct's zeroed saftey_net guards. Clamping to the
// row instead would pick different icons along every left edge, so the linear
// index is reproduced and anything outside the map reads as an empty cell.

export const MAP_WIDTH = 23;
export const MAP_DEPTH = 23;
export const MAP_HEIGHT = 20;
const LEVEL = MAP_WIDTH * MAP_DEPTH;
const TOTAL = LEVEL * MAP_HEIGHT;

// map_cell1, from HGmapstructure.h.
const FLOOR_HERE = 0x00000001;
const BLOCK_HERE = 0x00000002;
const AUX_HERE = 0x00000020;
const PUSHABLE = 0x00000100;
const FLOOR_SHIFT = 9, FLOOR_MASK = 0x3;
const BLOCK_SHIFT = 11, BLOCK_MASK = 0x3f;
const AUX_SHIFT = 28, AUX_MASK = 0xf;

const floorHere = (c) => (c & FLOOR_HERE) !== 0;
const blockHere = (c) => (c & BLOCK_HERE) !== 0;
const auxHere = (c) => (c & AUX_HERE) !== 0;
const pushable = (c) => (c & PUSHABLE) !== 0;
const floorType = (c) => (c >>> FLOOR_SHIFT) & FLOOR_MASK;
const blockType = (c) => (c >>> BLOCK_SHIFT) & BLOCK_MASK;
const auxType = (c) => (c >>> AUX_SHIFT) & AUX_MASK;

/**
 * The block types the original treats as "wall-like" when deciding whether a
 * neighbour should join up with this cell. 0 is plain wall; 2, 3, 5 and 6 are
 * its decorated variants.
 */
const WALLISH = new Set([0, 2, 3, 5, 6]);
const joins = (c) => blockHere(c) && !pushable(c) && WALLISH.has(blockType(c));

/**
 * Deterministic stand-in for the original's `rand()/(RAND_MAX/3)`, which picks
 * one of three floor and ceiling variants. Seeding from the cell coordinates
 * keeps the map from shimmering every time it is redrawn.
 */
function variantOf(x, y, z) {
	let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
	h = (h ^ (h >>> 13)) >>> 0;
	return (h * 2654435761) % 3;
}

/** Icon for one cell. `cells` is the map_part1 layer. */
export function blockIcon(cells, x, y, z) {
	// Linear addressing, exactly as mp1 computes it.
	const at = (dx, dy, dz) => {
		const i = (z + dz) * LEVEL + (y + dy) * MAP_WIDTH + (x + dx);
		return i >= 0 && i < TOTAL ? cells[i] >>> 0 : 0;
	};
	const c1 = at(-1, -1, 0);   // up-left
	const c2 = at(0, -1, 0);    // up
	const c3 = at(-1, 0, 0);    // left
	const c4 = at(0, 0, 0);     // this cell
	const c5 = at(1, 0, 0);     // right
	const c6 = at(0, 1, 0);     // down
	const c7 = at(0, 0, -1);    // the cell below, i.e. what forms this ceiling

	const myrand = variantOf(x, y, z);
	let n = 0;

	// A ceiling: the cell below holds a plain block.
	if (blockHere(c7) && blockType(c7) === 0) {
		n = 9;
		if (myrand === 1) n = 2;
		if (myrand >= 2) n = 16;
		if (joins(c1)) n = 18;
		if (joins(c2)) n = 17;
		if (joins(c3)) n = 10;
		if (joins(c3) && joins(c1)) n = 8;
		if (joins(c1) && joins(c2)) n = 1;
		if (joins(c3) && joins(c2)) n = 22;
		if (blockHere(c4) && blockType(c4) === 4) n = 35;
	}
	// A floor.
	if (floorHere(c4) && floorType(c4) === 0) {
		n = 6;
		if (myrand === 1) n = 26;
		if (myrand >= 2) n = 33;
		if (joins(c1)) n = 14;
		if (joins(c2)) n = 7;
		if (joins(c3)) n = 34;
		if (joins(c3) && joins(c1)) n = 32;
		if (joins(c1) && joins(c2)) n = 25;
		if (joins(c3) && joins(c2)) n = 24;
		if (blockHere(c4) && blockType(c4) === 4) {
			n = 36;
			if (joins(c3)) n = 60;
			if (joins(c2)) n = 61;
			if (joins(c2) && joins(c3)) n = 62;
		}
	}
	// A wall in this cell: pick the piece by which sides are open.
	if (blockHere(c4) && blockType(c4) === 0) {
		// "open" means no neighbouring block, or a block that is not plain wall.
		const open = (c, above = 0) => !blockHere(c) || blockType(c) > above;
		n = 12;
		if (open(c2)) n = 4;
		if (open(c3)) n = 11;
		if (open(c5)) n = 13;
		if (open(c6)) n = 20;
		if (open(c2) && open(c3, 1)) n = 3;
		if (open(c6) && open(c3, 1)) n = 19;
		if (open(c6) && open(c5, 1)) n = 21;
		if (open(c2) && open(c5, 1)) n = 5;
		if (open(c3) && open(c5, 1)) n = 27;
		if (open(c2) && open(c6, 1)) n = 28;
		if (open(c2) && open(c3, 1) && open(c5)) n = 37;
		if (open(c2) && open(c3, 1) && open(c6)) n = 29;
		if (open(c5) && open(c3, 1) && open(c6)) n = 38;
		if (open(c5) && open(c2, 1) && open(c6)) n = 30;
		if (open(c3) && open(c5, 1) && open(c2) && open(c6)) n = 23;
	}

	// Stairs, 16-19, one per facing. The paired icon marks the step aux.
	const stepAux = (c) => auxHere(c) && auxType(c) > 7 && auxType(c) < 12;
	if (blockHere(c4) && blockType(c4) === 16) n = stepAux(c6) ? 41 : 40;
	if (blockHere(c4) && blockType(c4) === 17) n = stepAux(c3) ? 45 : 44;
	if (blockHere(c4) && blockType(c4) === 18) n = stepAux(c2) ? 53 : 52;
	if (blockHere(c4) && blockType(c4) === 19) n = stepAux(c5) ? 49 : 48;

	// Step auxiliaries standing on their own, 8-11, one per facing. The second
	// icon of each pair is used when the cell below is a plain block.
	const onBlock = blockHere(c7) && blockType(c7) === 0;
	if (auxHere(c4) && auxType(c4) === 8) n = onBlock ? 43 : 42;
	if (auxHere(c4) && auxType(c4) === 9) n = onBlock ? 47 : 46;
	if (auxHere(c4) && auxType(c4) === 10) n = onBlock ? 55 : 54;
	if (auxHere(c4) && auxType(c4) === 11) n = onBlock ? 51 : 50;

	if (auxHere(c4) && auxType(c4) === 13) n = 57;
	if (auxHere(c4) && auxType(c4) === 12) n = 59;
	if (blockHere(c4) && (blockType(c4) === 21 || blockType(c4) === 23)) n = 56;
	if (blockHere(c4) && (blockType(c4) === 20 || blockType(c4) === 22)) n = 58;

	// Stairs one level down show through the floor above them.
	if (blockHere(c7) && blockType(c7) === 16) n = 40;
	if (blockHere(c7) && blockType(c7) === 17) n = 44;
	if (blockHere(c7) && blockType(c7) === 18) n = 52;
	if (blockHere(c7) && blockType(c7) === 19) n = 48;

	// ...and so do step auxiliaries, but only into a cell with nothing of its own.
	if (n === 0 && auxHere(c7) && auxType(c7) === 8) n = 42;
	if (n === 0 && auxHere(c7) && auxType(c7) === 9) n = 46;
	if (n === 0 && auxHere(c7) && auxType(c7) === 10) n = 54;
	if (n === 0 && auxHere(c7) && auxType(c7) === 11) n = 50;

	// A decorated wall variant overrides everything above.
	if (blockHere(c4) && WALLISH.has(blockType(c4)) && blockType(c4) !== 0) n = 39;

	return n;
}

/** Icons for one whole floor, row-major, 23x23. */
export function floorIcons(cells, z, out = new Uint8Array(LEVEL)) {
	for (let y = 0; y < MAP_DEPTH; y++) {
		for (let x = 0; x < MAP_WIDTH; x++) {
			out[y * MAP_WIDTH + x] = blockIcon(cells, x, y, z);
		}
	}
	return out;
}
