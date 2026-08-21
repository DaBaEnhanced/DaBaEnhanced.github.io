// The opt-in "tall objects two floors down" deviation.
//
// Two things have to hold at once: it must change nothing when off (parity is
// checked separately, but the flag is the gate), and it must actually draw
// something when on -- an opt-in that does nothing is worse than no flag.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildDrawList, cellIndex, LEVEL_CELLS, MAP_WIDTH } from '../src/view.js';
import { setField } from '../src/editor/edit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(__dirname, '..', 'assets');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${a}, want ${b})`);

const J = (f) => JSON.parse(fs.readFileSync(path.join(A, f), 'utf8'));
const tables = J('viewtables.json');
const style = J('style0.json');
const atlasBytes = new Uint8Array(fs.readFileSync(path.join(A, style.atlas.file)));
style.atlas = { ...style.atlas };
const TREE = 4, STONE = 0;

function blank() {
	return {
		cells: new Uint32Array(LEVEL_CELLS * 20),
		items: new Uint32Array(LEVEL_CELLS * 20),
	};
}
const draw = (w, x, y, floor, tall) => buildDrawList({
	cells: w.cells, items: w.items, x, y, floor, direction: 0,
	tables, style, panels: { count: 36 }, tallObjects: tall,
});

// A tree straight ahead, two floors below the viewer, with clear air between.
{
	const w = blank();
	const [vx, vy, vz] = [11, 11, 10];
	const put = (x, y, z, block) => {
		w.cells[cellIndex(x, y, z)] = setField(0, 'block', block) >>> 0;
	};
	put(vx, vy - 2, vz - 2, TREE);

	const off = draw(w, vx, vy, vz, false);
	const on = draw(w, vx, vy, vz, true);
	ok(on.length > off.length, `the flag adds draws (${off.length} -> ${on.length})`);
	ok(on.some((r) => r.tall), 'and they are tagged as tall');
	ok(!off.some((r) => r.tall), 'nothing is tagged when the flag is off');

	// The extra art is the same rect, one floor step lower.
	const tallRect = on.find((r) => r.tall);
	const bob = tables.slotMap.findIndex((s) => s);
	ok(tallRect.ax !== undefined, 'the tall rect names real atlas pixels');
	ok(tallRect.y > 0, 'and is pushed down the screen, not up');
}

// A floor in between hides it: you cannot see through a floor.
{
	const w = blank();
	const [vx, vy, vz] = [11, 11, 10];
	w.cells[cellIndex(vx, vy - 2, vz - 2)] = setField(0, 'block', TREE) >>> 0;
	const visible = draw(w, vx, vy, vz, true).filter((r) => r.tall).length;
	ok(visible > 0, 'the tree is visible through open air');

	w.cells[cellIndex(vx, vy - 2, vz - 1)] = setField(0, 'floor', 0) >>> 0;
	const hidden = draw(w, vx, vy, vz, true).filter((r) => r.tall).length;
	eq(hidden, 0, 'a floor in the way hides it');

	w.cells[cellIndex(vx, vy - 2, vz - 1)] = setField(0, 'block', STONE) >>> 0;
	eq(draw(w, vx, vy, vz, true).filter((r) => r.tall).length, 0, 'so does a block');
}

// Only genuinely tall art qualifies. Stone is exactly one cell, so it must not
// float up from two floors down.
{
	const w = blank();
	const [vx, vy, vz] = [11, 11, 10];
	w.cells[cellIndex(vx, vy - 2, vz - 2)] = setField(0, 'block', STONE) >>> 0;
	eq(draw(w, vx, vy, vz, true).filter((r) => r.tall).length, 0,
		'a stone block two floors down stays out of sight');
}

// The tallness test is measured against stone, not hardcoded.
{
	const tree = style.graphics[5 + TREE], stone = style.graphics[5 + STONE];
	let taller = 0;
	for (let b = 0; b < 67; b++) {
		const a = tree.slots?.[b], s = stone.slots?.[b];
		if (a && s && a.h > s.h) taller++;
	}
	ok(taller > 10, `tree art really is taller than stone at ${taller} bobs`);
}

// Every facing works, not just north.
{
	const w = blank();
	const [vx, vy, vz] = [11, 11, 10];
	const spots = [[vx, vy - 2], [vx + 2, vy], [vx, vy + 2], [vx - 2, vy]];
	for (let dir = 0; dir < 4; dir++) {
		const [tx, ty] = spots[dir];
		w.cells.fill(0);
		w.cells[cellIndex(tx, ty, vz - 2)] = setField(0, 'block', TREE) >>> 0;
		const list = buildDrawList({
			cells: w.cells, items: w.items, x: vx, y: vy, floor: vz, direction: dir,
			tables, style, panels: { count: 36 }, tallObjects: true,
		});
		ok(list.some((r) => r.tall), `facing ${dir} sees it`);
	}
}

console.log(`tall objects: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
