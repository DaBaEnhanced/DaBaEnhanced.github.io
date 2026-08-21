'use strict';
// Build a web-loadable copy of Graphics/Misc/Raw/GameFont.bin.
//
// GameFont.s defines a 16x6 proportional one-plane font. Characters are stored
// from ASCII 32 upward, one 16x6 glyph after another, with per-character widths
// in the header. The web compositor uses the mask atlas directly.

const fs = require('fs');
const path = require('path');
const { encodePNG } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');
const SRC = path.join(REPO, 'Graphics', 'Misc', 'Raw', 'GameFont.bin');

const START_CHAR = 32;
const GLYPH_COUNT = 96;
const COLS = 16;

function main() {
	const buf = fs.readFileSync(SRC);
	const dataOffset = buf.readUInt32BE(0);
	const cellWidth = buf.readUInt16BE(4);
	const cellHeight = buf.readUInt16BE(6);
	const planes = buf.readUInt16BE(10);
	if (cellWidth !== 16 || cellHeight !== 6 || planes !== 1) {
		throw new Error(`unexpected GameFont shape ${cellWidth}x${cellHeight}x${planes}`);
	}

	const rowBytes = cellWidth >> 3;
	const glyphBytes = rowBytes * cellHeight * planes;
	const rows = Math.ceil(GLYPH_COUNT / COLS);
	const atlas = new Uint8Array(COLS * cellWidth * rows * cellHeight);
	const atlasWidth = COLS * cellWidth;
	const widths = Array.from(buf.subarray(20, 20 + GLYPH_COUNT));

	for (let g = 0; g < GLYPH_COUNT; g++) {
		const gx = (g % COLS) * cellWidth;
		const gy = Math.floor(g / COLS) * cellHeight;
		const glyphOffset = dataOffset + g * glyphBytes;
		for (let y = 0; y < cellHeight; y++) {
			for (let bx = 0; bx < rowBytes; bx++) {
				const b = buf[glyphOffset + y * rowBytes + bx];
				if (!b) continue;
				for (let bit = 0; bit < 8; bit++) {
					if (!(b & (0x80 >> bit))) continue;
					const x = bx * 8 + bit;
					atlas[(gy + y) * atlasWidth + gx + x] = 1;
				}
			}
		}
	}

	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'gamefont.atlas'), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, 'gamefont.json'), JSON.stringify({
		source: 'Graphics/Misc/Raw/GameFont.bin',
		sourceAssembly: 'Graphics/Misc/Ass/GameFont.s',
		atlas: { file: 'gamefont.atlas', width: atlasWidth, height: rows * cellHeight },
		startChar: START_CHAR,
		count: GLYPH_COUNT,
		cellWidth,
		cellHeight,
		columns: COLS,
		widths,
		comment: 'One-plane 16x6 proportional game font. Atlas bytes are coverage masks.',
	}, null, '\t'));

	const rgba = new Uint8Array(atlas.length * 4);
	for (let i = 0; i < atlas.length; i++) {
		if (!atlas[i]) continue;
		const o = i * 4;
		rgba[o] = 238;
		rgba[o + 1] = 221;
		rgba[o + 2] = 204;
		rgba[o + 3] = 255;
	}
	fs.writeFileSync(path.join(OUT, 'gamefont.preview.png'),
		encodePNG(atlasWidth, rows * cellHeight, rgba));

	console.log(`game font: ${GLYPH_COUNT} glyphs, atlas ${atlasWidth}x${rows * cellHeight}`);
}

main();
