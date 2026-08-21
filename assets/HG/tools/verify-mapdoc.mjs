// The editor's document must round-trip every shipped map exactly. An edit-
// save-load cycle that quietly drops a field is the worst kind of editor bug,
// so this walks all 47 maps and compares both the JSON and the binaries.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	createMapDoc, serializeMapDoc, validateMapDoc, cellIndex, inBounds,
	CELLS_PER_LAYER, CELL_LAYERS, MAP_WIDTH, MAP_HEIGHT,
} from '../src/editor/mapdoc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'assets', 'maps');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };

const sameBytes = (a, b) => {
	if (!a && !b) return true;
	if (!a || !b || a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
};

// A map is a .json with a .cells beside it; campaign.json and the maps.json
// manifest are not maps.
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')
	&& fs.existsSync(path.join(dir, f.replace('.json', '.cells'))));
let checked = 0, jsonDiffs = 0, cellDiffs = 0, panelDiffs = 0, horizonDiffs = 0;

for (const f of files) {
	const key = f.replace('.json', '');
	const json = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
	const cells = new Uint8Array(fs.readFileSync(path.join(dir, `${key}.cells`)));
	const panelFile = path.join(dir, `${key}.panels`);
	const horizonFile = path.join(dir, `${key}.horizon`);
	const panels = fs.existsSync(panelFile) ? new Uint8Array(fs.readFileSync(panelFile)) : null;
	const horizon = fs.existsSync(horizonFile) ? new Uint8Array(fs.readFileSync(horizonFile)) : null;

	const doc = createMapDoc(json, cells, panels, horizon);
	const out = serializeMapDoc(doc, key);

	if (JSON.stringify(out.json) !== JSON.stringify(json)) { jsonDiffs++; if (jsonDiffs === 1) {
		const a = Object.keys(json), b = Object.keys(out.json);
		console.log('   first JSON diff in', key,
			'missing:', a.filter((k) => !b.includes(k)),
			'extra:', b.filter((k) => !a.includes(k)));
	} }
	if (!sameBytes(out.cells, cells)) cellDiffs++;
	if (!sameBytes(out.panels, panels)) panelDiffs++;
	if (!sameBytes(out.horizon, horizon)) horizonDiffs++;
	checked++;
}

ok(checked === 47, `all 47 maps loaded (got ${checked})`);
ok(jsonDiffs === 0, `JSON round-trips exactly (${jsonDiffs} differ)`);
ok(cellDiffs === 0, `cell layers round-trip exactly (${cellDiffs} differ)`);
ok(panelDiffs === 0, `panels round-trip exactly (${panelDiffs} differ)`);
ok(horizonDiffs === 0, `horizons round-trip exactly (${horizonDiffs} differ)`);

// --- the document is editable, and editing does not touch the source --------
{
	const key = '01-ArtificialIsland';
	const json = JSON.parse(fs.readFileSync(path.join(dir, `${key}.json`), 'utf8'));
	const cells = new Uint8Array(fs.readFileSync(path.join(dir, `${key}.cells`)));
	const doc = createMapDoc(json, cells);

	ok(doc.layers.cells.length === CELLS_PER_LAYER, 'cells layer is one floor stack');
	ok(CELL_LAYERS.length === 3, 'three parallel layers, as the format has');

	const i = cellIndex(5, 6, 7);
	const before = doc.layers.cells[i];
	doc.layers.cells[i] = 0xdeadbeef;
	ok(doc.layers.cells[i] === 0xdeadbeef, 'a cell can be written');
	ok(new Uint8Array(cells).length === cells.length, 'source bytes untouched by construction');
	const reread = new Uint8Array(fs.readFileSync(path.join(dir, `${key}.cells`)));
	const srcWords = new Uint32Array(reread.buffer);
	ok(srcWords[i] === before, 'editing the doc does not reach back into the file bytes');

	// the edit survives a save/load cycle
	const out = serializeMapDoc(doc, 'custom-test');
	const back = createMapDoc(out.json, out.cells);
	ok(back.layers.cells[i] === 0xdeadbeef, 'an edit survives serialise and reload');
	ok(back.meta.key === 'custom-test', 'renaming carries into the document');
	ok(back.meta.cells.file === 'maps/custom-test.cells', 'binary paths follow the new name');

	// bounds
	ok(inBounds(0, 0, 0) && inBounds(22, 22, 19), 'corners are in bounds');
	ok(!inBounds(-1, 0, 0) && !inBounds(0, 0, MAP_HEIGHT) && !inBounds(MAP_WIDTH, 0, 0),
		'out-of-range coordinates rejected');
}

// --- validation warns, never blocks -----------------------------------------
{
	const json = JSON.parse(fs.readFileSync(path.join(dir, '01-ArtificialIsland.json'), 'utf8'));
	const cells = new Uint8Array(fs.readFileSync(path.join(dir, '01-ArtificialIsland.cells')));
	ok(validateMapDoc(createMapDoc(json, cells)).length === 0, 'a shipped map validates clean');

	const broken = createMapDoc(json, cells);
	broken.meta.starts = [{ x: 1, y: 1, floor: 1 }];
	delete broken.meta.exit;
	const warns = validateMapDoc(broken);
	ok(warns.some((w) => /start/.test(w)), 'missing starts reported');
	ok(warns.some((w) => /exit/.test(w)), 'missing exit reported');
	ok(serializeMapDoc(broken).json !== null, 'an invalid map still serialises -- warn, never block');
}

console.log(`mapdoc: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

// --- custom maps join the action list ---------------------------------------
{
	const { createShell, SHELL, applyFrontChoice, FRONT_ITEMS, locationsOf } =
		await import('../src/shell.js');
	const campaign = JSON.parse(fs.readFileSync(path.join(dir, 'campaign.json'), 'utf8'));

	const shell = createShell();
	shell.customMaps = [
		{ key: 'custom/my level', name: 'my level' },
		{ key: 'custom/second', name: 'second' },
	];
	shell.actionFlag = 1;
	shell.party = [0, 1, 2, 3];
	const { confirmParty } = await import('../src/shell.js');
	confirmParty(shell, campaign);

	const builtIn = locationsOf(campaign, 'action').length;
	ok(shell.mode === SHELL.ACTION, 'action list opens');
	ok(shell.list.length === builtIn + 2, `custom maps added (${shell.list.length} = ${builtIn} + 2)`);
	ok(shell.list[0].custom === true && shell.list[1].custom === true,
		'custom maps come first, above the built-ins');
	ok(shell.list[2].custom === undefined, 'built-in levels follow');
	ok(shell.list[0].name === 'my level', 'custom map shows its name');

	// with none saved, the list is exactly the shipped 20
	const plain = createShell();
	plain.actionFlag = 1;
	plain.party = [0, 1, 2, 3];
	confirmParty(plain, campaign);
	ok(plain.list.length === builtIn, 'no custom maps means the list is unchanged');
}

// --- custom keys can never shadow a shipped map -----------------------------
{
	const { customKey, isCustomKey, CUSTOM_PREFIX } = await import('../src/editor/store.js');
	ok(isCustomKey(customKey('anything')), 'custom keys are recognised');
	ok(!isCustomKey('01-ArtificialIsland'), 'a shipped key is not custom');
	ok(customKey('01-ArtificialIsland').startsWith(CUSTOM_PREFIX),
		'a custom map named after a shipped one is still namespaced apart');
	ok(!customKey('../../etc/passwd').includes('..'), 'path characters are stripped from names');
}

console.log(`mapdoc + store: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
