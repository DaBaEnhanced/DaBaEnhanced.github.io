'use strict';
// Extract the sky gradients from Sources/Sky.s.
//
// The copper list only carries empty slots for the sky; update_sky
// (ColdStartup.s) patches them every frame from three tables. Each SKY macro
// invocation is one 24-bit colour:
//
//   SKY r,g,b,dr,dg,db  ->  clamp(r+dr), clamp(g+dg), clamp(b+db), each to 255
//
// emitted as two copper words (high nibbles, then low nibbles via LOCT).
//
// One sky is 44 entries -- one per raster line, covering view rows 0..43, i.e.
// down to the horizon at row 42. locn_sky (0-4) selects which sky.
// nosky and nosky_planet hold 10 skies each (5 normal, then 5 lightning
// variants); scotch_mist holds only the 5 normal ones.
//
// The three tables feed the three colour registers the copper animates, which a
// scan of the compiled list identifies as indices 22, 38 and 54 (~178 writes
// each = 44 lines x 2 view bands x 2 LOCT words).

const fs = require('fs');
const path = require('path');

const { evalExpr } = require('./lib/asmdata');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');
const SKY_SRC = path.join(REPO, 'Sources', 'Sky.s');

const ENTRIES_PER_SKY = 44;
const clamp = (v) => (v > 255 ? 255 : v < 0 ? 0 : v);

/** Read every SKY macro invocation under each top-level label. */
function parseSkyFile(file) {
	const lines = fs.readFileSync(file, 'latin1').split(/\r?\n/);
	const tables = new Map();
	let current = null;

	for (const raw of lines) {
		const line = raw.replace(/;.*$/, '');
		if (!line.trim()) continue;

		const label = line.match(/^([A-Za-z_][A-Za-z_0-9]*)\s*$/);
		if (label) { current = label[1]; tables.set(current, []); continue; }

		const sky = line.match(/^\s+SKY\s+(.*)$/i);
		if (sky && current) {
			// Arguments are 68k literals: mostly $hex, sometimes decimal.
			let a;
			try { a = sky[1].split(',').map((v) => evalExpr(v.trim(), {})); }
			catch { continue; }
			if (a.length < 6 || a.some(Number.isNaN)) continue;
			tables.get(current).push([
				clamp(a[0] + a[3]), clamp(a[1] + a[4]), clamp(a[2] + a[5]),
			]);
		}
	}
	return tables;
}

const tables = parseSkyFile(SKY_SRC);
const out = { source: 'Sources/Sky.s', entriesPerSky: ENTRIES_PER_SKY, tables: {} };

for (const [name, entries] of tables) {
	const skies = [];
	for (let i = 0; i + ENTRIES_PER_SKY <= entries.length; i += ENTRIES_PER_SKY) {
		skies.push(entries.slice(i, i + ENTRIES_PER_SKY));
	}
	out.tables[name] = {
		entries: entries.length,
		skies: skies.length,
		normal: skies.slice(0, 5),
		lightning: skies.length > 5 ? skies.slice(5, 10) : null,
	};
	console.log(`${name.padEnd(14)} ${entries.length} entries -> ${skies.length} skies` +
		`${skies.length > 5 ? ' (5 normal + 5 lightning)' : ''}`);
}

// Which register each table feeds, from the SET_SKY macro's copper offsets.
out.registers = { nosky: 38, nosky_planet: 22, scotch_mist: 54 };
out.comment = 'One sky = 44 colours, one per view row 0..43. registers maps each ' +
	'table to the palette index the copper animates with it.';

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'sky.json'), JSON.stringify(out));

// Sanity: show sky 2 of nosky top-to-bottom, thinned.
const s = out.tables.nosky?.normal?.[2];
if (s) {
	const hex = (c) => c.map((v) => v.toString(16).padStart(2, '0')).join('');
	console.log(`\nnosky sky 2 ramp (every 4th of ${s.length}):`);
	console.log('   ' + s.filter((_, i) => i % 4 === 0).map(hex).join(' '));
}
console.log(`\nwrote assets/sky.json`);
