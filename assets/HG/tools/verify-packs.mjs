// The shared panel and horizon library.
//
// The strongest check available: every filled slot in every shipped map must be
// findable in the pack. If the dedup lost anything, or the entry size is wrong,
// some map's panel will have no source.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
	entryBytes, decodeEntry, assignPanel, assignHorizon, setCellPanel,
	panelSlotSource, PANEL_SLOTS, PANEL_SLOTS_ADDRESSABLE,
} from '../src/editor/packs.js';
import { createMapDoc, cellIndex } from '../src/editor/mapdoc.js';
import { createHistory, beginGroup, getField, undo } from '../src/editor/edit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(__dirname, '..', 'assets');
const MAPS = path.join(A, 'maps');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };

const loadPack = (name) => ({
	meta: JSON.parse(fs.readFileSync(path.join(A, `${name}.json`), 'utf8')),
	bytes: new Uint8Array(fs.readFileSync(path.join(A, `${name}.bin`))),
});
const panels = loadPack('panelpack');
const horizons = loadPack('horizonpack');

ok(panels.meta.count === 181, `181 distinct panels (${panels.meta.count})`);
ok(horizons.meta.count === 115, `115 distinct horizons (${horizons.meta.count})`);
ok(panels.bytes.length === panels.meta.count * panels.meta.entryBytes, 'panel blob size matches the index');
ok(horizons.bytes.length === horizons.meta.count * horizons.meta.entryBytes, 'horizon blob size matches');
// Panel art leaves the build pipeline CHUNKY -- applyPanel ORs it straight into
// planes 0-1 -- so a slot is 48*40 bytes, not (48/8)*40*2. Horizons are still
// planar. Reading either at the other's stride yields noise, so both the size
// and the declared format are pinned here.
ok(panels.meta.entryBytes === 48 * 40 && panels.meta.width === 48 && panels.meta.height === 40,
	`panels are 48x40 chunky, one byte a pixel (${panels.meta.entryBytes})`);
ok(panels.meta.format === 'chunky', `the panel pack declares its format (${panels.meta.format})`);
ok(horizons.meta.format === 'planar', `the horizon pack declares its format (${horizons.meta.format})`);
ok(horizons.meta.entryBytes === 576 && horizons.meta.width === 144,
	'horizons are 144x32 over one plane');

// --- every filled slot in every map is in the pack --------------------------
{
	const index = new Map();
	for (let i = 0; i < panels.meta.count; i++) {
		index.set(crypto.createHash('sha1').update(entryBytes(panels, i)).digest('hex'), i);
	}
	let filled = 0, missing = 0;
	for (const f of fs.readdirSync(MAPS).filter((n) => n.endsWith('.panels'))) {
		const buf = fs.readFileSync(path.join(MAPS, f));
		const stride = panels.meta.entryBytes;
		// 36 slots a map, exactly -- a stride that does not divide evenly is the
		// first sign of reading the wrong format.
		ok(buf.length === 36 * stride, `${f} holds 36 panel slots`);
		for (let i = 0; i < 36; i++) {
			const slice = buf.subarray(i * stride, (i + 1) * stride);
			if (slice.every((v) => v === 0)) continue;
			filled++;
			if (!index.has(crypto.createHash('sha1').update(slice).digest('hex'))) missing++;
		}
	}
	ok(filled === 1297, `all filled panel slots counted (${filled})`);
	ok(missing === 0, `every filled panel slot is in the pack (${missing} missing)`);
}

// --- entries decode to real images ------------------------------------------
{
	const img = decodeEntry(panels, 0);
	ok(img && img.width === 48 && img.height === 40, 'a panel decodes to 48x40');
	ok(img.pixels.some((v) => v), 'the most-used panel is not blank');
	ok(img.pixels.every((v) => v <= 3), 'two planes give indices 0-3');
	const h = decodeEntry(horizons, 0);
	ok(h && h.width === 144 && h.height === 32, 'a horizon decodes to 144x32');
	ok(h.pixels.every((v) => v <= 1), 'one plane gives indices 0-1');
	ok(decodeEntry(panels, 99999) === null, 'an out-of-range entry is null, not a throw');
	// most-used first
	ok(panels.meta.entries[0].uses >= panels.meta.entries[1].uses, 'entries are ordered by use');
}

// --- assignment materialises into the map -----------------------------------
{
	const key = '01-ArtificialIsland';
	const json = JSON.parse(fs.readFileSync(path.join(MAPS, `${key}.json`), 'utf8'));
	const doc = createMapDoc(json,
		new Uint8Array(fs.readFileSync(path.join(MAPS, `${key}.cells`))),
		new Uint8Array(fs.readFileSync(path.join(MAPS, `${key}.panels`))),
		new Uint8Array(fs.readFileSync(path.join(MAPS, `${key}.horizon`))));

	ok(assignPanel(doc, 5, panels, 3) === true, 'assigning a panel changes the slot');
	const n = panels.meta.entryBytes;
	const slot = doc.panels.subarray(5 * n, 6 * n);
	ok(slot.every((v, i) => v === entryBytes(panels, 3)[i]), 'the slot is byte-identical to the entry');
	ok(assignPanel(doc, 5, panels, 3) === false, 'assigning the same entry again is a no-op');
	ok(panelSlotSource(doc, 5, panels) === 3, 'the slot reports which entry it holds');
	ok(assignPanel(doc, 99, panels, 3) === false, 'a slot past the map is refused');

	ok(assignHorizon(doc, 2, horizons, 7) === true, 'assigning a horizon changes the facing');
	const face = doc.horizon.subarray(2 * 576, 3 * 576);
	ok(face.every((v, i) => v === entryBytes(horizons, 7)[i]), 'the facing is byte-identical');
	ok(assignHorizon(doc, 9, horizons, 7) === false, 'a facing past 3 is refused');

	// pointing a cell at a slot
	const H = createHistory();
	beginGroup(H);
	ok(setCellPanel(doc, H, 4, 4, 11, 5, 0) === true, 'a cell can be pointed at a slot');
	const w = doc.layers.cells[cellIndex(4, 4, 11)];
	ok(getField(w, 'variant') === 5, 'variant holds the slot number');
	ok(setCellPanel(doc, H, 4, 4, 11, PANEL_SLOTS_ADDRESSABLE, 0) === false,
		'a slot a cell cannot address is refused');
	ok(undo(doc, H) === 1, 'pointing a cell at a slot is undoable');
	ok(getField(doc.layers.cells[cellIndex(4, 4, 11)], 'variant') !== 5, 'undo restored the cell');

	ok(PANEL_SLOTS === 36 && PANEL_SLOTS_ADDRESSABLE === 32,
		'36 slots exist but variant is 5 bits, so a cell reaches 32');
}

// --- the picker's colours are the game's own ----------------------------------
//
// A panel is two planes ORed into screen planes 0-1, so value v lands at
// bank + v. The picker used a hand-picked orange ramp instead, and its
// luminance ran the wrong way round: 0 < 1 < 2 < 3 against the palette's
// 0 < 3 < 2 < 1. Value 1 is the highlight and 3 the shadow on every bevel and
// glyph edge, so that shaded the art inside out and turned small lettering to
// mush. Pinned against palette.json rather than restated here.
{
	const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	const pal = JSON.parse(fs.readFileSync(path.join(A, 'palette.json'), 'utf8'));

	const bank = Number(main.match(/const PANEL_BANK = (\d+);/)?.[1]);
	ok(bank === pal.litBase, `the picker uses the lit bank (${bank})`);
	ok(/banks\[PANEL_BANK \+ v\]/.test(main),
		'and reads its colours from the palette rather than naming them');

	// The ordering that was broken. Measured from the palette, not asserted.
	const luma = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
	const ramp = [0, 1, 2, 3].map((v) => pal.colours[bank + v]);
	const order = [0, 1, 2, 3].sort((a, b) => luma(ramp[a]) - luma(ramp[b]));
	ok(order.join('') === '0321',
		'the ramp runs plate, shadow, field, highlight -- 1 is the brightest');
	ok(luma(ramp[1]) > luma(ramp[3]),
		'so value 1 is a highlight and 3 a shadow, not the other way round');

	// The lettering is knocked out as value 0, so that colour is the plate
	// showing through. Black would be a colour the game never puts there.
	ok(luma(ramp[0]) > 0, 'value 0 is the plate showing through, not a hole');

	// And the art really does knock its glyphs out rather than drawing them,
	// which is what makes value 0 load-bearing.
	const meta = JSON.parse(fs.readFileSync(path.join(A, 'panelpack.json'), 'utf8'));
	const buf = new Uint8Array(fs.readFileSync(path.join(A, meta.file)));
	const N = meta.entryBytes;
	let withHoles = 0;
	for (let i = 0; i < meta.count; i++) {
		const e = buf.subarray(i * N, (i + 1) * N);
		if (e.some((v) => v === 0)) withHoles++;
	}
	ok(withHoles > meta.count * 0.9,
		`${withHoles} of ${meta.count} panels carry knocked-out pixels`);
}

console.log(`packs: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
