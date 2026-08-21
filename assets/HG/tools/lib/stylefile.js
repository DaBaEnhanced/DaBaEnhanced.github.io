'use strict';
// Parse Graphics/StyleN/Ass/StyleN.s -- the table that maps the game's 49
// logical block graphics to the .bin files that supply them.
//
// The file has three parts we care about:
//   dc.l <symbol>-start   x49   ordered block-graphic table (dc.l 0 = absent)
//   <symbol> ds.b <n>           placeholder, patched at runtime (monster gfx)
//   <symbol> incbin <path>      the actual .bin file

const fs = require('fs');
const path = require('path');

/** Block-graphic table index -> meaning, from Sources/Equates.i cell docs. */
const GRAPHIC_NAMES = [
	'grass', 'unused1', 'lift', 'puddle', 'light', 'stone', 'push', 'field',
	'field2', 'tree', 'field3', 'field4', 'hydraulic',
	'mon1front', 'mon1left', 'mon1right', 'mon1back',
	'mon2front', 'mon2left', 'mon2right', 'mon2back',
	'stairs2out', 'stairs2right', 'stairs2left', 'stairs2in',
	'door1front', 'door1side', 'unused2', 'unused3',
	'text', 'butin', 'butout',
	'eggclosed', 'eggopen',
	'container1', 'container2', 'container3', 'container4', 'container5',
	'unused4',
	'stairs1out', 'stairs1right', 'stairs1left', 'stairs1in',
	'door1openfront', 'door1openside',
	'monster1dead', 'monster2dead', 'mapblocks',
];

/** Resolve an Amiga assign path (`3Dgame:graphics/style1/raw/x.bin`) to a real file. */
function resolveAmigaPath(amigaPath, repoRoot) {
	const rel = amigaPath.replace(/^[^:]*:/, '');           // strip "3Dgame:"
	const parts = rel.split('/').filter(Boolean);
	let cur = repoRoot;
	for (const part of parts) {
		const entries = fs.readdirSync(cur);
		const hit = entries.find((e) => e.toLowerCase() === part.toLowerCase());
		if (!hit) return null;
		cur = path.join(cur, hit);
	}
	return cur;
}

function parseStyleFile(styleSrc, repoRoot) {
	const text = fs.readFileSync(styleSrc, 'latin1');
	const lines = text.split(/\r?\n/);

	const order = [];       // 49 entries: symbol name or null
	const incbin = new Map(); // symbol -> resolved path
	const placeholder = new Map(); // symbol -> byte size

	for (const line of lines) {
		if (/^\s*;/.test(line)) continue;

		const tableEntry = line.match(/^\s+dc\.l\s+(\S+)\s*$/);
		if (tableEntry) {
			const v = tableEntry[1];
			order.push(v === '0' ? null : v.replace(/-start$/, ''));
			continue;
		}

		const inc = line.match(/^(\w+)\s+incbin\s+(\S+)/i);
		if (inc) {
			const resolved = resolveAmigaPath(inc[2], repoRoot);
			if (resolved) incbin.set(inc[1], resolved);
			else console.warn(`  ! unresolved incbin: ${inc[2]}`);
			continue;
		}

		const ds = line.match(/^(\w+)\s+ds\.b\s+(\d+)/i);
		if (ds) placeholder.set(ds[1], Number(ds[2]));
	}

	return { order, incbin, placeholder };
}

module.exports = { parseStyleFile, resolveAmigaPath, GRAPHIC_NAMES };
