// Bulk editing, and authoring pushables.
//
// Both are about a thing that is really two things. A pushable is a cell AND a
// table record, and copy/paste moves whole regions of cells that carry records
// with them. The failure mode in every case is the same: the halves come apart,
// leaving a crate the mover halts on or a door that never opens. So most of
// what is checked here is that they stay together -- including when a table is
// full and one of them has to be given up on purpose.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	rectCells, floodCells, surfaceKey, forRegion, copyRegion, pasteRegion,
	describeClip, REGION_LIMIT,
} from '../src/editor/bulk.js';
import {
	addPushable, removePushable, pushableAt, danglingPushables, danglingStructures,
	pushTemplateOf, PUSH_TEMPLATE_MASK, PUSH_BLOCKS, LIMITS, addDoor, addLift,
	cellOfPosn, posnOfCell,
} from '../src/editor/structures.js';
import { createMapDoc, cellIndex, cellOfIndex, MAP_WIDTH, MAP_DEPTH } from '../src/editor/mapdoc.js';
import { createHistory, undo, redo, BITS, getField, TOOLS } from '../src/editor/edit.js';
import { addTrigger, triggerAt, decomposeText, TRIGGER_LIMIT } from '../src/editor/messages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS = path.join(__dirname, '..', 'assets', 'maps');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const load = (key) => createMapDoc(
	JSON.parse(fs.readFileSync(path.join(MAPS, `${key}.json`), 'utf8')),
	new Uint8Array(fs.readFileSync(path.join(MAPS, `${key}.cells`))));
const keys = fs.readdirSync(MAPS).filter((f) => f.endsWith('.cells')).map((f) => f.slice(0, -6));

// --- choosing cells -----------------------------------------------------------
{
	eq(rectCells({ x: 1, y: 1 }, { x: 3, y: 2 }, 6).length, 6, 'a 3x2 rectangle is 6 cells');
	// Dragging backwards describes the same rectangle.
	const fwd = rectCells({ x: 1, y: 1 }, { x: 3, y: 2 }, 6);
	const back = rectCells({ x: 3, y: 2 }, { x: 1, y: 1 }, 6);
	eq(JSON.stringify(fwd), JSON.stringify(back), 'the corners can be given in either order');
	eq(fwd[0].x, 1, 'and it reads top-left first');
	eq(fwd[0].y, 1, 'in both axes');

	// Off-map corners clamp rather than producing cells that cannot be written.
	const clamped = rectCells({ x: -5, y: -5 }, { x: 99, y: 99 }, 6);
	eq(clamped.length, MAP_WIDTH * MAP_DEPTH, 'an oversized drag clamps to the map');
	ok(clamped.every((c) => c.x >= 0 && c.y >= 0 && c.x < MAP_WIDTH && c.y < MAP_DEPTH),
		'and every cell is on it');

	// surfaceKey is what a flood compares. Water and items differ all over a
	// region an author calls one surface, so they must not split it.
	const floorOnly = 0x1;
	eq(surfaceKey(floorOnly), surfaceKey(floorOnly | BITS.waterHere | (3 << 17)),
		'water depth does not break a surface');
	ok(surfaceKey(floorOnly) !== surfaceKey(floorOnly | BITS.blockHere),
		'but a block does');
	eq(surfaceKey(0), 0, 'an empty cell is its own surface');
	ok(surfaceKey(0) !== surfaceKey(floorOnly), 'and is not the same as a floor');
}

{
	const doc = load('01-ArtificialIsland');
	const region = floodCells(doc, 10, 10, 6);
	ok(region.length > 1, `a flood covers more than the seed (${region.length})`);
	ok(region.length <= REGION_LIMIT, 'and never more than a floor');
	const want = surfaceKey(doc.layers.cells[cellIndex(10, 10, 6)]);
	ok(region.every((c) => surfaceKey(doc.layers.cells[cellIndex(c.x, c.y, 6)]) === want),
		'every cell in it matches the seed');
	ok(region.every((c) => c.floor === 6), 'and stays on one floor');
	// Connected, not merely matching: every cell must touch another in the set.
	const set = new Set(region.map((c) => c.y * MAP_WIDTH + c.x));
	const joined = region.every((c) => region.length === 1 ||
		[[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
			set.has((c.y + dy) * MAP_WIDTH + (c.x + dx))));
	ok(joined, 'and the region is connected');
}

// --- one undo step per bulk edit ----------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	const history = createHistory();
	const cells = rectCells({ x: 2, y: 2 }, { x: 6, y: 6 }, 6);
	const before = cells.map((c) => doc.layers.cells[cellIndex(c.x, c.y, 6)] >>> 0);

	const n = forRegion(history, cells, (x, y, floor) => {
		const i = cellIndex(x, y, floor);
		const was = doc.layers.cells[i] >>> 0;
		const now = (was ^ BITS.invisible) >>> 0;
		if (was === now) return false;
		history.entries.push({ layer: 'cells', index: i, before: was, after: now, group: history.group });
		history.at = history.entries.length;
		doc.layers.cells[i] = now;
		return true;
	});
	ok(n > 0, `the region edit changed cells (${n})`);
	eq(new Set(history.entries.map((e) => e.group)).size, 1,
		'every cell it touched shares one history group');
	ok(undo(doc, history), 'one undo is offered');
	const restored = cells.every((c, i) => (doc.layers.cells[cellIndex(c.x, c.y, 6)] >>> 0) === before[i]);
	ok(restored, 'and it takes the whole region back');
}

// --- tools must not open their own groups during a bulk edit -------------------
//
// Several tools group their own edits, which is right for one click and wrong
// inside a fill: a rectangle painted with the Light tool would take one undo
// per cell. paintAt therefore goes through editGroup, which stands down while a
// bulk edit is running. Checked in the source because paintAt is UI code.
{
	const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	const at = main.indexOf('function paintAt(cell) {');
	ok(at > 0, 'paintAt is where it is expected');
	const body = main.slice(at, main.indexOf('\n}\n', at));
	eq((body.match(/beginGroup\(editor\.history\)/g) || []).length, 0,
		'paintAt opens no groups directly');
	ok(/editGroup\(\)/.test(body), 'it goes through editGroup instead');
	ok(/function editGroup\(\)[\s\S]{0,120}bulkDepth/.test(main),
		'and editGroup stands down during a bulk edit');
	for (const fn of ['fillSelection', 'floodSelection', 'clearSelection']) {
		const start = main.indexOf(`function ${fn}(`);
		ok(start > 0 && /asBulk\(/.test(main.slice(start, start + 700)),
			`${fn} runs inside asBulk`);
	}
}

// --- pushables: the record is derived from the cell ----------------------------
//
// Every one of the 477 pushables the campaign ships has a record equal to its
// own cell masked to the fields movePushable carries, and none carries a bit
// outside them. That is the invariant authoring has to reproduce, so it is
// measured on the shipped data first and then required of new ones.
{
	let total = 0, outside = 0, mismatched = 0;
	for (const key of keys) {
		const doc = load(key);
		for (const rec of doc.meta.pushables || []) {
			total++;
			const word = doc.layers.cells[cellOfPosn(rec.posn)] >>> 0;
			if (((rec.cell >>> 0) & ~PUSH_TEMPLATE_MASK) >>> 0) outside++;
			if (pushTemplateOf(word) !== (rec.cell >>> 0)) mismatched++;
		}
	}
	eq(total, 477, `the campaign ships 477 pushables (${total})`);
	eq(outside, 0, 'no shipped record carries a bit outside the mask');
	eq(mismatched, 0, 'and every one equals its own cell, masked');

	let complaints = 0;
	for (const key of keys) complaints += danglingPushables(load(key)).length;
	eq(complaints, 0, 'so no shipped map has a dangling pushable');
}

{
	// A map that ships none, so the counts here are the ones authoring made.
	const doc = load('03-LabTestSite');
	eq((doc.meta.pushables || []).length, 0, '03-LabTestSite ships no pushables');
	const history = createHistory();
	const [x, y, z] = [4, 4, 6];
	eq(pushableAt(doc, x, y, z), null, 'the cell starts without one');

	const rec = addPushable(doc, history, x, y, z, { block: 1, variant: 2 });
	ok(rec, 'a pushable is placed');
	const word = doc.layers.cells[cellIndex(x, y, z)] >>> 0;
	ok(word & BITS.pushable, 'the cell carries the pushable bit');
	ok(word & BITS.opaque, 'and is opaque, as every shipped one is');
	eq(getField(word, 'block'), 1, 'with the block asked for');
	eq(getField(word, 'variant'), 2, 'and the variant');
	eq(rec.cell >>> 0, pushTemplateOf(word), 'and the record matches its cell');
	eq(cellOfPosn(rec.posn), cellIndex(x, y, z), 'and points back at it');
	eq(danglingPushables(doc).length, 0, 'nothing dangles');

	// Changing the look rewrites the record, or the crate changes appearance
	// the first time it is pushed.
	addPushable(doc, history, x, y, z, { block: 0, variant: 7 });
	eq((doc.meta.pushables || []).length, 1, 'a repeat placement replaces rather than stacking');
	const after = doc.layers.cells[cellIndex(x, y, z)] >>> 0;
	eq(pushableAt(doc, x, y, z).rec.cell >>> 0, pushTemplateOf(after),
		'and the record follows the new look');
	eq(danglingPushables(doc).length, 0, 'still nothing dangling');

	ok(removePushable(doc, history, x, y, z), 'it can be removed');
	eq(pushableAt(doc, x, y, z), null, 'and is gone');
	ok(!(doc.layers.cells[cellIndex(x, y, z)] & BITS.pushable), 'the bit goes with it');
	ok(!removePushable(doc, history, x, y, z), 'removing nothing reports nothing');

	// The table is 32 and the editor must refuse the 33rd rather than write a
	// record the game will not read.
	const full = load('03-LabTestSite');
	const h2 = createHistory();
	let placed = 0;
	for (let i = 0; i < LIMITS.pushables; i++) {
		if (addPushable(full, h2, i % MAP_WIDTH, 8 + Math.floor(i / MAP_WIDTH), 6)) placed++;
	}
	eq(placed, LIMITS.pushables, `the table takes ${LIMITS.pushables}`);
	eq(full.meta.pushables.length, LIMITS.pushables, 'and holds exactly that many');
	eq(addPushable(full, h2, 20, 20, 6), null, 'the next is refused');
	ok(!(full.layers.cells[cellIndex(20, 20, 6)] & BITS.pushable),
		'leaving no block behind to dangle');
	eq(danglingPushables(full).length, 0, 'and a full table is still consistent');

	// The two shapes the campaign uses are both offered.
	eq(PUSH_BLOCKS.length, 2, 'two pushable shapes are offered');
	ok(PUSH_BLOCKS.some((b) => b.block === 1) && PUSH_BLOCKS.some((b) => b.block === 0),
		'the crate and the stone, which are the two the campaign uses');
	// And the tool exists, distinct from the plain crate block.
	const ids = TOOLS.map((t) => t.id);
	ok(ids.includes('pushable') && ids.includes('pushable-erase'), 'the tools are in the palette');
	eq(TOOLS.find((t) => t.id === 'block-push').kind, 'cell',
		'while the plain crate block stays a scenery tool');
}

// --- undo takes the records back too ------------------------------------------
//
// The word-level history only sees the cell layers. Placing thirty pushables
// and undoing once used to restore all thirty cells and leave all thirty
// records behind -- thirty dangling pairs from a single click. snapshotTable
// closes that, and the check below is the one that would have caught it.
{
	const doc = load('03-LabTestSite');
	const history = createHistory();
	const cells = rectCells({ x: 3, y: 3 }, { x: 7, y: 5 }, 6);
	eq(cells.length, 15, 'a 5x3 region');

	const placed = forRegion(history, cells, (x, y, floor) =>
		!!addPushable(doc, history, x, y, floor, {}));
	eq(placed, 15, 'every cell took a pushable');
	eq(doc.meta.pushables.length, 15, 'and the table holds them');
	eq(danglingPushables(doc).length, 0, 'consistent to start with');

	ok(undo(doc, history), 'one undo covers the whole fill');
	eq(doc.meta.pushables.length, 0, 'the records went back too');
	eq(cells.filter((c) => doc.layers.cells[cellIndex(c.x, c.y, 6)] & BITS.pushable).length, 0,
		'and so did the cells');
	eq(danglingPushables(doc).length, 0, 'leaving nothing dangling');
	eq(danglingStructures(doc).length, 0, 'by any measure');

	// And redo puts both halves back, still matching each other.
	ok(redo(doc, history), 'redo is offered');
	eq(doc.meta.pushables.length, 15, 'the records come back');
	eq(danglingPushables(doc).length, 0, 'still matched to their cells');

	// A door and a lift are the same story, and were already broken this way.
	const d2 = load('03-LabTestSite');
	const h2 = createHistory();
	const baseDoors = (d2.meta.doors || []).length;
	addDoor(d2, h2, 8, 8, 6, {});
	eq(d2.meta.doors.length, baseDoors + 1, 'a door is added');
	undo(d2, h2);
	eq(d2.meta.doors.length, baseDoors, 'and undo takes the record with the block');
	eq(danglingStructures(d2).length, 0, 'with nothing left dangling');

	const d3 = load('03-LabTestSite');
	const h3 = createHistory();
	const baseLifts = (d3.meta.lifts || []).length;
	addLift(d3, h3, 8, 8, 6, {});
	undo(d3, h3);
	eq(d3.meta.lifts.length, baseLifts, 'the same for a lift');

	// Snapshots are per group, not per edit: a fill of fifteen adds one.
	const d4 = load('03-LabTestSite');
	const h4 = createHistory();
	forRegion(h4, rectCells({ x: 3, y: 3 }, { x: 7, y: 5 }, 6),
		(x, y, floor) => !!addPushable(d4, h4, x, y, floor, {}));
	eq(h4.entries.filter((e) => e.table === 'pushables').length, 1,
		'one table snapshot for the whole group');
}

// --- copy and paste: the words ------------------------------------------------
{
	const doc = load('09-Tomb');
	const clip = copyRegion(doc, { x: 3, y: 3 }, { x: 7, y: 8 }, 6);
	ok(clip, 'a region copies');
	eq(clip.w, 5, 'five wide');
	eq(clip.h, 6, 'six deep');
	ok(describeClip(clip).startsWith('5x6'), 'and describes itself');
	eq(describeClip(null), 'nothing copied', 'an empty clipboard says so');

	const r = pasteRegion(doc, createHistory(), 12, 12, 6, clip);
	eq(r.dropped.length, 0, 'the paste gives nothing up');
	let mismatches = 0;
	for (let dy = 0; dy < clip.h; dy++) {
		for (let dx = 0; dx < clip.w; dx++) {
			const src = doc.layers.cells[cellIndex(3 + dx, 3 + dy, 6)] >>> 0;
			const dst = doc.layers.cells[cellIndex(12 + dx, 12 + dy, 6)] >>> 0;
			if (src !== dst) mismatches++;
		}
	}
	eq(mismatches, 0, 'every word landed where it should');

	// A paste that hangs off the edge clips instead of wrapping into row zero.
	const edge = pasteRegion(doc, createHistory(), MAP_WIDTH - 2, MAP_DEPTH - 2, 6, clip);
	eq(edge.cells <= 4, true, `an overhanging paste only writes what fits (${edge.cells})`);
	const off = pasteRegion(doc, createHistory(), MAP_WIDTH + 5, MAP_DEPTH + 5, 6, clip);
	eq(off.cells, 0, 'and one entirely off the map writes nothing');
	ok(off.dropped.length > 0, 'saying so rather than failing silently');
}

// --- copy and paste: the records ----------------------------------------------
{
	const doc = load('03-LabTestSite');
	const history = createHistory();
	const baseDoors = (doc.meta.doors || []).length;
	const baseLifts = (doc.meta.lifts || []).length;

	// Build a small region carrying one of each thing that keeps a record.
	addPushable(doc, history, 3, 3, 6, { block: 1, variant: 4 });
	addDoor(doc, history, 4, 3, 6, {});
	addLift(doc, history, 5, 3, 6, { minHeight: 4, maxHeight: 6 });
	addTrigger(doc, 3, 4, 6, { body: 'Mind the step', speaker: '6', participants: 0 });
	eq(danglingStructures(doc).length, 0, 'the source region is sound');

	const clip = copyRegion(doc, { x: 3, y: 3 }, { x: 5, y: 4 }, 6);
	eq(clip.pushables.length, 1, 'the pushable is copied');
	eq(clip.doors.length, 1, 'and the door');
	eq(clip.lifts.length, 1, 'and the lift');
	eq(clip.triggers.length, 1, 'and the message');
	eq(clip.triggers[0].body, 'Mind the step', 'with its words');

	const r = pasteRegion(doc, history, 14, 14, 6, clip);
	eq(r.dropped.length, 0, `nothing was given up (${r.dropped[0] || ''})`);
	eq(danglingStructures(doc).length, 0, 'and the paste leaves nothing dangling');

	const pushed = pushableAt(doc, 14, 14, 6);
	ok(pushed, 'the pasted crate has a record of its own');
	eq(pushed.rec.cell >>> 0, pushTemplateOf(doc.layers.cells[cellIndex(14, 14, 6)] >>> 0),
		'matching its new cell');
	ok(doc.meta.doors.some((d) => cellOfPosn(d.posn) === cellIndex(15, 14, 6)),
		'the door record moved to the new cell');
	ok(doc.meta.lifts.some((l) => cellOfPosn(l.posn) === cellIndex(16, 14, 6)),
		'and the lift');
	const t = triggerAt(doc, 14, 15, 6);
	ok(t, 'the message came too');
	eq(decomposeText(t.record.text).body, 'Mind the step', 'with its words intact');
	// And the original is untouched -- this is a copy, not a move.
	ok(pushableAt(doc, 3, 3, 6), 'the original crate is still there');
	ok(triggerAt(doc, 3, 4, 6), 'and the original message');

	// Records are never shared: two crates, two records.
	eq(doc.meta.pushables.filter((p) => p).length, 2, 'there are now two pushable records');
	eq(new Set(doc.meta.pushables.map((p) => p.posn)).size, 2, 'at two different cells');
	eq(doc.meta.doors.length, baseDoors + 2, 'and two door records where there was one');
	eq(doc.meta.lifts.length, baseLifts + 2, 'and two lifts');

	// A lift's travel is in floors, so pasting a level up moves it with it.
	const upDoc = load('03-LabTestSite');
	const h = createHistory();
	addLift(upDoc, h, 5, 5, 6, { minHeight: 4, maxHeight: 6 });
	const liftClip = copyRegion(upDoc, { x: 5, y: 5 }, { x: 5, y: 5 }, 6);
	pasteRegion(upDoc, h, 5, 5, 8, liftClip);
	const moved = upDoc.meta.lifts.find((l) => cellOfPosn(l.posn) === cellIndex(5, 5, 8));
	ok(moved, 'a lift pasted two floors up exists there');
	eq(moved.minHeight, 6, 'and its travel moved with it');
	eq(moved.maxHeight, 8, 'at both ends');
}

// --- what happens when a table is full ----------------------------------------
//
// The only honest answer is to give the record up AND strip the field that
// pointed at it, so what is left is scenery. A pasted crate with no record is
// the one case the original halts on.
{
	const doc = load('01-ArtificialIsland');
	const history = createHistory();
	addPushable(doc, history, 2, 2, 6, {});
	const clip = copyRegion(doc, { x: 2, y: 2 }, { x: 2, y: 2 }, 6);

	// Fill the table, then paste one more.
	while ((doc.meta.pushables || []).length < LIMITS.pushables) {
		const n = doc.meta.pushables.length;
		if (!addPushable(doc, history, n % MAP_WIDTH, 10 + Math.floor(n / MAP_WIDTH), 6)) break;
	}
	eq(doc.meta.pushables.length, LIMITS.pushables, 'the table is full');

	const r = pasteRegion(doc, history, 20, 2, 6, clip);
	ok(r.dropped.some((d) => /pushables/.test(d)), 'the paste reports the record it gave up');
	const word = doc.layers.cells[cellIndex(20, 2, 6)] >>> 0;
	ok(!(word & BITS.pushable), 'and the cell no longer claims to be pushable');
	ok(word & BITS.blockHere, 'while the block itself stays, as scenery');
	eq(danglingPushables(doc).length, 0, 'so nothing dangles');
}

// --- a paste over something replaces it rather than doubling up ---------------
{
	const doc = load('01-ArtificialIsland');
	const history = createHistory();
	addPushable(doc, history, 2, 2, 6, {});
	addPushable(doc, history, 9, 9, 6, {});
	const clip = copyRegion(doc, { x: 2, y: 2 }, { x: 2, y: 2 }, 6);
	pasteRegion(doc, history, 9, 9, 6, clip);
	eq(doc.meta.pushables.filter((p) => cellOfPosn(p.posn) === cellIndex(9, 9, 6)).length, 1,
		'one record on the pasted-over cell, not two');
	eq(danglingStructures(doc).length, 0, 'and nothing dangling');

	// Same for a trigger: a cell holds one message.
	addTrigger(doc, 4, 4, 6, { body: 'first' });
	addTrigger(doc, 5, 5, 6, { body: 'second' });
	const tClip = copyRegion(doc, { x: 4, y: 4 }, { x: 4, y: 4 }, 6);
	pasteRegion(doc, history, 5, 5, 6, tClip);
	eq(doc.meta.textTriggers.filter((t) => (t.cell ?? (t.posn >>> 2)) === cellIndex(5, 5, 6)).length, 1,
		'one trigger on the pasted-over cell');
	eq(decomposeText(triggerAt(doc, 5, 5, 6).record.text).body, 'first',
		'and it is the pasted one');
}

console.log(`bulk editing: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
