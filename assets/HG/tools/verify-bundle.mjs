// Shipping a hand-built level.
//
// The editor's store is IndexedDB: one browser, one origin, and it never travels
// with a website. So an exported map has to be a single self-contained file that
// the shipped game can fetch out of assets/maps/ like any built-in level. This
// checks that the export/import pair actually round-trips a map, because a
// backup that cannot be reloaded is not a backup.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMapDoc, serializeMapDoc } from '../src/editor/mapdoc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS = path.join(__dirname, '..', 'assets', 'maps');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${a}, want ${b})`);

// store.js reaches for indexedDB at import time only inside its functions, but
// btoa/atob are browser globals the export pair needs.
globalThis.btoa ??= (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
const store = await import('../src/editor/store.js');

const load = (key) => createMapDoc(
	JSON.parse(fs.readFileSync(path.join(MAPS, `${key}.json`), 'utf8')),
	new Uint8Array(fs.readFileSync(path.join(MAPS, `${key}.cells`))),
	new Uint8Array(fs.readFileSync(path.join(MAPS, `${key}.panels`))),
	new Uint8Array(fs.readFileSync(path.join(MAPS, `${key}.horizon`))));

// --- naming -------------------------------------------------------------------
eq(store.BUNDLE_EXT, '.hgmap.json', 'bundles have one extension');
eq(store.bundleName('My Level'), 'My-Level.hgmap.json', 'spaces become dashes');
eq(store.bundleName('a/b:c*d'), 'abcd.hgmap.json', 'path characters are stripped');
ok(store.bundleName('x').endsWith(store.BUNDLE_EXT), 'and the extension is always there');

// --- the round trip -----------------------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	// Something the editor would plausibly have changed.
	doc.layers.cells[1234] = 0;
	doc.meta.ambient = { min: 10, max: 90 };
	doc.meta.eggDirections = { 5987: 2 };

	const key = store.customKey('round trip');
	const record = { name: 'round trip', ...serializeMapDoc(doc, key) };
	const text = store.exportCustomMap(record);
	ok(text.length > 10000, `the bundle carries real data (${text.length} bytes)`);

	const back = store.importCustomMap(text);
	eq(back.name, 'round trip', 'the name survives');
	eq(back.json.locn.style, doc.meta.locn.style, 'the header survives');
	eq(back.json.ambient.min, 10, 'the ambient range survives');
	eq(back.json.eggDirections['5987'], 2, 'egg facings survive');

	// The binaries are the point: base64 must not lose or reorder a byte.
	for (const layer of ['cells', 'panels', 'horizon']) {
		const before = record[layer], after = back[layer];
		ok(after && after.length === before.length,
			`${layer} keeps its length (${after?.length} vs ${before.length})`);
		let diff = 0;
		for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) diff++;
		eq(diff, 0, `${layer} is byte-identical after a round trip`);
	}

	// A round trip must be idempotent, or repeated edits would drift.
	const twice = store.importCustomMap(store.exportCustomMap(back));
	eq(twice.cells.length, back.cells.length, 'a second round trip is stable');
	let drift = 0;
	for (let i = 0; i < back.cells.length; i++) if (back.cells[i] !== twice.cells[i]) drift++;
	eq(drift, 0, 'and changes nothing');
}

// --- refusing what is not a map ----------------------------------------------
{
	let threw = false;
	try { store.importCustomMap('{"format":"something-else"}'); } catch (_) { threw = true; }
	ok(threw, 'a foreign file is refused rather than half-loaded');
	threw = false;
	try { store.importCustomMap('not json at all'); } catch (_) { threw = true; }
	ok(threw, 'and so is rubbish');
}

// --- the manifest can point at one ------------------------------------------
{
	const index = JSON.parse(fs.readFileSync(path.join(MAPS, 'maps.json'), 'utf8'));
	eq(index.maps.length, 47, 'the campaign ships 47 maps');
	ok(index.maps.every((m) => m.key && m.name), 'every entry is named');
	// No built-in uses the bundle path, so the branch is inert for the campaign.
	eq(index.maps.filter((m) => m.bundle).length, 0,
		'no shipped map is bundled, so the loader change cannot affect them');

	// The loader keys off `bundle`, so an added entry must be enough on its own.
	const entry = { key: 'custom-demo', name: 'Demo', bundle: 'maps/Demo.hgmap.json' };
	ok(entry.bundle.endsWith(store.BUNDLE_EXT), 'a manifest entry names a bundle file');
	const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	ok(/entry\?\.bundle/.test(src), 'and loadMap branches on exactly that field');
	ok(/game\.mapIndex = index/.test(src), 'with the manifest kept for the lookup');
}

// --- a shipped map must not be keyed as a store map --------------------------
//
// loadMap routes anything starting with custom/ to IndexedDB. A map meant for a
// website has to be keyed off its own filename instead, or it would only load
// on the machine that built it.
{
	const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	ok(/const key = file\.slice\(0, -BUNDLE_EXT\.length\)/.test(src),
		'the export keys a bundle off its filename');
	ok(!/customKey\(name\)[\s\S]{0,200}serializeMapDoc\(editor\.doc, key\)/.test(src),
		'and not off customKey, which would send it to IndexedDB');

	const key = store.bundleName('My Level').slice(0, -store.BUNDLE_EXT.length);
	eq(key, 'My-Level', 'the key is the file slug');
	eq(store.isCustomKey(key), false, 'and is not treated as a store map');
	ok(store.isCustomKey('custom/My Level'), 'while a store map still is');
}

console.log(`bundle: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
