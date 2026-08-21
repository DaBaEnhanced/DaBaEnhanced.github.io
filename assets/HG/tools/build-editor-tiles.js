'use strict';
// The editor's top-down tileset -- MapEditor/Blocks.dat.
//
// HGedit renders its map view from a 16x16, 3-plane icon per cell, blitted as
// `Blocks + block_num*48` USHORTs -- 96 bytes an icon (HGedit3.c:600).
//
// The index is NOT the cell's `block_2d` field. redraw_level (HGedit3.c:587)
// composes it from the cell's contents, so every combination of floor, block,
// panel, water and aux has its own pre-drawn icon:
//
//     33 * (floorState + 5*panel + 10*flowing + 20*aux) + blockState
//
// 5 floor states x 8 flag combinations x 33 block states = 1,320 icons, plus
// three specials at 1324/1325/1328. Blocks.dat unpacks to 127,968 bytes, which
// is exactly 1,333 icons -- so the whole file is addressable and none of it is
// padding. `block_2d` is the GAME's automap derivation, a different thing.
//
// Icons are emitted the same way as every other atlas in this port: one byte
// per pixel holding colour index + 1, so 0 means transparent.

const fs = require('fs');
const path = require('path');
const { unpack } = require('./lib/rnc');
const { decodeILBM } = require('./lib/iff');
const { encodePNG, indexedToRGBA } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');

const TILE_W = 16, TILE_H = 16, PLANES = 3;
const TILE_BYTES = (TILE_W / 8) * TILE_H * PLANES;      // 96
const ROW_BYTES = TILE_W / 8;                            // 2
// Everything the composite index can reach, i.e. the whole file.
const TILE_LIMIT = Infinity;

/** Planar -> one byte per pixel. Planes are stored consecutively per icon. */
function decodeTile(buf, base) {
	const px = new Uint8Array(TILE_W * TILE_H);
	for (let p = 0; p < PLANES; p++) {
		const planeBase = base + p * ROW_BYTES * TILE_H;
		for (let y = 0; y < TILE_H; y++) {
			for (let b = 0; b < ROW_BYTES; b++) {
				const byte = buf[planeBase + y * ROW_BYTES + b];
				for (let bit = 0; bit < 8; bit++) {
					if (byte & (0x80 >> bit)) px[y * TILE_W + b * 8 + bit] |= 1 << p;
				}
			}
		}
	}
	return px;
}

function main() {
	const packed = fs.readFileSync(path.join(REPO, 'MapEditor', 'Blocks.dat'));
	const raw = unpack(packed).data;   // { header, data }
	const total = Math.floor(raw.length / TILE_BYTES);

	const count = Math.min(TILE_LIMIT, total);
	const tiles = [];
	for (let i = 0; i < count; i++) {
		const px = decodeTile(raw, i * TILE_BYTES);
		if (px.some((v) => v)) tiles.push({ index: i, px });
	}

	const cols = 16;
	const rows = Math.ceil(count / cols);
	const aw = cols * TILE_W, ah = rows * TILE_H;
	const atlas = new Uint8Array(aw * ah);
	const byIndex = new Map(tiles.map((t) => [t.index, t.px]));
	const rects = {};
	for (let i = 0; i < count; i++) {
		const ax = (i % cols) * TILE_W, ay = Math.floor(i / cols) * TILE_H;
		const px = byIndex.get(i);
		if (px) {
			for (let y = 0; y < TILE_H; y++) {
				for (let x = 0; x < TILE_W; x++) {
					const v = px[y * TILE_W + x];
					if (v) atlas[(ay + y) * aw + ax + x] = v + 1;   // index + 1
				}
			}
		}
		rects[i] = { ax, ay, w: TILE_W, h: TILE_H, blank: !px };
	}

	// Blocks.ilbm is the same art as an image, and carries the palette.
	const sheet = decodeILBM(fs.readFileSync(path.join(REPO, 'MapEditor', 'Blocks.ilbm')));
	const palette = sheet.palette
		? Array.from({ length: sheet.palette.length / 3 },
			(_, i) => [sheet.palette[i * 3], sheet.palette[i * 3 + 1], sheet.palette[i * 3 + 2]])
		: null;

	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'editor-tiles.atlas'), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, 'editor-tiles.json'), JSON.stringify({
		source: 'MapEditor/Blocks.dat',
		comment: 'Top-down map icons, indexed by a cell\'s block_2d field. Atlas ' +
			'stores colour index + 1, so 0 is transparent.',
		atlas: { file: 'editor-tiles.atlas', width: aw, height: ah },
		tileWidth: TILE_W, tileHeight: TILE_H, columns: cols,
		count, drawn: tiles.length, bufferSlots: total,
		palette,
		tiles: rects,
	}, null, '\t'));

	fs.writeFileSync(path.join(OUT, 'editor-tiles.preview.png'),
		encodePNG(aw, ah, indexedToRGBA(
			Array.from(atlas, (v) => (v ? v - 1 : 0)), sheet.palette || [], -1)));

	console.log(`editor tiles: ${tiles.length} drawn of ${count} icons, atlas ${aw}x${ah}`);
}

main();
