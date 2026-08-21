'use strict';
// The pre-mission briefing pictures.
//
// A location names one through locn.picture_num, which Static.s formats into
// "Static/StaticNN.pic" (Static.s:167). The .pic files are built from the .ham8
// ones by Data/Static.dat/Ham8_2_Pic.rexx, so the ham8 set is the Amiga-facing
// conversion and Graphics/Static/NN.24ilbm is the artwork it came from.
//
// This takes the 24-bit originals, for two reasons: they cover every picture
// number the campaign uses (1-5, 7-14), where only nine have a .ham8 beside
// them, and there is nothing to gain from re-quantising them for a display that
// is not an Amiga.
//
// The `NNb` files are a second, different painting for the same location and are
// left alone for now -- nothing in locn selects between them.

const fs = require('fs');
const path = require('path');
const { unpackByteRun1 } = require('./lib/iff');
const { encodePNG } = require('./lib/png');

/**
 * 24-bit ILBM with the STANDARD plane interleave: per row, all 24 planes.
 *
 * lib/iff's decodeILBM24 is not this. It was written for Map4.24ilbm, which
 * stores each plane as one full-height bitmap end to end, and it reads the bits
 * MSB-first. Pointing it at these produces coloured noise. Planes 0-7 are the
 * red channel, 8-15 green, 16-23 blue, and plane p is bit p of its channel --
 * least significant first, which is the usual ILBM convention and what these
 * files actually use.
 */
function decodeInterleaved24(buf) {
	let o = 12, width = 0, height = 0, nPlanes = 0, compression = 0;
	let bodyOff = -1, bodyLen = 0;
	while (o + 8 <= buf.length) {
		const id = buf.toString('ascii', o, o + 4);
		const size = buf.readUInt32BE(o + 4);
		if (id === 'BMHD') {
			width = buf.readUInt16BE(o + 8);
			height = buf.readUInt16BE(o + 10);
			nPlanes = buf[o + 16];
			compression = buf[o + 18];
		} else if (id === 'BODY') {
			bodyOff = o + 8;
			bodyLen = size;
		}
		o += 8 + size + (size & 1);
	}
	if (!width || bodyOff < 0) throw new Error('bad 24-bit ILBM');

	const rowBytes = ((width + 15) >> 4) * 2;
	const rawLen = rowBytes * nPlanes * height;
	const body = compression === 1
		? unpackByteRun1(buf, bodyOff, bodyOff + bodyLen, rawLen)
		: buf.subarray(bodyOff, bodyOff + rawLen);

	const rgba = new Uint8Array(width * height * 4);
	for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;   // opaque throughout
	for (let y = 0; y < height; y++) {
		for (let p = 0; p < nPlanes; p++) {
			const channel = p >> 3;
			const mask = 1 << (p & 7);
			const src = (y * nPlanes + p) * rowBytes;
			for (let bx = 0; bx < rowBytes; bx++) {
				const byte = body[src + bx];
				if (!byte) continue;
				const x0 = bx << 3;
				for (let b = 0; b < 8; b++) {
					if (!(byte & (0x80 >> b))) continue;
					const x = x0 + b;
					if (x >= width) break;
					rgba[(y * width + x) * 4 + channel] |= mask;
				}
			}
		}
	}
	return { width, height, rgba };
}

const REPO = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO, 'Graphics', 'Static');
const OUT = path.resolve(__dirname, '..', 'assets', 'briefings');

function convert(num) {
	const file = path.join(SRC, `${num}.24ilbm`);
	if (!fs.existsSync(file)) return null;
	const img = decodeInterleaved24(fs.readFileSync(file));
	fs.writeFileSync(path.join(OUT, `${num}.png`), encodePNG(img.width, img.height, img.rgba));
	return { file: `briefings/${num}.png`, width: img.width, height: img.height };
}

function main() {
	fs.mkdirSync(OUT, { recursive: true });
	const pictures = {};
	for (let n = 1; n <= 20; n++) {
		const info = convert(n);
		if (info) pictures[n] = info;
	}

	// Which locations actually use which picture, so a missing one is loud.
	const maps = path.resolve(__dirname, '..', 'assets', 'maps');
	const used = new Map();
	for (const f of fs.readdirSync(maps)) {
		if (!f.endsWith('.json') || /^campaign|^maps\.json/.test(f)) continue;
		const j = JSON.parse(fs.readFileSync(path.join(maps, f), 'utf8'));
		const n = j.locn?.pictureNum | 0;
		if (!n) continue;                       // 0 is "no picture"
		if (!used.has(n)) used.set(n, []);
		used.get(n).push(f.slice(0, -5));
	}
	const missing = [...used.keys()].filter((n) => !pictures[n]).sort((a, b) => a - b);

	fs.writeFileSync(path.resolve(__dirname, '..', 'assets', 'briefings.json'),
		JSON.stringify({
			source: 'Graphics/Static/NN.24ilbm',
			comment: 'Briefing art, keyed by locn.pictureNum. 0 means no picture. '
				+ 'The text beside these is the location\'s own legend and info, '
				+ 'already carried in each map JSON.',
			pictures,
			usedBy: Object.fromEntries([...used.entries()].sort((a, b) => a[0] - b[0])),
		}, null, '\t'));

	const sizes = new Set(Object.values(pictures).map((p) => `${p.width}x${p.height}`));
	console.log(`briefings: ${Object.keys(pictures).length} pictures, sizes ${[...sizes].join(', ')}`);
	console.log(`used by ${used.size} distinct picture numbers`
		+ (missing.length ? `; MISSING ART for ${missing.join(',')}` : '; all present'));
}

main();
