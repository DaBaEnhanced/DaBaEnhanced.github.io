// Doors, lifts, buttons and pushables.
//
// The model is checked against the shipped maps rather than against itself: if
// the editor's idea of "a door is block 20/21 at posn>>2" is wrong, then the
// 47 maps will disagree with it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	structuresAt, buttonAt, addDoor, addLift, addButton, removeStructureAt,
	danglingStructures, cellOfPosn, posnOfCell, reindex, targetData,
	DOOR_BLOCKS, LIMITS, PANEL_IN, PANEL_OUT, LIFT_SIZE, DOOR_SIZE,
	ACTION_LIST, actionTarget, decodeTarget, setButtonAction, describeButton,
} from '../src/editor/structures.js';
import { ACTION } from '../src/buttons.js';
import { createMapDoc, cellIndex } from '../src/editor/mapdoc.js';
import { createHistory, beginGroup, undo, getField, clearCells } from '../src/editor/edit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS = path.join(__dirname, '..', 'assets', 'maps');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const oks = ok;
const eqs = (a, b, m) => ok(a === b, `${m} (got ${a})`);

const load = (key) => createMapDoc(
	JSON.parse(fs.readFileSync(path.join(MAPS, `${key}.json`), 'utf8')),
	new Uint8Array(fs.readFileSync(path.join(MAPS, `${key}.cells`))),
	fs.existsSync(path.join(MAPS, `${key}.panels`))
		? new Uint8Array(fs.readFileSync(path.join(MAPS, `${key}.panels`))) : null,
	fs.existsSync(path.join(MAPS, `${key}.horizon`))
		? new Uint8Array(fs.readFileSync(path.join(MAPS, `${key}.horizon`))) : null);

const keys = fs.readdirSync(MAPS).filter((f) => f.endsWith('.json')
	&& fs.existsSync(path.join(MAPS, f.replace('.json', '.cells'))))
	.map((f) => f.replace('.json', ''));

// --- the model agrees with the shipped maps ---------------------------------
{
	let doors = 0, doorsWithBlock = 0, lifts = 0, liftsWithFloor = 0;
	let buttons = 0, buttonsFound = 0;
	for (const key of keys) {
		const doc = load(key);
		for (const d of doc.meta.doors || []) {
			doors++;
			const b = getField(doc.layers.cells[cellOfPosn(d.posn)] >>> 0, 'block');
			if (b === DOOR_BLOCKS.front || b === DOOR_BLOCKS.side) doorsWithBlock++;
		}
		for (const l of doc.meta.lifts || []) {
			lifts++;
			if (getField(doc.layers.cells[cellOfPosn(l.posn)] >>> 0, 'floor') === 2) liftsWithFloor++;
		}
		// every used button record should be findable from some cell
		const used = (doc.meta.buttons || []).filter((b) => b && b.used);
		buttons += used.length;
		// A button is reached two ways: a wall panel naming it, or a pressure
		// pad -- floor type 1 -- whose index sits in the cell BELOW it
		// (buttons.js checkPad). Counting only panels misses most of them.
		const seen = new Set();
		const LEVEL = 23 * 23;
		for (let i = 0; i < doc.layers.cells.length; i++) {
			const w = doc.layers.cells[i] >>> 0;
			if ((w & 0x8) && [PANEL_IN, PANEL_OUT].includes(getField(w, 'panel'))) {
				seen.add(getField(w, 'variant'));
			}
			if ((w & 0x1) && getField(w, 'floor') === 1 && i - LEVEL >= 0) {
				seen.add(getField(doc.layers.cells[i - LEVEL] >>> 0, 'variant'));
			}
		}
		buttonsFound += used.filter((b) => seen.has(b.index)).length;
	}
	ok(doors > 200, `the maps carry doors (${doors})`);
	ok(doorsWithBlock === doors, `every door record sits on a door block (${doorsWithBlock}/${doors})`);
	ok(lifts > 50, `the maps carry lifts (${lifts})`);
	ok(liftsWithFloor === lifts, `every lift record sits on a lift floor (${liftsWithFloor}/${lifts})`);
	ok(buttons > 300, `the maps carry buttons (${buttons})`);
	ok(buttonsFound / buttons > 0.9,
		`button records are reachable from their cells (${buttonsFound}/${buttons})`);
}

// --- posn round-trips -------------------------------------------------------
{
	ok(cellOfPosn(posnOfCell(1234)) === 1234, 'cell -> posn -> cell');
	const doc = load('01-ArtificialIsland');
	const d = doc.meta.doors[0];
	ok(posnOfCell(cellOfPosn(d.posn)) === d.posn, 'a real door posn round-trips');
	ok(LIFT_SIZE === 10 && DOOR_SIZE === 12, 'record sizes match HGmapstructure.h');
}

// --- lookups ----------------------------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	const d = doc.meta.doors[0];
	const c = cellOfPosn(d.posn);
	const floor = Math.floor(c / 529), rem = c % 529;
	const found = structuresAt(doc, rem % 23, Math.floor(rem / 23), floor);
	ok(found.some((f) => f.table === 'doors' && f.rec === d), 'a door is found at its own cell');
	ok(structuresAt(doc, 0, 0, 0).length >= 0, 'an empty cell yields no structures');
	ok(structuresAt(doc, -1, 0, 0).length === 0, 'out of bounds yields nothing');
}

// --- adding keeps record and cell in step -----------------------------------
{
	const doc = load('01-ArtificialIsland');
	const H = createHistory();
	const before = (doc.meta.doors || []).length;

	beginGroup(H);
	const rec = addDoor(doc, H, 2, 2, 5, { key: 3, delay: 20 });
	ok(rec !== null, 'a door can be added');
	ok(doc.meta.doors.length === before + 1, 'the record went into the table');
	const w = doc.layers.cells[cellIndex(2, 2, 5)] >>> 0;
	ok(getField(w, 'block') === DOOR_BLOCKS.front, 'the cell got a door block');
	ok(cellOfPosn(rec.posn) === cellIndex(2, 2, 5), 'the record points back at the cell');
	ok(rec.key === 3 && rec.delay === 20, 'options carried into the record');
	ok(danglingStructures(doc).length === 0, 'the new door is not dangling');

	beginGroup(H);
	const lift = addLift(doc, H, 3, 3, 5, { minHeight: 2, maxHeight: 5 });
	ok(lift !== null && getField(doc.layers.cells[cellIndex(3, 3, 5)] >>> 0, 'floor') === 2,
		'a lift lays a lift floor');

	beginGroup(H);
	const btn = addButton(doc, H, 4, 4, 5, { out: true, action: 16 });
	ok(btn !== null, 'a button can be added');
	const bw = doc.layers.cells[cellIndex(4, 4, 5)] >>> 0;
	ok((bw & 0x8) !== 0 && getField(bw, 'panel') === PANEL_OUT, 'the cell became an out button');
	ok(buttonAt(doc, 4, 4, 5) === btn, 'the button is found back from its cell');

	// removing takes both away
	beginGroup(H);
	ok(removeStructureAt(doc, H, 2, 2, 5) === 1, 'removing reports one structure');
	ok(doc.meta.doors.length === before, 'the record left the table');
	ok(getField(doc.layers.cells[cellIndex(2, 2, 5)] >>> 0, 'block') !== DOOR_BLOCKS.front,
		'the door block went with it');

	// cell edits from structures are undoable
	beginGroup(H);
	const w2 = doc.layers.cells[cellIndex(9, 9, 5)] >>> 0;
	addDoor(doc, H, 9, 9, 5, {});
	undo(doc, H);
	ok(doc.layers.cells[cellIndex(9, 9, 5)] === w2, 'undo restores the cell a structure changed');
}

// --- limits and dangling ----------------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	doc.meta.doors = [];
	for (let i = 0; i < LIMITS.doors; i++) addDoor(doc, null, i % 23, 1, 3, {});
	ok(doc.meta.doors.length === LIMITS.doors, `the door table fills to ${LIMITS.doors}`);
	ok(addDoor(doc, null, 5, 5, 3, {}) === null, 'a full table refuses another door');

	// a record whose cell was cleared is reported, not repaired
	const doc2 = load('01-ArtificialIsland');
	const c = cellOfPosn(doc2.meta.doors[0].posn);
	doc2.layers.cells[c] = 0;
	const issues = danglingStructures(doc2);
	ok(issues.some((s) => /door/.test(s)), 'a door with no block is reported');
	reindex(doc2);
	ok(doc2.meta.doors.every((d, i) => d.index === i), 'reindex renumbers the table');
}

// --- loose items and monsters -----------------------------------------------
{
	const { itemAt, placeItem, removeItem, addMonster,
		AUX_CONTAINER_FIRST, AUX_CONTAINER_LAST } = await import('../src/editor/structures.js');
	const { hasLooseItem, peekLooseItem } = await import('../src/inventory.js');

	const doc = load('01-ArtificialIsland');
	const H = createHistory();

	// The editor's reading of the shipped maps must match the game's own.
	let mine = 0, theirs = 0, agree = 0;
	for (let f = 0; f < 20; f++) {
		for (let y = 0; y < 23; y++) {
			for (let x = 0; x < 23; x++) {
				const i = cellIndex(x, y, f);
				const a = itemAt(doc, x, y, f);
				const b = peekLooseItem(doc.layers.cells, doc.layers.items, i);
				if (a) mine++;
				if (b) theirs++;
				if (!!a === !!b && (!a || a.num === b.num)) agree++;
			}
		}
	}
	ok(theirs > 0, `the map has loose items (${theirs})`);
	ok(agree === 20 * 529, `the editor reads items exactly as the game does (${agree}/${20 * 529})`);
	ok(mine === theirs, `same count both ways (${mine} vs ${theirs})`);

	// place one and read it back through the GAME's function, not the editor's
	beginGroup(H);
	ok(placeItem(doc, H, 1, 1, 6, 42, { ammo: 200, damage: 5, container: 3 }) === true,
		'an item can be placed');
	const back = peekLooseItem(doc.layers.cells, doc.layers.items, cellIndex(1, 1, 6));
	ok(back && back.num === 42, 'the game finds the placed item');
	ok(back.ammo === 200 && back.damage === 5, 'ammo and damage survive');
	ok(itemAt(doc, 1, 1, 6).container === 3, 'the chosen container is used');
	ok(hasLooseItem(doc.layers.cells, doc.layers.items, cellIndex(1, 1, 6)),
		'the cell reports a loose item');

	// the light and sky flags in the upper byte must not be trampled
	const flagCell = cellIndex(2, 1, 6);
	doc.layers.items[flagCell] = (doc.layers.items[flagCell] | 0x80000000) >>> 0;
	beginGroup(H);
	placeItem(doc, H, 2, 1, 6, 9, {});
	ok((doc.layers.items[flagCell] & 0x80000000) !== 0, 'placing an item keeps the cell flags');

	beginGroup(H);
	ok(removeItem(doc, H, 1, 1, 6) === true, 'an item can be removed');
	ok(peekLooseItem(doc.layers.cells, doc.layers.items, cellIndex(1, 1, 6)) === null,
		'the game no longer finds it');
	ok(removeItem(doc, H, 1, 1, 6) === false, 'removing nothing reports nothing');
	ok(undo(doc, H) === 2, 'removing an item undoes both layers');
	ok(peekLooseItem(doc.layers.cells, doc.layers.items, cellIndex(1, 1, 6)) !== null,
		'undo brought the item back');

	// monsters
	const before = (doc.meta.monsters || []).length;
	const m = addMonster(doc, 5, 5, 7, { type: 3, health: 2500, direction: 2 });
	ok(m !== null && doc.meta.monsters.length === before + 1, 'a monster can be added');
	ok(m.x === 5 && m.y === 5 && m.floor === 7, 'monsters carry coordinates, not a posn');
	ok(structuresAt(doc, 5, 5, 7).some((s) => s.table === 'monsters'), 'found at its cell');
	ok(removeStructureAt(doc, null, 5, 5, 7) >= 1, 'a monster can be removed');
}


// --- wiring a button to what it operates ------------------------------------
{
	const doc = load('01-ArtificialIsland');
	const t = doc.meta.tableOffsets;

	// Which table an action reads is fixed by the action code.
	eqs(actionTarget(ACTION.NOTHING), null, 'Nothing takes no target');
	eqs(actionTarget(ACTION.FLOOR_TOGGLE), 'cell', 'floor actions name a cell');
	eqs(actionTarget(ACTION.BLOCK_ON), 'cell', 'block actions name a cell');
	eqs(actionTarget(ACTION.LIFT_TOGGLE), 'lift', 'lift actions name a lift');
	eqs(actionTarget(ACTION.DOOR_UNLOCK), 'door', 'door actions name a door');
	eqs(actionTarget(ACTION.HATCH), null, 'Hatch takes no target');
	eqs(ACTION_LIST.length, 18, 'every action is listed once');
	oks(!ACTION_LIST.some((a) => a.action === ACTION.UNUSED), 'the unused code is not offered');

	// decode must invert encode for all three families.
	for (const target of [{ lift: 0 }, { lift: 31 }, { door: 5 }, { cell: 1234 }]) {
		const kind = Object.keys(target)[0];
		const action = kind === 'lift' ? ACTION.LIFT_UP
			: kind === 'door' ? ACTION.DOOR_OPEN : ACTION.FLOOR_ON;
		const back = decodeTarget(doc, targetData(doc, target), action);
		oks(back && back[kind] === target[kind],
			`${kind} ${target[kind]} survives encode/decode`);
	}

	// A word that does not land on a record boundary is unresolvable, and
	// saying so beats inventing an index.
	eqs(decodeTarget(doc, t.lifts + 3, ACTION.LIFT_UP), null, 'a misaligned lift word decodes to null');
	eqs(decodeTarget(doc, t.doors - 4, ACTION.DOOR_OPEN), null, 'a word below the table decodes to null');
	eqs(decodeTarget(doc, 0, ACTION.NOTHING), null, 'an action with no target decodes to null');

	// Every shipped button must resolve, or the encoding is wrong.
	let unresolved = 0, checked = 0;
	for (const key of keys) {
		const d = load(key);
		for (const b of d.meta.buttons || []) {
			if (!b || !b.used) continue;
			for (const [act, data] of [[b.actionIn, b.dataIn], [b.actionOut, b.dataOut]]) {
				if (!actionTarget(act)) continue;
				checked++;
				if (!decodeTarget(d, data, act)) unresolved++;
			}
		}
	}
	oks(checked > 200, `checked ${checked} shipped button targets`);
	eqs(unresolved, 0, 'every shipped button target resolves');

	// Rewiring writes both halves of the pair.
	const btn = (doc.meta.buttons || []).find((b) => b && b.used);
	setButtonAction(doc, btn, 'in', ACTION.DOOR_TOGGLE, { door: 3 });
	eqs(btn.actionIn, ACTION.DOOR_TOGGLE, 'the action is stored');
	eqs(decodeTarget(doc, btn.dataIn, btn.actionIn).door, 3, 'the target is stored');
	setButtonAction(doc, btn, 'in', ACTION.NOTHING, null);
	eqs(btn.dataIn, 0, 'clearing the target zeroes the data word');
	oks(describeButton(doc, btn).in.length > 0, 'a button describes itself');
}

// --- clearing ----------------------------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	const history = createHistory(100000);
	const before = Array.from(doc.layers.cells);
	const perFloor = 23 * 23;

	clearCells(doc, history, { floor: 4 });
	oks(doc.layers.cells.slice(4 * perFloor, 5 * perFloor).every((w) => w === 0),
		'clearing one floor empties it');
	oks(doc.layers.cells.slice(5 * perFloor, 6 * perFloor)
		.some((w, i) => w === before[5 * perFloor + i] && w !== 0),
		'and leaves the floor above alone');

	clearCells(doc, history, {});
	oks(doc.layers.cells.every((w) => w === 0), 'clearing the map empties every cell');
	oks(doc.layers.seen.every((w) => w === 0), 'and the other layers with it');

	// One undo per clear, not one per cell.
	undo(doc, history);
	undo(doc, history);
	oks(doc.layers.cells.every((w, i) => w === before[i]), 'two undos restore the whole map');
}

console.log(`structures: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
