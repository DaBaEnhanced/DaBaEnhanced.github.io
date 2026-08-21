'use strict';
// Build the DTS overhead-map tiles from each style's MapBlocks.bin.
//
// MapBlocks.bin is not a normal 67-slot block BOB. Its source is one BOB header
// followed by 64 contiguous 16x16, 4-plane tiles. window3 selects a tile by
// `tile << 7`, because each tile is 16 lines * 2 bytes/row * 4 planes = 128.

const fs = require('fs');
const path = require('path');
const { encodePNG } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');
const PALETTE = path.join(OUT, 'palette.json');

const HEADER_SIZE = 18;
const STYLE_COUNT = 5;
const TILE_COUNT = 64;
const TILE_W = 16;
const TILE_H = 16;
const PLANES = 4;
const ROW_BYTES = TILE_W / 8;
const TILE_BYTES = ROW_BYTES * TILE_H * PLANES;
const ATLAS_W = 272; // 16 tiles per row with 1px gutters.

function decodeTile(buf, tile) {
	const start = HEADER_SIZE + tile * TILE_BYTES;
	const pixels = new Uint8Array(TILE_W * TILE_H);
	for (let y = 0; y < TILE_H; y++) {
		for (let x = 0; x < TILE_W; x++) {
			let v = 0;
			for (let p = 0; p < PLANES; p++) {
				const off = start + p * ROW_BYTES * TILE_H + y * ROW_BYTES + (x >> 3);
				if ((buf[off] >> (7 - (x & 7))) & 1) v |= 1 << p;
			}
			pixels[y * TILE_W + x] = v;
		}
	}
	return pixels;
}

function pack(rects) {
	let x = 0, y = 0, rowH = 0;
	for (const r of rects) {
		if (x + r.w > ATLAS_W) {
			x = 0;
			y += rowH + 1;
			rowH = 0;
		}
		r.ax = x;
		r.ay = y;
		x += r.w + 1;
		rowH = Math.max(rowH, r.h);
	}
	return { width: ATLAS_W, height: y + rowH };
}

function readPalette() {
	if (!fs.existsSync(PALETTE)) return null;
	const data = JSON.parse(fs.readFileSync(PALETTE, 'utf8'));
	return data.colours.flat();
}

function buildPreview(atlas, width, height) {
	const pal = readPalette();
	if (!pal) return null;
	const rgba = new Uint8Array(atlas.length * 4);
	for (let i = 0; i < atlas.length; i++) {
		const v = atlas[i];
		if (!v) continue;
		const c = v - 1, o = i * 4;
		rgba[o] = pal[c * 3] || 0;
		rgba[o + 1] = pal[c * 3 + 1] || 0;
		rgba[o + 2] = pal[c * 3 + 2] || 0;
		rgba[o + 3] = 255;
	}
	return encodePNG(width, height, rgba);
}

function main() {
	const rects = [];
	const styles = {};
	for (let style = 0; style < STYLE_COUNT; style++) {
		const source = `Graphics/Style${style + 1}/Raw/MapBlocks.bin`;
		const buf = fs.readFileSync(path.join(REPO, source));
		const dataBytes = TILE_COUNT * TILE_BYTES;
		if (buf.length < HEADER_SIZE + dataBytes) {
			throw new Error(`${source}: too short for ${TILE_COUNT} DTS tiles`);
		}
		const tiles = [];
		for (let tile = 0; tile < TILE_COUNT; tile++) {
			const rect = {
				style, index: tile, source,
				x: 0, y: 0, w: TILE_W, h: TILE_H,
				pixels: decodeTile(buf, tile),
			};
			rects.push(rect);
			tiles.push(rect);
		}
		styles[style] = { source, tiles };
	}

	const atlasSize = pack(rects);
	const atlas = new Uint8Array(atlasSize.width * atlasSize.height);
	for (const r of rects) {
		for (let y = 0; y < r.h; y++) {
			for (let x = 0; x < r.w; x++) {
				atlas[(r.ay + y) * atlasSize.width + r.ax + x] =
					r.pixels[y * r.w + x] + 1;
			}
		}
		delete r.pixels;
	}

	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'dts-mapblocks.atlas'), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, 'dts-mapblocks.json'), JSON.stringify({
		source: 'Graphics/Style*/Raw/MapBlocks.bin',
		sourceAssembly: 'Graphics/Style*/Ass/MapBlocks.s',
		tileSize: { width: TILE_W, height: TILE_H },
		tileCount: TILE_COUNT,
		atlas: {
			file: 'dts-mapblocks.atlas',
			width: atlasSize.width,
			height: atlasSize.height,
		},
		styles,
		comment: 'DTS/window3 overhead tiles. Atlas stores colour index+1; colour 0 is copied as a real pixel.',
	}, null, '\t'));

	const preview = buildPreview(atlas, atlasSize.width, atlasSize.height);
	if (preview) fs.writeFileSync(path.join(OUT, 'dts-mapblocks.preview.png'), preview);

	console.log(`dts mapblocks: ${STYLE_COUNT} styles, ${rects.length} tiles, ` +
		`atlas ${atlasSize.width}x${atlasSize.height}`);
}

main();
