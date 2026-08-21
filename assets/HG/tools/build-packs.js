'use strict';
// The shared panel and horizon library.
//
// Only 535 distinct panel designs sit behind 5,140 filled slots across the 47
// maps, and 115 horizons behind 148 -- each design used about nine times. The
// originals were already working from a shared library and copying entries into
// every map; the .map format just has no way to say so. This rebuilds that
// library by hashing every non-blank slot and keeping one copy of each.
//
// The raw planar bytes are kept rather than an expanded atlas: 535 panels at
// 480 bytes and 115 horizons at 576 is about 316KB, where a one-byte-per-pixel
// atlas would be over a megabyte. The editor decodes an entry when it shows it.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUT = path.resolve(__dirname, '..', 'assets');
const MAPS = path.join(OUT, 'maps');

// HGmapstructure.h stores text as 48x40 over two planes and horizon as 144x32
// over one -- but those are the AMIGA layouts, and the two assets do not leave
// the build pipeline in the same shape.
//
//   .panels   already decoded to one byte per pixel (values 0-3), because
//             compositor.applyPanel ORs them straight into planes 0-1.
//             36 * 48 * 40 = 69,120 bytes a map.
//   .horizon  still planar, one plane: 4 * (144/8) * 32 = 2,304 bytes a map.
//
// Slicing the chunky one at the planar stride is how you get a library of
// noise, so the format is explicit here and carried into the metadata.
const PANEL = { w: 48, h: 40, planes: 2, format: 'chunky', bytes: 48 * 40 };      // 1920
const HORIZON = { w: 144, h: 32, planes: 1, format: 'planar', bytes: (144 / 8) * 32 }; // 576

const digest = (b) => crypto.createHash('sha1').update(b).digest('hex');
const isBlank = (b) => b.every((v) => v === 0);

/** Collect distinct slots of `spec` size out of every `ext` file. */
function collect(ext, spec) {
	const entries = new Map();          // hash -> { bytes, uses: [] }
	let slots = 0, blank = 0;
	const files = fs.readdirSync(MAPS).filter((f) => f.endsWith(ext)).sort();
	for (const f of files) {
		const key = f.slice(0, -ext.length);
		const buf = fs.readFileSync(path.join(MAPS, f));
		const n = Math.floor(buf.length / spec.bytes);
		for (let i = 0; i < n; i++) {
			const slice = buf.subarray(i * spec.bytes, (i + 1) * spec.bytes);
			slots++;
			if (isBlank(slice)) { blank++; continue; }
			const h = digest(slice);
			let e = entries.get(h);
			if (!e) entries.set(h, (e = { bytes: Buffer.from(slice), uses: [] }));
			e.uses.push(`${key}#${i}`);
		}
	}
	return { entries, slots, blank, maps: files.length };
}

function emit(name, ext, spec) {
	const { entries, slots, blank, maps } = collect(ext, spec);
	// Most-used first: the picker should open on the designs that actually
	// carry the game, not on whatever hashed lowest.
	const list = [...entries.values()].sort((a, b) => b.uses.length - a.uses.length);

	const blob = Buffer.concat(list.map((e) => e.bytes));
	fs.writeFileSync(path.join(OUT, `${name}.bin`), blob);
	fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({
		source: `deduplicated from the ${maps} shipped maps`,
		comment: `Raw ${spec.format} entries, ${spec.bytes} bytes each, concatenated ` +
			'in index order. Decode with the width/height/format below.',
		file: `${name}.bin`,
		width: spec.w, height: spec.h, planes: spec.planes, format: spec.format,
		entryBytes: spec.bytes,
		count: list.length,
		slotsScanned: slots, blankSlots: blank,
		entries: list.map((e, i) => ({
			index: i,
			uses: e.uses.length,
			// A couple of examples, so an entry can be traced back to a map.
			seenIn: e.uses.slice(0, 3),
		})),
	}, null, '\t'));

	const reuse = slots - blank ? ((slots - blank) / list.length).toFixed(1) : '0';
	console.log(`${name}: ${list.length} distinct of ${slots - blank} filled ` +
		`(${blank} blank, ${slots} slots) -- each used ~${reuse}x, ` +
		`${(blob.length / 1024).toFixed(0)}KB`);
	return list.length;
}

emit('panelpack', '.panels', PANEL);
emit('horizonpack', '.horizon', HORIZON);
