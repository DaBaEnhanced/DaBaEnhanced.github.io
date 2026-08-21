// Everything needed to build a map from scratch rather than redecorate one:
// the items-layer payloads, eggs, pressure pads, cell flags and the map header.
//
// Checked against the shipped maps wherever they have something to compare to.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	teleportTargetAt, setTeleportTarget, boostAmountAt, setBoostAmount,
	eggAt, placeEgg, removeEgg, padAt, addPad, padBlocker,
	setButtonSound, buttonSound, EGG_RANDOM, EGG_NEVER,
	PAD_FLOOR_TYPE, BLOCK_TELEPORT, BLOCK_BOOST, LIMITS,
	CORPSE_KINDS, placeCorpse, corpseAt, wallPanelAt, removeWallPanel, clearCell,
	structuresAt, addDoor, placeItem, itemAt,
	AUX_DEAD_SET1, AUX_DEAD_SET2, AUX_SKELETON,
	eggDirectionAt, setEggDirection,
} from '../src/editor/structures.js';
import { setCellPanel, PANEL_SLOTS_ADDRESSABLE } from '../src/editor/packs.js';
import {
	illuminate, rebuild2dMap, rebuildDerived, isLightFixture, LIGHT_BIT,
	LIGHT_BLOCKING,
} from '../src/editor/derived.js';
import {
	createHistory, beginGroup, undo, editCell, setField, getField,
	setFlag, getFlag, FLAGS, TOOLS,
} from '../src/editor/edit.js';
import { createMapDoc, cellIndex, cellOfIndex } from '../src/editor/mapdoc.js';
import {
	MAP_FIELDS, getMapField, setMapField, checkMapProps, STYLE_COUNT,
} from '../src/editor/mapprops.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS = path.join(__dirname, '..', 'assets', 'maps');
const A_SKY = path.join(__dirname, '..', 'assets');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${a}, want ${b})`);

const load = (key) => createMapDoc(
	JSON.parse(fs.readFileSync(path.join(MAPS, `${key}.json`), 'utf8')),
	new Uint8Array(fs.readFileSync(path.join(MAPS, `${key}.cells`))));
const keys = fs.readdirSync(MAPS).filter((f) => f.endsWith('.cells'))
	.map((f) => f.slice(0, -6));

// --- teleport and boost payloads --------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	const h = createHistory(1000);
	const [x, y, z] = [4, 4, 5];

	eq(teleportTargetAt(doc, x, y, z), null, 'a plain cell is not a teleport');
	editCell(doc, h, 'cells', x, y, z, 'block', BLOCK_TELEPORT);
	eq(teleportTargetAt(doc, x, y, z), 0, 'a fresh teleport has no destination');

	const dest = cellIndex(9, 11, 7);
	ok(setTeleportTarget(doc, h, x, y, z, dest), 'the destination is set');
	eq(teleportTargetAt(doc, x, y, z), dest, 'and reads back');
	// The stored word is a BYTE offset, which is what movement.js shifts down.
	eq(doc.layers.items[cellIndex(x, y, z)], dest * 4, 'stored as a byte offset');

	eq(boostAmountAt(doc, x, y, z), null, 'a teleport is not a boost pad');
	editCell(doc, h, 'cells', x, y, z, 'block', BLOCK_BOOST);
	ok(setBoostAmount(doc, h, x, y, z, 5000), 'the boost amount is set');
	eq(boostAmountAt(doc, x, y, z), 5000, 'and reads back');
	ok(!setBoostAmount(doc, h, x, y, z, 5000), 'setting the same amount is a no-op');
	setBoostAmount(doc, h, x, y, z, 999999);
	eq(boostAmountAt(doc, x, y, z), 65535, 'the amount is clamped to a word');
}

// Every shipped teleport must point somewhere real, or the reading is wrong.
{
	let checked = 0, bad = 0;
	for (const key of keys) {
		const doc = load(key);
		for (let i = 0; i < doc.layers.cells.length; i++) {
			const w = doc.layers.cells[i] >>> 0;
			if (!(w & 0x2) || getField(w, 'block') !== BLOCK_TELEPORT) continue;
			const at = cellOfIndex(i);
			const t = teleportTargetAt(doc, at.x, at.y, at.floor);
			checked++;
			if (t === null || t <= 0) bad++;
		}
	}
	ok(checked > 20, `campaign teleports found (${checked})`);
	// 40-4pl (17,8,10) is broken in the shipped data: its items word is
	// 0x0F005BD0, i.e. the four sky flags are set on a teleport cell. `teleport`
	// (Controls&Movement.s:8099) loads that word WHOLE and uses it as a byte
	// offset -- it never masks -- so walking in would jump you far outside the
	// map. Every other teleport keeps those bits clear. Reporting it as
	// unresolvable is right; inventing a destination for it would not be.
	eq(bad, 1, 'exactly one shipped teleport is broken, and it is the known one');
}

// --- eggs --------------------------------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	const h = createHistory(1000);
	const [x, y, z] = [6, 6, 6];

	eq(eggAt(doc, x, y, z), null, 'a plain cell holds no egg');
	const egg = placeEgg(doc, h, x, y, z, { type: 12, hatch: 30, leaveShell: false });
	eq(egg.type, 12, 'the monster type is stored');
	eq(egg.hatch, 30, 'the hatch time is stored');
	eq(egg.leaveShell, false, 'the shell flag is stored');

	// The three egg fields sit in three different layers, and the seen layer
	// also carries flowing_bit and the per-player seen flags.
	const i = cellIndex(x, y, z);
	doc.layers.seen[i] = (doc.layers.seen[i] | (1 << 11) | (1 << 8)) >>> 0;
	placeEgg(doc, h, x, y, z, { type: 3, hatch: EGG_RANDOM, leaveShell: true });
	ok((doc.layers.seen[i] & (1 << 11)) !== 0, 'flowing_bit survives an egg edit');
	ok((doc.layers.seen[i] & (1 << 8)) !== 0, 'a seen flag survives an egg edit');
	eq(eggAt(doc, x, y, z).type, 3, 'the type is replaced');
	eq(eggAt(doc, x, y, z).hatch, EGG_RANDOM, 'random hatch is stored');

	ok(removeEgg(doc, h, x, y, z), 'the egg is removed');
	eq(eggAt(doc, x, y, z), null, 'and is gone');
	ok(!removeEgg(doc, h, x, y, z), 'removing nothing reports nothing');
}

// --- pressure pads ------------------------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	const h = createHistory(1000);

	// A pad names its button through the cell BELOW, so floor 0 cannot hold one.
	ok(padBlocker(doc, 5, 5, 0), 'a pad cannot go on floor 0');
	eq(addPad(doc, h, 5, 5, 0, {}), null, 'and adding one there fails');

	const [x, y, z] = [5, 5, 6];
	// A cell already spending its variant on a panel cannot also name a button.
	const below = cellIndex(x, y, z - 1);
	doc.layers.cells[below] = setField(doc.layers.cells[below] >>> 0, 'panel', 0);
	ok(padBlocker(doc, x, y, z), 'a panel below blocks the pad');
	doc.layers.cells[below] = setField(doc.layers.cells[below] >>> 0, 'panel', null);
	eq(padBlocker(doc, x, y, z), null, 'and clearing it unblocks');

	const rec = addPad(doc, h, x, y, z, {});
	ok(rec, 'the pad is placed');
	eq(getField(doc.layers.cells[cellIndex(x, y, z)] >>> 0, 'floor'), PAD_FLOOR_TYPE,
		'the pad cell is floor type 1');
	eq(getField(doc.layers.cells[below] >>> 0, 'variant'), rec.index,
		'the button index goes in the cell BELOW');

	const found = padAt(doc, x, y, z);
	ok(found && found.button === rec, 'the pad resolves back to its record');
	eq(padAt(doc, x, y, z + 1), null, 'a cell above the pad is not a pad');

	// The index must not collide with an existing button, since the tables are sparse.
	const used = (doc.meta.buttons || []).filter((b) => b && b.used).map((b) => b.index);
	eq(new Set(used).size, used.length, 'button indices stay unique');
	ok(used.length <= LIMITS.buttons, 'the table stays within its limit');
}

// --- cell flags ---------------------------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	const h = createHistory(1000);
	const [x, y, z] = [7, 7, 6];
	const i = cellIndex(x, y, z);
	for (const f of FLAGS) {
		// The cell may already carry the flag, so start from a known state.
		setFlag(doc, h, x, y, z, f.key, false);
		ok(setFlag(doc, h, x, y, z, f.key, true), `${f.key} is set`);
		ok(getFlag(doc.layers.cells[i] >>> 0, f.key), `${f.key} reads back`);
		ok(!setFlag(doc, h, x, y, z, f.key, true), `setting ${f.key} again is a no-op`);
		ok(setFlag(doc, h, x, y, z, f.key, false), `${f.key} is cleared`);
	}
	// Flags must not disturb the fields packed next to them.
	const before = doc.layers.cells[i] >>> 0;
	setFlag(doc, h, x, y, z, 'opaque', true);
	eq(getField(doc.layers.cells[i] >>> 0, 'block'), getField(before, 'block'),
		'a flag leaves the block field alone');
	eq(getField(doc.layers.cells[i] >>> 0, 'floor'), getField(before, 'floor'),
		'a flag leaves the floor field alone');
}

// --- the map header -----------------------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	eq(getMapField(doc, 'style'), 0, 'the style reads from locn');
	ok(setMapField(doc, 'style', 3), 'the style is set');
	eq(doc.meta.locn.style, 3, 'and lands in locn');
	ok(!setMapField(doc, 'style', 3), 'setting the same value is a no-op');
	setMapField(doc, 'style', 99);
	eq(getMapField(doc, 'style'), STYLE_COUNT - 1, 'style is clamped to the styles that exist');
	setMapField(doc, 'style', -5);
	eq(getMapField(doc, 'style'), 0, 'and clamped below');

	// Nested paths must create their node rather than throw.
	const bare = createMapDoc({ key: 'x', cells: {} }, new Uint8Array(4 * 3 * 10580));
	ok(setMapField(bare, 'waterSpeed', 7), 'a missing water object is created');
	eq(bare.meta.water.speed, 7, 'and holds the value');

	setMapField(doc, 'waterLow', 900);
	setMapField(doc, 'waterHigh', 100);
	ok(checkMapProps(doc).some((w) => /low is above/.test(w)), 'an inverted tide is reported');
	eq(MAP_FIELDS.every((f) => f.min <= f.max), true, 'every field has a sane range');

	// Every shipped map must already satisfy its own ranges.
	let offenders = 0;
	for (const key of keys) {
		const d = load(key);
		for (const f of MAP_FIELDS) {
			const v = getMapField(d, f.key);
			if (v < f.min || v > f.max) offenders++;
		}
	}
	eq(offenders, 0, 'no shipped map falls outside the editable ranges');
}

// --- button sounds (an addition, not a restoration) ---------------------------
{
	const doc = load('01-ArtificialIsland');
	const btn = (doc.meta.buttons || []).find((b) => b && b.used);

	eq(buttonSound(btn), null, 'a shipped button is silent');
	ok(setButtonSound(doc, btn, 'Button', { once: true }), 'a sample is attached');
	eq(buttonSound(btn).key, 'Button', 'the key reads back');
	eq(buttonSound(btn).once, true, 'the once flag reads back');
	eq(buttonSound(btn).onRelease, false, 'and defaults to firing on press');
	setButtonSound(doc, btn, 'Button', { onRelease: true });
	eq(buttonSound(btn).once, false, 'flags are replaced, not merged');
	ok(setButtonSound(doc, btn, null), 'the sample is cleared');
	eq(buttonSound(btn), null, 'and is gone');
	eq('sample' in btn, false, 'the field is removed, not left undefined');

	// Silence must stay the default, or every campaign button would start talking.
	let withSound = 0;
	for (const key of keys) {
		for (const b of load(key).meta.buttons || []) if (b && b.sample) withSound++;
	}
	eq(withSound, 0, 'no shipped button carries a sample');
}

// --- the tools cover what they claim -----------------------------------------
{
	const kinds = new Set(TOOLS.map((t) => t.kind));
	for (const k of ['info', 'cell', 'start', 'exit', 'pad', 'egg']) {
		ok(kinds.has(k), `there is a ${k} tool`);
	}
	const blocks = TOOLS.filter((t) => t.kind === 'cell' && t.field === 'block')
		.map((t) => t.value);
	for (const b of [BLOCK_BOOST, BLOCK_TELEPORT]) {
		ok(blocks.includes(b), `block ${b} is placeable`);
	}
	const waters = TOOLS.filter((t) => t.kind === 'cell' && t.field === 'water')
		.map((t) => t.value).filter((v) => v !== null);
	eq(waters.length, 3, 'water is a depth, so all three are placeable');
}


// --- corpses and wall panels --------------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	const h = createHistory(1000);
	const [x, y, z] = [9, 9, 6];

	eq(corpseAt(doc, x, y, z), null, 'a plain cell holds no body');
	ok(placeCorpse(doc, h, x, y, z, AUX_DEAD_SET1), 'a body is placed');
	eq(corpseAt(doc, x, y, z).aux, AUX_DEAD_SET1, 'and reads back');
	ok(!placeCorpse(doc, h, x, y, z, AUX_DEAD_SET1), 'the same body again is a no-op');
	ok(placeCorpse(doc, h, x, y, z, AUX_DEAD_SET2), 'the other set replaces it');
	eq(corpseAt(doc, x, y, z).aux, AUX_DEAD_SET2, 'and reads back');
	ok(placeCorpse(doc, h, x, y, z, AUX_SKELETON), 'a skeleton is placed');
	eq(corpseAt(doc, x, y, z).aux, AUX_SKELETON, 'and reads back');
	eq(placeCorpse(doc, h, x, y, z, 3), false, 'an aux that is not a body is refused');
	eq(CORPSE_KINDS.length, 3, 'two monster bodies and the player skeleton');

	// Wall panels.
	const [px, py, pz] = [10, 9, 6];
	eq(wallPanelAt(doc, px, py, pz), null, 'a plain cell shows no panel');
	ok(setCellPanel(doc, h, px, py, pz, 5), 'a panel is pointed at slot 5');
	eq(wallPanelAt(doc, px, py, pz), 5, 'and reads back');
	// variant is 5 bits, so slots 32-35 exist in the map but cannot be named.
	eq(setCellPanel(doc, h, px, py, pz, 32), false, 'slot 32 cannot be pointed at');
	eq(setCellPanel(doc, h, px, py, pz, PANEL_SLOTS_ADDRESSABLE - 1), true, 'slot 31 can');
	ok(removeWallPanel(doc, h, px, py, pz), 'the panel is removed');
	eq(wallPanelAt(doc, px, py, pz), null, 'and is gone');
	ok(!removeWallPanel(doc, h, px, py, pz), 'removing nothing reports nothing');

	// A wall button must not read as a text plate: both use the panel field.
	const btnCell = (doc.meta.buttons || [])[0];
	ok(btnCell, 'the map has buttons to check against');
	let plates = 0, buttons = 0;
	for (let i = 0; i < doc.layers.cells.length; i++) {
		const w = doc.layers.cells[i] >>> 0;
		if (!(w & 0x8)) continue;
		if (getField(w, 'panel') === 0) plates++; else buttons++;
	}
	ok(plates > 0 && buttons > 0, `the map has both plates (${plates}) and buttons (${buttons})`);
}

// --- every shipped panel slot a cell points at must exist ---------------------
{
	let pointed = 0, unaddressable = 0;
	for (const key of keys) {
		const doc = load(key);
		for (let i = 0; i < doc.layers.cells.length; i++) {
			const w = doc.layers.cells[i] >>> 0;
			if (!(w & 0x8) || getField(w, 'panel') !== 0) continue;
			pointed++;
			if (getField(w, 'variant') >= PANEL_SLOTS_ADDRESSABLE) unaddressable++;
		}
	}
	ok(pointed > 100, `campaign text plates found (${pointed})`);
	eq(unaddressable, 0, 'no shipped plate names a slot above 31');
}


// --- derived data: lighting and the automap ----------------------------------
{
	const doc = load('01-ArtificialIsland');

	// The fixture is a PAIR, not a floor value.
	const fix = (f, b) => {
		let w = 0;
		if (f !== null) w = setField(w, 'floor', f);
		if (b !== null) w = setField(w, 'block', b);
		return w >>> 0;
	};
	ok(isLightFixture(fix(3, 0)), 'puddle floor plus stone is a light fixture');
	ok(!isLightFixture(fix(3, null)), 'a puddle alone is not');
	ok(!isLightFixture(fix(null, 0)), 'stone alone is not');
	ok(!isLightFixture(fix(0, 0)), 'grass plus stone is not');
	ok(!isLightFixture(fix(3, 1)), 'puddle plus a pushable is not');

	// Light travels down a column, is stopped by a blocking block or a floor,
	// and is let through again by a fixture.
	const col = createMapDoc({ key: 'x', cells: {} }, new Uint8Array(4 * 3 * 10580));
	const put = (z, w) => { col.layers.cells[cellIndex(0, 0, z)] = w; };
	put(15, fix(null, 0));                       // stone at 15 blocks
	illuminate(col);
	const litAt = (z) => ((col.layers.items[cellIndex(0, 0, z)] >>> LIGHT_BIT) & 1) === 1;
	ok(litAt(16), 'above the stone is lit');
	ok(!litAt(15), 'the stone itself is dark');
	ok(!litAt(14), 'and everything below it');

	col.layers.items.fill(0);
	put(15, fix(0, null));                       // a plain floor also stops it
	illuminate(col);
	ok(litAt(15), 'the floor cell itself is still lit');
	ok(!litAt(14), 'but a plain floor stops the light below it');

	col.layers.items.fill(0);
	put(15, fix(3, 0));                          // the fixture lets it through
	illuminate(col);
	ok(!litAt(15), 'the fixture cell is dark, since its stone blocks first');
	ok(litAt(14), 'but light continues below a fixture');

	// The pass must touch only its own bit, and only its own range.
	const doc2 = load('01-ArtificialIsland');
	const before = Uint32Array.from(doc2.layers.items);
	illuminate(doc2);
	let strayBits = 0, strayRows = 0;
	for (let i = 0; i < before.length; i++) {
		if ((before[i] & ~(1 << LIGHT_BIT)) !== (doc2.layers.items[i] & ~(1 << LIGHT_BIT))) strayBits++;
	}
	const per = 23 * 23;
	for (let i = 0; i < per; i++) {
		if (before[i] !== doc2.layers.items[i]) strayRows++;
		const top = (20 - 1) * per + i;
		if (before[top] !== doc2.layers.items[top]) strayRows++;
	}
	eq(strayBits, 0, 'illuminate touches only the light bit');
	eq(strayRows, 0, 'and leaves floors 0 and 19 alone, as the C loop does');

	// The automap pass must touch only the low six bits of map_cell2.
	const doc3 = load('01-ArtificialIsland');
	const seenBefore = Uint32Array.from(doc3.layers.seen);
	rebuild2dMap(doc3);
	let seenStray = 0;
	for (let i = 0; i < seenBefore.length; i++) {
		if ((seenBefore[i] & ~0x3f) !== (doc3.layers.seen[i] & ~0x3f)) seenStray++;
	}
	eq(seenStray, 0, 'rebuild2dMap touches only block_2d');

	// Both passes together, and both are idempotent.
	const doc4 = load('01-ArtificialIsland');
	rebuildDerived(doc4);
	const second = rebuildDerived(doc4);
	eq(second.lighting, 0, 'a second relight changes nothing');
	eq(second.blocks2d, 0, 'a second automap rebuild changes nothing');

	// The campaign really does use fixtures, so the rule is not dead code.
	let fixtures = 0;
	for (const key of keys) {
		const d = load(key);
		for (let i = 0; i < d.layers.cells.length; i++) {
			if (isLightFixture(d.layers.cells[i])) fixtures++;
		}
	}
	eq(fixtures, 39, `the campaign has 39 light fixtures (${fixtures})`);
}

// --- the light rule is pinned to the shipped maps -----------------------------
//
// LIGHT_BLOCKING deliberately differs from illuminate() as written: the source
// blocks on stone and pushable only, which fits 25 of the 41 maps that carry
// light data, while adding exit/barrier/teleport fits 36. That is a judgement
// about which authority to trust, so it is measured here rather than asserted
// in a comment -- if the rule drifts, these numbers move.
//
// The count is whole-layer, i.e. "would re-saving this map change its
// lighting?". It runs a little higher than a rows-only comparison because
// floors 0 and 19 are outside the C loop and so always agree.
{
	eq([...LIGHT_BLOCKING].sort((a, b) => a - b).join(','), '0,1,3,5,6',
		'the blocking set is stone, pushable and the three field blocks');

	let exact = 0, differing = 0, withData = 0;
	for (const key of keys) {
		const d = load(key);
		const before = Uint32Array.from(d.layers.items);
		let lit = 0;
		for (let i = 0; i < before.length; i++) lit += (before[i] >>> LIGHT_BIT) & 1;
		// Six maps were never illuminated at all; they say nothing about the rule.
		if (lit === 0) continue;
		withData++;
		illuminate(d);
		let diff = 0;
		for (let i = 0; i < before.length; i++) {
			if (((before[i] >>> LIGHT_BIT) & 1) !== ((d.layers.items[i] >>> LIGHT_BIT) & 1)) diff++;
		}
		differing += diff;
		if (!diff) exact++;
	}
	eq(withData, 41, `41 shipped maps carry light data (${withData})`);
	eq(exact, 36, `re-saving leaves 36 of them bit-identical (${exact})`);
	ok(differing < 1000, `and leaves ${differing} cells differing, well under the 2197 the source rule leaves`);
}


// --- egg hatch facing (an addition; map_cell2 has no spare bits) --------------
{
	const doc = load('01-ArtificialIsland');
	const h = createHistory(1000);
	const [x, y, z] = [12, 12, 6];
	placeEgg(doc, h, x, y, z, { type: 4 });

	eq(eggDirectionAt(doc, x, y, z), null, 'a fresh egg uses the random roll');
	ok(setEggDirection(doc, x, y, z, 2), 'a facing is set');
	eq(eggDirectionAt(doc, x, y, z), 2, 'and reads back');
	ok(!setEggDirection(doc, x, y, z, 2), 'setting the same facing is a no-op');
	ok(setEggDirection(doc, x, y, z, null), 'the facing is cleared');
	eq(eggDirectionAt(doc, x, y, z), null, 'and is back to random');
	eq(doc.meta.eggDirections, undefined, 'an empty table is dropped, not left behind');

	setEggDirection(doc, x, y, z, 3);
	removeEgg(doc, h, x, y, z);
	eq(eggDirectionAt(doc, x, y, z), null, 'removing an egg takes its facing with it');

	// Silence stays the default: no shipped map may carry facings.
	let withFacing = 0;
	for (const key of keys) if (load(key).meta.eggDirections) withFacing++;
	eq(withFacing, 0, 'no shipped map carries egg facings');
}

// --- ambient light range (an addition) ---------------------------------------
{
	const doc = load('01-ArtificialIsland');
	eq(getMapField(doc, 'ambientMin'), null, 'shadow is unset by default');
	eq(getMapField(doc, 'ambientMax'), null, 'sunlight is unset by default');
	eq(doc.meta.ambient, undefined, 'and nothing is stored');

	ok(setMapField(doc, 'ambientMin', 0), 'shadow 0 is a real value');
	eq(getMapField(doc, 'ambientMin'), 0, 'and reads back as 0, not as unset');
	ok(setMapField(doc, 'ambientMax', 60), 'sunlight is set');
	ok(checkMapProps(doc).every((w) => !/outside/.test(w)), 'both are in range');

	setMapField(doc, 'ambientMin', 90);
	ok(checkMapProps(doc).some((w) => /brighter than sunlight/.test(w)),
		'shadow above sunlight is reported');

	ok(setMapField(doc, 'ambientMin', null), 'shadow is cleared');
	eq(getMapField(doc, 'ambientMin'), null, 'and is unset again');
	ok(setMapField(doc, 'ambientMax', null), 'sunlight is cleared');
	eq(doc.meta.ambient, undefined, 'clearing both drops the container');
	ok(!setMapField(doc, 'ambientMin', null), 'clearing an unset field is a no-op');

	// Absent must mean untouched: no shipped map may carry an ambient range.
	let withAmbient = 0;
	for (const key of keys) if (load(key).meta.ambient) withAmbient++;
	eq(withAmbient, 0, 'no shipped map sets an ambient range');
}


// --- clearing a whole cell ----------------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	const h = createHistory(4000);
	const [x, y, z] = [11, 11, 6];
	const i = cellIndex(x, y, z);

	// Pile a cell high, then take it all off in one go.
	editCell(doc, h, 'cells', x, y, z, 'floor', 0);
	editCell(doc, h, 'cells', x, y, z, 'water', 2);
	placeItem(doc, h, x, y, z, 5, { ammo: 20 });
	addDoor(doc, h, x, y, z, {});
	doc.layers.seen[i] = 0x1234;
	doc.layers.items[i] = (doc.layers.items[i] | 0x80000000) >>> 0;

	ok(doc.layers.cells[i] !== 0, 'the cell has contents');
	const n = clearCell(doc, h, x, y, z);
	ok(n > 0, `clearCell reports what it took (${n})`);
	eq(doc.layers.cells[i], 0, 'the cell word is empty');
	eq(doc.layers.seen[i], 0, 'and the seen layer with it');
	eq(doc.layers.items[i], 0, 'and the items layer, light bit and all');
	eq(itemAt(doc, x, y, z), null, 'the item record is gone');
	eq(structuresAt(doc, x, y, z).length, 0, 'and the door record');

	// It undoes as one step, like every other grouped edit.
	undo(doc, h);
	ok(doc.layers.cells[i] !== 0, 'undo brings the cell back');

	eq(clearCell(doc, h, 99, 99, 99), 0, 'an out-of-bounds cell clears nothing');
}

// --- a corpse may overwrite scenery, but not anything that matters ------------
//
// A cell has one aux slot. Deferring on ANY occupant meant a body vanished when
// it fell on an opened eggshell or an ornamental frame, which nobody would miss.
{
	const harmless = [1, 8, 9, 10, 11, 12, 13, 14, 15];
	const precious = [0, 2, 3, 4, 5, 6, 7];
	const src = fs.readFileSync(
		path.join(__dirname, '..', 'src', 'monsters.js'), 'utf8');
	ok(/function auxIsHarmless/.test(src), 'the rule is named rather than inlined');
	ok(/auxIsHarmless\(auxType\(cells\[idx\]\)\)/.test(src),
		'and consulted where the corpse is stamped');

	// The three that must be preserved are exactly the ones carrying state.
	ok(src.includes('AUX_EGG_CLOSED'), 'an unhatched egg is preserved');
	ok(src.includes('AUX_CONTAINER_FIRST') && src.includes('AUX_CONTAINER_LAST'),
		'containers are preserved');
	ok(src.includes('AUX_SKELETON_DEAD'), 'and a player skeleton is preserved');
	eq(precious.length + harmless.length, 16, 'the sixteen aux values are all accounted for');
	// The skeleton is the subtle one: it is the dead player's kit bag.
	ok(/holds a player/.test(src), 'and the reason for the skeleton is recorded');
}


// --- style and sky are different kinds of state -------------------------------
//
// Both live in locn, so it is tempting to handle them together. They are not
// alike: the style is ART and has to be fetched, while the sky is a NUMBER the
// renderer reads off game.skyNum. Changing locn.sky alone left the preview on
// the old ramp, and reloading the style would not have fixed it.
{
	const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	ok(/if \(f\.key === 'style'\) reloadEditorStyle\(\);/.test(src),
		'a style change reloads the style art');
	ok(/if \(f\.key === 'sky'\) \{[\s\S]{0,160}game\.skyNum = getMapField/.test(src),
		'a sky change updates game.skyNum instead');
	ok(!/f\.key === 'style' \|\| f\.key === 'sky'/.test(src),
		'and they are no longer handled as one case');
	ok(/game\.skyNum & 7/.test(src), 'because that is what the palette reads');

	// The ramps really do differ, or none of the above would show.
	const sky = JSON.parse(fs.readFileSync(path.join(A_SKY, 'sky.json'), 'utf8'));
	const ramps = sky.tables.nosky.normal;
	ok(ramps.length >= 5, `at least five sky ramps ship (${ramps.length})`);
	const signature = (r) => r.map((c) => c.join(',')).join('|');
	eq(new Set(ramps.slice(0, 5).map(signature)).size, 5,
		'and the first five are all different, so switching is visible');

	// Every shipped sky index has a ramp behind it.
	let missing = 0;
	for (const key of keys) {
		const n = getMapField(load(key), 'sky');
		if (!ramps[n & 7]) missing++;
	}
	eq(missing, 0, 'every shipped map names a sky ramp that exists');
}

console.log(`authoring: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
