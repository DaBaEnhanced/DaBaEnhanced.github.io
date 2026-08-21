'use strict';
// Generate the view geometry tables the renderer needs, straight from Tables.s.
//
//   north/east/south/west  67 cell offsets per facing -- which map cell each
//                          view slot samples, as a byte offset from the player
//   block_removal          per slot, 8 occlusion cases of up to 4 slots; if
//                          every slot in a case is opaque, this slot is hidden
//   descan_*               overhead-map update offsets per facing

const fs = require('fs');
const path = require('path');
const { extractTable } = require('./lib/asmdata');

const REPO = path.resolve(__dirname, '..', '..');
const TABLES = path.join(REPO, 'Sources', 'Tables.s');
const OUT = path.resolve(__dirname, '..', 'assets');

const NUM_SLOTS = 67;
const CELL_SIZE = 4;

/** Cell offsets are stored as byte offsets; convert to signed cell indices. */
function toCellOffsets(values, label) {
	if (values.length !== NUM_SLOTS) {
		throw new Error(`${label}: expected ${NUM_SLOTS} entries, got ${values.length}`);
	}
	return values.map((v) => v / CELL_SIZE);
}

const facings = {};
for (const dir of ['north', 'east', 'south', 'west']) {
	const { values, width } = extractTable(TABLES, dir);
	if (width !== 4) throw new Error(`${dir}: expected dc.l, got dc.${width}`);
	facings[dir] = toCellOffsets(values, dir);
	console.log(`${dir.padEnd(6)} ${values.length} slots  range ${Math.min(...facings[dir])}..${Math.max(...facings[dir])}`);
}

// block_removal: 67 slots x 8 cases x 4 slot references (word offsets, /4).
const removal = extractTable(TABLES, 'block_removal');
const expected = NUM_SLOTS * 8 * 4;
if (removal.values.length !== expected) {
	throw new Error(`block_removal: expected ${expected} words, got ${removal.values.length}`);
}
const occlusion = [];
for (let slot = 0; slot < NUM_SLOTS; slot++) {
	const cases = [];
	for (let c = 0; c < 8; c++) {
		const base = slot * 32 + c * 4;
		const refs = [];
		for (let k = 0; k < 4; k++) {
			const v = removal.values[base + k];
			if (v < 0) break;             // -1 terminates the case
			refs.push(v / CELL_SIZE);
		}
		if (refs.length === 0) break;     // an empty case terminates the slot
		cases.push(refs);
	}
	occlusion.push(cases);
}
console.log(`block_removal  ${occlusion.length} slots, ` +
	`${occlusion.reduce((n, c) => n + c.length, 0)} occlusion cases total`);

// view_offsets: 4 longs per slot -- the bob slot index this view slot draws
// into, plus byte offsets into view[]/viewb[] for the rear, side and below
// neighbours (-4 meaning "none"). This is the indirection between the
// depth-major view order and the level-major block-graphic order.
const vo = extractTable(TABLES, 'view_offsets');
if (vo.values.length !== NUM_SLOTS * 4) {
	throw new Error(`view_offsets: expected ${NUM_SLOTS * 4} longs, got ${vo.values.length}`);
}
const slotMap = [];
for (let i = 0; i < NUM_SLOTS; i++) {
	const [bob, rear, side, below] = vo.values.slice(i * 4, i * 4 + 4);
	slotMap.push({
		bob,
		rear: rear < 0 ? -1 : rear / CELL_SIZE,
		side: side < 0 ? -1 : side / CELL_SIZE,
		below: below < 0 ? -1 : below / CELL_SIZE,
	});
}
const bobIndices = slotMap.map((s) => s.bob);
const uniqueBobs = new Set(bobIndices);
if (uniqueBobs.size !== NUM_SLOTS) {
	throw new Error(`view_offsets: bob indices are not a permutation (${uniqueBobs.size} distinct)`);
}
console.log(`view_offsets   ${NUM_SLOTS} slots, bob indices form a complete permutation 0..66`);
{
	// Cross-check the level grouping the .bin files imply: slots whose bob index
	// is 0-20 are one adjacent level, 21-45 the player's own, 46-66 the other.
	const group = (b) => (b <= 20 ? 'above' : b <= 45 ? 'same' : 'below');
	const counts = { above: 0, same: 0, below: 0 };
	for (const b of bobIndices) counts[group(b)]++;
	console.log(`               above=${counts.above} same=${counts.same} below=${counts.below}`);
	if (counts.above !== 21 || counts.same !== 25 || counts.below !== 21) {
		throw new Error('view_offsets: level grouping does not match the .bin slot layout');
	}
}

// rotate_block / rotate_aux (Drawviews.s): directional graphics -- monsters,
// stairs, doors, players -- are re-indexed by the viewer's facing so they show
// the correct side. Tables are [direction][type].
const DRAWVIEWS = path.join(REPO, 'Sources', 'Drawviews.s');
function rotationTable(label, stride) {
	const { values, width } = extractTable(DRAWVIEWS, label);
	if (width !== 1) throw new Error(`${label}: expected dc.b, got dc.${width}`);
	if (values.length !== stride * 4) {
		throw new Error(`${label}: expected ${stride * 4} bytes, got ${values.length}`);
	}
	const out = [];
	for (let d = 0; d < 4; d++) out.push(values.slice(d * stride, (d + 1) * stride));
	// Each direction must be a permutation of its own index space.
	for (let d = 0; d < 4; d++) {
		if (new Set(out[d]).size !== stride) {
			throw new Error(`${label}: direction ${d} is not a permutation`);
		}
	}
	console.log(`${label.padEnd(15)} 4 x ${stride}, all permutations`);
	return out;
}
const blockRotations = rotationTable('block_rotations', 64);
const auxRotations = rotationTable('aux_rotations', 16);

const descan = {};
for (const dir of ['north', 'east', 'south', 'west']) {
	try {
		const { values } = extractTable(TABLES, `descan_${dir}`);
		// `xxxx` is the raw word -1 sentinel. Valid relative cell offsets can
		// also be negative, stored as multiples of four bytes, so only the exact
		// sentinel becomes null.
		descan[dir] = values.map((v) => (v === -1 ? null : v / CELL_SIZE));
	} catch (e) {
		console.warn(`  ! descan_${dir}: ${e.message}`);
	}
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'viewtables.json'), JSON.stringify({
	numSlots: NUM_SLOTS,
	comment: 'Cell offsets are signed cell indices relative to the player cell. ' +
		'Slot order is 21 slots for one adjacent level, 25 for the player level, ' +
		'21 for the other, each far-to-near.',
	facings,
	slotMap,
	blockRotations,
	auxRotations,
	occlusion,
	descan,
}, null, '\t'));
console.log(`\nwrote ${path.relative(REPO, path.join(OUT, 'viewtables.json'))}`);
