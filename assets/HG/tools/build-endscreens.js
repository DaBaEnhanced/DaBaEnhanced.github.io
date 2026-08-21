'use strict';
// The death screen and the outro.
//
//   Data/Death.dat/Death.ilbm     320x212, 5 planes, 32 colours
//   Data/Outro.dat/Backdrop.ilbm  320x256, 5 planes, 32 colours
//   Data/Outro.dat/Mushroom.ilbm  320x212, 6 planes, HAM6 (CAMG 0x21800)
//   Data/Outro.dat/Text.s         what becomes of each character afterwards
//
// The .s files beside them are only copper lists -- they set all 32 colours to
// zero and stop, which is the fade-in state, so the real palettes come from each
// ILBM's own CMAP.
//
// These are full-screen stills rather than part of the 3D view, so they are
// emitted as RGBA PNGs instead of being forced through the indexed pipeline and
// its 256-entry palette. Nothing else needs their colours.

const fs = require('fs');
const path = require('path');
const { decodeILBM } = require('./lib/iff');
const { encodePNG } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets', 'endscreens');

/**
 * HAM6 -- the OCS original of the HAM8 already in lib/iff.
 *
 * Six bits a pixel: the top two select the mode, the bottom four carry data.
 * Mode 0 is a plain index into the 16-entry CMAP; the other three HOLD the
 * previous pixel's colour and MODIFY one channel of it, which is how a 16-colour
 * palette paints a photograph. Each row restarts from the border colour.
 */
function ham6ToRGBA(pixels, width, height, palette) {
	const out = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y++) {
		let r = palette[0], g = palette[1], b = palette[2];
		for (let x = 0; x < width; x++) {
			const v = pixels[y * width + x] & 0x3f;
			const data = v & 0x0f;
			switch (v >> 4) {
				case 0: {
					const at = data * 3;
					r = palette[at]; g = palette[at + 1]; b = palette[at + 2];
					break;
				}
				// The 4-bit value is the HIGH nibble of the channel; the low
				// nibble repeats it, the same (n<<4)|n expansion the screen
				// palette uses.
				case 1: b = (data << 4) | data; break;
				case 2: r = (data << 4) | data; break;
				default: g = (data << 4) | data; break;
			}
			const o = (y * width + x) * 4;
			out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
		}
	}
	return out;
}

function indexedToRGBA(img) {
	const { width, height, pixels, palette } = img;
	const out = new Uint8Array(width * height * 4);
	for (let i = 0; i < pixels.length; i++) {
		const at = pixels[i] * 3;
		out[i * 4] = palette[at];
		out[i * 4 + 1] = palette[at + 1];
		out[i * 4 + 2] = palette[at + 2];
		out[i * 4 + 3] = 255;
	}
	return out;
}

function camg(buf) {
	let o = 12;
	while (o < buf.length - 8) {
		const id = buf.toString('ascii', o, o + 4);
		const len = buf.readUInt32BE(o + 4);
		if (id === 'CAMG') return buf.readUInt32BE(o + 8);
		o += 8 + len + (len & 1);
	}
	return 0;
}

function convert(file, name) {
	const buf = fs.readFileSync(file);
	const img = decodeILBM(buf);
	const isHam = (camg(buf) & 0x800) !== 0;
	const rgba = isHam
		? ham6ToRGBA(img.pixels, img.width, img.height, img.palette)
		: indexedToRGBA(img);
	fs.writeFileSync(path.join(OUT, `${name}.png`), encodePNG(img.width, img.height, rgba));
	return {
		file: `endscreens/${name}.png`,
		width: img.width, height: img.height,
		planes: img.nPlanes, ham: isHam,
		source: path.relative(REPO, file).replace(/\\/g, '/'),
	};
}

// --- Text.s ------------------------------------------------------------------
//
// Each character is a run of ABSPOS/CENTRE lines ended by ENDTEXT. From
// Macros.i: ABSPOS 251 takes an x word and a y word, CENTRE 252 centres the
// string that follows on that point, SETPEN 248 picks the colour.
function parseOutroText(file) {
	const src = fs.readFileSync(file, 'latin1');
	const people = [];
	let current = null;
	for (const raw of src.split(/\r?\n/)) {
		const line = raw.replace(/;.*$/, '');
		const label = line.match(/^([a-z_][a-z0-9_]*)\s+dc\.b/i);
		if (label) {
			current = { key: label[1], pen: 2, lines: [] };
			people.push(current);
		}
		if (!current) continue;

		const pen = line.match(/SETPEN\s*,\s*(\d+)/);
		if (pen) current.pen = Number(pen[1]);

		// ABSPOS,x>>8,x&$ff,y>>8,y&$ff,CENTRE,"..."
		const m = line.match(/ABSPOS\s*,\s*(\d+)>>8\s*,\s*\d+&\$ff\s*,\s*(\d+)>>8\s*,\s*\d+&\$ff\s*,\s*CENTRE\s*,\s*"([^"]*)"/);
		if (m) current.lines.push({ x: Number(m[1]), y: Number(m[2]), text: m[3] });

		if (/ENDTEXT/.test(line)) current = null;
	}
	return people.filter((p) => p.lines.length);
}

function main() {
	fs.mkdirSync(OUT, { recursive: true });
	const images = {
		death: convert(path.join(REPO, 'Data', 'Death.dat', 'Death.ilbm'), 'death'),
		backdrop: convert(path.join(REPO, 'Data', 'Outro.dat', 'Backdrop.ilbm'), 'backdrop'),
		mushroom: convert(path.join(REPO, 'Data', 'Outro.dat', 'Mushroom.ilbm'), 'mushroom'),
	};
	const outro = parseOutroText(path.join(REPO, 'Data', 'Outro.dat', 'Text.s'));

	fs.writeFileSync(path.resolve(__dirname, '..', 'assets', 'endscreens.json'),
		JSON.stringify({
			source: 'Data/Death.dat and Data/Outro.dat',
			comment: 'Full-screen stills as RGBA PNGs -- their palettes are their '
				+ 'own and nothing else shares them. Mushroom is HAM6, decoded here. '
				+ 'Outro text is per character, positioned as Text.s positions it.',
			images,
			music: { death: 'Death', outro: 'Outro' },
			outro,
		}, null, '\t'));

	for (const [k, v] of Object.entries(images)) {
		console.log(`${k}: ${v.width}x${v.height} ${v.planes} planes${v.ham ? ' HAM6' : ''}`);
	}
	console.log(`outro text: ${outro.length} characters, `
		+ `${outro.reduce((n, p) => n + p.lines.length, 0)} lines`);
}

main();
