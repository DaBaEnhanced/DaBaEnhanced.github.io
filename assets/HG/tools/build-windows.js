'use strict';
// Decode Data/GameFast.dat/Windows.gfx into a web-loadable indexed atlas.
//
// This is not the normal 67-slot block BOB format. Windows.s builds a small
// offset table followed by six bob_struct records, with image data directly
// after each record. The view window uses entry 0.

const fs = require('fs');
const path = require('path');
const { decodeILBM } = require('./lib/iff');
const { encodePNG, indexedToRGBA } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');
const SRC = path.join(REPO, 'Data', 'GameFast.dat', 'Windows.gfx');
const ILBM = path.join(REPO, 'Data', 'GameFast.dat', 'Windows.ilbm');

const TABLE_COUNT = 6;
const BOB_STRUCT_SIZE = 18;
const ATLAS_W = 320;

function rowBytes(width) {
	return ((width + 15) >> 4) * 2;
}

function readPalette() {
	if (!fs.existsSync(ILBM)) return null;
	const img = decodeILBM(fs.readFileSync(ILBM));
	const out = [];
	for (let i = 0; i < Math.min(32, img.palette.length / 3); i++) {
		out.push(img.palette[i * 3], img.palette[i * 3 + 1], img.palette[i * 3 + 2]);
	}
	return out;
}

function decodeRecord(buf, index, offsets) {
	const o = offsets[index];
	const next = offsets[index + 1] || buf.length;
	const data = o + BOB_STRUCT_SIZE;
	const width = buf.readUInt16BE(o + 4);
	const height = buf.readUInt16BE(o + 6);
	const maskPlane = buf.readUInt16BE(o + 8);
	const control = buf[o + 10];
	const clip = buf[o + 11];
	const planeOps = [...buf.subarray(o + 12, o + 18)];
	const rb = rowBytes(width);
	const planeBytes = rb * height;
	const dataBytes = Math.max(0, next - data);
	const sourcePlanes = Math.floor(dataBytes / planeBytes);
	const hasCopyData = sourcePlanes > 0 && planeOps.some((op, p) => p < sourcePlanes && op === 1);

	const rec = {
		index,
		name: `window${index + 1}`,
		sourceOffset: o,
		width,
		height,
		rowBytes: rb,
		maskPlane,
		control,
		clip,
		planeOps,
	};

	if (!hasCopyData) {
		return { ...rec, clear: planeOps.slice(0, 6).every((op) => op === 2 || op === 0) };
	}

	const pixels = new Uint8Array(width * height);
	for (let p = 0; p < 6; p++) {
		const op = planeOps[p];
		const bit = 1 << p;
		if (op === 3) {
			for (let i = 0; i < pixels.length; i++) pixels[i] |= bit;
			continue;
		}
		if (op !== 1 || p >= sourcePlanes) continue;
		const planeBase = data + p * planeBytes;
		for (let y = 0; y < height; y++) {
			const rowBase = y * width;
			const srcRow = planeBase + y * rb;
			for (let bx = 0; bx < rb; bx++) {
				const byte = buf[srcRow + bx];
				if (!byte) continue;
				const x0 = bx << 3;
				for (let b = 0; b < 8; b++) {
					if (!(byte & (0x80 >> b))) continue;
					const x = x0 + b;
					if (x < width) pixels[rowBase + x] |= bit;
				}
			}
		}
	}
	return { ...rec, pixels };
}

function pack(rects) {
	let x = 0, y = 0, rowH = 0;
	for (const r of rects) {
		if (x + r.width > ATLAS_W) {
			x = 0;
			y += rowH + 1;
			rowH = 0;
		}
		r.ax = x;
		r.ay = y;
		x += r.width + 1;
		rowH = Math.max(rowH, r.height);
	}
	return { width: ATLAS_W, height: y + rowH };
}

function main() {
	const buf = fs.readFileSync(SRC);
	const offsets = [];
	for (let i = 0; i < TABLE_COUNT; i++) offsets.push(buf.readUInt32BE(i * 4));

	const records = offsets.map((_, i) => decodeRecord(buf, i, offsets));
	const rects = records.filter((r) => r.pixels);
	const atlasSize = pack(rects);
	const atlas = new Uint8Array(atlasSize.width * atlasSize.height);

	for (const r of rects) {
		for (let y = 0; y < r.height; y++) {
			for (let x = 0; x < r.width; x++) {
				// No mask: every pixel is real, including colour index 0.
				atlas[(r.ay + y) * atlasSize.width + (r.ax + x)] =
					r.pixels[y * r.width + x] + 1;
			}
		}
	}

	const windows = records.map((r) => {
		const { pixels, ...meta } = r;
		if (r.pixels) return { ...meta, ax: r.ax, ay: r.ay };
		return meta;
	});

	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'windows.atlas'), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, 'windows.json'), JSON.stringify({
		source: 'Data/GameFast.dat/Windows.gfx',
		sourceAssembly: 'Data/GameFast.dat/Windows.s',
		atlas: { file: 'windows.atlas', width: atlasSize.width, height: atlasSize.height },
		windows,
		comment: 'Window BOBs. Atlas stores index+1 and has no transparency; colour 0 is copied.',
	}, null, '\t'));

	const palette = readPalette();
	if (palette) {
		fs.writeFileSync(
			path.join(OUT, 'windows.preview.png'),
			encodePNG(atlasSize.width, atlasSize.height,
				indexedToRGBA(atlas.map((v) => (v ? v - 1 : 0)), palette, -1)),
		);
	}

	console.log(`windows: ${records.length} records, ${rects.length} with pixels, ` +
		`atlas ${atlasSize.width}x${atlasSize.height}`);
	for (const r of records) {
		console.log(`  ${r.name}: ${r.width}x${r.height} ops ${r.planeOps.join(',')}` +
			(r.pixels ? ` at ${r.ax},${r.ay}` : ' (no image data)'));
	}
}

main();
