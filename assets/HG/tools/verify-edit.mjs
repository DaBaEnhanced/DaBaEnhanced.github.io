// Cell editing and undo. Bit layout is checked against real map data rather
// than against itself: reading a shipped map's fields must agree with what the
// game's own view code sees.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	BITS, FIELDS, getField, hasField, setField, createHistory, beginGroup,
	editCell, writeCell, undo, redo, canUndo, canRedo, TOOLS,
} from '../src/editor/edit.js';
import { createMapDoc, cellIndex } from '../src/editor/mapdoc.js';
import { blockIcon } from '../src/editor/blocks2d.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'assets', 'maps');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${a})`);

const key = '01-ArtificialIsland';
const json = JSON.parse(fs.readFileSync(path.join(dir, `${key}.json`), 'utf8'));
const bytes = new Uint8Array(fs.readFileSync(path.join(dir, `${key}.cells`)));
const doc = createMapDoc(json, bytes);
const H = createHistory();

// --- the bit layout agrees with the game's own reading ----------------------
{
	const cells = doc.layers.cells;
	let blocks = 0, floors = 0, waters = 0;
	for (let i = 0; i < cells.length; i++) {
		if (hasField(cells[i], 'block')) blocks++;
		if (hasField(cells[i], 'floor')) floors++;
		if (hasField(cells[i], 'water')) waters++;
	}
	ok(blocks > 0 && floors > 0, `a real map has blocks (${blocks}) and floors (${floors})`);
	ok(getField(0 | BITS.blockHere | (7 << 11), 'block') === 7, 'block field reads back');
	ok(getField(3 << 9, 'floor') === 3, 'floor field reads back');
	ok(getField(0xf << 28, 'aux') === 15, 'aux field reads back');
	// no two fields overlap
	const seen = new Uint8Array(32);
	let overlap = false;
	for (const [, f] of Object.entries(FIELDS)) {
		for (let b = 0; b < 32; b++) {
			if ((f.mask << f.shift) & (1 << b)) { if (seen[b]) overlap = true; seen[b] = 1; }
		}
	}
	ok(!overlap, 'no two cell fields share a bit');
}

// --- setField ---------------------------------------------------------------
{
	let w = 0;
	w = setField(w, 'block', 5);
	ok(getField(w, 'block') === 5 && (w & BITS.blockHere) !== 0, 'setting a field sets its presence bit');
	w = setField(w, 'block', null);
	ok(getField(w, 'block') === 0 && (w & BITS.blockHere) === 0, 'clearing removes value and presence');

	// writing one field must not disturb another
	let v = setField(setField(0, 'block', 9), 'floor', 2);
	ok(getField(v, 'block') === 9 && getField(v, 'floor') === 2, 'fields are independent');
	v = setField(v, 'floor', null);
	ok(getField(v, 'block') === 9, 'clearing the floor leaves the block alone');
	ok(getField(setField(0, 'block', 0xff), 'block') === 0x3f, 'a field cannot overflow its mask');
}

// --- editing and undo -------------------------------------------------------
{
	const i = cellIndex(5, 6, 11);
	const original = doc.layers.cells[i];

	beginGroup(H);
	ok(editCell(doc, H, 'cells', 5, 6, 11, 'block', 0) === true, 'an edit reports a change');
	ok(getField(doc.layers.cells[i], 'block') === 0, 'the edit landed');
	ok(hasField(doc.layers.cells[i], 'block'), 'presence bit set by the edit');
	ok(editCell(doc, H, 'cells', 5, 6, 11, 'block', 0) === false, 'a no-op edit is not recorded');

	ok(canUndo(H), 'undo is available');
	ok(undo(doc, H) === 1, 'undo restores one cell');
	ok(doc.layers.cells[i] === original, 'the cell is exactly as it was');
	ok(!canUndo(H), 'nothing left to undo');
	ok(canRedo(H) && redo(doc, H) === 1, 'redo reapplies it');
	ok(getField(doc.layers.cells[i], 'block') === 0, 'redo landed');
	undo(doc, H);

	// a group undoes as one step
	beginGroup(H);
	for (let x = 0; x < 5; x++) editCell(doc, H, 'cells', x, 2, 11, 'block', 0);
	ok(undo(doc, H) === 5, 'a group of five undoes in one step');

	// out of bounds is refused, not thrown
	ok(editCell(doc, H, 'cells', -1, 0, 0, 'block', 0) === false, 'out-of-bounds edit refused');
	ok(editCell(doc, H, 'cells', 0, 0, 99, 'block', 0) === false, 'bad floor refused');
}

// --- editing drives the top-down view ---------------------------------------
{
	const before = blockIcon(doc.layers.cells, 8, 8, 11);
	beginGroup(H);
	editCell(doc, H, 'cells', 8, 8, 11, 'block', 0);
	const after = blockIcon(doc.layers.cells, 8, 8, 11);
	ok(after !== before || before === 12, 'painting a wall changes the icon it derives');
	// and a neighbour's icon can change too, since the derivation looks around
	const nb = blockIcon(doc.layers.cells, 9, 8, 11);
	undo(doc, H);
	ok(blockIcon(doc.layers.cells, 8, 8, 11) === before, 'undo restores the derived icon');
	ok(typeof nb === 'number', 'neighbours re-derive without error');
}

// --- history is bounded -----------------------------------------------------
{
	const small = createHistory(10);
	for (let n = 0; n < 50; n++) {
		beginGroup(small);
		editCell(doc, small, 'cells', 1, 1, 11, 'block', n % 2 === 0 ? 0 : 4);
	}
	ok(small.entries.length <= 10, `history is capped (${small.entries.length} <= 10)`);
}

// --- the tool palette is coherent -------------------------------------------
{
	ok(TOOLS.length > 0, 'tools defined');
	ok(new Set(TOOLS.map((t) => t.id)).size === TOOLS.length, 'tool ids are unique');
	ok(TOOLS.every((t) => t.kind), 'every tool declares a kind');

	const cellTools = TOOLS.filter((t) => t.kind === 'cell');
	ok(cellTools.every((t) => FIELDS[t.field]), 'every cell tool names a real field');
	ok(cellTools.every((t) => t.value === null || (t.value & FIELDS[t.field].mask) === t.value),
		'every cell tool value fits its field');

	// The tools that do not write a cell must not carry a field, or paintAt
	// would happily write one.
	const other = TOOLS.filter((t) => t.kind !== 'cell');
	ok(other.every((t) => t.field === undefined && t.value === undefined),
		'non-cell tools carry no field');
	eq(TOOLS[0].kind, 'info', 'Info is first, so a click reads before it writes');
	eq(TOOLS.filter((t) => t.kind === 'start').length, 4, 'four player starts');
	ok(TOOLS.filter((t) => t.kind === 'start')
		.every((t, i) => t.player === i), 'start tools are numbered in order');
	eq(TOOLS.filter((t) => t.kind === 'exit').length, 1, 'one exit');
	// The exit BLOCK and the exit POINT are different things; two tools reading
	// "Exit" in the palette is how you place the wrong one.
	eq(new Set(TOOLS.map((t) => t.label)).size, TOOLS.length, 'tool labels are unique');
}


// --- markers and the original editor's names ------------------------------
{
	const { markerFor, MARKER_LEGEND } = await import('../src/editor/view2d.js');
	const { setField, fieldName, FIELD_NAMES } = await import('../src/editor/edit.js');
	const w = (...ops) => ops.reduce((a, [f, v]) => setField(a, f, v), 0) >>> 0;

	// The names are HGedit2.c's tables with the leading "None" dropped, so the
	// value that shows as name index n+1 there must read as n here.
	eq(fieldName('block', 0), 'Stone', 'block 0 is Stone');
	eq(fieldName('block', 4), 'Tree', 'block 4 is Tree');
	eq(fieldName('block', 16), 'Stairs N', 'block 16 is Stairs N');
	eq(fieldName('block', 20), 'Doors NS', 'block 20 is Doors NS');
	eq(fieldName('block', 9), null, 'unused block values have no name');
	eq(fieldName('floor', 1), 'Button', 'floor 1 is a pressure pad');
	eq(FIELD_NAMES.floor.length, 4, 'floor is 2 bits, so only 4 named values');
	eq(fieldName('panel', 1), 'Button in', 'panel 1 is a wall button');
	eq(fieldName('aux', 6), 'Cont 5', 'aux 6 is the big crate');
	eq(fieldName('aux', 14), 'Dead 1', 'aux 14 is a body, not aux 7');
	eq(FIELD_NAMES.aux.length, 16, 'aux is 4 bits, so 16 named values');

	// redraw_level gives every floor/block combination its own icon, so those
	// must NOT be marked -- only what the index folds into a flat offset.
	for (const [label, word] of [
		['Text', w(['panel', 0], ['variant', 3])],
		['Button in', w(['panel', 1])],
		['Cont 5', w(['floor', 0], ['aux', 6])],
		['Monster', w(['aux', 0])],
		['Dead 1', w(['floor', 0], ['aux', 14])],
		['Frame NS', w(['aux', 12])],
	]) {
		const m = markerFor(word);
		ok(m && m.label === label, `${label} is marked (got ${m ? m.label : 'nothing'})`);
	}

	for (const [what, word] of [
		['stone', w(['block', 0])],
		['a tree', w(['block', 4])],
		['ft boost', w(['block', 2])],
		['plain floor', w(['floor', 0])],
		['a floor button', w(['floor', 1])],
		['stairs', w(['block', 16])],
		['a door', w(['block', 20])],
		['an empty cell', 0],
	]) {
		eq(markerFor(word), null, `${what} has its own icon, so it is not marked`);
	}

	// A presence bit off means the field is absent whatever the bits say.
	eq(markerFor((1 << 19) >>> 0), null, 'panel bits without panelHere are not marked');

	// The default wall panel is on nearly every wall in the game, so marking it
	// buries the map. Measured rather than asserted: if the campaign's shape
	// changes, the reason for the gate changes with it.
	eq(markerFor(w(['panel', 0])), null,
		'the default wall panel is not marked');
	ok(markerFor(w(['panel', 0], ['variant', 1])), 'but one naming a slot is');
	ok(markerFor(w(['panel', 1])) && markerFor(w(['panel', 2], ['variant', 0])),
		'and buttons are marked whatever their variant, since it is their index');
	{
		const fs2 = await import('fs');
		const path2 = await import('path');
		const D = path2.join(__dirname, '..', 'assets', 'maps');
		let marked = 0, panels = 0;
		for (const f of fs2.readdirSync(D)) {
			if (!f.endsWith('.cells')) continue;
			const buf = fs2.readFileSync(path2.join(D, f));
			const cells = new Uint32Array(buf.buffer, buf.byteOffset, buf.length >> 2);
			for (let i = 0; i < cells.length; i++) {
				const word = cells[i] >>> 0;
				if (!(word & 0x8)) continue;
				panels++;
				if (markerFor(word)) marked++;
			}
		}
		eq(panels, 262151, `the campaign has ${panels} panel cells`);
		ok(marked < panels / 20,
			`and only ${marked} of them are worth a glyph (was all ${panels})`);
	}

	ok(MARKER_LEGEND.length > 0, 'the legend is not empty');
	ok(MARKER_LEGEND.every((e) => e.label && e.glyph && e.colour), 'every legend row is complete');
}

// --- the game bar stands down while the editor is open ------------------------
//
// Quick save, cheat, debug and the crt filter mean nothing while a level is
// being built, and the crt overlay is a fixed full-screen layer that would sit
// on top of the editor. So the bar is hidden and its modes switched off.
//
// The subtle part is that all four are SAVED preferences. Switching them off
// through the persisting path would rewrite the user's choices to off, and a
// tab closed with the editor open would never get them back -- so the editor's
// override must pass persist: false, and every setter must honour it.
{
	const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	const crt = fs.readFileSync(path.join(__dirname, '..', 'src', 'crt.js'), 'utf8');
	const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

	ok(/function suspendBarModes\(\)/.test(src), 'the editor can stand the bar down');
	ok(/function restoreBarModes\(\)/.test(src), 'and put it back');
	const open = src.slice(src.indexOf('async function openEditor('));
	ok(/suspendBarModes\(\)/.test(open.slice(0, open.indexOf('\n}\n'))),
		'openEditor stands it down');
	const close = src.slice(src.indexOf('function closeEditor()'));
	ok(/restoreBarModes\(\)/.test(close.slice(0, close.indexOf('\n}\n'))),
		'closeEditor puts it back');

	// Every mode the bar carries is covered, and every one opts out of saving.
	const modes = src.slice(src.indexOf('const BAR_MODES = ['), src.indexOf('let barModesHeld'));
	for (const fn of ['setCrt', 'setTallObjects', 'setDebug', 'setCheat']) {
		ok(modes.includes(`${fn}(v, false)`),
			`${fn} is suspended without persisting`);
	}
	// And each setter actually has the opt-out, or passing false does nothing.
	for (const [name, text] of [['setCrt', crt], ['setTallObjects', src],
		['setDebug', src], ['setCheat', src]]) {
		const at = text.indexOf(`function ${name}(`);
		ok(at > 0 && /persist = true/.test(text.slice(at, at + 90)),
			`${name} takes a persist flag`);
		ok(/if \(persist\) \{/.test(text.slice(at, at + 420)),
			`${name} only writes localStorage when asked to`);
	}

	ok(/body\.editing #bar \{ display: none; \}/.test(html),
		'the bar is hidden while editing');
	// The status line lives in that bar and the editor writes to it constantly,
	// so it has to move rather than go dark with the rest.
	ok(/appendChild\(\$\('status'\)\)/.test(src),
		'the status line moves into the editor bar');
	ok(/#editor-bar #status/.test(html), 'and gets a slot sized for it there');
}

console.log(`edit: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
